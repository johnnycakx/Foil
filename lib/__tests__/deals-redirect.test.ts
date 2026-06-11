// Tests for the click-time deal redirect resolver (ADR-056; migrated onto the
// VERIFIED resolver — DESIGN-VERIFIED-LISTING-RESOLVER.md §5, Tranche A #3).
// Pins: verified item → 302 target; honest null → affiliate SEARCH; unknown
// slug rejected (catalog-validated); destination always an internally-built
// eBay URL (no open redirect); and THE production regression — the Japanese
// Typhlosion item 117223259644 can never be the redirect destination.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveDealDestination, type ResolveListingFn } from "../deals/redirect.ts";
import { buildCustomId } from "../affiliate/epn.ts";
import { getCatalogEntry } from "../cards/catalog.ts";
import { aspectsFromLocalized } from "../buy-signal/aspects.ts";
import {
  resolveVerifiedListingWith,
  type ResolveDeps,
  type VerifiedListing,
} from "../listing/resolve.ts";
import type { CardMetadata } from "../cards/sdk.ts";

// A real curated slug (lib/cards/catalog.ts) so getCatalogEntry resolves it.
const SLUG = "base1-4-charizard";

// buildAffiliateUrl only stamps customid when EBAY_CAMPAIGN_ID is set; set it so
// the search-fallback URL carries the deals customid we assert on.
process.env.EBAY_CAMPAIGN_ID = process.env.EBAY_CAMPAIGN_ID || "5339000000";

const meta = async () =>
  ({ name: "Charizard", setName: "Base Set", setId: "base1", number: "4", image: "", rarity: null, variants: [] }) as unknown as Awaited<
    ReturnType<NonNullable<Parameters<typeof resolveDealDestination>[0]["getCardMetadata"]>>
  >;

function verifiedListing(over: Partial<VerifiedListing> = {}): VerifiedListing {
  return {
    itemId: "v1|123456789|0",
    affiliateUrl: "https://www.ebay.com/itm/123456789?campid=5339000000&customid=dl-base1-4-charizard",
    price: 320,
    currency: "USD",
    title: "Charizard Base Set NM",
    condition: "NM",
    verifiedAspects: { set: "Base Set", number: "4/102", finish: "Holo", language: "English", graded: false },
    aspects: {},
    ...over,
  };
}

test("resolveDealDestination: 302s to the VERIFIED item's affiliate URL", async () => {
  let captured: { cardId: string; condition: unknown; customId?: string; surface?: string } | null = null;
  const itemUrl = "https://www.ebay.com/itm/123456789?campid=5339000000&customid=dl-base1-4-charizard";
  const resolveListing: ResolveListingFn = async (cardId, condition, opts) => {
    captured = { cardId, condition, customId: opts?.customId, surface: opts?.surface };
    return verifiedListing({ affiliateUrl: itemUrl });
  };

  const dest = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, resolveListing });
  assert.deepEqual(dest, { ok: true, url: itemUrl, kind: "item" });
  // Attribution: the deals tier customid + the deals_redirect surface, and the
  // page default ANY_RAW condition.
  assert.equal(captured!.customId, buildCustomId({ tier: "deals", slug: SLUG }));
  assert.equal(captured!.customId, "dl-base1-4-charizard");
  assert.equal(captured!.surface, "deals_redirect");
  assert.equal(captured!.condition, "ANY_RAW");
  assert.equal(captured!.cardId, SLUG);
});

test("resolveDealDestination: honest null falls back to the affiliate SEARCH url (never an unverified item)", async () => {
  const resolveListing: ResolveListingFn = async () => null;
  const dest = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, resolveListing });
  assert.equal(dest.ok, true);
  if (!dest.ok) return;
  assert.equal(dest.kind, "search");
  // Destination is an internally-built eBay search URL with the deals customid.
  assert.match(dest.url, /ebay\.com\/sch/);
  assert.match(dest.url, /customid=dl-base1-4-charizard/);
});

test("resolveDealDestination: unknown slug is rejected (slug validated against the catalog)", async () => {
  const resolveListing: ResolveListingFn = async () => {
    throw new Error("should not be called for an unknown slug");
  };
  const dest = await resolveDealDestination({
    slug: "totally-made-up-slug-xyz",
    getCardMetadata: meta,
    resolveListing,
  });
  assert.deepEqual(dest, { ok: false, reason: "unknown_slug" });
});

