// Daily X post-metrics capture cron (ADR-071 follow-up, Part 2). Runs at
// 16:00 UTC (2h after the x-post cron). Finds posts ~48h old that lack a metrics
// row, fetches their public_metrics once via the single x-client boundary, and
// stores them in x_post_metrics. CAPTURE ONLY — never posts, never changes
// generation. Same bearer-CRON_SECRET contract + soft-fail as the other crons.

import { NextResponse } from "next/server";
import { processMetricsRun, supabaseMetricsStore } from "@/lib/social/metrics";
import { fetchTweetPublicMetrics } from "@/lib/social/x-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new NextResponse("missing_cron_secret", { status: 503 });
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) return new NextResponse("unauthorized", { status: 401 });

  const result = await processMetricsRun({
    store: supabaseMetricsStore(),
    fetchMetrics: (ids) => fetchTweetPublicMetrics(ids),
  });

  return NextResponse.json(result);
}
