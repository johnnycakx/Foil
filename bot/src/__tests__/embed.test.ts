// Contract tests for bot/src/embed.ts. Verifies:
//   1. POSTs to https://api.openai.com/v1/embeddings with Bearer auth.
//   2. Sends model=text-embedding-3-small + input=<text>.
//   3. Returns the 1536-dim array.
//   4. Caches by content hash (second call with identical text → no fetch).
//   5. Throws on missing API key, non-2xx, malformed body.

import test from "node:test";
import assert from "node:assert/strict";
import { __clearEmbedCache, embedText } from "../embed.ts";

type CapturedRequest = { url: string; init: RequestInit };

function fakeFetch(responses: Array<Response | (() => Response)>): {
  fetch: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === "string" ? url : url.toString(), init: init ?? {} });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === "function" ? r() : r;
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function makeEmbedding(seed: number): number[] {
  // Deterministic 1536-dim test vector. Different `seed` → different vector.
  return Array.from({ length: 1536 }, (_, i) => Math.sin(seed + i / 100));
}

test("embedText POSTs to OpenAI with Bearer auth + correct payload", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch, calls } = fakeFetch([
    new Response(JSON.stringify({ data: [{ embedding: makeEmbedding(1) }] }), { status: 200 }),
  ]);
  const vec = await embedText("hello world", { fetchImpl: fetch });
  assert.equal(vec.length, 1536);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/embeddings");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sk-test-key");
  const body = JSON.parse(calls[0].init.body as string) as { model: string; input: string };
  assert.equal(body.model, "text-embedding-3-small");
  assert.equal(body.input, "hello world");
});

test("embedText caches by content hash (no second fetch for same input)", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch, calls } = fakeFetch([
    new Response(JSON.stringify({ data: [{ embedding: makeEmbedding(2) }] }), { status: 200 }),
  ]);
  const a = await embedText("identical input", { fetchImpl: fetch });
  const b = await embedText("identical input", { fetchImpl: fetch });
  assert.deepEqual(a, b);
  assert.equal(calls.length, 1, `expected 1 fetch for identical inputs, got ${calls.length}`);
});

test("embedText DOES fetch again for different input", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch, calls } = fakeFetch([
    new Response(JSON.stringify({ data: [{ embedding: makeEmbedding(3) }] }), { status: 200 }),
    new Response(JSON.stringify({ data: [{ embedding: makeEmbedding(4) }] }), { status: 200 }),
  ]);
  await embedText("input A", { fetchImpl: fetch });
  await embedText("input B", { fetchImpl: fetch });
  assert.equal(calls.length, 2);
});

test("embedText throws on missing OPENAI_API_KEY", async () => {
  delete process.env.OPENAI_API_KEY;
  __clearEmbedCache();
  await assert.rejects(() => embedText("anything"));
  process.env.OPENAI_API_KEY = "sk-test-key"; // restore for following tests
});

test("embedText throws on empty input", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  await assert.rejects(() => embedText(""));
  await assert.rejects(() => embedText("   "));
});

test("embedText throws on non-2xx response", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch } = fakeFetch([new Response("rate limited", { status: 429 })]);
  await assert.rejects(() => embedText("x", { fetchImpl: fetch }));
});

test("embedText throws on malformed body (missing embedding)", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch } = fakeFetch([new Response(JSON.stringify({ data: [{}] }), { status: 200 })]);
  await assert.rejects(() => embedText("x", { fetchImpl: fetch }));
});

test("embedText throws on wrong-dim embedding", async () => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  __clearEmbedCache();
  const { fetch } = fakeFetch([
    new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }), { status: 200 }),
  ]);
  await assert.rejects(() => embedText("x", { fetchImpl: fetch }));
});
