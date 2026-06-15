// Quality gates are the only safety net between Claude's output and the
// public domain in full-autonomy mode. They're structural checks — they can
// catch "too short", "no recent dates", "uses 'in conclusion'" — but they
// CANNOT catch hallucinated prices or fabricated PSA pop counts. The
// architectural assumption: a draft that meets every structural property
// below is unlikely (not impossible) to be embarrassingly bad on facts.
//
// Each gate returns a single string failure when it fails. The orchestrator
// concatenates those into a feedback prompt and re-runs Claude with the list,
// up to MAX_RETRIES times.

import {
  articleSchema,
  faqPageSchema,
  schemaGraph,
} from "./schema-helpers.ts";
import type { GeneratedDraft } from "./content-engine-types.ts";

export const GATE_LIMITS = {
  wordCountMin: 1200,
  wordCountMax: 2200,
  // Currency signal — at least one current-year (2025/2026) reference so the
  // post reads as fresh. Relaxed from 2 → 1 with the vending reframe (ADR-062):
  // a host post is evergreen and doesn't lean on dated market data the way a
  // deal-finder post did.
  recentYearMentionsMin: 1,
  faqWordCountMin: 200,
  internalLinksMin: 2,
  // Vending gate (ADR-062): distinct host-value-prop signals the post must hit
  // so it speaks to the owner, not to a card collector.
  hostBenefitSignalsMin: 3,
} as const;

export const BANNED_PHRASES: readonly string[] = [
  // Pre-existing AI-tell / filler bans.
  "in conclusion",
  "in summary",
  "as we've seen",
  "in today's digital world",
  "the world of pokemon",
  "as a collector",
  // Brand-voice bans (Goal V / docs/BRAND-VOICE.md §5 — hype words + AI tells
  // from the Cowork voice research ban list). Grounds the live gate (e) in the
  // voice doc so blog + newsletter generations auto-fail these.
  "let's dive in",
  "dive in",
  "game-changer",
  "game changer",
  "to the moon",
  "navigate the landscape",
  "delve",
  "tapestry",
  "in today's market",
] as const;

// ---------------------------------------------------------------------------
// Vending vocabularies (ADR-062). These power the gates that replaced the
// deal-finder data gates (dollar-figure count + Foil-scan-data citation +
// provenance), which forced collector/pricing content that doesn't fit a
// host-acquisition post.
// ---------------------------------------------------------------------------

/** Gate V-benefit: phrases that signal the post speaks to the host's value
 *  proposition (hands-off operation, revenue, foot traffic, no cost), not
 *  generic Pokémon-collecting talk. Distinct matches are counted. */
export const HOST_BENEFIT_SIGNALS: readonly string[] = [
  "revenue share",
  "monthly payout",
  "monthly check",
  "foot traffic",
  "hands-off",
  "hands off",
  "no cost",
  "zero cost",
  "free to host",
  "fully managed",
  "we handle",
  "we install",
  "we stock",
  "we restock",
  "we service",
  "no contract",
  "risk-free",
  "trial month",
  "cashless",
  "impulse",
  "passive income",
  "host a machine",
  "your space",
  "square feet",
] as const;

/** Gate V-geo: explicit Bay-Area places. Local relevance is the SEO bet for a
 *  service-area business (doc 04). One match satisfies the gate. */
export const BAY_AREA_GEO_TERMS: readonly string[] = [
  "bay area",
  "north bay",
  "east bay",
  "south bay",
  "solano county",
  "solano",
  "contra costa",
  "napa",
  "american canyon",
  "vallejo",
  "benicia",
  "fairfield",
  "suisun",
  "vacaville",
  "sonoma",
  "walnut creek",
  "concord",
  "pleasant hill",
  "martinez",
  "pittsburg",
  "antioch",
  "sacramento",
] as const;

/** Gate V-link: conversion-page path prefixes. At least one internal link must
 *  point at one of these so the post funnels toward hosting. */
