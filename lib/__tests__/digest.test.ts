// Daily-digest queue (ADR-018). Pins the queueEvent → flushDigest contract
// and the per-channel embed shape. We stub the Supabase client so these
// tests don't touch the live Postgres.

import test from "node:test";
import assert from "node:assert/strict";
import {
  __setDigestClientForTests,
  buildDigestEmbed,
  flushDigest,
  queueEvent,
} from "../notifications/digest.ts";

type Row = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  channel_target: string;
  created_at: string;
  digested_at: string | null;
};

function fakeSupabase() {
  const rows: Row[] = [];
  let nextId = 1;

  const builder = (table: string) => ({
    insert: (payload: Record<string, unknown>) => {
      assert.equal(table, "digest_events");
      const row: Row = {
        id: `row_${nextId++}`,
        event_type: String(payload.event_type),
        payload: (payload.payload ?? {}) as Record<string, unknown>,
        channel_target: String(payload.channel_target),
        created_at: new Date(Date.now() - (10 - nextId) * 1000).toISOString(),
        digested_at: null,
      };
      rows.push(row);
      return Promise.resolve({ data: row, error: null });
    },
    select: (_cols: string) => ({
      eq: (field: keyof Row, value: unknown) => ({
        is: (otherField: keyof Row, otherVal: unknown) => ({
          order: () => Promise.resolve({
            data: rows.filter((r) => r[field] === value && r[otherField] === otherVal),
            error: null,
          }),
        }),
      }),
    }),
    update: (patch: Partial<Row>) => ({
      in: (field: keyof Row, ids: unknown[]) => {
        const idSet = new Set(ids);
        for (const r of rows) {
          if (idSet.has(r[field] as unknown)) Object.assign(r, patch);
        }
        return Promise.resolve({ data: null, error: null });
      },
    }),
  });

  return { from: (table: string) => builder(table), __rows: rows };
}

test("queueEvent inserts a row into digest_events with the right shape", async () => {
  const fake = fakeSupabase();
  __setDigestClientForTests(fake as never);
  try {
    const ok = await queueEvent({
      eventType: "subscriber_joined",
      payload: { source: "blog-foo", email_masked: "j***@x.co" },
      channelTarget: "subscribers",
    });
    assert.equal(ok, true);
    assert.equal(fake.__rows.length, 1);
    assert.equal(fake.__rows[0].event_type, "subscriber_joined");
    assert.equal(fake.__rows[0].channel_target, "subscribers");
    assert.equal(fake.__rows[0].digested_at, null);
  } finally {
    __setDigestClientForTests(null);
  }
});

test("flushDigest returns 0 when there are no undigested rows", async () => {
  const fake = fakeSupabase();
  __setDigestClientForTests(fake as never);
  try {
    const result = await flushDigest("subscribers");
    assert.equal(result.eventsFlushed, 0);
    assert.equal(result.posted, false);
  } finally {
    __setDigestClientForTests(null);
  }
});

test("flushDigest groups events by type, posts ONE Discord embed, marks rows digested", async () => {
  const fake = fakeSupabase();
  __setDigestClientForTests(fake as never);
  process.env.DISCORD_WEBHOOK_SUBSCRIBERS = "https://x.test/wh";

  // Mock fetch so the discord poster gets a 204.
  const originalFetch = globalThis.fetch;
  let postedBody: unknown = null;
  let calls = 0;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls++;
    postedBody = JSON.parse(init?.body as string);
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    await queueEvent({ eventType: "subscriber_joined", payload: {}, channelTarget: "subscribers" });
    await queueEvent({ eventType: "subscriber_joined", payload: {}, channelTarget: "subscribers" });
    await queueEvent({ eventType: "subscribe_failed", payload: {}, channelTarget: "subscribers" });

    const result = await flushDigest("subscribers");
    assert.equal(result.eventsFlushed, 3);
    assert.equal(result.posted, true);
    assert.equal(calls, 1, "exactly one Discord post per flush");

    // Rows are marked digested_at after the post succeeds
    for (const r of fake.__rows) {
      assert.notEqual(r.digested_at, null, `row ${r.id} should be marked digested`);
    }

    // Embed groups by event_type
    const body = postedBody as { embeds: Array<{ fields: Array<{ name: string; value: string }> }> };
    const fields = body.embeds[0].fields;
    const joined = fields.find((f) => f.name === "subscriber_joined")?.value;
    const failed = fields.find((f) => f.name === "subscribe_failed")?.value;
    assert.equal(joined, "2");
    assert.equal(failed, "1");
  } finally {
    __setDigestClientForTests(null);
    globalThis.fetch = originalFetch;
  }
});

test("flushDigest does NOT mark rows digested when Discord post fails", async () => {
  const fake = fakeSupabase();
  __setDigestClientForTests(fake as never);
  process.env.DISCORD_WEBHOOK_SUBSCRIBERS = "https://x.test/wh";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("oops", { status: 500 })) as typeof fetch;

  try {
    await queueEvent({ eventType: "subscriber_joined", payload: {}, channelTarget: "subscribers" });
    const result = await flushDigest("subscribers");
    assert.equal(result.posted, false);
    // Row still undigested → next flush retries
    assert.equal(fake.__rows[0].digested_at, null);
  } finally {
    __setDigestClientForTests(null);
    globalThis.fetch = originalFetch;
  }
});

test("buildDigestEmbed: includes time window + sorted-by-count fields", () => {
  const rows = [
    { event_type: "subscriber_joined", payload: {}, created_at: "2026-05-22T00:00:00Z" },
    { event_type: "subscriber_joined", payload: {}, created_at: "2026-05-22T00:00:10Z" },
    { event_type: "subscribe_failed", payload: {}, created_at: "2026-05-22T00:00:20Z" },
  ];
  const embed = buildDigestEmbed("subscribers", rows);
  assert.ok(embed.title?.includes("#subscribers"));
  assert.ok(embed.description?.includes("3 events"));
  // First field is the highest-count event type
  assert.equal(embed.fields?.[0].name, "subscriber_joined");
  assert.equal(embed.fields?.[0].value, "2");
});

test("buildDigestEmbed: pluralization on the events count", () => {
  const oneRow = [{ event_type: "x", payload: {}, created_at: "2026-05-22T00:00:00Z" }];
  const embed = buildDigestEmbed("subscribers", oneRow);
  assert.ok(embed.description?.includes("1 event between"));
});
