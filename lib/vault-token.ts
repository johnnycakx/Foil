// HMAC-signed vault-access tokens (watchlist-web-app, ADR-093).
//
// The vault (/w/<token>) is the no-login watchlist page: the token IS the
// auth. Same stateless-HMAC design as lib/unsubscribe-token.ts (the token
// proves email control because it only ever arrives via that inbox), with two
// deliberate differences:
//
//   1. SAME secret (UNSUBSCRIBE_TOKEN_SECRET — no new env var), but the HMAC
//      input is CONTEXT-SEPARATED: signature = HMAC(secret, "foil-vault.v1|" +
//      payload). An unsubscribe token can NEVER verify as a vault token: the
//      vault verifier requires the prefix in the MAC, and HMAC-SHA256 is not
//      length-extendable. The reverse (a vault token repackaged to pass the
//      unsubscribe SIGNATURE check, since its sig is HMAC over prefix+payload)
//      is blocked explicitly by the unsubscribe verifier's `{`-first-byte
//      payload guard, not left to a JSON.parse accident.
//   2. Verification failure at the page resolves to 404 (not 400): the vault
//      URL space must be indistinguishable from not-found for a guesser, and
//      no failure path may disclose whether an email exists.
//
// Threat model (documented in RISKS): anyone holding the link can view/edit
// that watchlist — the calendar-private-link class of risk, accepted for v1.
// Constant-time signature compare; email never appears in the URL (only
// inside the signed payload).

import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "UNSUBSCRIBE_TOKEN_SECRET";

/** Context prefix — the cryptographic audience separator. Never reuse for
 *  another token type; mint a new context string instead. */
const VAULT_CONTEXT = "foil-vault.v1|";

type VaultPayload = {
  /** Watchlist owner email (lowercased). */
  e: string;
  /** Issued-at, unix seconds. No TTL enforced (a vault link in an old email
   *  should keep working) — the claim gives rotation optionality. */
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
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(payloadBytes: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(VAULT_CONTEXT)
    .update(payloadBytes)
    .digest();
}

/** Mint a vault token for the email. Null when the secret is missing/short —
 *  callers soft-fail and omit the vault link rather than mint a broken one. */
export function mintVaultToken(email: string, opts: { now?: () => Date } = {}): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const payload: VaultPayload = {
    e: trimmed,
    iat: Math.floor((opts.now?.() ?? new Date()).getTime() / 1000),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(sign(payloadBytes, secret))}`;
}

export type VaultVerifyResult =
  | { ok: true; email: string; issuedAt: number }
  | { ok: false; reason: "missing_secret" | "malformed" | "bad_signature" | "bad_payload" };

/** Verify a vault token. Constant-time compare; tagged failure reasons for
 *  logs/tests — the PAGE maps every failure to a uniform 404. */
export function verifyVaultToken(token: string): VaultVerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!token || typeof token !== "string") return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };

  let payloadBytes: Buffer;
  let receivedSig: Buffer;
  try {
    payloadBytes = base64urlDecode(token.slice(0, dot));
    receivedSig = base64urlDecode(token.slice(dot + 1));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const expectedSig = sign(payloadBytes, secret);
  if (expectedSig.length !== receivedSig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(expectedSig, receivedSig)) return { ok: false, reason: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "bad_payload" };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.e !== "string" || !obj.e) return { ok: false, reason: "bad_payload" };
  if (typeof obj.iat !== "number" || !Number.isFinite(obj.iat)) return { ok: false, reason: "bad_payload" };
  return { ok: true, email: obj.e, issuedAt: obj.iat };
}

/** Absolute vault URL for an email, or null when the token can't be minted. */
export function buildVaultUrl(email: string, opts: { baseUrl?: string; now?: () => Date } = {}): string | null {
  const token = mintVaultToken(email, { now: opts.now });
  if (!token) return null;
  const base = (opts.baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/w/${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// SEEDED vault tokens (eve-vault). A seeded vault is a pre-made GIFT vault
// that exists before any email: the token carries a vault ID (a slug into
// lib/vault-seeds.ts), not an email. Claiming it (app/actions/seeded-vault.ts)
// binds an email via the normal /start funnel machinery.
//
// Own context string → cryptographic audience separation from BOTH the email
// vault token and the unsubscribe token: a seeded token can never verify as
// an email vault token (and vice versa) because the context is inside the
// MAC. Same secret, same 404-on-failure posture at the page.
// ---------------------------------------------------------------------------

/** Context prefix for seeded-vault tokens. Never reuse for another type. */
const SEEDED_VAULT_CONTEXT = "foil-seeded-vault.v1|";

type SeededVaultPayload = {
  /** Seeded vault id (key into SEEDED_VAULTS). */
  v: string;
  /** Issued-at, unix seconds. No TTL — the link lives in a tweet. */
  iat: number;
};

function signSeeded(payloadBytes: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(SEEDED_VAULT_CONTEXT)
    .update(payloadBytes)
    .digest();
}

/** Mint a seeded-vault token for a vault id. Null when the secret is missing. */
export function mintSeededVaultToken(vaultId: string, opts: { now?: () => Date } = {}): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const trimmed = vaultId.trim().toLowerCase();
  if (!trimmed) return null;
  const payload: SeededVaultPayload = {
    v: trimmed,
    iat: Math.floor((opts.now?.() ?? new Date()).getTime() / 1000),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(signSeeded(payloadBytes, secret))}`;
}

export type SeededVaultVerifyResult =
  | { ok: true; vaultId: string; issuedAt: number }
  | { ok: false; reason: "missing_secret" | "malformed" | "bad_signature" | "bad_payload" };

/** Verify a seeded-vault token. Constant-time compare; the page maps every
 *  failure to the same uniform 404 as the email-vault path. */
export function verifySeededVaultToken(token: string): SeededVaultVerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!token || typeof token !== "string") return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "malformed" };

  let payloadBytes: Buffer;
  let receivedSig: Buffer;
  try {
    payloadBytes = base64urlDecode(token.slice(0, dot));
    receivedSig = base64urlDecode(token.slice(dot + 1));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const expectedSig = signSeeded(payloadBytes, secret);
  if (expectedSig.length !== receivedSig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(expectedSig, receivedSig)) return { ok: false, reason: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "bad_payload" };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.v !== "string" || !obj.v) return { ok: false, reason: "bad_payload" };
  if (typeof obj.iat !== "number" || !Number.isFinite(obj.iat)) return { ok: false, reason: "bad_payload" };
  return { ok: true, vaultId: obj.v, issuedAt: obj.iat };
}

/** Absolute seeded-vault URL for a vault id, or null when it can't be minted. */
export function buildSeededVaultUrl(vaultId: string, opts: { baseUrl?: string; now?: () => Date } = {}): string | null {
  const token = mintSeededVaultToken(vaultId, { now: opts.now });
  if (!token) return null;
  const base = (opts.baseUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/w/${encodeURIComponent(token)}`;
}
