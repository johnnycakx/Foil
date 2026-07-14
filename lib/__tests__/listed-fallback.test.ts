// The LAPSE MITIGATION, pinned (pricing-bridge / ADR-118).
//
// The scenario these tests exist for: the PokeTrace key lapses (R-070),
// lib/poketrace/by-uuid.ts returns null on every card, getHeroSoldStat returns
// null, and WITHOUT this fallback every card page on foiltcg.com shows "Sold
// data pending." These pins prove the fallback (a) fires exactly then, (b)
// never outranks real sold data, and (c) can never masquerade as a sold figure.

import test from "node:test";
import assert from "node:assert/strict";
import {
  LISTED_FRESHNESS_MAX_DAYS,
  parseListedDate,
  representativeAmount,
  resolveListedFallback,
  type TcgPlayerVariantPrice,
} from "../pricing/listed-fallback.ts";
import { assertSoldBasis, LISTED_LABEL } from "../pricing/basis.ts";

const NOW = Date.UTC(2026, 6, 14); // 2026-07-14
const DAY = 24 * 60 * 60 * 1000;

const price = (over: Partial<TcgPlayerVariantPrice> = {}): TcgPlayerVariantPrice => ({
  low: null,
  mid: null,
  high: null,
  market: null,
  directLow: null,
  ...over,
});

test("the lapse case: a real baked card yields a labeled listed price, not emptiness", () => {
  // base1-2 Blastoise, verbatim from the committed snapshot.
  const got = resolveListedFallback(
    { holofoil: price({ low: 149, mid: 198.68, high: 9999, market: 225.61, directLow: 184.99 }) },
    "2026/07/01",
    undefined,
    NOW,
  );
  assert.ok(got, "a priced, fresh card must produce a fallback — this is the whole point");
  assert.equal(got.amount, 225.61, "market is the representative figure");
  assert.equal(got.basis, "listed");
  assert.equal(got.source, "tcgplayer");
  assert.equal(got.label, LISTED_LABEL);
  assert.equal(got.ageDays, 13);
  assert.equal(got.lastUpdated, "2026-07-01T00:00:00.000Z");
});

test("THE INVARIANT holds at the boundary: the fallback can never pass a sold gate", () => {
  const got = resolveListedFallback({ normal: price({ market: 10 }) }, "2026/07/10", undefined, NOW);
  assert.ok(got);
  assert.throws(
    () => assertSoldBasis(got, "card-page hero"),
    /BASIS VIOLATION/,
    "the listed fallback must be structurally incapable of rendering as a sold figure",
  );
});

test("the selected printing wins, so the fallback answers the question the page asked", () => {
  const prices = {
    normal: price({ market: 5 }),
    holofoil: price({ market: 100 }),
    reverseHolofoil: price({ market: 40 }),
  };
  assert.equal(resolveListedFallback(prices, "2026/07/10", "reverseHolofoil", NOW)?.variantKey, "reverseHolofoil");
  assert.equal(resolveListedFallback(prices, "2026/07/10", "reverseHolofoil", NOW)?.amount, 40);
  // No selection → the priciest printing (the card's headline printing in practice).
  assert.equal(resolveListedFallback(prices, "2026/07/10", undefined, NOW)?.variantKey, "holofoil");
  // An unknown selection falls back rather than returning nothing.
  assert.equal(resolveListedFallback(prices, "2026/07/10", "nonexistent", NOW)?.variantKey, "holofoil");
});

test("freshness ceiling: a listed figure past the window resolves to NOTHING, never a stale number", () => {
  const prices = { holofoil: price({ market: 100 }) };
  const justInside = new Date(NOW - (LISTED_FRESHNESS_MAX_DAYS - 1) * DAY);
  const wayOutside = new Date(NOW - 400 * DAY);
  const iso = (d: Date) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

  assert.ok(resolveListedFallback(prices, iso(justInside), undefined, NOW), "inside the window → shown");
  assert.equal(
    resolveListedFallback(prices, iso(wayOutside), undefined, NOW),
    null,
    "a 400-day-old asking price is not evidence of anything — render nothing",
  );
});

test("unknown age is treated as STALE, never as fresh (null-over-guess)", () => {
  const prices = { holofoil: price({ market: 100 }) };
  assert.equal(resolveListedFallback(prices, undefined, undefined, NOW), null);
  assert.equal(resolveListedFallback(prices, "", undefined, NOW), null);
  assert.equal(resolveListedFallback(prices, "not-a-date", undefined, NOW), null);
});

test("no usable price → null (an empty or junk price block never invents a figure)", () => {
  assert.equal(resolveListedFallback(undefined, "2026/07/10", undefined, NOW), null);
  assert.equal(resolveListedFallback({}, "2026/07/10", undefined, NOW), null);
  assert.equal(resolveListedFallback({ holofoil: price() }, "2026/07/10", undefined, NOW), null);
  assert.equal(resolveListedFallback({ holofoil: price({ market: 0 }) }, "2026/07/10", undefined, NOW), null);
});

test("representativeAmount prefers market → mid → low, and NEVER the junk `high` ceiling", () => {
  assert.equal(representativeAmount(price({ market: 10, mid: 20, low: 30, high: 9999 })), 10);
  assert.equal(representativeAmount(price({ mid: 20, low: 30, high: 9999 })), 20);
  assert.equal(representativeAmount(price({ low: 30, high: 9999 })), 30);
  // high alone is NOT a price — a $9,999 ceiling ask is noise (see base1-2).
  assert.equal(representativeAmount(price({ high: 9999 })), null);
});

test("parseListedDate handles pokemontcg.io's slash format and ISO, rejects garbage", () => {
  assert.equal(parseListedDate("2026/07/01")?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(parseListedDate("2026-07-01")?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(parseListedDate("2026-07-01T12:30:00Z")?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(parseListedDate("garbage"), null);
  assert.equal(parseListedDate(null), null);
});
