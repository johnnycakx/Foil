// X-bot deal-angle freshness + honesty guards (ADR-071 follow-up, Part 1).
//
// The first approval draft claimed "Alakazam ex (151) LP is listed 43% below
// its sold price of $70.29" — a PHANTOM deal from the stale buy_signals table
// (PokeTrace cancelled 2026-06-16). The fix repoints the deal angle to the fresh
// market_movers signal (aggregate "below its own 30-day average") + a freshness
// guard so a stale board can never post a deal, and the framing can't mislabel a
// condition. These tests pin all three.

import test from "node:test";
import assert from "node:assert/strict";
import { freshDeals, MAX_DEAL_AGE_HOURS } from "../social/data.ts";
import { buildUserPrompt, type DealData } from "../social/post-text.ts";
import { resolveAngle, angleForDate } from "../social/angles.ts";
import type { MarketMovers, MoverRow } from "../deals/market-movers-read.ts";

const NOW = Date.parse("2026-06-27T12:00:00Z");

function mover(over: Partial<MoverRow> = {}): MoverRow {
  return {
    cardSlug: "base1-4-charizard",
    cardName: "Charizard",
    setName: "Base Set",
    imageUrl: "https://img.example/charizard.png",
    direction: "down",
    momentumPct: -12.3,
    avg7d: 61.4,
    avg30d: 70.0,
    saleCount: 88,
    matchedTier: "NEAR_MINT",
    computedAt: new Date(NOW - 60 * 60 * 1000).toISOString(), // 1h old = fresh
    soldAsOfIso: null,
    ...over,
  };
}
const movers = (down: MoverRow[]): MarketMovers => ({ down, up: [] });

// --- freshness guard ---

test("freshDeals: a fresh down-mover maps to DealData with the movers fields", () => {
  const out = freshDeals(movers([mover()]), NOW);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    cardName: "Charizard",
    setName: "Base Set",
    slug: "base1-4-charizard",
    deltaPct: -12.3,
    soldReference: 70.0,
    matchedTier: "NEAR_MINT",
    saleCount: 88,
    computedAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
    imageUrl: "https://img.example/charizard.png",
  });
});

test("freshDeals: a stale row (older than MAX_DEAL_AGE_HOURS) is excluded", () => {
  const stale = mover({ computedAt: new Date(NOW - (MAX_DEAL_AGE_HOURS + 1) * 60 * 60 * 1000).toISOString() });
  assert.deepEqual(freshDeals(movers([stale]), NOW), [], "a stale mover must never become a deal");
});

test("freshDeals: a row without a usable 30-day average is excluded", () => {
  assert.deepEqual(freshDeals(movers([mover({ avg30d: null })]), NOW), []);
  assert.deepEqual(freshDeals(movers([mover({ avg30d: 0 })]), NOW), []);
});

test("freshDeals: at the exact 48h boundary the row still counts (>= cutoff)", () => {
  const edge = mover({ computedAt: new Date(NOW - MAX_DEAL_AGE_HOURS * 60 * 60 * 1000).toISOString() });
  assert.equal(freshDeals(movers([edge]), NOW).length, 1);
});

// --- fall-through: a stale board can't produce a deal post ---

test("a stale board → no deal → resolveAngle falls off deal_of_day", () => {
  // Find a date whose intended angle is deal_of_day.
  let dealDate: Date | null = null;
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(2026, 5, 1 + i));
    if (angleForDate(d) === "deal_of_day") { dealDate = d; break; }
  }
  assert.ok(dealDate);
  const stale = freshDeals(movers([mover({ computedAt: new Date(NOW - 100 * 60 * 60 * 1000).toISOString() })]), NOW);
  // hasDeal is false → on a deal day with no spotlight we fall to educational.
  assert.equal(resolveAngle(dealDate!, { hasDeal: stale.length > 0, hasSpotlight: false }), "educational");
});

// --- honesty: framing traces to the source + no condition mislabel ---

test("deal prompt: states the source tier + 30-day-average framing, never a single-listing or mislabel", () => {
  const deal = freshDeals(movers([mover()]), NOW)[0] as DealData;
  const p = buildUserPrompt({ angle: "deal_of_day", date: "June 27, 2026", deal });
  assert.match(p, /Near Mint/, "states the source tier (movers are NM)");
  assert.match(p, /12% below/, "the exact momentum figure");
  assert.match(p, /30-day sold average/, "honest aggregate framing");
  assert.match(p, /88 recent sales/, "the sample size behind the average");
  // The framing must steer the model to the AGGREGATE (the card's own average),
  // which is what prevents the phantom single-listing "43% below sold" claim.
  assert.match(p, /its OWN 30-day|aggregate, not a single listing/i, "explicitly aggregate framing");
  // The bug mislabeled an NM card as LP — the prompt for a NEAR_MINT mover must
  // never name a played condition.
  assert.doesNotMatch(p, /Lightly Played|\bLP\b/, "no condition mislabel");
});
