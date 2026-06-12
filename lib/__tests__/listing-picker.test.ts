// Tests for the quality-aware listing picker. See ADR-026.
//
// R-010 anchor: every assertion that pins picker behaviour against junk
// listings derives from a production-observed pattern (the Session-36
// Venusaur ex 151 wishlist email is the canonical case). Fixtures live in
// `lib/__fixtures__/ebay-listings/`. Each fixture's `_observed` field cites
// the original case it derives from. Tests that operate on synthetic data
// are explicitly limited to edge-case math (empty/single-hit, median).
//
// Test plan:
//   1. medianPrice — odd/even arrays, empty.
//   2. rejectPriceOutliers — outlier ratio, absolute floor, single-hit
//      shortcut.
//   3. rejectTitleJunk — each keyword from TITLE_JUNK_KEYWORDS individually,
//      multi-Pokemon mention cap, false-positive guard on legitimate names.
//   4. rejectConditionJunk — each keyword individually, HP-stat false-
//      positive guard.
//   5. pickBestListing — full pipeline against the 5 production fixtures
//      in every meaningful combination.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ABSOLUTE_PRICE_FLOOR,
  CONDITION_JUNK_KEYWORDS,
  HP_HEAVILY_PLAYED_PATTERN,
  OUTLIER_RATIO,
  POKEMON_MENTION_CAP,
  TITLE_JUNK_KEYWORDS,
  medianPrice,
  pickBestListing,
  rejectConditionJunk,
  rejectPriceOutliers,
  rejectTitleJunk,
} from "../affiliate/listing-picker.ts";
import type { EpnProductHit } from "../affiliate/epn.ts";

// ---------------------------------------------------------------------------
// Fixture loader. Strips the `_observed` documentation field; the picker
// only consumes the EpnProductHit fields.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = new URL("../__fixtures__/ebay-listings/", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

function loadFixture(filename: string): EpnProductHit {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, filename), "utf8")) as {
    title: string;
    itemUrl: string;
    image: string | null;
    price: number;
    currency: string;
  };
  return {
    title: raw.title,
    itemUrl: raw.itemUrl,
    image: raw.image,
    price: raw.price,
    currency: raw.currency,
  };
}

function loadAllFixtures(): Record<string, EpnProductHit> {
  const out: Record<string, EpnProductHit> = {};
  for (const f of readdirSync(FIXTURE_DIR).sort()) {
    if (f.endsWith(".json")) out[f] = loadFixture(f);
  }
  return out;
}

const FIXTURES = loadAllFixtures();
const VENUSAUR_KEYWORD_STUFFED = FIXTURES["01-venusaur-ex-keyword-stuffed.json"];
const CHARIZARD_DAMAGED = FIXTURES["02-charizard-damaged.json"];
const CHARIZARD_CREDIBLE_NM = FIXTURES["03-charizard-credible-nm.json"];
const LOT_LISTING = FIXTURES["04-lot-listing.json"];
const GRADED_SLAB = FIXTURES["05-graded-slab.json"];

// Sanity: confirm all expected fixtures loaded.
test("fixture loader: all 5 production-anchored fixtures present", () => {
  assert.ok(VENUSAUR_KEYWORD_STUFFED, "fixture 01 missing");
  assert.ok(CHARIZARD_DAMAGED, "fixture 02 missing");
  assert.ok(CHARIZARD_CREDIBLE_NM, "fixture 03 missing");
  assert.ok(LOT_LISTING, "fixture 04 missing");
  assert.ok(GRADED_SLAB, "fixture 05 missing");
});

// ---------------------------------------------------------------------------
// medianPrice
// ---------------------------------------------------------------------------

test("medianPrice: empty array → 0", () => {
  assert.equal(medianPrice([]), 0);
});

test("medianPrice: odd-length array → middle value", () => {
  assert.equal(medianPrice([10, 30, 20]), 20);
  assert.equal(medianPrice([100]), 100);
});

