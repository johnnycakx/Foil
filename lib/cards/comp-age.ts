// Comp AGE — the date a sold figure is entitled to, everywhere it renders.
//
// THE DEFECT THIS CLOSES (audit 2026-07-14). `isFreshStat` (sold-coherence.ts)
// admits any sold figure whose most recent sale is within SOLD_FRESHNESS_MAX_DAYS
// (35), and the render path then THREW THE DATE AWAY: `SoldHeadlineModel` and
// `HeroSoldStat` carried no date field at all. Only the DEGRADED paths (dated
// last-sale, dated listed fallback, honest "pending") ever showed a date. So the
// pass branch — the one on ~6 of 10 card pages — rendered a possibly-five-week-old
// number as if it were current, under a hardcoded "refreshed hourly" line that
// described our POLL, not the DATA.
//
// The freshness gate was never the lie. Discarding the date was. A 1-day-old comp
// and a 30-day-old comp are both "fresh" by the gate and must NOT read the same.
//
// Doctrine (extends the null-over-guess line to the time axis): a sold figure is
// a claim about a MOMENT. Render the moment with the number, or render neither.
// This module is the ONE place that turns a comp's timestamp into copy, so the
// card hero, the sold panel, and the alert email cannot drift apart.

const DAY_MS = 24 * 60 * 60 * 1000;

/** At or under this age, the date alone carries the truth ("as of Jul 13").
 *  Past it, we say the age OUT LOUD ("as of Jul 1 · 13 days ago") — a reader
 *  should never have to do date arithmetic to discover a number is stale. */
export const COMP_AGE_PLAIN_MAX_DAYS = 1;

/** Whole days between the comp's most recent sale and now. Never negative
 *  (clock skew on a same-day sale must not read as "-0 days ago"). */
export function compAgeDays(asOfIso: string, nowMs: number): number | null {
  const t = Date.parse(asOfIso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / DAY_MS));
}

/** "Jul 1" / "Jul 1, 2025" — year only when it isn't the current one (a 2024
 *  sale must never read as this year's). UTC to match the upstream stamp. */
export function formatCompDate(asOfIso: string, nowMs: number): string | null {
  const t = Date.parse(asOfIso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const sameYear = d.getUTCFullYear() === new Date(nowMs).getUTCFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/**
 * The canonical age line for a sold figure. Null when the timestamp is
 * unparseable — and a null age means the surface must render NO figure
 * (an undated sold number is exactly the thing this module exists to forbid).
 *
 *   0-1 days  → "as of Jul 14"
 *   2+ days   → "as of Jul 1 · 13 days ago"
 */
export function compAgeLabel(asOfIso: string, nowMs: number): string | null {
  const days = compAgeDays(asOfIso, nowMs);
  const date = formatCompDate(asOfIso, nowMs);
  if (days == null || date == null) return null;
  if (days <= COMP_AGE_PLAIN_MAX_DAYS) return `as of ${date}`;
  return `as of ${date} · ${days} day${days === 1 ? "" : "s"} ago`;
}
