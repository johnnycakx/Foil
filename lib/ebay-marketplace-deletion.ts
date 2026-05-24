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
//      requests account closure. We verify the signature header with an
//      HMAC-SHA256 over the raw body keyed on the same verification token
//      (timing-safe compare), then return 200. We never persist eBay-sourced
//      user data, so the verification is the entirety of the handler's
//      authentication concern (R-008).
//
// The hash + signature helpers are pure crypto. The handle* wrappers below
// shape the request → status/body decisions so the Next.js route handler
// is a thin adapter and the full GET/POST contract can be unit-tested
// without next/server.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/**
 * Verify the signature on an inbound deletion-notification POST.
 *
 * HMAC-SHA256 over the RAW request body, keyed on the verification token.
 * The expected header is the hex digest. Returns true on match, false on
 * any mismatch / decode error — never throws (so the route handler can
 * branch on a boolean without try/catch).
 *
 * Empty verification token short-circuits to false: an unconfigured webhook
 * must NEVER accept arbitrary payloads.
 */
export function verifyNotificationSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  verificationToken: string,
): boolean {
  if (!signatureHeader || !verificationToken) return false;
  try {
    const expected = createHmac("sha256", verificationToken).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(signatureHeader, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
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

/**
 * Pure decision function for the POST notification endpoint. R-008: we
 * acknowledge and discard. No persistence. The contract:
 *   - missing verification token in env → 503 (server misconfigured)
 *   - missing signature header on request → 400
 *   - signature mismatch → 401
 *   - signature valid → 200 { acknowledged: true }
 */
export function handleNotification(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  verificationToken: string | undefined;
}): HandlerResult {
  if (!input.verificationToken) {
    return { status: 503, body: "missing_verification_token" };
  }
  if (!input.signatureHeader) {
    return { status: 400, body: "missing_signature_header" };
  }
  if (!verifyNotificationSignature(input.rawBody, input.signatureHeader, input.verificationToken)) {
    return { status: 401, body: "invalid_signature" };
  }
  return { status: 200, body: { acknowledged: true } };
}
