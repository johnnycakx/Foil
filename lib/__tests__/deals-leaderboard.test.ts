// Tests for the deals leaderboard ranking/filter (ROADMAP B.4 / ADR-054).

import test from "node:test";
import assert from "node:assert/strict";
import { rankDeals, latestComputedAt, toDealRow, type DealRow } from "../deals/leaderboard.ts";
import { BUY_SIGNAL_MIN_SAMPLE } from "../buy-signal/compute.ts";

function row(over: Partial<DealRow>): DealRow {
  return {
    cardSlug: "base1-4-charizard",
    cardName: "Charizard",
    setName: "Base Set",
    imageUrl: "https://img/x.png",
    signal: "BELOW",
    deltaPct: -20,
    soldReference: 100,
    soldSampleSize: 10,
    matchedTier: "NEAR_MINT",
    computedAt: "2026-06-05T08:00:00.000Z",
    ...over,
  };
}

test("rankDeals: keeps only confident BELOW rows", () => {
  const rows = [
    row({ cardSlug: "a", signal: "BELOW", deltaPct: -15 }),
    row({ cardSlug: "b", signal: "AT", deltaPct: 1 }),
    row({ cardSlug: "c", signal: "ABOVE", deltaPct: 20 }),
    row({ cardSlug: "d", signal: "UNKNOWN", deltaPct: null }),
  ];
  const out = rankDeals(rows);
  assert.deepEqual(out.map((r) => r.cardSlug), ["a"]);
});

test("rankDeals: drops thin-sample rows below the buy-signal floor", () => {
  const rows = [
    row({ cardSlug: "ok", soldSampleSize: BUY_SIGNAL_MIN_SAMPLE }),
    row({ cardSlug: "thin", soldSampleSize: BUY_SIGNAL_MIN_SAMPLE - 1 }),
  ];
  assert.deepEqual(rankDeals(rows).map((r) => r.cardSlug), ["ok"]);
});

test("rankDeals: drops rows with a non-negative or missing delta, or no reference", () => {
  const rows = [
    row({ cardSlug: "pos", deltaPct: 5 }), // BELOW but delta not negative (shouldn't happen, guard anyway)
    row({ cardSlug: "nulldelta", deltaPct: null }),
    row({ cardSlug: "noref", soldReference: null }),
    row({ cardSlug: "zeroref", soldReference: 0 }),
    row({ cardSlug: "good", deltaPct: -10 }),
  ];
  assert.deepEqual(rankDeals(rows).map((r) => r.cardSlug), ["good"]);
});

test("rankDeals: sorts most-below first (most-negative delta)", () => {
  const rows = [
    row({ cardSlug: "small", deltaPct: -8 }),
    row({ cardSlug: "big", deltaPct: -42 }),
    row({ cardSlug: "mid", deltaPct: -20 }),
  ];
  assert.deepEqual(rankDeals(rows).map((r) => r.cardSlug), ["big", "mid", "small"]);
});

test("rankDeals: respects the limit", () => {
  const rows = Array.from({ length: 30 }, (_, i) => row({ cardSlug: `c${i}`, deltaPct: -(i + 1) }));
  assert.equal(rankDeals(rows, 12).length, 12);
});

test("latestComputedAt: returns the max ISO timestamp, null when empty", () => {
  assert.equal(latestComputedAt([]), null);
  const out = latestComputedAt([
    row({ computedAt: "2026-06-04T08:00:00.000Z" }),
    row({ computedAt: "2026-06-05T08:00:00.000Z" }),
    row({ computedAt: "2026-06-03T08:00:00.000Z" }),
  ]);
  assert.equal(out, "2026-06-05T08:00:00.000Z");
});

test("toDealRow: maps DB shape + null-safes the optional numerics", () => {
  const out = toDealRow({
    card_slug: "base1-4-charizard",
    card_name: "Charizard",
    set_name: "Base Set",
    image_url: null,
    signal: "BELOW",
    delta_pct: -23.4,
    sold_reference: 350,
    sold_sample_size: null,
    matched_tier: "NEAR_MINT",
    computed_at: "2026-06-05T08:00:00.000Z",
  });
  assert.equal(out.imageUrl, "");
  assert.equal(out.soldSampleSize, 0);
  assert.equal(out.deltaPct, -23.4);
  assert.equal(out.soldReference, 350);
});
