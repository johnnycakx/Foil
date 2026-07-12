// The binder — pure logic behind the /start desk scene (start-binder-delight,
// 2026-07-12).
//
// The scene is a nine-pocket binder page on a desk. Filling a pocket IS adding
// a watch. Everything here is pure so the mechanics (free cap as furniture, the
// honest sold read, the one-more suggestion) are unit-pinned without a browser.

// NOTE: this module is imported by the CLIENT scene, so it must stay free of
// server-only code. It deliberately does NOT import lib/offer.ts — that pulls
// vault-seeds.ts and its node:fs read into the browser bundle (a real build
// break, caught on first render). FREE_POCKETS is therefore restated here and
// PINNED equal to FREE_WATCH_CAP in lib/__tests__/start-binder.test.ts, which
// runs in node and can see both.

import { marketFloorCents } from "../wishlist/alert-decision.ts";

/** A nine-pocket page — the most nostalgic object in the hobby. */
export const POCKETS_PER_PAGE = 9;

/** Free tier fills 3 pockets; the rest are visibly, honestly Pro. */
export const FREE_POCKETS = 3;

/** Minimum sales behind a figure before Foil will write it on a tag.
 *  Restated from lib/deals/market-movers.ts::MOVER_MIN_SALES (server-leaning
 *  imports keep that module out of the client bundle) and PINNED equal in
 *  lib/__tests__/start-binder.test.ts — same seam as FREE_POCKETS above. */
export const SUGGEST_MIN_SALES = 5;

/** The hour (UTC) of the one daily run that evaluates free watches.
 *  Restated from lib/offer.ts::FREE_ALERT_HOUR_UTC (node:fs chain — a real
 *  build break in the client) and PINNED equal in the same test. */
export const FREE_CHECK_HOUR_UTC = 17;

export type BinderCard = {
  /** Pokemon TCG SDK id — the wire id the watch API already speaks. */
  id: string;
  slug: string;
  name: string;
  setName: string;
  /** Set id + printed number — /api/start's wire contract requires both. */
  setId: string;
  number: string;
  image: string;
  /** Real recent sold average, cents. Null = no clean figure (honest absence). */
  soldCents: number | null;
  /** How many sales that figure rests on. */
  saleCount: number;
};

export type PocketState =
  | { kind: "filled"; card: BinderCard; targetUsd: string }
  | { kind: "empty" }
  | { kind: "locked" };

/**
 * The page's furniture. The free cap is not an error state — it is the binder
 * you own: three sleeves you can fill, six that are visibly Pro. Locked
 * pockets stay VISIBLE (an invitation), never hidden and never a modal.
 */
export function layoutPockets(filled: readonly BinderCard[], targets: Record<string, string>): PocketState[] {
  const out: PocketState[] = [];
  for (let i = 0; i < POCKETS_PER_PAGE; i++) {
    const card = filled[i];
    if (card) out.push({ kind: "filled", card, targetUsd: targets[card.id] ?? "" });
    else if (i < FREE_POCKETS) out.push({ kind: "empty" });
    else out.push({ kind: "locked" });
  }
  return out;
}

/** Pockets a free collector may still fill right now. */
export function freeSlotsLeft(filledCount: number): number {
  return Math.max(0, FREE_POCKETS - filledCount);
}

/**
 * The payoff line, the instant a card seats. Register rule: card-shop words.
 * TRUTH DENSITY — a card with no clean figure says so; we never invent one.
 */