test("medianPrice: even-length array → mean of the two middle values", () => {
  assert.equal(medianPrice([10, 20, 30, 40]), 25);
  assert.equal(medianPrice([1, 100]), 50.5);
});

test("medianPrice: insensitive to input ordering (sorts internally)", () => {
  assert.equal(medianPrice([5, 1, 9, 3, 7]), medianPrice([1, 3, 5, 7, 9]));
});

// ---------------------------------------------------------------------------
// rejectPriceOutliers
// ---------------------------------------------------------------------------

function synthHit(price: number, title = "Charizard NM"): EpnProductHit {
  return { title, itemUrl: `https://www.ebay.com/itm/${price}`, image: null, price, currency: "USD" };
}

test("rejectPriceOutliers: empty → empty", () => {
  assert.deepEqual(rejectPriceOutliers([]), []);
});

test("rejectPriceOutliers: single hit at/above absolute floor passes through", () => {
  const result = rejectPriceOutliers([synthHit(ABSOLUTE_PRICE_FLOOR)]);
  assert.equal(result.length, 1);
});

test("rejectPriceOutliers: single hit below absolute floor → empty", () => {
  const result = rejectPriceOutliers([synthHit(ABSOLUTE_PRICE_FLOOR - 0.01)]);
  assert.deepEqual(result, []);
});

test("rejectPriceOutliers: drops hits below median * OUTLIER_RATIO", () => {
  // Median of [40, 50, 60, 70, 80] is 60. Threshold = max(60 * 0.30, $3) = $18.
  const hits = [synthHit(40), synthHit(50), synthHit(60), synthHit(70), synthHit(80), synthHit(2)];
  const result = rejectPriceOutliers(hits);
  assert.deepEqual(
    result.map((h) => h.price).sort((a, b) => a - b),
    [40, 50, 60, 70, 80],
  );
});

test("rejectPriceOutliers: $1.75 Venusaur drops out when bundled with credible hits", () => {
  // The production case: $1.75 alongside reasonable Venusaur-ex prices.
  const credible1 = synthHit(45);
  const credible2 = synthHit(62);
  const credible3 = synthHit(78);
  const result = rejectPriceOutliers([VENUSAUR_KEYWORD_STUFFED, credible1, credible2, credible3]);
  assert.ok(!result.includes(VENUSAUR_KEYWORD_STUFFED), "$1.75 should be rejected as outlier");
  assert.equal(result.length, 3);
});

test("rejectPriceOutliers: absolute floor catches herd-of-junk medians", () => {
  // All hits are junk-priced: median is $2, which makes 30%-of-median tiny
  // ($0.60). Without the absolute floor every junk listing would pass.
  const junk = [synthHit(1.75), synthHit(1.99), synthHit(2.25)];
  const result = rejectPriceOutliers(junk);
  assert.deepEqual(result, [], "all sub-floor hits should drop even with low median");
});

// ---------------------------------------------------------------------------
// rejectTitleJunk
// ---------------------------------------------------------------------------

test("rejectTitleJunk: each TITLE_JUNK_KEYWORD individually rejects", () => {
  for (const kw of TITLE_JUNK_KEYWORDS) {
    const hit = synthHit(50, `Charizard Base Set ${kw}`);
    const result = rejectTitleJunk([hit]);
    assert.deepEqual(result, [], `keyword '${kw}' should reject`);
  }
});

test("rejectTitleJunk: case-insensitive on title-junk keywords", () => {
  const hit = synthHit(50, "Charizard Base Set CUSTOM holographic");
  assert.deepEqual(rejectTitleJunk([hit]), []);
});

test("rejectTitleJunk: rejects >1 'pokemon' mention in title (multi-card signal)", () => {
  const hit = synthHit(50, "Pokemon Card Charizard Pikachu Mewtwo Pokemon TCG Pokemon");
  assert.deepEqual(rejectTitleJunk([hit]), []);
});

