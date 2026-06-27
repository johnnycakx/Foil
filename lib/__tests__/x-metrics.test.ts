// X post-metrics capture tests (ADR-071 follow-up, Part 2). Covers the metrics
// fetch (parse public_metrics + detect deleted tweets) and the run logic
// (records present, marks missing deleted, idempotent, soft-fails on fetch
// error). Store + fetch are injected — no Supabase, no live X API.

import test from "node:test";
import assert from "node:assert/strict";
import { fetchTweetPublicMetrics, type XCredentials, type FetchTweetMetricsResult } from "../social/x-client.ts";
import { processMetricsRun, InMemoryMetricsStore } from "../social/metrics.ts";

const CREDS: XCredentials = { apiKey: "k", apiSecret: "s", accessToken: "t", accessSecret: "a" };

// --- fetchTweetPublicMetrics ---

test("fetchTweetPublicMetrics: parses public_metrics + flags deleted (missing) ids", async () => {
  let calledUrl = "";
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calledUrl = url;
    // OAuth 1.0a auth header must be present (signing ran).
    assert.match((init.headers as Record<string, string>).Authorization, /^OAuth /);
    return new Response(
      JSON.stringify({
        data: [
          { id: "111", public_metrics: { like_count: 5, retweet_count: 2, reply_count: 1, quote_count: 0, impression_count: 300 } },
        ],
        errors: [{ resource_id: "222" }],
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const res = await fetchTweetPublicMetrics(["111", "222"], { credentials: CREDS, fetchImpl });
  assert.ok(res.ok);
  if (res.ok) {
    assert.match(calledUrl, /\/2\/tweets\?ids=111%2C222&tweet\.fields=public_metrics/, "ids + fields in the query");
    assert.deepEqual(res.metrics.get("111"), { tweetId: "111", likes: 5, reposts: 2, replies: 1, quotes: 0, impressions: 300 });
    assert.deepEqual(res.missing, ["222"], "a tweet absent from data is reported missing (deleted)");
  }
});

test("fetchTweetPublicMetrics: impression_count absent → impressions null", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ data: [{ id: "1", public_metrics: { like_count: 1, retweet_count: 0, reply_count: 0, quote_count: 0 } }] }), { status: 200 })
  ) as unknown as typeof fetch;
  const res = await fetchTweetPublicMetrics(["1"], { credentials: CREDS, fetchImpl });
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.metrics.get("1")?.impressions, null);
});

test("fetchTweetPublicMetrics: missing creds soft-fails; empty ids is a clean no-op", async () => {
  const noCreds = await fetchTweetPublicMetrics(["1"], { credentials: undefined });
  if (process.env.X_API_KEY) {
    // a dev with real creds loaded — skip the creds-absent assertion
  } else {
    assert.equal(noCreds.ok, false);
  }
  const empty = await fetchTweetPublicMetrics([], { credentials: CREDS });
  assert.ok(empty.ok);
  if (empty.ok) assert.equal(empty.metrics.size, 0);
});

// --- processMetricsRun ---

function metricsResult(present: Record<string, number>[], missing: string[]): FetchTweetMetricsResult {
  const m = new Map();
  for (const p of present) m.set(String(p.id), { tweetId: String(p.id), likes: p.like, reposts: p.rt, replies: p.rep, quotes: p.q, impressions: p.imp ?? null });
  return { ok: true, metrics: m, missing };
}

test("processMetricsRun: records present posts, marks missing deleted", async () => {
  const store = new InMemoryMetricsStore();
  store.seedPending([
    { draftId: "d1", tweetId: "111", angle: "deal_of_day" },
    { draftId: "d2", tweetId: "222", angle: "educational" },
  ]);
  const res = await processMetricsRun({
    store,
    fetchMetrics: async () => metricsResult([{ id: 111, like: 5, rt: 2, rep: 1, q: 0, imp: 300 }], ["222"]),
  });
  assert.deepEqual(res, { ok: true, pending: 2, recorded: 1, deleted: 1 });
  assert.equal(store.recorded.length, 1);
  assert.equal(store.recorded[0].draftId, "d1");
  assert.equal(store.recorded[0].likes, 5);
  assert.equal(store.deleted[0].draftId, "d2");
});

test("processMetricsRun: a second pass is a no-op (already captured)", async () => {
  const store = new InMemoryMetricsStore();
  store.seedPending([{ draftId: "d1", tweetId: "111", angle: "deal_of_day" }]);
  await processMetricsRun({ store, fetchMetrics: async () => metricsResult([{ id: 111, like: 1, rt: 0, rep: 0, q: 0 }], []) });
  const second = await processMetricsRun({ store, fetchMetrics: async () => metricsResult([{ id: 111, like: 9, rt: 9, rep: 9, q: 9 }], []) });
  assert.deepEqual(second, { ok: true, pending: 0, recorded: 0, deleted: 0 });
  assert.equal(store.recorded.length, 1, "no duplicate metrics row");
});

test("processMetricsRun: empty pending is a clean no-op (no fetch)", async () => {
  const store = new InMemoryMetricsStore();
  let fetched = false;
  const res = await processMetricsRun({ store, fetchMetrics: async () => { fetched = true; return metricsResult([], []); } });
  assert.deepEqual(res, { ok: true, pending: 0, recorded: 0, deleted: 0 });
  assert.equal(fetched, false, "must not call the X API when there's nothing to capture");
});

test("processMetricsRun: a fetch failure soft-fails the run, records nothing", async () => {
  const store = new InMemoryMetricsStore();
  store.seedPending([{ draftId: "d1", tweetId: "111", angle: "deal_of_day" }]);
  const res = await processMetricsRun({ store, fetchMetrics: async () => ({ ok: false, error: "tweets_lookup_http_429" }) });
  assert.equal(res.ok, false);
  assert.equal(res.error, "tweets_lookup_http_429");
  assert.equal(store.recorded.length, 0);
  assert.equal(store.deleted.length, 0);
});
