// Orchestrator tests for the verified-listing resolver (lib/listing/resolve.ts).
// Injected fake deps (mirrors lib/deals/refresh-batch.ts test style). Proves:
// the JP wrong-card returns null, pre-filter-keeps-then-aspect-rejects,
// cheapest-first selection, the k-cap, and a clean full pass.

import test from "node:test";
import assert from "node:assert/strict";
import { aspectsFromLocalized } from "../buy-signal/aspects.ts";
import type { CardMetadata } from "../cards/sdk.ts";
import type { CatalogEntry } from "../cards/catalog.ts";
import type { EpnProductHit } from "../affiliate/epn.ts";
import {
  resolveVerifiedListingWith,
  prefilterCandidates,
  type ResolveDeps,
  type ListingDetail,
} from "../listing/resolve.ts";

function meta(over: Partial<CardMetadata>): CardMetadata {
  return {
    id: "neo1-18", name: "Typhlosion", setName: "Neo Genesis", setId: "neo1", series: "Neo",
    number: "18", image: "", rarity: null, releaseDate: null, types: [], subtypes: [],
    hp: null, artist: null, attacks: [], weaknesses: [], tcgplayerPrices: {}, tcgplayerUpdatedAt: "",
    variants: [], ...over,
  } as CardMetadata;
}

function detail(pairs: Array<[string, string]>, topCondition: string | null = "Ungraded"): ListingDetail {
  return { aspects: aspectsFromLocalized(pairs.map(([name, value]) => ({ name, value }))), topCondition };
}

function hit(itemId: string, price: number, title: string): EpnProductHit {
  return { title, itemUrl: `https://www.ebay.com/itm/${itemId}`, itemId, image: null, price, currency: "USD" };
}

function deps(over: {
  pokeId?: string;
  card?: Partial<CardMetadata>;
  hits: EpnProductHit[];
  details: Record<string, ListingDetail | null>;
}): ResolveDeps {
  const pokeId = over.pokeId ?? "neo1-18";
  return {
    getCatalogEntry: (slug) => ({ pokemonTcgId: pokeId, slug } as CatalogEntry),
    getCardMetadata: async ({ id }) => meta({ id, ...over.card }),
    search: async () => ({ ok: true, hits: over.hits }),
    getListingDetail: async ({ itemId }) => over.details[itemId] ?? null,
  };
}

const RAW_NM_18 = detail([["Set", "Neo Genesis"], ["Card Number", "18/111"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]);
const JP_157 = detail([["Set", "2000 Neo Genesis"], ["Card Number", "No. 157"], ["Language", "Japanese"], ["Finish", "Holo"]]);
const RAW_NM_17 = detail([["Set", "Neo Genesis"], ["Card Number", "17/111"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]);

test("JP listing as the sole candidate → null (never the unverified cheapest)", async () => {
  const d = deps({ hits: [hit("jp1", 40, "Typhlosion Neo Genesis Holo Rare 157")], details: { jp1: JP_157 } });
  const { listing, trace } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_RAW");
  assert.equal(listing, null);
  assert.equal(trace.result, "null");
  assert.equal(trace.candidates[0].verdict, "rejected");
});

test("pre-filter keeps a title-clean wrong-market listing, then aspects reject it", async () => {
  // Title has no foreign word, so the picker pre-filter keeps it; only the
  // Language item-specific reveals it's Japanese.
  const d = deps({ hits: [hit("jp2", 30, "Typhlosion Neo Genesis Holo Rare")], details: { jp2: JP_157 } });
  const { listing } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_RAW");
  assert.equal(listing, null);
});

test("cheapest-first: skips a rejected cheaper candidate, returns the next valid one", async () => {
  const d = deps({
    hits: [hit("wrong", 10, "Typhlosion Neo Genesis 17"), hit("right", 20, "Typhlosion Neo Genesis NM 18")],
    details: { wrong: RAW_NM_17, right: RAW_NM_18 },
  });
  const { listing, trace } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_RAW");
  assert.ok(listing, "should resolve the valid 2nd-cheapest");
  assert.equal(listing!.itemId, "right");
  assert.equal(trace.candidates[0].verdict, "rejected"); // the cheaper 17/111
  assert.equal(trace.candidates[1].verdict, "verified");
});

test("k-cap: a valid candidate beyond the 4 cheapest is NOT reached → null", async () => {
  const hits = [
    hit("w1", 10, "Typhlosion Neo Genesis 17"),
    hit("w2", 11, "Typhlosion Neo Genesis 17"),
    hit("w3", 12, "Typhlosion Neo Genesis 17"),
    hit("w4", 13, "Typhlosion Neo Genesis 17"),
    hit("good", 14, "Typhlosion Neo Genesis NM 18"),
  ];
  const d = deps({
    hits,
    details: { w1: RAW_NM_17, w2: RAW_NM_17, w3: RAW_NM_17, w4: RAW_NM_17, good: RAW_NM_18 },
  });
  const { listing, trace } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_RAW", { k: 4 });
  assert.equal(listing, null, "the valid 5th candidate is beyond k=4");
  assert.equal(trace.candidatesEvaluated, 4);
});

test("clean raw English NM 18/111 → full PASS with an affiliate URL", async () => {
  const d = deps({ hits: [hit("ok1", 95, "Typhlosion Neo Genesis Holo NM 18/111")], details: { ok1: RAW_NM_18 } });
  const { listing } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_RAW", { customId: "cp-neo1-18" });
  assert.ok(listing);
  assert.equal(listing!.itemId, "ok1");
  assert.equal(listing!.condition, "NM");
  assert.equal(listing!.price, 95);
  assert.ok(listing!.affiliateUrl.includes("/itm/ok1"));
});

test("unknown cardId → null", async () => {
  const d: ResolveDeps = {
    getCatalogEntry: () => undefined,
    getCardMetadata: async () => meta({}),
    search: async () => ({ ok: true, hits: [] }),
    getListingDetail: async () => null,
  };
  const { listing, trace } = await resolveVerifiedListingWith(d, "nope", "ANY_RAW");
  assert.equal(listing, null);
  assert.equal(trace.reason, "unknown cardId");
});

test("prefilterCandidates drops junk and sorts cheapest-first", () => {
  const hits: EpnProductHit[] = [
    hit("a", 50, "Typhlosion Neo Genesis NM"),
    hit("lot", 5, "Pokemon Lot of 100 cards bundle"), // junk → dropped
    hit("b", 20, "Typhlosion Neo Genesis Holo"),
  ];
  const out = prefilterCandidates(hits, "ANY_RAW");
  assert.deepEqual(out.map((h) => h.itemId), ["b", "a"]); // junk gone, ascending
});
