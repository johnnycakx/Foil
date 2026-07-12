// Market-temperature stat (offer item 6, 2026-07-11 scope-honesty rule).
//
// ONE number: of the cards Foil tracks that could be priced today, how many
// are selling below their own 30-day average this week (avg7d < avg30d).
// Until this stat existed, market-level claims in copy were banned — a
// thresholded movers tail is not a market sample. Rendered in card-shop
// words: "X of the N cards Foil tracks are going for less than usual this
// week."

export type TemperatureInput = {
  avg7d: number | null;
  avg30d: number | null;
};

export type TemperatureStat = { belowCount: number; totalCount: number };

/** Pure: only cards with BOTH averages count toward the universe. */
export function computeMarketTemperature(rows: TemperatureInput[]): TemperatureStat {
  let below = 0;
  let total = 0;
  for (const r of rows) {
    if (typeof r.avg7d !== "number" || typeof r.avg30d !== "number") continue;
    if (r.avg30d <= 0) continue;
    total += 1;
    if (r.avg7d < r.avg30d) below += 1;
  }
  return { belowCount: below, totalCount: total };
}

/** The card-shop rendering — shared by /deals and the drop email. */
export function temperatureSentence(t: TemperatureStat): string {
  return `${t.belowCount} of the ${t.totalCount} cards Foil tracks are going for less than usual this week.`;
}

const TEMPERATURE_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Latest stored stat, freshness-gated: a stale market read is worse than no
 * read, so anything older than a week renders nothing. Soft-fails to null.
 */
export async function getMarketTemperature(): Promise<TemperatureStat | null> {
  try {
    const { supabaseAdmin } = await import("../supabase/admin.ts");
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("market_temperature")
      .select("below_count, total_count, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || data.total_count === 0) return null;
    const age = Date.now() - Date.parse(`${data.snapshot_date}T00:00:00Z`);
    if (!Number.isFinite(age) || age > TEMPERATURE_FRESHNESS_MS) return null;
    return { belowCount: data.below_count, totalCount: data.total_count };
  } catch {
    return null;
  }
}