export const CONVERSION_LINK_PATHS: readonly string[] = [
  "/host",
  "/faq",
  "/service-areas",
] as const;

const INTERNAL_LINK_HOSTS: readonly string[] = [
  "foiltcg.com",
  "foil-rosy.vercel.app",
  // Markdown / MDX root-relative links (the canonical internal-link form
  // for this site) count too — they resolve to whatever domain the post
  // is served from, and that's always us.
];

export type GateResult = { passed: boolean; failures: string[] };

/**
 * Context for the gates that need to resolve against the real world (Session
 * 47.4 fact-check work). Both are optional so the existing 3-arg callers + the
 * pure structural tests still work; the orchestrator supplies them in
 * production so gates 9 + 10 actually run.
 */
export type QualityGateContext = {
  /** Gate 9: returns true if an internal href resolves to a real post/route.
   *  Built by the orchestrator from the blog-post dir + service-area city slugs
   *  + the known vending routes (ADR-062). When omitted, gate 9 is skipped. */
  internalLinkExists?: (href: string) => boolean;
  /** Gate 11a: the whitelisted creator names that count as valid attribution
   *  (display names + handles from docs/creator-whitelist.md). Omit to use the
   *  built-in default. */
  creatorNames?: string[];
  /** Gate 11b: concatenated ingested transcript text. When provided, any run of
   *  >25 consecutive words in the draft that also appears in the corpus fails
   *  the gate (copy, not synthesis). Omit (transcripts gitignored / absent) to
   *  skip the verbatim-overlap check. */
  transcriptCorpus?: string;
};

/** Gate 11a: collective "someone said it" phrases that imply a creator source
 *  but name no one. A draft using one of these must name a whitelisted creator
 *  within 50 chars, else it's an unattributed creator claim (ADR-050). */
export const CREATOR_PROVENANCE_PHRASES: readonly string[] = [
  "creators are saying",
  "creators say",
  "youtubers are saying",
  "youtubers say",
  "the community is saying",
  "the community thinks",
  "the community says",
  "people are saying",
  "everyone is saying",
  "everyone's saying",
  "collectors are saying",
  "some are saying",
  "content creators say",
  "the hype is real",
] as const;

/** Default valid-attribution names (the C.1 whitelist). Gate 11a. */
const DEFAULT_CREATOR_NAMES: readonly string[] = [
  "PokeRev", "Pirate King", "ninetalescorner", "PokeChuck", "PikaPikaPapa", "PokeBeard",
];

/**
 * Run every gate against a generated draft. Returns the full failure list so
 * the retry prompt can ask Claude to fix everything at once instead of
 * playing whack-a-mole one gate at a time.
 */
