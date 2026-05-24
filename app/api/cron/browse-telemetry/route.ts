// Daily Browse-API telemetry cron. See ADR-025.
//
// Schedule: 06:00 UTC daily (vercel.json crons[]), right after the 24h
// window the rollup describes closes. Reads from browse_calls,
// aggregates last-24h + last-7-days, posts a Discord embed to
// #content-engine, and runs the 90-day retention sweep in the same
// invocation.
//
// Auth: same bearer pattern as the wishlist cron — `Authorization:
// Bearer ${CRON_SECRET}` or 401. The route is in PUBLIC_ROUTES via the
// `/api/cron` prefix.

import { NextResponse } from "next/server";
import { postBrowseTelemetry } from "@/lib/notifications/discord";
import {
  aggregateLast24h,
  aggregateLast7Days,
  purgeOlderThan,
} from "@/lib/telemetry/browse-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[browse-telemetry] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const now = new Date();
  const [agg24, agg7, purged] = await Promise.all([
    aggregateLast24h({ now }),
    aggregateLast7Days({ now }),
    purgeOlderThan(RETENTION_DAYS, { now }),
  ]);

  const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
  if (webhook) {
    // Soft-fail: Discord outage cannot break the cron's return shape.
    await postBrowseTelemetry(webhook, {
      date: now.toISOString().slice(0, 10),
      total24h: agg24.total,
      byCounts: agg24.byCounts,
      successRatePct: agg24.successRatePct,
      pctOfCeiling: agg24.pctOfCeiling,
      approachingCeiling: agg24.approachingCeiling,
      daily7: agg7.daily,
      purgedRows: purged.ok ? purged.deletedApprox : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    date: now.toISOString().slice(0, 10),
    total24h: agg24.total,
    byCounts: agg24.byCounts,
    successRatePct: agg24.successRatePct,
    pctOfCeiling: agg24.pctOfCeiling,
    approachingCeiling: agg24.approachingCeiling,
    daily7: agg7.daily,
    purge: purged,
  });
}
