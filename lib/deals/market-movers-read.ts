// Market-movers read + ranking (ADR-069). Pure rank/filter + the cache read.
// The /deals board + the newsletter digest read the precomputed market_movers
// rows here — zero PokeTrace calls at page-view time (the daily cron at
// /api/cron/market-movers populates the cache).

import { supabaseAdmin } from "../supabase/admin.ts";

/** One mover row — all fields are PokeTrace-derived (non-eBay). `momentumPct`
 *  is negative for a "down" (good-buy) row. */
export type MoverRow = {
  cardSlug: string;
  cardName: string;
  setName: string;
  imageUrl: string;
  direction: "down" | "up" | "flat";
  momentumPct: number;
  avg7d: number | null;
  avg30d: number | null;
  saleCount: number;
  matchedTier: string;
  /** When WE cached this row (the freshness filter's clock). */
  computedAt: string;
  /** When the MARKET last traded it — the date the averages are true of.
   *  Null on rows written before the 2026-07-14 migration, or when upstream
   *  gave no timestamp. Null means "unknown age": disclose, never imply fresh. */
  soldAsOfIso: string | null;
};

export type MarketMovers = {
  /** Good-buy candidates: NM trading below its 30-day average, most-below first. */
  down: MoverRow[];
  /** Heating up: NM trading above its 30-day average, most-above first. */
  up: MoverRow[];
};

/** Only show movers computed within this window — guards against a card that
 *  dropped out of the data (kept a stale row) lingering on the board. 36h gives
 *  one full daily-cron cycle of slack. */
export const MOVER_FRESHNESS_MS = 36 * 60 * 60 * 1000;

type RawRow = {
  card_slug: string;
  card_name: string | null;
  set_name: string | null;
  image_url: string | null;
  direction: string;
  momentum_pct: number | null;
  avg7d: number | null;
  avg30d: number | null;
  sale_count: number | null;
  matched_tier: string | null;
  computed_at: string;
  sold_as_of?: string | null;
};

/** Map a DB row to a MoverRow. Exported for tests. */
export function toMoverRow(r: RawRow): MoverRow {
  return {
    cardSlug: r.card_slug,
    cardName: r.card_name ?? "",
    setName: r.set_name ?? "",
    imageUrl: r.image_url ?? "",
    direction: (r.direction as MoverRow["direction"]) ?? "flat",
    momentumPct: typeof r.momentum_pct === "number" ? r.momentum_pct : 0,
    avg7d: typeof r.avg7d === "number" ? r.avg7d : null,
    avg30d: typeof r.avg30d === "number" ? r.avg30d : null,
    saleCount: typeof r.sale_count === "number" ? r.sale_count : 0,
    matchedTier: r.matched_tier ?? "NEAR_MINT",
    computedAt: r.computed_at,
    soldAsOfIso: r.sold_as_of ?? null,
  };
}

/**
 * Pure: split fresh down/up movers and rank each. "down" most-negative first
 * (the deepest good-buy candidates); "up" most-positive first. `nowMs` is the
 * reference clock for the freshness filter (injectable for tests).
 */
export function rankMovers(rows: MoverRow[], limit = 12, nowMs: number = Date.now()): MarketMovers {
  const fresh = rows.filter((r) => {
    const t = Date.parse(r.computedAt);
    return Number.isFinite(t) && nowMs - t <= MOVER_FRESHNESS_MS;
  });
  const down = fresh
    .filter((r) => r.direction === "down")
    .sort((a, b) => a.momentumPct - b.momentumPct)
    .slice(0, limit);
  const up = fresh
    .filter((r) => r.direction === "up")
    .sort((a, b) => b.momentumPct - a.momentumPct)
    .slice(0, limit);
  return { down, up };
}

/**
 * Read ONE mover row by exact card slug (any direction, incl. flat), fresh
 * within MOVER_FRESHNESS_MS. Powers the receipts tool + reply desk (ADR-107),
 * which need the sold figures for a SPECIFIC resolved card rather than the
 * ranked top-N board. Soft-fails to null on any error or stale/missing row.
 * Touches NO eBay data — pure DB read of PokeTrace-derived metadata.
 */
export async function getMoverBySlug(slug: string, nowMs: number = Date.now()): Promise<MoverRow | null> {
  const s = (slug ?? "").trim();
  if (!s) return null;
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("market_movers")
      .select(
        "card_slug, card_name, set_name, image_url, direction, momentum_pct, avg7d, avg30d, sale_count, matched_tier, computed_at",
      )
      .eq("card_slug", s)
      .maybeSingle();
    if (error || !data) return null;
    const row = toMoverRow(data as RawRow);
    const t = Date.parse(row.computedAt);
    if (!Number.isFinite(t) || nowMs - t > MOVER_FRESHNESS_MS) return null; // stale → treat as absent
    return row;
  } catch {
    return null;
  }
}

/**
 * Read the down/up movers from the cache and rank them. Soft-fails to empty on
 * any Supabase error so /deals renders its calm empty state, never a 500.
 * Touches NO eBay data — pure DB read of PokeTrace-derived metadata.
 */
export async function getMarketMovers(limit = 12): Promise<MarketMovers> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("market_movers")
      .select(
        "card_slug, card_name, set_name, image_url, direction, momentum_pct, avg7d, avg30d, sale_count, matched_tier, computed_at",
      )
      .in("direction", ["down", "up"]);
    if (error || !data) return { down: [], up: [] };
    return rankMovers((data as RawRow[]).map(toMoverRow), limit);
  } catch {
    return { down: [], up: [] };
  }
}