export function runQualityGates(
  draft: GeneratedDraft,
  urlPath: string,
  siteUrl = "https://foil-rosy.vercel.app",
  ctx: QualityGateContext = {},
): GateResult {
  const failures: string[] = [];
  const body = draft.body ?? "";
  const faqBody = (draft.faq ?? [])
    .map((q) => `${q.question}\n${q.answer}`)
    .join("\n\n");

  // Gate (a): word count
  const words = countWords(body);
  if (words < GATE_LIMITS.wordCountMin) {
    failures.push(
      `Body is too short: ${words} words. Minimum is ${GATE_LIMITS.wordCountMin}. Expand at least two H2 sections with concrete examples.`,
    );
  } else if (words > GATE_LIMITS.wordCountMax) {
    failures.push(
      `Body is too long: ${words} words. Maximum is ${GATE_LIMITS.wordCountMax}. Trim filler — keep only paragraphs with specific data or evidence.`,
    );
  }

  // Gate (currency): at least one current-year (2025/2026) reference so the
  // post reads as fresh. The deal-finder dollar-figure-count gate (b) and the
  // Foil-scan-data citation gate (d) were retired with the vending reframe
  // (ADR-062) — neither maps to a host-acquisition post. This gate is relaxed
  // from 2 → 1 (GATE_LIMITS.recentYearMentionsMin).
  const recent = recentDateMatches(body);
  if (recent.length < GATE_LIMITS.recentYearMentionsMin) {
    failures.push(
      `No recent-year reference found (2025/2026). Anchor at least one statement to the current year so the post reads as current.`,
    );
  }

  // Gate (e): banned phrases (AI tells)
  const banned = bannedPhraseMatches(body);
  if (banned.length > 0) {
    failures.push(
      `Banned phrases detected: ${banned.map((p) => `"${p}"`).join(", ")}. Rewrite those sentences without the phrase.`,
    );
  }

  // Gate (f): schema validates
  const schemaErr = validateSchema(draft, urlPath, siteUrl);
  if (schemaErr) failures.push(schemaErr);

  // Gate (g): FAQ section length
  const faqWords = countWords(faqBody);
  if (faqWords < GATE_LIMITS.faqWordCountMin) {
    failures.push(
      `FAQ section is too short: ${faqWords} words. Minimum is ${GATE_LIMITS.faqWordCountMin}. Expand each FAQ answer to 2-4 substantive sentences.`,
    );
  }

  // Gate (h): internal links
  const internalLinks = countInternalLinks(body);
  if (internalLinks < GATE_LIMITS.internalLinksMin) {
    failures.push(
      `Only ${internalLinks} internal links found. Minimum is ${GATE_LIMITS.internalLinksMin}. Add <TopicLink href="/pillar-path"> or [anchor](/path) references to existing Foil pages.`,
    );
  }

  // Gate 9 (link existence): every internal link must resolve to a real post
  // or route. The count gate (h) above checks quantity; this checks targets —
  // a well-formed href to a non-existent /blog/ post or /cards/ slug is a live
  // 404 the structural gates never caught (Session 47.4 — three such links
  // shipped). Runs only when the orchestrator supplies the resolver.
  if (ctx.internalLinkExists) {
    const dead = deadInternalLinks(`${body}\n${faqBody}`, ctx.internalLinkExists);
    if (dead.length > 0) {
      failures.push(
        `Dead internal link(s): ${dead.join(", ")}. Every /blog/, /cards/, or pillar link must resolve to an existing post or route — repoint to a real page or remove the link.`,
      );
    }
  }

  // Gate 10 (Foil-data provenance) was retired with the vending reframe
  // (ADR-062): there is no Foil scan/waitlist snapshot behind a host post, so
  // there is nothing to verify a fabricated stat against. The honesty bar for
  // vending copy is enforced instead by Gate V-honesty (below) + Gate 13.

  // Gate 11 (creator attribution discipline, ADR-050). Two checks:
  //  11a — a collective "creators are saying" phrase with no named creator
  //        within 50 chars is an unattributed claim (always runs).
  //  11b — any run of >25 consecutive words copied verbatim from an ingested
  //        transcript is plagiarism, not synthesis (runs only when the corpus
  //        is supplied; transcripts are gitignored so it's absent in unit runs).
  const unattributed = unattributedCreatorClaims(`${body}\n${faqBody}`, ctx.creatorNames);
  if (unattributed.length > 0) {
    failures.push(
      `Unattributed creator claim(s): ${unattributed.map((p) => `"${p}"`).join(", ")}. Name a specific whitelisted creator within the sentence (e.g. "PokeBeard noted…") or remove the collective attribution. (ADR-050 / Gate 11a)`,
    );
  }
  if (ctx.transcriptCorpus) {
    const copied = verbatimTranscriptRun(`${body}\n${faqBody}`, ctx.transcriptCorpus);
    if (copied) {
      failures.push(
        `Verbatim transcript copy detected (>25 consecutive words): "${copied.slice(0, 80)}". Synthesize the idea in Foil's voice and attribute by name, never reproduce a creator's words. (ADR-050 / Gate 11b)`,
      );
    }
  }

  // Gate 12 (em dashes — HARD, ADR-051). BRAND-VOICE.md rule 7 bans em dashes
  // (—); en dashes (–) in numeric ranges stay legal. This is the one voiceCheck
  // detector wired as a hard gate: it's unambiguous (a literal char) with zero
  // false positives, so it can reject the draft. The vague-number-hedge
  // detector stays SOFT (NOT gated) — it false-positives on sourced citations
  // like "approximately $2,100 (PokeTrace n=363)", so blocking on it would
  // reject legitimate copy. (The C.1 pilot draft shipped 22 em dashes because
  // nothing gated them; this closes that gap. ROADMAP #34.) Scans EVERY field
  // the model writes — body, FAQ, AND the frontmatter title + description — not
  // just the body: post 66da22d shipped an em dash in `description` (which
  // renders in <meta>/OG/the blog-index card) because the gate only scanned
  // body+faq. Audit all writable fields, not the obvious one (PATTERNS I-008).
  const emDashScan = `${draft.frontmatter?.title ?? ""}\n${draft.frontmatter?.description ?? ""}\n${body}\n${faqBody}`;
  const emDashes = (emDashScan.match(/—/g) || []).length;
  if (emDashes > 0) {
    failures.push(
      `${emDashes} em dash(es) found (scanning title + description + body + FAQ). BRAND-VOICE.md bans the em dash character; recast each with a comma, colon, semicolon, period, or parentheses. (En dashes in numeric ranges like $95-$110 are fine.) (Gate 12)`,
    );
  }

  // Gate 13 (anti-hype — HARD on hype terms + emojis, ADR-053). Same field scan
  // as Gate 12 (title + description + body + faq). Defensibility, not polish:
  // the buy signal only works if Foil never sounds like a pump. SOFT warnings
  // (unquantified superlatives) are surfaced by antiHypeCheck for linting but
  // do NOT block (same soft treatment as the vague-number hedge).
  const hype = antiHypeCheck(emDashScan);
  if (hype.hard.length > 0) {
    failures.push(
      `Hype/forbidden term(s): ${hype.hard.map((h) => `"${h}"`).join(", ")}. BRAND-VOICE.md bans hype + emojis on user-visible copy; state the numbers and let the reader decide. (Gate 13)`,
    );
  }

  // Gate V-benefit (ADR-062): the post must address the host's value
  // proposition, not generic Pokémon-collecting talk. Replaces the retired
  // dollar-figure-count gate with the audience-correct signal.
  const benefits = hostBenefitSignals(`${body}\n${faqBody}`);
  if (benefits.length < GATE_LIMITS.hostBenefitSignalsMin) {
    failures.push(
      `Only ${benefits.length} host-benefit signal(s) (need ${GATE_LIMITS.hostBenefitSignalsMin}). Speak to the owner's value prop: revenue share, hands-off operation, foot traffic, no cost, risk-free trial, we-handle-everything. (Gate V-benefit)`,
    );
  }

  // Gate V-geo (ADR-062): at least one explicit Bay-Area place. Local relevance
  // is the SEO bet for a service-area business (doc 04).
  const geo = localGeoReferences(`${body}\n${faqBody}`);
  if (geo.length === 0) {
    failures.push(
      `No Bay-Area location reference found. Reference the Bay Area or a served city (e.g. Napa, Fairfield, Walnut Creek, Concord) so the post earns local relevance. (Gate V-geo)`,
    );
  }

  // Gate V-link (ADR-062): at least one internal link points at a conversion
  // page (/host, /faq, or a /service-areas/[city] page). Replaces the deal-
  // finder card-citation expectation with the vending funnel target.
  if (!hasConversionInternalLink(`${body}\n${faqBody}`)) {
    failures.push(
      `No conversion link found. At least one internal link must point to /host, /faq, or a /service-areas/[city] page so the post funnels toward hosting. (Gate V-link)`,
    );
  }

  // Gate V-honesty (HARD, ADR-062): the site's binding guardrails on generated
  // copy — no insurance/liability claim, no published revenue-share %. (Earnings-
  // guarantee hype like "guaranteed"/"easy money" is already a Gate-13 term.)
  const honesty = vendingHonestyViolations(emDashScan);
  if (honesty.length > 0) {
    failures.push(
      `Honesty-guardrail violation(s): ${honesty.join("; ")}. No insurance/liability claim and no published revenue-share % belong on the page; route those to a call. (Gate V-honesty)`,
    );
  }

  return { passed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Vending gate helpers (ADR-062). Pure + exported for the gate tests.
// ---------------------------------------------------------------------------

/** Gate V-benefit: distinct host-value-prop signals present in the text. */
export function hostBenefitSignals(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const s of HOST_BENEFIT_SIGNALS) {
    if (lower.includes(s) && !hits.includes(s)) hits.push(s);
  }
  return hits;
}

/** Gate V-geo: distinct Bay-Area place references present in the text. */
export function localGeoReferences(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const g of BAY_AREA_GEO_TERMS) {
    if (lower.includes(g) && !hits.includes(g)) hits.push(g);
  }
  return hits;
}

