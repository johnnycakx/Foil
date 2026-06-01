// Buy-signal compute tests (ROADMAP #32 / ADR-053). Table-driven: boundaries
// (5/10/15% deltas), small-sample UNKNOWN, condition-tier filtering, empty
// input, single sale, far outliers.

import test from "node:test";
import assert from "node:assert/strict";
import { computeBuySignal, classifyBuySignal, isGradedTier, type Sale } from "../buy-signal/compute.ts";

const NOW = Date.parse("2026-06-01T00:00:00Z");
const day = 24 * 60 * 60 * 1000;
const recent = (n: number) => new Date(NOW - n * day).toISOString();

// 6 raw NM sales with median 100 (98,99,100,100,101,102 -> median 100).
function median100(): Sale[] {
  return [98, 99, 100, 100, 101, 102].map((price, i) => ({
    price,
    soldAt: recent(i + 1),
    conditionTier: "NEAR_MINT",
  }));
}

// --- classifyBuySignal threshold core --------------------------------------

const CASES: { name: string; ask: number; ref: number; n: number; tier: string }[] = [
  { name: "ask 5% below -> AT (within +/-10%)", ask: 95, ref: 100, n: 10, tier: "AT" },
  { name: "ask exactly -10% boundary -> AT (not BELOW)", ask: 90, ref: 100, n: 10, tier: "AT" },
  { name: "ask 15% below -> BELOW", ask: 85, ref: 100, n: 10, tier: "BELOW" },
  { name: "ask 5% above -> AT", ask: 105, ref: 100, n: 10, tier: "AT" },
  { name: "ask exactly +10% boundary -> AT (not ABOVE)", ask: 110, ref: 100, n: 10, tier: "AT" },
  { name: "ask 15% above -> ABOVE", ask: 115, ref: 100, n: 10, tier: "ABOVE" },
  { name: "just under -10% -> BELOW", ask: 89.99, ref: 100, n: 10, tier: "BELOW" },
  { name: "just over +10% -> ABOVE", ask: 110.01, ref: 100, n: 10, tier: "ABOVE" },
];

for (const c of CASES) {
  test(`classify: ${c.name}`, () => {
    assert.equal(classifyBuySignal({ askPrice: c.ask, reference: c.ref, sampleSize: c.n }).tier, c.tier);
  });
}

test("classify: sampleSize below floor (4) -> UNKNOWN", () => {
  assert.equal(classifyBuySignal({ askPrice: 50, reference: 100, sampleSize: 4 }).tier, "UNKNOWN");
});

test("classify: sampleSize at floor (5) -> classified, not UNKNOWN", () => {
  assert.notEqual(classifyBuySignal({ askPrice: 50, reference: 100, sampleSize: 5 }).tier, "UNKNOWN");
});

test("classify: null/zero reference -> UNKNOWN", () => {
  assert.equal(classifyBuySignal({ askPrice: 50, reference: null, sampleSize: 50 }).tier, "UNKNOWN");
  assert.equal(classifyBuySignal({ askPrice: 50, reference: 0, sampleSize: 50 }).tier, "UNKNOWN");
});

test("classify: deltaPercent sign + rounding", () => {
  assert.equal(classifyBuySignal({ askPrice: 85, reference: 100, sampleSize: 10 }).deltaPercent, -15);
  assert.equal(classifyBuySignal({ askPrice: 120, reference: 100, sampleSize: 10 }).deltaPercent, 20);
  assert.equal(classifyBuySignal({ askPrice: 50, reference: 100, sampleSize: 4 }).deltaPercent, null); // UNKNOWN
});

// --- computeBuySignal (median over Sale[]) ----------------------------------

test("compute: median of 6 sales = 100; ask 85 -> BELOW", () => {
  const r = computeBuySignal({ sales: median100(), askPrice: 85, now: NOW });
  assert.equal(r.median, 100);
  assert.equal(r.tier, "BELOW");
  assert.equal(r.sampleSize, 6);
  assert.equal(r.windowDays, 30);
});

test("compute: empty input -> UNKNOWN, sampleSize 0", () => {
  const r = computeBuySignal({ sales: [], askPrice: 100, now: NOW });
  assert.equal(r.tier, "UNKNOWN");
  assert.equal(r.sampleSize, 0);
  assert.equal(r.median, null);
});

test("compute: single sale -> UNKNOWN (below floor of 5)", () => {
  const r = computeBuySignal({ sales: [{ price: 100, soldAt: recent(1), conditionTier: "NEAR_MINT" }], askPrice: 80, now: NOW });
  assert.equal(r.tier, "UNKNOWN");
  assert.equal(r.sampleSize, 1);
});

test("compute: condition-tier filter excludes graded slabs from a raw comparison", () => {
  const sales: Sale[] = [
    ...median100(), // 6 raw NM around 100
    { price: 900, soldAt: recent(2), conditionTier: "PSA_10" },
    { price: 850, soldAt: recent(3), conditionTier: "PSA_9" },
  ];
  const r = computeBuySignal({ sales, askPrice: 102, now: NOW });
  assert.equal(r.sampleSize, 6, "graded slabs must be excluded");
  assert.equal(r.median, 100, "median unaffected by the $900 graded slabs");
  assert.equal(r.tier, "AT");
});

test("compute: sales outside the 30d window are excluded", () => {
  const sales: Sale[] = [
    ...median100(),
    { price: 5, soldAt: recent(45), conditionTier: "NEAR_MINT" }, // 45d ago -> dropped
    { price: 5, soldAt: recent(60), conditionTier: "NEAR_MINT" },
  ];
  const r = computeBuySignal({ sales, askPrice: 100, now: NOW });
  assert.equal(r.sampleSize, 6, "old sales excluded");
  assert.equal(r.median, 100, "old cheap sales don't drag the median");
});

test("compute: far outliers shift the median far less than a mean", () => {
  // 5 sales at 100 + one 10000 outlier -> median stays 100 (mean would be ~1750).
  const sales: Sale[] = [100, 100, 100, 100, 100, 10000].map((price, i) => ({
    price,
    soldAt: recent(i + 1),
    conditionTier: "NEAR_MINT",
  }));
  const r = computeBuySignal({ sales, askPrice: 100, now: NOW });
  assert.equal(r.median, 100, "median resists the outlier");
  assert.equal(r.tier, "AT");
});

test("isGradedTier recognizes slabs but not raw tiers", () => {
  for (const g of ["PSA_10", "PSA 9", "BGS_9.5", "CGC_10", "SGC_10"]) assert.ok(isGradedTier(g), g);
  for (const r of ["NEAR_MINT", "LIGHTLY_PLAYED", "MODERATELY_PLAYED", "DAMAGED"]) assert.ok(!isGradedTier(r), r);
});
