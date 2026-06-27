// Daily X-post angle rotation (ADR-058). Pure + deterministic.
//
// The /deals board can be thin (1-3 confident deals on a quiet day), so posting
// "deal of the day" every day would go stale fast. We rotate three angles by
// day so the feed stays varied even when the board is small:
//   1. deal_of_day   — the top buy_signals BELOW, with REAL numbers.
//   2. price_spotlight — a popular card's recent market price (the utility/
//      headline framing). Uses PokeTrace-sourced sold data (R-008-safe), NOT a
//      live eBay ask, so nothing eBay-sourced is persisted in a draft.
//   3. educational   — founder / how-it-works / the condition + Japanese-vs-
//      English matching trust differentiator. No live data needed.
//
// Rotation is by UTC day-number so it's deterministic (testable, and the same
// across a day's retries). If "deal_of_day" lands on a day with zero confident
// BELOW deals, the caller falls back to the next angle (see bot.ts) — the
// rotation picks the *intended* angle; availability is resolved downstream.

export type PostAngle = "deal_of_day" | "price_spotlight" | "educational" | "weekly_board";

// The DAILY rotation. `weekly_board` is NOT in the rotation — it's a weekly
// day-of-week override (see resolveAngle + WEEKLY_BOARD_UTC_DAY).
export const POST_ANGLES: readonly PostAngle[] = ["deal_of_day", "price_spotlight", "educational"];

// The weekly "best deals" board posts on this UTC weekday (1 = Monday) when
// there are enough fresh movers to fill it.
export const WEEKLY_BOARD_UTC_DAY = 1;
export const WEEKLY_BOARD_MIN_DEALS = 3;

/** UTC day number since the epoch (date-only, tz-stable). */
export function utcDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

/** The intended angle for a given date — cycles deal → spotlight → educational. */
export function angleForDate(date: Date): PostAngle {
  return POST_ANGLES[utcDayNumber(date) % POST_ANGLES.length];
}

/**
 * Resolve the angle to actually use given what data is available. The deal_of_day
 * angle needs at least one confident BELOW deal; when the board is empty that day
 * we fall back to price_spotlight, then educational (which always works). This
 * keeps a thin board from producing a contentless "deal of the day" post.
 */
export function resolveAngle(
  date: Date,
  opts: { hasDeal: boolean; hasSpotlight: boolean; hasBoard?: boolean },
): PostAngle {
  // Weekly digest override: on the board day, the board wins when we have enough
  // fresh movers to fill it. Otherwise fall through to the daily rotation.
  if (date.getUTCDay() === WEEKLY_BOARD_UTC_DAY && opts.hasBoard) {
    return "weekly_board";
  }
  const intended = angleForDate(date);
  if (intended === "deal_of_day" && !opts.hasDeal) {
    return opts.hasSpotlight ? "price_spotlight" : "educational";
  }
  if (intended === "price_spotlight" && !opts.hasSpotlight) {
    return opts.hasDeal ? "deal_of_day" : "educational";
  }
  return intended;
}
