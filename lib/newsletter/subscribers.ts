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

/**
 * Record a subscriber into the owned list + the Resend audience. Best-effort on
 * both legs; returns which succeeded (for telemetry). Never throws.
 *
 * Resend is skipped (resend:false) when RESEND_AUDIENCE_ID is unset, so the loop
 * degrades cleanly before the audience is provisioned.
 */
export async function recordSubscriber(input: { email: string; source: string }): Promise<RecordSubscriberResult> {
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
    const { error } = await db
      .from("newsletter_subscribers")
      .upsert(
        { email, source, resend_contact_id: resendContactId, unsubscribed_at: null },
        { onConflict: "email", ignoreDuplicates: false },
      );
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
