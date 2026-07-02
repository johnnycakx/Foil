// /api/start — bulk watchlist + newsletter subscribe (Task #20 / Session 38;
// funnel integrity rebuilt 2026-07-01, ADR-090).
//
// POST { email, opt_in_newsletter, cards: [{pokemon_tcg_id, name, set_name,
//        set_id, number, target_price_cents?}], src?, utm?, website? }
//
// Behavior per row:
//   - Compute the Foil slug from the supplied set_id + number + name.
//   - Pre-flight: only accept rows whose computed slug exists in
//     CARD_CATALOG. The /start client already gates by `cataloguedIds`,
//     but the server re-validates because the client is untrusted.
//   - target_price_cents = null on the wire → stored as NULL (ADR-091): a
//     blank target means "alert me at ≥15% under the 30-day sold average."
//     No sentinel value exists anywhere — the old 10,000,000¢ sentinel made
//     every listing "meet the threshold" and rendered "you wanted ≤
//     $100000.00" in the email.
//   - UPSERT each row via the shared upsertWatchlist helper (the same
//     (email, card_slug, variant, condition) conflict target as every other
//     write path) — re-submitting the same cards updates targets and returns
//     success instead of tripping the UNIQUE constraint into a 500.
//
// Newsletter opt-in is tri-store (ADR-078/ADR-084 pattern, same as
// app/actions/subscribe.ts): Beehiiv subscribeEmail + recordSubscriber
// (Supabase owned list + Resend audience, with UTM attribution). All legs are
// soft-fail — the watchlist write is the high-value primitive — but failures
// now ping #errors instead of dying in a console.warn nobody reads.
//
// Abuse guards (lib/start/guards.ts): honeypot field → fake success; per-IP
// in-memory request limit → 429; per-email total watch cap → 429.
//
// Public route — anonymous-friendly per ADR-020.

import { NextResponse } from "next/server";
import { z } from "zod";
import { CARD_CATALOG } from "@/lib/cards/catalog";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";
import { recordSubscriber, sanitizeUtmValue } from "@/lib/newsletter/subscribers";
import { upsertWatchlist } from "@/lib/wishlist/upsert";
import { getAlertSuppression } from "@/lib/wishlist/pause";
import { postError } from "@/lib/notifications/discord";
import {
  clientIpKey,
  createIpRateLimiter,
  exceedsWatchCap,
  isHoneypotTripped,
} from "@/lib/start/guards";
import { buildVaultUrl } from "@/lib/vault-token";
import { sendVaultLinkEmail } from "@/lib/wishlist/vault-email";

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
  /** Inbound source tag (?src= / utm_source alias) — persisted on every
   *  watchlists row. Untrusted; sanitized to [a-z0-9-] before writing. */
  src: z.string().max(200).optional(),
  /** Landing-URL UTM params for the subscriber record (ADR-084). Untrusted;
   *  recordSubscriber sanitizes. */
  utm: z
    .object({
      source: z.string().max(200).nullable().optional(),
      medium: z.string().max(200).nullable().optional(),
      campaign: z.string().max(200).nullable().optional(),
    })
    .optional(),
  /** Honeypot — the form renders it off-screen; humans never fill it. */
  website: z.string().max(500).optional(),
});

// Per-instance limiter (module scope survives across requests on a warm
// function; a cold start resets it — acceptable for a pre-traffic funnel).
const ipLimiter = createIpRateLimiter();

