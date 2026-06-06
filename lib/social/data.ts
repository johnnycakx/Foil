// Data providers for the X bot (ADR-058). All reads come from the buy_signals
// cache (derived signal + PokeTrace sold reference) — R-008-safe, no eBay
// listing data. No live eBay call here.

import { supabaseAdmin } from "../supabase/admin.ts";
import { getLeaderboard } from "../deals/leaderboard.ts";
import type { DealData, SpotlightData } from "./post-text.ts";
import { utcDayNumber } from "./angles.ts";

/** Confident BELOW deals (the leaderboard), mapped for the post. */
export async function getDealsForPost(): Promise<DealData[]> {
  const rows = await getLeaderboard(5);
  return rows.map((r) => ({
    cardName: r.cardName,
    setName: r.setName,
    slug: r.cardSlug,
    deltaPct: r.deltaPct ?? 0,
    soldReference: r.soldReference ?? 0,
    matchedTier: r.matchedTier,
  }));
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
 * varies. Only returns cards that have a real PokeTrace sold reference + a
 * healthy sample in buy_signals. Null when none qualify (caller falls back).
 */
export async function getSpotlightForPost(now: Date = new Date()): Promise<SpotlightData | null> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("buy_signals")
      .select("card_slug, card_name, set_name, sold_reference, sold_sample_size")
      .in("card_slug", POPULAR_SLUGS)
      .not("sold_reference", "is", null)
      .gte("sold_sample_size", 5);
    if (error || !data || data.length === 0) return null;
    // Deterministic rotation across the qualifying cards by day.
    const sorted = [...data].sort((a, b) => (a.card_slug as string).localeCompare(b.card_slug as string));
    const pick = sorted[utcDayNumber(now) % sorted.length];
    const soldReference = typeof pick.sold_reference === "number" ? pick.sold_reference : Number(pick.sold_reference);
    if (!(soldReference > 0)) return null;
    return {
      cardName: (pick.card_name as string) ?? "",
      setName: (pick.set_name as string) ?? "",
      slug: pick.card_slug as string,
      soldReference,
      sampleSize: (pick.sold_sample_size as number) ?? 0,
    };
  } catch {
    return null;
  }
}
