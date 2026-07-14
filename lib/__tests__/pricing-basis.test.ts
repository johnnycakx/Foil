// The BRAND INVARIANT, pinned (pricing-bridge / ADR-118).
//
// "Foil doesn't guess prices. It reads real sales."
//
// The failure mode this guards is not a crash — it's a silent lie: a TCGplayer
// LISTED (asking-price) number rendered under a SOLD label. That pressure is
// highest exactly when the sold spine goes dark (R-070, the PokeTrace lapse),
// which is when someone will be tempted to backfill the hero with "some price."
// These pins are what stop that from ever shipping quietly.

import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSoldBasis,
  basisMatchesSource,
  isListedBasis,
  isSoldBasis,
  LISTED_LABEL,
  SOURCE_BASIS,
  type SourcedPrice,
} from "../pricing/basis.ts";

const soldPrice: SourcedPrice = {
  source: "ebay",
  basis: "sold",
  amount: 2285.45,
  lastUpdated: "2026-07-13T00:00:00.000Z",
};
const listedPrice: SourcedPrice = {
  source: "tcgplayer",
  basis: "listed",
  amount: 225.61,
  lastUpdated: "2026-07-01T00:00:00.000Z",
};
const guidePrice: SourcedPrice = {
  source: "pricecharting",
  basis: "guide",
  amount: 2105,
  lastUpdated: "2026-07-10T00:00:00.000Z",
};

test("THE INVARIANT: a sold-labeled surface can never receive a non-sold-basis price", () => {
  // The sold surface accepts a sold price.
  assert.doesNotThrow(() => assertSoldBasis(soldPrice, "card-page hero"));

  // It REFUSES a listed price — loudly. This is the lie we refuse to author.
  assert.throws(
    () => assertSoldBasis(listedPrice, "card-page hero"),
    /BASIS VIOLATION.*sold-labeled surface.*"listed"-basis/s,
    "a LISTED price must never pass a sold-basis gate",
  );

  // And a guide price (PriceCharting — display barred by ToS anyway, R-072).
  assert.throws(
    () => assertSoldBasis(guidePrice, "card-page hero"),
    /BASIS VIOLATION/,
    "a GUIDE price must never pass a sold-basis gate",
  );
});

test("basis narrowing: isSoldBasis / isListedBasis discriminate correctly", () => {
  assert.equal(isSoldBasis(soldPrice), true);
  assert.equal(isSoldBasis(listedPrice), false);
  assert.equal(isSoldBasis(guidePrice), false);
  assert.equal(isListedBasis(listedPrice), true);
  assert.equal(isListedBasis(soldPrice), false);
});

test("each source's declared basis matches what its numbers actually measure", () => {
  // TCGplayer is an asking-price index, NOT sold comps — the single most
  // important row here. If someone ever "fixes" this to "sold", the whole
  // honesty architecture silently collapses.
  assert.equal(SOURCE_BASIS.tcgplayer, "listed");
  assert.equal(SOURCE_BASIS.ebay, "sold");
  assert.equal(SOURCE_BASIS.pricecharting, "guide");
});

test("a self-mislabeled quote is detectable (tcgplayer can't call itself sold)", () => {
  const liar: SourcedPrice = { source: "tcgplayer", basis: "sold", amount: 100, lastUpdated: null };
  assert.equal(basisMatchesSource(liar), false, "tcgplayer claiming sold basis must not validate");
  assert.equal(basisMatchesSource(soldPrice), true);
  assert.equal(basisMatchesSource(listedPrice), true);
});

test("the listed label is the ADR-110 register, as one primitive (not per-component prose)", () => {
  assert.match(LISTED_LABEL, /listed/i);
  assert.match(LISTED_LABEL, /may lag/i);
  assert.ok(!/sold/i.test(LISTED_LABEL), "the listed label must never contain the word sold");
});
