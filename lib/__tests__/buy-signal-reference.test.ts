// Buy-signal reference resolver (ROADMAP #32 / ADR-053). Pins the raw,
// saleCount-weighted 30-day reference + sample size, that graded slabs are
// excluded by construction (the resolver only walks RAW_POKETRACE_TIERS), and
// — since the sold-data-integrity goal (2026-07-03, xy4-122 incident) — that
// ONLY FRESH windowed tiers feed a reference: PokeTrace's avg30d is anchored
// to the tier's lastUpdated, not to today, so a tier whose last sale was
// months ago must resolve to UNKNOWN, never to a stale number.

import test from "node:test";
import assert from "node:assert/strict";
import { rawReferenceFromHistory, conditionMatchedReferenceFromHistory } from "../buy-signal/reference.ts";
import type { SoldHistory, SoldStat } from "../poketrace/by-uuid.ts";

// Deterministic clock: "today" for every freshness judgment in this file.
const NOW = Date.parse("2026-07-03T00:00:00Z");
const FRESH = "2026-06-25T00:00:00.000Z"; // 8 days old — inside the window
const STALE = "2026-01-30T00:00:00.000Z"; // the xy4-122 HEAVILY_PLAYED case

function stat(over: Partial<SoldStat>): SoldStat {
  return {
    avg: null,
    low: null,
    high: null,
    avg1d: null,
    avg7d: null,
    avg30d: null,
    median7d: null,
    median30d: null,
    saleCount: null,
    lastUpdated: FRESH,
    approxSaleCount: false,
    ...over,
  };
}

function history(tiers: Record<string, SoldStat>): SoldHistory {
  return { uuid: "x", fetchedAt: 0, bySource: { ebay: tiers } };
}

test("rawReferenceFromHistory: saleCount-weighted avg30d across fresh raw tiers", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 30 }),
    LIGHTLY_PLAYED: stat({ avg30d: 60, saleCount: 10 }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  // (100*30 + 60*10) / 40 = 90
  assert.equal(reference, 90);
  assert.equal(sampleSize, 40);
});

test("rawReferenceFromHistory: NEVER falls back to `avg` (the last-sale price) — no window, no reference", () => {
  // Pre-fix behavior rendered avg (the single most recent sale) as a 30-day
  // reference. That fallback is dead: a tier with no windowed value is not a
  // basis, even when fresh.
  const h = history({ NEAR_MINT: stat({ avg: 50, saleCount: 8 }) });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  assert.equal(reference, null);
  assert.equal(sampleSize, 0);
});

test("rawReferenceFromHistory: median30d backs the window when avg30d is null (single-sale windows)", () => {
  const h = history({ NEAR_MINT: stat({ median30d: 564.73, saleCount: 12 }) });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  assert.equal(reference, 564.73);
  assert.equal(sampleSize, 12);
});

test("rawReferenceFromHistory: STALE tiers contribute nothing (value OR sample) — the xy4-122 class", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 30 }),
    // LP's avg30d describes a window that ended in January — not a current basis.
    LIGHTLY_PLAYED: stat({ avg30d: 60, saleCount: 10, lastUpdated: STALE }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  assert.equal(reference, 100, "stale LP must not pull the reference");
  assert.equal(sampleSize, 30, "stale LP sales must not inflate the sample");
});

test("rawReferenceFromHistory: GRADED slabs are excluded from the reference", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 80, saleCount: 12 }),
    PSA_10: stat({ avg30d: 4000, saleCount: 50 }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  assert.equal(reference, 80, "PSA 10 must not pull the raw reference");
  assert.equal(sampleSize, 12, "graded sales must not count toward the raw sample");
});

test("rawReferenceFromHistory: no raw data -> null reference, zero sample", () => {
  assert.deepEqual(rawReferenceFromHistory(null, NOW), { reference: null, sampleSize: 0 });
  assert.deepEqual(rawReferenceFromHistory(history({ PSA_9: stat({ avg30d: 900, saleCount: 5 }) }), NOW), {
    reference: null,
    sampleSize: 0,
  });
});

test("rawReferenceFromHistory: priced tier with no saleCount still contributes (equal weight)", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 100, saleCount: null }),
    LIGHTLY_PLAYED: stat({ avg30d: 200, saleCount: null }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h, NOW);
  assert.equal(reference, 150, "equal-weight mean when no counts present");
  assert.equal(sampleSize, 0);
});

// --- #32.3: grade-specific graded reference (no blended fallback) ---

const gradedHistory = () =>
  history({
    NEAR_MINT: stat({ avg30d: 300, saleCount: 20 }),
    DAMAGED: stat({ avg30d: 120, saleCount: 5 }),
    PSA_9: stat({ avg30d: 3420, saleCount: 93 }),
    PSA_10: stat({ avg30d: 30100, saleCount: 35 }),
    BGS_9_5: stat({ avg30d: 5179, saleCount: 24 }),
  });

test("conditionMatched: GRADED with gradeKey PSA_9 returns PSA_9 ONLY (not a PSA-10 blend)", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "PSA_9", NOW);
  assert.equal(r.conditionReference, 3420, "must be the PSA_9 avg, not blended with PSA_10/BGS");
  assert.equal(r.conditionSampleSize, 93);
  assert.equal(r.matchedTier, "PSA_9");
});

test("conditionMatched: GRADED with PSA_10 gradeKey returns PSA_10's $30,100", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "PSA_10", NOW);
  assert.equal(r.conditionReference, 30100);
});

test("conditionMatched: GRADED with NO gradeKey -> UNKNOWN (no blended fallback — the #32.3 fix)", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", undefined, NOW);
  assert.equal(r.conditionReference, null);
  assert.equal(r.matchedTier, null);
});

test("conditionMatched: GRADED with a grade absent from history -> UNKNOWN", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "CGC_10", NOW);
  assert.equal(r.conditionReference, null);
});

test("conditionMatched: a STALE grade tier -> UNKNOWN (the $24,500 April PSA 10 class)", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 300, saleCount: 20 }),
    PSA_10: stat({ avg30d: 24500, saleCount: 5, lastUpdated: "2026-04-15T00:00:00.000Z" }),
  });
  const r = conditionMatchedReferenceFromHistory(h, "GRADED", "PSA_10", NOW);
  assert.equal(r.conditionReference, null, "a months-old graded window is not a current basis");
});

test("conditionMatched: raw NM still matches the NM tier exactly + exposes lowestRaw", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "NM", undefined, NOW);
  assert.equal(r.conditionReference, 300);
  assert.equal(r.matchedTier, "NEAR_MINT");
  assert.equal(r.lowestRawReference, 120, "lowestRaw = DAMAGED for the raw outlier guard");
});

test("conditionMatched: a stale raw tier is excluded from lowestRaw (no stale floor)", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 300, saleCount: 20 }),
    HEAVILY_PLAYED: stat({ avg30d: 128, saleCount: 1, lastUpdated: STALE }),
  });
  const r = conditionMatchedReferenceFromHistory(h, "NM", undefined, NOW);
  assert.equal(r.lowestRawReference, 300, "January's lone HP sale must not set the outlier floor");
});
