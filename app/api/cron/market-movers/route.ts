// Market-movers refresh cron (ADR-069).
//
// Daily Vercel Cron Job (vercel.json crons[] entry). Walks the CURATED catalog,
// reads each card's NEAR_MINT windowed sold averages from PokeTrace, computes
// avg7d-vs-avg30d momentum, and upserts the result into market_movers (the
// current-state cache that powers the insight-led /deals board + the newsletter
// "good buys this week" digest). It ALSO appends one minimal daily snapshot per
// card to market_snapshots — the append-only time-series seed for week-over-week
// movers later.
//
// PokeTrace-ONLY: no eBay Browse call here (so no eBay quota spend; R-012 N/A).
// The PokeTrace burst ceiling (30 req / 10s) is respected via a sliding-window
// rate limiter; the daily ceiling (10K) is far above the curated-tier volume.
//
// Soft-fail end to end: a missing/invalid POKETRACE_API_KEY makes every
// getSoldHistory resolve null → zero movers written → the board shows its calm
// empty state, never a 500. (The key was cancelled 2026-06-16, valid ~until
// July 15; the signal degrades to empty after that unless re-subscribed.)
//
// Auth: same bearer-secret contract as the other crons (ADR-024) — the route is
// public via the /api/cron prefix and does its own bearer gate.

