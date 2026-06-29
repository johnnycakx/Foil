// Owned newsletter subscriber list (ADR-078). One place to record a signup into
// our source of truth (Supabase `newsletter_subscribers`) AND upsert the contact
// into the Resend marketing audience. Beehiiv stays a parallel write in the
// subscribe action (the hosted signup form + archive); this module owns the
// Supabase + Resend side.
//
// Soft-fail by design: a signup must never fail because the owned-list write or
// the Resend upsert hiccupped — the Beehiiv write in the caller already
// succeeded for the user. Each leg logs + continues.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import { upsertResendContact } from "../notifications/resend.ts";

export type RecordSubscriberResult = {
  /** Owned-list (Supabase) write succeeded. */
  supabase: boolean;
  /** Resend audience upsert succeeded (or the contact already existed). */
  resend: boolean;
};

/** Inbound UTM attribution captured from the landing URL at signup (ADR-084).
 *  All optional/untrusted — sanitized to [a-z0-9-] (≤64) before persistence. */
export type SubscriberUtm = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};

/**
 * Sanitize one UTM value: untrusted URL input → lowercase `[a-z0-9-]`, capped at
 * 64 chars, null when empty. Mirrors the `?src=` sanitizer in create-watchlist.ts
 * / epn.ts so every URL-derived attribution tag shares one safe charset. This is
 * defense-in-depth (the Supabase query builder already parameterizes) + data
 * hygiene (keeps the readout's group-by clean).
 */
export function sanitizeUtmValue(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return clean || null;
}

export function sanitizeUtm(utm?: SubscriberUtm): { source: string | null; medium: string | null; campaign: string | null } {
  return {
    source: sanitizeUtmValue(utm?.source),
    medium: sanitizeUtmValue(utm?.medium),
    campaign: sanitizeUtmValue(utm?.campaign),
  };
}

/**
 * Build the `newsletter_subscribers` upsert payload (pure — no IO, so the
 * attribution behavior is unit-tested without Supabase). The base columns are
 * always set; a sanitized UTM value is included ONLY when non-null, so on a
 * conflicting re-subscribe with no UTM the prior channel is preserved (sticky
 * first-touch: omitted keys aren't in the ON CONFLICT DO UPDATE SET). A
 * re-subscribe that DOES carry UTM overwrites it.
 */
export function buildSubscriberRow(input: {
  email: string;
  source: string;
  resendContactId: string | null;
  utm?: SubscriberUtm;
}): Record<string, unknown> {
  const utm = sanitizeUtm(input.utm);
  const row: Record<string, unknown> = {
    email: input.email,
    source: input.source,
    resend_contact_id: input.resendContactId,
    unsubscribed_at: null,
  };
  if (utm.source) row.utm_source = utm.source;
  if (utm.medium) row.utm_medium = utm.medium;
  if (utm.campaign) row.utm_campaign = utm.campaign;
  return row;
}

/**
 * Record a subscriber into the owned list + the Resend audience. Best-effort on
 * both legs; returns which succeeded (for telemetry). Never throws.
 *
 * Resend is skipped (resend:false) when RESEND_AUDIENCE_ID is unset, so the loop
 * degrades cleanly before the audience is provisioned.
 */
export async function recordSubscriber(input: {
  email: string;
  source: string;
  utm?: SubscriberUtm;
}): Promise<RecordSubscriberResult> {
  const email = input.email.trim().toLowerCase();
  const source = input.source.trim() || "unknown";
  const out: RecordSubscriberResult = { supabase: false, resend: false };
  if (!email) return out;

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  let resendContactId: string | null = null;

  // Resend audience upsert first so we can persist the contact id.
  if (audienceId) {
    const r = await upsertResendContact({ email, audienceId, unsubscribed: false });
    if (r.ok) {
      out.resend = true;
      resendContactId = r.contactId;
    } else {
      console.warn(`[subscribers] resend upsert failed: ${r.error}`);
    }
  }

  // Owned source of truth. Upsert on email so a re-subscribe is idempotent and
  // refreshes the source/contact id without duplicating rows.
  try {
    // Untyped client for the isolated table (not in the generated Database type
    // until the migration applies + codegen runs) — same pattern as digest-drafts.
    const db = supabaseAdmin() as unknown as SupabaseClient;
    const row = buildSubscriberRow({ email, source, resendContactId, utm: input.utm });
    const { error } = await db
      .from("newsletter_subscribers")
      .upsert(row, { onConflict: "email", ignoreDuplicates: false });
    if (error) {
      console.warn(`[subscribers] supabase upsert failed: ${error.message}`);
    } else {
      out.supabase = true;
    }
  } catch (err) {
    console.warn(`[subscribers] supabase upsert threw: ${(err as Error).message}`);
  }

  return out;
}
