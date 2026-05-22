// db.ts: round-trip the insert → fetch → reset path using a fake Supabase
// client. We don't hit the live Postgres in unit tests — the migration
// itself is covered by the end-to-end smoke when John mentions the bot.

import test from "node:test";
import assert from "node:assert/strict";
import {
  __setClientForTests,
  getRecentChannelMessages,
  hashEmbedding,
  insertMessage,
  resetChannel,
  semanticSearchMessages,
} from "../db.ts";

type CapturedCall = {
  table: string;
  operation: string;
  payload?: unknown;
  filter?: { field: string; value: unknown };
};

function fakeSupabase(): { client: unknown; calls: CapturedCall[]; rows: Map<string, unknown[]> } {
  const calls: CapturedCall[] = [];
  const rows = new Map<string, unknown[]>();
  rows.set("bot_messages", []);
  rows.set("bot_embeddings", []);

  // Returns a chainable builder that records the operation it represents.
  // The insert chain returns a then-able so it works both for
  // `await client.from(t).insert(x)` AND
  // `await client.from(t).insert(x).select(...).single()`.
  const builder = (table: string) => ({
    insert: (payload: unknown) => {
      calls.push({ table, operation: "insert", payload });
      const arr = rows.get(table) ?? [];
      const newRow = { id: `id_${arr.length + 1}`, ...(payload as object) };
      arr.push(newRow);
      rows.set(table, arr);
      const result = { data: newRow, error: null };
      return {
        select: () => ({ single: async () => result }),
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result)),
      };
    },
    select: () => ({
      eq: (field: string, value: unknown) => ({
        order: () => ({
          limit: async () => {
            calls.push({ table, operation: "select", filter: { field, value } });
            const arr = (rows.get(table) ?? []) as Array<{ channel_id?: string }>;
            // Match production behavior: Supabase returns newest-first when
            // ordered by created_at desc. Our insertion order is oldest-first,
            // so reverse to simulate the descending order.
            const filtered = arr.filter((r) => r.channel_id === value).slice().reverse();
            return { data: filtered, error: null };
          },
        }),
      }),
    }),
    delete: () => ({
      eq: async (field: string, value: unknown) => {
        calls.push({ table, operation: "delete", filter: { field, value } });
        const arr = (rows.get(table) ?? []) as Array<{ channel_id?: string }>;
        const remaining = arr.filter((r) => r.channel_id !== value);
        const deleted = arr.length - remaining.length;
        rows.set(table, remaining);
        return { count: deleted, error: null };
      },
    }),
  });

  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      calls.push({ table: `rpc:${name}`, operation: "rpc", payload: args });
      return { data: [], error: null };
    },
  };
  return { client, calls, rows };
}

test("insertMessage writes to bot_messages + bot_embeddings", async () => {
  const fake = fakeSupabase();
  __setClientForTests(fake.client as never);
  try {
    const result = await insertMessage({
      channelId: "chan-1",
      userId: "user-1",
      role: "user",
      content: "hello world",
    });
    assert.ok(result, "expected an id");
    assert.equal(fake.calls.filter((c) => c.table === "bot_messages").length, 1);
    assert.equal(fake.calls.filter((c) => c.table === "bot_embeddings").length, 1);
  } finally {
    __setClientForTests(null);
  }
});

test("getRecentChannelMessages filters by channel + reverses to oldest-first", async () => {
  const fake = fakeSupabase();
  __setClientForTests(fake.client as never);
  try {
    await insertMessage({ channelId: "chan-1", userId: "u", role: "user", content: "a" });
    await insertMessage({ channelId: "chan-2", userId: "u", role: "user", content: "different chan" });
    await insertMessage({ channelId: "chan-1", userId: "u", role: "assistant", content: "b" });

    const recent = await getRecentChannelMessages("chan-1");
    assert.equal(recent.length, 2, `expected 2 rows for chan-1, got ${recent.length}`);
    assert.equal(recent[0].content, "a");
    assert.equal(recent[1].content, "b");
  } finally {
    __setClientForTests(null);
  }
});

test("resetChannel deletes only the target channel and returns the count", async () => {
  const fake = fakeSupabase();
  __setClientForTests(fake.client as never);
  try {
    await insertMessage({ channelId: "chan-1", userId: "u", role: "user", content: "a" });
    await insertMessage({ channelId: "chan-1", userId: "u", role: "user", content: "b" });
    await insertMessage({ channelId: "chan-2", userId: "u", role: "user", content: "leave me" });

    const deleted = await resetChannel("chan-1");
    assert.equal(deleted, 2);

    const surviving = await getRecentChannelMessages("chan-2");
    assert.equal(surviving.length, 1);
    assert.equal(surviving[0].content, "leave me");
  } finally {
    __setClientForTests(null);
  }
});

test("semanticSearchMessages invokes the RPC with a 1536-dim embedding", async () => {
  const fake = fakeSupabase();
  __setClientForTests(fake.client as never);
  try {
    await semanticSearchMessages("chan-1", "test query", 3);
    const rpcCalls = fake.calls.filter((c) => c.operation === "rpc");
    assert.equal(rpcCalls.length, 1);
    const args = rpcCalls[0].payload as { p_channel_id: string; p_query_embedding: number[]; p_top_k: number };
    assert.equal(args.p_channel_id, "chan-1");
    assert.equal(args.p_top_k, 3);
    assert.equal(args.p_query_embedding.length, 1536);
  } finally {
    __setClientForTests(null);
  }
});

test("hashEmbedding is deterministic, unit-norm, 1536-dim", () => {
  const a = hashEmbedding("hello world");
  const b = hashEmbedding("hello world");
  const c = hashEmbedding("DIFFERENT text");

  assert.equal(a.length, 1536);
  assert.deepEqual(a, b, "same input → same vector");
  assert.notDeepEqual(a, c, "different input → different vector");

  const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-6, `expected unit vector, norm=${norm}`);
});
