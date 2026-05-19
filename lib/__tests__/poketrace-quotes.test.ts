// Regression tests for quotesFromPokeTrace. The pre-ba35a63 code had a
// fallback ladder (NEAR_MINT → AGGREGATED → MARKET) that goal F accidentally
// dropped, producing 0 priced on a real upload that previously priced 3.
// These tests pin the fallback so the regression can't return.

import test from "node:test";
import assert from "node:assert/strict";
import { quotesFromPokeTrace } from "../poketrace.ts";

// Minimal PokeTraceCard shape — just enough to exercise quotesFromPokeTrace.
// We import the full type from poketrace.ts for accuracy.
import type { PokeTraceCard } from "../poketrace.ts";

function makeCard(prices: PokeTraceCard["prices"]): PokeTraceCard {
  return {
    id: "fake-id",
    name: "Fake Card",
    cardNumber: "001/100",
    set: { slug: "fake-set", name: "Fake Set" },
    variant: "Normal",
    rarity: "Common",
    productType: "card",
    productFamily: "pokemon",
    image: null,
    game: "pokemon",
    market: "US",
    currency: "USD",
    refs: { tcgplayerId: null, cardmarketId: null },
    prices,
  };
}

function snap(avg: number) {
  return { avg, low: null, high: null, saleCount: null, lastUpdated: null };
}

test("quotesFromPokeTrace: AGGREGATED-only card yields a RAW_UNGRADED quote (the load-bearing fallback)", () => {
  // Modern-set bulk: PokeTrace returns AGGREGATED with no per-source NEAR_MINT.
  // Pre-ba35a63 this would have been priced via the topRawPrice fallback.
  // After ba35a63 it was silently dropped → 0 priced regression on real uploads.
  const card = makeCard({
    tcgplayer: { AGGREGATED: snap(2.5) },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");

  assert.ok(ungraded.length > 0, "AGGREGATED-only card must produce at least one RAW_UNGRADED quote");
  assert.strictEqual(ungraded[0].amount, 2.5);
  assert.strictEqual(ungraded[0].source, "tcgplayer");
});

test("quotesFromPokeTrace: MARKET tier also falls back to RAW_UNGRADED", () => {
  const card = makeCard({
    ebay: { MARKET: snap(4.99) },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");

  assert.strictEqual(ungraded.length, 1);
  assert.strictEqual(ungraded[0].amount, 4.99);
  assert.strictEqual(ungraded[0].source, "ebay");
});

test("quotesFromPokeTrace: NEAR_MINT preferred over AGGREGATED when both exist (no double-counting per source)", () => {
  // When both are present for the same source, we want NEAR_MINT (per-condition,
  // more precise) — not BOTH emitted as RAW_UNGRADED competing for bestUngraded.
  const card = makeCard({
    tcgplayer: {
      NEAR_MINT: snap(10.0),
      AGGREGATED: snap(8.5),   // should be ignored — NM wins
    },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungradedTcg = quotes.filter((q) => q.tier === "RAW_UNGRADED" && q.source === "tcgplayer");

  assert.strictEqual(ungradedTcg.length, 1, "exactly one ungraded quote per source");
  assert.strictEqual(ungradedTcg[0].amount, 10.0, "NEAR_MINT must win over AGGREGATED");
});

test("quotesFromPokeTrace: AGGREGATED preferred over MARKET when both exist", () => {
  const card = makeCard({
    cardmarket: {
      AGGREGATED: snap(7.5),
      MARKET: snap(6.25),  // last resort
    },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");

  assert.strictEqual(ungraded.length, 1);
  assert.strictEqual(ungraded[0].amount, 7.5);
});

test("quotesFromPokeTrace: each source independently falls back", () => {
  // Mixed sources, mixed fallback states. Should yield 3 ungraded quotes — one per source.
  const card = makeCard({
    ebay: { NEAR_MINT: snap(12.0) },           // NM hit
    tcgplayer: { AGGREGATED: snap(11.0) },     // AGG fallback
    cardmarket: { MARKET: snap(10.0) },        // MARKET fallback
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");

  assert.strictEqual(ungraded.length, 3, "one ungraded quote per source");
  const bySource = new Map(ungraded.map((q) => [q.source, q.amount]));
  assert.strictEqual(bySource.get("ebay"), 12.0);
  assert.strictEqual(bySource.get("tcgplayer"), 11.0);
  assert.strictEqual(bySource.get("cardmarket"), 10.0);
});

test("quotesFromPokeTrace: graded tiers still emit alongside ungraded fallback", () => {
  const card = makeCard({
    tcgplayer: {
      AGGREGATED: snap(2.5),
      PSA_10: snap(85.0),
      BGS_10: snap(120.0),
    },
  });

  const quotes = quotesFromPokeTrace(card);
  const tiers = quotes.map((q) => q.tier).sort();

  assert.deepStrictEqual(tiers, ["BGS_10", "PSA_10", "RAW_UNGRADED"]);
});

test("quotesFromPokeTrace: zero / null prices are skipped", () => {
  // PokeTrace returns 0 for missing data on some endpoints — must NOT emit.
  const card = makeCard({
    tcgplayer: {
      NEAR_MINT: snap(0),
      AGGREGATED: snap(0),
      MARKET: snap(2.0),  // only this should emit
    },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");

  assert.strictEqual(ungraded.length, 1);
  assert.strictEqual(ungraded[0].amount, 2.0);
});

test("quotesFromPokeTrace: card with only graded data + no ungraded yields graded quotes (no synthetic ungraded)", () => {
  // Edge case: a card with only PSA prices on PokeTrace's side. Should NOT
  // synthesize an ungraded quote from graded data — that would be fabrication.
  const card = makeCard({
    ebay: { PSA_10: snap(450.0), PSA_9: snap(180.0) },
  });

  const quotes = quotesFromPokeTrace(card);
  const ungraded = quotes.filter((q) => q.tier === "RAW_UNGRADED");
  const graded = quotes.filter((q) => q.tier !== "RAW_UNGRADED");

  assert.strictEqual(ungraded.length, 0, "no ungraded quotes when no ungraded source data exists");
  assert.strictEqual(graded.length, 2, "graded quotes still emit");
});
