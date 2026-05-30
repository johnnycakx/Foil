// PokeTrace sold-history by UUID (ADR-042).
//
// getSoldHistory(uuid) fetches GET /v1/cards/{uuid} and returns a simplified
// SoldHistory: per source (ebay/tcgplayer) per tier (raw conditions + graded),
// the time-windowed sold averages (avg1d/avg7d/avg30d) + saleCount + low/high.
//
// Caching: in-process stale-while-revalidate, 1h TTL. Sold averages don't
// move minute-to-minute, so a 1h window is plenty fresh while sparing the
// PokeTrace quota across many concurrent /cards/[slug] renders. (Listings —
// which DO move — are served live via eBay Browse, not from here.)
//
// Soft-fail: any network / non-200 / parse error resolves to null (or the
// last cached value if we have one) so the render path degrades to the
// "data unavailable" footer instead of throwing.

const BASE_URL = "https://api.poketrace.com/v1";
const TTL_MS = 60 * 60 * 1000; // 1h

export type SoldStat = {
  avg: number | null;
  low: number | null;
  high: number | null;
  avg1d: number | null;
  avg7d: number | null;
  avg30d: number | null;
  saleCount: number | null;
};

// ebay/tcgplayer carry per-condition US sold tiers; cardmarket carries the
// EU "AGGREGATED" roll-up. Session 49.2: PokeTrace's catalog is
// market-partitioned — some cards (vintage / Classic Collection) are EU-only
// and surface only under `cardmarket`, so the read path must include it.
export type SoldSource = "ebay" | "tcgplayer" | "cardmarket";
const SOLD_SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];

export type SoldHistory = {
  uuid: string;
  /** ms epoch when these numbers were fetched. */
  fetchedAt: number;
  /** Per source → tier key (NEAR_MINT, LIGHTLY_PLAYED, PSA_10, …) → stat. */
  bySource: Partial<Record<SoldSource, Record<string, SoldStat>>>;
};

type RawSnap = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseSnap(snap: RawSnap): SoldStat {
  return {
    avg: num(snap.avg),
    low: num(snap.low),
    high: num(snap.high),
    avg1d: num(snap.avg1d),
    avg7d: num(snap.avg7d),
    avg30d: num(snap.avg30d),
    saleCount: num(snap.saleCount),
  };
}

/** Pure: build a SoldHistory from a PokeTrace card object. Exported for tests. */
export function parseSoldHistory(uuid: string, card: unknown): SoldHistory {
  const out: SoldHistory = { uuid, fetchedAt: Date.now(), bySource: {} };
  const prices = (card as { prices?: Record<string, Record<string, RawSnap>> } | null)?.prices;
  if (!prices || typeof prices !== "object") return out;
  for (const source of SOLD_SOURCES) {
    const tiers = prices[source];
    if (!tiers || typeof tiers !== "object") continue;
    const parsed: Record<string, SoldStat> = {};
    for (const [tier, snap] of Object.entries(tiers)) {
      if (snap && typeof snap === "object") parsed[tier] = parseSnap(snap as RawSnap);
    }
    if (Object.keys(parsed).length > 0) out.bySource[source] = parsed;
  }
  return out;
}

type CacheEntry = { data: SoldHistory; ts: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SoldHistory | null>>();

async function fetchAndParse(uuid: string, fetchImpl: typeof fetch): Promise<SoldHistory | null> {
  const key = process.env.POKETRACE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetchImpl(`${BASE_URL}/cards/${encodeURIComponent(uuid)}?market=US`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: unknown } | unknown;
    const card = json && typeof json === "object" && "data" in json ? (json as { data: unknown }).data : json;
    const parsed = parseSoldHistory(uuid, card);
    cache.set(uuid, { data: parsed, ts: Date.now() });
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sold history for a PokeTrace UUID, stale-while-revalidate (1h TTL).
 * Returns null on first-fetch failure; returns the last cached value while a
 * background refresh runs once the entry goes stale.
 */
export async function getSoldHistory(
  uuid: string | null | undefined,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<SoldHistory | null> {
  if (!uuid) return null;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const entry = cache.get(uuid);
  const now = Date.now();

  if (entry && now - entry.ts < TTL_MS) return entry.data; // fresh

  if (entry) {
    // Stale: serve stale immediately, revalidate in the background (dedup).
    if (!inflight.has(uuid)) {
      const p = fetchAndParse(uuid, fetchImpl).finally(() => inflight.delete(uuid));
      inflight.set(uuid, p);
    }
    return entry.data;
  }

  // Cold: await the fetch (dedup concurrent callers).
  let p = inflight.get(uuid);
  if (!p) {
    p = fetchAndParse(uuid, fetchImpl).finally(() => inflight.delete(uuid));
    inflight.set(uuid, p);
  }
  return p;
}

/** Test helper — clear the in-process cache. */
export function __clearSoldHistoryCache(): void {
  cache.clear();
  inflight.clear();
}

// NOTE: daily price history (the chart series) lives in lib/poketrace/
// price-history.ts — it hits the tier-scoped /prices/{tier}/history endpoint.
// This module stays the windowed-aggregate source that drives the headline.
