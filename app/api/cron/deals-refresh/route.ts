// Deals leaderboard refresh cron (ROADMAP B.4 / ADR-054).
//
// Daily Vercel Cron Job (vercel.json crons[] entry). Walks the CURATED catalog,
// computes each card's condition-matched buy signal from the live eBay best
// listing, and upserts DERIVED metadata into the buy_signals cache that powers
// the public /deals leaderboard.
//
// R-008: the live eBay ask is fetched (via the lib/affiliate Browse boundary,
// cache:"no-store") only to classify, then DISCARDED — no eBay listing field is
// persisted (see the buy_signals migration + docs/EBAY-COMPLIANCE.md row #13).
// R-012: one Browse call per curated card, ONCE daily, capped at
// MAX_DEALS_BROWSE_CALLS — never a per-page-view fan-out.
//
// Auth: same bearer-secret contract as the wishlist cron (ADR-024) — Vercel's
// cron infra sends `Authorization: Bearer ${CRON_SECRET}`; the route is in
// PUBLIC_ROUTES (via the /api/cron prefix) and does its own bearer gate.

import { NextResponse } from "next/server";
import { getBestListing, getListingAspects } from "@/lib/affiliate/ebay-browse";
import { buildCustomId } from "@/lib/affiliate/epn";
import { getCardMetadata } from "@/lib/cards/sdk";
import { CARD_CATALOG, cardTier } from "@/lib/cards/catalog";
import { computeCardBuySignal } from "@/lib/buy-signal/card-signal";
import { refreshDeals, type CuratedEntry, type DealUpsertRow } from "@/lib/deals/refresh-batch";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[deals-cron] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const startedAt = Date.now();

  // Curated tier only — the only tier with a live eBay ask (longtail +
  // metadata-only deliberately make no Browse call; ADR-046).
  const entries: CuratedEntry[] = CARD_CATALOG
    .filter((e) => cardTier(e.slug) === "curated")
    .map((e) => ({ slug: e.slug, pokemonTcgId: e.pokemonTcgId }));

  const result = await refreshDeals({
    entries,
    getCardMetadata,
    getBestListing,
    getListingAspects: ({ itemId }) => getListingAspects({ itemId, surface: "deals_cron" }),
    computeSignal: computeCardBuySignal,
    customIdFor: (slug) => buildCustomId({ tier: "deals", slug }),
    upsertRows: async (rows: DealUpsertRow[]) => {
      const admin = supabaseAdmin();
      const { error } = await admin.from("buy_signals").upsert(rows, { onConflict: "card_slug" });
      return { error: error ? error.message : null };
    },
    now: new Date(),
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
  });
}
