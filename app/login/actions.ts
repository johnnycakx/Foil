"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

/** Honest, card-shop-register error copy — never raw API text, never silence
 *  (the 2026-07-12 smoke test hit a rate-limit 503 whose empty message
 *  rendered as nothing at all). */
function friendlyError(raw: string | undefined, status?: number): string {
  const text = (raw ?? "").toLowerCase();
  if (status === 429 || status === 503 || text.includes("rate limit") || text.includes("too many")) {
    return "Too many sign-in emails just now. Wait a couple of minutes and try again.";
  }
  if (text.includes("invalid") && text.includes("email")) {
    return "That email doesn't look right. Check it and try again.";
  }
  return "The sign-in email didn't go out. Try again in a minute, and if it keeps failing email john.c.craig24@gmail.com.";
}

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: "Enter a valid email." };
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? `http://${hdrs.get("host")}`;

  // token_hash flow (auth-hardening, 2026-07-12): the email template links to
  // {{ .RedirectTo }}&token_hash=…, so this URL must carry a query string and
  // point at /auth/confirm. The old /auth/callback?code= path never matched
  // what magic-link emails actually carried.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/account` },
  });

  if (error) {
    console.warn(`[login] magic-link send failed (${error.status ?? "?"}): ${error.message}`);
    return { status: "error", message: friendlyError(error.message, error.status) };
  }
  return { status: "sent", message: email };
}
