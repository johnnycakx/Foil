// Contract tests for the eBay Marketplace Account Deletion compliance
// endpoint. See ADR-022.
//
// Two boundaries are pinned:
//
//   1. The challenge hash format eBay verifies during keyset enablement —
//      sha256(challenge_code + verification_token + endpoint_url) in EXACT
//      concatenation order. A regression here re-disables the keyset.
//   2. The notification ECDSA signature gate — the only auth on the POST
//      surface. Verification is ECDSA against eBay's public key (fetched
//      from the Notification API by `kid` extracted from the
//      base64-JSON `x-ebay-signature` header), NOT an HMAC of the body
//      keyed on the verification token (which is what an earlier version
//      of this code did, and what eBay flagged via test-notification 401s
//      in Session 34). The verification token is only used for the GET
//      challenge under the actual spec.

import test from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import {
  __resetPublicKeyCacheForTests,
  challengeResponseHash,
  handleChallenge,
  handleNotification,
  parseSignatureHeader,
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

// ---------------------------------------------------------------------------
// Test fixtures: a deterministic EC P-256 key pair used to forge a valid
// eBay-shaped signature, with a mocked publicKeyFetcher returning the
// matching PEM. Mirrors the structure of a real eBay notification.
// ---------------------------------------------------------------------------

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const TEST_KID = "test-kid-abc123";
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" }) as string;

function signBody(body: string, key: KeyObject = privateKey): string {
  return createSign("sha1").update(body).sign(key, "base64");
}

function makeSignatureHeader(body: string, key: KeyObject = privateKey, kid = TEST_KID): string {
  return Buffer.from(
    JSON.stringify({
      alg: "ECDSA",
      kid,
      signature: signBody(body, key),
      digest: "SHA1",
    }),
    "utf8",
  ).toString("base64");
}

function fetcherReturning(pem: string | null): (kid: string) => Promise<string | null> {
  return async () => pem;
}

// ---------------------------------------------------------------------------
// GET challenge — unchanged from Session 25.
// ---------------------------------------------------------------------------

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
  const wrong1 = challengeResponseHash(TOKEN, CHALLENGE, ENDPOINT);
  const wrong2 = challengeResponseHash(CHALLENGE, ENDPOINT, TOKEN);
  assert.notEqual(canonical, wrong1);
  assert.notEqual(canonical, wrong2);
});

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

test("handleChallenge completes synchronously — no awaited externals (eBay 3s SLA)", () => {
  const challengeResult = handleChallenge({
    challengeCode: CHALLENGE,
    verificationToken: TOKEN,
    endpointUrl: ENDPOINT,
  });
  assert.equal(typeof (challengeResult as unknown as { then?: unknown }).then, "undefined");
});

// ---------------------------------------------------------------------------
// parseSignatureHeader
// ---------------------------------------------------------------------------

test("parseSignatureHeader: returns kid + signature for a well-formed header", () => {
  const body = '{"x":1}';
  const header = makeSignatureHeader(body);
  const parsed = parseSignatureHeader(header);
  assert.ok(parsed, "expected non-null parse result");
  assert.equal(parsed.kid, TEST_KID);
  assert.equal(typeof parsed.signature, "string");
  assert.ok(parsed.signature.length > 0);
});

test("parseSignatureHeader: null/undefined → null (no throw)", () => {
  assert.equal(parseSignatureHeader(null), null);
  assert.equal(parseSignatureHeader(undefined), null);
  assert.equal(parseSignatureHeader(""), null);
});

test("parseSignatureHeader: non-base64 garbage → null (no throw)", () => {
  assert.equal(parseSignatureHeader("@@@not-base64@@@"), null);
});

test("parseSignatureHeader: missing kid → null", () => {
  const header = Buffer.from(JSON.stringify({ signature: "abc" }), "utf8").toString("base64");
  assert.equal(parseSignatureHeader(header), null);
});

test("parseSignatureHeader: missing signature → null", () => {
  const header = Buffer.from(JSON.stringify({ kid: "x" }), "utf8").toString("base64");
  assert.equal(parseSignatureHeader(header), null);
});

// ---------------------------------------------------------------------------
// verifyNotificationSignature — ECDSA path
// ---------------------------------------------------------------------------

