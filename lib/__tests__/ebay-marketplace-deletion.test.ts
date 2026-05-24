// Contract tests for the eBay Marketplace Account Deletion compliance
// endpoint. See ADR-022. These pin two boundaries:
//
//   1. The challenge hash format eBay verifies during keyset enablement —
//      sha256(challenge_code + verification_token + endpoint_url) in EXACT
//      concatenation order. A regression here re-disables the keyset.
//   2. The notification HMAC signature gate — the only auth on the POST
//      surface. A regression here either rejects legitimate eBay POSTs or
//      accepts arbitrary forged ones.
//
// We test the pure helpers (challengeResponseHash, verifyNotificationSignature)
// AND the handle* decision functions that the Next.js route handler wraps,
// so the full GET/POST contract is exercised without next/server.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  challengeResponseHash,
  handleChallenge,
  handleNotification,
  verifyNotificationSignature,
} from "../ebay-marketplace-deletion.ts";

const CHALLENGE = "test-challenge";
const TOKEN = "test-verification-token-XDEA7";
const ENDPOINT = "https://foiltcg.com/api/webhooks/ebay-marketplace-deletion";

// Pre-computed via:
//   node -e "const c=require('crypto'); console.log(
//     c.createHash('sha256').update('test-challenge')
//      .update('test-verification-token-XDEA7')
//      .update('https://foiltcg.com/api/webhooks/ebay-marketplace-deletion')
//      .digest('hex'));"
const EXPECTED_HASH =
  "7cb15a2573bfeeeef72030bef122d74ed43f00c8b85c7790470b1fa79384111a";

test("challengeResponseHash matches the pinned fixture vector (canonical order)", () => {
  assert.equal(challengeResponseHash(CHALLENGE, TOKEN, ENDPOINT), EXPECTED_HASH);
});

