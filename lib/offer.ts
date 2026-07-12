// The LOCKED offer (2026-07-11 offer-lock session, ratified by John).
//
// Free: top-2 /deals teaser · weekly digest · 3 active watches checked once
// daily. Seeded gift vaults are exempt from the cap (flag on the vault's src,
// not the email). Pro $6/mo, 30-day card-required trial: unlimited watches
// checked hourly + the full daily deal drop. These constants are the single
// source of truth for the tier mechanics; copy quoting them is pinned by the
// register-rule tests.

import { SEEDED_VAULTS } from "./vault-seeds.ts";

/** Free tier: max ACTIVE (un-paused, non-gift) watches per email. */
export const FREE_WATCH_CAP = 3;

/**
 * The one hourly-cron run per day that evaluates FREE watches (17:00 UTC —
 * morning US time, after the 08:00 deals-refresh and 09:00 movers runs so a
 * free daily check reads fresh data). Pro watches run every hour.
 */
export const FREE_ALERT_HOUR_UTC = 17;

/** watchlists.src values written by seeded gift-vault claims — cap-exempt. */
const SEEDED_SRCS: ReadonlySet<string> = new Set(
  Object.values(SEEDED_VAULTS).map((v) => v.src),
);

/** Gift/seeded rows never count toward the free watch cap. */
export function countsTowardFreeCap(src: string | null | undefined): boolean {
  return !src || !SEEDED_SRCS.has(src);
}

/**
 * The cadence split (offer item 1b): pro rows are due on every hourly run;
 * free rows only on the FREE_ALERT_HOUR_UTC run. Pure so the cron filter is
 * test-pinnable.
 */
export function watchDueThisRun(tier: "free" | "pro", now: Date): boolean {
  if (tier === "pro") return true;
  return now.getUTCHours() === FREE_ALERT_HOUR_UTC;
}
