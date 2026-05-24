// Contract tests for the wishlist alert cron's bearer auth gate.
//
// The actual route handler imports next/server + path-aliased modules that
// don't resolve under node --experimental-strip-types, so we exercise the
// minimal auth-gate predicate via a pure helper that mirrors the route's
// check. If the route's check ever drifts from this, the test fails to
// catch it — so we keep both shapes byte-identical (Authorization: Bearer
// <CRON_SECRET>, case-insensitive header lookup).

import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors the route handler's bearer-auth predicate. If the route changes
 * its check (e.g. switches to constant-time compare), update this too AND
 * keep it byte-identical with the route handler — these are the same
 * assertion landing at two layers.
 */
function isAuthorized(headerValue: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  return headerValue === `Bearer ${expected}`;
}

const SECRET = "test-cron-secret-9b41e1765cc510af";

test("cron auth: rejects missing header", () => {
  assert.equal(isAuthorized(null, SECRET), false);
});

test("cron auth: rejects empty bearer", () => {
  assert.equal(isAuthorized("Bearer ", SECRET), false);
});

test("cron auth: rejects wrong secret", () => {
  assert.equal(isAuthorized("Bearer wrong-secret", SECRET), false);
});

test("cron auth: rejects when CRON_SECRET unset on server", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, undefined), false);
  assert.equal(isAuthorized(`Bearer ${SECRET}`, ""), false);
});

test("cron auth: accepts exact-match Bearer + secret", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, SECRET), true);
});

test("cron auth: case-sensitive token (Bearer must be exact)", () => {
  // RFC 7235 says scheme is case-insensitive, but our literal-equality
  // check tightens it to exact "Bearer ". If someone wants to relax this
  // they should update the route AND this test in the same commit.
  assert.equal(isAuthorized(`bearer ${SECRET}`, SECRET), false);
  assert.equal(isAuthorized(`BEARER ${SECRET}`, SECRET), false);
});

// ---------------------------------------------------------------------------
// The cron route's batch-result shape is pinned in wishlist-scan-batch.test
// at the orchestrator level. This file's value is the auth gate — the rest
// of the route is a 30-line adapter on top of the tested orchestrator.
// ---------------------------------------------------------------------------
