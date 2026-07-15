// Market-movers / "good buys" momentum signal (ADR-069). The insight-led core
// that replaces fragile single-listing deals as the LEAD signal across the
// newsletter, the /deals board, and (later) X.
//
// THE BUG THIS REFRAMES (John, 2026-06-25): the live /deals board flagged
// "Umbreon VMAX 215/203 · Near Mint · $2,161 · 31% below sold" but pointed at a
// £1,000 Lightly-Played UK listing. A SINGLE-listing signal breaks when one
// listing's condition/region/currency is mismatched. A MARKET aggregate ("NM
// Umbreon VMAX is down 12% vs its 30-day average") cannot break that way — it's
// computed from PokeTrace's windowed sold averages, not one live listing.
//
// Momentum = (avg7d - avg30d) / avg30d at the NEAR_MINT tier (the reference
// raw condition). Classified "good buy (down)" when avg7d sits below avg30d by
// >= a threshold AND the sale count clears a sample floor (thin/noisy cards are
// excluded). A secondary "heating up (up)" list surfaces the inverse.
//
// HONESTY (enforced here, not by an LLM): every figure is a real PokeTrace
// aggregate — avg7d, avg30d, saleCount, verbatim. A "good buy" is a CANDIDATE
// trading below its OWN recent average, never a guarantee. Sample-size gated.
//
// Pure + injectable, mirroring lib/deals/refresh-batch.ts: the cron route
// injects the live deps (getCardMetadata + getSoldHistory); tests inject fakes.
// Momentum is PokeTrace-only — NO eBay Browse call — so it never spends the
// eBay quota (R-012) and runs over the full curated tier independently.

import type { CardMetadata } from "../cards/sdk.ts";
import type { SoldHistory, SoldStat, SoldSource } from "../poketrace/by-uuid.ts";
import { isFreshStat } from "../cards/sold-coherence.ts";

/** Curated catalog entry the cron iterates (slug + SDK id). Same shape as the
 *  deals-refresh batch so the route builds one entry list for both. */
export type MomentumEntry = { slug: string; pokemonTcgId: string };

export type MoverDirection = "down" | "up" | "flat";

/** One card's NM-tier momentum. Every numeric field is a real PokeTrace
 *  aggregate; `momentumPct` is the derived percentage (1 dp). */
export type CardMomentum = {
  slug: string;
  cardName: string;
  setName: string;
  imageUrl: string;
  /** The PokeTrace variant UUID whose NEAR_MINT market we read. */
  poketraceId: string;
  /** Canonical variant key of that printing (holofoil, etc.). */
  variantKey: string;
  avg7d: number;
  avg30d: number;
  saleCount: number;
  /** (avg7d - avg30d) / avg30d * 100, rounded to 1 dp. Negative = trending down. */
  momentumPct: number;
  direction: MoverDirection;
  /** The tier's most recent recorded sale — what these averages are true OF.
   *  Distinct from the row's `computed_at` (when we cached it). */
  soldAsOfIso: string;
};

/** Minimal daily snapshot row — the append-only time-series seed (per card per
 *  day) the strategy wants for week-over-week movers later, at near-zero cost. */
export type MoverSnapshot = {
  cardSlug: string;
  /** UTC YYYY-MM-DD of the run. */
  snapshotDate: string;
  avg7d: number;
  avg30d: number;
  saleCount: number;
  matchedTier: string;
};

export type MoverError = { cardSlug: string; stage: "metadata" | "soldHistory"; error: string };

export type RefreshMoversResult = {
  cardsConsidered: number;
  /** Cards that produced a usable NM momentum (sample floor cleared). */
  withMomentum: number;
  /** PokeTrace getSoldHistory calls made. */
  soldHistoryCalls: number;
  results: CardMomentum[];
  snapshots: MoverSnapshot[];
  errors: MoverError[];
  capHit: boolean;
};

export type GetMomentumMetadataFn = (input: { id: string }) => Promise<CardMetadata>;
export type GetSoldHistoryFn = (uuid: string) => Promise<SoldHistory | null>;

