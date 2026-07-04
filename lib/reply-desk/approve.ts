// Reply-desk APPROVE handler (x-reply-desk, ADR-107 §1). The pure core of
// "owner clicked Reply → API-post exactly the drafted (or edited) reply
// in-thread" and "owner clicked Skip → don't post". THE ONLY reply-desk path
// that writes to X — and it does so only for USER-INITIATED CONTACT (the inbound
// is a mention/reply to us), which X's automation rules permit. Cold replies
// never reach here (they are intent-link/human-send; see ADR-107's two-lane rule).
//
// Deps (the store + the X poster) are injected so the full path — claim-once
// idempotency, edit override, release-on-failure — is unit-tested without
// Discord, Supabase, or the live X API. Mirrors lib/social/approval.ts.

import type { PostToXResult } from "../social/x-client.ts";

export type ReplyApprovalAction = "post" | "skip";

export type ReplyApprovalResult =
  | { ok: true; action: "posted"; postId: string; permalink: string }
  | { ok: true; action: "skipped" }
  | { ok: false; error: string; status?: string };

export type ClaimedReply = { post_id: string; reply: string };

export type ReplyDeskApproveStore = {
  /** Atomic claim: pending → posting, returning the row. Null if not claimable
   *  (already posting/posted/skipped) — the idempotency guard. */
  claimForPosting: (postId: string) => Promise<ClaimedReply | null>;
  /** Finalize a successful post (status → posted + the reply id). */
  markPosted: (postId: string, replyId: string) => Promise<void>;
  /** Release a failed claim back to pending so the owner can retry. */
  release: (postId: string) => Promise<void>;
  /** Skip a pending item (status → skipped). */
  skip: (postId: string) => Promise<{ ok: boolean; status?: string }>;
  /** Current status (for reporting an idempotent no-op precisely). */
  get: (postId: string) => Promise<{ status: string } | null>;
};

export type ReplyApprovalDeps = {
  store: ReplyDeskApproveStore;
  /** The X poster, INJECTED (bound to the single X boundary only in the approve
   *  route): posts `text` as a reply to `inReplyToTweetId`. */
  post: (input: { text: string; inReplyToTweetId: string }) => Promise<PostToXResult>;
  /** The inbound tweet's id (post_id) — both the queue key AND the reply target. */
  id: string;
  action: ReplyApprovalAction;
  /** Edit override (the Edit button). Empty/absent → post the drafted reply. */
  text?: string | null;
  /** Our account username, for the confirmation permalink. */
  ownUsername: string;
};

export async function processReplyApproval(deps: ReplyApprovalDeps): Promise<ReplyApprovalResult> {
  const { store, id, action } = deps;

  if (action === "skip") {
    const r = await store.skip(id);
    if (r.ok) return { ok: true, action: "skipped" };
    return { ok: false, error: r.status === "missing" ? "item_not_found" : `not_skippable_status_${r.status}`, status: r.status };
  }

  // post: atomic claim (pending → posting). Second click / retry gets null.
  const claimed = await store.claimForPosting(id);
  if (!claimed) {
    const cur = await store.get(id);
    if (!cur) return { ok: false, error: "item_not_found" };
    return { ok: false, error: `not_postable_status_${cur.status}`, status: cur.status };
  }

  const text = (deps.text?.trim() || claimed.reply.trim());
  if (!text) {
    await store.release(id);
    return { ok: false, error: "empty_reply" };
  }

  const res = await deps.post({ text, inReplyToTweetId: id });
  if (!res.ok) {
    await store.release(id); // back to pending so the owner can re-approve
    return { ok: false, error: res.error };
  }

  await store.markPosted(id, res.postId);
  return {
    ok: true,
    action: "posted",
    postId: res.postId,
    permalink: `https://x.com/${deps.ownUsername}/status/${res.postId}`,
  };
}
