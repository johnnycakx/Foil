// Board-freshness alarm (quality-bar-fixes P0-3, 2026-07-13).
//
// The P0-3 investigation found the pipeline was NOT dead (buy_signals +
// market_movers + market_snapshots all continuous through the "stale" window)
// — but nothing WOULD have told us if it had been: buy_signals is replaced
// per-run (no history), soft-fail everywhere means a dead cron renders a calm
// empty board, and the page stamped a bare date with no cadence promise, so a
// small-hours visitor reads "yesterday" as "dead". This module is the alarm
// half of the fix: a board older than STALE_AFTER_HOURS pings #errors from the
// hourly hydrate cron. The honest-timestamp half lives on the /deals page.
//
// Pure decision logic, injectable clock — pinned in
// lib/__tests__/board-freshness.test.ts.

export const STALE_AFTER_HOURS = 26;

export type FreshnessInput = {
  /** max(computed_at) from buy_signals, ISO string, null = empty table. */
  signalsMax: string | null;
  /** max(computed_at) from market_movers, ISO string, null = empty table. */
  moversMax: string | null;
  now: Date;
};

export type FreshnessVerdict = {
  stale: boolean;
  /** Which sources crossed the threshold (for the #errors message). */
  staleSources: Array<{ source: "buy_signals" | "market_movers"; ageHours: number }>;
  /**
   * Ping at most once per stale source per UTC day: the first hourly check
   * after crossing 26h, then again each further 24h (26–27h, 50–51h, …).
   * Keeps a multi-day outage visible without an hourly #errors flood.
   */
  shouldPing: boolean;
};

function ageHours(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - t) / 3_600_000;
}

export function checkBoardFreshness(input: FreshnessInput): FreshnessVerdict {
  const staleSources: FreshnessVerdict["staleSources"] = [];
  for (const [source, iso] of [
    ["buy_signals", input.signalsMax],
    ["market_movers", input.moversMax],
  ] as const) {
    const age = ageHours(iso, input.now);
    if (age > STALE_AFTER_HOURS) {
      staleSources.push({ source, ageHours: Number.isFinite(age) ? Math.floor(age) : -1 });
    }
  }
  const shouldPing = staleSources.some((s) => {
    // Empty table (age = -1 marker): always the first-and-daily cadence via
    // the modulo on a large sentinel is meaningless, so ping on the hour 0
    // check of each UTC day instead.
    if (s.ageHours < 0) return input.now.getUTCHours() === 10; // once daily, after the 08/09 UTC runs
    return (s.ageHours - STALE_AFTER_HOURS) % 24 < 1;
  });
  return { stale: staleSources.length > 0, staleSources, shouldPing };
}

/** The #errors message body — plain words, includes the true ages. */
export function freshnessAlarmMessage(v: FreshnessVerdict): string {
  const parts = v.staleSources.map((s) =>
    s.ageHours < 0
      ? `${s.source} is EMPTY`
      : `${s.source} last wrote ${s.ageHours}h ago`,
  );
  return `/deals board is stale (threshold ${STALE_AFTER_HOURS}h): ${parts.join(" · ")}. The board promises daily refresh; check the deals-refresh (08:00 UTC) and market-movers (09:00 UTC) crons and the PokeTrace key.`;
}
