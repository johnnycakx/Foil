// Line-tracker data layer (eve-line-tracker, ADR-095). Assembles the card rows
// for a `/lines/[pokemon]` page from BAKED sources only — zero live network at
// render (the page must feel instant; it's the baked path):
//   - card display fields + TCGplayer price range: the committed baked snapshot
//     (getBakedCardMetadata), no pokemontcg.io call;
//   - "sold for ~$X recently": the committed sold snapshot
//     (lib/lines/sold-snapshot.generated.json), NULL-OVER-GUESS — a card with
//     no real PokeTrace sold data renders "sold data pending", never a
//     fabricated or SDK-guessed figure.
// The live "cheapest one right now" is fetched client-side per card via the
// existing /api/listing (R-008), not here — this layer stays synchronous.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_CATALOG } from "../cards/catalog.ts";
import { getBakedCardMetadata } from "../cards/sdk.ts";
import { SOLD_FRESHNESS_MAX_DAYS } from "../cards/sold-coherence.ts";
import type { LineConfig } from "./config.ts";

export type SoldSnapshotEntry = {
  soldCents: number;
  saleCount: number;
  tierLabel: string;
  source: string;
  /** ISO date of the tier's most recent sale (content-trust-hotfix Defect 1).
   *  Absent on legacy snapshots baked before the freshness gate landed. */
  soldAsOf?: string | null;
};

export type SoldSnapshot = {
  asOf: string;
  cards: Record<string, SoldSnapshotEntry>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Is a baked sold figure still a fresh "sold recently" claim at render time?
 *  Keys off the entry's own last-sale date, falling back to the snapshot-wide
 *  asOf for legacy entries. A figure past the freshness window degrades to
 *  dated "last sold" framing rather than overclaiming currency (ADR-104). */
function isSoldFresh(entryAsOf: string | null | undefined, snapshotAsOf: string, nowMs: number): boolean {
  const anchor = entryAsOf ?? snapshotAsOf;
  if (!anchor) return false;
  const t = Date.parse(anchor);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= SOLD_FRESHNESS_MAX_DAYS * DAY_MS;
}

function loadSoldSnapshot(): SoldSnapshot {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "sold-snapshot.generated.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<SoldSnapshot>;
    return { asOf: parsed.asOf ?? "", cards: parsed.cards ?? {} };
  } catch {
    // Missing snapshot → every card renders "sold data pending" (honest).
    return { asOf: "", cards: {} };
  }
}

const SOLD = loadSoldSnapshot();

export type LineCard = {
  slug: string;
  pokemonTcgId: string;
  name: string;
  setName: string;
  number: string;
  rarity: string | null;
  releaseYear: string | null;
  image: string;
  /** Baked TCGplayer market range (cents), or null when unpriced. */
  marketLowCents: number | null;
  marketHighCents: number | null;
  /** Representative current market price (max of the TCGplayer `market` buckets),
   *  or null when no market bucket exists. Outlier-resistant — the `high` field
   *  is polluted by single $9,999 placeholder listings, so this (not high) is
   *  what we display + sort on. */
  marketCents: number | null;
  /** Value used to rank the line "most valuable first": the strongest evidence
   *  of worth = max(recent sold, current market), falling back to the low/high
   *  range only for cards with neither. Sold-aware so a card that recently SOLD
   *  high isn't buried below cheaper cards; outlier-resistant (never the $9,999
   *  placeholder `high`). */
  sortPriceCents: number;
  /** Real recent-sold figure (cents) or null (→ "sold data pending"). */
  soldCents: number | null;
  soldSaleCount: number;
  soldTierLabel: string | null;
  /** ISO date of the sold figure's most recent sale, or null. */
  soldAsOf: string | null;
  /** True → render "sold recently"; false → dated "last sold" framing. */
  soldFresh: boolean;
};

export type LineData = {
  config: LineConfig;
  cards: LineCard[];
  /** ISO timestamp the sold snapshot was generated (for the honest "as of"). */
  soldAsOf: string;
  /** Count with real sold data (for the honest coverage line). */
  soldCount: number;
};

function tcgRange(prices: Record<string, { low: number | null; high: number | null; market: number | null }> | undefined): {
  low: number | null;
  high: number | null;
  market: number | null;
  sort: number;
} {
  const lows: number[] = [];
  const highs: number[] = [];
  const markets: number[] = [];
  for (const p of Object.values(prices ?? {})) {
    if (typeof p.low === "number" && p.low > 0) lows.push(p.low);
    if (typeof p.high === "number" && p.high > 0) highs.push(p.high);
    if (typeof p.market === "number" && p.market > 0) markets.push(p.market);
  }
  const low = lows.length ? Math.min(...lows) : null;
  const high = highs.length ? Math.max(...highs) : null;
  // `market` is the trustworthy current-price signal; `high` is polluted by
  // single $9,999 placeholder listings, so we never sort or headline on it.
  const market = markets.length ? Math.max(...markets) : null;
  // Sort by the strongest available price signal: max market, else high, else low.
  const sort = market ?? high ?? low ?? 0;
  return {
    low: low != null ? Math.round(low * 100) : null,
    high: high != null ? Math.round(high * 100) : null,
    market: market != null ? Math.round(market * 100) : null,
    sort: Math.round(sort * 100),
  };
}