export function soldLine(card: Pick<BinderCard, "soldCents" | "saleCount">): string {
  if (card.soldCents == null || card.soldCents <= 0 || card.saleCount <= 0) {
    return "No clean sold read yet. Foil starts watching from here.";
  }
  const usd = (card.soldCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const sales = card.saleCount === 1 ? "1 sale" : `${card.saleCount} sales`;
  return `Usually ${usd} · ${sales} on record`;
}

/** The pencil tag knotted to the card. Blank is a real, honest state. */
export function tagLine(targetUsd: string): string {
  const n = parseFloat(targetUsd);
  if (!targetUsd.trim() || !Number.isFinite(n) || n <= 0) return "any good price";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Why a neighbor is being suggested. The REASON is data, not decoration —
 *  the copy must say the true one (a same-set card is not "the same run"). */
export type Suggestion = {
  card: BinderCard;
  reason: "same-line" | "same-set";
};

/**
 * The "one more" loop: after a card seats, ONE quiet neighbor. Same Pokémon
 * line first (Umbreon → the other Umbreon printing), else same set. Never a
 * feed, never repeats what's already in the binder, and null when nothing
 * genuinely fits (no filler).
 *
 * TRUTH: the reason rides along so the UI can't claim a lineage that isn't
 * there — the first cut said "sits in the same run" over a same-SET fallback,
 * which was a claim the data didn't support.
 */
export function suggestNeighbor(
  seated: BinderCard,
  pool: readonly BinderCard[],
  alreadyIn: readonly string[],
): Suggestion | null {
  const taken = new Set(alreadyIn);
  const head = (name: string) => name.split(/[\s(]/)[0]!.toLowerCase();
  const kin = pool.filter((c) => !taken.has(c.id) && c.id !== seated.id);
  const sameLine = kin.find((c) => head(c.name) === head(seated.name));
  if (sameLine) return { card: sameLine, reason: "same-line" };
  const sameSet = kin.find((c) => c.setName && c.setName === seated.setName);
  return sameSet ? { card: sameSet, reason: "same-set" } : null;
}

/** The honest sentence for a suggestion — names the real relationship. */
export function suggestionLine(s: Suggestion, seated: BinderCard): string {
  if (s.reason === "same-line") {
    const head = seated.name.split(/[\s(]/)[0];
    return `Another ${head} printing.`;
  }
  return `Also from ${s.card.setName}.`;
}

// --- Foil writes the tag first (cycle 2, beat 1) -----------------------------
//
// The product's premise is that FOIL knows the market, so at the moment of
// maximum attention the agent writes the price, not the user. The number is
// the SAME below-usual basis the alert engine already runs for a blank tag
// (ADR-091: 15% under the 30-day sold average, NM axis) — imported, not
// restated, so it can never drift into new pricing math. If the basis is too
// thin, the tag honestly stays "any good price": an absent suggestion is
// correct; a fabricated one is the failure we exist to avoid.

/**
 * What Foil pencils on a fresh tag, in cents — rounded to a whole dollar so
 * the written number IS the posted number (a tag reading "under $38" must
 * arm a $38.00 watch, never $37.61 behind the collector's back).
 * Null = the basis is too thin for a suggestion (few sales, or no clean read).
 */
export function foilSuggestsCents(
  card: Pick<BinderCard, "soldCents" | "saleCount">,
): number | null {
  if (card.soldCents == null || card.soldCents <= 0) return null;
  if (card.saleCount < SUGGEST_MIN_SALES) return null;
  const floor = marketFloorCents(
    { avg30dCents: card.soldCents, saleCount: card.saleCount, tierLabel: "Near Mint", computedAt: "" },
    "any-raw",
  );
  if (floor == null || floor <= 0) return null;
  const wholeDollars = Math.round(floor / 100);
  return wholeDollars > 0 ? wholeDollars * 100 : null;
}

/** The pencil line Foil writes on the tag. */
export function foilTagLine(cents: number): string {
  return `Foil suggests: under $${Math.round(cents / 100).toLocaleString("en-US")}`;
}

// --- the heartbeat (cycle 2, beat 2) -----------------------------------------

/**
 * One quiet line after the first card seats: when Foil actually looks next.
 * TIME-HONEST — free watches are evaluated once a day at a fixed UTC hour, so
 * "tonight" would be a lie for an afternoon add. The line says "later today"
 * before that run and "tomorrow" after it, which is when the next look truly
 * happens. Pro is hourly and can say so plainly.
 */
export function heartbeatLine(isPro: boolean, utcHour: number): string {
  if (isPro) return "Foil checks this page every hour.";
  return utcHour < FREE_CHECK_HOUR_UTC
    ? "Foil checks this page later today."
    : "Foil checks this page tomorrow.";
}

// --- the booster pack (cycle 2, beat 4) --------------------------------------

/** How many cards a ripped pack deals into your hand. */
export const PACK_SIZE = 7;

/** A pack this thin isn't worth ripping — below this it stays off the desk. */
export const PACK_MIN_CARDS = 3;

/**
 * The hand a ripped pack deals: today's genuinely most-chased cards. The deck
 * arrives ranked by real sale count (market_movers order), so the pack is a
 * slice of truth, never fake randomness — the surprise is WHICH chase cards
 * are hot today. Cards without a real sold read don't belong in a pack sold
 * as "most-chased", and cards already sleeved never deal twice. An empty
 * array means the desk shows no pack at all (an honest absence).
 */
export function dealPack(deck: readonly BinderCard[], alreadyIn: readonly string[]): BinderCard[] {
  const taken = new Set(alreadyIn);
  const hand = deck
    .filter((c) => !taken.has(c.id) && c.soldCents != null && c.soldCents > 0 && c.saleCount > 0)
    .slice(0, PACK_SIZE);
  return hand.length >= PACK_MIN_CARDS ? hand : [];
}