test("rejectTitleJunk: handles Pokémon (with diacritic) for the mention cap", () => {
  const hit = synthHit(50, "Pokémon Card Charizard Pokémon TCG Pokémon Vintage");
  assert.deepEqual(rejectTitleJunk([hit]), []);
});

test("rejectTitleJunk: single 'pokemon' mention is fine", () => {
  const hit = synthHit(50, "Charizard Base Set Pokemon Card 1999 Holo");
  assert.equal(rejectTitleJunk([hit]).length, 1);
});

test("rejectTitleJunk: passes through the legitimate fixtures", () => {
  const ok = rejectTitleJunk([CHARIZARD_DAMAGED, CHARIZARD_CREDIBLE_NM, GRADED_SLAB]);
  // CHARIZARD_DAMAGED has no title-junk keywords (its junk signal is condition);
  // CREDIBLE_NM and GRADED_SLAB are credible. All three should survive stage 2.
  assert.equal(ok.length, 3);
});

test("rejectTitleJunk: production lot-listing fixture caught by 'lot' AND 'collection' AND Pokemon-cap", () => {
  assert.deepEqual(rejectTitleJunk([LOT_LISTING]), []);
});

// ---------------------------------------------------------------------------
// rejectTitleJunk — set-aware mode (the "collection" prefilter collision fix,
// 2026-06-12). Fixtures 06-11 are production titles observed in the base6
// paired sweep; each `_observed` field cites the case.
// ---------------------------------------------------------------------------

const LC = { setName: "Legendary Collection" };
const LC_SINGLE = FIXTURES["06-legendary-collection-single-alakazam.json"];
const LC_GIFT_LOT = FIXTURES["07-legendary-collection-gift-lot.json"];
const LC_YOU_PICK = FIXTURES["08-legendary-collection-you-pick.json"];
const LC_PLUSH = FIXTURES["09-legendary-collection-plush-merch.json"];

test("set-aware: legit Legendary Collection single SURVIVES with set context (the base6 false-null fix)", () => {
  assert.equal(rejectTitleJunk([LC_SINGLE], LC).length, 1);
});

test("set-aware: same single is still dropped WITHOUT set context (set-blind callers unchanged)", () => {
  assert.deepEqual(rejectTitleJunk([LC_SINGLE]), []);
});

test("set-aware: observed gift-lot (24 cards + rare) still dropped WITH Legendary Collection context", () => {
  // The count only reads once the set phrase is stripped: "24 [set] Cards" → "24 Cards".
  assert.deepEqual(rejectTitleJunk([LC_GIFT_LOT], LC), []);
});

test("set-aware: classic collection-lot fixture still dropped WITH Legendary Collection context", () => {
  assert.deepEqual(rejectTitleJunk([LOT_LISTING], LC), []);
});

test("set-aware: 'entire collection' possessive-lot phrasing still dropped", () => {
  const hit = synthHit(120, "My entire Legendary Collection for sale Pokemon");
  assert.deepEqual(rejectTitleJunk([hit], LC), []);
});

test("set-aware: observed you-pick multi-listing dropped", () => {
  assert.deepEqual(rejectTitleJunk([LC_YOU_PICK], LC), []);
});

test("set-aware: observed 'Choose Your Own' multi-listing dropped", () => {
  const hit = synthHit(4.99, "Pokemon Legendary Collection 2002 WOTC NM/LP: Choose Your Own");
  assert.deepEqual(rejectTitleJunk([hit], LC), []);
});

test("set-aware: observed plush merch dropped", () => {
  assert.deepEqual(rejectTitleJunk([LC_PLUSH], LC), []);
});

test("set-aware: observed piece-count merch (3PCS Roblox item) dropped", () => {
  const hit = synthHit(39.92, "3PCS Legendary Color Potion - Dragon Adventures D.A - CHEAPEST (FAST DELIVERY!)");
  assert.deepEqual(rejectTitleJunk([hit], LC), []);
});

