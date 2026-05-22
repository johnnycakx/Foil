// Bot's Beehiiv REST tools. Mocked fetch so we verify endpoint shape +
// auth header + output formatting without touching the live API.

import test from "node:test";
import assert from "node:assert/strict";
import { executeTool } from "../tools/index.ts";

type CapturedRequest = { url: string; init: RequestInit };

function withFakeFetch<T>(
  responses: Array<Response | (() => Response)>,
  fn: (calls: CapturedRequest[]) => Promise<T>,
): Promise<T> {
  const calls: CapturedRequest[] = [];
  let i = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === "string" ? url : url.toString(), init: init ?? {} });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === "function" ? r() : r;
  }) as typeof fetch;
  return fn(calls).finally(() => {
    globalThis.fetch = original;
  });
}

const PUB_ID = "pub_8bc42240-1964-4252-b798-7e0a6f135526";
process.env.BEEHIIV_PUBLICATION_ID = PUB_ID;
process.env.BEEHIIV_API_KEY = "test_key";

test("beehiiv_list_subscriptions hits the subscriptions endpoint with Bearer auth", async () => {
  await withFakeFetch(
    [
      new Response(
        JSON.stringify({
          data: [
            { email: "alice@example.com", status: "active", created: 1779000000, utm_source: "blog" },
          ],
          total_results: 14,
        }),
        { status: 200 },
      ),
    ],
    async (calls) => {
      const out = await executeTool("beehiiv_list_subscriptions", { limit: 5 });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes(`/v2/publications/${PUB_ID}/subscriptions`));
      assert.ok(calls[0].url.includes("status=active"));
      assert.ok(calls[0].url.includes("limit=5"));
      const headers = calls[0].init.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer test_key");
      assert.ok(out.includes("14 subscribers"));
      assert.ok(out.includes("a***@example.com"));
    },
  );
});

test("beehiiv_list_subscriptions: status defaults to 'active' when omitted", async () => {
  await withFakeFetch(
    [
      new Response(
        JSON.stringify({ data: [], total_results: 0 }),
        { status: 200 },
      ),
    ],
    async (calls) => {
      await executeTool("beehiiv_list_subscriptions", {});
      assert.ok(calls[0].url.includes("status=active"));
    },
  );
});

test("beehiiv_list_subscriptions: masks the email local part", async () => {
  await withFakeFetch(
    [
      new Response(
        JSON.stringify({
          data: [{ email: "longname@example.com", status: "active", created: 1779000000 }],
          total_results: 1,
        }),
        { status: 200 },
      ),
    ],
    async () => {
      const out = await executeTool("beehiiv_list_subscriptions", {});
      // First char preserved, rest masked
      assert.ok(out.includes("l***@example.com"));
      assert.ok(!out.includes("longname@example.com"));
    },
  );
});

test("beehiiv_list_subscriptions: returns clean error on Beehiiv non-2xx", async () => {
  await withFakeFetch(
    [new Response("unauthorized", { status: 401 })],
    async () => {
      const out = await executeTool("beehiiv_list_subscriptions", {});
      assert.ok(out.startsWith("Error:"));
      assert.ok(out.includes("401"));
    },
  );
});

test("beehiiv_get_publication_stats expands stats on the publication", async () => {
  await withFakeFetch(
    [
      new Response(
        JSON.stringify({
          data: {
            name: "Foil",
            stats: { active_subscriptions: 14, total_subscriptions: 27 },
          },
        }),
        { status: 200 },
      ),
    ],
    async (calls) => {
      const out = await executeTool("beehiiv_get_publication_stats", {});
      assert.ok(calls[0].url.includes(`/v2/publications/${PUB_ID}`));
      assert.ok(calls[0].url.includes("expand"));
      assert.ok(out.includes("Foil"));
      assert.ok(out.includes("Active subscriptions: 14"));
      assert.ok(out.includes("Total subscriptions: 27"));
    },
  );
});

test("beehiiv_list_posts defaults to status=draft", async () => {
  await withFakeFetch(
    [
      new Response(
        JSON.stringify({
          data: [{ id: "post_abc1234567890", title: "Test draft", created: 1779000000 }],
          total_results: 1,
        }),
        { status: 200 },
      ),
    ],
    async (calls) => {
      const out = await executeTool("beehiiv_list_posts", {});
      assert.ok(calls[0].url.includes("status=draft"));
      assert.ok(out.includes("Test draft"));
      assert.ok(out.includes("post_abc1234")); // handler slices to 12 chars
    },
  );
});

test("beehiiv_list_posts: status passes through (e.g. 'published')", async () => {
  await withFakeFetch(
    [new Response(JSON.stringify({ data: [], total_results: 0 }), { status: 200 })],
    async (calls) => {
      await executeTool("beehiiv_list_posts", { status: "published" });
      assert.ok(calls[0].url.includes("status=published"));
    },
  );
});

test("beehiiv tools cap limit at 25 even if caller asks for more", async () => {
  await withFakeFetch(
    [new Response(JSON.stringify({ data: [], total_results: 0 }), { status: 200 })],
    async (calls) => {
      await executeTool("beehiiv_list_subscriptions", { limit: 500 });
      assert.ok(calls[0].url.includes("limit=25"));
    },
  );
});

test("Beehiiv tools error cleanly when credentials are missing", async () => {
  const savedKey = process.env.BEEHIIV_API_KEY;
  delete process.env.BEEHIIV_API_KEY;
  try {
    const out = await executeTool("beehiiv_list_subscriptions", {});
    assert.ok(out.includes("BEEHIIV_API_KEY"));
  } finally {
    process.env.BEEHIIV_API_KEY = savedKey;
  }
});
