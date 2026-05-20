// Competitive-gap analysis. Pulls a competitor URL (or HTML string in tests),
// extracts the heading outline, then diffs against Foil's own topic surface to
// surface gaps — topics the competitor ranks for that Foil doesn't yet cover.
//
// Scope intentionally narrow: this is an inputs module for the weekly content
// engine, not a full SEO crawler. We only look at H1/H2/H3 because that's
// where competitor content topology lives. Body text is too noisy to compare
// without an embedding model, which is a separate purchase decision.

export type CompetitorPage = {
  url: string;
  title: string;
  /** All H1/H2/H3 text content, in document order. */
  headings: { level: 1 | 2 | 3; text: string }[];
};

export type TopicGap = {
  topic: string;
  /** Which competitor page surfaced this gap. */
  source: string;
  /** Normalized form of the topic — used for dedup against Foil's coverage. */
  normalized: string;
};

const HEADING_RE = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const TAG_STRIP_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

/**
 * Parse HTML into a CompetitorPage. Uses regex rather than a real DOM parser
 * because the inputs are small marketing pages and bringing in a full DOM
 * (jsdom, cheerio) costs ~5MB of node_modules for one feature.
 */
export function extractCompetitorPage(url: string, html: string): CompetitorPage {
  const title = (html.match(TITLE_RE)?.[1] ?? "").replace(TAG_STRIP_RE, "").trim();
  const headings: CompetitorPage["headings"] = [];

  let match: RegExpExecArray | null;
  const re = new RegExp(HEADING_RE);
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]) as 1 | 2 | 3;
    const text = match[2].replace(TAG_STRIP_RE, "").replace(WHITESPACE_RE, " ").trim();
    if (text.length > 0) headings.push({ level, text });
  }

  return { url, title, headings };
}

/**
 * Default fetcher — separate so tests can inject an offline HTML string. The
 * 12-second timeout exists because competitor sites sometimes hang and we
 * don't want one slow URL to block the whole weekly run.
 */
export async function fetchHtml(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        // Be a polite bot — identify ourselves, don't fake a Chrome UA.
        "User-Agent": "FoilContentBot/0.1 (+https://foil-rosy.vercel.app)",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * scrapeCompetitorContent — the public-facing API the goal spec named. Wraps
 * fetch + extract. Caller injects a custom fetcher for testing.
 */
export async function scrapeCompetitorContent(
  url: string,
  fetcher: (u: string) => Promise<string> = fetchHtml,
): Promise<CompetitorPage> {
  const html = await fetcher(url);
  return extractCompetitorPage(url, html);
}

/**
 * Diff competitor headings against our own coverage. A "gap" is a competitor
 * H2/H3 whose normalized form doesn't overlap with any topic in `ownTopics`.
 */
export function findTopicGaps(
  competitorPages: readonly CompetitorPage[],
  ownTopics: readonly string[],
): TopicGap[] {
  const ownNormalized = new Set(ownTopics.map(normalizeTopic));
  const seen = new Set<string>();
  const gaps: TopicGap[] = [];

  for (const page of competitorPages) {
    for (const heading of page.headings) {
      // Only H2/H3 carry useful topic signal — H1 is usually the page title.
      if (heading.level === 1) continue;
      const normalized = normalizeTopic(heading.text);
      if (normalized.length < 8) continue; // skip "Pricing", "FAQ", etc.
      if (ownNormalized.has(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      gaps.push({ topic: heading.text, source: page.url, normalized });
    }
  }

  return gaps;
}

/**
 * Normalize: lowercase, strip non-alphanumeric, collapse whitespace, drop
 * filler words. Conservative — we'd rather miss a partial-overlap gap than
 * spam John with duplicates.
 */
export function normalizeTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(a|an|the|of|to|for|in|on|and|or|how|what|why|when|with|your)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Render the gap report John gets in his inbox/console. Sorted by competitor
 * page so adjacent gaps cluster sensibly.
 */
export function renderGapReport(
  gaps: readonly TopicGap[],
  ownTopics: readonly string[],
): string {
  const lines: string[] = [];
  lines.push("# Competitive topic gaps");
  lines.push("");
  lines.push(`_Generated against ${ownTopics.length} known Foil topics._`);
  lines.push("");

  if (gaps.length === 0) {
    lines.push("No new gaps found — Foil's topic surface covers everything the scraped competitors are publishing right now.");
    return lines.join("\n");
  }

  const bySource = new Map<string, TopicGap[]>();
  for (const g of gaps) {
    const arr = bySource.get(g.source) ?? [];
    arr.push(g);
    bySource.set(g.source, arr);
  }

  for (const [url, items] of bySource) {
    lines.push(`## ${url}`);
    lines.push("");
    for (const g of items) {
      lines.push(`- ${g.topic}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
