// /deals gated-teaser logic (validation-sprint Phase 3, ADR-112).
//
// The board shows the top 2 deals fully (the public proof-it's-real teaser) and
// gates the rest behind an email drop-subscribe. THIN-DAY HONESTY is the whole
// point: supply is 0–6 deals/day, so the gate must NEVER fabricate a locked
// count. If there aren't more than 2 deals, there's nothing to lock — say so
// ("nothing worth locking today" — the trust flex) instead of inventing rows.
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
  /** Gate supporting line. Always contains "get the drop" (the content marker). */
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
      headline: `${lockedCount} more good ${buys} today`,
      subtext: "Get the drop — the day's best buys, priced on real sold data, straight to your inbox.",
    };
  }

  if (total === 0) {
    return {
      shownCount: 0,
      lockedCount: 0,
      headline: "Nothing worth locking today.",
      subtext:
        "That's the honest read — some days the market's quiet, and we won't fake a deal. Get the drop the day there's a real buy.",
    };
  }

  // 1–2 deals: everything's already shown — no fake lock.
  return {
    shownCount,
    lockedCount: 0,
    headline: "That's the whole board today.",
    subtext: "Get the drop the moment there's more — real sold data, never filler.",
  };
}
