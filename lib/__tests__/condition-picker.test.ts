// Unit test for the condition picker's price-resolution logic.
//
// The picker itself is a React component (app/upload/upload-form.tsx) but its
// price math lives in effectivePrice() in lib/poketrace.ts. This test
// simulates "clicking LP on a priced row" by toggling the per-row condition
// state the UI maintains and asserts:
//   (1) the row's displayed price flips from NM → LP-estimated,
//   (2) the top-level live total recomputes from each row's selected condition.
//
// Mirrors the pattern in low-confidence-gate.test.ts: pure logic only, no DOM.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CONDITION_MULTIPLIER,
  effectivePrice,
  type ByCondition,
  type CardPricing,
  type RawConditionTier,
} from "../poketrace.ts";

function makePricing(
  overrides: { byCondition?: Partial<ByCondition>; topPriceAmount?: number | null } = {},
): Extract<CardPricing, { matched: true }> {
  const byCondition: ByCondition = {
    NEAR_MINT: 10.0,
    LIGHTLY_PLAYED: null,
    MODERATELY_PLAYED: null,
    HEAVILY_PLAYED: null,
    DAMAGED: null,
    ...overrides.byCondition,
  };
  // Default to $10 when the override is *absent*; pass null explicitly to
  // get a missing topPrice. (Nullish coalescing would coerce null → 10.)
  const topAmount = "topPriceAmount" in overrides ? overrides.topPriceAmount : 10.0;
  return {
    matched: true,
    lowConfidence: false,
    candidate: {
      id: "fake",
      name: "Fake Card",
      set: "Fake Set",
      setSlug: "fake-set",
      cardNumber: "001/100",
      variant: "Normal",
      image: null,
    },
    raw: {
      ebayNearMintAvg: null,
      tcgplayerNearMintAvg: 10.0,
      cardmarketNearMintAvg: null,
      byCondition,
    },
    bestGraded: null,
    topPrice:
      topAmount === null || topAmount === undefined
        ? null
        : { amount: topAmount, source: "tcgplayer", sourceLabel: "TCGplayer (NM)" },
    topCandidates: [],
  };
}

// Mirror the liveTotal useMemo in app/upload/upload-form.tsx so the test
// pins the exact computation the UI does.
function liveTotal(
  pricings: CardPricing[],
  conditions: Record<number, RawConditionTier>,
): number {
  let sum = 0;
  pricings.forEach((p, i) => {
    if (!p.matched) return;
    const tier = conditions[i] ?? "NEAR_MINT";
    const eff = effectivePrice(p.raw.byCondition, p.topPrice, tier);
    if (eff) sum += eff.amount;
  });
  return Math.round(sum * 100) / 100;
}

test("effectivePrice: returns raw NM when byCondition.NEAR_MINT is populated", () => {
  const p = makePricing();
  const eff = effectivePrice(p.raw.byCondition, p.topPrice, "NEAR_MINT");
  assert.deepStrictEqual(eff, { amount: 10.0, estimated: false });
});

test("effectivePrice: estimates non-NM tiers from NM when raw is null", () => {
  const p = makePricing();
  for (const tier of [
    "LIGHTLY_PLAYED",
    "MODERATELY_PLAYED",
    "HEAVILY_PLAYED",
    "DAMAGED",
  ] as const) {
    const eff = effectivePrice(p.raw.byCondition, p.topPrice, tier);
    assert.ok(eff, `expected estimated price for ${tier}`);
    assert.strictEqual(eff!.estimated, true, `${tier} should be flagged estimated`);
    assert.strictEqual(
      eff!.amount,
      Math.round(10 * CONDITION_MULTIPLIER[tier] * 100) / 100,
      `${tier} should equal NM * multiplier`,
    );
  }
});

test("effectivePrice: prefers raw value over estimate when raw exists", () => {
  const p = makePricing({
    byCondition: { LIGHTLY_PLAYED: 9.5 },
  });
  const eff = effectivePrice(p.raw.byCondition, p.topPrice, "LIGHTLY_PLAYED");
  assert.deepStrictEqual(eff, { amount: 9.5, estimated: false });
});

