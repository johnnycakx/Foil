// PokeTrace daily price history (Session 49c / ADR-044).
//
// Endpoint (verified empirically 2026-05-30):
//   GET /v1/cards/{uuid}/prices/{tier}/history?period={period}&limit={n}
//   → { data: [{ date, source, avg, low, high, saleCount, approxSaleCount,
//                median3d, median7d, median30d }], pagination: {...} }
// Rows are newest→oldest; periods are 7d / 30d / 90d / 1y / all. This is the
// real daily series that powers the sold-history chart — distinct from the
// windowed aggregates on the card object (by-uuid.ts), which drive the
// headline. PokeTrace recommends median7d for the chart line (smoother /
// anomaly-filtered); avg is the raw daily signal and the fallback when
// median7d is absent.
//
// CORRECTION (ADR-044): an earlier Session-49c probe wrongly concluded no
// daily history existed — it tested /cards/{id}/history and /prices/history
// but NOT the tier-scoped /prices/{tier}/history path above. The endpoint
// works on our Scale-tier key. Don't repeat that probe error.
//
// Soft-fail: any missing key / 404 (e.g. a tier with no graded sales) / plan
// error / parse failure resolves to null so the chart degrades to a
// "Price history accumulating" placeholder instead of throwing.

import { conditionToTier } from "../cards/conditions.ts";

const BASE_URL = "https://api.poketrace.com/v1";
const TTL_MS = 60 * 60 * 1000; // 1h
const DEFAULT_LIMIT = 365;

/** UI range → PokeTrace `period` query value. */
export const PERIOD_FOR_RANGE: Record<string, string> = {
  "7D": "7d",
  "1M": "30d",
  "3M": "90d",
  "1Y": "1y",
  MAX: "all",
};

/** One real daily point for the chart. */
export type PriceHistoryRow = {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Raw daily average price. */
  avg: number;
  /** 7-day rolling median (PokeTrace's recommended line; may be null). */
  median7d: number | null;
  low: number | null;
  high: number | null;
  saleCount: number | null;
  /** "ebay" | "tcgplayer" | "cardmarket" — which marketplace this row is from. */
  source: string;
};

export type GetPriceHistoryInput = {
  uuid: string | null | undefined;
  /** PokeTrace tier key (NEAR_MINT, PSA_10, BGS_9_5, …). */
  tier: string;
  /** PokeTrace period: 7d / 30d / 90d / 1y / all. Defaults to all. */
  period?: string;
  limit?: number;
  /** Test injection. */
  fetchImpl?: typeof fetch;
};

/** Resolve a Foil condition token to the single tier whose daily history the
 *  chart should plot. Specific condition → its tier; any-graded → caller's
 *  preferred graded tier (passed in, since "present graded tier" depends on the
 *  card); any-raw / unknown → NEAR_MINT (the dominant raw tier). */
export function chartTierForCondition(condition: string | null | undefined, preferredGraded: string | null): string | null {
  const res = conditionToTier(condition);
  if (res.kind === "tier") return res.tier;
  if (res.kind === "graded-agg") return preferredGraded;
  return "NEAR_MINT";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type RawRow = Record<string, unknown>;

/** Pure: parse the API `data[]` into chart rows — dedup same-date rows
 *  (prefer eBay, Foil's buyer-side primary signal), sort oldest→newest, drop
 *  rows without a usable average. Exported for tests. */
export function parsePriceHistory(data: unknown): PriceHistoryRow[] {
  if (!Array.isArray(data)) return [];
  const byDate = new Map<string, PriceHistoryRow>();
  for (const r of data as RawRow[]) {
    if (!r || typeof r !== "object") continue;
    const date = typeof r.date === "string" ? r.date : null;
    const avg = num(r.avg);
    if (!date || avg == null) continue;
    const source = typeof r.source === "string" ? r.source : "unknown";
    const row: PriceHistoryRow = {
      date,
      avg,
      median7d: num(r.median7d),
      low: num(r.low),
      high: num(r.high),
      saleCount: num(r.saleCount),
      source,
    };
    const existing = byDate.get(date);
    // Prefer eBay when a date has rows from multiple sources.
    if (!existing || (existing.source !== "ebay" && source === "ebay")) {
      byDate.set(date, row);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type CacheEntry = { data: PriceHistoryRow[]; ts: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PriceHistoryRow[] | null>>();

function cacheKey(uuid: string, tier: string, period: string): string {
  return `${uuid}:${tier}:${period}`;
}

async function fetchAndParse(
  key: string,
  uuid: string,
  tier: string,
  period: string,
  limit: number,
  fetchImpl: typeof fetch,
): Promise<PriceHistoryRow[] | null> {
  const apiKey = process.env.POKETRACE_API_KEY;
  if (!apiKey) return null;
  const url =
    `${BASE_URL}/cards/${encodeURIComponent(uuid)}/prices/${encodeURIComponent(tier)}/history` +
    `?period=${encodeURIComponent(period)}&limit=${limit}`;
  try {
    const res = await fetchImpl(url, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
    if (!res.ok) return null; // 404 (no data for tier) / 402 (plan) / 5xx → soft-fail
    const json = (await res.json()) as { data?: unknown } | unknown;
    const data = json && typeof json === "object" && "data" in json ? (json as { data: unknown }).data : json;
    const rows = parsePriceHistory(data);
    cache.set(key, { data: rows, ts: Date.now() });
    return rows;
  } catch {
    return null;
  }
}

/**
 * Daily price history for a UUID + tier, stale-while-revalidate (1h TTL).
 * Returns null on first-fetch failure (missing key / 404 / plan / parse) so the
 * chart shows its "accumulating" placeholder; serves the last cached value
 * while a background refresh runs once stale.
 */
export async function getPriceHistory(input: GetPriceHistoryInput): Promise<PriceHistoryRow[] | null> {
  const { uuid, tier } = input;
  if (!uuid || !tier) return null;
  const period = input.period ?? "all";
  const limit = input.limit ?? DEFAULT_LIMIT;
  const fetchImpl = input.fetchImpl ?? fetch;
  const key = cacheKey(uuid, tier, period);

  const entry = cache.get(key);
  const now = Date.now();
  if (entry && now - entry.ts < TTL_MS) return entry.data; // fresh

  if (entry) {
    // Stale: serve stale, revalidate in the background (deduped).
    if (!inflight.has(key)) {
      const p = fetchAndParse(key, uuid, tier, period, limit, fetchImpl).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return entry.data;
  }

  // Cold: await (dedup concurrent callers).
  let p = inflight.get(key);
  if (!p) {
    p = fetchAndParse(key, uuid, tier, period, limit, fetchImpl).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Test helper — clear the in-process cache. */
export function __clearPriceHistoryCache(): void {
  cache.clear();
  inflight.clear();
}
