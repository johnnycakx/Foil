// Buy-signal compute (ROADMAP #32 / ADR-053). Pure, synchronous, deterministic,
// no external deps. Classifies a current ask price against recent sold prices as
// BELOW / AT / ABOVE the reference, or UNKNOWN when the sample is too thin.
//
// Two entry points share one threshold core (`classifyBuySignal`):
//   - computeBuySignal({ sales, askPrice }) — TRUE MEDIAN over individual sales
//     in a rolling window, filtered to comparable condition. This is the
//     correct model; it's ready for when a per-sale feed (eBay sold listings)
//     lands. Today PokeTrace exposes only a 30-day AVERAGE + saleCount per tier
//     (no per-sale records), so the live card wiring calls `classifyBuySignal`
//     directly with that average as the reference. The /pricing-methodology
//     page documents that the reference is currently the 30-day sold average.

import type { ListingConditionTier } from "./condition-infer.ts";

export type Sale = {
  price: number;
  /** ISO string or ms-epoch. */
  soldAt: string | number;
  /** e.g. "NEAR_MINT", "LIGHTLY_PLAYED", "PSA_10". */
  conditionTier: string;
};

export type BuySignalTier = "BELOW" | "AT" | "ABOVE" | "UNKNOWN";

export type BuySignal = {
  tier: BuySignalTier;
  /** The reference price the ask was compared against (median or 30d average). */
  median: number | null;
  /** (ask - reference) / reference * 100, rounded to 1 dp. null when UNKNOWN. */
  deltaPercent: number | null;
  sampleSize: number;
  windowDays: number;
  /** Why the signal is UNKNOWN (condition mismatch, outlier, thin sample, …).
   *  Populated for UNKNOWN; undefined for a real BELOW/AT/ABOVE. */
  reason?: string;
};

export const BUY_SIGNAL_MIN_SAMPLE = 5;
export const BELOW_THRESHOLD = 0.9; // ask < median * 0.90
export const ABOVE_THRESHOLD = 1.1; // ask > median * 1.10
const DEFAULT_WINDOW_DAYS = 30;

// Outlier guard (PATTERN I-009): an ask below half the LOWEST known raw-tier
// 30-day sold average is almost never a real deal on the same card — it is a
// damaged/mislabeled/junk/fake listing the quality picker let through (the
// $43 "Base Set Charizard" case). Below this floor we refuse to classify.
export const OUTLIER_FLOOR_FRACTION = 0.5;

/** Graded slabs are a different market; exclude them when comparing a raw ask. */
export function isGradedTier(tier: string): boolean {
  return /^(PSA|BGS|CGC|SGC)[\s_-]?\d/i.test(tier.trim());
}

function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * The threshold core. Pure: given an ask, a reference price, and a sample size,
 * return the tier. UNKNOWN when the sample is below the floor or the inputs
 * aren't usable. Shared by computeBuySignal (median) and the live card wiring
 * (30-day average reference).
 */
export function classifyBuySignal(args: {
  askPrice: number;
  reference: number | null;
  sampleSize: number;
  windowDays?: number;
}): BuySignal {
  const windowDays = args.windowDays ?? DEFAULT_WINDOW_DAYS;
  const { askPrice, reference, sampleSize } = args;

  const usable =
    sampleSize >= BUY_SIGNAL_MIN_SAMPLE &&
    typeof reference === "number" &&
    Number.isFinite(reference) &&
    reference > 0 &&
    Number.isFinite(askPrice) &&
    askPrice > 0;

  if (!usable) {
    return { tier: "UNKNOWN", median: reference ?? null, deltaPercent: null, sampleSize, windowDays };
  }

  const ref = reference as number;
  const deltaPercent = Math.round(((askPrice - ref) / ref) * 1000) / 10;
  let tier: BuySignalTier;
  if (askPrice < ref * BELOW_THRESHOLD) tier = "BELOW";
  else if (askPrice > ref * ABOVE_THRESHOLD) tier = "ABOVE";
  else tier = "AT";

  return { tier, median: ref, deltaPercent, sampleSize, windowDays };
}