test("effectivePrice: falls back to topPrice when byCondition.NEAR_MINT is null", () => {
  const p = makePricing({
    byCondition: { NEAR_MINT: null },
    topPriceAmount: 7.0,
  });
  const eff = effectivePrice(p.raw.byCondition, p.topPrice, "LIGHTLY_PLAYED");
  assert.ok(eff);
  assert.strictEqual(eff!.estimated, true);
  assert.strictEqual(
    eff!.amount,
    Math.round(7.0 * CONDITION_MULTIPLIER.LIGHTLY_PLAYED * 100) / 100,
  );
});

test("effectivePrice: returns null when neither byCondition nor topPrice has an anchor", () => {
  const p = makePricing({
    byCondition: { NEAR_MINT: null },
    topPriceAmount: null,
  });
  for (const tier of [
    "NEAR_MINT",
    "LIGHTLY_PLAYED",
    "MODERATELY_PLAYED",
    "HEAVILY_PLAYED",
    "DAMAGED",
  ] as const) {
    assert.strictEqual(
      effectivePrice(p.raw.byCondition, p.topPrice, tier),
      null,
      `${tier} should resolve to null when no anchor exists`,
    );
  }
});

test("picker click simulation: selecting LP on a row flips its displayed price and live total recomputes", () => {
  // Two priced cards. Card 0 has only NM raw ($10), card 1 has full raw data.
  const pricings: CardPricing[] = [
    makePricing(),
    makePricing({
      byCondition: {
        NEAR_MINT: 20,
        LIGHTLY_PLAYED: 18,
        MODERATELY_PLAYED: 14,
        HEAVILY_PLAYED: 9,
        DAMAGED: 6,
      },
      topPriceAmount: 20,
    }),
  ];

  // Initial state: both rows at NM (the UI default when conditions[i] is undefined).
  let conditions: Record<number, RawConditionTier> = {};
  assert.strictEqual(liveTotal(pricings, conditions), 30); // 10 + 20

  // Row 0 displays NM=$10.
  const row0Nm = effectivePrice(
    pricings[0].matched ? pricings[0].raw.byCondition : ({} as ByCondition),
    pricings[0].matched ? pricings[0].topPrice : null,
    conditions[0] ?? "NEAR_MINT",
  );
  assert.deepStrictEqual(row0Nm, { amount: 10, estimated: false });

  // Simulate clicking "LP" on row 0 (the UI calls
  // setConditions((prev) => ({ ...prev, [0]: "LIGHTLY_PLAYED" }))).
  conditions = { ...conditions, 0: "LIGHTLY_PLAYED" };

  const row0Lp = effectivePrice(
    pricings[0].matched ? pricings[0].raw.byCondition : ({} as ByCondition),
    pricings[0].matched ? pricings[0].topPrice : null,
    conditions[0] ?? "NEAR_MINT",
  );
  // Row 0's LP came from estimation (NM=10 * 0.88 = 8.80).
  assert.deepStrictEqual(row0Lp, { amount: 8.8, estimated: true });

  // Live total recomputes: 8.80 (row0 LP estimated) + 20 (row1 still NM) = 28.80
  assert.strictEqual(liveTotal(pricings, conditions), 28.8);

  // Now simulate clicking "MP" on row 1 (real raw value of 14).
  conditions = { ...conditions, 1: "MODERATELY_PLAYED" };

  const row1Mp = effectivePrice(
    pricings[1].matched ? pricings[1].raw.byCondition : ({} as ByCondition),
    pricings[1].matched ? pricings[1].topPrice : null,
    conditions[1] ?? "NEAR_MINT",
  );
  // Row 1's MP came from real data, not an estimate.
  assert.deepStrictEqual(row1Mp, { amount: 14, estimated: false });

  // Live total: 8.80 + 14 = 22.80
  assert.strictEqual(liveTotal(pricings, conditions), 22.8);
});
