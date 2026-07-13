// /api/card-requests — the converting search fail state (quality-bar-fixes
// P0-4; the IDEAS.md "untracked cards are invitations" loop, V1).
//
// POST { query, email, website? } — when search finds nothing, the typeahead
// offers "Foil will hunt this one down and write you when it has data."
// This route stores the request (service-role table, RLS no-policies) and
// pings #content-engine so John sees real demand signals. The notify leg
// (scripts/notify-card-requests.ts, run by the daily catalog bake) emails
// the requester when a matching card lands in the catalog.
//
// Abuse posture mirrors /api/start: honeypot → fake success · per-IP
// limiter → 429 · zod length caps matching the DB checks · resubmits are
// idempotent (partial unique index on pending (email, query)).
//
// Public route (lib/supabase/public-routes.ts) — the requester is by
// definition not signed in to anything yet.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { postWebhook, postError } from "@/lib/notifications/discord";
import { clientIpKey, createIpRateLimiter, isHoneypotTripped } from "@/lib/start/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ipLimiter = createIpRateLimiter();

const requestSchema = z.object({
  query: z.string().trim().min(2).max(64),
  email: z.string().trim().toLowerCase().email().max(320),
  website: z.string().optional(), // honeypot
});

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { query, email, website } = parsed.data;

  // Honeypot: bots that fill the hidden field get a convincing success.
  if (isHoneypotTripped(website)) {
    return NextResponse.json({ ok: true });
  }
  if (!ipLimiter.check(clientIpKey(request.headers))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    // Untyped client (same pattern as hydrate-cards): card_requests postdates
    // the generated Supabase types; regenerate types on the next schema sync.
    const admin = supabaseAdmin() as unknown as SupabaseClient;

    // SECURITY (2026-07-13 review, M1): the address is unverified, so cap
    // PENDING requests per email — an attacker can queue at most
    // MAX_PENDING_PER_EMAIL future "Foil now tracks it" emails at a victim
    // (each catalog-terms-only, zero attacker text). Cap hit reads as
    // success: no oracle for probing.
    const MAX_PENDING_PER_EMAIL = 3;
    const { count } = await admin
      .from("card_requests")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("status", "pending");
    if ((count ?? 0) >= MAX_PENDING_PER_EMAIL) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("card_requests").insert({ query, email });
    // 23505 = the pending-uniq index: same email already asked for the same
    // card. That's a success, not an error (idempotent resubmit).
    if (error && error.code !== "23505") {
      const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
      if (webhook) {
        void postError(webhook, {
          source: "card-requests",
          errorType: "insert_failed",
          message: error.message,
        }).catch(() => {});
      }
      return NextResponse.json({ error: "storage_failed" }, { status: 500 });
    }

    // Demand signal to #content-engine (soft-fail): every request is a real
    // person telling us which card the catalog is missing.
    const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    if (webhook && !error) {
      // SECURITY (2026-07-13 review, M2): Discord renders masked links in
      // embed descriptions — strip markdown metacharacters and pin the
      // untrusted query inside a code span so an attacker can't place a
      // clickable link or spoofed ops text in the channel.
      const safeQuery = query.replace(/[`\[\]()*_~|]/g, "");
      void postWebhook({
        webhookUrl: webhook,
        embeds: [
          {
            title: "Card request captured",
            description: `Someone asked Foil to hunt: \`${safeQuery}\``,
            color: 0xd98aa0,
            fields: [{ name: "Notify", value: "on catalog match (daily bake)", inline: true }],
          },
        ],
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
    if (webhook) {
      void postError(webhook, {
        source: "card-requests",
        errorType: "unhandled",
        message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
