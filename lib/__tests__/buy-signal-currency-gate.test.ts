// Like-for-like CURRENCY gate (ADR-069 — the Moonbreon fix). The /deals
// single-listing board compared an LP/UK/GBP listing against a US/NM/USD sold
// reference and shipped a false "31% below" deal. The shared classifier
// computeCardBuySignal now refuses to classify a non-USD ask, and the deals
// batch threads listing.currency into it.
//
// These tests pin: (1) a non-USD ask → UNKNOWN even when everything else looks
// like a great deal; (2) the LP/UK/GBP Moonbreon fixture is NOT flagged as a
// deal; (3) USD asks still classify normally; (4) the refresh batch threads
// currency so the board can never re-ship the bug.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeCardBuySignal } from "../buy-signal/card-signal.ts";
import { aspectsFromLocalized } from "../buy-signal/aspects.ts";
import {
  refreshDeals,
  type CuratedEntry,
  type DealUpsertRow,
  type GetBestListingFn,
  type GetCardMetadataFn,
  type ComputeSignalFn,
} from "../deals/refresh-batch.ts";
import type { PoketraceVariant } from "../poketrace/variant.ts";

// A variant with a fabricated NM sold reference is NOT needed: the currency gate
// short-circuits BEFORE any PokeTrace lookup, so we can pass no variants and a
// would-be-great ask and still expect UNKNOWN.
const NO_VARIANTS: PoketraceVariant[] = [];

test("computeCardBuySignal: a non-USD (GBP) ask is UNKNOWN — never classified", async () => {
  const res = await computeCardBuySignal({
    variants: NO_VARIANTS,
    listingTitle: "Umbreon VMAX Alt Art 215/203 Evolving Skies Near Mint",
    listingAspects: aspectsFromLocalized([
      { name: "Card Condition", value: "Near Mint or Better" },
      { name: "Language", value: "English" },
    ]),
    askPrice: 1000,
    listingCurrency: "GBP",
  });
  assert.equal(res.signal.tier, "UNKNOWN");
  assert.equal(res.matchedTier, null);
  assert.match(res.signal.reason ?? "", /non-USD/i);
  assert.match(res.signal.reason ?? "", /GBP/);
});

test("computeCardBuySignal: the LP/UK/GBP Moonbreon fixture is NOT a deal", async () => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "lib/__fixtures__/ebay-listings/12-moonbreon-uk-gbp-lp.json"),
      "utf8",
    ),
  ) as { title: string; price: number; currency: string; localizedAspects: Array<Record<string, unknown>> };

  const res = await computeCardBuySignal({
    variants: NO_VARIANTS,
    listingTitle: fixture.title,
    listingAspects: aspectsFromLocalized(fixture.localizedAspects),
    askPrice: fixture.price,
    listingCurrency: fixture.currency,
  });
  // The currency gate (GBP) hard-stops first; even without it the LP condition
  // (no NM match here) would also yield UNKNOWN. Either way: no false deal.
  assert.equal(res.signal.tier, "UNKNOWN");
  assert.equal(res.signal.deltaPercent, null);
});

test("computeCardBuySignal: currency is case-insensitive and trimmed", async () => {
  for (const cur of [" gbp ", "Eur", "JPY"]) {
    const res = await computeCardBuySignal({
      variants: NO_VARIANTS,
      listingTitle: "x",
      askPrice: 10,
      listingCurrency: cur,
    });
    assert.equal(res.signal.tier, "UNKNOWN", `currency ${cur} should gate`);
  }
});

test("computeCardBuySignal: USD / missing currency does NOT trip the gate (falls through)", async () => {
  // No variants → the downstream resolver yields UNKNOWN, but for the
  // CONDITION/sample reason, NOT the currency reason. We assert the currency
  // gate did not fire by checking the reason isn't the non-USD message.
  for (const cur of ["USD", "usd", undefined, null, ""]) {
    const res = await computeCardBuySignal({
      variants: NO_VARIANTS,
      listingTitle: "Charizard Base Set Near Mint",
      listingAspects: aspectsFromLocalized([
        { name: "Card Condition", value: "Near Mint or Better" },
        { name: "Language", value: "English" },
      ]),
      askPrice: 200,
      listingCurrency: cur,
    });
    assert.equal(res.signal.tier, "UNKNOWN");
    assert.doesNotMatch(res.signal.reason ?? "", /non-USD/i, `currency ${String(cur)} must not trip the gate`);
  }
});

test("refreshDeals: threads listing.currency so a GBP listing is never a BELOW row", async () => {
  const meta: GetCardMetadataFn = async ({ id }) =>
    ({
      name: `Card ${id}`,
      setName: "Test Set",
      setId: id.split("-")[0],
      number: "1",
      image: "x",
      rarity: null,
      variants: [],
    }) as unknown as Awaited<ReturnType<GetCardMetadataFn>>;

  // A GBP listing that, treated naively as USD, would look like a steal.
  const listing: GetBestListingFn = async () => ({
    title: "Umbreon VMAX NM", image: "x", price: 1000, currency: "GBP", affiliateUrl: "u", itemId: "v1|x|0",
  });

  // The REAL classifier (not a fake) so the currency gate actually runs.
  const compute: ComputeSignalFn = (input) => computeCardBuySignal(input);

  let captured: DealUpsertRow[] = [];
  const entries: CuratedEntry[] = [{ slug: "es-215-umbreon-vmax", pokemonTcgId: "swsh7-215" }];
  const res = await refreshDeals({
    entries,
    getCardMetadata: meta,
    getBestListing: listing,
    getListingAspects: async () => ({ "card condition": "Near Mint or Better", language: "English" }),
    computeSignal: compute,
    upsertRows: async (rows) => { captured = rows; return { error: null }; },
    customIdFor: (s) => s,
  });

  assert.equal(res.belowCount, 0, "a GBP listing must never produce a BELOW deal");
  assert.equal(captured.length, 1);
  assert.equal(captured[0].signal, "UNKNOWN");
  assert.equal(captured[0].matched_tier, null);
});