/**
 * Condition-matched classifier (ROADMAP #32.1 / PATTERN I-009). The live entry
 * point: it only compares an ask against a reference for the SAME condition the
 * listing is in, and refuses to classify implausible-outlier asks.
 *
 * Returns UNKNOWN (with a `reason`) when:
 *   - the listing condition couldn't be inferred (listingTier "UNKNOWN"), or
 *   - there is no sold data for that condition tier (conditionReference null), or
 *   - the ask is below OUTLIER_FLOOR_FRACTION × the lowest raw-tier sold avg.
 * Otherwise it delegates to the shared `classifyBuySignal` threshold core.
 */
export function classifyConditionMatched(args: {
  askPrice: number;
  listingTier: ListingConditionTier;
  conditionReference: number | null;
  conditionSampleSize: number;
  lowestRawReference: number | null;
  windowDays?: number;
}): BuySignal {
  const windowDays = args.windowDays ?? DEFAULT_WINDOW_DAYS;
  const { askPrice, listingTier, conditionReference, conditionSampleSize, lowestRawReference } = args;
  const unknown = (reason: string): BuySignal => ({
    tier: "UNKNOWN",
    median: conditionReference ?? null,
    deltaPercent: null,
    sampleSize: conditionSampleSize,
    windowDays,
    reason,
  });

  if (listingTier === "UNKNOWN") return unknown("listing condition could not be determined from the title");
  if (conditionReference == null || !(conditionReference > 0)) {
    return unknown(`no 30-day sold data for the ${listingTier} condition`);
  }
  // Outlier guard. Raw tiers floor on the LOWEST raw-tier sold avg (a raw ask
  // below half of even the cheapest raw tier is junk). Graded asks floor on
  // their OWN matched-grade reference (a PSA-9 ask below half the PSA-9 sold
  // avg is a mislabeled/junk slab) — ROADMAP #32.3 closes the graded gap.
  const guardFloorRef = listingTier === "GRADED" ? conditionReference : lowestRawReference;
  if (
    typeof guardFloorRef === "number" &&
    Number.isFinite(guardFloorRef) &&
    guardFloorRef > 0 &&
    Number.isFinite(askPrice) &&
    askPrice > 0 &&
    askPrice < guardFloorRef * OUTLIER_FLOOR_FRACTION
  ) {
    const what = listingTier === "GRADED" ? "the matched grade's sold average" : "the lowest sold tier";
    return unknown(`ask is an implausible outlier (below half ${what}) — likely a damaged, mislabeled, or junk listing`);
  }

  return classifyBuySignal({ askPrice, reference: conditionReference, sampleSize: conditionSampleSize, windowDays });
}

/**
 * Spec entry point: TRUE MEDIAN over individual sales. Filters to the rolling
 * window and to comparable condition (raw-vs-raw by default — graded slabs
 * excluded). Deterministic; pass `now` in tests.
 */
export function computeBuySignal(args: {
  sales: Sale[];
  askPrice: number;
  windowDays?: number;
  now?: number;
  /** Override the comparable-condition filter. Default: exclude graded slabs. */
  includeTier?: (tier: string) => boolean;
}): BuySignal {
  const windowDays = args.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = args.now ?? Date.now();
  const includeTier = args.includeTier ?? ((t: string) => !isGradedTier(t));
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  const prices = (args.sales ?? [])
    .filter((s) => {
      const t = typeof s.soldAt === "number" ? s.soldAt : Date.parse(String(s.soldAt));
      return Number.isFinite(t) && t >= cutoff && t <= now;
    })
    .filter((s) => includeTier(s.conditionTier))
    .map((s) => s.price)
    .filter((p) => typeof p === "number" && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  const reference = prices.length > 0 ? median(prices) : null;
  return classifyBuySignal({ askPrice: args.askPrice, reference, sampleSize: prices.length, windowDays });
}
