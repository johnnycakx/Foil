// Line-tracker sold-figure honesty (content-trust-hotfix Defects 1 & 2).
//
// Defect 1: the /lines baked snapshot bypassed the ADR-104 freshness gate — the
// generator picked `avg30d ?? avg`, so an all-time last sale (or a stale window)
// got frozen in and rendered as "sold recently". These tests pin that the
// selection is now FRESH WINDOWED ONLY, records soldAsOf, and that a figure past
// the freshness window degrades to dated "last sold" framing.
//
// Defect 2: the TCGplayer `market` number is labeled EXPLICITLY as a listed
// reference (it runs ~2x sold on low-liquidity vintage), never a plain "market"
// or "buy right now" price.

import test from "node:test";
import assert from "node:assert/strict";
import type { SoldHistory, SoldStat, SoldSource } from "../poketrace/by-uuid.ts";
import { resolveLineSoldEntry } from "../lines/sold-select.ts";
import { soldPhrase, marketPhrase, type LineCard } from "../lines/data.ts";

const DAY = 24 * 60 * 60 * 1000;

function stat(partial: Partial<SoldStat>): SoldStat {
  return {
    avg: null, low: null, high: null, avg1d: null, avg7d: null, avg30d: null,
    median7d: null, median30d: null, saleCount: null, lastUpdated: null,
    approxSaleCount: false, ...partial,
  };
}

function history(source: SoldSource, tiers: Record<string, SoldStat>): SoldHistory {
  return { uuid: "test", fetchedAt: 0, bySource: { [source]: tiers } };
}

function lineCard(partial: Partial<LineCard>): LineCard {
  return {
    slug: "swsh7-215-umbreon-vmax-alt-art", pokemonTcgId: "swsh7-215", name: "Umbreon VMAX",
    setName: "Evolving Skies", number: "215", rarity: "Rare Rainbow", releaseYear: "2021",
    image: "", marketLowCents: null, marketHighCents: null, marketCents: null, sortPriceCents: 0,
    soldCents: null, soldSaleCount: 0, soldTierLabel: null, soldAsOf: null, soldFresh: false, ...partial,
  };
}

// ---- Defect 1: fresh-windowed selection --------------------------------------

test("resolveLineSoldEntry picks the FRESH windowed value + records soldAsOf", () => {
  const asOf = "2026-06-22T00:00:00.000Z";
  const nowMs = Date.parse(asOf) + 5 * DAY; // within the 35-day window
  const h = history("ebay", { NEAR_MINT: stat({ avg30d: 2285, median30d: 2310, avg: 2550, saleCount: 64, lastUpdated: asOf }) });
  const pick = resolveLineSoldEntry(h, { tcgLowCents: 193000, tcgHighCents: 600000, nowMs });
  assert.ok(pick && !pick.note, "a fresh NM window is an accepted headline");
  assert.equal(pick!.cents, 228500, "uses avg30d ($2,285), not the all-time avg ($2,550)");
  assert.equal(pick!.soldAsOf, asOf);
  assert.equal(pick!.tierLabel, "Near Mint");
});

test("resolveLineSoldEntry SUPPRESSES an all-time-only figure (the pre-fix `?? avg` leak)", () => {
  // The exact anti-pattern: no windowed value, only a stale all-time last sale.
  // Old code baked $840; the fresh-windowed rule returns null (pending).
  const h = history("ebay", {
    NEAR_MINT: stat({ avg30d: null, median30d: null, avg: 840, saleCount: 20, lastUpdated: "2025-11-01T00:00:00.000Z" }),
  });
  const pick = resolveLineSoldEntry(h, { tcgLowCents: null, tcgHighCents: null, nowMs: Date.parse("2026-07-08T00:00:00.000Z") });
  assert.equal(pick, null, "no fresh windowed value → suppressed, never the all-time figure");
});

test("resolveLineSoldEntry SUPPRESSES a stale window (last sale beyond the freshness horizon)", () => {
  const asOf = "2026-01-01T00:00:00.000Z";
  const nowMs = Date.parse("2026-07-08T00:00:00.000Z"); // ~188 days later
  const h = history("ebay", { NEAR_MINT: stat({ avg30d: 2285, saleCount: 64, lastUpdated: asOf }) });
  const pick = resolveLineSoldEntry(h, { tcgLowCents: null, tcgHighCents: null, nowMs });
  assert.equal(pick, null, "a windowed value anchored to a months-old sale is not 'recent'");
});

test("resolveLineSoldEntry flags a thin-sample fresh window for suppression (note)", () => {
  const asOf = "2026-06-22T00:00:00.000Z";
  const nowMs = Date.parse(asOf) + DAY;
  const h = history("ebay", { NEAR_MINT: stat({ avg30d: 500, saleCount: 2, lastUpdated: asOf }) });
  const pick = resolveLineSoldEntry(h, { tcgLowCents: null, tcgHighCents: null, nowMs });
  assert.equal(pick?.note, "low_sales");
});

// ---- Defect 1: render-time reframe -------------------------------------------

test("soldPhrase reads 'recently' when fresh, dated 'last sold' when stale", () => {
  const fresh = lineCard({ soldCents: 228500, soldFresh: true, soldAsOf: "2026-07-06T00:00:00.000Z" });
  assert.match(soldPhrase(fresh), /Sold for ~\$2,285 recently/);

  const stale = lineCard({ soldCents: 84000, soldFresh: false, soldAsOf: "2026-06-07T00:00:00.000Z" });
  assert.match(soldPhrase(stale), /Last sold ~\$840 \(as of Jun 7\)/);
  assert.doesNotMatch(soldPhrase(stale), /recently/);

  assert.match(soldPhrase(lineCard({ soldCents: null })), /pending/i);
});

// ---- Defect 2: TCGplayer listed label ----------------------------------------

test("marketPhrase labels the TCGplayer figure as a LISTED reference, not a plain market/buy price", () => {
  const card = lineCard({ marketCents: 22900 });
  const phrase = marketPhrase(card)!;
  assert.match(phrase, /TCGplayer listed ~\$229/);
  assert.doesNotMatch(phrase, /to buy right now/);
  assert.doesNotMatch(phrase, /^Around \$/);
  assert.equal(marketPhrase(lineCard({ marketCents: null })), null);
});
