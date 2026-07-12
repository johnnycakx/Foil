// The Pro daily deal drop send (offer item 2a).
//
// Daily Vercel cron (vercel.json, 09:47 UTC — after the 08:00 deals-refresh
// and 09:00 market-movers runs so the drop reads the freshest board). Sends
// the day's full BELOW-sold board to LIVE PRO entitlements only (the
// email→tier bridge on subscriptions), skipping any address that
// unsubscribed. A 0-deal day sends the honest quiet-day email — that promise
// is in the offer copy ("On a quiet day it says so. No filler.").
//
// Auth: Authorization: Bearer ${CRON_SECRET}, same shape as every cron here.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLeaderboard } from "@/lib/deals/leaderboard";
import { proTierEmails } from "@/lib/entitlements";
import { buildDailyDropModel, type MarketTemperature } from "@/lib/newsletter/daily-drop";
import { sendTransactionalEmail } from "@/lib/notifications/resend";
import { postError } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readTemperature(): Promise<MarketTemperature | null> {
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("market_temperature")
      .select("below_count, total_count, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    // A stale stat is worse than no stat — only cite this week's read.
    const age = Date.now() - Date.parse(`${data.snapshot_date}T00:00:00Z`);
    if (!Number.isFinite(age) || age > 7 * 24 * 60 * 60 * 1000) return null;
    return { belowCount: data.below_count, totalCount: data.total_count };
  } catch {
    return null;
  }
}

async function unsubscribedAmong(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("newsletter_subscribers")
      .select("email, unsubscribed_at")
      .in("email", emails)
      .not("unsubscribed_at", "is", null);
    const rows = (data ?? []) as Array<{ email: string }>;
    return new Set(rows.map((r) => r.email.toLowerCase()));
  } catch {
    return new Set();
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[daily-drop] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const admin = supabaseAdmin();
  const recipients = await proTierEmails(admin);
  if (recipients.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no pro entitlements" });
  }

  const optedOut = await unsubscribedAmong([...recipients]);
  const sendable = [...recipients].filter((e) => !optedOut.has(e));

  const deals = await getLeaderboard(50);
  const temperature = await readTemperature();
  const model = buildDailyDropModel(deals, temperature, new Date());

  let sent = 0;
  const failed: string[] = [];
  for (const email of sendable) {
    const res = await sendTransactionalEmail({
      to: email,
      subject: model.subject,
      html: model.bodyHtmlFor(email),
    });
    if (res.ok) sent += 1;
    else failed.push(email);
  }

  if (failed.length > 0) {
    const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
    if (webhook) {
      void postError(webhook, {
        source: "daily-drop",
        errorType: "DropSendFailed",
        message: `${failed.length} of ${sendable.length} daily-drop sends failed`,
        context: { deals: String(model.dealCount) },
      }).catch(() => {});
    }
  }

  console.log(
    `[daily-drop] deals=${model.dealCount} pro=${recipients.size} optedOut=${optedOut.size} sent=${sent} failed=${failed.length}`,
  );
  return NextResponse.json({
    ok: true,
    deals: model.dealCount,
    pro: recipients.size,
    sent,
    failed: failed.length,
  });
}
