// Metadata-only tier guards (Session 47.5 / ADR-047). The metadata-only tier
// (zero priced/sold data — the 18K long tail) must skip BOTH the eBay best-
// listing AND the sold-history panel, render two search CTAs, and emit Product
// schema with no offers. Source-level assertions (the page is an async Server
// Component) + a catalog check that the tier is actually populated.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG, cardTier } from "../cards/catalog.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("catalog has ≥1 metadata-only card (the tier is exercised live)", () => {
  const mo = CARD_CATALOG.filter((c) => c.tier === "metadata-only");
  assert.ok(mo.length >= 1, "expected at least one metadata-only card");
  for (const c of mo) assert.equal(cardTier(c.slug), "metadata-only");
});

test("/cards/[slug]: metadata-only skips getBestListing AND the sold-history panel", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  // getBestListing is gated to curated only — metadata-only never calls it.
  assert.match(src, /if \(tier === "curated"\) \{/);
  // Variants + SoldHistoryPanel are skipped for metadata-only.
  assert.match(src, /tier !== "metadata-only" &&/);
  // Dedicated render branch.
  assert.match(src, /tier === "metadata-only" \? \(\s*<MetadataOnlyListing/);
});

test("/cards/[slug]: metadata-only schema is Product with NO offers", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  // Offer only when `best` (curated); AggregateOffer only for longtail.
  // metadata-only matches neither → no offers branch runs for it.
  assert.match(src, /if \(best\) \{/);
  assert.match(src, /else if \(tier === "longtail"\)/);
  // No `tier === "metadata-only"` clause adds offers.
  assert.doesNotMatch(src, /tier === "metadata-only"[\s\S]{0,120}offers/);
});

test("MetadataOnlyListing: two CTAs (eBay affiliate search + TCGplayer), no Browse call", () => {
  const src = read("components/cards/metadata-only-listing.tsx");
  assert.doesNotMatch(src, /^"use client"/m, "server component");
  assert.match(src, /ebaySearchUrl/);
  assert.match(src, /tcgplayerUrl/);
  assert.match(src, /Browse \{cardName\} on eBay/);
  assert.match(src, /See on TCGplayer/);
  assert.match(src, /rel="sponsored noopener noreferrer"/, "eBay CTA is affiliate-tracked");
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, "no raw hex — DESIGN.md tokens only");
});

test("/cards/[slug]: metadata-only eBay CTA uses the foil-metadata-only customId", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /affiliateSearchUrl\([^)]*"foil-metadata-only"\)/);
});
