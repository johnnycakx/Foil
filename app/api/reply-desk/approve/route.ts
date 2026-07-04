// Reply-desk APPROVE endpoint (x-reply-desk, ADR-107 §1). The Foil HQ bot POSTs
// here after the owner clicks Reply / Edit / Skip on a reply-desk card. On a
// post action it API-posts the drafted (or edited) reply IN-THREAD via the
// single X boundary (lib/social/x-client.ts::postToX with inReplyToTweetId) —
// permitted because the inbound is user-initiated contact. Soft-fails; idempotent
// (claim-once). Cold replies never reach here (they are intent-link/human-send).
//
// Auth: Bearer X_REPLY_DESK_SECRET — a DEDICATED secret (NOT CRON_SECRET nor
// X_APPROVE_SECRET) so a bot compromise's reply-desk blast radius is limited to
// posting replies to people who contacted us, nothing else.

import { NextResponse } from "next/server";
import { processReplyApproval, type ReplyApprovalAction } from "@/lib/reply-desk/approve";
import { supabaseReplyDeskApproveStore } from "@/lib/reply-desk/store";
import { postToX } from "@/lib/social/x-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWN_USERNAME = "FoilTCG";

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.X_REPLY_DESK_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: "missing_x_reply_desk_secret" }, { status: 503 });

  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { id?: unknown; action?: unknown; text?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action === "post" || body.action === "skip" ? (body.action as ReplyApprovalAction) : null;
  const text = typeof body.text === "string" ? body.text : null;
  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "missing_id_or_action" }, { status: 400 });
  }

  const result = await processReplyApproval({
    store: supabaseReplyDeskApproveStore(),
    post: (x) => postToX({ text: x.text, inReplyToTweetId: x.inReplyToTweetId }),
    id,
    action,
    text,
    ownUsername: OWN_USERNAME,
  });

  // 200 on a clean post/skip; 409 on an idempotent no-op (already handled);
  // 502 when the X post itself failed. The bot surfaces this to Discord.
  const status = result.ok ? 200 : result.status ? 409 : 502;
  return NextResponse.json(result, { status });
}
