// Alert decision core — the honest event model (alert-engine-rebuild, ADR-091).
//
// Pure functions, no IO. This replaces the old sole trigger `price ≤ target`
// (which re-alerted a below-target card ~daily forever, each email claiming it
// "just dropped") with a state machine over per-row watch state:
//
//   armed --(price ≤ effective target)--> FIRE once, state 'fired'
//   fired --(price > effective target × (1 + hysteresis))--> re-arm
//
// An alert fires only when something genuinely just happened, and the email
// kind is honest about WHAT happened:
//   - "dropped"       — a cross was actually observed (prior seen price above
//                       the effective target, current at/below it).
//   - "already_below" — the first observation of this watch found the price
//                       already at/below target. One honest email, then
//                       silence until a real re-arm cross.
//
// Effective target (the reference floor): max(user target, 15% under the
// 30-day sold average) — a listing genuinely under market is worth one ping
// even if the user's dream target is lower; the email's `basis` field keeps
// the copy honest about WHICH bound triggered. A BLANK target means "alert me
// at ≥15% under the 30-day sold average" — no sentinel value exists anywhere.
//
// Comp-axis honesty (I-009 discipline): the sold comp is a NEAR_MINT raw
// aggregate (market_movers), so it can set the floor only for watches on an
// NM-comparable axis ("any-raw" / "nm"). Mismatched-axis watches (LP/MP/HP/
// DMG raw, graded) keep their explicit target as the sole trigger, and a
// blank-target mismatched-axis watch has no basis at all → never fires. The
// comp may still be CITED in the email evidence line with its tier label —
// citing with attribution is honest; using it as a cross-axis trigger is not.

import { RAW_CONDITION_TOKENS } from "../cards/conditions.ts";

/** Blank target = alert at ≥ this fraction under the 30-day sold average. */
export const BLANK_TARGET_MARKET_DISCOUNT = 0.15;

/** Re-arm only after price exits the band UPWARD by this fraction — a card
 *  oscillating $0.50 around target fires once, not daily. */
export const REARM_HYSTERESIS = 0.05;

export type AlertState = "armed" | "fired";

/** 30-day sold comp (market_movers cache — real PokeTrace aggregates only). */
export type SoldComp = {
  avg30dCents: number;
  saleCount: number;
  /** Human tier label for the evidence line, e.g. "Near Mint". */
  tierLabel: string;
  computedAt: string;
};

export type WatchRowState = {
  /** null = blank target ("alert at ≥15% under the 30-day sold average"). */
  targetPriceCents: number | null;
  lastSeenPriceCents: number | null;
  alertState: AlertState;
  /** Watch condition token — gates whether the NM comp can set the floor. */
  condition: string;
};

export type AlertDecision =
  | {
      action: "fire";
      kind: "dropped" | "already_below";
      /** Which bound triggered — drives honest copy. */
      basis: "target" | "market";
      effectiveTargetCents: number;
      nextAlertState: "fired";
    }
  | {
      action: "hold";
      /** "rearmed" when a fired row exited the hysteresis band upward. */
      reason: "above_target" | "state_fired" | "rearmed" | "no_basis";
      effectiveTargetCents: number | null;
      nextAlertState: AlertState;
    };

/** Can the NEAR_MINT sold comp set the floor for this watch's condition axis?
 *  Only "any-raw" and "nm" — an LP/graded watch measured against an NM average
 *  is the I-009 comparison-basis bug. */
export function compAxisMatches(condition: string): boolean {
  return condition === "any-raw" || condition === "nm";
}

/** The reference floor: 15% under the 30-day sold average, when a comp exists
 *  AND the watch's condition axis matches the comp's tier. */
export function marketFloorCents(comp: SoldComp | null, condition: string): number | null {
  if (!comp || comp.avg30dCents <= 0) return null;
  if (!compAxisMatches(condition)) return null;
  return Math.round(comp.avg30dCents * (1 - BLANK_TARGET_MARKET_DISCOUNT));
}

/**
 * The effective target for a watch: max(user target, market floor). Blank
 * target uses the floor alone; blank target with no usable floor has NO basis
 * (returns null — the caller must hold, never fire).
 */
export function effectiveTargetCents(
  targetPriceCents: number | null,
  comp: SoldComp | null,
  condition: string,
): number | null {
  const floor = marketFloorCents(comp, condition);
  if (targetPriceCents == null) return floor;
  return floor == null ? targetPriceCents : Math.max(targetPriceCents, floor);
}

/**
 * Decide what happens for one watch row given the current VERIFIED USD price.
 * Pure — the scan writes `lastSeenPriceCents` on every evaluation regardless
 * of the outcome (baseline freshness), and applies `nextAlertState`.
 */
export function decideAlert(
  row: WatchRowState,
  currentPriceCents: number,
  comp: SoldComp | null,
): AlertDecision {
  const effective = effectiveTargetCents(row.targetPriceCents, comp, row.condition);

  // Blank target with no usable comp: nothing to measure against — never fire.
  if (effective == null) {
    return { action: "hold", reason: "no_basis", effectiveTargetCents: null, nextAlertState: row.alertState };
  }

  if (row.alertState === "fired") {
    // Hysteresis re-arm: only when price exits the band UPWARD.
    const rearmAbove = Math.round(effective * (1 + REARM_HYSTERESIS));
    if (currentPriceCents > rearmAbove) {
      return { action: "hold", reason: "rearmed", effectiveTargetCents: effective, nextAlertState: "armed" };
    }
    return { action: "hold", reason: "state_fired", effectiveTargetCents: effective, nextAlertState: "fired" };
  }

  // armed
  if (currentPriceCents > effective) {
    return { action: "hold", reason: "above_target", effectiveTargetCents: effective, nextAlertState: "armed" };
  }

  // Fire. "dropped" ONLY when a cross was actually observed: the prior seen
  // price was above the effective target. First observation (no prior seen)
  // or a prior seen already at/below (e.g. an earlier send failed) is
  // "already_below" — never claim a drop that wasn't observed.
  const crossObserved = row.lastSeenPriceCents != null && row.lastSeenPriceCents > effective;
  const basis: "target" | "market" =
    row.targetPriceCents != null && currentPriceCents <= row.targetPriceCents ? "target" : "market";
  return {
    action: "fire",
    kind: crossObserved ? "dropped" : "already_below",
    basis,
    effectiveTargetCents: effective,
    nextAlertState: "fired",
  };
}

/** Raw-family tokens re-exported for the scan's comp plumbing. */
export const NM_COMPARABLE_TOKENS: readonly string[] = RAW_CONDITION_TOKENS.filter(
  (t) => t === "any-raw" || t === "nm",
);

/** "NEAR_MINT" → "Near Mint" — human label for a PokeTrace tier key, used in
 *  the email evidence line so the comp is cited WITH its axis. */
export function tierLabel(matchedTier: string): string {
  return matchedTier
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
