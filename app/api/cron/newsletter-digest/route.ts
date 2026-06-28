// Weekly "good buys this week" digest cron (ADR-077) — the no-spend /approve
// rail. Runs on Vercel cron: generate the digest from the fresh market_movers
// cache (the daily 09:00 UTC market-movers cron keeps it current), quality-gate
// it, persist a pending draft, and post a Discord approval card to
// #content-engine. The owner approves with /approve <id>; on approve the
// paste-ready issue is emailed to the founder (app/api/newsletter/approve).
//
// SAFE BY DEFAULT: NEWSLETTER_DIGEST_MODE must be "approval" to do anything;
// unset/"off" -> no-op (deploying the code does not start posting cards). NEVER
// sends to subscribers — the only outbound effects are a DB row + a Discord card.
//
// Auth: Bearer CRON_SECRET (Vercel cron infra). Soft-fails everywhere — a bad
// week, an empty cache, a Discord outage, or a DB error all return 200 with a
// reason, never a 500 and never a partial send.

import { NextResponse } from "next/server";
import { getMarketMovers, type MoverRow } from "@/lib/deals/market-movers-read";
import { renderDigestForSend } from "@/lib/newsletter/digest-html";
import { buildMoversDigestParts } from "@/lib/newsletter/movers-digest";
import { runDigestQualityGates } from "@/lib/newsletter/digest-quality-gate";
import { resolveNewsletterDigestMode, isoWeekTag } from "@/lib/newsletter/digest-mode";
import {
  supabaseDigestDraftStore,
  digestExpiryFrom,
  DEFAULT_DIGEST_EXPIRY_HOURS,
} from "@/lib/newsletter/digest-drafts";
import { postNewsletterApprovalRequest } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Jamming Tower down 10.6%, Flareon VMAX down 10.4%, Iono's Bellibolt ex down 10.3%" */
function topCardsSummary(down: MoverRow[]): string {
  return down
    .slice(0, 3)
    .map((m) => `${m.cardName} down ${Math.abs(m.momentumPct)}%`)
    .join(", ");
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!expected || header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const mode = resolveNewsletterDigestMode(process.env);
  if (mode === "off") {
    return NextResponse.json({ ok: true, reason: "disabled", mode });
  }

  try {
    const store = supabaseDigestDraftStore();
    const now = new Date();
    const nowMs = now.getTime();

    // Housekeeping: sweep any stale pending draft so it can't be approved late.
    await store.expireStale(nowMs);

    const movers = await getMarketMovers(50);
    const generatedAt = now.toISOString();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://foiltcg.com";

    const rendered = renderDigestForSend({ movers, generatedAt, siteUrl });
    const parts = buildMoversDigestParts({ movers, generatedAt, siteUrl });

    // Quality gate BEFORE persisting / posting a card. Fail -> log + skip, no card.
    const gate = runDigestQualityGates({ parts, movers, html: rendered.html });
    if (!gate.passed) {
      console.warn(`[newsletter-digest] quality gate failed (${gate.failures.length}): ${gate.failures.join(" | ")}`);
      return NextResponse.json({ ok: true, reason: "gate_failed", failures: gate.failures });
    }

    const issueWeek = isoWeekTag(now);
    const created = await store.create({
      issueWeek,
      subject: rendered.subject,
      previewText: rendered.previewText,
      htmlBody: rendered.html,
      markdownBody: rendered.bodyMarkdown,
      downCount: rendered.downCount,
      upCount: rendered.upCount,
      expiresAt: digestExpiryFrom(nowMs),
    });
    if (!created) {
      // Unique-violation (already have this week's draft) or a DB error — either
      // way, do not post a second approval card.
      return NextResponse.json({ ok: true, reason: "draft_exists_or_db_error", issueWeek });
    }

    const contentWebhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    if (contentWebhook) {
      await postNewsletterApprovalRequest(contentWebhook, {
        draftId: created.id,
        issueWeek,
        subject: rendered.subject,
        previewText: rendered.previewText,
        downCount: rendered.downCount,
        upCount: rendered.upCount,
        topCards: topCardsSummary(movers.down),
        expiresLabel: `${DEFAULT_DIGEST_EXPIRY_HOURS}h (then auto-skipped)`,
      });
    } else {
      console.warn("[newsletter-digest] DISCORD_WEBHOOK_CONTENT_ENGINE unset — draft persisted but no approval card posted");
    }

    return NextResponse.json({ ok: true, reason: "awaiting_approval", draftId: created.id, issueWeek });
  } catch (err) {
    // Soft-fail: a digest cron failure must never 500 (it would page Vercel + the
    // next week's run recovers anyway).
    console.error("[newsletter-digest] cron failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
