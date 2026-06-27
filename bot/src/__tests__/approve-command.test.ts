// X approval slash-command guards (ADR-071). The owner-gate is the load-bearing
// safety rail (only the configured owner can approve/skip), and the endpoint
// relay must send the right bearer + body to the Foil app's /api/x/approve.

import test from "node:test";
import assert from "node:assert/strict";
import { isApprovalOwner, callApprovalEndpoint } from "../handlers/slash-commands.ts";

// --- owner gate (fail-closed) ---

test("isApprovalOwner: only the exact configured owner qualifies", () => {
  assert.equal(isApprovalOwner("123", "123"), true);
  assert.equal(isApprovalOwner("123", "999"), false, "a different user is not the owner");
});

test("isApprovalOwner: unset owner id locks everyone out (fail-closed)", () => {
  assert.equal(isApprovalOwner("123", undefined), false);
  assert.equal(isApprovalOwner("123", ""), false);
});

// --- endpoint relay ---

test("callApprovalEndpoint: missing secret returns an error, never calls fetch", async () => {
  let called = false;
  const res = await callApprovalEndpoint("approve", "draft-1", "john", {
    secret: undefined,
    fetchImpl: (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch,
  });
  assert.equal(res.ok, false);
  assert.equal(called, false, "must not call the endpoint without a secret");
  if (!res.ok) assert.match(res.error, /X_APPROVE_SECRET/);
});

test("callApprovalEndpoint: sends bearer + {id,action,actor} and parses a posted result", async () => {
  let seenUrl = "";
  let seenAuth = "";
  let seenBody: Record<string, unknown> = {};
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seenUrl = url;
    seenAuth = (init.headers as Record<string, string>).Authorization;
    seenBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ ok: true, action: "posted", postId: "1234" }), { status: 200 });
  }) as unknown as typeof fetch;

  const res = await callApprovalEndpoint("approve", "draft-7", "johnnycakx", {
    appUrl: "https://foiltcg.com/",
    secret: "s3cret",
    fetchImpl,
  });
  assert.equal(seenUrl, "https://foiltcg.com/api/x/approve", "trailing slash trimmed; correct path");
  assert.equal(seenAuth, "Bearer s3cret");
  assert.deepEqual(seenBody, { id: "draft-7", action: "approve", actor: "johnnycakx" });
  assert.deepEqual(res, { ok: true, action: "posted", postId: "1234" });
});

test("callApprovalEndpoint: a 409 idempotent no-op surfaces as a clean error", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ ok: false, error: "not_postable_status_posted", status: "posted" }), { status: 409 })
  ) as unknown as typeof fetch;
  const res = await callApprovalEndpoint("approve", "draft-9", "john", { secret: "s", fetchImpl });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, "not_postable_status_posted");
});
