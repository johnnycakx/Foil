// SERP-context fetcher. Calls Brave Search for the top 10 ranking URLs on a
// query, then scrapes H2/H3 outlines for the top 3 results via cheerio. The
// engine passes this into Claude's prompt so generated drafts can reference
// specific competitor claims and beat them on currency or evidence.
//
// Failure modes are common (rate-limit, blocked scrape, slow site). Every
// failure degrades gracefully — we'd rather generate a post with no SERP
// context than fail the whole weekly run because a competitor's CDN
// returned 503.

import * as cheerio from "cheerio";

export const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export type SerpResult = {
  url: string;
  title: string;
  snippet: string;
};

export type ScrapedOutline = {
  url: string;
  title: string;
  headings: { level: 2 | 3; text: string }[];
};

export type SerpContext = {
  query: string;
  topResults: SerpResult[];
  topOutlines: ScrapedOutline[];
  /** True when Brave API was unreachable / unauthorized / rate-limited. */
  degraded: boolean;
  degradationReason?: string;
};

export type Fetcher = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export type Cache = {
  get(key: string): Promise<{ value: SerpContext; insertedAt: Date } | null>;
  set(key: string, value: SerpContext): Promise<void>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SCRAPE_TIMEOUT_MS = 8000;
const BRAVE_TIMEOUT_MS = 6000;

export type SerpFetchOptions = {
  /** Defaults to global fetch wrapped to throw timeout-aware errors. */
  fetcher?: Fetcher;
  /** Optional cache (Supabase-backed in prod; in-memory in tests). */
  cache?: Cache;
  /** Number of top URLs to fully scrape. Default 3. */
  scrapeTopN?: number;
  /** Number of SERP rows to keep. Default 10. */
  serpKeepN?: number;
};

/**
 * Public API: fetch full SERP context for a query. Always returns a usable
 * result — `degraded: true` flags partial/empty results so the caller can
 * skip the "beat top-3" prompt logic if needed.
 */
export async function fetchSerpContext(
  query: string,
  apiKey: string | undefined,
  opts: SerpFetchOptions = {},
): Promise<SerpContext> {
  const fetcher = opts.fetcher ?? (globalThis.fetch as Fetcher);
  const cache = opts.cache;
  const scrapeTopN = opts.scrapeTopN ?? 3;
  const serpKeepN = opts.serpKeepN ?? 10;

  const cacheKey = `serp:${query}`;
  if (cache) {
    const hit = await cache.get(cacheKey).catch(() => null);
    if (hit && Date.now() - hit.insertedAt.getTime() < CACHE_TTL_MS) {
      return hit.value;
    }
  }

  if (!apiKey) {
    const degraded: SerpContext = {
      query,
      topResults: [],
      topOutlines: [],
      degraded: true,
      degradationReason: "BRAVE_SEARCH_API_KEY not set",
    };
    return degraded;
  }

  let topResults: SerpResult[] = [];
  let degraded = false;
  let degradationReason: string | undefined;

  try {
    topResults = await callBraveSearch(query, apiKey, fetcher, serpKeepN);
  } catch (err) {
    degraded = true;
    degradationReason = `Brave Search failed: ${(err as Error).message}`;
    // Fall through with empty topResults — the engine prompt downgrades.
  }

  const topOutlines: ScrapedOutline[] = [];
  for (const result of topResults.slice(0, scrapeTopN)) {
    try {
      const outline = await scrapeOutline(result.url, fetcher);
      topOutlines.push(outline);
    } catch (err) {
      // Individual scrape failures don't downgrade the whole run — log and
      // continue. Most "robots block headless fetches" cases land here.
      degraded = true;
      degradationReason = degradationReason
        ? `${degradationReason}; scrape ${result.url} failed: ${(err as Error).message}`
        : `scrape ${result.url} failed: ${(err as Error).message}`;
    }
  }

  const context: SerpContext = {
    query,
    topResults,
    topOutlines,
    degraded,
    degradationReason,
  };

  if (cache && !degraded) {
    await cache.set(cacheKey, context).catch(() => {/* cache failure is non-fatal */});
  }

  return context;
}

async function callBraveSearch(
  query: string,
  apiKey: string,
  fetcher: Fetcher,
  count: number,
): Promise<SerpResult[]> {
  const url = `${BRAVE_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}&search_lang=en&country=US`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRAVE_TIMEOUT_MS);

  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    web?: { results?: Array<{ url?: string; title?: string; description?: string }> };
  };
  const rows = payload.web?.results ?? [];
  return rows
    .map((r) => ({
      url: typeof r.url === "string" ? r.url : "",
      title: typeof r.title === "string" ? r.title : "",
      snippet: typeof r.description === "string" ? r.description : "",
    }))
    .filter((r) => r.url.length > 0);
}

export async function scrapeOutline(url: string, fetcher: Fetcher): Promise<ScrapedOutline> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers: {
        "User-Agent": "FoilContentBot/0.2 (+https://foil-rosy.vercel.app)",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return extractOutlineFromHtml(url, html);
}

/**
 * Pure HTML → outline. Exposed for testing without a network round-trip.
 */
export function extractOutlineFromHtml(url: string, html: string): ScrapedOutline {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const headings: ScrapedOutline["headings"] = [];

  $("h2, h3").each((_, el) => {
    const level = (el as { tagName?: string }).tagName === "h3" ? 3 : 2;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      headings.push({ level: level as 2 | 3, text });
    }
  });

  return { url, title, headings };
}

/**
 * Render a SERP context block for inclusion in Claude's prompt. Compact, with
 * each top-3 result followed by its outline so Claude can see "what to beat."
 */
export function renderSerpContextPrompt(context: SerpContext): string {
  if (context.degraded && context.topResults.length === 0) {
    return `(SERP context unavailable: ${context.degradationReason ?? "unknown reason"} — write the post without competitor-relative claims.)`;
  }

  const lines: string[] = [];
  lines.push(`Top ${context.topResults.length} Google results for "${context.query}":`);
  context.topResults.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    lines.push(`   ${r.url}`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
  });

  if (context.topOutlines.length > 0) {
    lines.push("");
    lines.push("Top-3 outlines (what to beat):");
    for (const outline of context.topOutlines) {
      lines.push(`- ${outline.url}`);
      for (const h of outline.headings.slice(0, 12)) {
        lines.push(`  H${h.level}: ${h.text}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Trivial in-memory cache adapter — used in tests, and as a fallback when
 * no Supabase-backed cache is wired.
 */
export function memoryCache(): Cache {
  const store = new Map<string, { value: SerpContext; insertedAt: Date }>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, { value, insertedAt: new Date() });
    },
  };
}
