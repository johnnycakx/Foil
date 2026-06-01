// Transcript digest (ADR-050 / Goal C.1).
//
// Synthesizes docs/transcripts/{creator}/*.txt into a dated market-signal
// digest at docs/transcript-digests/{YYYY-MM-DD}.md. Per creator: freq-ranked
// card mentions, cited prices (exact + attribution), sentiment, and a
// "speculator-spike candidate" tag on cards spoken about with hype language
// (creator hype often precedes a contrarian SELL, so it's flagged as
// speaker-data, never card-data). Also surfaces high-frequency card phrases
// NOT yet in the nickname lexicon, as expansion candidates (John curates).
//
// Usage: node --experimental-strip-types scripts/transcript-digest.ts

import fs from "node:fs";
import path from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";

const ROOT = process.cwd();
const TRANSCRIPTS_DIR = path.join(ROOT, "docs", "transcripts");
const DIGEST_DIR = path.join(ROOT, "docs", "transcript-digests");

// --- Lexicons --------------------------------------------------------------

// Curated card nicknames (load-bearing per John's C.1 note). Each is matched
// case-insensitively against transcript text; `ref` ties it to a catalog card.
const NICKNAMES: { label: string; re: RegExp; ref: string }[] = [
  { label: "Moonbreon (Umbreon VMAX Alt Art)", re: /moon\s?breon/i, ref: "swsh12pt5-215" },
  { label: "Charizard ex SIR", re: /charizard\s+ex\b/i, ref: "sv03-199" },
  { label: "Lugia ex SIR", re: /lugia\s+ex\b/i, ref: "lugia-ex-sir" },
  { label: "Mew ex SIR", re: /\bmew\s+ex\b/i, ref: "mew-ex-sir" },
  { label: "Pikachu Illustrator", re: /pikachu\s+illustrator|illustrator\s+pikachu/i, ref: "pikachu-illustrator" },
  { label: "Gengar VMAX Alt", re: /gengar\s+vmax/i, ref: "gengar-vmax-alt" },
  { label: "Rayquaza V Alt", re: /rayquaza\s+v(?:\b|max|star)/i, ref: "rayquaza-v-alt" },
  { label: "Snorlax VMAX Rainbow", re: /snorlax\s+vmax/i, ref: "snorlax-vmax-rainbow" },
  { label: "Garchomp ex SIR", re: /garchomp\s+ex\b/i, ref: "garchomp-ex-sir" },
  { label: "Pidgeot ex SIR", re: /pidgeot\s+ex\b/i, ref: "pidgeot-ex-sir" },
];

// Popular set names + codes creators reference (not reliably derivable from
// slugs). Codes (sv01-sv10) appear in thumbnails/metadata talk; names in speech.
const SETS = [
  "151", "surging sparks", "prismatic evolutions", "destined rivals", "journey together",
  "twilight masquerade", "stellar crown", "shrouded fable", "paldean fates", "obsidian flames",
  "paradox rift", "temporal forces", "crown zenith", "evolving skies", "lost origin",
  "silver tempest", "black bolt", "white flare", "mega evolution", "scarlet violet",
  "sv01", "sv02", "sv03", "sv04", "sv05", "sv06", "sv07", "sv08", "sv09", "sv10",
];
// "[N]th anniversary" is its own set-signal (e.g. a 30th-anniversary set).
const ANNIVERSARY_RE = /\b\d{1,3}(?:st|nd|rd|th)\s+anniversary\b/gi;

// Upcoming/leak/rumor markers — pre-release signal that LEADS PokeTrace by
// weeks. When these fire near a set mention across multiple channels, it's a
// high-confidence pre-release pulse worth surfacing (ADR-050 / P3 set-pulse).
const LEAK_MARKERS = [
  "leaked", "leak", "rumored", "rumor", "embargo", "early reveal", "next set", "upcoming",
  "anniversary set", "next month", "drops in", "pre-order", "preorder",
  "coming in january", "coming in february", "coming in march", "coming in april",
  "coming in may", "coming in june", "coming in july", "coming in august",
  "coming in september", "coming in october", "coming in november", "coming in december",
];