test("verifyNotificationSignature: accepts a correctly-signed body with matching public key", async () => {
  __resetPublicKeyCacheForTests();
  const body = '{"metadata":{"topic":"MARKETPLACE_ACCOUNT_DELETION"}}';
  const header = makeSignatureHeader(body);
  const ok = await verifyNotificationSignature(body, header, {
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(ok, true);
});

test("verifyNotificationSignature: rejects a signature forged with a different private key", async () => {
  __resetPublicKeyCacheForTests();
  const { privateKey: otherPriv } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const body = '{"x":1}';
  const header = makeSignatureHeader(body, otherPriv);
  const ok = await verifyNotificationSignature(body, header, {
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(ok, false);
});

test("verifyNotificationSignature: rejects when the body is mutated post-sign", async () => {
  __resetPublicKeyCacheForTests();
  const body = '{"x":1}';
  const header = makeSignatureHeader(body);
  const ok = await verifyNotificationSignature('{"x":2}', header, {
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(ok, false);
});

test("verifyNotificationSignature: rejects when the public-key fetcher returns null", async () => {
  __resetPublicKeyCacheForTests();
  const body = '{"x":1}';
  const header = makeSignatureHeader(body);
  const ok = await verifyNotificationSignature(body, header, {
    publicKeyFetcher: fetcherReturning(null),
  });
  assert.equal(ok, false);
});

test("verifyNotificationSignature: rejects null/undefined/empty signature header without throwing", async () => {
  __resetPublicKeyCacheForTests();
  assert.equal(await verifyNotificationSignature("{}", null), false);
  assert.equal(await verifyNotificationSignature("{}", undefined), false);
  assert.equal(await verifyNotificationSignature("{}", ""), false);
});

test("verifyNotificationSignature: rejects when the fetcher throws", async () => {
  __resetPublicKeyCacheForTests();
  const body = '{"x":1}';
  const header = makeSignatureHeader(body);
  const ok = await verifyNotificationSignature(body, header, {
    publicKeyFetcher: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(ok, false);
});

// ---------------------------------------------------------------------------
// handleNotification — ECDSA path
// ---------------------------------------------------------------------------

test("handleNotification: 200 + acknowledged on a correctly-signed body", async () => {
  __resetPublicKeyCacheForTests();
  const body = '{"notification":{"data":{"username":"someone"}}}';
  const header = makeSignatureHeader(body);
  const result = await handleNotification({
    rawBody: body,
    signatureHeader: header,
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { acknowledged: true });
});

test("handleNotification: 401 on a bad signature", async () => {
  __resetPublicKeyCacheForTests();
  const { privateKey: otherPriv } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const body = "{}";
  const header = makeSignatureHeader(body, otherPriv);
  const result = await handleNotification({
    rawBody: body,
    signatureHeader: header,
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(result.status, 401);
});

test("handleNotification: 400 when x-ebay-signature header is missing", async () => {
  const result = await handleNotification({
    rawBody: "{}",
    signatureHeader: null,
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(result.status, 400);
});

test("handleNotification: 401 when header is base64 garbage", async () => {
  const result = await handleNotification({
    rawBody: "{}",
    signatureHeader: "@@@not-base64@@@",
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(result.status, 401);
});

test("handleNotification: 401 when the public-key fetcher returns null (eBay API down)", async () => {
  __resetPublicKeyCacheForTests();
  const body = "{}";
  const header = makeSignatureHeader(body);
  const result = await handleNotification({
    rawBody: body,
    signatureHeader: header,
    publicKeyFetcher: fetcherReturning(null),
  });
  assert.equal(result.status, 401);
});

test("handleNotification: POST does NOT depend on EBAY_DELETION_VERIFICATION_TOKEN — token-drift no longer breaks POST", async () => {
  // Regression pin for the Session 34 root-cause finding: the verification
  // token is only used by the GET challenge under eBay's actual spec. The
  // POST handler must not consult it. If anyone re-adds a verification-token
  // guard to handleNotification, this test fails.
  const body = '{"x":1}';
  const header = makeSignatureHeader(body);
  const result = await handleNotification({
    rawBody: body,
    signatureHeader: header,
    publicKeyFetcher: fetcherReturning(PUBLIC_PEM),
  });
  assert.equal(result.status, 200);
});
