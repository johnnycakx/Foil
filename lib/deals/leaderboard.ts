// Buy-signal leaderboard read + ranking (ROADMAP B.4 / ADR-054).
//
// Pure ranking/filter (rankDeals) + the cache read (getLeaderboard). The board
// at /deals renders ENTIRELY from the buy_signals cache table — zero eBay
// Browse calls at page-view time (R-008 + R-012). The cache is populated by the
// daily refresh cron (lib/deals/refresh-batch.ts).

import { supabaseAdmin } from "../supabase/admin.ts";
import { BUY_SIGNAL_MIN_SAMPLE } from "../buy-signal/compute.ts";

/** One leaderboard row — all DERIVED/non-eBay fields (see the migration's
 *  R-008 note). `deltaPct` is negative for a BELOW row (ask under reference). */
export type DealRow = {
  cardSlug: string;
  cardName: string;
  setName: string;
  imageUrl: string;
  signal: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
  deltaPct: number | null;
  soldReference: number | null;
  soldSampleSize: number;
  matchedTier: string | null;
  computedAt: string;
};

/**
 * Pure: filter to confident BELOW deals and rank by how far below sold each is.
 * The board shows ONLY rows we'd stake the brand on:
 *   - signal === "BELOW" (the ask is meaningfully under the sold reference),
 *   - a real negative deltaPct + a positive sold reference,
 *   - sample size at/above the buy-signal floor (no thin-sample deals).
 * Sorted most-below first (most-negative deltaPct), capped at `limit`.
 */
export function rankDeals(rows: DealRow[], limit = 25): DealRow[] {
  return rows
    .filter(
      (r) =>
        r.signal === "BELOW" &&
        typeof r.deltaPct === "number" &&
        r.deltaPct < 0 &&
        typeof r.soldReference === "number" &&
        r.soldReference > 0 &&
        r.soldSampleSize >= BUY_SIGNAL_MIN_SAMPLE,
    )
    .sort((a, b) => (a.deltaPct as number) - (b.deltaPct as number))
    .slice(0, limit);
}

/** The most recent computed_at across rows — drives the board's "Updated"
 *  stamp. null when there are no rows. */
export function latestComputedAt(rows: DealRow[]): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    if (!latest || r.computedAt > latest) latest = r.computedAt;
  }
  return latest;
}

type RawRow = {
  card_slug: string;
  card_name: string | null;
  set_name: string | null;
  image_url: string | null;
  signal: string;
  delta_pct: number | null;
  sold_reference: number | null;
  sold_sample_size: number | null;
  matched_tier: string | null;
  computed_at: string;
};

/** Map a DB row to a DealRow. Exported for tests. */
export function toDealRow(r: RawRow): DealRow {
  return {
    cardSlug: r.card_slug,
    cardName: r.card_name ?? "",
    setName: r.set_name ?? "",
    imageUrl: r.image_url ?? "",
    signal: (r.signal as DealRow["signal"]) ?? "UNKNOWN",
    deltaPct: typeof r.delta_pct === "number" ? r.delta_pct : null,
    soldReference: typeof r.sold_reference === "number" ? r.sold_reference : null,
    soldSampleSize: typeof r.sold_sample_size === "number" ? r.sold_sample_size : 0,
    matchedTier: r.matched_tier ?? null,
    computedAt: r.computed_at,
  };
}

/**
 * Read the BELOW rows from the cache and rank them. Soft-fails to [] on any
 * Supabase error so the /deals page renders its calm empty state rather than a
 * 500. Touches NO eBay data — pure DB read of derived metadata.
 */
export async function getLeaderboard(limit = 25): Promise<DealRow[]> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("buy_signals")
      .select(
        "card_slug, card_name, set_name, image_url, signal, delta_pct, sold_reference, sold_sample_size, matched_tier, computed_at",
      )
      .eq("signal", "BELOW");
    if (error || !data) return [];
    return rankDeals((data as RawRow[]).map(toDealRow), limit);
  } catch {
    return [];
  }
}
