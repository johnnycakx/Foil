// Browse API call telemetry. See ADR-025.
//
// Single module owns the browse_calls table. Three exports:
//   - logBrowseCall: fire-and-forget insert from the Browse client
//     instrumentation. Never throws. Logging failure NEVER blocks a render.
//   - aggregateLast24h / aggregateLast7Days: read-side rollups consumed by
//     the daily telemetry cron's Discord summary.
//
// R-008 compliance: this table stores ONLY operational metadata — when the
// call happened, which surface initiated it, whether it succeeded, how long
// it took. NO listing payload (no title, no price, no item URL, no card
// identifier). That distinction is enforced by the schema (`browse_calls`
// migration) and by the input shape of logBrowseCall — there is no way to
// pass a price or a URL through this API.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { Database } from "../supabase/types.ts";

export const BROWSE_DAILY_CEILING = 5000;
export const APPROACHING_CEILING_PCT = 80;

export type BrowseSurface = "page_render" | "wishlist_cron" | "manual";

export type LogBrowseCallInput = {
  surface: BrowseSurface;
  success: boolean;
  latency_ms: number;
};

export type Aggregate24h = {
  total: number;
  byCounts: Record<BrowseSurface, number>;
  successCount: number;
  /** 0–100. 100 when total === 0 (no failures yet). */
  successRatePct: number;
  /** total / BROWSE_DAILY_CEILING * 100 — 0–∞ (can exceed 100 on overage). */
  pctOfCeiling: number;
  /** True when pctOfCeiling >= APPROACHING_CEILING_PCT. */
  approachingCeiling: boolean;
};

export type Aggregate7Day = {
  /** Counts per day, oldest first. Always length 7. Day buckets are UTC. */
  daily: Array<{ date: string; total: number }>;
};

/**
 * Fire-and-forget insert. Returns a Promise that resolves to ok/error so
 * callers can await if they want to (tests do), but the instrumentation
 * site MUST NOT await it on the hot path — that would put a Supabase
 * round-trip in front of every page render.
 *
 * Soft-fail: any error path resolves to `{ok: false, error: <msg>}`.
 * Never throws.
 */
export async function logBrowseCall(
  input: LogBrowseCallInput,
  opts: { client?: SupabaseClient<Database> } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = opts.client ?? supabaseAdmin();
    const { error } = await admin.from("browse_calls").insert({
      surface: input.surface,
      success: input.success,
      latency_ms: input.latency_ms,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Rollup of browse_calls rows for the last 24 hours, broken down by surface.
 * Used by the daily telemetry cron's Discord embed.
 *
 * Returns zeroed-out shape on query error so the cron can post "0 calls,
 * 0% of ceiling" rather than 500.
 */
export async function aggregateLast24h(opts: {
  client?: SupabaseClient<Database>;
  now?: Date;
} = {}): Promise<Aggregate24h> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const empty: Aggregate24h = {
    total: 0,
    byCounts: { page_render: 0, wishlist_cron: 0, manual: 0 },
    successCount: 0,
    successRatePct: 100,
    pctOfCeiling: 0,
    approachingCeiling: false,
  };
  try {
    const admin = opts.client ?? supabaseAdmin();
    const { data, error } = await admin
      .from("browse_calls")
      .select("surface, success")
      .gte("called_at", cutoff);
    if (error || !data) return empty;
    const out: Aggregate24h = {
      total: data.length,
      byCounts: { page_render: 0, wishlist_cron: 0, manual: 0 },
      successCount: 0,
      successRatePct: 100,
      pctOfCeiling: 0,
      approachingCeiling: false,
    };
    for (const row of data) {
      out.byCounts[row.surface as BrowseSurface] =
        (out.byCounts[row.surface as BrowseSurface] ?? 0) + 1;
      if (row.success) out.successCount += 1;
    }
    out.successRatePct = out.total === 0 ? 100 : Math.round((out.successCount / out.total) * 1000) / 10;
    const rawPct = (out.total / BROWSE_DAILY_CEILING) * 100;
    out.pctOfCeiling = Math.round(rawPct * 10) / 10;
    // Compare against the UNROUNDED percent so a row count of 3,999 (79.98%)
    // doesn't trip the flag after we round it to 80.0 for display.
    out.approachingCeiling = rawPct >= APPROACHING_CEILING_PCT;
    return out;
  } catch {
    return empty;
  }
}

/**
 * Daily totals for the last 7 days (oldest first). Used by the telemetry
 * cron to render a text-chart of the trend ("17 → 22 → 38 → 45 → …").
 * Day boundaries are UTC.
 */
export async function aggregateLast7Days(opts: {
  client?: SupabaseClient<Database>;
  now?: Date;
} = {}): Promise<Aggregate7Day> {
  const now = opts.now ?? new Date();
  // Walk 7 UTC-midnight buckets, oldest first.
  const days: Array<{ start: Date; end: Date; iso: string }> = [];
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = 6; i >= 0; i--) {
    const start = new Date(midnight.getTime() - i * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    days.push({ start, end, iso: start.toISOString().slice(0, 10) });
  }
  const empty: Aggregate7Day = {
    daily: days.map((d) => ({ date: d.iso, total: 0 })),
  };
  try {
    const admin = opts.client ?? supabaseAdmin();
    const oldest = days[0].start.toISOString();
    const { data, error } = await admin
      .from("browse_calls")
      .select("called_at")
      .gte("called_at", oldest);
    if (error || !data) return empty;

    const counts = new Map<string, number>(days.map((d) => [d.iso, 0]));
    for (const row of data) {
      const t = new Date(row.called_at).getTime();
      for (const d of days) {
        if (t >= d.start.getTime() && t < d.end.getTime()) {
          counts.set(d.iso, (counts.get(d.iso) ?? 0) + 1);
          break;
        }
      }
    }
    return { daily: days.map((d) => ({ date: d.iso, total: counts.get(d.iso) ?? 0 })) };
  } catch {
    return empty;
  }
}

/**
 * Sweep rows older than the retention window. Called by the daily telemetry
 * cron as a single statement; runs in ~ms because of the called_at index.
 * 90-day rolling window — long enough to cite trends in a Growth Check
 * application, short enough to keep the table bounded.
 */
export async function purgeOlderThan(
  retentionDays: number,
  opts: { client?: SupabaseClient<Database>; now?: Date } = {},
): Promise<{ ok: boolean; deletedApprox?: number; error?: string }> {
  try {
    const now = opts.now ?? new Date();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const admin = opts.client ?? supabaseAdmin();
    const { error, count } = await admin
      .from("browse_calls")
      .delete({ count: "exact" })
      .lt("called_at", cutoff);
    if (error) return { ok: false, error: error.message };
    return { ok: true, deletedApprox: count ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
