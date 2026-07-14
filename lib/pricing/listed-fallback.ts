// LISTED-basis fallback — what a card page shows when the sold spine is dark
// (pricing-bridge, ADR-118).
//
// THE LAPSE PROBLEM. The PokeTrace key lapses ~2026-07-15 (R-070). Premise-
// checked in code: a missing/401 key makes `lib/poketrace/by-uuid.ts` return
// null (graceful, never a crash), so `getHeroSoldStat` returns null and EVERY
// card page falls to "Sold data pending for this card." Honest — and useless.
// The site would lose its price data entirely, on every card, in one day.
//
// THE SOURCE, AND WHY IT ISN'T A NEW VENDOR. The spike proposed a tcgcsv
// adapter. It isn't needed: the committed catalog snapshot ALREADY carries
// `tcgplayerPrices` (per variantKey — the same key scheme the card page's
// variant picker uses) plus `tcgplayerUpdatedAt`, baked from pokemontcg.io.
// Measured 2026-07-14: 2,705 of 3,248 cards priced (83%). So the fallback is
// zero new vendors, zero new keys, zero id-mapping, zero network — and it
// survives a PokeTrace lapse by construction, because it never touches
// PokeTrace.
//
// WHAT IT IS NOT. TCGplayer market/low/mid are an asking-price index, NOT sold
// comps. This module can therefore only ever emit `basis: "listed"`, and the
// type system stops that from reaching a sold-labeled surface (see basis.ts).
// It renders under LISTED_LABEL with its date. It is a fallback, not a
// promotion: when sold data exists, sold wins, always.
//
// NO PER-CONDITION SPLIT. TCGplayer prices are per PRINTING (holofoil,
// reverseHolofoil, …), never per CONDITION (NM/LP/MP/HP/DMG). A listed figure
// must never be dressed as a condition-laddered number — it answers "roughly
// what does this printing ask" and nothing more.

import { LISTED_LABEL, type ListedBasisPrice } from "./basis.ts";

/** A listed figure older than this is suppressed rather than shown. Beyond a
 *  month, an asking-price index is not evidence of anything current, and the
 *  honest render is nothing. (Distinct from SOLD_FRESHNESS_MAX_DAYS = 35: sold
 *  data earns a longer leash because a real completed sale stays a fact.) */
export const LISTED_FRESHNESS_MAX_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The baked per-printing price block (lib/cards/sdk.ts TcgPlayerVariantPrice). */
export type TcgPlayerVariantPrice = {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
};

export type ListedFallback = ListedBasisPrice & {
  /** The printing this figure describes ("holofoil", "normal", …). */
  variantKey: string;
  /** The canonical label a surface MUST render it under. */
  label: string;
  /** Age in whole days at resolution time (for the honest "as of" copy). */
  ageDays: number;
};

/**
 * pokemontcg.io stamps `updatedAt` as "2026/07/01" (slash), not ISO. Parse
 * both, and return null on anything unrecognizable — an unparseable date is
 * an UNKNOWN age, which we treat as stale (never as fresh).
 */
export function parseListedDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = raw.trim().split("T")[0].replace(/-/g, "/");
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** The most representative asking figure for a printing: market (TCGplayer's
 *  own sales-derived index) → mid → low. Never `high` (a $9,999 ceiling ask is
 *  noise, not a price — see base1-2's high in the snapshot). */
export function representativeAmount(price: TcgPlayerVariantPrice): number | null {
  for (const candidate of [price.market, price.mid, price.low]) {
    if (typeof candidate === "number" && candidate > 0) return candidate;
  }
  return null;
}

/**
 * Resolve the labeled listed fallback for a card, or null.
 *
 * Preference: the SELECTED printing (so the fallback answers the same question
 * the page is asking), else the priciest available printing's representative
 * figure — the card's headline printing in practice.
 *
 * Returns null (not a guess) when: no prices, no usable amount, or the figure
 * is older than LISTED_FRESHNESS_MAX_DAYS. Null keeps the honest pending line.
 */
export function resolveListedFallback(
  prices: Record<string, TcgPlayerVariantPrice> | undefined,
  updatedAtRaw: string | undefined,
  selectedVariantKey: string | undefined,
  nowMs: number,
): ListedFallback | null {
  if (!prices) return null;

  const updatedAt = parseListedDate(updatedAtRaw);
  if (!updatedAt) return null; // unknown age → stale by default
  const ageMs = nowMs - updatedAt.getTime();
  if (ageMs > LISTED_FRESHNESS_MAX_DAYS * DAY_MS) return null;
  const ageDays = Math.max(0, Math.floor(ageMs / DAY_MS));

  const candidates: Array<{ variantKey: string; amount: number }> = [];
  for (const [variantKey, price] of Object.entries(prices)) {
    const amount = representativeAmount(price);
    if (amount != null) candidates.push({ variantKey, amount });
  }
  if (candidates.length === 0) return null;

  const selected =
    (selectedVariantKey && candidates.find((c) => c.variantKey === selectedVariantKey)) ||
    [...candidates].sort((a, b) => b.amount - a.amount)[0];

  return {
    source: "tcgplayer",
    basis: "listed",
    amount: selected.amount,
    lastUpdated: updatedAt.toISOString(),
    variantKey: selected.variantKey,
    label: LISTED_LABEL,
    ageDays,
  };
}
