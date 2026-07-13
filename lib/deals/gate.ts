// /deals gated-teaser logic (ADR-112; copy re-locked by the 2026-07-11
// offer-lock session; free tier re-stated as one binder page by the
// 2026-07-12 cycle-3 brief).
//
// The board shows the top 2 deals fully (the public proof-it's-real teaser)
// and gates the rest. THE DROP IS PRO'S DELIVERABLE now, so the gate sells
// the trial ("Pro sees everything Foil finds, first") and catches the
// not-ready with the free tier (one binder page + the weekly digest). THIN-DAY
// HONESTY is unchanged and non-negotiable: supply is 0–6 deals/day and the
// gate must NEVER fabricate a locked count. If there aren't more than 2
// deals, there's nothing to lock. Say so.
//
// Pure + exported so the split + copy are unit-tested without a live board.

export const TEASER_COUNT = 2;

export type DealsGateState = {
  /** How many deals render fully (the public teaser). */
  shownCount: number;
  /** How many deals are gated as visibly-locked rows (0 on thin days). */
  lockedCount: number;
  /** Gate heading — count-aware, never a fabricated number. */
  headline: string;
  /** Gate supporting line. Always names Pro (the drop is Pro's deliverable). */
  subtext: string;
};

export function dealsGateState(totalToday: number): DealsGateState {
  const total = Number.isFinite(totalToday) && totalToday > 0 ? Math.floor(totalToday) : 0;
  const shownCount = Math.min(TEASER_COUNT, total);
  const lockedCount = Math.max(0, total - TEASER_COUNT);

  if (lockedCount > 0) {
    const buys = lockedCount === 1 ? "buy" : "buys";
    return {
      shownCount,
      lockedCount,
      // LOCKED copy (offer item 3): N is the real locked count, never invented.
      headline: `${lockedCount} more good ${buys} today.`,
      subtext: "Pro sees everything Foil finds, first.",
    };
  }

  if (total === 0) {
    return {
      shownCount: 0,
      lockedCount: 0,
      headline: "Nothing worth locking today.",
      subtext:
        "That's the honest read. Some days the market is quiet and Foil won't fake a deal. Pro members hear it first the day there's a real buy.",
    };
  }

  // 1–2 deals: everything's already shown — no fake lock.
  return {
    shownCount,
    lockedCount: 0,
    headline: "That's the whole board today.",
    subtext: "Pro gets every real buy Foil finds in the daily drop, first.",
  };
}
