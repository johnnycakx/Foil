// Vercel deploy webhook → Discord #deploys proxy.
//
// Replaces the Vercel Marketplace Discord integration (UI-installed, opaque,
// not version-controlled). See ADR-016.
//
// Pure helpers (verifySignature, buildEmbed, event filter) live in
// lib/vercel-webhook.ts so node:test can exercise them without pulling
// next/server. This file is the thin Next.js adapter.
//
// PUBLIC route (gate-skipped by lib/supabase/proxy.ts via the existing
// /api/webhooks prefix). The HMAC signature header IS the auth.

import { NextResponse } from "next/server";
import { postWebhook } from "@/lib/notifications/discord";
import {
  HANDLED_EVENTS,
  buildEmbed,
  verifySignature,
  type VercelDeploymentEvent,
} from "@/lib/vercel-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const discordWebhook = process.env.DISCORD_WEBHOOK_DEPLOYS;

  if (!secret) {
    console.warn("[vercel-deploys] VERCEL_WEBHOOK_SECRET not set — returning 503");
    return new NextResponse("missing_secret", { status: 503 });
  }

  // We need the raw body for HMAC. NextRequest's .text() returns the raw
  // string before any JSON parsing, which is exactly what Vercel signs.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-vercel-signature");

  if (!signatureHeader || !verifySignature(rawBody, signatureHeader, secret)) {
    console.warn("[vercel-deploys] signature verification failed");
    return new NextResponse("invalid_signature", { status: 401 });
  }

  let event: VercelDeploymentEvent;
  try {
    event = JSON.parse(rawBody) as VercelDeploymentEvent;
  } catch {
    return new NextResponse("invalid_json", { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ skipped: event.type });
  }

  if (!discordWebhook) {
    console.warn("[vercel-deploys] DISCORD_WEBHOOK_DEPLOYS not set — event ignored");
    return NextResponse.json({ skipped: "no_webhook_target" });
  }

  const embed = buildEmbed(event);
  const result = await postWebhook({
    webhookUrl: discordWebhook,
    embeds: [embed],
  });

  // 200 to Vercel no matter what. If Discord is down we've logged; Vercel
  // retrying won't help since the same Discord outage will reject the retry.
  return NextResponse.json({
    forwarded: result.ok,
    event_type: event.type,
  });
}
