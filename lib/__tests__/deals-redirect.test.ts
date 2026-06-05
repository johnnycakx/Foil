// Tests for the click-time deal redirect resolver (ADR-056).

import test from "node:test";
import assert from "node:assert/strict";
import { resolveDealDestination } from "../deals/redirect.ts";
import { buildCustomId, type EpnBestListing, type GetBestListingInput } from "../affiliate/epn.ts";

// A real curated slug (lib/cards/catalog.ts) so getCatalogEntry resolves it.
const SLUG = "base1-4-charizard";

// buildAffiliateUrl only stamps customid when EBAY_CAMPAIGN_ID is set; set it so
// the search-fallback URL carries the deals customid we assert on.
process.env.EBAY_CAMPAIGN_ID = process.env.EBAY_CAMPAIGN_ID || "5339000000";

const meta = async () =>
  ({ name: "Charizard", setName: "Base Set", setId: "base1", number: "4", image: "", rarity: null, variants: [] }) as unknown as Awaited<
    ReturnType<NonNullable<Parameters<typeof resolveDealDestination>[0]["getCardMetadata"]>>
  >;

test("resolveDealDestination: returns the specific item's affiliate URL when a listing is found", async () => {
  let captured: GetBestListingInput | null = null;
  const itemUrl = "https://www.ebay.com/itm/123456789?campid=5339000000&customid=dl-base1-4-charizard";
  const getBestListing = async (i: GetBestListingInput): Promise<EpnBestListing> => {
    captured = i;
    return { title: "Charizard Base Set NM", image: null, price: 320, currency: "USD", affiliateUrl: itemUrl };
  };

  const dest = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, getBestListing });
  assert.deepEqual(dest, { ok: true, url: itemUrl, kind: "item" });
  // Attribution: the deals tier customid + the deals_redirect surface.
  assert.equal(captured!.customId, buildCustomId({ tier: "deals", slug: SLUG }));
  assert.equal(captured!.customId, "dl-base1-4-charizard");
  assert.equal(captured!.surface, "deals_redirect");
});

test("resolveDealDestination: falls back to the affiliate SEARCH url when no listing is found", async () => {
  const getBestListing = async (): Promise<EpnBestListing | null> => null;
  const dest = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, getBestListing });
  assert.equal(dest.ok, true);
  if (!dest.ok) return;
  assert.equal(dest.kind, "search");
  // Destination is an internally-built eBay search URL with the deals customid.
  assert.match(dest.url, /ebay\.com\/sch/);
  assert.match(dest.url, /customid=dl-base1-4-charizard/);
});

test("resolveDealDestination: unknown slug is rejected (slug validated against the catalog)", async () => {
  const getBestListing = async (): Promise<EpnBestListing> => {
    throw new Error("should not be called for an unknown slug");
  };
  const dest = await resolveDealDestination({
    slug: "totally-made-up-slug-xyz",
    getCardMetadata: meta,
    getBestListing,
  });
  assert.deepEqual(dest, { ok: false, reason: "unknown_slug" });
});

test("resolveDealDestination: the destination is ALWAYS an eBay URL (no open redirect)", async () => {
  // Even if getBestListing somehow returned a non-eBay affiliateUrl, the resolver
  // only ever returns what getBestListing/affiliateSearchUrl produced — both
  // internally built. Here we exercise both branches and assert eBay host.
  const withItem = await resolveDealDestination({
    slug: SLUG,
    getCardMetadata: meta,
    getBestListing: async () => ({ title: "x", image: null, price: 1, currency: "USD", affiliateUrl: "https://www.ebay.com/itm/1" }),
  });
  const withSearch = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, getBestListing: async () => null });
  for (const d of [withItem, withSearch]) {
    assert.equal(d.ok, true);
    if (d.ok) assert.match(d.url, /^https:\/\/www\.ebay\.com\//);
  }
});

test("resolveDealDestination: metadata failure still lands on an eBay search (soft-fail)", async () => {
  const getBestListing = async (): Promise<EpnBestListing> => {
    throw new Error("should not reach Browse when metadata failed");
  };
  const dest = await resolveDealDestination({
    slug: SLUG,
    getCardMetadata: async () => { throw new Error("sdk down"); },
    getBestListing,
  });
  assert.equal(dest.ok, true);
  if (!dest.ok) return;
  assert.equal(dest.kind, "search");
  assert.match(dest.url, /ebay\.com\/sch/);
});