test("resolveDealDestination: the destination is ALWAYS an eBay URL (no open redirect)", async () => {
  // The resolver only ever returns what buildAffiliateUrl/affiliateSearchUrl
  // produced — both internally built. Exercise both branches, assert eBay host.
  const withItem = await resolveDealDestination({
    slug: SLUG,
    getCardMetadata: meta,
    resolveListing: async () => verifiedListing({ affiliateUrl: "https://www.ebay.com/itm/1" }),
  });
  const withSearch = await resolveDealDestination({ slug: SLUG, getCardMetadata: meta, resolveListing: async () => null });
  for (const d of [withItem, withSearch]) {
    assert.equal(d.ok, true);
    if (d.ok) assert.match(d.url, /^https:\/\/www\.ebay\.com\//);
  }
});

test("resolveDealDestination: resolver throw + metadata failure still lands on an eBay search (soft-fail)", async () => {
  const dest = await resolveDealDestination({
    slug: SLUG,
    getCardMetadata: async () => { throw new Error("sdk down"); },
    resolveListing: async () => { throw new Error("browse down"); },
  });
  assert.equal(dest.ok, true);
  if (!dest.ok) return;
  assert.equal(dest.kind, "search");
  assert.match(dest.url, /ebay\.com\/sch/);
});

// ---------------------------------------------------------------------------
// THE production regression (DESIGN §8): the English neo1-17 page redirected
// to the JAPANESE Typhlosion item 117223259644. With the redirect routed
// through the REAL resolver pipeline and that item as the only candidate, the
// destination must be the SEARCH url — never that item.
// ---------------------------------------------------------------------------

test("REGRESSION neo1-17: the JP Typhlosion 117223259644 is never the redirect destination", async () => {
  const fixture = JSON.parse(
    readFileSync(new URL("../__fixtures__/ebay-listings/jp-typhlosion-117223259644.json", import.meta.url), "utf8"),
  ) as {
    itemId: string;
    title: string;
    price: { value: string; currency: string };
    topCondition: string;
    localizedAspects: Array<{ name: string; value: string }>;
  };

  // neo1-17 must be a real catalog card (the surface the bug appeared on).
  assert.ok(getCatalogEntry("neo1-17-typhlosion"), "neo1-17-typhlosion missing from the catalog");

  const neo17Meta = {
    id: "neo1-17", name: "Typhlosion", setName: "Neo Genesis", setId: "neo1", series: "Neo",
    number: "17", image: "", rarity: "Rare Holo", releaseDate: null, types: [], subtypes: [],
    hp: null, artist: null, attacks: [], weaknesses: [], tcgplayerPrices: {}, tcgplayerUpdatedAt: "",
    variants: [],
  } as unknown as CardMetadata;

  // Real resolver pipeline, the JP item as the SOLE search candidate.
  const realPipelineDeps: ResolveDeps = {
    getCatalogEntry: (slug) => getCatalogEntry(slug),
    getCardMetadata: async () => neo17Meta,
    search: async () => ({
      ok: true,
      hits: [{
        title: fixture.title,
        itemUrl: `https://www.ebay.com/itm/${fixture.itemId}`,
        itemId: fixture.itemId,
        image: null,
        price: parseFloat(fixture.price.value),
        currency: fixture.price.currency,
      }],
    }),
    getListingDetail: async () => ({
      aspects: aspectsFromLocalized(fixture.localizedAspects),
      topCondition: fixture.topCondition,
    }),
  };

  const resolveListing: ResolveListingFn = async (cardId, condition, opts) => {
    const { listing } = await resolveVerifiedListingWith(realPipelineDeps, cardId, condition, opts);
    return listing;
  };

  const dest = await resolveDealDestination({
    slug: "neo1-17-typhlosion",
    getCardMetadata: async () => neo17Meta,
    resolveListing,
  });

  assert.equal(dest.ok, true);
  if (!dest.ok) return;
  assert.equal(dest.kind, "search", "the JP listing must be rejected → search fallback");
  assert.ok(!dest.url.includes("117223259644"), "the JP item id must never be the destination");
});
