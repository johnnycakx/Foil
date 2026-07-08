// Funnel-report aggregation (validation-sprint Phase 3, ADR-112). Pure +
// testable — the script (scripts/funnel-report.ts) does the I/O and calls these.
//
// The three signals the bounded ads test measures: signup% (by utm source),
// trial-start%, trial→paid%. HONESTY: signup% and trial-start% as TRUE
// conversion rates need the ad platform's impressions/clicks (the denominator we
// don't have server-side), so this reports the raw counts + the one rate we CAN
// compute from our own data — trial→paid among trials that have RESOLVED.

export type SignupRow = {
  source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
  unsubscribed_at: string | null;
};

export type SubRow = {
  status: string | null;
  tier: string | null;
  stripe_subscription_id: string | null;
};

/** Group rows by a key, sorted by count desc. `(none)` for null keys. */
export function tallyBy<T>(rows: T[], key: (r: T) => string | null): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "(none)";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const CHURNED_STATUSES = ["canceled", "past_due", "unpaid", "incomplete_expired"];

export type SubscriptionFunnel = {
  /** Rows that went through Checkout (have a subscription id → a trial started). */
  trialsStarted: number;
  /** Still inside the free trial. */
  trialing: number;
  /** Converted to paying (status active — past the trial, card charged). */
  converted: number;
  /** Trial ended without converting (canceled/past_due/…). */
  churned: number;
  /** converted / (converted + churned) — the rate among trials that have
   *  RESOLVED (left `trialing`). Null until at least one trial resolves. */
  trialToPaidPct: number | null;
};

export function summarizeSubscriptions(rows: SubRow[]): SubscriptionFunnel {
  const trials = rows.filter((r) => !!r.stripe_subscription_id);
  const trialing = trials.filter((r) => r.status === "trialing").length;
  const converted = trials.filter((r) => r.status === "active").length;
  const churned = trials.filter((r) => CHURNED_STATUSES.includes(r.status ?? "")).length;
  const resolved = converted + churned;
  return {
    trialsStarted: trials.length,
    trialing,
    converted,
    churned,
    trialToPaidPct: resolved > 0 ? (converted / resolved) * 100 : null,
  };
}
