// Contract tests for the shared Discord webhook poster (ADR-014). Pins:
//   1. Soft-fail — every failure path returns ok:false instead of throwing.
//   2. 429 + 5xx trigger retry with backoff (we test that retry happens,
//      not the exact timing).
//   3. maskEmail produces the safe form for #subscribers embeds.
//   4. postError/postSubscriberJoined send the expected embed shape.
//   5. The poster never touches the network when no URL is provided.

import test from "node:test";
import assert from "node:assert/strict";
import {
  maskEmail,
  postError,
  postSubscriberJoined,
  postWebhook,
} from "../notifications/discord.ts";

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

test("postWebhook returns ok:false when webhookUrl is empty", async () => {
  const result = await postWebhook({ webhookUrl: "", content: "hi" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "missing_webhook_url");
});

test("postWebhook returns ok:false when payload is empty", async () => {
  const result = await postWebhook({ webhookUrl: "https://x.test/wh" });
  assert.equal(result.ok, false);
});

test("postWebhook POSTs to the URL with username + content + JSON content-type", async () => {
  const { fetch, calls } = fakeFetch([new Response(null, { status: 204 })]);
  const result = await postWebhook({
    webhookUrl: "https://discord.com/api/webhooks/1/abc",
    content: "hello",
    fetchImpl: fetch,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://discord.com/api/webhooks/1/abc");
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], "application/json");
  const body = JSON.parse(calls[0].init.body as string) as { username: string; content: string };
  assert.equal(body.username, "Foil Ops");
  assert.equal(body.content, "hello");
});

test("postWebhook retries on 429 then succeeds", async () => {
  const { fetch, calls } = fakeFetch([
    new Response(JSON.stringify({ retry_after: 0.05 }), { status: 429 }),
    new Response(null, { status: 204 }),
  ]);
  const result = await postWebhook({
    webhookUrl: "https://x.test/wh",
    content: "retry me",
    fetchImpl: fetch,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
});

test("postWebhook retries on 503 then gives up after 3 attempts", async () => {
  const { fetch, calls } = fakeFetch([
    new Response("oops", { status: 503 }),
    new Response("oops", { status: 503 }),
    new Response("oops", { status: 503 }),
  ]);
  const result = await postWebhook({
    webhookUrl: "https://x.test/wh",
    content: "retry me hard",
    fetchImpl: fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 3);
});

test("postWebhook does NOT retry on 4xx other than 429", async () => {
  const { fetch, calls } = fakeFetch([new Response("nope", { status: 400 })]);
  const result = await postWebhook({
    webhookUrl: "https://x.test/wh",
    content: "fail",
    fetchImpl: fetch,
  });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 1);
});

test("postWebhook soft-fails when fetch throws (returns ok:false, no rethrow)", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const result = await postWebhook({
    webhookUrl: "https://x.test/wh",
    content: "fail",
    fetchImpl,
  });
  assert.equal(result.ok, false);
});

test("maskEmail masks the local part except first char", () => {
  assert.equal(maskEmail("john.craig@gmail.com"), "j***@gmail.com");
  assert.equal(maskEmail("a@x.co"), "a@x.co");
  assert.equal(maskEmail("a@b.com"), "a@b.com");
  assert.equal(maskEmail("aa@b.com"), "a***@b.com");
});

test("maskEmail handles malformed input safely", () => {
  assert.equal(maskEmail(""), "***");
  assert.equal(maskEmail("no-at-sign"), "***");
  assert.equal(maskEmail("@no-local"), "***");
});

test("maskEmail lowercases + trims", () => {
  assert.equal(maskEmail("  JOHN@Example.COM  "), "j***@example.com");
});

test("postSubscriberJoined embeds a masked email + source + active count", async () => {
  const { fetch, calls } = fakeFetch([new Response(null, { status: 204 })]);
  await postSubscriberJoined(
    "https://x.test/wh",
    { email: "alice@example.com", source: "blog-foo", activeCount: 42 },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(calls[0].init.body as string) as {
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
  };
  const fields = body.embeds[0].fields;
  const findField = (name: string) => fields.find((f) => f.name === name)?.value;
  assert.equal(findField("Email"), "a***@example.com");
  assert.equal(findField("Source"), "blog-foo");
  assert.equal(findField("Active total"), "42");
});

test("postSubscriberJoined omits active count when null", async () => {
  const { fetch, calls } = fakeFetch([new Response(null, { status: 204 })]);
  await postSubscriberJoined(
    "https://x.test/wh",
    { email: "x@y.co", source: null, activeCount: null },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(calls[0].init.body as string) as {
    embeds: Array<{ fields: Array<{ name: string }> }>;
  };
  const names = body.embeds[0].fields.map((f) => f.name);
  assert.ok(!names.includes("Active total"));
});

test("postError wraps message in a code block + includes runUrl when provided", async () => {
  const { fetch, calls } = fakeFetch([new Response(null, { status: 204 })]);
  await postError(
    "https://x.test/wh",
    {
      source: "subscribe-action",
      errorType: "BeehiivApiError",
      message: "all your base are belong to us",
      context: { slug: "test", attempts: 3 },
      runUrl: "https://github.com/foo/bar/actions/runs/123",
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(calls[0].init.body as string) as {
    embeds: Array<{
      description: string;
      fields: Array<{ name: string; value: string }>;
    }>;
  };
  const embed = body.embeds[0];
  assert.ok(embed.description.startsWith("```"));
  assert.ok(embed.description.includes("all your base"));
  const fields = embed.fields.map((f) => ({ [f.name]: f.value }));
  assert.ok(fields.some((f) => f.Type === "BeehiivApiError"));
  assert.ok(fields.some((f) => f.Run?.includes("github.com")));
});
