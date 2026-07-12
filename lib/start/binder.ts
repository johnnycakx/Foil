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

/** A nine-pocket page — the most nostalgic object in the hobby. */
export const POCKETS_PER_PAGE = 9;

/** Free tier fills 3 pockets; the rest are visibly, honestly Pro. */
export const FREE_POCKETS = 3;

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