/** Normalize an href down to its root-relative path (drops scheme+host, hash,
 *  query, trailing slash). Used by Gate V-link. */
function hrefPath(href: string): string {
  let p = href;
  for (const host of INTERNAL_LINK_HOSTS) {
    const i = p.indexOf(host);
    if (i >= 0) p = p.slice(i + host.length);
  }
  p = p.split("#")[0].split("?")[0].replace(/\/+$/, "");
  return p || "/";
}

/** Gate V-link: true if any internal link resolves to a conversion page. */
export function hasConversionInternalLink(body: string): boolean {
  const hrefs: string[] = [];
  for (const m of body.matchAll(/\]\(([^)]+)\)/g)) hrefs.push(m[1]);
  for (const m of body.matchAll(/href=["']([^"']+)["']/g)) hrefs.push(m[1]);
  return hrefs.some((href) => {
    if (!isInternalHref(href)) return false;
    const p = hrefPath(href);
    return CONVERSION_LINK_PATHS.some((c) => p === c || p.startsWith(`${c}/`));
  });
}

/** Gate V-honesty (HARD): insurance/liability claims + published revenue-share
 *  percentages. Returns a human-readable list of violations (empty = clean). */
export function vendingHonestyViolations(text: string): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  // Insurance / liability claims (an off-site call topic, never a webpage claim).
  const insurancePhrases = [
    "fully insured",
    "fully covered",
    "is insured",
    "are insured",
    "we're insured",
    "we are insured",
    "damage is covered",
    "theft is covered",
    "liability is covered",
    "not liable",
    "no liability",
  ];
  for (const p of insurancePhrases) {
    const v = `insurance/liability claim "${p}"`;
    if (lower.includes(p) && !violations.includes(v)) violations.push(v);
  }

  // Published revenue-share percentage: a % within ~40 chars of a rev-share term.
  const revShareTerms = [
    "revenue share",
    "rev share",
    "revenue split",
    "your cut",
    "your share",
    "share of the",
  ];
  for (const term of revShareTerms) {
    let i = lower.indexOf(term);
    while (i !== -1) {
      const window = lower.slice(
        Math.max(0, i - 40),
        Math.min(lower.length, i + term.length + 40),
      );
      const pct = window.match(/\d+(?:\.\d+)?\s*%/);
      if (pct) {
        const v = `published revenue-share % "${pct[0].trim()}" near "${term}"`;
        if (!violations.includes(v)) violations.push(v);
      }
      i = lower.indexOf(term, i + 1);
    }
  }
  return violations;
}

