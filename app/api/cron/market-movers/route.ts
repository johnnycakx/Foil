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
import { getCardMetadata } from "@/lib/cards/sdk";
import { getSoldHistory } from "@/lib/poketrace/by-uuid";
import { CARD_CATALOG, cardTier } from "@/lib/cards/catalog";
import {
  refreshMarketMovers,
  createRateLimiter,
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

  // Curated tier only — the cards with the richest PokeTrace sold data. The
  // long-tail expands later off the accumulated market_snapshots (cheaper than
  // re-querying live history). Mirrors the deals-refresh cron's tier filter.
  const entries: MomentumEntry[] = CARD_CATALOG
    .filter((e) => cardTier(e.slug) === "curated")
    .map((e) => ({ slug: e.slug, pokemonTcgId: e.pokemonTcgId }));

  const limiter = createRateLimiter({
    maxPerWindow: POKETRACE_BURST_MAX,
    windowMs: POKETRACE_BURST_WINDOW_MS,
  });

  const result = await refreshMarketMovers({
    entries,
    getCardMetadata,
    getSoldHistory: (uuid) => getSoldHistory(uuid),
    acquire: limiter.acquire,
    now: new Date(),
  });

  // Upsert one market_movers row per card with usable momentum (down/up/flat) so
  // a card that stops moving updates to "flat" (the read filters to down/up +
  // a 36h freshness window, so a flat or stale row never surfaces).
  let moversWritten = 0;
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
      computed_at: new Date().toISOString(),
    }));
    const admin = supabaseAdmin();
    const { error } = await admin.from("market_movers").upsert(rows, { onConflict: "card_slug" });
    if (error) moversError = error.message;
    else moversWritten = rows.length;
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
    snapshotsWritten,
    errorCount: result.errors.length,
    capHit: result.capHit,
    moversError,
    snapshotError,
  });
}