export type RefreshMoversInput = {
  entries: MomentumEntry[];
  getCardMetadata: GetMomentumMetadataFn;
  getSoldHistory: GetSoldHistoryFn;
  now?: Date;
  /** Hard cap on cards processed per run (protects the function timeout +
   *  PokeTrace daily quota). Production passes MAX_MOMENTUM_CARDS. */
  maxCards?: number;
  /** Cards processed in parallel. Bounded so in-flight PokeTrace calls stay
   *  small; the rate limiter (acquire) is the real throughput governor. */
  concurrency?: number;
  /** Called once before every getSoldHistory call — the PokeTrace rate-limit
   *  gate (>= 30 req / 10s burst). Omitted in tests (no throttling). */
  acquire?: () => Promise<void>;
};

// --- Tuning constants (ADR-069) -------------------------------------------

/** avg7d must be at least this far BELOW avg30d (%) to be a "good buy" candidate. */
export const MOVER_DOWN_THRESHOLD_PCT = -8;
/** avg7d at least this far ABOVE avg30d (%) → "heating up". */
export const MOVER_UP_THRESHOLD_PCT = 8;
/** Minimum NEAR_MINT sale count in the window — thin/noisy cards are excluded. */
export const MOVER_MIN_SALES = 5;
/** Minimum NEAR_MINT 30-day average ($) for materiality (ADR-070). A "good buy"
 *  on a sub-$10 card is a sub-dollar move ("Shaymin V down 17%" = a $0.34 move) —
 *  not material to a deal-hunter, and it makes the board feel like bulk. The
 *  30-day average (not the volatile 7-day) is the value baseline. */
export const MOVER_MIN_NM_VALUE = 10;
/** Movers-universe cap (ADR-070). Curated (~210) + the modern mover sets
 *  (~183 material chase cards) ≈ 390. At <= 2.8 req/s (the 28/10s safe ceiling)
 *  ~500-600 PokeTrace calls fit the 300s function with margin. Raised from 260
 *  (curated-only) to cover the modern additions in one run. */
export const MAX_MOMENTUM_CARDS = 460;
export const MOMENTUM_CONCURRENCY = 4;

/** The modern, high-demand SV/Mega-era sets whose chase cards join the movers
 *  universe alongside the curated tier (ADR-070). Verified SDK set IDs
 *  (pokemontcg.io, 2026-06-25): Prismatic Evolutions (sv8pt5), Surging Sparks
 *  (sv8), Mega Evolution (me1), Chaos Rising (me4 — in the SDK but unpriced as of
 *  expansion, so no cards yet; listed for when prices populate), Journey Together
 *  (sv9), Destined Rivals (sv10), Stellar Crown (sv7). The movers signal is
 *  PokeTrace-only, so the old eBay-Browse-quota gate on expansion is moot. */
export const MODERN_MOVER_SET_IDS: ReadonlySet<string> = new Set([
  "sv8pt5",
  "sv8",
  "me1",
  "me4",
  "sv9",
  "sv10",
  "sv7",
]);

/** SDK set id prefix of a pokemonTcgId ("sv8pt5-161" → "sv8pt5"). Pure. */
export function setIdOf(pokemonTcgId: string): string {
  return pokemonTcgId.split("-")[0];
}

/** Is this card in a modern mover set? (Used to widen the cron's universe.) */
export function isModernMoverCard(pokemonTcgId: string): boolean {
  return MODERN_MOVER_SET_IDS.has(setIdOf(pokemonTcgId));
}

// ebay/tcgplayer carry per-condition US tiers; cardmarket is the EU AGGREGATED
// roll-up (no per-condition NM). Mirror the reference resolver's source order.
const SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];
const NM_TIER = "NEAR_MINT";

