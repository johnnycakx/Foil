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
  dollarFiguresMin: 5,
  recentDateCitationsMin: 2,
  foilDataCitationsMin: 1,
  faqWordCountMin: 200,
  internalLinksMin: 2,
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

export const FOIL_DATA_CITATION_TRIGGERS: readonly string[] = [
  "Foil's scan data",
  "Foil's data",
  "across our scans",
  "cards processed",
  "scanned by Foil",
  "Foil scanned",
  "Foil identifies",
  "Foil's identification",
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
   *  Built by the orchestrator from the blog-post dir + CARD_CATALOG + the
   *  known-route allowlist. When omitted, gate 9 is skipped. */
  internalLinkExists?: (href: string) => boolean;
  /** Gate 10: the verbatim numeric strings the Foil-data snapshot actually
   *  contains (counts, days, waitlist total, source %s). A number in a
   *  "Foil's scan data" sentence must be in this set. Pass `null` to run the
   *  gate with NO snapshot (any such number is then a fabrication). Omit
   *  (`undefined`) to skip the gate entirely. */
  foilDataAllowedValues?: Set<string> | null;
};

/** Sentence triggers that assert a Foil-proprietary data claim (gate 10). */
export const PROVENANCE_TRIGGERS: readonly string[] = [
  "foil's scan data",
  "foil's data",
  "our pipeline",
  "users on foil",
  "across our scans",
  "our scan data",
  "foil scanned",
  "cards processed",
] as const;

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

  // Gate (b): dollar figures
  const dollarFigures = uniqueDollarFigures(body);
  if (dollarFigures.size < GATE_LIMITS.dollarFiguresMin) {
    failures.push(
      `Only ${dollarFigures.size} unique dollar figures cited. Minimum is ${GATE_LIMITS.dollarFiguresMin}. Add specific prices — eBay sold averages, PSA 10 comps, grading fees, etc.`,
    );
  }

  // Gate (c): recent date citations (within the last 6 months of today)
  const recent = recentDateMatches(body);
  if (recent.length < GATE_LIMITS.recentDateCitationsMin) {
    failures.push(
      `Only ${recent.length} recent date citations (2025/2026 mentions). Minimum is ${GATE_LIMITS.recentDateCitationsMin}. Cite specific 2026 market activity, set releases, or pop reports.`,
    );
  }

  // Gate (d): Foil scan data citation
  const foilCitations = foilDataCitationCount(body);
  if (foilCitations < GATE_LIMITS.foilDataCitationsMin) {
    failures.push(
      `No Foil scan-data citation found. Add at least one statement referencing "Foil's scan data" or "across cards processed" — this is the Information Gain anchor that distinguishes Foil from generic SEO content.`,
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

  // Gate 10 (Foil-data provenance): any numeric claim (%, $, n=, ×, or
  // N-cards/days/collectors) inside a "Foil's scan data" / "our pipeline"
  // sentence must trace verbatim to a value the data snapshot actually returns
  // (lib/seo/data-injection.ts). This is the R-001 fabrication guard — it
  // would have caught the invented "~18% spread" and "2× grading rate" claims.
  if (ctx.foilDataAllowedValues !== undefined) {
    const offenders = checkFoilDataProvenance(body, ctx.foilDataAllowedValues);
    if (offenders.length > 0) {
      failures.push(
        `Unverifiable Foil-data claim(s): ${offenders.join(", ")}. A number in a "Foil's scan data"/"our pipeline" sentence must come from the actual data snapshot — drop the figure or move it out of the Foil-data citation.`,
      );
    }
  }

  return { passed: failures.length === 0, failures };
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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Numeric "stat" tokens in a sentence: percentages, dollars, n=, multipliers,
 *  and N-cards/days/scans/collectors. Excludes 4-digit years (2025/2026). */
function extractStatNumbers(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)%/g)) {
    out.push(`${m[1]}%`, m[1]);
  }
  for (const m of s.matchAll(/\$[\d,]+(?:\.\d+)?/g)) out.push(m[0]);
  for (const m of s.matchAll(/\bn\s*=\s*(\d[\d,]*)/gi)) out.push(m[1].replace(/,/g, ""));
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*[×x](?![a-z0-9])/gi)) out.push(m[1]);
  for (const m of s.matchAll(/\b(\d[\d,]*)\s+(?:cards?|days?|scans?|collectors?)\b/gi)) out.push(m[1]);
  return out.filter((n) => !/^20\d\d$/.test(n));
}

/**
 * Gate 10 core: numeric claims in Foil-data sentences that aren't backed by
 * the snapshot. `allowed === null` means "no snapshot this run" → any such
 * number is a fabrication. Exported for tests.
 */
export function checkFoilDataProvenance(body: string, allowed: Set<string> | null): string[] {
  const offenders = new Set<string>();
  for (const sentence of splitSentences(body)) {
    const low = sentence.toLowerCase();
    if (!PROVENANCE_TRIGGERS.some((t) => low.includes(t))) continue;
    for (const n of extractStatNumbers(sentence)) {
      const ok = allowed != null && (allowed.has(n) || allowed.has(n.replace(/,/g, "")));
      if (!ok) offenders.add(`"${n}"`);
    }
  }
  return [...offenders];
}

/**
 * Build the gate-10 allow-set from a data snapshot (structural shape so this
 * module doesn't depend on data-injection.ts). Includes raw + comma-formatted
 * forms of counts/totals and both "NN" and "NN%" for source percentages.
 */
export function buildFoilDataAllowedValues(snapshot: {
  totalScans: { count: number; days: number } | null;
  waitlistTotal: number | null;
  waitlistBySource: { pct: number }[] | null;
}): Set<string> {
  const out = new Set<string>();
  const add = (n: number) => {
    out.add(String(n));
    out.add(n.toLocaleString("en-US"));
  };
  if (snapshot.totalScans) {
    add(snapshot.totalScans.count);
    add(snapshot.totalScans.days);
  }
  if (snapshot.waitlistTotal != null) add(snapshot.waitlistTotal);
  for (const b of snapshot.waitlistBySource ?? []) {
    out.add(String(b.pct));
    out.add(`${b.pct}%`);
  }
  return out;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Match $1,234 or $45 or $30,000. Dedupe so "$30" five times doesn't pass. */
export function uniqueDollarFigures(text: string): Set<string> {
  const matches = text.match(/\$[\d,]+(?:\.\d+)?/g) ?? [];
  return new Set(matches);
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

export function foilDataCitationCount(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const trigger of FOIL_DATA_CITATION_TRIGGERS) {
    if (lower.includes(trigger.toLowerCase())) count++;
  }
  return count;
}

export function bannedPhraseMatches(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
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
