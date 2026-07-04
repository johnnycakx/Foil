// Reply-desk approve store (x-reply-desk, ADR-107 §1) — the service-role DB ops
// behind processReplyApproval. Atomic status transitions on `reply_desk_items`
// give claim-once idempotency: two Reply clicks (or a retry) can never
// double-post, and a failed post releases the claim so the owner can retry.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { ReplyDeskApproveStore, ClaimedReply } from "./approve.ts";

const TABLE = "reply_desk_items";

export function supabaseReplyDeskApproveStore(): ReplyDeskApproveStore {
  const db = () => supabaseAdmin() as unknown as SupabaseClient;
  return {
    async claimForPosting(postId): Promise<ClaimedReply | null> {
      // pending → posting, atomically. Only the row still 'pending' is claimed.
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "posting", decided_at: new Date().toISOString() })
        .eq("post_id", postId)
        .eq("status", "pending")
        .select("post_id, reply");
      if (error) {
        console.warn(`[reply-desk] claim failed: ${error.message}`);
        return null;
      }
      const row = (data ?? [])[0] as { post_id: string; reply: string } | undefined;
      return row ? { post_id: row.post_id, reply: row.reply } : null;
    },
    async markPosted(postId, replyId): Promise<void> {
      const { error } = await db()
        .from(TABLE)
        .update({ status: "posted", posted_reply_id: replyId })
        .eq("post_id", postId);
      if (error) console.warn(`[reply-desk] markPosted failed: ${error.message}`);
    },
    async release(postId): Promise<void> {
      const { error } = await db().from(TABLE).update({ status: "pending" }).eq("post_id", postId);
      if (error) console.warn(`[reply-desk] release failed: ${error.message}`);
    },
    async skip(postId): Promise<{ ok: boolean; status?: string }> {
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "skipped", decided_at: new Date().toISOString() })
        .eq("post_id", postId)
        .eq("status", "pending")
        .select("post_id");
      if (error) return { ok: false, status: "error" };
      if ((data ?? []).length > 0) return { ok: true };
      const cur = await this.get(postId);
      return { ok: false, status: cur?.status ?? "missing" };
    },
    async get(postId): Promise<{ status: string } | null> {
      const { data, error } = await db().from(TABLE).select("status").eq("post_id", postId).maybeSingle();
      if (error || !data) return null;
      return { status: (data as { status: string }).status };
    },
  };
}
