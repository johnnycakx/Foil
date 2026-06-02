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
 *   - the ask is outside [0.5x, 2x] of the matched condition's sold average
 *     (the symmetric outlier guard — ROADMAP #32.3).
 * Otherwise it delegates to the shared `classifyBuySignal` threshold core.
 */
export function classifyConditionMatched(args: {
  askPrice: number;
  listingTier: ListingConditionTier;
  conditionReference: number | null;
  conditionSampleSize: number;
  /** Retained for telemetry/back-compat; the symmetric guard keys off the
   *  matched conditionReference, not the lowest raw tier (ROADMAP #32.3). */
  lowestRawReference?: number | null;
  windowDays?: number;
}): BuySignal {
  const windowDays = args.windowDays ?? DEFAULT_WINDOW_DAYS;
  const { askPrice, listingTier, conditionReference, conditionSampleSize } = args;
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
  // SYMMETRIC outlier guard (ROADMAP #32.3). The ask must sit within
  // [0.5x, 2x] of its OWN matched-condition sold average. Outside that band the
  // comparison is unreliable, so we show no signal — same rationale both ways:
  //   - below half  -> a damaged / mislabeled / junk listing priced like a
  //     lower grade (the original raw guard, now keyed to the matched tier so a
  //     high-value condition gets a proportionally higher floor);
  //   - above double -> anomalously overpriced, a mislabeled grade, or just
  //     low-value-card % noise (a $4 ask vs a $2 sold avg reads +100% on a $2
  //     spread). These were the residual >±80% ABOVE cases #32.3 caught.
  // conditionReference is guaranteed finite > 0 by the check above.
  if (Number.isFinite(askPrice) && askPrice > 0) {
    if (askPrice < conditionReference * OUTLIER_FLOOR_FRACTION) {
      return unknown("ask is an implausible outlier (below half the matched condition's sold average) — likely a damaged, mislabeled, or junk listing");
    }
    if (askPrice > conditionReference / OUTLIER_FLOOR_FRACTION) {
      return unknown("ask is an implausible outlier (above double the matched condition's sold average) — likely overpriced beyond a reliable read, a mislabeled grade, or low-value-card noise");
    }
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
