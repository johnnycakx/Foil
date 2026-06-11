// Wishlist alert cron. See ADR-024.
//
// Hourly Vercel Cron Job (vercel.json crons[] entry). Walks the watchlists
// table for rows whose last_notified_at is NULL or > 24h old, deduplicates
// Browse API calls per card_slug, sends a Resend email when current price
// meets target, stamps last_notified_at on the row, posts a single summary
// to Discord, and returns 200 with the aggregated counts.
//
// Auth: Vercel Cron Jobs hit the route with
//   Authorization: Bearer ${CRON_SECRET}
// (the secret lives in the project's env vars; Vercel's cron infra reads
// it and stamps the header). Manual invocation from John's terminal uses
// the same shape. Any caller without that bearer gets 401 — the route
// itself is in PUBLIC_ROUTES so the auth gate is purely the bearer check.

import { NextResponse } from "next/server";
import { postWishlistAlertRun } from "@/lib/notifications/discord";
import { sendTransactionalEmail } from "@/lib/notifications/resend";
import { resolveVerifiedListing } from "@/lib/listing/resolve";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scanWatchlists, type SupabaseLike, type WatchlistRow } from "@/lib/wishlist/scan-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_INTERVAL_SQL = "24 hours";

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[wishlist-cron] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const supabaseLike: SupabaseLike = {
    async fetchDueRows(now) {
      const cutoffIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("watchlists")
        .select("id, email, card_slug, target_price_cents, variant, condition, last_notified_at")
        .or(`last_notified_at.is.null,last_notified_at.lt.${cutoffIso}`);
      if (error) {
        return { rows: [], error: error.message };
      }
      const rows = (data ?? []).map((r) => ({
        id: r.id as string,
        email: r.email as string,
        card_slug: r.card_slug as string,
        target_price_cents: r.target_price_cents as number,
        variant: (r.variant as string | null) ?? "default",
        condition: (r.condition as string | null) ?? "any-raw",
        last_notified_at: (r.last_notified_at as string | null) ?? null,
      })) satisfies WatchlistRow[];
      return { rows, error: null };
    },
    async markNotified(rowId, when) {
      const admin = supabaseAdmin();
      const { error } = await admin
        .from("watchlists")
        .update({ last_notified_at: when.toISOString() })
        .eq("id", rowId);
      return { error: error ? error.message : null };
    },
  };

  const result = await scanWatchlists({
    supabase: supabaseLike,
    // The VERIFIED resolver (Tranche A #3): alerts fire only on identity-
    // verified condition matches. awaitLog: flush Browse telemetry before the
    // cron function suspends (fire-and-forget drops it in a cron context —
    // same gap as deals_cron).
    resolveListing: (cardId, condition, opts) =>
      resolveVerifiedListing(cardId, condition, { ...opts, awaitLog: true }),
    sendEmail: async (input) => {
      const res = await sendTransactionalEmail({
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return res.ok
        ? { ok: true }
        : { ok: false, error: res.error ?? "send_failed" };
    },
    now: new Date(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com",
  });

  const durationMs = Date.now() - startedAt;
  const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
  if (webhook) {
    // Soft-fail: a Discord outage cannot break the cron's return shape.
    await postWishlistAlertRun(webhook, {
      rowsScanned: result.rowsScanned,
      slugsConsidered: result.slugsConsidered,
      browseCalls: result.browseCalls,
      alerted: result.alerted,
      slugsWithListing: result.slugsWithListing,
      errorCount: result.errors.length,
      capHit: result.capHit,
      durationMs,
    });
  }

  return NextResponse.json({
    ok: true,
    cooldownInterval: COOLDOWN_INTERVAL_SQL,
    durationMs,
    ...result,
  });
}
