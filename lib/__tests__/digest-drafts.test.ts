// ADR-077: the newsletter digest draft store — idempotency + lifecycle. Tests
// the in-memory store, which mirrors the SQL store's atomic semantics.

import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryDigestDraftStore, digestExpiryFrom } from "../newsletter/digest-drafts.ts";

const T0 = Date.parse("2026-06-24T00:00:00Z");

function newDraft(issueWeek = "2026-W26") {
  return {
    issueWeek,
    subject: "8 Pokémon cards trading below their 30-day average",
    previewText: "The cards cooling off versus their recent average.",
    htmlBody: "<h1>Good buys this week</h1>",
    markdownBody: "# Good buys this week",
    downCount: 8,
    upCount: 4,
    expiresAt: digestExpiryFrom(T0),
  };
}

test("create returns an id; a second create for the SAME ISO week returns null", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const a = await store.create(newDraft("2026-W26"));
  assert.ok(a?.id, "first create returns an id");
  const dup = await store.create(newDraft("2026-W26"));
  assert.equal(dup, null, "same-week create is rejected (idempotency)");
  const other = await store.create(newDraft("2026-W27"));
  assert.ok(other?.id, "a different week is allowed");
});

test("claimForDelivery is atomic: pending -> delivering once, second claim returns null", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await store.create(newDraft()))!;
  const first = await store.claimForDelivery(id, "owner", T0);
  assert.ok(first, "first claim succeeds");
  assert.equal(first!.status, "delivering");
  const second = await store.claimForDelivery(id, "owner", T0);
  assert.equal(second, null, "second claim returns null (no double delivery)");
});

test("claimForDelivery refuses an expired draft", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await store.create({ ...newDraft(), expiresAt: new Date(T0 + 1000).toISOString() }))!;
  const claimed = await store.claimForDelivery(id, "owner", T0 + 5000); // now past expiry
  assert.equal(claimed, null);
});

test("markDelivered finalizes; release returns a failed delivery to pending", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await store.create(newDraft()))!;
  await store.claimForDelivery(id, "owner", T0);

  await store.release(id, "email_bounced");
  assert.equal(store.peek(id)!.status, "pending", "release puts it back to pending");
  assert.equal(store.peek(id)!.error, "email_bounced");

  // Re-claim + deliver succeeds.
  await store.claimForDelivery(id, "owner", T0);
  await store.markDelivered(id, "resend-123");
  const row = store.peek(id)!;
  assert.equal(row.status, "delivered");
  assert.equal(row.delivery_id, "resend-123");
  assert.equal(row.error, null);
});

test("skip: pending -> skipped; skipping a non-pending draft reports its status", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const { id } = (await store.create(newDraft()))!;
  const ok = await store.skip(id, "owner");
  assert.deepEqual(ok, { ok: true, status: "skipped" });
  const again = await store.skip(id, "owner");
  assert.equal(again.ok, false);
  assert.equal(again.status, "skipped");
  const missing = await store.skip("nope", "owner");
  assert.deepEqual(missing, { ok: false, status: "missing" });
});

test("expireStale sweeps only pending drafts past their expiry", async () => {
  const store = new InMemoryDigestDraftStore(() => T0);
  const fresh = (await store.create({ ...newDraft("2026-W26"), expiresAt: new Date(T0 + 1_000_000).toISOString() }))!;
  const stale = (await store.create({ ...newDraft("2026-W25"), expiresAt: new Date(T0 - 1000).toISOString() }))!;
  const n = await store.expireStale(T0);
  assert.equal(n, 1);
  assert.equal(store.peek(stale.id)!.status, "expired");
  assert.equal(store.peek(fresh.id)!.status, "pending");
});
