// X content-bot APPROVAL-mode draft store (ADR-071). The `x_post_drafts` table
// holds the EXACT text + rendered image the cron showed the owner in Discord, so
// the thing approved is byte-identical to the thing posted.
//
// Access is a small interface (DraftStore) so the approve/cron logic is unit-
// testable against an in-memory fake (the refresh-batch injection pattern). The
// real impl wraps the service-role Supabase admin client. The generated Database
// type does not include x_post_drafts (migration applied at deploy, after
// codegen), so the real store uses an untyped client for this isolated table.
//
// Idempotency lives in claimForPosting: an ATOMIC conditional update
// (pending + not-expired -> posting) returning the row, so a double-approve /
// retry can claim at most once. A post that then fails RELEASEs back to pending.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";

export type DraftStatus = "pending" | "posting" | "posted" | "skipped" | "expired";

export type XPostDraft = {
  id: string;
  angle: string;
  text: string;
  link: string;
  image_base64: string | null;
  /** The MP4 motion clip (ADR-074 Phase 1), base64. Null = still-only draft.
   *  Persisted ALONGSIDE the still so the approve path can prefer the clip and
   *  fall back to the still on an upload reject. */
  video_base64: string | null;
  status: DraftStatus;
  created_at: string;
  expires_at: string;
  approved_by: string | null;
  posted_at: string | null;
  post_id: string | null;
  error: string | null;
};

export type NewDraft = {
  angle: string;
  text: string;
  link: string;
  imageBase64: string | null;
  /** The MP4 motion clip (ADR-074), base64. Null = still-only. */
  videoBase64?: string | null;
  /** ISO timestamp after which the draft can never be posted (auto-skip). */
  expiresAt: string;
};

export interface DraftStore {
  create(d: NewDraft): Promise<{ id: string } | null>;
  get(id: string): Promise<XPostDraft | null>;
  /** ATOMIC claim: pending + not-expired -> posting. Returns the claimed row, or
   *  null if it was not claimable (already handled / expired / missing). This is
   *  the idempotency guard — a draft can be claimed (hence posted) at most once. */
  claimForPosting(id: string, actor: string, nowMs: number): Promise<XPostDraft | null>;
  markPosted(id: string, postId: string): Promise<void>;
  /** Post failed after a claim: posting -> pending (a retry/re-approve is OK). */
  release(id: string, error: string): Promise<void>;
  /** Owner /skip: pending -> skipped. */
  skip(id: string, actor: string): Promise<{ ok: boolean; status: DraftStatus | "missing" }>;
  /** Sweep: every pending draft past expires_at -> expired. Returns count. */
  expireStale(nowMs: number): Promise<number>;
}

export const DEFAULT_APPROVAL_EXPIRY_HOURS = 12;

/** ISO expiry `hours` after `nowMs`. */
export function expiryFrom(nowMs: number, hours: number = DEFAULT_APPROVAL_EXPIRY_HOURS): string {
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}

/** Image (de)serialization for the persisted draft. Node runtime (Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const TABLE = "x_post_drafts";

function rowToDraft(r: Record<string, unknown>): XPostDraft {
  return {
    id: String(r.id),
    angle: String(r.angle ?? ""),
    text: String(r.text ?? ""),
    link: String(r.link ?? ""),
    image_base64: (r.image_base64 as string | null) ?? null,
    video_base64: (r.video_base64 as string | null) ?? null,
    status: (r.status as DraftStatus) ?? "pending",
    created_at: String(r.created_at ?? ""),
    expires_at: String(r.expires_at ?? ""),
    approved_by: (r.approved_by as string | null) ?? null,
    posted_at: (r.posted_at as string | null) ?? null,
    post_id: (r.post_id as string | null) ?? null,
    error: (r.error as string | null) ?? null,
  };
}

/** The production store: service-role Supabase. Soft-fails (returns null/0/[]) on
 *  any DB error so a transient outage can't crash the cron or the approve route. */
export function supabaseDraftStore(injected?: SupabaseClient): DraftStore {
  // Untyped client for the isolated table (not in the generated Database type).
  const db = (): SupabaseClient => injected ?? (supabaseAdmin() as unknown as SupabaseClient);

  return {
    async create(d) {
      const { data, error } = await db()
        .from(TABLE)
        .insert({ angle: d.angle, text: d.text, link: d.link, image_base64: d.imageBase64, video_base64: d.videoBase64 ?? null, expires_at: d.expiresAt, status: "pending" })
        .select("id")
        .single();
      if (error || !data) {
        console.warn("[x-drafts] create failed:", error?.message);
        return null;
      }
      return { id: String((data as { id: string }).id) };
    },

    async get(id) {
      const { data, error } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
      if (error || !data) return null;
      return rowToDraft(data as Record<string, unknown>);
    },

    async claimForPosting(id, actor, nowMs) {
      const { data, error } = await db()
        .from(TABLE)
        .update({ status: "posting", approved_by: actor })
        .eq("id", id)
        .eq("status", "pending")
        .gt("expires_at", new Date(nowMs).toISOString())
        .select("*")
        .maybeSingle();
      if (error || !data) return null; // 0 rows = not claimable (handled/expired/missing).
      return rowToDraft(data as Record<string, unknown>);
    },

    async markPosted(id, postId) {
      const { error } = await db()
        .from(TABLE)
        .update({ status: "posted", posted_at: new Date().toISOString(), post_id: postId, error: null })
        .eq("id", id);
      if (error) console.warn("[x-drafts] markPosted failed:", error.message);
    },

    async release(id, errMsg) {
      const { error } = await db()
        .from(TABLE)
        .update({ status: "pending", error: errMsg })
        .eq("id", id)
        .eq("status", "posting");
      if (error) console.warn("[x-drafts] release failed:", error.message);
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

/** In-memory store for tests. Mirrors the atomic semantics of the SQL store. */
export class InMemoryDraftStore implements DraftStore {
  private rows = new Map<string, XPostDraft>();
  private seq = 0;
  private clock: () => number;
  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
  }

  /** Test helper: snapshot a row. */
  peek(id: string): XPostDraft | null {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }

  async create(d: NewDraft): Promise<{ id: string }> {
    const id = `draft-${++this.seq}`;
    this.rows.set(id, {
      id, angle: d.angle, text: d.text, link: d.link, image_base64: d.imageBase64,
      video_base64: d.videoBase64 ?? null,
      status: "pending", created_at: new Date(this.clock()).toISOString(), expires_at: d.expiresAt,
      approved_by: null, posted_at: null, post_id: null, error: null,
    });
    return { id };
  }

  async get(id: string): Promise<XPostDraft | null> {
    return this.peek(id);
  }

  async claimForPosting(id: string, actor: string, nowMs: number): Promise<XPostDraft | null> {
    const r = this.rows.get(id);
    if (!r || r.status !== "pending") return null;
    if (Date.parse(r.expires_at) <= nowMs) return null;
    r.status = "posting";
    r.approved_by = actor;
    return { ...r };
  }

  async markPosted(id: string, postId: string): Promise<void> {
    const r = this.rows.get(id);
    if (r) { r.status = "posted"; r.post_id = postId; r.posted_at = new Date(this.clock()).toISOString(); r.error = null; }
  }

  async release(id: string, errMsg: string): Promise<void> {
    const r = this.rows.get(id);
    if (r && r.status === "posting") { r.status = "pending"; r.error = errMsg; }
  }

  async skip(id: string, actor: string): Promise<{ ok: boolean; status: DraftStatus | "missing" }> {
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
