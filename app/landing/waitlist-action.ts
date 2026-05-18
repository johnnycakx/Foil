"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok"; email: string }
  | { status: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  const source = String(formData.get("source") ?? "landing");

  if (!raw) return { status: "error", message: "Enter your email." };
  if (!EMAIL_RE.test(raw)) return { status: "error", message: "That email doesn't look right — try again?" };

  const admin = supabaseAdmin();
  const { error } = await admin.from("waitlist").insert({ email: raw, source });

  if (error) {
    // Postgres unique violation = 23505. Treat dupes as success — same UX, no leak about prior signups.
    if (error.code === "23505") {
      console.log(`[waitlist] duplicate signup: ${raw}`);
      return { status: "ok", email: raw };
    }
    console.error(`[waitlist] insert failed: ${error.message}`);
    return { status: "error", message: "Something broke on our end. Try again in a minute?" };
  }

  console.log(`[waitlist] signup: ${raw} source=${source}`);
  return { status: "ok", email: raw };
}
