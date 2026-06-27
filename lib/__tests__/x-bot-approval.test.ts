// X content-bot APPROVAL-mode tests (ADR-071). Covers: mode resolution
// precedence; approval mode NEVER posts without an explicit approve; the approve
// path posts EXACTLY the persisted draft (text + image); expiry auto-skips;
// double-approve posts once (idempotency); skip never posts; post-failure
// releases for retry. Draft store + X poster are injected (the refresh-batch
// pattern) so nothing hits Discord/Supabase/the live X API.

import test from "node:test";
import assert from "node:assert/strict";
import { resolveXBotMode } from "../social/mode.ts";
import { runXBot, type XBotDeps } from "../social/bot.ts";
import { processApproval } from "../social/approval.ts";
import { InMemoryDraftStore, bytesToBase64, expiryFrom } from "../social/drafts.ts";
import type { PostToXResult } from "../social/x-client.ts";

// --- mode resolution precedence ---

test("resolveXBotMode: X_BOT_MODE wins over the legacy X_BOT_LIVE", () => {
  assert.equal(resolveXBotMode({ X_BOT_MODE: "approval", X_BOT_LIVE: "true" }), "approval");
  assert.equal(resolveXBotMode({ X_BOT_MODE: "dry_run", X_BOT_LIVE: "true" }), "dry_run");
  assert.equal(resolveXBotMode({ X_BOT_MODE: "live" }), "live");
});

test("resolveXBotMode: legacy X_BOT_LIVE=true maps to live only when X_BOT_MODE is unset/invalid", () => {
  assert.equal(resolveXBotMode({ X_BOT_LIVE: "true" }), "live");
  assert.equal(resolveXBotMode({ X_BOT_MODE: "bogus", X_BOT_LIVE: "true" }), "live");
});

test("resolveXBotMode: defaults to dry_run; is case-insensitive", () => {
  assert.equal(resolveXBotMode({}), "dry_run");
  assert.equal(resolveXBotMode({ X_BOT_LIVE: "false" }), "dry_run");
  assert.equal(resolveXBotMode({ X_BOT_MODE: "APPROVAL" }), "approval");
  assert.equal(resolveXBotMode({ X_BOT_MODE: " Live " }), "live");
});

// --- approval mode in the orchestrator never posts ---

function approvalDeps(over: Partial<XBotDeps> = {}): XBotDeps {
  return {
    mode: "approval",
    now: new Date("2026-06-08T14:00:00Z"),
    getDeals: async () => [],
    getSpotlight: async () => null,
    generateText: async (input) => ({ text: `post ${input.angle} https://foiltcg.com/deals`, angle: input.angle, link: "https://foiltcg.com/deals", attempts: 1 }),
    renderImage: async () => new Uint8Array([9, 9, 9]),
    post: async () => ({ ok: true, postId: "SHOULD_NOT_HAPPEN" }),
    review: async () => {},
    requestApproval: async () => ({ id: "draft-xyz" }),
    ...over,
  };
}

test("APPROVAL mode persists + asks, NEVER calls the X poster", async () => {
  let postCalls = 0;
  let approvalCalls = 0;
  const res = await runXBot(approvalDeps({
    post: async () => { postCalls++; return { ok: true, postId: "x" }; },
    requestApproval: async () => { approvalCalls++; return { id: "draft-1" }; },
  }));
  assert.equal(postCalls, 0, "approval mode must NOT touch the X API in the cron");
  assert.equal(approvalCalls, 1, "the draft must be routed to the approval request");
  assert.equal(res.posted, false);
  assert.equal(res.reason, "awaiting_approval");
  assert.equal(res.draftId, "draft-1");
  assert.equal(res.ok, true);
});

test("APPROVAL mode soft-fails when persistence fails (still never posts)", async () => {
  let postCalls = 0;
  const res = await runXBot(approvalDeps({
    post: async () => { postCalls++; return { ok: true, postId: "x" }; },
    requestApproval: async () => null,
  }));
  assert.equal(postCalls, 0);
  assert.equal(res.ok, false);
  assert.equal(res.error, "approval_persist_failed");
});

// --- the approve path posts EXACTLY the persisted draft ---

const FIXED_NOW = Date.parse("2026-06-08T14:00:00Z");

