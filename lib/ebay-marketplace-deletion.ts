// Pure helpers for the eBay Marketplace Account Deletion / Account-Closure
// compliance endpoint. See ADR-022.
//
// The endpoint at /api/webhooks/ebay-marketplace-deletion handles two flows:
//
//   1. **Verification challenge (GET).** When the URL is first registered (or
//      re-saved) in the eBay developer portal, eBay fires a GET with a
//      `challenge_code` query param. We answer with
//      JSON `{ challengeResponse: <hex> }` where the hex value is
//          sha256(challenge_code + verification_token + endpoint_url)
//      computed in EXACTLY THAT CONCATENATION ORDER. eBay verifies the
//      response and flips the keyset state to "compliant."
//      Source: developer.ebay.com/marketplace-account-deletion
//
//   2. **Deletion notifications (POST).** eBay POSTs a JSON body when a user
//      requests account closure. The `x-ebay-signature` header is a
//      base64-encoded JSON blob — `{ alg, kid, signature, digest }` — and
//      verification is **ECDSA over the raw request body** using a public
//      key fetched from eBay's Notification API at
//          GET https://api.ebay.com/commerce/notification/v1/public_key/{kid}
//      with an Application access token (client_credentials, default
//      `api_scope`). Public key is PEM, cached in-memory by kid for ~1h per
//      eBay's recommendation.
//      We never persist eBay-sourced user data — verifying and acknowledging
//      is the entirety of the handler's authentication concern (R-008,
//      ADR-022).
//
// Session 34 (this rewrite) replaced a previously-incorrect HMAC-keyed-on-
// verification-token implementation with the real ECDSA + getPublicKey
// scheme. The verification token is *only* used for the GET challenge under
// the actual spec.
// Reference implementation: github.com/eBay/event-notification-nodejs-sdk
//   lib/validator.js + lib/client.js + lib/constants.js — algorithm is
//   `ssl3-sha1` (i.e. plain SHA-1), key returned as PEM in `{ key, ... }`,
//   signature is base64-encoded ECDSA DER.

import { createHash, createVerify } from "node:crypto";
import { getAccessToken } from "./affiliate/ebay-oauth.ts";

// ---------------------------------------------------------------------------
// GET challenge — unchanged from Session 25.
// ---------------------------------------------------------------------------

/**
 * Compute the eBay challenge response.
 *
 * Concatenation order MUST be `challengeCode + verificationToken + endpointUrl`.
 * Any reorder produces a hash eBay won't accept, leaving the keyset disabled.
 *
 * Returns lowercase hex (matching SHA-256 default output and what eBay
 * compares against character-for-character).
 */
export function challengeResponseHash(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string,
): string {
  return createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpointUrl)
    .digest("hex");
}

export type HandlerResult = {
  status: number;
  body: Record<string, unknown> | string;
};

/**
 * Pure decision function for the GET challenge endpoint. The Next.js route
 * adapter just maps this into a NextResponse. Returns 400 / 503 / 200 in
 * the same shape the live endpoint serves so tests can pin the contract.
 */
export function handleChallenge(input: {
  challengeCode: string | null | undefined;
  verificationToken: string | undefined;
  endpointUrl: string;
}): HandlerResult {
  if (!input.challengeCode) {
    return { status: 400, body: { error: "missing_challenge_code" } };
  }
  if (!input.verificationToken) {
    return { status: 503, body: { error: "missing_verification_token" } };
  }
  const challengeResponse = challengeResponseHash(
    input.challengeCode,
    input.verificationToken,
    input.endpointUrl,
  );
  return { status: 200, body: { challengeResponse } };
}

// ---------------------------------------------------------------------------
// POST notification — ECDSA via fetched public key.
// ---------------------------------------------------------------------------

const NOTIFICATION_API_BASE = "https://api.ebay.com/commerce/notification/v1/public_key/";
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;
const PEM_BEGIN = "-----BEGIN PUBLIC KEY-----";
const PEM_END = "-----END PUBLIC KEY-----";

type CachedPublicKey = { pem: string; expiresAt: number };
const publicKeyCache = new Map<string, CachedPublicKey>();

export type EbaySignatureHeader = {
  kid: string;
  signature: string;
  alg?: string;
  digest?: string;
};

/**
 * Decode the base64-packed `x-ebay-signature` header to its JSON form.
 * Returns null on any decode/parse failure or missing required fields —
 * never throws. eBay's spec defines four fields; we require `kid` +
 * `signature` and treat the rest as advisory.
 */
