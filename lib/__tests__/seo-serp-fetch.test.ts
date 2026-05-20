// SERP fetcher contract — focus on the graceful-degradation properties.
// The whole autonomy story depends on this never crashing the weekly run.

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOutlineFromHtml,
  fetchSerpContext,
  memoryCache,
  renderSerpContextPrompt,
  type Fetcher,
} from "../seo/serp-fetch.ts";

function okResponse(body: string, json?: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => json ?? JSON.parse(body),
  };
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    text: async () => "",
    json: async () => ({}),
  };
}

const SAMPLE_HTML = `<html>
  <head><title>How to Price Pokemon Cards | PokeScope</title></head>
  <body>
    <h1>Top H1 (excluded — only H2/H3)</h1>
    <h2>Reading the set symbol</h2>
    <h3>The "active listing" trap</h3>
    <h2>When to grade your card</h2>
  </body>
</html>`;

test("extractOutlineFromHtml pulls H2/H3 via cheerio", () => {
  const outline = extractOutlineFromHtml("https://example.com/x", SAMPLE_HTML);
  assert.equal(outline.title, "How to Price Pokemon Cards | PokeScope");
  // No H1 in the outline — only H2/H3
  assert.deepEqual(
    outline.headings.map((h) => `${h.level}:${h.text}`),
    ["2:Reading the set symbol", `3:The "active listing" trap`, "2:When to grade your card"],
  );
});

test("fetchSerpContext degrades gracefully when API key is missing", async () => {
  const ctx = await fetchSerpContext("test query", undefined, { fetcher: (() => Promise.reject(new Error("should not be called"))) as Fetcher });
  assert.equal(ctx.degraded, true);
  assert.ok(ctx.degradationReason?.includes("BRAVE_SEARCH_API_KEY"));
  assert.deepEqual(ctx.topResults, []);
});

test("fetchSerpContext degrades on Brave Search HTTP error (rate-limit, auth, etc.)", async () => {
  const fetcher: Fetcher = async () => errorResponse(429);
  const ctx = await fetchSerpContext("rate limited", "fake-key", { fetcher });
  assert.equal(ctx.degraded, true);
  assert.ok(ctx.degradationReason?.includes("429"));
});

test("fetchSerpContext returns top results + outlines on the happy path", async () => {
  const bravePayload = {
    web: {
      results: [
        { url: "https://a.com/", title: "A", description: "desc A" },
        { url: "https://b.com/", title: "B", description: "desc B" },
      ],
    },
  };
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (url.includes("brave.com")) return okResponse(JSON.stringify(bravePayload), bravePayload);
    if (url.startsWith("https://a.com")) return okResponse(SAMPLE_HTML);
    if (url.startsWith("https://b.com")) return okResponse(SAMPLE_HTML);
    throw new Error(`unexpected ${url}`);
  };

  const ctx = await fetchSerpContext("test", "fake-key", { fetcher, scrapeTopN: 2 });
  assert.equal(ctx.degraded, false);
  assert.equal(ctx.topResults.length, 2);
  assert.equal(ctx.topOutlines.length, 2);
  assert.equal(ctx.topOutlines[0].headings.length, 3);
});

test("fetchSerpContext degrades but still returns data when a scrape fails", async () => {
  const bravePayload = {
    web: { results: [{ url: "https://blocked.com/", title: "X", description: "" }] },
  };
  const fetcher: Fetcher = async (url) => {
    if (url.includes("brave.com")) return okResponse(JSON.stringify(bravePayload), bravePayload);
    return errorResponse(503); // scrape blocked
  };

  const ctx = await fetchSerpContext("test", "fake-key", { fetcher, scrapeTopN: 1 });
  assert.equal(ctx.degraded, true);
  // We still got the SERP row even though the scrape failed — the engine
  // can still use the title/snippet, just not the outline.
  assert.equal(ctx.topResults.length, 1);
  assert.equal(ctx.topOutlines.length, 0);
});

test("fetchSerpContext serves from cache on second call within TTL", async () => {
  const cache = memoryCache();
  const bravePayload = { web: { results: [{ url: "https://x.com/", title: "X", description: "" }] } };
  let callCount = 0;
  const fetcher: Fetcher = async (url) => {
    callCount++;
    if (url.includes("brave.com")) return okResponse(JSON.stringify(bravePayload), bravePayload);
    return okResponse(SAMPLE_HTML);
  };

  await fetchSerpContext("cached query", "fake-key", { fetcher, cache, scrapeTopN: 1 });
  const firstCallCount = callCount;
  await fetchSerpContext("cached query", "fake-key", { fetcher, cache, scrapeTopN: 1 });
  assert.equal(callCount, firstCallCount, "second call should hit cache, not fetcher");
});

test("renderSerpContextPrompt produces a compact prompt block on happy path", () => {
  const ctx = {
    query: "pokemon card pricing",
    topResults: [
      { url: "https://a.com/", title: "Result A", snippet: "snippet A" },
      { url: "https://b.com/", title: "Result B", snippet: "snippet B" },
    ],
    topOutlines: [
      { url: "https://a.com/", title: "A", headings: [{ level: 2 as const, text: "H2 from A" }] },
    ],
    degraded: false,
  };
  const out = renderSerpContextPrompt(ctx);
  assert.ok(out.includes("Top 2 Google results"));
  assert.ok(out.includes("Result A"));
  assert.ok(out.includes("https://a.com/"));
  assert.ok(out.includes("H2: H2 from A"));
});

test("renderSerpContextPrompt emits 'unavailable' copy when fully degraded", () => {
  const ctx = {
    query: "q",
    topResults: [],
    topOutlines: [],
    degraded: true,
    degradationReason: "API key missing",
  };
  const out = renderSerpContextPrompt(ctx);
  assert.ok(out.includes("SERP context unavailable"));
  assert.ok(out.includes("API key missing"));
});
