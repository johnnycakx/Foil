// Buy-signal compute tests (ROADMAP #32 / ADR-053). Table-driven: boundaries
// (5/10/15% deltas), small-sample UNKNOWN, condition-tier filtering, empty
// input, single sale, far outliers.

import test from "node:test";
import assert from "node:assert/strict";
import { computeBuySignal, classifyBuySignal, classifyConditionMatched, isGradedTier, OUTLIER_FLOOR_FRACTION, type Sale } from "../buy-signal/compute.ts";

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

// --- Condition-matched classifier + outlier guard (ROADMAP #32.1 / I-009) ---

test("classifyConditionMatched: UNKNOWN listing tier -> UNKNOWN with a reason (the I-009 fix)", () => {
  // The exact production failure: cheapest ask vs NM reference, but the listing
  // condition is unknown. Old code said BELOW; new code refuses.
  const sig = classifyConditionMatched({
    askPrice: 43,
    listingTier: "UNKNOWN",
    conditionReference: 374,
    conditionSampleSize: 168,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "UNKNOWN");
  assert.match(sig.reason ?? "", /could not be determined/);
});

test("classifyConditionMatched: no sold data for the matched tier -> UNKNOWN", () => {
  const sig = classifyConditionMatched({
    askPrice: 80,
    listingTier: "MP",
    conditionReference: null,
    conditionSampleSize: 0,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "UNKNOWN");
  assert.match(sig.reason ?? "", /no 30-day sold data for the MP/);
});

test("classifyConditionMatched: outlier guard fires below half the lowest raw tier", () => {
  // $43 ask, lowest raw (DMG) sold avg $150 -> floor is $75 -> $43 < $75 -> UNKNOWN.
  const sig = classifyConditionMatched({
    askPrice: 43,
    listingTier: "NM",
    conditionReference: 374,
    conditionSampleSize: 168,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "UNKNOWN");
  assert.match(sig.reason ?? "", /implausible outlier/);
});

test("classifyConditionMatched: just ABOVE the outlier floor still classifies", () => {
  // floor = 150 * 0.5 = 75; ask 76 is above the floor and < NM ref*0.9 -> BELOW.
  const sig = classifyConditionMatched({
    askPrice: 76,
    listingTier: "DMG",
    conditionReference: 150,
    conditionSampleSize: 12,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "BELOW");
  assert.equal(sig.reason, undefined);
  assert.equal(OUTLIER_FLOOR_FRACTION, 0.5);
});

test("classifyConditionMatched: condition-matched happy path (NM ask vs NM ref -> AT)", () => {
  const sig = classifyConditionMatched({
    askPrice: 360,
    listingTier: "NM",
    conditionReference: 374,
    conditionSampleSize: 168,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "AT");
  assert.equal(sig.median, 374);
});

test("classifyConditionMatched: graded ask vs graded reference -> real tier (BELOW)", () => {
  // A PSA-10 listing compared against the graded sold avg, well above the raw floor.
  const sig = classifyConditionMatched({
    askPrice: 3000,
    listingTier: "GRADED",
    conditionReference: 4000,
    conditionSampleSize: 50,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "BELOW");
  assert.ok((sig.deltaPercent ?? 0) < 0);
});

test("classifyConditionMatched: matched LP ask reads AT against LP ref (not BELOW vs NM)", () => {
  // The crux of I-009: a $90 LP ask is AT the $92 LP sold avg — NOT a -76% BELOW
  // it would have flashed against the $374 NM-weighted average.
  const sig = classifyConditionMatched({
    askPrice: 90,
    listingTier: "LP",
    conditionReference: 92,
    conditionSampleSize: 20,
    lowestRawReference: 60,
  });
  assert.equal(sig.tier, "AT");
});

test("classifyConditionMatched: thin matched sample (<5) still yields UNKNOWN via the core", () => {
  const sig = classifyConditionMatched({
    askPrice: 80,
    listingTier: "MP",
    conditionReference: 100,
    conditionSampleSize: 3,
    lowestRawReference: 60,
  });
  assert.equal(sig.tier, "UNKNOWN");
});

// --- #32.3: grade-specific graded path + graded outlier guard ---

test("classifyConditionMatched: graded outlier fires on its OWN grade reference (PSA-9 ask < 50% PSA-9 avg)", () => {
  // The #32.3 graded gap: a $1,000 ask vs the PSA-9 sold avg $3,420 is below
  // half ($1,710) -> UNKNOWN (mislabeled/junk slab), not a -71% BELOW. The raw
  // lowestRawReference is irrelevant on the graded path.
  const sig = classifyConditionMatched({
    askPrice: 1000,
    listingTier: "GRADED",
    conditionReference: 3420,
    conditionSampleSize: 93,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "UNKNOWN");
  assert.match(sig.reason ?? "", /matched grade/);
});

test("classifyConditionMatched: graded happy path — PSA-9 ask vs PSA-9 avg -> AT (not BELOW vs a PSA-10 blend)", () => {
  // The crux of #32.3: $3,400 PSA-9 ask reads AT the $3,420 PSA-9 sold avg.
  // Against the old blended graded aggregate (~$2,672, PSA-10-inflated... and
  // for Charizard far higher) it would have flashed a large false signal.
  const sig = classifyConditionMatched({
    askPrice: 3400,
    listingTier: "GRADED",
    conditionReference: 3420,
    conditionSampleSize: 93,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "AT");
});

test("classifyConditionMatched: graded ask just above the outlier floor still classifies (BELOW)", () => {
  // floor = 3420 * 0.5 = 1710; ask 1720 > floor and < 3420*0.9 -> BELOW (~-49.7%).
  const sig = classifyConditionMatched({
    askPrice: 1720,
    listingTier: "GRADED",
    conditionReference: 3420,
    conditionSampleSize: 93,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "BELOW");
  assert.ok((sig.deltaPercent ?? 0) >= -50);
});

test("classifyConditionMatched: graded ask with no matched-grade data -> UNKNOWN (no blended fallback)", () => {
  const sig = classifyConditionMatched({
    askPrice: 800,
    listingTier: "GRADED",
    conditionReference: null,
    conditionSampleSize: 0,
    lowestRawReference: 150,
  });
  assert.equal(sig.tier, "UNKNOWN");
  assert.match(sig.reason ?? "", /no 30-day sold data for the GRADED/);
});
