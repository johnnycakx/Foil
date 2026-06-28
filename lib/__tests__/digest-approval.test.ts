// ADR-077: the newsletter digest approval handler — the human-in-the-loop gate.
// Approve delivers exactly the persisted issue; skip never delivers; idempotent.

import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryDigestDraftStore, digestExpiryFrom } from "../newsletter/digest-drafts.ts";
import { processDigestApproval, type DigestDeliverResult } from "../newsletter/digest-approval.ts";

const T0 = Date.parse("2026-06-24T00:00:00Z");

function seed(store: InMemoryDigestDraftStore, issueWeek = "2026-W26") {
  return store.create({
    issueWeek,
    subject: "8 Pokémon cards trading below their 30-day average",
    previewText: "The cards cooling off.",
    htmlBody: "<h1>Good buys this week</h1>",
    markdownBody: "# Good buys this week",
    downCount: 8,
    upCount: 4,
    expiresAt: digestExpiryFrom(T0),
  });
}

test("approve delivers the persisted issue exactly once", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await seed(store))!;
  const delivered: string[] = [];
  const deliver = async (d: { subject: string }): Promise<DigestDeliverResult> => {
    delivered.push(d.subject);
    return { ok: true, deliveryId: "resend-1" };
  };

  const res = await processDigestApproval({ store, deliver, id, action: "approve", actor: "john", nowMs: T0 });
  assert.deepEqual(res, { ok: true, action: "delivered", deliveryId: "resend-1", subject: "8 Pokémon cards trading below their 30-day average" });
  assert.equal(delivered.length, 1);
  assert.equal(store.peek(id)!.status, "delivered");
});

test("a second approve is an idempotent no-op (never a second delivery)", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await seed(store))!;
  let calls = 0;
  const deliver = async (): Promise<DigestDeliverResult> => { calls++; return { ok: true, deliveryId: "r" }; };

  await processDigestApproval({ store, deliver, id, action: "approve", actor: "john", nowMs: T0 });
  const second = await processDigestApproval({ store, deliver, id, action: "approve", actor: "john", nowMs: T0 });
  assert.equal(calls, 1, "deliver was called once");
  assert.equal(second.ok, false);
  assert.match((second as { error: string }).error, /not_deliverable_status_delivered/);
});

test("a failed delivery releases the draft back to pending so the owner can re-approve", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await seed(store))!;
  let attempt = 0;
  const deliver = async (): Promise<DigestDeliverResult> => {
    attempt++;
    return attempt === 1 ? { ok: false, error: "resend_500" } : { ok: true, deliveryId: "r2" };
  };

  const first = await processDigestApproval({ store, deliver, id, action: "approve", actor: "john", nowMs: T0 });
  assert.equal(first.ok, false);
  assert.equal(store.peek(id)!.status, "pending", "released back to pending");
  assert.equal(store.peek(id)!.error, "resend_500");

  const retry = await processDigestApproval({ store, deliver, id, action: "approve", actor: "john", nowMs: T0 });
  assert.equal(retry.ok, true);
  assert.equal(store.peek(id)!.status, "delivered");
});

test("skip never delivers", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await seed(store))!;
  let calls = 0;
  const deliver = async (): Promise<DigestDeliverResult> => { calls++; return { ok: true, deliveryId: "r" }; };

  const res = await processDigestApproval({ store, deliver, id, action: "skip", actor: "john", nowMs: T0 });
  assert.deepEqual(res, { ok: true, action: "skipped" });
  assert.equal(calls, 0);
  assert.equal(store.peek(id)!.status, "skipped");
});

test("approve/skip of an unknown id returns draft_not_found (the bot's fallback signal)", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const deliver = async (): Promise<DigestDeliverResult> => ({ ok: true, deliveryId: "r" });
  const a = await processDigestApproval({ store, deliver, id: "missing", action: "approve", actor: "john", nowMs: T0 });
  assert.deepEqual(a, { ok: false, error: "draft_not_found" });
  const s = await processDigestApproval({ store, deliver, id: "missing", action: "skip", actor: "john", nowMs: T0 });
  assert.equal((s as { error: string }).error, "draft_not_found");
});
