// Baked-first rendering invariants (perf-and-data-foundation, 2026-07-01).
//
// The structural fix this pins: /cards/[slug] renders must NOT block on
// pokemontcg.io's health. getCardMetadata returns the committed snapshot entry
// with ZERO network for any baked id; the live (timeout-bounded) fetch runs
// only for ids absent from the snapshot. Before this, every render did a
// live-first fetch with unbounded per-attempt hangs — measured 32–52s TTFB on
// card pages whenever upstream flapped, exactly what Googlebot would hit.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCardMetadata, getBakedCardMetadata } from "../cards/sdk.ts";
import { aggregateOfferFromTcgplayer } from "../cards/aggregate-offer.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("getCardMetadata is baked-first: a snapshot id returns real data with ZERO network", async () => {
  // Kill the network for the duration of the call. If getCardMetadata still
  // reaches for fetch on a baked id, this test fails loudly — the render-
  // blocks-on-upstream regression.
  const realFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls++;
    throw new Error("network disabled: baked-first must not fetch for a baked id");
  }) as unknown as typeof fetch;
  try {
    const card = await getCardMetadata({ id: "base1-4" });
    assert.equal(fetchCalls, 0, "no network call for a baked id");
    assert.equal(card.name, "Charizard");
    assert.equal(card.fallback, undefined, "baked record is real data, not the soft-fail fallback");
    assert.ok(
      Object.keys(card.tcgplayerPrices).length >= 1,
      "baked record carries real tcgplayerPrices (post full re-bake)",
    );
    assert.ok((card.variants?.length ?? 0) >= 1, "baked record keeps its PokeTrace variants");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("card-page JSON-LD AggregateOffer emits REAL baked prices for a curated card", () => {
  // For five weeks the snapshot was price-empty, so aggregateOfferFromTcgplayer
  // returned null on every card and no page emitted an offer — silently. This
  // pins the full chain: committed snapshot -> baked record -> offer object.
  const card = getBakedCardMetadata("base1-4");
  assert.ok(card, "base1-4 must be baked");
  const offer = aggregateOfferFromTcgplayer(
    card!.tcgplayerPrices,
    "https://foiltcg.com/cards/base1-4-charizard",
  ) as { lowPrice: string; highPrice: string; offerCount: number } | null;
  assert.ok(offer, "AggregateOffer must be non-null for a priced curated card");
  assert.ok(Number(offer!.lowPrice) > 0, "lowPrice is a real positive figure");
  assert.ok(Number(offer!.highPrice) >= Number(offer!.lowPrice), "price range is coherent");
});

test("aggregateOfferFromTcgplayer returns null over guess when no usable range exists", () => {
  assert.equal(aggregateOfferFromTcgplayer({}, "https://x"), null);
  assert.equal(aggregateOfferFromTcgplayer(undefined, "https://x"), null);
  assert.equal(
    aggregateOfferFromTcgplayer({ normal: { low: null, high: null } }, "https://x"),
    null,
  );
});

test("card page dedupes the generateMetadata + body metadata lookups via React cache()", () => {
  // Both generateMetadata and the page body need the card record. On the
  // snapshot-miss path that's a live fetch each — cache() collapses the pair
  // to one lookup per request. Structural pin, same style as the tier tests.
  const src = readFileSync(join(ROOT, "app/(site)/cards/[slug]/page.tsx"), "utf8");
  assert.match(src, /const getCard = cache\(/, "page must define a cache()-wrapped accessor");
  assert.doesNotMatch(
    src,
    /await getCardMetadata\(/,
    "page must call the cache()-wrapped accessor, not getCardMetadata directly",
  );
});
