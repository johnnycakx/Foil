// /reset slash command: the production handler defers + edits the reply,
// which requires a real discord.js interaction object. We test the underlying
// resetChannel() helper indirectly here — the integration with discord.js
// is exercised manually in the end-to-end smoke.

import test from "node:test";
import assert from "node:assert/strict";
import {
  __setClientForTests,
  getRecentChannelMessages,
  insertMessage,
  resetChannel,
} from "../db.ts";

function fakeSupabase() {
  const rows = new Map<string, Array<{ id: string; channel_id: string; role: string; content: string }>>();
  rows.set("bot_messages", []);
  rows.set("bot_embeddings", []);

  const builder = (table: string) => ({
    insert: (payload: Record<string, unknown>) => {
      const arr = rows.get(table) ?? [];
      const id = `id_${arr.length + 1}`;
      const newRow = {
        id,
        channel_id: String(payload.channel_id ?? ""),
        role: String(payload.role ?? "user"),
        content: String(payload.content ?? ""),
      };
      arr.push(newRow);
      rows.set(table, arr);
      const result = { data: { id }, error: null };
      return {
        select: () => ({ single: async () => result }),
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result)),
      };
    },
    select: () => ({
      eq: (_field: string, value: unknown) => ({
        order: () => ({
          limit: async () => {
            const arr = rows.get(table) ?? [];
            // Match production: order_by created_at desc → newest-first.
            return { data: arr.filter((r) => r.channel_id === value).slice().reverse(), error: null };
          },
        }),
      }),
    }),
    delete: () => ({
      eq: async (_field: string, value: unknown) => {
        const arr = rows.get(table) ?? [];
        const keep = arr.filter((r) => r.channel_id !== value);
        const deleted = arr.length - keep.length;
        rows.set(table, keep);
        return { count: deleted, error: null };
      },
    }),
  });

  return {
    from: (table: string) => builder(table),
    rpc: async () => ({ data: [], error: null }),
  };
}

test("/reset wipes every message in the target channel only", async () => {
  __setClientForTests(fakeSupabase() as never);
  try {
    await insertMessage({ channelId: "chan-keep", userId: "u", role: "user", content: "stay" });
    await insertMessage({ channelId: "chan-wipe", userId: "u", role: "user", content: "go-1" });
    await insertMessage({ channelId: "chan-wipe", userId: "u", role: "assistant", content: "go-2" });
    await insertMessage({ channelId: "chan-wipe", userId: "u", role: "user", content: "go-3" });

    const deleted = await resetChannel("chan-wipe");
    assert.equal(deleted, 3);

    const wiped = await getRecentChannelMessages("chan-wipe");
    assert.equal(wiped.length, 0);

    const kept = await getRecentChannelMessages("chan-keep");
    assert.equal(kept.length, 1);
    assert.equal(kept[0].content, "stay");
  } finally {
    __setClientForTests(null);
  }
});

test("/reset on an empty channel returns 0 and doesn't error", async () => {
  __setClientForTests(fakeSupabase() as never);
  try {
    const deleted = await resetChannel("never-existed");
    assert.equal(deleted, 0);
  } finally {
    __setClientForTests(null);
  }
});
