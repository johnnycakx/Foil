// Newsletter digest APPROVAL-mode draft store (ADR-077). The
// `newsletter_digest_drafts` table holds the EXACT subject + preview + HTML the
// cron summarized to the owner in Discord, so the thing approved is byte-
// identical to the thing emailed for the Beehiiv paste.
//
// Mirrors lib/social/drafts.ts (the X bot's store): a small interface
// (DigestDraftStore) over the service-role admin client, unit-testable against
// an in-memory fake. Idempotency lives in claimForDelivery: an ATOMIC
// conditional update (pending + not-expired -> delivering) returning the row,
// so a double-approve / retry can claim at most once. A delivery (email) that
// then fails RELEASEs back to pending so the owner can re-approve.
//
// Distinct from x_post_drafts because the live X approval path is load-bearing;
// cloning keeps the newsletter loop isolated rather than overloading that
// route/table (the goal's "clone, don't generalize the fragile path" call).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";

export type DigestDraftStatus = "pending" | "delivering" | "delivered" | "skipped" | "expired";

export type DigestDraft = {
  id: string;
  issue_week: string;
  subject: string;
  preview_text: string;
  html_body: string;
  markdown_body: string;
  down_count: number;
  up_count: number;
  status: DigestDraftStatus;
  created_at: string;
  expires_at: string;
  approved_by: string | null;
  delivered_at: string | null;
  delivery_id: string | null;
  error: string | null;
};

export type NewDigestDraft = {
  issueWeek: string;
  subject: string;
  previewText: string;
  htmlBody: string;
  markdownBody: string;
  downCount: number;
  upCount: number;
  /** ISO timestamp after which the draft can never be delivered (auto-skip). */
  expiresAt: string;
};

export interface DigestDraftStore {
  /** Insert a pending draft. Returns null when a draft already exists for this
   *  ISO week (unique violation) OR on any DB error — the cron treats both as
   *  "do not post another approval card this week". */
  create(d: NewDigestDraft): Promise<{ id: string } | null>;
  get(id: string): Promise<DigestDraft | null>;
  /** ATOMIC claim: pending + not-expired -> delivering. Returns the claimed row,
   *  or null if it was not claimable (already handled / expired / missing). The
   *  idempotency guard — a draft can be claimed (hence delivered) at most once. */
  claimForDelivery(id: string, actor: string, nowMs: number): Promise<DigestDraft | null>;
  markDelivered(id: string, deliveryId: string): Promise<void>;
  /** Email failed after a claim: delivering -> pending (a re-approve is OK). */
  release(id: string, error: string): Promise<void>;
  /** Owner /skip: pending -> skipped. */
  skip(id: string, actor: string): Promise<{ ok: boolean; status: DigestDraftStatus | "missing" }>;
  /** Sweep: every pending draft past expires_at -> expired. Returns count. */
  expireStale(nowMs: number): Promise<number>;
}

/** Approval drafts auto-skip well before the next weekly run so a stale digest
 *  can never be delivered as "this week". 5 days < the 7-day cadence. */
export const DEFAULT_DIGEST_EXPIRY_HOURS = 120;

export function digestExpiryFrom(nowMs: number, hours: number = DEFAULT_DIGEST_EXPIRY_HOURS): string {
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}

const TABLE = "newsletter_digest_drafts";

function rowToDraft(r: Record<string, unknown>): DigestDraft {
  return {
    id: String(r.id),
    issue_week: String(r.issue_week ?? ""),
    subject: String(r.subject ?? ""),
    preview_text: String(r.preview_text ?? ""),
    html_body: String(r.html_body ?? ""),
    markdown_body: String(r.markdown_body ?? ""),
    down_count: typeof r.down_count === "number" ? r.down_count : 0,
    up_count: typeof r.up_count === "number" ? r.up_count : 0,
    status: (r.status as DigestDraftStatus) ?? "pending",
    created_at: String(r.created_at ?? ""),
    expires_at: String(r.expires_at ?? ""),
    approved_by: (r.approved_by as string | null) ?? null,
    delivered_at: (r.delivered_at as string | null) ?? null,
    delivery_id: (r.delivery_id as string | null) ?? null,
    error: (r.error as string | null) ?? null,
  };
}

/** Production store: service-role Supabase. Soft-fails (null/0) on any DB error
 *  so a transient outage can't crash the cron or the approve route. */
