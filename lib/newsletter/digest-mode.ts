// Newsletter digest loop run mode (ADR-077). Two modes — there is NO "live"
// because the no-spend rail cannot auto-send (Beehiiv RSS-to-Send is a
// Max/Enterprise feature, not on Scale). "approval" is as automated as Scale
// allows: generate -> Discord /approve -> email the paste-ready issue.
//
//   - off      : the weekly cron no-ops. The SAFE DEFAULT — deploying the code
//                does not start posting approval cards until John opts in.
//   - approval : generate the digest, persist it, and post a Discord approval
//                card; on /approve, email the paste-ready HTML to the founder.
//
// Resolution: NEWSLETTER_DIGEST_MODE must be exactly "approval" (case-
// insensitive) to enable; anything else (incl. unset) -> off.

export type NewsletterDigestMode = "off" | "approval";

export function resolveNewsletterDigestMode(
  env: Record<string, string | undefined>,
): NewsletterDigestMode {
  return (env.NEWSLETTER_DIGEST_MODE ?? "").trim().toLowerCase() === "approval"
    ? "approval"
    : "off";
}

/**
 * ISO-8601 week tag for `date`, e.g. "2026-W26". The digest is one-per-ISO-week;
 * this is the idempotency key (unique column). Pure; the caller passes the clock.
 */
export function isoWeekTag(date: Date): string {
  // Copy to UTC midnight so DST / local offset can't shift the week boundary.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week: Thursday of the current week determines the year + week number.
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // move to Thursday
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
