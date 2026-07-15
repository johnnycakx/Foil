// Comp-staleness alarm — the metric that would have caught the 2026-07-14 audit.
//
// THE BLIND SPOT. board-freshness.ts alarms when `computed_at` ages past 26h —
// i.e. when OUR cron stops refreshing. But `computed_at` is our cache time; it
// stays green as long as the cron runs, even while the SOLD DATA it cached goes
// weeks stale (a card simply stops trading; PokeTrace keeps serving its last
// window). So the board looked healthy the whole time ~6 of 10 card pages were
// rendering month-old comps as current. Nothing measured the age of the DATA.
//
// This measures exactly that: the distribution of `sold_as_of` (the market's
// last real trade) across a CATALOG SAMPLE — deliberately NOT the movers cache,
// whose rows are all fresh by construction (classifyMomentum drops any stat
// past the freshness gate, so the stale cards are exactly the ones missing from
// it). The staleness scan (scripts/staleness-scan.ts) reads the sold spine
// directly — fresh AND stale — and feeds those dates here. It is a SUPPLEMENT
// to board-freshness, not a replacement: one watches our pipeline, this one
// watches the market's pulse. When too much of the catalog has gone quiet, that
// is a real product signal (renew PokeTrace? the vendor's ingest froze? the
// market genuinely cooled?), and it pings #errors instead of hiding.

const DAY_MS = 24 * 60 * 60 * 1000;

/** A comp older than this is "stale" for the purpose of this alarm. Aligned to
 *  SOLD_FRESHNESS_MAX_DAYS (35) — past it, a figure is no longer rendered as a
 *  "30-day" number at all, so a catalog mostly past this line means the sold
 *  surface is mostly degraded. */
export const COMP_STALE_DAYS = 35;

/** Alarm when MORE than this fraction of measured comps are stale. Not zero:
 *  low-liquidity cards are legitimately quiet, and the per-figure date already
 *  tells that truth on the page. This fires on a SYSTEMIC shift — a vendor
 *  freeze or a broad market cool — not on a few sleepy long-tail cards. */
export const COMP_STALE_ALARM_FRACTION = 0.5;

export type CompAgeInput = {
  /** sold_as_of ISO for each measured comp; null = unknown age (counts stale). */
  soldAsOfIsos: Array<string | null>;
  nowMs: number;
};

export type CompStalenessVerdict = {
  measured: number;
  /** Comps whose last sale is older than COMP_STALE_DAYS, or undated. */
  stale: number;
  staleFraction: number;
  /** Median age in whole days across DATED comps (null when none are dated). */
  medianAgeDays: number | null;
  /** p90 age in whole days across DATED comps (null when none are dated). */
  p90AgeDays: number | null;
  /** Comps with no sold_as_of at all — the pre-migration / upstream-silent set. */
  undated: number;
  /** True when staleFraction exceeds the alarm threshold on a non-trivial sample. */
  alarm: boolean;
};

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

/** Pure: turn a batch of comp dates into a staleness verdict. */
export function assessCompStaleness(input: CompAgeInput): CompStalenessVerdict {
  const measured = input.soldAsOfIsos.length;
  const ages: number[] = [];
  let undated = 0;
  let stale = 0;

  for (const iso of input.soldAsOfIsos) {
    if (!iso) {
      undated += 1;
      stale += 1; // unknown age is treated as stale — never as fresh
      continue;
    }
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) {
      undated += 1;
      stale += 1;
      continue;
    }
    const ageDays = Math.max(0, Math.floor((input.nowMs - t) / DAY_MS));
    ages.push(ageDays);
    if (ageDays > COMP_STALE_DAYS) stale += 1;
  }

  ages.sort((a, b) => a - b);
  const staleFraction = measured === 0 ? 0 : stale / measured;
  // Guard the alarm on a non-trivial sample so a near-empty cache (an unrelated
  // outage) can't itself trip a false "market has gone stale" ping.
  const alarm = measured >= 20 && staleFraction > COMP_STALE_ALARM_FRACTION;

  return {
    measured,
    stale,
    staleFraction,
    medianAgeDays: quantile(ages, 0.5),
    p90AgeDays: quantile(ages, 0.9),
    undated,
    alarm,
  };
}

/** The #errors message body — plain words, the true numbers. */
export function compStalenessAlarmMessage(v: CompStalenessVerdict): string {
  const pct = Math.round(v.staleFraction * 100);
  return (
    `Sold-comp data has gone quiet: ${v.stale}/${v.measured} cached comps (${pct}%) are older than ` +
    `${COMP_STALE_DAYS} days${v.undated ? ` (${v.undated} with no sale date at all)` : ""}. ` +
    `Median comp age ${v.medianAgeDays ?? "?"}d, p90 ${v.p90AgeDays ?? "?"}d. ` +
    `Card pages now DATE every figure so this degrades honestly, but a systemic jump means the sold ` +
    `spine is cooling — check the PokeTrace key/renewal and the market-movers (09:00 UTC) cron.`
  );
}