// Market-hype lexicon → speculator-spike signal (NOT BANNED_PHRASES; that's the
// AI-tell list stripped at ingestion). These survive ingestion on purpose.
const HYPE = [
  "to the moon", "skyrocket", "exploding", "explode", "blowing up", "blow up", "mooning",
  "can't lose", "cannot lose", "insane gains", "huge gains", "printing money", "gonna print",
  "going to print", "crashing", "tanking", "dumping", "free money", "10x", "100x",
];
const MODIFIERS = ["ex", "vmax", "vstar", "gx", "sir", "sar", "v"];

// Broad Pokemon-name set from catalog slugs (`{set}-{num}-{kebab-name}`).
function pokemonNamesFromCatalog(): Set<string> {
  const names = new Set<string>();
  for (const e of CARD_CATALOG) {
    const m = e.slug.match(/^[a-z0-9]+-\d+[a-z]?-(.+)$/);
    if (!m) continue;
    for (const tok of m[1].split("-")) {
      if (tok.length >= 5 && !["alpha", "prime", "delta"].includes(tok)) names.add(tok);
    }
  }
  return names;
}

// --- Extraction ------------------------------------------------------------

function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
}

function extractPrices(text: string): { value: string; context: string }[] {
  const out: { value: string; context: string }[] = [];
  const re = /\$\s?\d[\d,]*(?:\.\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 45);
    const ctx = text.slice(start, m.index + m[0].length + 35).replace(/\s+/g, " ").trim();
    out.push({ value: m[0].replace(/\s/g, ""), context: ctx });
  }
  return out;
}

type CreatorDigest = {
  creator: string;
  videos: number;
  words: number;
  cards: { label: string; count: number }[];
  setSignals: { name: string; count: number; markers: string[] }[];
  prices: { value: string; context: string }[];
  hypeHits: { term: string; count: number }[];
  spikeCandidates: string[];
  expansionCandidates: { phrase: string; count: number }[];
};