export function parseSignatureHeader(header: string | null | undefined): EbaySignatureHeader | null {
  if (!header) return null;
  let json: unknown;
  try {
    const decoded = Buffer.from(header, "base64").toString("ascii");
    json = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  if (typeof obj.kid !== "string" || !obj.kid) return null;
  if (typeof obj.signature !== "string" || !obj.signature) return null;
  return {
    kid: obj.kid,
    signature: obj.signature,
    alg: typeof obj.alg === "string" ? obj.alg : undefined,
    digest: typeof obj.digest === "string" ? obj.digest : undefined,
  };
}

/**
 * The Notification API returns the key PEM sometimes with literal `\n`
 * between body and markers, sometimes glued directly to the markers. The
 * eBay SDK normalizes by reinserting newlines around the BEGIN/END markers.
 * We do the same so `crypto.createVerify` accepts the result.
 */
function normalizePem(rawKey: string): string {
  // Strip CR + collapse stray whitespace around markers, then re-insert
  // canonical newlines. The body of the PEM (the base64 between markers)
  // is left untouched.
  const trimmed = rawKey.trim();
  if (trimmed.includes(PEM_BEGIN) && trimmed.includes(PEM_END)) {
    return trimmed
      .replace(PEM_BEGIN, `${PEM_BEGIN}\n`)
      .replace(PEM_END, `\n${PEM_END}`);
  }
  // Some payloads return only the base64 body; wrap it.
  return `${PEM_BEGIN}\n${trimmed}\n${PEM_END}`;
}

export type PublicKeyFetcher = (kid: string) => Promise<string | null>;

/**
 * Real implementation: GET eBay's Notification API for the public key
 * matching `kid`, with a client_credentials Application token (api_scope).
 * Returns PEM string on success, null on any failure (caller maps to 500).
 *
 * Single eBay-API import boundary preserved: this is the only call site
 * touching `api.ebay.com` outside `lib/affiliate/ebay-browse.ts` and
 * `lib/affiliate/ebay-oauth.ts`. See the matching allowlist update in
 * `lib/__tests__/ebay-compliance-invariants.test.ts`.
 */
export async function fetchEbayPublicKey(
  kid: string,
  opts: {
    fetchImpl?: typeof fetch;
    accessTokenGetter?: typeof getAccessToken;
  } = {},
): Promise<string | null> {
  const cached = publicKeyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pem;
  }

  const tokenGetter = opts.accessTokenGetter ?? getAccessToken;
  const token = await tokenGetter();
  if (!token) return null;

  const fetchFn = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${NOTIFICATION_API_BASE}${encodeURIComponent(kid)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.token}`,
        Accept: "application/json",
      },
      // R-008: no platform-level caching of eBay-sourced data. Our in-memory
      // module cache (publicKeyCache) is operational metadata only — a PEM
      // key, no listing payload.
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { key } = payload as { key?: unknown };
  if (typeof key !== "string" || !key) return null;

  const pem = normalizePem(key);
  publicKeyCache.set(kid, { pem, expiresAt: Date.now() + PUBLIC_KEY_TTL_MS });
  return pem;
}

/**
 * Verify an eBay deletion-notification POST signature.
 *
 * Algorithm per eBay's Node SDK reference impl:
 *   crypto.createVerify('sha1').update(rawBody).verify(pem, signatureB64, 'base64')
 * (`'ssl3-sha1'` in the SDK constants — modern OpenSSL aliases it to plain
 * SHA-1; ECDSA is inferred from the key type.)
 *
 * Returns true on cryptographic match, false on any decode/fetch/mismatch.
 * Never throws — the caller branches on a boolean.
 *
 * `publicKeyFetcher` is injectable for tests; default is the real
 * `fetchEbayPublicKey`.
 */
export async function verifyNotificationSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  opts: { publicKeyFetcher?: PublicKeyFetcher } = {},
): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const fetcher = opts.publicKeyFetcher ?? fetchEbayPublicKey;
  let pem: string | null;
  try {
    pem = await fetcher(parsed.kid);
  } catch {
    return false;
  }
  if (!pem) return false;

  try {
    const verifier = createVerify("sha1");
    verifier.update(rawBody);
    return verifier.verify(pem, parsed.signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Decision function for the POST notification endpoint. R-008: we
 * acknowledge and discard. No persistence. The contract:
 *   - missing signature header → 400
 *   - header malformed / signature mismatch / public-key fetch failure → 401
 *   - valid → 200 { acknowledged: true }
 *
 * NOTE: the verification token is intentionally *not* required on the POST
 * path. Per eBay's spec the token is only used for the GET challenge; POST
 * verification is ECDSA against eBay's public key. A missing token does not
 * block real notifications from being verified. This decouples POST
 * availability from any future env-var drift (R-009).
 *
 * Returns a Promise — the public-key fetch is async on cache miss. The
 * route handler awaits this before responding to eBay. The 3-second eBay
 * SLA is comfortably met: ECDSA verify is sub-ms, the OAuth token is
 * module-cached, and the public key itself is cached for 1h.
 */
export async function handleNotification(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  publicKeyFetcher?: PublicKeyFetcher;
}): Promise<HandlerResult> {
  if (!input.signatureHeader) {
    return { status: 400, body: "missing_signature_header" };
  }
  const ok = await verifyNotificationSignature(input.rawBody, input.signatureHeader, {
    publicKeyFetcher: input.publicKeyFetcher,
  });
  if (!ok) {
    return { status: 401, body: "invalid_signature" };
  }
  return { status: 200, body: { acknowledged: true } };
}

/**
 * Test-only escape hatch — drop the in-process public-key cache so tests
 * exercise cache-miss paths deterministically. NOT for runtime code paths.
 */
export function __resetPublicKeyCacheForTests(): void {
  publicKeyCache.clear();
}
