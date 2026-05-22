// Watchlist email-capture endpoint for /cards/[slug] pages.
//
// POST {email, card_slug, target_price_cents} → inserts a watchlists row via
// the service-role client (RLS gates everything else). The wishlist alert cron
// (ROADMAP NEXT #9) reads these rows hourly and emits a Resend email when the
// EPN best-listing price drops to the target.
//
// Public route — the page that posts here is anonymous-friendly (no auth in
// V1 per ADR-020). Zod validates the body so a malformed POST 400s cleanly
// without ever reaching the database. Error responses NEVER leak Supabase
// internals: the API surface is `{ok:true}` or `{ok:false, error:<short_tag>}`.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const watchlistSchema = z.object({
  email: z.string().email().max(254),
  card_slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "card_slug must be lowercase kebab-case"),
  target_price_cents: z.number().int().min(1).max(10_000_000),
});

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = watchlistSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    // Service-role key missing — log only, return a generic error.
    console.warn("[watchlist] supabaseAdmin() unavailable");
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { error } = await admin.from("watchlists").insert({
    email: parsed.data.email,
    card_slug: parsed.data.card_slug,
    target_price_cents: parsed.data.target_price_cents,
  });

  if (error) {
    console.warn("[watchlist] insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
