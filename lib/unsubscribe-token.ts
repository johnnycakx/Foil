// HMAC-signed unsubscribe tokens for one-click email unsubscribe (RFC 8058).
// See Task #18 / Session 37.
//
// Wire shape — base64url(payload).base64url(signature) where:
//   payload   = JSON { e: <email>, iat: <unix-seconds> }
//   signature = HMAC-SHA256(payload-bytes, UNSUBSCRIBE_TOKEN_SECRET)
//
// Why HMAC and not a stored token table:
//   - One-click unsubscribe must work without a session, without a lookup,
//     and ideally without a Beehiiv API round-trip *just to verify the
//     identity of the asker*. The HMAC IS the identity proof.
//   - Tokens are stateless: the route handler verifies the signature on
//     the wire, extracts the email from the payload, and proceeds. No
//     DB row to clean up if the token is never used.
//
// Why include the `iat` claim:
//   - Optional rotational hygiene. We don't enforce a TTL today (an
//     unsubscribe link in a 2-year-old email should still work — refusing
//     it would generate spam complaints, the exact opposite of what
//     RFC 8058 is for). But the timestamp gives us optionality later
//     (e.g. "ignore tokens older than 90 days" if the secret is rotated).
//
// Why constant-time compare:
//   - Timing-attack resistance on the signature comparison. node:crypto's
//     timingSafeEqual is the right primitive; we wrap Buffer.byteLength
//     checks first because the inputs may differ in length.
//
// Secret rotation:
//   - UNSUBSCRIBE_TOKEN_SECRET lives in Vercel + GH Actions secrets. If
//     rotated, existing unsubscribe links in already-sent emails will
//     stop verifying — by design. We accept that trade if the secret is
//     compromised. Document the rotation in SESSION-LOG.

import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "UNSUBSCRIBE_TOKEN_SECRET";

type TokenPayload = {
  /** Subscriber email (lowercased). */
  e: string;
  /** Issued-at, unix seconds. */
  iat: number;
};

function getSecret(): string | null {
  const s = process.env[ENV_KEY];
  if (!s || s.trim().length < 16) return null;
  return s;
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  // Tolerate either url-safe or standard base64; pad as needed.
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(payloadBytes: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadBytes).digest();
}

/**
 * Mint an unsubscribe token for the given email. Returns null when the
 * server secret is missing/short — callers should soft-fail and omit the
 * one-click link header rather than send a non-functional one.
 */
export function mintUnsubscribeToken(
  email: string,
  opts: { now?: () => Date } = {},
): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const payload: TokenPayload = {
    e: trimmed,
    iat: Math.floor((opts.now?.() ?? new Date()).getTime() / 1000),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(payloadBytes, secret);
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(signature)}`;
}

export type VerifyResult =
  | { ok: true; email: string; issuedAt: number }
  | { ok: false; reason: "missing_secret" | "malformed" | "bad_signature" | "bad_payload" };

/**
 * Verify a token and return the embedded email on success. Constant-time
 * signature compare. Returns a tagged error reason on any failure path so
 * the route handler can decide how to respond (currently all reasons
 * resolve to a generic 400 — but the structured reason is useful in
 * server logs and for tests).
 */
export function verifyUnsubscribeToken(token: string): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!token || typeof token !== "string") return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  let payloadBytes: Buffer;
  let receivedSig: Buffer;
  try {
    payloadBytes = base64urlDecode(payloadPart);
    receivedSig = base64urlDecode(sigPart);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const expectedSig = sign(payloadBytes, secret);
  if (expectedSig.length !== receivedSig.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!timingSafeEqual(expectedSig, receivedSig)) {
    return { ok: false, reason: "bad_signature" };
  }

  // Explicit audience guard (ADR-093 / security-review): a token from another
  // context (e.g. a vault token, whose signature is HMAC over
  // "foil-vault.v1|"+payload) can be repackaged so its bytes are
  // "foil-vault.v1|{...}" and pass the SIGNATURE check here — HMAC(secret,
  // prefix+payload) is what this verifier computes for that byte string. It's
  // then rejected only because the JSON.parse below throws. Make that
  // rejection explicit rather than an accident: a real unsubscribe payload is
  // a bare JSON object, so require the first byte to be '{'.
  if (payloadBytes.length === 0 || payloadBytes[0] !== 0x7b /* '{' */) {
    return { ok: false, reason: "bad_payload" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "bad_payload" };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.e !== "string" || !obj.e) return { ok: false, reason: "bad_payload" };
  if (typeof obj.iat !== "number" || !Number.isFinite(obj.iat)) {
    return { ok: false, reason: "bad_payload" };
  }
  return { ok: true, email: obj.e, issuedAt: obj.iat };
}

/** Build the absolute one-click URL for the email's `List-Unsubscribe` +
 *  visible body link. Returns null if the token can't be minted. */
export function buildUnsubscribeUrl(
  email: string,
  opts: { baseUrl?: string; now?: () => Date } = {},
): string | null {
  const token = mintUnsubscribeToken(email, { now: opts.now });
  if (!token) return null;
  const base = (opts.baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
