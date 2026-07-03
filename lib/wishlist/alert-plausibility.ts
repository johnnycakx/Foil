// Alert plausibility guard (alert-plausibility-guard, ADR-103). Too-good-to-
// be-true is a red flag, not a deal: a listing dramatically under what the
// card actually SELLS for is junk (wrong printing, JP, proxy, empty slab,
// scam BIN), not a win — mailing it destroys the exact trust the product
// sells ("sold data to prove the deal is real").
//
// Live incident this pins (2026-07-03 03:08): "Umbreon ex dropped to $57.24,
// 95% under its 30-day sold average ($1,244.86)" — a same-name cheap-printing
// admission through the number-absence identity gate. Even DAMAGED copies of
// the SIR average ~$1,006; $57 was never this card.
//
// This is a FILTER at the send boundary (the batching-goal pattern): the
// engine's armed/fired hysteresis is untouched; a suppressed fire simply
// never reaches the pending buffer, and the row stays armed. Suppressions
// are counted + logged (Discord), never mailed.
//
// THE BAND. A fire is implausible when the listing sits below
// PLAUSIBLE_FLOOR_FRACTION of the condition-matched 30-day sold basis.
// Threshold judgment (documented, not guessed):
//   - The fixture: $57.24 / $1,244.86 = 4.6% of basis — suppressed with a
//     20x margin.
//   - Real fire-sales in the movers data run 10-40% under the 30-day basis;
//     a genuine 35%-under deal is 65% of basis — mails with margin.
//   - Condition coherence rides the same floor: on the fixture card the
//     LOWEST raw tier (damaged) averages ~80% of the NM basis. 35%-of-basis
//     sits far beneath every real raw condition's average, so a price that
//     fails the band is incoherent with ANY condition of the watched card —
//     rule 2 of the goal is subsumed by rule 1 with margin, using only the
//     data the cron already has (no per-tier API spend at the boundary).
//   - PokeTrace anomaly filtering already lives in the BASIS (the windowed
//     aggregates the movers cache stores are upstream-filtered); no
//     per-listing PokeTrace flag exists for eBay Browse items to consume.
//
// NULL-OVER-GUESS (rule 4): with NO sold basis at all, a dramatic delta
// can't be judged plausible — a target-basis fire deep under the user's own
// target is suppressed too (silence over a made-up win). A modest
// under-target fire without a basis keeps ADR-091's semantics and mails.

import type { SoldComp } from "./alert-decision.ts";

/** Listings below this fraction of the sold basis (or, basis-less, of the
 *  user's target) are the junk class. 0.35 = "more than 65% under". */
export const PLAUSIBLE_FLOOR_FRACTION = 0.35;

export type PlausibilityInput = {
  /** Verified listing price (USD cents — the currency gate runs upstream). */
  currentPriceCents: number;
  /** Condition-matched 30-day sold comp, or null when none exists. */
  comp: SoldComp | null;
  /** The row's explicit target (null = market-basis watch). */
  targetPriceCents: number | null;
};

export type PlausibilityVerdict =
  | { plausible: true }
  | {
      plausible: false;
      /** Machine-readable class for counters. */
      reason: "under_sold_basis" | "under_target_no_basis";
      /** Human line for the Discord note. */
      detail: string;
      basisCents: number;
    };

function pctUnder(priceCents: number, basisCents: number): number {
  return Math.round(((basisCents - priceCents) / basisCents) * 100);
}

export function assessAlertPlausibility(input: PlausibilityInput): PlausibilityVerdict {
  const { currentPriceCents, comp, targetPriceCents } = input;

  if (comp && comp.avg30dCents > 0) {
    const floor = comp.avg30dCents * PLAUSIBLE_FLOOR_FRACTION;
    if (currentPriceCents < floor) {
      return {
        plausible: false,
        reason: "under_sold_basis",
        detail: `${pctUnder(currentPriceCents, comp.avg30dCents)}% under the ${comp.tierLabel} 30-day sold basis`,
        basisCents: comp.avg30dCents,
      };
    }
    return { plausible: true };
  }

  // No sold basis: a dramatic delta has nothing plausible to stand on.
  if (targetPriceCents != null && targetPriceCents > 0) {
    const floor = targetPriceCents * PLAUSIBLE_FLOOR_FRACTION;
    if (currentPriceCents < floor) {
      return {
        plausible: false,
        reason: "under_target_no_basis",
        detail: `no sold basis and ${pctUnder(currentPriceCents, targetPriceCents)}% under the user's own target`,
        basisCents: targetPriceCents,
      };
    }
  }
  return { plausible: true };
}
