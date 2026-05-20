"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseWaitlistForm } from "./waitlist-validate";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok"; email: string }
  | { status: "error"; message: string };

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = parseWaitlistForm(formData);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  const admin = supabaseAdmin();
  const { error } = await admin.from("waitlist").insert(parsed.row);

  if (error) {
    // Postgres unique violation = 23505. Treat dupes as success — same UX, no
    // leak about prior signups.
    if (error.code === "23505") {
      console.log(`[waitlist] duplicate signup: ${parsed.row.email}`);
      return { status: "ok", email: parsed.row.email };
    }
    console.error(`[waitlist] insert failed: ${error.message}`);
    return { status: "error", message: "Something broke on our end. Try again in a minute?" };
  }

  console.log(
    `[waitlist] signup: ${parsed.row.email} source=${parsed.row.source} utm=${parsed.row.utm_source ?? "-"}/${parsed.row.utm_campaign ?? "-"}`,
  );
  return { status: "ok", email: parsed.row.email };
}
