// Unit tests for the alert decision core (alert-engine-rebuild, ADR-091).
// The state machine + effective-target math in isolation — the scan tests
// cover the same rules end-to-end through the batch.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BLANK_TARGET_MARKET_DISCOUNT,
  REARM_HYSTERESIS,
  compAxisMatches,
  decideAlert,
  effectiveTargetCents,
  marketFloorCents,
  tierLabel,
  type SoldComp,
} from "../wishlist/alert-decision.ts";

const COMP: SoldComp = {
  avg30dCents: 10000, // $100 avg → floor $85
  saleCount: 12,
  tierLabel: "Near Mint",
  computedAt: "2026-07-01T00:00:00Z",
};

test("constants: 15% blank-target discount, 5% re-arm hysteresis", () => {
  assert.equal(BLANK_TARGET_MARKET_DISCOUNT, 0.15);
  assert.equal(REARM_HYSTERESIS, 0.05);
});

test("marketFloorCents: 15% under the avg, only on an NM-comparable axis", () => {
  assert.equal(marketFloorCents(COMP, "any-raw"), 8500);
  assert.equal(marketFloorCents(COMP, "nm"), 8500);
  // Cross-axis (I-009 discipline): an LP or PSA-10 watch must not be measured
  // against an NM average.
  assert.equal(marketFloorCents(COMP, "lp"), null);
  assert.equal(marketFloorCents(COMP, "psa-10"), null);
  assert.equal(marketFloorCents(null, "any-raw"), null);
  assert.equal(marketFloorCents({ ...COMP, avg30dCents: 0 }, "any-raw"), null);
});

test("compAxisMatches mirrors the floor gate", () => {
  assert.equal(compAxisMatches("any-raw"), true);
  assert.equal(compAxisMatches("nm"), true);
  assert.equal(compAxisMatches("lp"), false);
  assert.equal(compAxisMatches("bgs-10-bl"), false);
});

test("effectiveTargetCents: max(user target, floor); blank target = floor alone; no floor + blank = null", () => {
  assert.equal(effectiveTargetCents(4000, COMP, "any-raw"), 8500, "floor lifts a low target");
  assert.equal(effectiveTargetCents(9000, COMP, "any-raw"), 9000, "a target above the floor wins");
  assert.equal(effectiveTargetCents(null, COMP, "any-raw"), 8500, "blank target = the floor");
  assert.equal(effectiveTargetCents(null, null, "any-raw"), null, "blank + no comp = no basis");
  assert.equal(effectiveTargetCents(null, COMP, "psa-10"), null, "blank + cross-axis comp = no basis");
  assert.equal(effectiveTargetCents(4000, COMP, "psa-10"), 4000, "cross-axis comp never lifts an explicit target");
});

test("armed + first observation at/below target → fire 'already_below' (never claims a drop)", () => {
  const d = decideAlert(
    { targetPriceCents: 4000, lastSeenPriceCents: null, alertState: "armed", condition: "any-raw" },
    3500,
    null,
  );
  assert.deepEqual(d, {
    action: "fire",
    kind: "already_below",
    basis: "target",
    effectiveTargetCents: 4000,
    nextAlertState: "fired",
  });
});

test("armed + observed cross (prior seen above, now below) → fire 'dropped'", () => {
  const d = decideAlert(
    { targetPriceCents: 4000, lastSeenPriceCents: 4500, alertState: "armed", condition: "any-raw" },
    3800,
    null,
  );
  assert.equal(d.action, "fire");
  assert.equal((d as { kind: string }).kind, "dropped");
});

test("armed + prior seen ALSO below (e.g. a failed send last scan) → 'already_below', not 'dropped'", () => {
  const d = decideAlert(
    { targetPriceCents: 4000, lastSeenPriceCents: 3600, alertState: "armed", condition: "any-raw" },
    3500,
    null,
  );
  assert.equal(d.action, "fire");
  assert.equal((d as { kind: string }).kind, "already_below");
});

test("armed + above target → hold, stays armed", () => {
  const d = decideAlert(
    { targetPriceCents: 4000, lastSeenPriceCents: null, alertState: "armed", condition: "any-raw" },
    4100,
    null,
  );
  assert.deepEqual(d, { action: "hold", reason: "above_target", effectiveTargetCents: 4000, nextAlertState: "armed" });
});

test("fired: holds inside the hysteresis band; re-arms only past it", () => {
  const state = { targetPriceCents: 4000, lastSeenPriceCents: 3900, alertState: "fired" as const, condition: "any-raw" };
  // $40 target → band top $42. $41.99 holds; $42.01 re-arms.
  const inside = decideAlert(state, 4199, null);
  assert.deepEqual(inside, { action: "hold", reason: "state_fired", effectiveTargetCents: 4000, nextAlertState: "fired" });
  const outside = decideAlert(state, 4201, null);
  assert.deepEqual(outside, { action: "hold", reason: "rearmed", effectiveTargetCents: 4000, nextAlertState: "armed" });
});

test("fired + price back below → still holds (the oscillation case: one alert, not daily)", () => {
  const d = decideAlert(
    { targetPriceCents: 4000, lastSeenPriceCents: 4050, alertState: "fired", condition: "any-raw" },
    3950,
    null,
  );
  assert.equal(d.action, "hold");
  assert.equal((d as { reason: string }).reason, "state_fired");
});

test("market basis: fires between the user target and the floor with basis 'market'", () => {
  // $30 target, $100 avg → effective $85. $75 fires on the market basis.
  const d = decideAlert(
    { targetPriceCents: 3000, lastSeenPriceCents: 9000, alertState: "armed", condition: "any-raw" },
    7500,
    COMP,
  );
  assert.equal(d.action, "fire");
  assert.equal((d as { basis: string }).basis, "market");
  // At/below the user's own target → basis flips to 'target'.
  const t = decideAlert(
    { targetPriceCents: 3000, lastSeenPriceCents: 9000, alertState: "armed", condition: "any-raw" },
    2900,
    COMP,
  );
  assert.equal((t as { basis: string }).basis, "target");
});

test("blank target with no usable comp → hold 'no_basis', state unchanged", () => {
  const d = decideAlert(
    { targetPriceCents: null, lastSeenPriceCents: null, alertState: "armed", condition: "any-raw" },
    100,
    null,
  );
  assert.deepEqual(d, { action: "hold", reason: "no_basis", effectiveTargetCents: null, nextAlertState: "armed" });
});

test("tierLabel humanizes PokeTrace tier keys", () => {
  assert.equal(tierLabel("NEAR_MINT"), "Near Mint");
  assert.equal(tierLabel("LIGHTLY_PLAYED"), "Lightly Played");
  assert.equal(tierLabel("PSA_10"), "Psa 10"); // acceptable — comps are raw-tier today
});
