// Newsletter digest approval endpoint (ADR-077). The Foil HQ Discord bot calls
// this after the OWNER runs /approve <id> or /skip <id> AND the id was not an X
// draft (the bot tries /api/x/approve first, then falls through to here). The
// bot does the Discord owner-gate; this endpoint trusts the shared bearer secret
// (= "the request came from our bot"). On approve it EMAILS the founder the
// persisted paste-ready issue (the no-spend send path — Beehiiv RSS-to-Send is a
// Max/Enterprise feature, not on Scale). Soft-fails; idempotent (claim-once).
//
// Auth: Bearer NEWSLETTER_APPROVE_SECRET. Dedicated secret (NOT X_APPROVE_SECRET
// nor CRON_SECRET) so the bot's newsletter blast radius is "email John a digest".

import { NextResponse } from "next/server";
import { processDigestApproval, type DigestApprovalAction } from "@/lib/newsletter/digest-approval";
import { supabaseDigestDraftStore } from "@/lib/newsletter/digest-drafts";
import { sendResendBroadcast, sendDigestApprovedEmail } from "@/lib/notifications/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "john.c.craig24@gmail.com";

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.NEWSLETTER_APPROVE_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "missing_newsletter_approve_secret" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown; action?: unknown; actor?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action === "approve" || body.action === "skip" ? (body.action as DigestApprovalAction) : null;
  const actor = typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "owner";
  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "missing_id_or_action" }, { status: 400 });
  }

  // ADR-078: on approve, SEND the digest as a Resend Broadcast to the audience
  // (we own the send; no Beehiiv paste). If RESEND_AUDIENCE_ID is unset, fall
  // back to emailing the founder the paste-ready issue (the ADR-077 no-spend
  // path) so a misconfig degrades to manual paste instead of a silent no-send.
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const result = await processDigestApproval({
    store: supabaseDigestDraftStore(),
    deliver: async (draft) => {
      if (audienceId) {
        // draft.htmlBody is the branded react-email render (ADR-079), which
        // already includes the CAN-SPAM footer + the native unsubscribe tag, so
        // it is sent as-is (no wrapBroadcastFooter — that would double the footer).
        const r = await sendResendBroadcast({
          audienceId,
          subject: draft.subject,
          html: draft.htmlBody,
          name: `good-buys-${draft.issueWeek}`,
        });
        return r.ok ? { ok: true, deliveryId: r.broadcastId } : { ok: false, error: r.error };
      }
      const r = await sendDigestApprovedEmail({ to: FOUNDER_EMAIL, ...draft });
      return r.ok ? { ok: true, deliveryId: r.messageId } : { ok: false, error: r.error ?? "email_failed" };
    },
    id,
    action,
    actor,
  });

  // 200 on a clean approve/skip; 409 on an idempotent no-op (already handled /
  // expired); 502 when the delivery (email) itself failed. The bot surfaces this.
  const status = result.ok ? 200 : result.status ? 409 : 502;
  return NextResponse.json(result, { status });
}
