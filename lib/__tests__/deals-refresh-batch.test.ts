// Tests for the deals leaderboard refresh batch (ROADMAP B.4 / ADR-054).
//
// The load-bearing assertions: (1) the cache write contains ONLY derived /
// non-eBay fields (R-008 — no listing title/price/url/itemId/seller persists),
// (2) the Browse-call cap is respected (R-012), (3) soft-fail per card.

import test from "node:test";
import assert from "node:assert/strict";
import {
  refreshDeals,
  type CuratedEntry,
  type DealUpsertRow,
  type GetBestListingFn,
  type GetCardMetadataFn,
  type ComputeSignalFn,
} from "../deals/refresh-batch.ts";
import type { BuySignal } from "../buy-signal/compute.ts";

const ALLOWED_KEYS = new Set([
  "card_slug",
  "card_name",
  "set_name",
  "image_url",
  "signal",
  "delta_pct",
  "sold_reference",
  "sold_sample_size",
  "matched_tier",
  "computed_at",
]);

// Any of these appearing in a cache row would be an eBay listing payload leak.
const FORBIDDEN_KEYS = ["title", "price", "ask", "item_id", "itemId", "url", "item_url", "seller", "listing_image"];

const meta: GetCardMetadataFn = async ({ id }) =>
  ({
    name: `Card ${id}`,
    setName: "Test Set",
    setId: id.split("-")[0],
    number: id.split("-")[1] ?? "1",
    image: `https://img/${id}.png`,
    rarity: null,
    variants: [],
  }) as unknown as Awaited<ReturnType<GetCardMetadataFn>>;

function entries(n: number): CuratedEntry[] {
  return Array.from({ length: n }, (_, i) => ({ slug: `slug-${i}`, pokemonTcgId: `set-${i}` }));
}

const sig = (tier: BuySignal["tier"], deltaPercent: number | null, median: number | null): BuySignal => ({
  tier,
  median,
  deltaPercent,
  sampleSize: 10,
  windowDays: 30,
});

test("refreshDeals: writes only derived/non-eBay columns (R-008)", async () => {
  let captured: DealUpsertRow[] = [];
  const listing: GetBestListingFn = async () => ({
    title: "Charizard Base Set NM", image: "x", price: 80, currency: "USD", affiliateUrl: "https://ebay/x",
  });
  const compute: ComputeSignalFn = async () => ({ signal: sig("BELOW", -20, 100), matchedTier: "NEAR_MINT" });

  const res = await refreshDeals({
    entries: entries(3),
    getCardMetadata: meta,
    getBestListing: listing,
    computeSignal: compute,
    upsertRows: async (rows) => { captured = rows; return { error: null }; },
    customIdFor: (slug) => `dl-${slug}`,
  });

  assert.equal(res.written, 3);
  assert.equal(res.belowCount, 3);
  for (const row of captured) {
    const keys = Object.keys(row);
    for (const k of keys) assert.ok(ALLOWED_KEYS.has(k), `unexpected cache column "${k}"`);
    for (const f of FORBIDDEN_KEYS) assert.ok(!(f in row), `forbidden eBay-listing column "${f}" persisted`);
    // The eBay ask (80) must never appear as a stored value.
    assert.notEqual(row.sold_reference, 80);
  }
});

test("refreshDeals: respects the Browse-call cap (R-012)", async () => {
  let calls = 0;
  const listing: GetBestListingFn = async () => { calls++; return null; };
  const res = await refreshDeals({
    entries: entries(10),
    getCardMetadata: meta,
    getBestListing: listing,
    computeSignal: async () => ({ signal: sig("UNKNOWN", null, null), matchedTier: null }),
    upsertRows: async () => ({ error: null }),
    customIdFor: (s) => s,
    maxBrowseCalls: 4,
    concurrency: 2,
  });
  assert.equal(res.capHit, true);
  assert.equal(res.cardsConsidered, 4);
  assert.equal(calls, 4);
  assert.equal(res.browseCalls, 4);
});

test("refreshDeals: no live listing → UNKNOWN row written (clears a stale BELOW)", async () => {
  let captured: DealUpsertRow[] = [];
  const res = await refreshDeals({
    entries: entries(2),
    getCardMetadata: meta,
    getBestListing: async () => null,
    computeSignal: async () => ({ signal: sig("BELOW", -20, 100), matchedTier: "NEAR_MINT" }),
    upsertRows: async (rows) => { captured = rows; return { error: null }; },
    customIdFor: (s) => s,
  });
  assert.equal(res.listingsFound, 0);
  assert.equal(res.belowCount, 0);
  assert.equal(captured.length, 2);
  assert.ok(captured.every((r) => r.signal === "UNKNOWN" && r.delta_pct === null && r.sold_reference === null));
});

test("refreshDeals: soft-fails per card — one Browse throw doesn't abort the batch", async () => {
  let captured: DealUpsertRow[] = [];
  const listing: GetBestListingFn = async ({ cardName }) => {
    if (cardName.includes("set-1")) throw new Error("ebay boom");
    return { title: "NM", image: "x", price: 50, currency: "USD", affiliateUrl: "u" };
  };
  const res = await refreshDeals({
    entries: entries(3),
    getCardMetadata: meta,
    getBestListing: listing,
    computeSignal: async () => ({ signal: sig("BELOW", -10, 60), matchedTier: "NEAR_MINT" }),
    upsertRows: async (rows) => { captured = rows; return { error: null }; },
    customIdFor: (s) => s,
    concurrency: 1,
  });
  // 2 of 3 produced rows; 1 recorded an error, batch did not throw.
  assert.equal(captured.length, 2);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].stage, "browse");
  assert.equal(res.errors[0].cardSlug, "slug-1");
});

test("refreshDeals: upsert error is recorded, not thrown", async () => {
  const res = await refreshDeals({
    entries: entries(1),
    getCardMetadata: meta,
    getBestListing: async () => ({ title: "NM", image: "x", price: 50, currency: "USD", affiliateUrl: "u" }),
    computeSignal: async () => ({ signal: sig("AT", 1, 50), matchedTier: "NEAR_MINT" }),
    upsertRows: async () => ({ error: "db_down" }),
    customIdFor: (s) => s,
  });
  assert.equal(res.written, 0);
  assert.ok(res.errors.some((e) => e.stage === "upsert" && e.error === "db_down"));
});
