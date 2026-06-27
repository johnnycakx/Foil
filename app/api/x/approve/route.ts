// X content-bot approval endpoint (ADR-071). The Foil HQ Discord bot calls this
// after the OWNER runs /approve <id> or /skip <id> (the bot does the Discord
// owner-gate; this endpoint trusts the shared bearer secret = "the request came
// from our bot"). On approve it posts EXACTLY the persisted draft via the single
// X boundary (lib/social/x-client.ts). Soft-fails; idempotent (claim-once).
//
// Auth: Bearer X_APPROVE_SECRET. This is a dedicated secret (NOT CRON_SECRET) so
// the bot's blast radius is limited to X approvals, never the cron surface.

import { NextResponse } from "next/server";
import { processApproval, type ApprovalAction } from "@/lib/social/approval";
import { supabaseDraftStore } from "@/lib/social/drafts";
import { postToX } from "@/lib/social/x-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.X_APPROVE_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: "missing_x_approve_secret" }, { status: 503 });

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
  const action = body.action === "approve" || body.action === "skip" ? (body.action as ApprovalAction) : null;
  const actor = typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "owner";
  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "missing_id_or_action" }, { status: 400 });
  }

  const result = await processApproval({
    store: supabaseDraftStore(),
    post: (x) => postToX({ text: x.text, imagePng: x.imagePng }),
    id,
    action,
    actor,
  });

  // 200 on a clean approve/skip; 409 on an idempotent no-op (already handled /
  // expired); 502 when the X post itself failed. The bot surfaces this to Discord.
  const status = result.ok ? 200 : result.status ? 409 : 502;
  return NextResponse.json(result, { status });
}
