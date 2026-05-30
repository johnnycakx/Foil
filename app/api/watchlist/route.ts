// Watchlist email-capture endpoint for /cards/[slug] pages.
//
// POST { email, card_slug, target_price_cents, opt_in_newsletter? } →
// inserts a watchlists row via the service-role client (RLS gates
// everything else), then OPTIONALLY subscribes the email to the Beehiiv
// newsletter list if `opt_in_newsletter` is true (Task #18 / Session 37).
//
// **Soft-fail contract on the newsletter subscribe.** A Beehiiv outage,
// rate-limit, or any other failure path MUST NOT cause the watchlist
// insert to fail or appear to fail to the caller. The watchlist row is
// the high-value primitive; the newsletter subscription is the bonus.
// The wishlist alert cron (ROADMAP NEXT #9) reads these rows hourly and
// emits a Resend email when the EPN best-listing price drops to target.
//
// Public route — the page that posts here is anonymous-friendly (no auth in
// V1 per ADR-020). Zod validates the body so a malformed POST 400s cleanly
// without ever reaching the database. Error responses NEVER leak Supabase
// internals: the API surface is `{ok:true}` or `{ok:false, error:<short_tag>}`.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";
import { getCatalogEntry } from "@/lib/cards/catalog";
import { getCardMetadata } from "@/lib/cards/sdk";
import { deriveAvailableVariants, DEFAULT_VARIANT_KEY } from "@/lib/poketrace/variant";
import { isValidConditionToken, DEFAULT_CONDITION } from "@/lib/cards/conditions";
import { upsertWatchlist } from "@/lib/wishlist/upsert";

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
  /** Variant + condition tokens (Session 49b / ADR-043). Optional on the wire
   *  so older clients keep working; default to the "any printing / any raw"
   *  sentinels. Validated against the card's real variants + the token set
   *  below before the upsert. */
  variant: z.string().max(60).optional(),
  condition: z.string().max(20).optional(),
  /** Newsletter opt-in checkbox state. Default-checked in the UI per
   *  ADR-027; defaults to false on the wire when the field is absent. */
  opt_in_newsletter: z.boolean().optional().default(false),
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

  // Variant + condition validation (Session 49b / ADR-043). Default to the
  // sentinels; validate a supplied variant against the card's real baked
  // variants and a supplied condition against the token set.
  const variant = parsed.data.variant && parsed.data.variant.length > 0 ? parsed.data.variant : DEFAULT_VARIANT_KEY;
  const condition = parsed.data.condition && parsed.data.condition.length > 0 ? parsed.data.condition : DEFAULT_CONDITION;
  if (!isValidConditionToken(condition)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  if (variant !== DEFAULT_VARIANT_KEY) {
    const entry = getCatalogEntry(parsed.data.card_slug);
    const card = entry ? await getCardMetadata({ id: entry.pokemonTcgId }) : null;
    if (!deriveAvailableVariants(card).includes(variant)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    // Service-role key missing — log only, return a generic error.
    console.warn("[watchlist] supabaseAdmin() unavailable");
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { ok: saved, error } = await upsertWatchlist(admin, {
    email: parsed.data.email,
    card_slug: parsed.data.card_slug,
    variant,
    condition,
    target_price_cents: parsed.data.target_price_cents,
  });

  if (!saved) {
    console.warn("[watchlist] upsert failed:", error);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  // Newsletter opt-in: soft-fail. We DELIBERATELY do not await the
  // subscribe inside an if-await pattern that lets failure surface — we
  // catch synchronously, log, and continue. A Beehiiv outage cannot block
  // the OK response. The subscriber's watchlist row is already committed
  // by the time this branch runs.
  if (parsed.data.opt_in_newsletter) {
    try {
      const subResult = await subscribeEmail({
        email: parsed.data.email,
        source: "watchlist-form",
      });
      if (!subResult.ok) {
        console.warn("[watchlist] beehiiv subscribe returned ok:false");
      }
    } catch (subErr) {
      console.warn("[watchlist] beehiiv subscribe threw:", (subErr as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
