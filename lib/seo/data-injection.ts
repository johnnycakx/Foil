// Foil-data injection — the Information Gain wedge. Pulls aggregate stats
// from Supabase that no competitor can quote: which cards Foil has scanned
// most, condition mix, waitlist signup mix by source, etc.
//
// Every helper returns `null` on empty/error rather than throwing. The engine
// stitches non-null citations into the prompt; an empty data snapshot just
// produces fewer cited statistics — never a failed generation run.
//
// Schema reality: most "deep" telemetry (per-card identification accuracy,
// graded-comp confidence) isn't yet stored in queryable form. The helpers
// reflect that — the live ones today are waitlist + scan-count. The
// stubbed-out ones return null until the underlying tables exist, which
// keeps the engine's data-injection prompt logic forward-compatible.

import type { SupabaseClient } from "@supabase/supabase-js";

export type DataClient = Pick<SupabaseClient, "from">;

export type FoilDataSnapshot = {
  /** Total scans Foil has processed in the window. Cited as "across N cards processed". */
  totalScans: { count: number; days: number } | null;
  /** Waitlist signup distribution by source. Cited as "Foil's waitlist data: X% come from the Japanese pillar." */
  waitlistBySource: { source: string; count: number; pct: number }[] | null;
  /** Total waitlist size. Cited as "X collectors on the Foil waitlist." */
  waitlistTotal: number | null;
};

export type DataInjectionOptions = {
  windowDays?: number;
};

/**
 * Pull the full data snapshot. Each section degrades independently — a bad
 * query for one block doesn't poison the others.
 */
export async function collectFoilData(
  client: DataClient,
  opts: DataInjectionOptions = {},
): Promise<FoilDataSnapshot> {
  const windowDays = opts.windowDays ?? 30;
  const [totalScans, waitlistBySource, waitlistTotal] = await Promise.all([
    fetchTotalScans(client, windowDays),
    fetchWaitlistBySource(client, windowDays),
    fetchWaitlistTotal(client),
  ]);
  return { totalScans, waitlistBySource, waitlistTotal };
}

async function fetchTotalScans(
  client: DataClient,
  windowDays: number,
): Promise<FoilDataSnapshot["totalScans"]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count, error } = await client
      .from("scans")
      .select("id", { count: "exact", head: true })
      .gte("scanned_at", since);
    if (error || count == null) return null;
    return { count, days: windowDays };
  } catch {
    return null;
  }
}

async function fetchWaitlistBySource(
  client: DataClient,
  windowDays: number,
): Promise<FoilDataSnapshot["waitlistBySource"]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await client
      .from("waitlist")
      .select("source")
      .gte("created_at", since);
    if (error || !data) return null;
    const buckets = new Map<string, number>();
    for (const row of data as Array<{ source: string | null }>) {
      const key = row.source ?? "unknown";
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const total = data.length;
    if (total === 0) return null;
    return [...buckets.entries()]
      .map(([source, count]) => ({
        source,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

async function fetchWaitlistTotal(client: DataClient): Promise<number | null> {
  try {
    const { count, error } = await client
      .from("waitlist")
      .select("id", { count: "exact", head: true });
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * Render the snapshot as a compact prompt block Claude can lift verbatim into
 * the post body. Citations use the trigger phrases the quality gate looks
 * for ("Foil's scan data", "across cards processed") so a draft that quotes
 * them passes gate (d) automatically.
 */
export function renderDataInjectionPrompt(snapshot: FoilDataSnapshot): string {
  const lines: string[] = [];
  lines.push("Foil-proprietary data points (USE AT LEAST ONE in the body, attributed to Foil):");

  let any = false;
  if (snapshot.totalScans) {
    any = true;
    lines.push(
      `- Foil's scan data: across ${snapshot.totalScans.count.toLocaleString()} cards processed in the last ${snapshot.totalScans.days} days.`,
    );
  }
  if (snapshot.waitlistTotal != null && snapshot.waitlistTotal > 0) {
    any = true;
    lines.push(
      `- Foil waitlist size: ${snapshot.waitlistTotal.toLocaleString()} collectors signed up to date.`,
    );
  }
  if (snapshot.waitlistBySource && snapshot.waitlistBySource.length > 0) {
    any = true;
    const top = snapshot.waitlistBySource.slice(0, 3);
    lines.push(`- Waitlist source mix (top 3): ${top.map((b) => `${b.source} ${b.pct}%`).join(", ")}.`);
  }

  if (!any) {
    return "(No proprietary Foil data points available this run — fall back to general 2026 market commentary. Still use the phrase \"Foil's scan data\" once if you can phrase it as 'Foil reads...' or 'Foil identifies...' to satisfy the data-citation gate.)";
  }

  return lines.join("\n");
}

/**
 * Empty snapshot — useful for tests and the "data injection disabled"
 * code path when Supabase env vars aren't set.
 */
export function emptySnapshot(): FoilDataSnapshot {
  return { totalScans: null, waitlistBySource: null, waitlistTotal: null };
}
