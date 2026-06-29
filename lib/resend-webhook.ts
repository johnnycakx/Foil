// Pure helpers for the Resend unsubscribe webhook (ADR-082). Lives outside
// app/api/webhooks/resend/route.ts so node:test can exercise the signature
// verification + event extraction without pulling in next/server.
//
// Resend signs webhooks with the Svix scheme. Verified against the official
// docs (resend.com/docs/dashboard/webhooks/verify-webhooks-requests →
// docs.svix.com/receiving/verifying-payloads/how-manual):
//   - headers: svix-id, svix-timestamp, svix-signature
//   - signed content: `${svix-id}.${svix-timestamp}.${rawBody}`
//   - HMAC-SHA256, key = base64-decode(secret after the "whsec_" prefix)
//   - signature base64-encoded
//   - svix-signature header = space-delimited list of `v1,<base64sig>` pairs
//     (any one valid v1 signature passes; version prefixes are stripped first)
//   - timestamp must be within tolerance to defeat replay attacks
//
// No Next.js types or runtime references in this file.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Svix replay-window. Reject signatures whose timestamp is more than this many
 *  seconds from now (in either direction). 5 minutes is the Svix default. */
export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Verify a Resend (Svix) webhook signature over the RAW request body. Returns
 * true only when a `v1` signature in the header matches and the timestamp is
 * within tolerance. Constant-time comparison; returns false (never throws) on
 * any missing header, malformed value, decode error, or stale timestamp.
 */
export function verifySvixSignature(args: {
  body: string;
  headers: SvixHeaders;
  secret: string;
  /** Injectable clock (ms since epoch) for deterministic tests. */
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const { body, headers, secret } = args;
  const tolerance = args.toleranceSeconds ?? SVIX_TOLERANCE_SECONDS;
  const nowMs = args.nowMs ?? Date.now();

  const id = headers.id;
  const timestamp = headers.timestamp;
  const signature = headers.signature;
  if (!id || !timestamp || !signature || !secret) return false;

  // Replay guard: the timestamp (seconds since epoch) must be recent.
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const skewSeconds = Math.abs(nowMs / 1000 - tsSeconds);
  if (skewSeconds > tolerance) return false;

  try {
    // The signing key is the base64 payload after the "whsec_" prefix.
    const secretBytes = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
    const key = Buffer.from(secretBytes, "base64");
    if (key.length === 0) return false;

    const signedContent = `${id}.${timestamp}.${body}`;
    const expected = createHmac("sha256", key).update(signedContent).digest(); // Buffer

    // The header is a space-delimited list of `version,signature` pairs.
    for (const part of signature.split(" ")) {
      const commaIdx = part.indexOf(",");
      if (commaIdx === -1) continue;
      const version = part.slice(0, commaIdx);
      const sig = part.slice(commaIdx + 1);
      if (version !== "v1" || !sig) continue;
      let received: Buffer;
      try {
        received = Buffer.from(sig, "base64");
      } catch {
        continue;
      }
      if (received.length !== expected.length) continue;
      if (timingSafeEqual(received, expected)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event extraction. The only signal this webhook acts on is "this email opted
// out" — from either of two verified payload shapes:
//   - contact.updated / contact.created with data.unsubscribed === true
//     (the native one-click unsubscribe in a broadcast fires contact.updated)
//   - email.complained (a spam complaint — the strongest opt-out signal;
//     recipients are in data.to)
// Every other event type is a no-op.
// ---------------------------------------------------------------------------

export type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email?: string;
    unsubscribed?: boolean;
    /** email.complained recipients (array per the docs; tolerate a bare string). */
    to?: string[] | string;
    [key: string]: unknown;
  };
};

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length > 0 && e.includes("@") ? e : null;
}

/**
 * Given a parsed Resend webhook event, return the list of (normalized, deduped)
 * emails that should be marked unsubscribed. Returns [] for any event that
 * isn't an opt-out signal — the route treats [] as a no-op (200 skipped).
 */
export function extractUnsubscribeEmails(event: ResendWebhookEvent | null | undefined): string[] {
  if (!event || typeof event.type !== "string") return [];
  const data = event.data ?? {};
  const out = new Set<string>();

  if (event.type === "contact.updated" || event.type === "contact.created") {
    if (data.unsubscribed === true) {
      const e = normalizeEmail(data.email);
      if (e) out.add(e);
    }
  } else if (event.type === "email.complained") {
    const recipients = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
    for (const r of recipients) {
      const e = normalizeEmail(r);
      if (e) out.add(e);
    }
  }

  return [...out];
}
