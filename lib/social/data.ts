// Data providers for the X bot (ADR-058; deal-source fix ADR-071 follow-up).
//
// The deal angle now sources from market_movers (the SAME fresh signal that
// powers /deals + the newsletter — daily 09:00 UTC cron), NOT the stale
// buy_signals leaderboard. buy_signals went stale when PokeTrace was cancelled
// (2026-06-16); a stale row produced a PHANTOM "43% below sold" deal in the
// first approval draft. Movers is a market AGGREGATE ("below its own 30-day
// average"), which can't break the way a single mispriced listing can, and a
// freshness guard (MAX_DEAL_AGE_HOURS) means a stale board never makes a deal.
// All reads are PokeTrace-derived (non-eBay) — R-008-safe.

import { supabaseAdmin } from "../supabase/admin.ts";
import { getMarketMovers, type MarketMovers } from "../deals/market-movers-read.ts";
import type { DealData, SpotlightData } from "./post-text.ts";
import { utcDayNumber } from "./angles.ts";

/** A deal post must trace to a source row no older than this. Defense-in-depth
 *  on top of getMarketMovers' own 36h freshness window — if that window is ever
 *  widened, the deal angle stays bounded so a stale signal can't post. */
export const MAX_DEAL_AGE_HOURS = 48;

/**
 * Pure: fresh down-movers → DealData. Excludes any mover whose `computedAt` is
 * older than `maxAgeHours` OR lacks a usable 30-day average. The freshness guard
 * is here (not in the DB read) so it's unit-testable and applies regardless of
 * the source's own windowing. Exported for tests.
 */
export function freshDeals(movers: MarketMovers, nowMs: number, maxAgeHours: number = MAX_DEAL_AGE_HOURS): DealData[] {
  const cutoff = nowMs - maxAgeHours * 60 * 60 * 1000;
  return movers.down
    .filter((m) => {
      const t = Date.parse(m.computedAt);
      return Number.isFinite(t) && t >= cutoff && typeof m.avg30d === "number" && m.avg30d > 0;
    })
    .map((m) => ({
      cardName: m.cardName,
      setName: m.setName,
      slug: m.cardSlug,
      deltaPct: m.momentumPct, // negative = below its 30-day average
      soldReference: m.avg30d as number,
      matchedTier: m.matchedTier, // movers are NEAR_MINT by construction (no LP mislabel)
      saleCount: m.saleCount,
      computedAt: m.computedAt,
      imageUrl: m.imageUrl ?? "",
    }));
}

/** Good-buy movers (cards below their own 30-day average), freshness-guarded. */
export async function getDealsForPost(now: Date = new Date()): Promise<DealData[]> {
  const movers = await getMarketMovers(12);
  return freshDeals(movers, now.getTime());
}

// Recognizable cards for the price-spotlight angle — kept to a curated set so
// the spotlight always names a card people search for, even on a thin day.
const POPULAR_SLUGS = [
  "base1-4-charizard",
  "sv3pt5-199-charizard-ex",
  "swsh7-215-umbreon-vmax-alt-art",
  "base1-15-venusaur",
  "base1-10-mewtwo",
  "sv3pt5-205-mew-ex",
  "base1-2-blastoise",
  "swsh12pt5-19-charizard-vstar",
];

/**
 * A popular card's recent sold reference for the spotlight, rotated by day so it
 * varies. Only returns cards with a real PokeTrace sold reference, a healthy
 * sample, AND a source row no older than MAX_DEAL_AGE_HOURS — a stale price is
 * as misleading as a stale deal, so the spotlight degrades to the fallback (the
 * caller drops to educational) rather than quoting an outdated number. Null when
 * none qualify.
 */
export async function getSpotlightForPost(now: Date = new Date()): Promise<SpotlightData | null> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("buy_signals")
      .select("card_slug, card_name, set_name, sold_reference, sold_sample_size, computed_at, image_url")
      .in("card_slug", POPULAR_SLUGS)
      .not("sold_reference", "is", null)
      .gte("sold_sample_size", 5);
    if (error || !data || data.length === 0) return null;
    // Freshness guard — drop any row older than the deal-age threshold.
    const cutoff = now.getTime() - MAX_DEAL_AGE_HOURS * 60 * 60 * 1000;
    const fresh = data.filter((r) => {
      const t = Date.parse(r.computed_at as string);
      return Number.isFinite(t) && t >= cutoff;
    });
    if (fresh.length === 0) return null;
    // Deterministic rotation across the qualifying cards by day.
    const sorted = [...fresh].sort((a, b) => (a.card_slug as string).localeCompare(b.card_slug as string));
    const pick = sorted[utcDayNumber(now) % sorted.length];
    const soldReference = typeof pick.sold_reference === "number" ? pick.sold_reference : Number(pick.sold_reference);
    if (!(soldReference > 0)) return null;
    return {
      cardName: (pick.card_name as string) ?? "",
      setName: (pick.set_name as string) ?? "",
      slug: pick.card_slug as string,
      soldReference,
      sampleSize: (pick.sold_sample_size as number) ?? 0,
      imageUrl: (pick.image_url as string) ?? "",
    };
  } catch {
    return null;
  }
}