/**
 * Gate 11a: collective creator-provenance phrases used without a named creator
 * within 50 chars. Returns the offending phrases. Exported for tests.
 */
export function unattributedCreatorClaims(text: string, creatorNames?: string[]): string[] {
  const lower = text.toLowerCase();
  const names = (creatorNames ?? DEFAULT_CREATOR_NAMES).map((n) => n.toLowerCase());
  const hits: string[] = [];
  for (const phrase of CREATOR_PROVENANCE_PHRASES) {
    let i = lower.indexOf(phrase);
    while (i !== -1) {
      const windowStart = Math.max(0, i - 50);
      const windowEnd = Math.min(lower.length, i + phrase.length + 50);
      const window = lower.slice(windowStart, windowEnd);
      const attributed = names.some((n) => window.includes(n));
      if (!attributed && !hits.includes(phrase)) hits.push(phrase);
      i = lower.indexOf(phrase, i + 1);
    }
  }
  return hits;
}

// Gate 13 (anti-hype, ADR-053). HARD-banned hype phrases — matched on a leading
// word boundary so e.g. "steal" doesn't fire inside "steally" and (crucially)
// bare "moon" is NOT here: it would false-match "Moonbreon" (Umbreon VMAX, one
// of the most-cited cards). The hype sense of moon is covered by "to the moon" /
// "moonshot" / "mooning".
export const HYPE_HARD_TERMS: readonly string[] = [
  "steal",
  "must-buy",
  "must buy",
  "guaranteed",
  "easy money",
  "to the moon",
  "moonshot",
  "mooning",
  "amazing deal",
  "no-brainer",
  "no brainer",
] as const;

