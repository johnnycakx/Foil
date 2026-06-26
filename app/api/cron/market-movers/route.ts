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
import { CARD_CATALOG, cardTier } from "@/lib/cards/catalog";
import {
  refreshMarketMovers,
  createRateLimiter,
  isModernMoverCard,
  type MomentumEntry,
} from "@/lib/deals/market-movers";
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

  // Movers universe (ADR-070): the curated tier PLUS the modern high-demand
  // chase cards (long-tail entries from MODERN_MOVER_SET_IDS). The signal is
  // PokeTrace-only, so the eBay-Browse-quota gate that limited the deals-refresh
  // cron to curated-only does NOT apply here. Bounded by MAX_MOMENTUM_CARDS so it
  // fits one ~300s run at the safe PokeTrace rate; the materiality filter then
  // keeps sub-$10 bulk from surfacing.
  const entries: MomentumEntry[] = CARD_CATALOG
    .filter((e) => cardTier(e.slug) === "curated" || isModernMoverCard(e.pokemonTcgId))
    .map((e) => ({ slug: e.slug, pokemonTcgId: e.pokemonTcgId }));

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
    getCardMetadata: async ({ id }) => getBakedCardMetadata(id) ?? (await getCardMetadata({ id })),
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
    errorCount: result.errors.length,
    capHit: result.capHit,
    moversError,
    snapshotError,
  });
}
