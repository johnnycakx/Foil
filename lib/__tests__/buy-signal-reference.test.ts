// Buy-signal reference resolver (ROADMAP #32 / ADR-053). Pins the raw,
// saleCount-weighted 30-day reference + sample size, and that graded slabs are
// excluded by construction (the resolver only walks RAW_POKETRACE_TIERS).

import test from "node:test";
import assert from "node:assert/strict";
import { rawReferenceFromHistory, conditionMatchedReferenceFromHistory } from "../buy-signal/reference.ts";
import type { SoldHistory, SoldStat } from "../poketrace/by-uuid.ts";

function stat(over: Partial<SoldStat>): SoldStat {
  return { avg: null, low: null, high: null, avg1d: null, avg7d: null, avg30d: null, saleCount: null, ...over };
}

function history(tiers: Record<string, SoldStat>): SoldHistory {
  return { uuid: "x", fetchedAt: 0, bySource: { ebay: tiers } };
}

test("rawReferenceFromHistory: saleCount-weighted avg30d across raw tiers", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 30 }),
    LIGHTLY_PLAYED: stat({ avg30d: 60, saleCount: 10 }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h);
  // (100*30 + 60*10) / 40 = 90
  assert.equal(reference, 90);
  assert.equal(sampleSize, 40);
});

test("rawReferenceFromHistory: falls back to avg when avg30d missing", () => {
  const h = history({ NEAR_MINT: stat({ avg: 50, saleCount: 8 }) });
  const { reference, sampleSize } = rawReferenceFromHistory(h);
  assert.equal(reference, 50);
  assert.equal(sampleSize, 8);
});

test("rawReferenceFromHistory: GRADED slabs are excluded from the reference", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 80, saleCount: 12 }),
    PSA_10: stat({ avg30d: 4000, saleCount: 50 }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h);
  assert.equal(reference, 80, "PSA 10 must not pull the raw reference");
  assert.equal(sampleSize, 12, "graded sales must not count toward the raw sample");
});

test("rawReferenceFromHistory: no raw data -> null reference, zero sample", () => {
  assert.deepEqual(rawReferenceFromHistory(null), { reference: null, sampleSize: 0 });
  assert.deepEqual(rawReferenceFromHistory(history({ PSA_9: stat({ avg30d: 900, saleCount: 5 }) })), {
    reference: null,
    sampleSize: 0,
  });
});

test("rawReferenceFromHistory: priced tier with no saleCount still contributes (equal weight)", () => {
  const h = history({
    NEAR_MINT: stat({ avg30d: 100, saleCount: null }),
    LIGHTLY_PLAYED: stat({ avg30d: 200, saleCount: null }),
  });
  const { reference, sampleSize } = rawReferenceFromHistory(h);
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
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "PSA_9");
  assert.equal(r.conditionReference, 3420, "must be the PSA_9 avg, not blended with PSA_10/BGS");
  assert.equal(r.conditionSampleSize, 93);
  assert.equal(r.matchedTier, "PSA_9");
});

test("conditionMatched: GRADED with PSA_10 gradeKey returns PSA_10's $30,100", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "PSA_10");
  assert.equal(r.conditionReference, 30100);
});

test("conditionMatched: GRADED with NO gradeKey -> UNKNOWN (no blended fallback — the #32.3 fix)", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED");
  assert.equal(r.conditionReference, null);
  assert.equal(r.matchedTier, null);
});

test("conditionMatched: GRADED with a grade absent from history -> UNKNOWN", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "GRADED", "CGC_10");
  assert.equal(r.conditionReference, null);
});

test("conditionMatched: raw NM still matches the NM tier exactly + exposes lowestRaw", () => {
  const r = conditionMatchedReferenceFromHistory(gradedHistory(), "NM");
  assert.equal(r.conditionReference, 300);
  assert.equal(r.matchedTier, "NEAR_MINT");
  assert.equal(r.lowestRawReference, 120, "lowestRaw = DAMAGED for the raw outlier guard");
});