/**
 * Build the full line data for a config: every catalog card whose slug matches
 * the line's token, enriched from the baked snapshot + sold snapshot, sorted by
 * price high → low (Moonbreon on top — the immediate wow). Synchronous.
 */
export function getLineData(config: LineConfig): LineData {
  const token = new RegExp(config.matchToken, "i");
  const nowMs = Date.now();
  const cards: LineCard[] = [];
  for (const entry of CARD_CATALOG) {
    if (!token.test(entry.slug)) continue;
    const meta = getBakedCardMetadata(entry.pokemonTcgId);
    if (!meta) continue;
    const range = tcgRange(meta.tcgplayerPrices);
    const sold = SOLD.cards[entry.slug];
    const soldCents = sold ? sold.soldCents : null;
    const soldAsOf = sold?.soldAsOf ?? null;
    const soldFresh = sold ? isSoldFresh(soldAsOf, SOLD.asOf, nowMs) : false;
    // Rank by the strongest evidence of value: max(recent sold, current
    // market). Only when a card has neither do we fall back to the low/high
    // range (range.sort), so a $9,999 placeholder `high` can never top the list.
    const rankValue = Math.max(soldCents ?? 0, range.market ?? 0) || range.sort;
    cards.push({
      slug: entry.slug,
      pokemonTcgId: entry.pokemonTcgId,
      name: meta.name,
      setName: meta.setName,
      number: meta.number,
      rarity: meta.rarity,
      releaseYear: meta.releaseDate?.match(/^(\d{4})/)?.[1] ?? null,
      image: meta.image,
      marketLowCents: range.low,
      marketHighCents: range.high,
      marketCents: range.market,
      sortPriceCents: rankValue,
      soldCents,
      soldSaleCount: sold ? sold.saleCount : 0,
      soldTierLabel: sold ? sold.tierLabel : null,
      soldAsOf,
      soldFresh,
    });
  }
  cards.sort((a, b) => b.sortPriceCents - a.sortPriceCents);
  const soldCount = cards.filter((c) => c.soldCents != null).length;
  return { config, cards, soldAsOf: SOLD.asOf, soldCount };
}

// ---------------------------------------------------------------------------
// Plain-language formatters — collector words, never finance jargon.
// A label that needs finance vocabulary to parse is a bug (ADR-095).
// ---------------------------------------------------------------------------

/** "$2,100" — whole dollars for readability; cents only under $10. */
export function usd(cents: number): string {
  const dollars = cents / 100;
  return dollars >= 10
    ? `$${Math.round(dollars).toLocaleString("en-US")}`
    : `$${dollars.toFixed(2)}`;
}

/** "Jun 7" — a compact sold date for the honest "last sold" framing. */
function soldDateLabel(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The recent-sold line in collector words, or the honest pending state. A fresh
 *  figure reads "sold recently"; a figure past the freshness window degrades to
 *  dated "last sold" framing so a stale snapshot never overclaims currency
 *  (content-trust-hotfix Defect 1, extending ADR-104 to the /lines path). */
export function soldPhrase(card: LineCard): string {
  if (card.soldCents == null) return "Sold data pending — we're tracking it.";
  if (card.soldFresh) return `Sold for ~${usd(card.soldCents)} recently`;
  const when = card.soldAsOf ? soldDateLabel(card.soldAsOf) : null;
  return when ? `Last sold ~${usd(card.soldCents)} (as of ${when})` : `Last sold ~${usd(card.soldCents)}`;
}

/**
 * The TCGplayer listed-price line in collector words. Anchors on the
 * representative `market` figure and labels it EXPLICITLY as "TCGplayer listed"
 * (content-trust-hotfix Defect 2): the TCGplayer market number is a listed
 * reference that can lag recent eBay sold results — for low-liquidity vintage it
 * runs ~2x the real sold price (Base Blastoise $229 listed vs ~$95 sold, per the
 * 2026-07-05 deals-freshness diagnosis). Calling it a plain "market" price (or,
 * worse, a "to buy right now" price) overclaims accuracy on exactly the cards a
 * sharp collector would screenshot. The raw low/high range is still not shown
 * as a headline: its `high` is polluted by single $9,999 placeholder listings.
 */
export function marketPhrase(card: LineCard): string | null {
  if (card.marketCents != null) return `TCGplayer listed ~${usd(card.marketCents)}`;
  if (card.marketLowCents == null && card.marketHighCents == null) return null;
  if (card.marketLowCents != null && card.marketHighCents != null && card.marketHighCents > card.marketLowCents) {
    return `TCGplayer listed ~${usd(card.marketLowCents)} to ${usd(card.marketHighCents)}`;
  }
  const one = card.marketHighCents ?? card.marketLowCents!;
  return `TCGplayer listed ~${usd(one)}`;
}