import { NextResponse } from "next/server";
import { getCardMetadata, getBakedCardMetadata } from "@/lib/cards/sdk";
import { getSoldHistory } from "@/lib/poketrace/by-uuid";
import { getAllHydratedVariants } from "@/lib/poketrace/hydration";
import { CARD_CATALOG, cardTier, RECENT_SETS_SLUGS } from "@/lib/cards/catalog";
import {
  refreshMarketMovers,
  createRateLimiter,
  isModernMoverCard,
  type MomentumEntry,
} from "@/lib/deals/market-movers";
import { computeMarketTemperature } from "@/lib/deals/market-temperature";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// PokeTrace burst ceiling: 30 requests / 10s (CLAUDE.md API Notes). Leave a
// margin (28) so a clock skew or a retried call can't tip over the edge.
const POKETRACE_BURST_MAX = 28;
const POKETRACE_BURST_WINDOW_MS = 10_000;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[movers-cron] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const startedAt = Date.now();

  // Movers universe (ADR-070 + ADR-092): the curated tier PLUS the modern
  // high-demand chase cards PLUS every runtime-HYDRATED card (demand-driven —
  // someone watches it, so its 30-day average must land in market_movers:
  // that's what makes blank-target alerts possible on long-tail cards, and
  // what feeds the alert email's evidence line). The signal is PokeTrace-only,
  // so the eBay-Browse-quota gate does NOT apply here. Bounded by
  // MAX_MOMENTUM_CARDS; the materiality filter keeps sub-$10 bulk from
  // surfacing on the /deals board (its avg30d still lands for the alerts).
  const hydrated = await getAllHydratedVariants();
  // The recent-sets FULL-coverage tier is browse/search inventory, not sweep
  // inventory: without the exclusion the modern-set widening would balloon
  // the daily run from ~390 to ~880 cards the day a big set lands
  // (quality-bar-fixes, 2026-07-13). A recent-set card still joins the sweep
  // the moment someone watches it — via the hydrated branch below.
  const entries: MomentumEntry[] = CARD_CATALOG
    .filter(
      (e) =>
        cardTier(e.slug) === "curated" ||
        (isModernMoverCard(e.pokemonTcgId) && !RECENT_SETS_SLUGS.has(e.slug)) ||
        hydrated.has(e.slug),
    )
    .map((e) => ({ slug: e.slug, pokemonTcgId: e.pokemonTcgId }));

  // Hydrated variants live in the DB, not the baked snapshot — the metadata
  // getter below merges them so the momentum walk can resolve their UUIDs.
  const idToSlug = new Map(entries.map((e) => [e.pokemonTcgId, e.slug]));

  const limiter = createRateLimiter({
    maxPerWindow: POKETRACE_BURST_MAX,
    windowMs: POKETRACE_BURST_WINDOW_MS,
  });

  const result = await refreshMarketMovers({
    // Baked-only metadata (ADR-070): no live pokemontcg.io fetch per card — the
    // snapshot carries the display fields + PokeTrace variants the momentum needs.
    // ~390 live SDK calls (with retry backoff under load) blew the 300s budget;
    // baked reads are synchronous, leaving the run PokeTrace-rate-bound (~190s).
    // Fall back to the live fetch only for the rare id absent from the snapshot.
    getCardMetadata: async ({ id }) => {
      const baked = getBakedCardMetadata(id) ?? (await getCardMetadata({ id }));
      // ADR-092 merge: runtime-hydrated variants fill the baked gap.
      if ((baked.variants?.length ?? 0) === 0) {
        const slug = idToSlug.get(id);
        const hv = slug ? hydrated.get(slug) : undefined;
        if (hv && hv.length > 0) return { ...baked, variants: hv };
      }
      return baked;
    },
    entries,
    getSoldHistory: (uuid) => getSoldHistory(uuid),
    acquire: limiter.acquire,
    now: new Date(),
  });

  // Upsert one market_movers row per card with usable momentum (down/up/flat),
  // then clear any row from a prior run (see the delete below). The read filters
  // to down/up; the stale-clear guarantees no prior-run row (e.g. a pre-filter
  // sub-$10 "down") can linger inside the 36h freshness window.
  // ONE timestamp for the whole run so we can clear prior-run rows cleanly.
  const runComputedAt = new Date().toISOString();
  let moversWritten = 0;
  let staleCleared = 0;
  let moversError: string | null = null;
  if (result.results.length > 0) {
    const rows = result.results.map((m) => ({
      card_slug: m.slug,
      card_name: m.cardName,
      set_name: m.setName,
      image_url: m.imageUrl,
      direction: m.direction,
      momentum_pct: m.momentumPct,
      avg7d: m.avg7d,
      avg30d: m.avg30d,
      sale_count: m.saleCount,
      matched_tier: "NEAR_MINT",
      computed_at: runComputedAt,
    }));
    const admin = supabaseAdmin();
    const { error } = await admin.from("market_movers").upsert(rows, { onConflict: "card_slug" });
    if (error) moversError = error.message;
    else {
      moversWritten = rows.length;
      // Clear stale rows from PRIOR runs (ADR-070 fix). The upsert only touches
      // cards this run still classifies as movers; a card it now reclassifies as
      // immaterial (sub-$10) or thin keeps its OLD row otherwise — the bug where a
      // pre-filter "$1.97 down 17%" row lingered after the filter shipped. Every
      // row this run wrote shares runComputedAt, so anything older is a prior run.
      const { error: delErr, count } = await admin
        .from("market_movers")
        .delete({ count: "exact" })
        .lt("computed_at", runComputedAt);
      if (delErr) moversError = delErr.message;
      else staleCleared = count ?? 0;
    }
  }

  // Append the daily snapshot time-series (idempotent per card per day).
  let snapshotsWritten = 0;
  let snapshotError: string | null = null;
  if (result.snapshots.length > 0) {
    const rows = result.snapshots.map((s) => ({
      card_slug: s.cardSlug,
      snapshot_date: s.snapshotDate,
      avg7d: s.avg7d,
      avg30d: s.avg30d,
      sale_count: s.saleCount,
      matched_tier: s.matchedTier,
      source: "poketrace",
    }));
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("market_snapshots")
      .upsert(rows, { onConflict: "card_slug,snapshot_date" });
    if (error) snapshotError = error.message;
    else snapshotsWritten = rows.length;
  }

  // Market-temperature stat (offer item 6): one number over the whole
  // priceable universe this run, stored per day. Soft-fail — the movers
  // write above is the load-bearing output.
  let temperature: { belowCount: number; totalCount: number } | null = null;
  if (result.snapshots.length > 0) {
    temperature = computeMarketTemperature(
      result.snapshots.map((s) => ({ avg7d: s.avg7d, avg30d: s.avg30d })),
    );
    try {
      const admin = supabaseAdmin();
      const snapshotDate = result.snapshots[0].snapshotDate;
      const { error } = await admin.from("market_temperature").upsert(
        {
          snapshot_date: snapshotDate,
          below_count: temperature.belowCount,
          total_count: temperature.totalCount,
        },
        { onConflict: "snapshot_date" },
      );
      if (error) console.warn(`[market-movers] temperature write failed: ${error.message}`);
    } catch (err) {
      console.warn(`[market-movers] temperature write threw: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    cardsConsidered: result.cardsConsidered,
    withMomentum: result.withMomentum,
    soldHistoryCalls: result.soldHistoryCalls,
    downCount: result.results.filter((m) => m.direction === "down").length,
    upCount: result.results.filter((m) => m.direction === "up").length,
    moversWritten,
    staleCleared,
    snapshotsWritten,
    temperature,
    errorCount: result.errors.length,
    capHit: result.capHit,
    moversError,
    snapshotError,
  });
}