/** The NEAR_MINT stat from the first source that carries one (panel parity). */
function nmStat(history: SoldHistory | null): SoldStat | null {
  if (!history) return null;
  for (const src of SOURCES) {
    const s = history.bySource[src]?.[NM_TIER];
    if (s) return s;
  }
  return null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pure momentum: (avg7d - avg30d) / avg30d as a percentage (1 dp). Returns null
 * when either window is missing or avg30d is not a positive number (can't form a
 * ratio). Never throws.
 */
export function computeMomentumPct(avg7d: number | null, avg30d: number | null): number | null {
  if (typeof avg7d !== "number" || !Number.isFinite(avg7d)) return null;
  if (typeof avg30d !== "number" || !Number.isFinite(avg30d) || avg30d <= 0) return null;
  return round1(((avg7d - avg30d) / avg30d) * 100);
}

/**
 * Pure classification of one NM stat into a mover. Returns null when the data is
 * unusable (no avg7d/avg30d) or the sample is below MOVER_MIN_SALES — a missing
 * mover is correct; a thin-sample "good buy" is the failure we're avoiding.
 *
 * Freshness (sold-data-integrity, 2026-07-03): PokeTrace's avg7d/avg30d are
 * anchored to the tier's lastUpdated, not to today — a card whose last NM sale
 * is months old would otherwise surface stale momentum as a current "good
 * buy". Stale stats classify to null (no mover).
 */
export function classifyMomentum(stat: SoldStat | null, nowMs: number = Date.now()): {
  avg7d: number;
  avg30d: number;
  saleCount: number;
  momentumPct: number;
  direction: MoverDirection;
  /** The tier's most recent recorded sale — the date these averages are
   *  actually true of. Carried (not dropped) so the alert email's evidence
   *  line can date its comp; `computed_at` is when WE cached the row, which is
   *  a different and much more flattering number (audit 2026-07-14). */
  soldAsOfIso: string;
} | null {
  if (!stat) return null;
  if (!isFreshStat(stat, nowMs)) return null;
  const saleCount = typeof stat.saleCount === "number" && stat.saleCount > 0 ? stat.saleCount : 0;
  if (saleCount < MOVER_MIN_SALES) return null;
  const momentumPct = computeMomentumPct(stat.avg7d, stat.avg30d);
  if (momentumPct === null) return null;
  const avg7d = stat.avg7d as number;
  const avg30d = stat.avg30d as number;
  // Materiality gate (ADR-070): exclude sub-threshold bulk so the board surfaces
  // liquid, material cards instead of sub-dollar moves. avg30d is finite > 0 here
  // (guaranteed by computeMomentumPct).
  if (avg30d < MOVER_MIN_NM_VALUE) return null;
  let direction: MoverDirection = "flat";
  if (momentumPct <= MOVER_DOWN_THRESHOLD_PCT) direction = "down";
  else if (momentumPct >= MOVER_UP_THRESHOLD_PCT) direction = "up";
  // isFreshStat above already proved lastUpdated is a parseable non-null date.
  return { avg7d, avg30d, saleCount, momentumPct, direction, soldAsOfIso: stat.lastUpdated ?? "" };
}

/** UTC YYYY-MM-DD for the snapshot date. */
function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Run `fn` over `items` with at most `concurrency` in flight. Order-independent. */
async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/**
 * Sliding-window rate limiter for the PokeTrace burst ceiling (30 req / 10s).
 * `acquire()` resolves immediately while under the cap, else waits until the
 * oldest request in the window ages out. Clock + sleep injectable for tests.
 */
export function createRateLimiter(opts: {
  maxPerWindow: number;
  windowMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): { acquire: () => Promise<void> } {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const times: number[] = [];
  return {
    async acquire(): Promise<void> {
      for (;;) {
        const t = now();
        while (times.length > 0 && t - times[0] >= opts.windowMs) times.shift();
        if (times.length < opts.maxPerWindow) {
          times.push(t);
          return;
        }
        const wait = opts.windowMs - (t - times[0]) + 1;
        await sleep(wait > 0 ? wait : 1);
      }
    },
  };
}

/**
 * Compute the NM-tier momentum for every curated card. PokeTrace-only; never
 * touches eBay. Soft-fails per card (collected in `errors`); never throws.
 *
 * Per card: read the SDK metadata for display fields + the baked PokeTrace
 * variant UUIDs, fetch each variant's sold history (rate-limited), pick the
 * printing with the DEEPEST NM market (highest NEAR_MINT saleCount), and
 * classify its avg7d-vs-avg30d momentum. Only cards whose chosen printing
 * clears the sample floor produce a result + a daily snapshot row.
 */
export async function refreshMarketMovers(input: RefreshMoversInput): Promise<RefreshMoversResult> {
  const now = input.now ?? new Date();
  const snapshotDate = utcDate(now);
  const cap = input.maxCards ?? MAX_MOMENTUM_CARDS;
  const concurrency = input.concurrency ?? MOMENTUM_CONCURRENCY;

  const capHit = input.entries.length > cap;
  const entries = capHit ? input.entries.slice(0, cap) : input.entries;

  const results: CardMomentum[] = [];
  const snapshots: MoverSnapshot[] = [];
  const errors: MoverError[] = [];
  let soldHistoryCalls = 0;

  await pool(entries, concurrency, async (entry) => {
    let metadata: CardMetadata;
    try {
      metadata = await input.getCardMetadata({ id: entry.pokemonTcgId });
    } catch (err) {
      errors.push({ cardSlug: entry.slug, stage: "metadata", error: (err as Error).message });
      return;
    }

    const variants = metadata.variants ?? [];
    if (variants.length === 0) return; // no PokeTrace UUID → no momentum

    // Read each variant's sold history (rate-limited) and keep the printing
    // with the deepest NM market — the most defensible "this card's NM" stat.
    let best: { variantKey: string; poketraceId: string; stat: SoldStat } | null = null;
    for (const variant of variants) {
      if (!variant.poketraceId) continue;
      if (input.acquire) await input.acquire();
      soldHistoryCalls += 1;
      let history: SoldHistory | null;
      try {
        history = await input.getSoldHistory(variant.poketraceId);
      } catch (err) {
        errors.push({ cardSlug: entry.slug, stage: "soldHistory", error: (err as Error).message });
        continue;
      }
      const stat = nmStat(history);
      if (!stat) continue;
      const sc = typeof stat.saleCount === "number" ? stat.saleCount : 0;
      const bestSc = best ? (best.stat.saleCount ?? 0) : -1;
      if (sc > bestSc) best = { variantKey: variant.variantKey, poketraceId: variant.poketraceId, stat };
    }

    if (!best) return; // no NM data on any printing

    const classified = classifyMomentum(best.stat);
    if (!classified) return; // thin sample / unusable windows → excluded

    results.push({
      slug: entry.slug,
      cardName: metadata.name,
      setName: metadata.setName,
      imageUrl: metadata.image ?? "",
      poketraceId: best.poketraceId,
      variantKey: best.variantKey,
      avg7d: classified.avg7d,
      avg30d: classified.avg30d,
      saleCount: classified.saleCount,
      momentumPct: classified.momentumPct,
      direction: classified.direction,
      soldAsOfIso: classified.soldAsOfIso,
    });
    snapshots.push({
      cardSlug: entry.slug,
      snapshotDate,
      avg7d: classified.avg7d,
      avg30d: classified.avg30d,
      saleCount: classified.saleCount,
      matchedTier: NM_TIER,
    });
  });

  return {
    cardsConsidered: entries.length,
    withMomentum: results.length,
    soldHistoryCalls,
    results,
    snapshots,
    errors,
    capHit,
  };
}

/** Sort movers for display: "down" most-negative first (best candidate buys);
 *  "up" most-positive first. Pure. */
export function sortMovers(results: CardMomentum[], direction: "down" | "up"): CardMomentum[] {
  const filtered = results.filter((r) => r.direction === direction);
  return filtered.sort((a, b) =>
    direction === "down" ? a.momentumPct - b.momentumPct : b.momentumPct - a.momentumPct,
  );
}
