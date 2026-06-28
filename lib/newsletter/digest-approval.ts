// Newsletter digest APPROVAL handler (ADR-077). The pure core of "owner approved
// -> deliver exactly the persisted digest" (and "owner skipped -> don't deliver").
// All deps (the draft store + the deliver fn) are injected, so the full path is
// unit-testable without Discord, Supabase, or Resend.
//
// Mirrors lib/social/approval.ts (the X bot), with "post to X" replaced by
// "deliver the paste-ready issue" (email the founder). Idempotency lives in
// claimForDelivery: a second approve / retry gets null and never double-delivers.
// A delivery that FAILS releases back to pending so the owner can re-approve.

import type { DigestDraftStore } from "./digest-drafts.ts";

export type DigestApprovalAction = "approve" | "skip";

export type DigestDeliverResult = { ok: true; deliveryId: string } | { ok: false; error: string };

export type DigestApprovalResult =
  | { ok: true; action: "delivered"; deliveryId: string; subject: string }
  | { ok: true; action: "skipped" }
  | { ok: false; error: string; status?: string };

export type DigestApprovalDeps = {
  store: DigestDraftStore;
  /** Deliver the persisted paste-ready issue (email the founder). The single
   *  delivery boundary — this never re-generates, it ships exactly what was
   *  approved. */
  deliver: (draft: {
    subject: string;
    previewText: string;
    htmlBody: string;
    issueWeek: string;
    downCount: number;
    upCount: number;
  }) => Promise<DigestDeliverResult>;
  id: string;
  action: DigestApprovalAction;
  /** Who approved (the owner's Discord handle), recorded for audit. */
  actor: string;
  nowMs?: number;
};

export async function processDigestApproval(deps: DigestApprovalDeps): Promise<DigestApprovalResult> {
  const { store, id, action, actor } = deps;
  const nowMs = deps.nowMs ?? Date.now();

  if (action === "skip") {
    const r = await store.skip(id, actor);
    if (r.ok) return { ok: true, action: "skipped" };
    return {
      ok: false,
      error: r.status === "missing" ? "draft_not_found" : `not_skippable_status_${r.status}`,
      status: r.status,
    };
  }

  // approve: atomic claim (pending + not-expired -> delivering). Idempotency +
  // expiry guard — a second approve (or retry) gets null.
  const claimed = await store.claimForDelivery(id, actor, nowMs);
  if (!claimed) {
    const cur = await store.get(id);
    if (!cur) return { ok: false, error: "draft_not_found" };
    return { ok: false, error: `not_deliverable_status_${cur.status}`, status: cur.status };
  }

  const res = await deps.deliver({
    subject: claimed.subject,
    previewText: claimed.preview_text,
    htmlBody: claimed.html_body,
    issueWeek: claimed.issue_week,
    downCount: claimed.down_count,
    upCount: claimed.up_count,
  });
  if (!res.ok) {
    // Release back to pending so the owner can re-approve once the issue clears.
    await store.release(id, res.error);
    return { ok: false, error: res.error };
  }

  await store.markDelivered(id, res.deliveryId);
  return { ok: true, action: "delivered", deliveryId: res.deliveryId, subject: claimed.subject };
}