async function seedDraft(store: InMemoryDraftStore, over: Partial<{ text: string; image: Uint8Array | null; expiresAt: string }> = {}) {
  const created = await store.create({
    angle: "educational",
    text: over.text ?? "Foil matches condition and language before calling a deal. https://foiltcg.com/deals",
    link: "https://foiltcg.com/deals",
    imageBase64: over.image === undefined ? bytesToBase64(new Uint8Array([1, 2, 3])) : over.image ? bytesToBase64(over.image) : null,
    expiresAt: over.expiresAt ?? expiryFrom(FIXED_NOW, 12),
  });
  return created.id;
}

test("approve posts the persisted text + image verbatim, marks posted", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store, { text: "exact draft text https://foiltcg.com/deals" });

  let postedText = "";
  let postedImage: Uint8Array | null = new Uint8Array();
  const post = async (x: { text: string; imagePng: Uint8Array | null }): Promise<PostToXResult> => {
    postedText = x.text;
    postedImage = x.imagePng;
    return { ok: true, postId: "tweet-1" };
  };

  const res = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.deepEqual(res, { ok: true, action: "posted", postId: "tweet-1", text: "exact draft text https://foiltcg.com/deals" });
  assert.equal(postedText, "exact draft text https://foiltcg.com/deals");
  assert.deepEqual(postedImage, new Uint8Array([1, 2, 3]), "the persisted image bytes are posted verbatim");
  assert.equal((await store.get(id))?.status, "posted");
  assert.equal((await store.get(id))?.post_id, "tweet-1");
});

test("double-approve posts exactly once (idempotent claim)", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store);
  let postCalls = 0;
  const post = async (): Promise<PostToXResult> => { postCalls++; return { ok: true, postId: "tweet-1" }; };

  const first = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  const second = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });

  assert.equal(postCalls, 1, "a second approve must NOT post again");
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.status, "posted");
});

test("an expired pending draft never posts (claim is expiry-guarded)", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store, { expiresAt: new Date(FIXED_NOW - 1000).toISOString() }); // already expired
  let postCalls = 0;
  const post = async (): Promise<PostToXResult> => { postCalls++; return { ok: true, postId: "x" }; };

  const res = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.equal(postCalls, 0, "an expired draft must never post");
  assert.equal(res.ok, false);
});

test("expireStale sweeps a timed-out pending draft to expired (never posts)", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store, { expiresAt: new Date(FIXED_NOW - 1000).toISOString() });
  const swept = await store.expireStale(FIXED_NOW);
  assert.equal(swept, 1);
  assert.equal((await store.get(id))?.status, "expired");
});

test("skip marks the draft skipped and never posts; re-skip is a clean no-op", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store);
  let postCalls = 0;
  const post = async (): Promise<PostToXResult> => { postCalls++; return { ok: true, postId: "x" }; };

  const r1 = await processApproval({ store, post, id, action: "skip", actor: "owner", nowMs: FIXED_NOW });
  assert.deepEqual(r1, { ok: true, action: "skipped" });
  assert.equal((await store.get(id))?.status, "skipped");

  const r2 = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.equal(r2.ok, false, "a skipped draft can't be approved");
  assert.equal(postCalls, 0);
});

test("a post failure releases the draft back to pending (owner can re-approve)", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  const id = await seedDraft(store);
  let attempt = 0;
  const post = async (): Promise<PostToXResult> => {
    attempt++;
    return attempt === 1 ? { ok: false, error: "create_post_http_503" } : { ok: true, postId: "tweet-2" };
  };

  const first = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.equal(first.ok, false);
  assert.equal((await store.get(id))?.status, "pending", "released for retry");

  const second = await processApproval({ store, post, id, action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.equal(second.ok, true);
  assert.equal((await store.get(id))?.status, "posted");
});

test("approving an unknown id is a clean not-found, never posts", async () => {
  const store = new InMemoryDraftStore(() => FIXED_NOW);
  let postCalls = 0;
  const post = async (): Promise<PostToXResult> => { postCalls++; return { ok: true, postId: "x" }; };
  const res = await processApproval({ store, post, id: "nope", action: "approve", actor: "owner", nowMs: FIXED_NOW });
  assert.equal(postCalls, 0);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, "draft_not_found");
});
