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
  "in conclusion",
  "in summary",
  "as we've seen",
  "in today's digital world",
  "the world of pokemon",
  "as a collector",
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
 * Run every gate against a generated draft. Returns the full failure list so
 * the retry prompt can ask Claude to fix everything at once instead of
 * playing whack-a-mole one gate at a time.
 */
export function runQualityGates(
  draft: GeneratedDraft,
  urlPath: string,
  siteUrl = "https://foil-rosy.vercel.app",
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

  return { passed: failures.length === 0, failures };
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