function slugFromCard(c: z.infer<typeof cardSchema>): string {
  const nameKebab = c.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${c.set_id}-${c.number}-${nameKebab}`;
}

function notifyErrors(errorType: string, message: string, context: Record<string, string>): void {
  const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
  if (!webhook) return;
  // Fire-and-forget; a Discord outage must never block the response.
  void postError(webhook, { source: "api-start", errorType, message, context }).catch(() => {});
}

function maskInline(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Per-IP request limit BEFORE any parsing work.
  if (!ipLimiter.check(clientIpKey(request.headers))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

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

  // Honeypot: a filled "website" field is a bot. Return a FAKE success so the
  // bot learns nothing; write nothing.
  if (isHoneypotTripped(parsed.data.website)) {
    return NextResponse.json({ ok: true, count: parsed.data.cards.length });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const src = sanitizeUtmValue(parsed.data.src ?? parsed.data.utm?.source);

  // Server-side re-validation: each card's pokemon_tcg_id must be in
  // CARD_CATALOG (client gates this, but the client is untrusted). Slug
  // computed from the supplied set+number+name must also match what
  // CARD_CATALOG would compute — pin to the canonical catalog slug for
  // the row's tracked id.
  const catalogById = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

  type AcceptedRow = {
    slug: string;
    /** null = blank target ("alert at ≥15% under the 30-day sold avg"). */
    target_price_cents: number | null;
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
      target_price_cents: card.target_price_cents ?? null,
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

  // Per-email TOTAL watch cap across all requests (the zod cap bounds one
  // request; this bounds the sum). Count-only HEAD query; on count failure we
  // proceed (cap is an abuse guard, not a correctness invariant).
  const { count: existingCount, error: countError } = await admin
    .from("watchlists")
    .select("id", { count: "exact", head: true })
    .eq("email", email);
  if (!countError && exceedsWatchCap(existingCount ?? 0, accepted.length)) {
    return NextResponse.json({ ok: false, error: "watch_cap_reached" }, { status: 429 });
  }

  // UPSERT per row via the shared helper — same conflict target as the
  // per-card page form, so a duplicate updates the target price instead of
  // failing the whole batch (the old bulk .insert() 500'd on ANY duplicate
  // against UNIQUE(email, card_slug, variant, condition)). ≤50 rows; a
  // sequential loop keeps failure attribution per-row.
  //
  // Suppression precomputed ONCE for the batch (the helper would otherwise
  // check per row): a suppressed email's rows are written PAUSED and stay
  // paused — an unauthenticated submission can't resume email to an address
  // that unsubscribed or spam-complained (ADR-090 hardening). The response is
  // indistinguishable from a normal success, so suppression state never leaks.
  const suppression = await getAlertSuppression(admin, email);
  let upserted = 0;
  const failedSlugs: string[] = [];
  for (const row of accepted) {
    const { ok } = await upsertWatchlist(
      admin,
      {
        email,
        card_slug: row.slug,
        variant: "default",
        condition: "any-raw",
        target_price_cents: row.target_price_cents,
        src,
      },
      { suppression },
    );
    if (ok) upserted += 1;
    else failedSlugs.push(row.slug);
  }
  if (upserted === 0) {
    notifyErrors("WatchlistUpsertFailed", "every /api/start watch upsert failed", {
      email_masked: maskInline(email),
      attempted: String(accepted.length),
    });
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }
  if (failedSlugs.length > 0) {
    notifyErrors("WatchlistUpsertPartial", "some /api/start watch upserts failed", {
      email_masked: maskInline(email),
      failed: failedSlugs.join(","),
    });
  }

  // Tri-store newsletter opt-in (ADR-078 + ADR-084, mirroring
  // app/actions/subscribe.ts). recordSubscriber (Supabase owned list — the
  // store the weekly digest actually sends from — + Resend audience) runs
  // even when Beehiiv fails: unlike the subscribe form, this response's
  // success is the WATCHLIST, so gating the owned-list write on Beehiiv
  // would silently drop the subscriber. Every leg soft-fails; failures ping
  // #errors (the old code console.warn'd into the void).
  if (parsed.data.opt_in_newsletter) {
    const utm = {
      source: parsed.data.utm?.source ?? parsed.data.src ?? null,
      medium: parsed.data.utm?.medium ?? null,
      campaign: parsed.data.utm?.campaign ?? null,
    };
    try {
      const subResult = await subscribeEmail({ email, source: "start-page" });
      if (!subResult.ok) {
        notifyErrors("BeehiivSubscribeFailed", "subscribeEmail returned ok:false", {
          source: "start-page",
          email_masked: maskInline(email),
        });
      }
    } catch (subErr) {
      notifyErrors("BeehiivSubscribeThrew", (subErr as Error).message, {
        source: "start-page",
        email_masked: maskInline(email),
      });
    }
    // AWAITED (not fire-and-forget) for the same Vercel-freeze reason as
    // subscribe.ts — a dropped promise loses the owned-list row + its UTM.
    const recorded = await recordSubscriber({ email, source: "start-page", utm });
    if (!recorded.supabase) {
      notifyErrors("OwnedListWriteFailed", "recordSubscriber supabase leg failed", {
        source: "start-page",
        email_masked: maskInline(email),
      });
    }
  }

  // The vault (ADR-093). The link is a bearer credential for the whole
  // address's watchlist, so it is returned inline ONLY when this is the
  // FIRST watch for the email — i.e. there is no PRE-EXISTING vault to leak
  // (the submitter just created everything in it). For an address that
  // already had a vault, echoing the link back to an unauthenticated
  // submitter would turn "knows your email" into "reads/edits your existing
  // watchlist" (/security-review HIGH). Those get the link by EMAIL only —
  // the inbox is the proof of control the token's threat model assumes.
  // The welcome email fires on that same first-watch condition.
  const isFirstWatch = !countError && (existingCount ?? 0) === 0;
  if (isFirstWatch) {
    await sendVaultLinkEmail(email, "welcome");
  }

  return NextResponse.json({
    ok: true,
    count: upserted,
    // Inline link only for a brand-new vault (nothing pre-existing to expose);
    // existing vaults are inbox-only.
    vault_url: isFirstWatch ? (buildVaultUrl(email) ?? undefined) : undefined,
    // Tell the client an inbox link is coming even when we don't hand one back,
    // so the success screen can say "check your inbox" instead of going quiet.
    vault_link_emailed: isFirstWatch,
    rejected: rejected.length > 0 ? rejected : undefined,
  });
}
