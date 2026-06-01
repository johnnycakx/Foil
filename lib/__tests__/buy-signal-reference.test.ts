// Buy-signal reference resolver (ROADMAP #32 / ADR-053). Pins the raw,
// saleCount-weighted 30-day reference + sample size, and that graded slabs are
// excluded by construction (the resolver only walks RAW_POKETRACE_TIERS).

import test from "node:test";
import assert from "node:assert/strict";
import { rawReferenceFromHistory } from "../buy-signal/reference.ts";
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
