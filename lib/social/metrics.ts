// X post-metrics capture (ADR-071 follow-up, Part 2). Finds posts ~48h old that
// lack a metrics row, fetches public_metrics once, and stores them in
// x_post_metrics. CAPTURE ONLY — nothing here changes generation; this just
// builds the dataset for the deferred self-learning loop (docs/IDEAS.md).
//
// Same injection shape as drafts.ts: a MetricsStore interface (Supabase impl +
// InMemory for tests) and a pure processMetricsRun(deps) so the run is testable
// without Supabase or the live X API. The tweet id is already on x_post_drafts
// (post_id, persisted at approve time) — no extra column needed there.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { FetchTweetMetricsResult } from "./x-client.ts";

export const DEFAULT_METRICS_MIN_AGE_HOURS = 48;

export type PendingPost = { draftId: string; tweetId: string; angle: string | null };

export type RecordedMetric = {
  draftId: string;
  tweetId: string;
  angle: string | null;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  impressions: number | null;
};

export interface MetricsStore {
  /** Posted drafts older than `minAgeHours` that have a tweet id and no metrics row yet. */
  pendingPosts(nowMs: number, minAgeHours: number): Promise<PendingPost[]>;
  record(m: RecordedMetric): Promise<void>;
  /** The tweet was deleted/inaccessible before capture — record that, once. */
  markDeleted(draftId: string, tweetId: string, angle: string | null): Promise<void>;
}

export type MetricsRunResult = {
  ok: boolean;
  pending: number;
  recorded: number;
  deleted: number;
  error?: string;
};

/**
 * One capture pass: find pending posts, fetch their metrics in a single lookup,
 * store each (or mark deleted when the API didn't return it). Soft-fails the
 * whole run on a fetch error; per-post writes soft-fail in the store.
 */
export async function processMetricsRun(deps: {
  store: MetricsStore;
  fetchMetrics: (ids: string[]) => Promise<FetchTweetMetricsResult>;
  nowMs?: number;
  minAgeHours?: number;
}): Promise<MetricsRunResult> {
  const nowMs = deps.nowMs ?? Date.now();
  const minAgeHours = deps.minAgeHours ?? DEFAULT_METRICS_MIN_AGE_HOURS;

  const pending = await deps.store.pendingPosts(nowMs, minAgeHours);
  if (pending.length === 0) return { ok: true, pending: 0, recorded: 0, deleted: 0 };

  const res = await deps.fetchMetrics(pending.map((p) => p.tweetId));
  if (!res.ok) return { ok: false, pending: pending.length, recorded: 0, deleted: 0, error: res.error };

  let recorded = 0;
  let deleted = 0;
  for (const p of pending) {
    const m = res.metrics.get(p.tweetId);
    if (m) {
      await deps.store.record({
        draftId: p.draftId,
        tweetId: p.tweetId,
        angle: p.angle,
        likes: m.likes,
        reposts: m.reposts,
        replies: m.replies,
        quotes: m.quotes,
        impressions: m.impressions,
      });
      recorded++;
    } else {
      await deps.store.markDeleted(p.draftId, p.tweetId, p.angle);
      deleted++;
    }
  }
  return { ok: true, pending: pending.length, recorded, deleted };
}

const DRAFTS = "x_post_drafts";
const METRICS = "x_post_metrics";

/** Production store: service-role Supabase. Soft-fails (returns []/no-op) on error. */
export function supabaseMetricsStore(injected?: SupabaseClient): MetricsStore {
  const db = (): SupabaseClient => injected ?? (supabaseAdmin() as unknown as SupabaseClient);

  return {
    async pendingPosts(nowMs, minAgeHours) {
      const cutoff = new Date(nowMs - minAgeHours * 60 * 60 * 1000).toISOString();
      const { data: drafts, error } = await db()
        .from(DRAFTS)
        .select("id, post_id, angle, posted_at")
        .eq("status", "posted")
        .not("post_id", "is", null)
        .lte("posted_at", cutoff);
      if (error || !drafts || drafts.length === 0) return [];
      const { data: existing } = await db().from(METRICS).select("draft_id");
      const have = new Set((existing ?? []).map((r) => (r as { draft_id: string }).draft_id));
      return (drafts as Array<{ id: string; post_id: string; angle: string | null }>)
        .filter((d) => !have.has(d.id))
        .map((d) => ({ draftId: d.id, tweetId: d.post_id, angle: d.angle }));
    },

    async record(m) {
      const { error } = await db().from(METRICS).insert({
        draft_id: m.draftId,
        tweet_id: m.tweetId,
        angle: m.angle,
        likes: m.likes,
        reposts: m.reposts,
        replies: m.replies,
        quotes: m.quotes,
        impressions: m.impressions,
        deleted: false,
      });
      if (error) console.warn("[x-metrics] record failed:", error.message);
    },

    async markDeleted(draftId, tweetId, angle) {
      const { error } = await db().from(METRICS).insert({
        draft_id: draftId,
        tweet_id: tweetId,
        angle,
        deleted: true,
      });
      if (error) console.warn("[x-metrics] markDeleted failed:", error.message);
    },
  };
}

/** In-memory store for tests. Seed pending posts; record/markDeleted accumulate. */
export class InMemoryMetricsStore implements MetricsStore {
  private pending: PendingPost[] = [];
  recorded: RecordedMetric[] = [];
  deleted: Array<{ draftId: string; tweetId: string; angle: string | null }> = [];

  seedPending(posts: PendingPost[]): void {
    this.pending = posts;
  }

  async pendingPosts(): Promise<PendingPost[]> {
    const done = new Set([...this.recorded.map((r) => r.draftId), ...this.deleted.map((d) => d.draftId)]);
    return this.pending.filter((p) => !done.has(p.draftId));
  }

  async record(m: RecordedMetric): Promise<void> {
    this.recorded.push(m);
  }

  async markDeleted(draftId: string, tweetId: string, angle: string | null): Promise<void> {
    this.deleted.push({ draftId, tweetId, angle });
  }
}