// SOFT: superlatives with no number nearby (analytical voice prefers a figure).
const HYPE_SOFT_TERMS: readonly string[] = ["huge", "massive", "tons"];

/**
 * Gate 13 core. Returns HARD violations (banned hype terms + any emoji — no
 * emojis on user-visible copy, ADR-053) and SOFT warnings (unquantified
 * superlatives). HARD blocks; SOFT is lint-only. Exported for the copy-gate
 * test that scans the badge strings + the methodology page.
 */
export function antiHypeCheck(text: string): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  for (const term of HYPE_HARD_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    if (re.test(text) && !hard.includes(term)) hard.push(term);
  }
  // Any emoji is a HARD violation (no emojis on buy-signal surfaces).
  const emoji = text.match(/\p{Extended_Pictographic}/u);
  if (emoji) hard.push(`emoji ${emoji[0]}`);

  const soft: string[] = [];
  for (const term of HYPE_SOFT_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, "i");
    const m = re.exec(text);
    if (!m) continue;
    // soft-warn only if there's no digit within ~25 chars of the superlative.
    const window = text.slice(Math.max(0, m.index - 25), m.index + term.length + 25);
    if (!/\d/.test(window) && !soft.includes(term)) soft.push(term);
  }
  return { hard, soft };
}

/** Lowercased word tokens (letters/digits/$/%), for n-gram comparison. */
function wordTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9$%.,'-]+/g) ?? []).map((w) => w.replace(/^[.,']+|[.,']+$/g, "")).filter(Boolean);
}

/**
 * Gate 11b: the first run of >25 (i.e. >=26) consecutive draft words that
 * appears verbatim in the transcript corpus, or null. Exported for tests.
 */
export function verbatimTranscriptRun(draft: string, corpus: string, n = 26): string | null {
  const corpusWords = wordTokens(corpus);
  if (corpusWords.length < n) return null;
  const corpusGrams = new Set<string>();
  for (let i = 0; i + n <= corpusWords.length; i++) {
    corpusGrams.add(corpusWords.slice(i, i + n).join(" "));
  }
  const draftWords = wordTokens(draft);
  for (let i = 0; i + n <= draftWords.length; i++) {
    const gram = draftWords.slice(i, i + n).join(" ");
    if (corpusGrams.has(gram)) return gram;
  }
  return null;
}

