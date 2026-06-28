// X content-bot APPROVAL handler (ADR-071). The pure core of "owner approved →
// post exactly the persisted draft" (and "owner skipped → don't post"). All deps
// (the draft store + the X poster) are injected, so the full path is unit-
// testable without Discord, Supabase, or the live X API.
//
// SAFETY (the human-in-the-loop gate): this is the ONLY thing that posts in
// approval mode, and it posts ONLY after an explicit approve action carrying a
// valid draft id. The X poster (lib/social/x-client.ts) stays the single X
// boundary; this calls it with the persisted text + image, never re-generates.

import type { DraftStore } from "./drafts.ts";
import { base64ToBytes } from "./drafts.ts";
import type { PostToXResult } from "./x-client.ts";

export type ApprovalAction = "approve" | "skip";

export type ApprovalResult =
  | { ok: true; action: "posted"; postId: string; text: string }
  | { ok: true; action: "skipped" }
  | { ok: false; error: string; status?: string };

export type ApprovalDeps = {
  store: DraftStore;
  /** THE X API boundary (lib/social/x-client.ts::postToX). Posts the persisted
   *  clip when present (still as the upload-reject fallback), else the still.
   *  `linkReply` is the persisted draft link, posted as the first reply (Fix 3b). */
  post: (input: { text: string; imagePng: Uint8Array | null; videoMp4: Uint8Array | null; linkReply: string | null }) => Promise<PostToXResult>;
  id: string;
  action: ApprovalAction;
  /** Who approved (the owner's Discord id/handle), recorded for audit. */
  actor: string;
  /** Injectable clock for the expiry guard. */
  nowMs?: number;
};

export async function processApproval(deps: ApprovalDeps): Promise<ApprovalResult> {
  const { store, id, action, actor } = deps;
  const nowMs = deps.nowMs ?? Date.now();

  if (action === "skip") {
    const r = await store.skip(id, actor);
    if (r.ok) return { ok: true, action: "skipped" };
    return { ok: false, error: r.status === "missing" ? "draft_not_found" : `not_skippable_status_${r.status}`, status: r.status };
  }

  // approve: atomic claim (pending + not-expired -> posting). This is the
  // idempotency + expiry guard — a second approve (or a retry) gets null.
  const claimed = await store.claimForPosting(id, actor, nowMs);
  if (!claimed) {
    const cur = await store.get(id);
    if (!cur) return { ok: false, error: "draft_not_found" };
    // Already posting/posted/skipped/expired → idempotent no-op, never a 2nd post.
    return { ok: false, error: `not_postable_status_${cur.status}`, status: cur.status };
  }

  const imagePng = claimed.image_base64 ? base64ToBytes(claimed.image_base64) : null;
  const videoMp4 = claimed.video_base64 ? base64ToBytes(claimed.video_base64) : null;
  // The body is link-free; the persisted REPLY (v2.2: value-framed / newsletter-
  // rotated) is posted as the first reply (Fix 3b). Legacy rows with no reply_text
  // fall back to the bare link.
  const res = await deps.post({ text: claimed.text, imagePng, videoMp4, linkReply: claimed.reply_text || claimed.link || null });
  if (!res.ok) {
    // Release back to pending so the owner can re-approve once the issue clears.
    await store.release(id, res.error);
    return { ok: false, error: res.error };
  }

  await store.markPosted(id, res.postId);
  return { ok: true, action: "posted", postId: res.postId, text: claimed.text };
}