function digestCreator(slug: string, pokeNames: Set<string>): CreatorDigest {
  const dir = path.join(TRANSCRIPTS_DIR, slug);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
  const text = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const lower = text.toLowerCase();
  const display = (text.match(/# (.+?) \(@/) || [])[1] || slug;

  const cards = NICKNAMES.map((n) => ({ label: n.label, count: countMatches(lower, n.re) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const flatForSets = lower.replace(/\n/g, " ");
  // Build the candidate set list: the static lexicon + any "[N]th anniversary".
  const anniversaryMentions = [...flatForSets.matchAll(ANNIVERSARY_RE)].map((m) => m[0].toLowerCase());
  const candidateSets = [...SETS, ...new Set(anniversaryMentions)];
  const setSignals = candidateSets
    .map((s) => {
      const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      let count = 0;
      const markers = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(flatForSets)) !== null) {
        count++;
        // Leak/upcoming markers within ~200 chars of this set mention.
        const win = flatForSets.slice(Math.max(0, m.index - 200), m.index + s.length + 200);
        for (const mk of LEAK_MARKERS) if (win.includes(mk)) markers.add(mk);
      }
      return { name: s, count, markers: [...markers] };
    })
    .filter((s) => s.count > 1)
    .sort((a, b) => b.count - a.count);

  const prices = extractPrices(text).slice(0, 12);

  const hypeHits = HYPE.map((h) => ({ term: h, count: countMatches(lower, new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count);

  // Speculator-spike candidates: a nickname card mentioned within ~150 chars of
  // a hype term (auto-sub lines are short, so proximity beats same-line). Joined
  // single-spaced so the window spans the natural spoken sentence, not one cue.
  const flat = lower.replace(/\n/g, " ");
  const hypePositions: number[] = [];
  for (const h of HYPE) {
    let i = flat.indexOf(h);
    while (i !== -1) { hypePositions.push(i); i = flat.indexOf(h, i + 1); }
  }
  const spikeSet = new Set<string>();
  for (const n of NICKNAMES) {
    const re = new RegExp(n.re.source, n.re.flags.includes("g") ? n.re.flags : n.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(flat)) !== null) {
      if (hypePositions.some((hp) => Math.abs(hp - m!.index) <= 400)) { spikeSet.add(n.label); break; }
    }
  }

  // Expansion candidates: `{pokemon} {modifier}` phrases not already a nickname.
  const phraseFreq = new Map<string, number>();
  const phraseRe = new RegExp(`\\b([a-z]{5,})\\s+(${MODIFIERS.join("|")})\\b`, "g");
  let pm: RegExpExecArray | null;
  while ((pm = phraseRe.exec(lower)) !== null) {
    if (!pokeNames.has(pm[1])) continue;
    const phrase = `${pm[1]} ${pm[2]}`;
    phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
  }
  const knownLabels = NICKNAMES.map((n) => n.label.toLowerCase());
  const expansionCandidates = [...phraseFreq.entries()]
    .filter(([p, c]) => c >= 3 && !knownLabels.some((l) => l.includes(p)))
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    creator: display,
    videos: files.length,
    words: text.split(/\s+/).length,
    cards,
    setSignals,
    prices,
    hypeHits,
    spikeCandidates: [...spikeSet],
    expansionCandidates,
  };
}

// --- Render ----------------------------------------------------------------

function render(date: string, digests: CreatorDigest[]): string {
  const L: string[] = [];
  L.push(`# Creator Commentary Digest — ${date}`);
  L.push("");
  L.push(`Synthesized from ${digests.length} whitelisted channels (${digests.reduce((n, d) => n + d.videos, 0)} videos, last 30 days). Source: YouTube auto-subs via \`scripts/ingest-transcripts.ts\`. **This is speaker-data (what creators are saying), not card-data (what a card is worth).** Hype language is a sentiment signal, often a contrarian SELL marker, never a price input. The content engine must synthesize + attribute by name, never copy (ADR-050 + Gate 11).`);
  L.push("");

  // Aggregate card mentions across creators.
  const agg = new Map<string, number>();
  for (const d of digests) for (const c of d.cards) agg.set(c.label, (agg.get(c.label) || 0) + c.count);
  L.push("## Most-discussed cards (all creators)");
  L.push("");
  const aggSorted = [...agg.entries()].sort((a, b) => b[1] - a[1]);
  if (aggSorted.length) {
    L.push("| Card | Total mentions |");
    L.push("|---|---|");
    for (const [label, count] of aggSorted) L.push(`| ${label} | ${count} |`);
  } else {
    L.push("_No curated-nickname cards mentioned this window._");
  }
  L.push("");

  // Aggregate spike candidates.
  const spikes = new Set<string>();
  for (const d of digests) for (const s of d.spikeCandidates) spikes.add(s);
  L.push("## Speculator-spike candidates (hype-flagged → contrarian-SELL watch)");
  L.push("");
  L.push(spikes.size ? [...spikes].map((s) => `- ${s}`).join("\n") : "_None this window._");
  L.push("");

  // Upcoming-set pulse (cross-channel). A set named by 3+ channels WITH leak/
  // upcoming markers attached is a high-confidence pre-release signal that leads
  // PokeTrace by weeks.
  L.push("## Upcoming-set pulse (cross-channel leak/pre-release signal)");
  L.push("");
  type SetAgg = { channels: Set<string>; total: number; markers: Set<string> };
  const setAgg = new Map<string, SetAgg>();
  for (const d of digests) {
    for (const s of d.setSignals) {
      const a = setAgg.get(s.name) ?? { channels: new Set(), total: 0, markers: new Set() };
      a.channels.add(d.creator);
      a.total += s.count;
      for (const mk of s.markers) a.markers.add(mk);
      setAgg.set(s.name, a);
    }
  }
  const pulse = [...setAgg.entries()]
    .map(([name, a]) => ({ name, channels: a.channels.size, total: a.total, markers: [...a.markers] }))
    // Surface sets that multiple channels discuss OR that carry leak markers.
    .filter((p) => p.channels >= 2 || p.markers.length > 0)
    .sort((a, b) => b.channels - a.channels || b.total - a.total);
  if (pulse.length) {
    L.push("| Set | Channels | Mentions | Leak/upcoming markers | Signal |");
    L.push("|---|---|---|---|---|");
    for (const p of pulse) {
      const hot = p.channels >= 3 && p.markers.length > 0 ? "🔥 HIGH (3+ channels + markers)" : p.markers.length > 0 ? "watch (markers present)" : "";
      L.push(`| ${p.name} | ${p.channels} | ${p.total} | ${p.markers.join(", ") || "—"} | ${hot} |`);
    }
    L.push("");
    L.push("_🔥 HIGH = named by 3+ channels with leak/upcoming markers attached → likely pre-release move; consider a timely post + flag for planning._");
  } else {
    L.push("_No multi-channel or marker-flagged set signal this window._");
  }
  L.push("");

  // Per-creator.
  for (const d of digests) {
    L.push(`## ${d.creator}`);
    L.push("");
    L.push(`_${d.videos} videos, ~${d.words.toLocaleString()} words._`);
    L.push("");
    if (d.cards.length) {
      L.push("**Cards (freq-ranked):** " + d.cards.map((c) => `${c.label} (${c.count})`).join(", "));
      L.push("");
    }
    if (d.setSignals.length) {
      L.push("**Sets discussed:** " + d.setSignals.slice(0, 8).map((s) => `${s.name} (${s.count}${s.markers.length ? `, ⚑ ${s.markers.join("/")}` : ""})`).join(", "));
      L.push("");
    }
    if (d.hypeHits.length) {
      L.push("**Hype markers:** " + d.hypeHits.map((h) => `"${h.term}" (${h.count})`).join(", "));
      L.push("");
    }
    if (d.spikeCandidates.length) {
      L.push("**Spike candidates (hype + card co-mention):** " + d.spikeCandidates.join(", "));
      L.push("");
    }
    if (d.prices.length) {
      L.push("**Cited prices** (exact, attributed to " + d.creator + "):");
      for (const p of d.prices) L.push(`- ${p.value} — "…${p.context}…"`);
      L.push("");
    }
    L.push("");
  }

  // Expansion follow-up.
  L.push("## Nickname-list expansion candidates (follow-up — John curates)");
  L.push("");
  L.push("High-frequency `{pokemon} {modifier}` phrases NOT yet in the curated nickname lexicon. Review and promote real cards into `scripts/transcript-digest.ts` NICKNAMES.");
  L.push("");
  const expAgg = new Map<string, number>();
  for (const d of digests) for (const e of d.expansionCandidates) expAgg.set(e.phrase, (expAgg.get(e.phrase) || 0) + e.count);
  const expSorted = [...expAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (expSorted.length) {
    L.push("| Candidate phrase | Mentions |");
    L.push("|---|---|");
    for (const [phrase, count] of expSorted) L.push(`| ${phrase} | ${count} |`);
  } else {
    L.push("_None above threshold this window._");
  }
  L.push("");
  return L.join("\n");
}

function main() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error("[digest] no docs/transcripts/ — run ingest-transcripts.ts first.");
    process.exit(1);
  }
  const pokeNames = pokemonNamesFromCatalog();
  const creators = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const digests = creators.map((c) => digestCreator(c, pokeNames)).filter((d) => d.videos > 0);

  // Never write an EMPTY digest. If ingestion fetched nothing (e.g. CI is
  // YouTube-bot-blocked, R-018), writing a 0-creator digest would (a) clobber
  // the last good digest and (b) feed the content engine empty signal. Skip the
  // write and keep the most recent good digest in place. (Surfaced by the C.1
  // CI verification: a bot-blocked run had overwritten a real digest with an
  // empty one.)
  if (digests.length === 0) {
    console.warn("[digest] 0 transcripts ingested — skipping write to preserve the last good digest (R-018 / bot-block).");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(DIGEST_DIR, { recursive: true });
  const outPath = path.join(DIGEST_DIR, `${date}.md`);
  fs.writeFileSync(outPath, render(date, digests), "utf8");
  console.log(`[digest] wrote ${path.relative(ROOT, outPath)} from ${digests.length} creators.`);
}

if (process.argv[1] && process.argv[1].includes("transcript-digest")) {
  main();
}