test("set-aware: deck box / factory sealed merch dropped (2026-06-11 lever-measure class)", () => {
  const box = synthHit(45, "Pokemon Legendary Collection Factory Sealed Deck Box WOTC");
  assert.deepEqual(rejectTitleJunk([box], LC), []);
});

test("set-aware: set name containing 'Pokémon' no longer trips the mention cap (same collision class)", () => {
  const hit = synthHit(50, "Charizard Pokémon GO Pokémon Card Holo");
  assert.deepEqual(rejectTitleJunk([hit]), [], "set-blind: 2 mentions → dropped (pinned)");
  assert.equal(rejectTitleJunk([hit], { setName: "Pokémon GO" }).length, 1, "set-aware: set-phrase mention is identity");
});

test("set-aware: non-colliding junk keywords still fire with set context (proxy/fake unaffected)", () => {
  const hit = synthHit(50, "Charizard Legendary Collection proxy card");
  assert.deepEqual(rejectTitleJunk([hit], LC), []);
});

// ---------------------------------------------------------------------------
// rejectConditionJunk
// ---------------------------------------------------------------------------

test("rejectConditionJunk: each CONDITION_JUNK_KEYWORD individually rejects", () => {
  for (const kw of CONDITION_JUNK_KEYWORDS) {
    const hit = synthHit(50, `Charizard Base Set ${kw}`);
    const result = rejectConditionJunk([hit]);
    assert.deepEqual(result, [], `keyword '${kw}' should reject`);
  }
});

test("rejectConditionJunk: HP_HEAVILY_PLAYED_PATTERN rejects 'in HP condition'", () => {
  const hit = synthHit(50, "Charizard Base Set in HP condition");
  assert.deepEqual(rejectConditionJunk([hit]), []);
});

test("rejectConditionJunk: HP_HEAVILY_PLAYED_PATTERN rejects 'NM/HP' shorthand", () => {
  const hit = synthHit(50, "Charizard Base Set NM/HP Pokemon Card");
  assert.deepEqual(rejectConditionJunk([hit]), []);
});

test("rejectConditionJunk: HP_HEAVILY_PLAYED_PATTERN does NOT reject the Pokémon HP stat", () => {
  // The critical false-positive guard. Every Pokémon card title that lists
  // the HP stat ("HP 120", "HP 70") must pass — these listings are normal.
  // This is the documented deviation from the goal's literal " HP "
  // substring (see ADR-026).
  assert.ok(!HP_HEAVILY_PLAYED_PATTERN.test("Charizard HP 120 Base Set"));
  assert.ok(!HP_HEAVILY_PLAYED_PATTERN.test("Pikachu HP 60 Common"));
  assert.ok(!HP_HEAVILY_PLAYED_PATTERN.test("Mewtwo ex HP 280 Pokemon Card"));
});

test("rejectConditionJunk: case-insensitive on condition keywords", () => {
  const hit = synthHit(50, "Charizard HEAVILY PLAYED Base Set");
  assert.deepEqual(rejectConditionJunk([hit]), []);
});

test("rejectConditionJunk: damaged Charizard fixture caught", () => {
  assert.deepEqual(rejectConditionJunk([CHARIZARD_DAMAGED]), []);
});

test("rejectConditionJunk: credible NM Charizard passes (HP stat is not a heavily-played signal)", () => {
  // The credible-NM fixture intentionally includes 'HP 120' to pin this
  // regression — an earlier (literal-substring) implementation would have
  // rejected this.
  assert.equal(rejectConditionJunk([CHARIZARD_CREDIBLE_NM]).length, 1);
});

// ---------------------------------------------------------------------------
// pickBestListing — end-to-end against production fixtures.
// ---------------------------------------------------------------------------

test("pickBestListing: empty hits → null", () => {
  assert.equal(pickBestListing([]), null);
});

