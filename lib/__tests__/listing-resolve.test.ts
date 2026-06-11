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
import { readFileSync } from "node:fs";
import {
  resolveVerifiedListingWith,
  prefilterCandidates,
  buildResolveQuery,
  finishQueryTerms,
  conditionQueryTerms,
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

// ---------------------------------------------------------------------------
// Finish-aware query lever (goal #2/#3 — certified-safe: the query term only
// changes which candidates are FETCHED; admission stays identity-gated).
// ---------------------------------------------------------------------------

test("finishQueryTerms: vintage 'Rare Holo' rarity biases the query with Holo", () => {
  assert.deepEqual(finishQueryTerms({ rarity: "Rare Holo" }), ["Holo"]);
  assert.deepEqual(finishQueryTerms({ rarity: "rare holo" }), ["Holo"]);
});

test("finishQueryTerms: modern/non-holo rarities add NO term (no unmeasured starvation)", () => {
  assert.deepEqual(finishQueryTerms({ rarity: "Rare Holo VMAX" }), []);
  assert.deepEqual(finishQueryTerms({ rarity: "Common" }), []);
  assert.deepEqual(finishQueryTerms({ rarity: null }), []);
  assert.deepEqual(finishQueryTerms({}), []);
});

test("finishQueryTerms: an explicit requested variant always wins over rarity", () => {
  assert.deepEqual(finishQueryTerms({ rarity: "Common", requestedVariant: "reverse-holofoil" }), ["Reverse Holo"]);
  assert.deepEqual(
    finishQueryTerms({ rarity: "Rare Holo", requestedVariant: "1st-edition-holofoil" }),
    ["1st Edition", "Holo"],
  );
});

test("buildResolveQuery: ANY_RAW + no holo rarity → the bare certified query, unchanged", () => {
  const q = buildResolveQuery({ name: "Pikachu", setName: "Jungle", rarity: "Common", condition: "ANY_RAW" });
  assert.equal(q, "Pikachu Jungle");
});

test("buildResolveQuery: vintage holo + ANY_RAW appends the quoted finish term", () => {
  const q = buildResolveQuery({ name: "Clefable", setName: "Jungle", rarity: "Rare Holo", condition: "ANY_RAW" });
  assert.equal(q, 'Clefable Jungle "Holo"');
});

test("buildResolveQuery: condition bias terms append for specific tiers + grades", () => {
  assert.equal(
    buildResolveQuery({ name: "Charizard", setName: "Base", rarity: null, condition: "NM" }),
    'Charizard Base "Near Mint" "NM"',
  );
  assert.equal(
    buildResolveQuery({
      name: "Charizard", setName: "Base", rarity: null,
      condition: { graded: { service: "PSA", grade: "10" } },
    }),
    'Charizard Base "PSA 10"',
  );
});

test("conditionQueryTerms: ANY_RAW is empty; ANY_GRADED mirrors the any-graded include set", () => {
  assert.deepEqual(conditionQueryTerms("ANY_RAW"), []);
  assert.deepEqual(conditionQueryTerms("ANY_GRADED"), ["PSA", "BGS", "CGC", "SGC"]);
});

test("the finish term never relaxes admission: a holo-biased query still rejects a wrong-number listing", async () => {
  // The query lever changes WHAT we fetch; the identity gates are untouched.
  // A non-holo 17/64 listing surfacing on a holo #1 card still rejects on Number.
  const d = deps({
    card: { name: "Clefable", setName: "Jungle", number: "1", rarity: "Rare Holo" },
    hits: [hit("nonholo", 10, "Clefable Jungle 17/64")],
    details: {
      nonholo: detail([["Set", "Jungle"], ["Card Number", "17/64"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]),
    },
  });
  const { listing, trace } = await resolveVerifiedListingWith(d, "base2-1-clefable", "ANY_RAW");
  assert.equal(listing, null);
  assert.equal(trace.candidates[0].verdict, "rejected");
});

// ---------------------------------------------------------------------------
// THE production regression, on the page's own card (goal MEASURE #1): the
// English neo1-17 page must never resolve the JAPANESE item 117223259644 —
// pinned with the real captured fixture as the sole candidate.
// ---------------------------------------------------------------------------

test("REGRESSION neo1-17: the real JP fixture 117223259644 resolves to null, never to the item", async () => {
  const fixture = JSON.parse(
    readFileSync(new URL("../__fixtures__/ebay-listings/jp-typhlosion-117223259644.json", import.meta.url), "utf8"),
  ) as {
    itemId: string;
    title: string;
    price: { value: string; currency: string };
    topCondition: string;
    localizedAspects: Array<{ name: string; value: string }>;
  };

  const d = deps({
    pokeId: "neo1-17",
    card: { id: "neo1-17", name: "Typhlosion", setName: "Neo Genesis", number: "17", rarity: "Rare Holo" },
    hits: [{
      title: fixture.title,
      itemUrl: `https://www.ebay.com/itm/${fixture.itemId}`,
      itemId: fixture.itemId,
      image: null,
      price: parseFloat(fixture.price.value),
      currency: fixture.price.currency,
    }],
    details: {
      [fixture.itemId]: {
        aspects: aspectsFromLocalized(fixture.localizedAspects),
        topCondition: fixture.topCondition,
      },
    },
  });

  const { listing, trace } = await resolveVerifiedListingWith(d, "neo1-17-typhlosion", "ANY_RAW");
  assert.equal(listing, null, "the JP item must NEVER be the page's verified listing");
  assert.equal(trace.candidates[0].verdict, "rejected");
  // Rejected on hard identity gates (Language and/or Number), not luck.
  const failing = trace.candidates[0].gates.filter((g) => !g.pass && g.hard).map((g) => g.gate);
  assert.ok(failing.includes("language") || failing.includes("number"), `failing gates: ${failing.join(",")}`);
});

// ---------------------------------------------------------------------------
// ANY_GRADED (wishlist "Any (Graded)" watches) — end-to-end through the
// orchestrator: a raw listing fails, a slab verifies.
// ---------------------------------------------------------------------------

test("ANY_GRADED: raw listings reject, a genuine slab verifies", async () => {
  const slab = detail(
    [["Set", "Neo Genesis"], ["Card Number", "18/111"], ["Language", "English"], ["Grading Company", "PSA"], ["Grade", "9"]],
    "Graded",
  );
  const d = deps({
    hits: [hit("raw", 20, "Typhlosion Neo Genesis NM 18/111"), hit("slab", 80, "Typhlosion Neo Genesis PSA 9 18/111")],
    details: { raw: RAW_NM_18, slab },
  });
  const { listing } = await resolveVerifiedListingWith(d, "neo1-18-typhlosion", "ANY_GRADED");
  assert.ok(listing, "the slab should verify under ANY_GRADED");
  assert.equal(listing!.itemId, "slab");
  assert.equal(listing!.condition, "GRADED");
});
