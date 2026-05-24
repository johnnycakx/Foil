// Contract tests for lib/telemetry/browse-calls.ts.
// Pins:
//   1. logBrowseCall returns ok:true on success, ok:false on Supabase
//      error, never throws on synchronous-throw paths.
//   2. aggregateLast24h: totals + per-surface counts + success rate.
//   3. aggregateLast24h: pctOfCeiling math + approachingCeiling flag
//      at the 80% threshold.
//   4. aggregateLast7Days: returns 7 day buckets, oldest first, UTC.
//   5. purgeOlderThan: delete query shape (lt called_at + count exact).

import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROACHING_CEILING_PCT,
  BROWSE_DAILY_CEILING,
  aggregateLast24h,
  aggregateLast7Days,
  logBrowseCall,
  purgeOlderThan,
} from "../telemetry/browse-calls.ts";

// ---------------------------------------------------------------------------
// Lightweight Supabase client stub. The lib uses only .from(table).insert,
// .from(table).select.gte, .from(table).delete.lt — so we model just those.
// ---------------------------------------------------------------------------
type CallLog = { method: string; args: unknown[] };

function stubClient(opts: {
  selectRows?: unknown[];
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
  deleteCount?: number;
  deleteError?: { message: string } | null;
} = {}) {
  const calls: CallLog[] = [];
  const select = {
    gte(_col: string, _val: string) {
      calls.push({ method: "select.gte", args: [_col, _val] });
      return Promise.resolve({
        data: opts.selectRows ?? [],
        error: opts.selectError ?? null,
      });
    },
  };
  const builder = {
    insert(row: unknown) {
      calls.push({ method: "insert", args: [row] });
      return Promise.resolve({ error: opts.insertError ?? null });
    },
    select(_cols: string) {
      calls.push({ method: "select", args: [_cols] });
      return select;
    },
    delete(args: { count?: string }) {
      calls.push({ method: "delete", args: [args] });
      return {
        lt(_col: string, _val: string) {
          calls.push({ method: "delete.lt", args: [_col, _val] });
          return Promise.resolve({
            error: opts.deleteError ?? null,
            count: opts.deleteCount ?? 0,
          });
        },
      };
    },
  };
  const client = {
    from(_t: string) {
      calls.push({ method: "from", args: [_t] });
      return builder;
    },
  };
  // The SupabaseClient type is too broad to satisfy structurally without
  // ts-ignore; cast through unknown.
  // Cast through unknown — our stub doesn't implement the full SupabaseClient
  // surface, just the chains the lib actually exercises.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

test("logBrowseCall: ok:true on a clean insert", async () => {
  const { client, calls } = stubClient();
  const out = await logBrowseCall({ surface: "page_render", success: true, latency_ms: 120 }, { client });
  assert.equal(out.ok, true);
  // .from("browse_calls").insert({...})
  assert.ok(calls.find((c) => c.method === "from" && c.args[0] === "browse_calls"));
  const insert = calls.find((c) => c.method === "insert");
  assert.ok(insert);
  assert.deepEqual(insert.args[0], { surface: "page_render", success: true, latency_ms: 120 });
});

test("logBrowseCall: ok:false on insert error, includes message", async () => {
  const { client } = stubClient({ insertError: { message: "permission_denied" } });
  const out = await logBrowseCall({ surface: "wishlist_cron", success: false, latency_ms: 999 }, { client });
  assert.equal(out.ok, false);
  assert.equal(out.error, "permission_denied");
});

test("logBrowseCall: never throws on a synchronous-throw from the client", async () => {
  const angryClient = {
    from() {
      throw new Error("supabase blew up");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const out = await logBrowseCall({ surface: "manual", success: true, latency_ms: 1 }, { client: angryClient });
  assert.equal(out.ok, false);
  assert.match(out.error ?? "", /supabase blew up/);
});

test("aggregateLast24h: totals + per-surface counts + success rate math", async () => {
  const { client } = stubClient({
    selectRows: [
      { surface: "page_render", success: true },
      { surface: "page_render", success: true },
      { surface: "page_render", success: false },
      { surface: "wishlist_cron", success: true },
      { surface: "manual", success: true },
    ],
  });
  const out = await aggregateLast24h({ client });
  assert.equal(out.total, 5);
  assert.deepEqual(out.byCounts, { page_render: 3, wishlist_cron: 1, manual: 1 });
  assert.equal(out.successCount, 4);
  assert.equal(out.successRatePct, 80); // 4/5 = 80%
});

test("aggregateLast24h: pctOfCeiling + approachingCeiling=true at the 80% threshold", async () => {
  // Build a row set with exactly 80% of the daily ceiling.
  const target = Math.round((APPROACHING_CEILING_PCT / 100) * BROWSE_DAILY_CEILING);
  const rows: Array<{ surface: "page_render" | "wishlist_cron"; success: boolean }> =
    Array.from({ length: target }, (_, i) => ({
      surface: i % 2 === 0 ? "page_render" : "wishlist_cron",
      success: true,
    }));
  const { client } = stubClient({ selectRows: rows });
  const out = await aggregateLast24h({ client });
  assert.equal(out.total, target);
  assert.equal(out.approachingCeiling, true);
  assert.ok(out.pctOfCeiling >= APPROACHING_CEILING_PCT);
});

test("aggregateLast24h: approachingCeiling=false below the threshold", async () => {
  const below = Math.round((APPROACHING_CEILING_PCT / 100) * BROWSE_DAILY_CEILING) - 1;
  const rows = Array.from({ length: below }, () => ({ surface: "page_render" as const, success: true }));
  const { client } = stubClient({ selectRows: rows });
  const out = await aggregateLast24h({ client });
  assert.equal(out.approachingCeiling, false);
});

test("aggregateLast24h: returns zeroed shape on query error", async () => {
  const { client } = stubClient({ selectError: { message: "db_down" } });
  const out = await aggregateLast24h({ client });
  assert.equal(out.total, 0);
  assert.equal(out.successRatePct, 100); // empty → "no failures yet"
  assert.equal(out.approachingCeiling, false);
});

test("aggregateLast7Days: returns 7 day buckets, oldest first, UTC ISO date keys", async () => {
  const now = new Date("2026-05-24T20:00:00.000Z");
  const { client } = stubClient({
    selectRows: [
      // 3 rows on 2026-05-24
      { called_at: "2026-05-24T01:00:00.000Z" },
      { called_at: "2026-05-24T12:00:00.000Z" },
      { called_at: "2026-05-24T20:00:00.000Z" },
      // 1 row on 2026-05-23
      { called_at: "2026-05-23T12:00:00.000Z" },
      // 1 row on 2026-05-19 (oldest in window)
      { called_at: "2026-05-19T08:00:00.000Z" },
      // 1 row outside the window — ignored
      { called_at: "2026-04-01T00:00:00.000Z" },
    ],
  });
  const out = await aggregateLast7Days({ client, now });
  assert.equal(out.daily.length, 7);
  // Oldest first.
  assert.equal(out.daily[0].date, "2026-05-18");
  assert.equal(out.daily[6].date, "2026-05-24");
  // Bucketing.
  assert.equal(out.daily[6].total, 3); // 2026-05-24
  assert.equal(out.daily[5].total, 1); // 2026-05-23
  assert.equal(out.daily[1].total, 1); // 2026-05-19
  // Days with no rows = 0
  assert.equal(out.daily[2].total, 0); // 2026-05-20
});

test("purgeOlderThan: emits a delete .lt called_at <cutoff> with count exact", async () => {
  const { client, calls } = stubClient({ deleteCount: 17 });
  const now = new Date("2026-05-24T00:00:00.000Z");
  const out = await purgeOlderThan(90, { client, now });
  assert.equal(out.ok, true);
  assert.equal(out.deletedApprox, 17);
  const delCall = calls.find((c) => c.method === "delete");
  assert.ok(delCall);
  assert.deepEqual(delCall.args[0], { count: "exact" });
  const ltCall = calls.find((c) => c.method === "delete.lt");
  assert.ok(ltCall);
  assert.equal(ltCall.args[0], "called_at");
  // cutoff = now - 90d
  const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(ltCall.args[1], expectedCutoff);
});

test("purgeOlderThan: ok:false propagates the error", async () => {
  const { client } = stubClient({ deleteError: { message: "fk_violation" } });
  const out = await purgeOlderThan(90, { client });
  assert.equal(out.ok, false);
  assert.equal(out.error, "fk_violation");
});
