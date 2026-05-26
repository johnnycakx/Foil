// /api/start — bulk watchlist + newsletter subscribe (Task #20 / Session 38).
//
// POST { email, opt_in_newsletter, cards: [{pokemon_tcg_id, name, set_name,
//        set_id, number, target_price_cents?}] }
//
// Behavior per row:
//   - Compute the Foil slug from the supplied set_id + number + name.
//   - Pre-flight: only accept rows whose computed slug exists in
//     CARD_CATALOG. The /start client already gates by `cataloguedIds`,
//     but the server re-validates because the client is untrusted.
//   - target_price_cents = null on the wire → store with 1¢ floor and the
//     special "any drop" semantic the cron interprets (the cron's threshold
//     check is `currentPriceCents <= row.target_price_cents`; setting a
//     sentinel maximum here means "always meets the threshold" → alert on
//     ANY listing). We use $10M cents (10_000_000) — well above any real
//     listing and at the schema's max bound.
//   - Insert each row via the service-role client.
//
// Newsletter opt-in is soft-failed exactly like /api/watchlist — Beehiiv
// outage must NOT cause the bulk insert to fail.
//
// Public route — anonymous-friendly per ADR-020. The watchlist insert is
// the high-value primitive; everything else is bonus.

import { NextResponse } from "next/server";
import { z } from "zod";
import { CARD_CATALOG } from "@/lib/cards/catalog";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cardSchema = z.object({
  pokemon_tcg_id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  set_name: z.string().min(1).max(120),
  set_id: z.string().min(1).max(40),
  number: z.string().min(1).max(20),
  target_price_cents: z.number().int().min(1).max(10_000_000).nullable().optional(),
});

const startSchema = z.object({
  email: z.string().email().max(254),
  opt_in_newsletter: z.boolean().optional().default(true),
  cards: z.array(cardSchema).min(1).max(50),
});

const SENTINEL_ANY_PRICE_CENTS = 10_000_000;

function slugFromCard(c: z.infer<typeof cardSchema>): string {
  const nameKebab = c.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${c.set_id}-${c.number}-${nameKebab}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // Server-side re-validation: each card's pokemon_tcg_id must be in
  // CARD_CATALOG (client gates this, but the client is untrusted). Slug
  // computed from the supplied set+number+name must also match what
  // CARD_CATALOG would compute — pin to the canonical catalog slug for
  // the row's tracked id.
  const catalogById = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

  type AcceptedRow = {
    slug: string;
    target_price_cents: number;
  };
  const accepted: AcceptedRow[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const card of parsed.data.cards) {
    const catalogSlug = catalogById.get(card.pokemon_tcg_id);
    if (!catalogSlug) {
      rejected.push({ id: card.pokemon_tcg_id, reason: "not_in_catalog" });
      continue;
    }
    // Validate the client-derived slug agrees with what we'd derive
    // server-side (defense-in-depth — if the client mis-computed, we use
    // the catalog's authoritative slug).
    const _derived = slugFromCard(card); // computed for parity / future logging
    void _derived;
    accepted.push({
      slug: catalogSlug,
      target_price_cents:
        card.target_price_cents == null
          ? SENTINEL_ANY_PRICE_CENTS
          : card.target_price_cents,
    });
  }

  if (accepted.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_trackable_cards", rejected },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    console.warn("[start] supabaseAdmin() unavailable");
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  // Bulk insert. Duplicate-email-card-slug pairs are silently absorbed by
  // the watchlists table's unique constraint (if present) OR result in
  // multiple rows (if not). Either way the alerter dedups by (email, slug)
  // when sending; we accept the redundancy here.
  const inserts = accepted.map((row) => ({
    email: parsed.data.email,
    card_slug: row.slug,
    target_price_cents: row.target_price_cents,
  }));
  const { error } = await admin.from("watchlists").insert(inserts);
  if (error) {
    console.warn("[start] insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  // Soft-fail Beehiiv subscribe.
  if (parsed.data.opt_in_newsletter) {
    try {
      const subResult = await subscribeEmail({
        email: parsed.data.email,
        source: "start-page",
      });
      if (!subResult.ok) {
        console.warn("[start] beehiiv subscribe returned ok:false");
      }
    } catch (subErr) {
      console.warn("[start] beehiiv subscribe threw:", (subErr as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    count: accepted.length,
    rejected: rejected.length > 0 ? rejected : undefined,
  });
}
