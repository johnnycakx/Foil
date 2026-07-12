// Magic-link confirmation route (auth-hardening, 2026-07-12).
//
// The SSR-correct pattern from the Supabase docs ("Email templates with
// server-side auth"): the magic-link email now links HERE with
// ?token_hash=…&type=email instead of the hosted {{ .ConfirmationURL }},
// whose implicit-flow hash tokens (#access_token=…) never reach the server —
// that was the /login?error=invalid_link failure in the 2026-07-12 prod smoke
// test. verifyOtp exchanges the token server-side, @supabase/ssr sets the
// session cookies, and the buyer lands signed in.
//
// Public route (the /auth prefix is in PUBLIC_ROUTES). `next` is untrusted
// (it rides an email URL): sanitized to a same-origin path.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/auth/next-path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.warn(`[auth/confirm] verifyOtp failed: ${error.message}`);
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