test("challengeResponseHash output is lowercase 64-char hex", () => {
  const hash = challengeResponseHash(CHALLENGE, TOKEN, ENDPOINT);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("challengeResponseHash is sensitive to concatenation order", () => {
  // If anyone refactors the helper to reorder the inputs, this fails and
  // the keyset gets disabled. eBay's spec is non-negotiable on the order.
  const canonical = challengeResponseHash(CHALLENGE, TOKEN, ENDPOINT);
  // token + challenge + endpoint
  const wrong1 = challengeResponseHash(TOKEN, CHALLENGE, ENDPOINT);
  // challenge + endpoint + token
  const wrong2 = challengeResponseHash(CHALLENGE, ENDPOINT, TOKEN);
  assert.notEqual(canonical, wrong1);
  assert.notEqual(canonical, wrong2);
});

test("verifyNotificationSignature: accepts a correctly-signed body", () => {
  const body = '{"metadata":{"topic":"MARKETPLACE_ACCOUNT_DELETION"}}';
  const signature = createHmac("sha256", TOKEN).update(body).digest("hex");
  assert.equal(verifyNotificationSignature(body, signature, TOKEN), true);
});

test("verifyNotificationSignature: rejects a forged signature (wrong secret)", () => {
  const body = '{"x":1}';
  const forged = createHmac("sha256", "different-secret").update(body).digest("hex");
  assert.equal(verifyNotificationSignature(body, forged, TOKEN), false);
});

test("verifyNotificationSignature: rejects when the body is mutated post-sign", () => {
  const body = '{"x":1}';
  const signature = createHmac("sha256", TOKEN).update(body).digest("hex");
  assert.equal(verifyNotificationSignature('{"x":2}', signature, TOKEN), false);
});

test("verifyNotificationSignature: rejects a header value of the wrong length without throwing", () => {
  assert.equal(verifyNotificationSignature("{}", "tooshort", TOKEN), false);
  assert.equal(verifyNotificationSignature("{}", "", TOKEN), false);
});

test("verifyNotificationSignature: rejects when the verification token is missing/empty", () => {
  const body = "{}";
  const signature = createHmac("sha256", TOKEN).update(body).digest("hex");
  assert.equal(verifyNotificationSignature(body, signature, ""), false);
});

test("verifyNotificationSignature: rejects when the signature header is null/undefined", () => {
  assert.equal(verifyNotificationSignature("{}", null, TOKEN), false);
  assert.equal(verifyNotificationSignature("{}", undefined, TOKEN), false);
});

test("verifyNotificationSignature: matches our pinned HMAC fixture", () => {
  // Pre-computed via:
  //   node -e "const c=require('crypto'); console.log(
  //     c.createHmac('sha256','test-verification-token-XDEA7')
  //      .update('{\"metadata\":{\"topic\":\"MARKETPLACE_ACCOUNT_DELETION\"}}')
  //      .digest('hex'));"
  const PINNED = "34986bb266e774a280234905acce201335712125c107a037e4377bae4eeb6f36";
  const body = '{"metadata":{"topic":"MARKETPLACE_ACCOUNT_DELETION"}}';
  assert.equal(verifyNotificationSignature(body, PINNED, TOKEN), true);
});

// ---------------------------------------------------------------------------
// GET challenge handler
// ---------------------------------------------------------------------------

test("handleChallenge: 200 + correct hash when challenge_code + token present", () => {
  const result = handleChallenge({
    challengeCode: CHALLENGE,
    verificationToken: TOKEN,
    endpointUrl: ENDPOINT,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { challengeResponse: EXPECTED_HASH });
});

test("handleChallenge: 400 when challenge_code is missing", () => {
  const result = handleChallenge({
    challengeCode: null,
    verificationToken: TOKEN,
    endpointUrl: ENDPOINT,
  });
  assert.equal(result.status, 400);
});

test("handleChallenge: 503 when verification token is unset on the server", () => {
  const result = handleChallenge({
    challengeCode: CHALLENGE,
    verificationToken: undefined,
    endpointUrl: ENDPOINT,
  });
  assert.equal(result.status, 503);
});

// ---------------------------------------------------------------------------
// POST notification handler
// ---------------------------------------------------------------------------

test("handleNotification: 200 + acknowledged on a correctly-signed body", () => {
  const body = '{"notification":{"data":{"username":"someone"}}}';
  const signature = createHmac("sha256", TOKEN).update(body).digest("hex");
  const result = handleNotification({
    rawBody: body,
    signatureHeader: signature,
    verificationToken: TOKEN,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { acknowledged: true });
});

test("handleNotification: 401 on a bad signature", () => {
  const body = "{}";
  const wrongSig = createHmac("sha256", "wrong").update(body).digest("hex");
  const result = handleNotification({
    rawBody: body,
    signatureHeader: wrongSig,
    verificationToken: TOKEN,
  });
  assert.equal(result.status, 401);
});

test("handleNotification: 400 when X-EBAY-SIGNATURE header is missing", () => {
  const result = handleNotification({
    rawBody: "{}",
    signatureHeader: null,
    verificationToken: TOKEN,
  });
  assert.equal(result.status, 400);
});

test("handleNotification: 503 when verification token is unset on the server", () => {
  const result = handleNotification({
    rawBody: "{}",
    signatureHeader: "deadbeef",
    verificationToken: undefined,
  });
  assert.equal(result.status, 503);
});

test("handleChallenge + handleNotification complete synchronously — no awaited externals", () => {
  // The eBay 3-second SLA assumes the handler returns without I/O. Both
  // decision functions are synchronous; calling them must not return a
  // Promise (which would imply we'd added an awaited fetch / DB call).
  const challengeResult = handleChallenge({
    challengeCode: CHALLENGE,
    verificationToken: TOKEN,
    endpointUrl: ENDPOINT,
  });
  const notifResult = handleNotification({
    rawBody: "{}",
    signatureHeader: null,
    verificationToken: TOKEN,
  });
  assert.equal(typeof (challengeResult as unknown as { then?: unknown }).then, "undefined");
  assert.equal(typeof (notifResult as unknown as { then?: unknown }).then, "undefined");
});
