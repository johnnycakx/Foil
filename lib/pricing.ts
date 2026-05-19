// Shared price-quote model. Both PokeTrace (lib/poketrace.ts) and PriceCharting
// (lib/pricecharting.ts) emit PriceQuote[] so the UI consumes a single uniform
// shape. Multiple sources can supply the same tier — the UI dedupes by best
// price per tier (or shows source-by-source on the graded ladder).
//
// Why this lives outside the source-specific modules: the alternative is each
// source defining its own bespoke shape and the UI fanning out on a union
// type. That made effectivePrice() necessary and led to the multiplier
// fabrication. Quotes are how we keep the UI honest.

export type PriceQuoteSource = "tcgplayer" | "ebay" | "cardmarket" | "pricecharting";

/**
 * The set of price tiers we care about. RAW_UNGRADED covers all raw cards
 * (PriceCharting's `loose-price` is a single ungraded number, so we don't
 * split it into NM/LP/MP/HP/DMG — those splits would be fabrication).
 *
 * Graded tiers are exhaustive across the sources we use. PriceCharting
 * doesn't return BGS 9.5 separately, so it's omitted intentionally.
 */
export type GradeTier =
  | "RAW_UNGRADED"
  | "PSA_7"
  | "PSA_8"
  | "PSA_9"
  | "PSA_9_5"
  | "PSA_10"
  | "CGC_10"
  | "SGC_10"
  | "BGS_10";

export type PriceQuote = {
  source: PriceQuoteSource;
  tier: GradeTier;
  amount: number; // dollars (NOT cents)
};

const TIER_ORDER: GradeTier[] = [
  "RAW_UNGRADED",
  "PSA_7",
  "PSA_8",
  "PSA_9",
  "PSA_9_5",
  "PSA_10",
  "CGC_10",
  "SGC_10",
  "BGS_10",
];

export function compareTiers(a: GradeTier, b: GradeTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

export const TIER_LABELS: Record<GradeTier, string> = {
  RAW_UNGRADED: "Ungraded",
  PSA_7: "PSA 7",
  PSA_8: "PSA 8",
  PSA_9: "PSA 9",
  PSA_9_5: "PSA 9.5",
  PSA_10: "PSA 10",
  CGC_10: "CGC 10",
  SGC_10: "SGC 10",
  BGS_10: "BGS 10",
};

export const SOURCE_LABELS: Record<PriceQuoteSource, string> = {
  tcgplayer: "TCGplayer",
  ebay: "eBay sold",
  cardmarket: "Cardmarket",
  pricecharting: "PriceCharting",
};

/**
 * Best (highest) ungraded quote across all sources. Returns null if there is
 * no ungraded data — UI should treat that as "no price available," not as
 * a fall-through to a graded number.
 */
export function bestUngraded(quotes: PriceQuote[]): PriceQuote | null {
  let best: PriceQuote | null = null;
  for (const q of quotes) {
    if (q.tier !== "RAW_UNGRADED") continue;
    if (!best || q.amount > best.amount) best = q;
  }
  return best;
}

/**
 * Quotes grouped by graded tier, ordered cheapest → most expensive
 * (PSA 7 → BGS 10). Each entry collapses to the *best* quote for that tier so
 * the UI doesn't show three identical PSA 10 rows from three sources. Use
 * `quotesAtTier` if you need every quote.
 */
export function gradedLadder(quotes: PriceQuote[]): Array<{ tier: GradeTier; best: PriceQuote }> {
  const byTier = new Map<GradeTier, PriceQuote>();
  for (const q of quotes) {
    if (q.tier === "RAW_UNGRADED") continue;
    const existing = byTier.get(q.tier);
    if (!existing || q.amount > existing.amount) byTier.set(q.tier, q);
  }
  return Array.from(byTier.entries())
    .map(([tier, best]) => ({ tier, best }))
    .sort((a, b) => compareTiers(a.tier, b.tier));
}

export function quotesAtTier(quotes: PriceQuote[], tier: GradeTier): PriceQuote[] {
  return quotes.filter((q) => q.tier === tier);
}

/**
 * Sum each card's best ungraded quote into a collection total. Cards with no
 * ungraded data contribute 0 — never extrapolated from graded prices.
 */
export function collectionUngradedTotal(
  cards: Array<{ quotes: PriceQuote[] }>,
): number {
  let total = 0;
  for (const c of cards) {
    const best = bestUngraded(c.quotes);
    if (best) total += best.amount;
  }
  return Math.round(total * 100) / 100;
}