test("pickBestListing: all-junk → null (the soft-fail path the page falls back through)", () => {
  // $1.75 Venusaur + damaged Charizard + lot. Every hit fails some gate.
  // The page falls back to affiliateSearchUrl per ADR-021's soft-fail
  // contract — strictly better than surfacing junk.
  const result = pickBestListing([VENUSAUR_KEYWORD_STUFFED, CHARIZARD_DAMAGED, LOT_LISTING]);
  assert.equal(result, null);
});

test("pickBestListing: production-mix surfaces the credible NM Charizard, not the $1.75 junk", () => {
  // The exact regression case: a junk listing at $1.75 alongside credible
  // listings would have been picked by the old lowest-price selector. The
  // new picker rejects the junk via outlier ratio + (additionally)
  // condition keywords on the damaged fixture, then picks the cheapest of
  // the survivors (CREDIBLE_NM at $285 — there's no cheaper credible hit
  // in this mix).
  const hits = [
    VENUSAUR_KEYWORD_STUFFED,
    CHARIZARD_DAMAGED,
    CHARIZARD_CREDIBLE_NM,
    GRADED_SLAB,
  ];
  const result = pickBestListing(hits);
  assert.ok(result, "expected a picked listing");
  assert.equal(result.title, CHARIZARD_CREDIBLE_NM.title);
  assert.equal(result.price, 285);
});

test("pickBestListing: picker survives outlier rejection even when junk is the majority", () => {
  // 4 junk + 1 credible. The credible hit's price ($285) is way above the
  // herd-of-junk median. Outlier rejection should NOT reject the credible
  // hit (it's the high-end outlier, but we only reject *low* outliers).
  const hits = [
    VENUSAUR_KEYWORD_STUFFED,
    CHARIZARD_DAMAGED,
    LOT_LISTING,
    { ...VENUSAUR_KEYWORD_STUFFED, itemUrl: "https://www.ebay.com/itm/junk-101", price: 2.0 },
    CHARIZARD_CREDIBLE_NM,
  ];
  const result = pickBestListing(hits);
  assert.ok(result);
  assert.equal(result.title, CHARIZARD_CREDIBLE_NM.title);
});

test("pickBestListing: graded slab survives every gate", () => {
  // PSA-graded slabs are high-priced but legitimate. The picker must not
  // accidentally reject them via any keyword overlap.
  assert.equal(pickBestListing([GRADED_SLAB])?.title, GRADED_SLAB.title);
});

test("pickBestListing: picks lowest credible price when multiple credibles compete", () => {
  // Two credibles + junk. The cheaper credible wins.
  const cheaperCredible: EpnProductHit = {
    title: "Charizard Base Set Holo #4 Near Mint Pokemon Card",
    itemUrl: "https://www.ebay.com/itm/credible-cheaper",
    image: null,
    price: 195.0,
    currency: "USD",
  };
  const result = pickBestListing([VENUSAUR_KEYWORD_STUFFED, cheaperCredible, CHARIZARD_CREDIBLE_NM]);
  assert.equal(result?.price, 195.0);
});

test("pickBestListing: OUTLIER_RATIO + ABSOLUTE_PRICE_FLOOR are exported (ADR-026 tuning surface)", () => {
  // Future tuning may need to flex these; export them through the public
  // surface so the threshold-tuning followup goal has a single source of
  // truth to adjust.
  assert.equal(typeof OUTLIER_RATIO, "number");
  assert.equal(typeof ABSOLUTE_PRICE_FLOOR, "number");
  assert.ok(OUTLIER_RATIO > 0 && OUTLIER_RATIO < 1);
  assert.ok(ABSOLUTE_PRICE_FLOOR > 0);
});

test("pickBestListing: POKEMON_MENTION_CAP is exported", () => {
  assert.equal(typeof POKEMON_MENTION_CAP, "number");
});