export function supabaseDigestDraftStore(injected?: SupabaseClient): DigestDraftStore {
  const db = (): SupabaseClient => injected ?? (supabaseAdmin() as unknown as SupabaseClient);

  return {
    async create(d) {
      const { data, error } = await db()
        .from(TABLE)
        .insert({
          issue_week: d.issueWeek,
          subject: d.subject,
          preview_text: d.previewText,
          html_body: d.htmlBody,
          markdown_body: d.markdownBody,
          down_count: d.downCount,
          up_count: d.upCount,
          expires_at: d.expiresAt,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !data) {
        // 23505 = unique violation on issue_week (this week's digest already
        // exists). Logged as info, not a warning — it's the idempotency guard.
        if ((error as { code?: string } | null)?.code === "23505") {
          console.log(`[digest-drafts] draft for ${d.issueWeek} already exists — skip`);
        } else {
          console.warn("[digest-drafts] create failed:", error?.message);
        }
        return null;
      }
      return { id: String((data as { id: string }).id) };
    },

    async get(id) {
      const { data, error } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
      if (error || !data) return null;
      return rowToDraft(data as Record<string, unknown>);
    },

    async claimForDelivery(id, actor, nowMs) {
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "delivering", approved_by: actor })
        .eq("id", id)
        .eq("status", "pending")
        .gt("expires_at", new Date(nowMs).toISOString())
        .select("*")
        .maybeSingle();
      if (error || !data) return null; // 0 rows = not claimable (handled/expired/missing).
      return rowToDraft(data as Record<string, unknown>);
    },

    async markDelivered(id, deliveryId) {
      const { error } = await db()
        .from(TABLE)
        .update({ status: "delivered", delivered_at: new Date().toISOString(), delivery_id: deliveryId, error: null })
        .eq("id", id);
      if (error) console.warn("[digest-drafts] markDelivered failed:", error.message);
    },

    async release(id, errMsg) {
      const { error } = await db()
        .from(TABLE)
        .update({ status: "pending", error: errMsg })
        .eq("id", id)
        .eq("status", "delivering");
      if (error) console.warn("[digest-drafts] release failed:", error.message);
    },

    async skip(id, actor) {
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "skipped", approved_by: actor })
        .eq("id", id)
        .eq("status", "pending")
        .select("status")
        .maybeSingle();
      if (error) return { ok: false, status: "missing" };
      if (data) return { ok: true, status: "skipped" };
      const cur = await this.get(id);
      return { ok: false, status: cur ? cur.status : "missing" };
    },

    async expireStale(nowMs) {
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "expired" })
        .eq("status", "pending")
        .lte("expires_at", new Date(nowMs).toISOString())
        .select("id");
      if (error || !data) return 0;
      return (data as unknown[]).length;
    },
  };
}

/** In-memory store for tests. Mirrors the atomic semantics of the SQL store,
 *  including the per-ISO-week uniqueness guard (create returns null on dup). */
export class InMemoryDigestDraftStore implements DigestDraftStore {
  private rows = new Map<string, DigestDraft>();
  private weeks = new Set<string>();
  private seq = 0;
  private clock: () => number;
  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  peek(id: string): DigestDraft | null {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }

  async create(d: NewDigestDraft): Promise<{ id: string } | null> {
    if (this.weeks.has(d.issueWeek)) return null; // unique(issue_week)
    const id = `digest-${++this.seq}`;
    this.weeks.add(d.issueWeek);
    this.rows.set(id, {
      id,
      issue_week: d.issueWeek,
      subject: d.subject,
      preview_text: d.previewText,
      html_body: d.htmlBody,
      markdown_body: d.markdownBody,
      down_count: d.downCount,
      up_count: d.upCount,
      status: "pending",
      created_at: new Date(this.clock()).toISOString(),
      expires_at: d.expiresAt,
      approved_by: null,
      delivered_at: null,
      delivery_id: null,
      error: null,
    });
    return { id };
  }

  async get(id: string): Promise<DigestDraft | null> {
    return this.peek(id);
  }

  async claimForDelivery(id: string, actor: string, nowMs: number): Promise<DigestDraft | null> {
    const r = this.rows.get(id);
    if (!r || r.status !== "pending") return null;
    if (Date.parse(r.expires_at) <= nowMs) return null;
    r.status = "delivering";
    r.approved_by = actor;
    return { ...r };
  }

  async markDelivered(id: string, deliveryId: string): Promise<void> {
    const r = this.rows.get(id);
    if (r) { r.status = "delivered"; r.delivery_id = deliveryId; r.delivered_at = new Date(this.clock()).toISOString(); r.error = null; }
  }

  async release(id: string, errMsg: string): Promise<void> {
    const r = this.rows.get(id);
    if (r && r.status === "delivering") { r.status = "pending"; r.error = errMsg; }
  }

  async skip(id: string, actor: string): Promise<{ ok: boolean; status: DigestDraftStatus | "missing" }> {
    const r = this.rows.get(id);
    if (!r) return { ok: false, status: "missing" };
    if (r.status !== "pending") return { ok: false, status: r.status };
    r.status = "skipped";
    r.approved_by = actor;
    return { ok: true, status: "skipped" };
  }

  async expireStale(nowMs: number): Promise<number> {
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.status === "pending" && Date.parse(r.expires_at) <= nowMs) { r.status = "expired"; n++; }
    }
    return n;
  }
}