/**
 * Internal links in `body` that DON'T resolve via `exists`. Dedupes; only
 * considers root-relative + foil-host hrefs (external links aren't ours to
 * validate). Gate 9 helper — exported for tests.
 */
export function deadInternalLinks(body: string, exists: (href: string) => boolean): string[] {
  const seen = new Set<string>();
  const dead: string[] = [];
  const consider = (href: string) => {
    if (!isInternalHref(href) || seen.has(href)) return;
    seen.add(href);
    if (!exists(href)) dead.push(href);
  };
  for (const m of body.matchAll(/\]\(([^)]+)\)/g)) consider(m[1]);
  for (const m of body.matchAll(/href=["']([^"']+)["']/g)) consider(m[1]);
  return dead;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Recent date citations. "Recent" = within 6 months of today, but we don't
 * compute against real-world clock — instead we match any "2025" or "2026"
 * mention, which is the proxy the goal spec described. Excludes occurrences
 * inside URLs (the canonical localhost:3000 etc).
 */
export function recentDateMatches(text: string): string[] {
  // Strip URLs so e.g. "vercel.app/2025-archive" doesn't count
  const stripped = text.replace(/https?:\/\/[^\s)]+/g, " ");
  return stripped.match(/\b20(?:25|26)\b/g) ?? [];
}

export function bannedPhraseMatches(text: string): string[] {
  // Word-boundary match at the START of the phrase so a banned phrase doesn't
  // false-match a longer word: "as a collector" must not fire on "has a
  // collector number". Trailing is left open so stemmed forms still match
  // ("delve" catches "delved"/"delving"). Leading \b only — that's the fix.
  return BANNED_PHRASES.filter((p) => {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    return re.test(text);
  });
}

/**
 * Internal links: any markdown [..](/path) or MDX href="/path" where path is
 * root-relative (starts with /), OR an explicit foiltcg.com / foil-rosy URL.
 * Self-references (the post's own URL) and anchor-only links (#section) don't
 * count.
 */
export function countInternalLinks(body: string): number {
  const seen = new Set<string>();

  // Markdown links: [text](/path) or [text](https://foiltcg.com/path)
  for (const m of body.matchAll(/\]\(([^)]+)\)/g)) {
    if (isInternalHref(m[1])) seen.add(m[1]);
  }
  // MDX/HTML hrefs: href="..." or href='...'
  for (const m of body.matchAll(/href=["']([^"']+)["']/g)) {
    if (isInternalHref(m[1])) seen.add(m[1]);
  }

  return seen.size;
}

function isInternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  for (const host of INTERNAL_LINK_HOSTS) {
    if (href.includes(host)) return true;
  }
  return false;
}

/**
 * Validate the JSON-LD schema we'd emit for this draft. Specifically: build
 * the @graph that the page route would render, JSON.stringify it, and
 * confirm the required Article fields are populated. Empty headline,
 * description, or date is a fail.
 */
function validateSchema(
  draft: GeneratedDraft,
  urlPath: string,
  siteUrl: string,
): string | null {
  const article = articleSchema({
    frontmatter: {
      title: draft.frontmatter.title,
      description: draft.frontmatter.description,
      date: draft.frontmatter.date,
      tags: draft.frontmatter.tags,
    },
    urlPath,
    siteUrl,
  });

  for (const field of ["headline", "description", "datePublished"] as const) {
    const v = (article as Record<string, unknown>)[field];
    if (typeof v !== "string" || v.trim().length === 0) {
      return `Article JSON-LD missing required field "${field}".`;
    }
  }

  const faq = draft.faq?.length ? faqPageSchema(draft.faq) : null;
  if (faq && (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0)) {
    return `FAQPage JSON-LD has empty mainEntity array.`;
  }

  // Make sure we can serialize without throwing — proxy for "JSON-LD-valid".
  try {
    JSON.stringify(schemaGraph(article, faq));
  } catch (err) {
    return `JSON-LD serialization failed: ${(err as Error).message}`;
  }

  return null;
}
