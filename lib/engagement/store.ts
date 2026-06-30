// Engagement-brief idempotency store (ADR-086). A post is briefed at most once,
// so John never sees the same target twice across days. Backed by the isolated,
// service-role-only Supabase table `engagement_briefed_posts` (RLS on, no
// policies — same pattern as the newsletter/x tables). Injectable so the
// orchestrator's idempotency is unit-tested with a fake.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";

export type BriefStore = {
  /** Of the given post ids, which have ALREADY been briefed (to exclude them). */
  seenIds: (postIds: string[]) => Promise<Set<string>>;
  /** Record these post ids as briefed (idempotent upsert). */
  markBriefed: (postIds: string[]) => Promise<void>;
};

/** Default store: the isolated Supabase table via the service-role client. */
export function supabaseBriefStore(): BriefStore {
  return {
    async seenIds(postIds) {
      const ids = [...new Set(postIds.filter(Boolean))];
      if (ids.length === 0) return new Set();
      try {
        const db = supabaseAdmin() as unknown as SupabaseClient;
        const { data, error } = await db
          .from("engagement_briefed_posts")
          .select("post_id")
          .in("post_id", ids);
        if (error) {
          // Soft-fail: on a read error, treat nothing as seen rather than block
          // the brief. Worst case is a possible repeat, never a missed brief.
          console.warn(`[engagement] seenIds query failed: ${error.message}`);
          return new Set();
        }
        return new Set((data ?? []).map((r) => (r as { post_id: string }).post_id));
      } catch (err) {
        console.warn(`[engagement] seenIds threw: ${(err as Error).message}`);
        return new Set();
      }
    },
    async markBriefed(postIds) {
      const ids = [...new Set(postIds.filter(Boolean))];
      if (ids.length === 0) return;
      try {
        const db = supabaseAdmin() as unknown as SupabaseClient;
        const rows = ids.map((post_id) => ({ post_id }));
        const { error } = await db
          .from("engagement_briefed_posts")
          .upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
        if (error) console.warn(`[engagement] markBriefed failed: ${error.message}`);
      } catch (err) {
        console.warn(`[engagement] markBriefed threw: ${(err as Error).message}`);
      }
    },
  };
}
