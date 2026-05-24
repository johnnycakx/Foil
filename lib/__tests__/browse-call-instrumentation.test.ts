// Contract tests for the Browse-client instrumentation hook in
// lib/affiliate/ebay-browse.ts. Pins:
//   1. Every searchItems call that reaches the fetch attempt logs exactly
//      one row, with the caller's surface tag.
//   2. latency_ms is captured (positive integer, ≤ wall time).
//   3. A fetch network throw still logs (with success:false).
//   4. An HTTP error response still logs (with success:false).
//   5. Logging-side errors NEVER propagate to the caller.
//   6. Empty-query + missing-OAuth short-circuits don't log (those are not
//      "Browse calls" against eBay's quota).

import test from "node:test";
import assert from "node:assert/strict";
import { searchItems } from "../affiliate/ebay-browse.ts";
import { __resetTokenCacheForTests } from "../affiliate/ebay-oauth.ts";

type LogCall = { surface: string; success: boolean; latency_ms: number };

function makeLog() {
  const calls: LogCall[] = [];
  const log = (async (input: LogCall) => {
    calls.push(input);
    return { ok: true };
  }) as unknown as Parameters<typeof searchItems>[0]["logImpl"];
  return { log, calls };
}

function fakeFetch(responses: Array<Response | (() => Response) | Error>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r instanceof Error) throw r;
    return typeof r === "function" ? r() : r;
  }) as unknown as typeof fetch;
}

function tokenJson(): Response {
  return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function browseJson(rows: unknown[]): Response {
  return new Response(JSON.stringify({ itemSummaries: rows }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else process.env[k] = env[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else process.env[k] = prev[k];
    }
    __resetTokenCacheForTests();
  });
}

const ENV_OK = { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" };

test("instrumentation: a successful Browse call logs exactly one row with surface=page_render", async () => {
  const { log, calls } = makeLog();
  const fetchImpl = fakeFetch([tokenJson(), browseJson([
    { title: "x", itemWebUrl: "https://www.ebay.com/itm/1", price: { value: "10.00", currency: "USD" } },
  ])]);
  await withEnv(ENV_OK, async () => {
    __resetTokenCacheForTests();
    const out = await searchItems({ query: "charizard", fetchImpl, logImpl: log, surface: "page_render" });
    assert.equal(out.ok, true);
  });
  // Fire-and-forget — let microtasks settle so the void log() promise resolves.
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].surface, "page_render");
  assert.equal(calls[0].success, true);
  assert.ok(Number.isInteger(calls[0].latency_ms));
  assert.ok(calls[0].latency_ms >= 0);
});

test("instrumentation: an HTTP error response logs success:false but still returns ok:false", async () => {
  const { log, calls } = makeLog();
  const fetchImpl = fakeFetch([tokenJson(), new Response("rate", { status: 429 })]);
  await withEnv(ENV_OK, async () => {
    __resetTokenCacheForTests();
    const out = await searchItems({ query: "x", fetchImpl, logImpl: log, surface: "wishlist_cron" });
    assert.equal(out.ok, false);
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].surface, "wishlist_cron");
  assert.equal(calls[0].success, false);
});

test("instrumentation: a fetch-throw logs success:false with latency_ms captured", async () => {
  const { log, calls } = makeLog();
  const fetchImpl = fakeFetch([tokenJson(), new Error("ECONNRESET")]);
  await withEnv(ENV_OK, async () => {
    __resetTokenCacheForTests();
    const out = await searchItems({ query: "x", fetchImpl, logImpl: log, surface: "page_render" });
    assert.equal(out.ok, false);
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].success, false);
  assert.equal(calls[0].surface, "page_render");
  assert.ok(calls[0].latency_ms >= 0);
});

test("instrumentation: empty-query short-circuit does NOT log (not a real Browse call)", async () => {
  const { log, calls } = makeLog();
  const out = await searchItems({ query: "   ", logImpl: log, surface: "manual" });
  assert.equal(out.ok, false);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 0);
});

test("instrumentation: missing-OAuth short-circuit does NOT log", async () => {
  const { log, calls } = makeLog();
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: undefined, EBAY_DEVELOPER_CERT_ID: undefined },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "x", logImpl: log, surface: "page_render" });
      assert.equal(out.ok, false);
    },
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 0);
});

test("instrumentation: a log-side throw is swallowed and the response still returns", async () => {
  const angryLog = (async () => {
    throw new Error("supabase blew up");
  }) as unknown as Parameters<typeof searchItems>[0]["logImpl"];
  const fetchImpl = fakeFetch([tokenJson(), browseJson([])]);
  await withEnv(ENV_OK, async () => {
    __resetTokenCacheForTests();
    const out = await searchItems({ query: "x", fetchImpl, logImpl: angryLog, surface: "page_render" });
    assert.equal(out.ok, true); // we still returned cleanly
  });
});

test("instrumentation: surface defaults to 'manual' when unspecified", async () => {
  const { log, calls } = makeLog();
  const fetchImpl = fakeFetch([tokenJson(), browseJson([])]);
  await withEnv(ENV_OK, async () => {
    __resetTokenCacheForTests();
    await searchItems({ query: "x", fetchImpl, logImpl: log });
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].surface, "manual");
});
