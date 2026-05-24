// Contract tests for the eBay OAuth client_credentials helper.
//   1. POST to api.ebay.com/identity/v1/oauth2/token with Basic auth from
//      base64(APP_ID:CERT_ID) and the documented urlencoded body.
//   2. access_token + expires_in are parsed; cache stores expiresAt = now +
//      ttl, returned token is the parsed value.
//   3. Cache reuse: a second call within TTL never hits the network.
//   4. Refresh when < 60s remain.
//   5. Soft-fail on missing creds / 4xx / 5xx / network throw / bad JSON.

import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetTokenCacheForTests,
  getAccessToken,
} from "../affiliate/ebay-oauth.ts";

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

function tokenResponse(body: {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withEnv(
  env: Partial<Record<"EBAY_DEVELOPER_APP_ID" | "EBAY_DEVELOPER_CERT_ID", string | undefined>>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const prev = {
    EBAY_DEVELOPER_APP_ID: process.env.EBAY_DEVELOPER_APP_ID,
    EBAY_DEVELOPER_CERT_ID: process.env.EBAY_DEVELOPER_CERT_ID,
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(prev) as Array<keyof typeof prev>) {
      const v = prev[k];
      if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else process.env[k] = v;
    }
    __resetTokenCacheForTests();
  });
}

test("getAccessToken: soft-fails to null when APP_ID or CERT_ID is missing", async () => {
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: undefined, EBAY_DEVELOPER_CERT_ID: undefined },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken();
      assert.equal(out, null);
    },
  );
});

test("getAccessToken: POSTs to identity endpoint with Basic auth + urlencoded body", async () => {
  const { fetch, calls } = fakeFetch([
    tokenResponse({ access_token: "tok_abc", expires_in: 7200, token_type: "Application Access Token" }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid_test", EBAY_DEVELOPER_CERT_ID: "PRD-cert_test" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl: fetch });
      assert.ok(out);
      assert.equal(out?.token, "tok_abc");

      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.url, "https://api.ebay.com/identity/v1/oauth2/token");
      assert.equal(call.init.method, "POST");
      const headers = call.init.headers as Record<string, string>;
      const expectedBasic = Buffer.from("appid_test:PRD-cert_test").toString("base64");
      assert.equal(headers.Authorization, `Basic ${expectedBasic}`);
      assert.equal(headers["Content-Type"], "application/x-www-form-urlencoded");
      assert.equal(
        call.init.body,
        `grant_type=client_credentials&scope=${encodeURIComponent("https://api.ebay.com/oauth/api_scope")}`,
      );
      // OAuth fetch must not be platform-cached either — token rotation
      // would otherwise be invisible to the next caller.
      assert.equal((call.init as { cache?: string }).cache, "no-store");
    },
  );
});

test("getAccessToken: caches the token and skips the network on the next call within TTL", async () => {
  const { fetch, calls } = fakeFetch([
    tokenResponse({ access_token: "tok_first", expires_in: 7200 }),
    tokenResponse({ access_token: "tok_second_should_not_be_seen", expires_in: 7200 }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const first = await getAccessToken({ fetchImpl: fetch });
      const second = await getAccessToken({ fetchImpl: fetch });
      assert.equal(first?.token, "tok_first");
      assert.equal(second?.token, "tok_first");
      assert.equal(calls.length, 1);
    },
  );
});

test("getAccessToken: refreshes when cached token has < 60s of TTL remaining", async () => {
  const { fetch, calls } = fakeFetch([
    // First fetch: a token that's already inside the 60s refresh window
    // (effectively expired for caching purposes).
    tokenResponse({ access_token: "tok_almost_expired", expires_in: 30 }),
    tokenResponse({ access_token: "tok_refreshed", expires_in: 7200 }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const first = await getAccessToken({ fetchImpl: fetch });
      const second = await getAccessToken({ fetchImpl: fetch });
      assert.equal(first?.token, "tok_almost_expired");
      // Cached token has < 60s left → next call refreshes.
      assert.equal(second?.token, "tok_refreshed");
      assert.equal(calls.length, 2);
    },
  );
});

test("getAccessToken: soft-fails on 401", async () => {
  const { fetch } = fakeFetch([
    new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "wrong_cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});

test("getAccessToken: soft-fails on 429", async () => {
  const { fetch } = fakeFetch([new Response("rate limited", { status: 429 })]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});

test("getAccessToken: soft-fails on network exception", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNRESET");
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl });
      assert.equal(out, null);
    },
  );
});

test("getAccessToken: soft-fails on malformed JSON response body", async () => {
  const { fetch } = fakeFetch([
    new Response("not json", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});

test("getAccessToken: soft-fails when access_token field is missing", async () => {
  const { fetch } = fakeFetch([tokenResponse({ expires_in: 7200 })]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getAccessToken({ fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});
