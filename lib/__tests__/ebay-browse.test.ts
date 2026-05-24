// Contract tests for the eBay Browse API client. Pins:
//   1. Missing OAuth credentials → soft-fail.
//   2. Empty query → no network call, ok:false / error="empty_query".
//   3. cache: 'no-store' on every Browse fetch (R-008 — License Agreement
//      compliance).
//   4. Bearer auth via getAccessToken; X-EBAY-C-MARKETPLACE-ID: EBAY_US.
//   5. Parses Browse API item_summary/search response shape (itemSummaries
//      with stringified price.value).
//   6. Lowest-price picker selects the cheapest hit.
//   7. Wrapped via buildAffiliateUrl (campid + customid stamped).
//   8. 401/429/network/bad-JSON → ok:false; getBestListing → null.

import test from "node:test";
import assert from "node:assert/strict";
import { getBestListing, searchItems } from "../affiliate/ebay-browse.ts";
import { __resetTokenCacheForTests } from "../affiliate/ebay-oauth.ts";

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function tokenJson(): Response {
  return json({ access_token: "tok_test", expires_in: 7200 });
}

type EnvKey =
  | "EBAY_DEVELOPER_APP_ID"
  | "EBAY_DEVELOPER_CERT_ID"
  | "EBAY_CAMPAIGN_ID";

function withEnv(
  env: Partial<Record<EnvKey, string | undefined>>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const prev = {
    EBAY_DEVELOPER_APP_ID: process.env.EBAY_DEVELOPER_APP_ID,
    EBAY_DEVELOPER_CERT_ID: process.env.EBAY_DEVELOPER_CERT_ID,
    EBAY_CAMPAIGN_ID: process.env.EBAY_CAMPAIGN_ID,
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

test("searchItems: rejects empty query without hitting the network", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "   ", fetchImpl });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.error, "empty_query");
      assert.equal(called, false);
    },
  );
});

test("searchItems: soft-fails when OAuth credentials are missing", async () => {
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: undefined, EBAY_DEVELOPER_CERT_ID: undefined },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "charizard" });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.error, "missing_or_failed_oauth");
    },
  );
});

test("searchItems: GETs item_summary/search with Bearer + EBAY_US marketplace + no-store cache", async () => {
  const { fetch, calls } = fakeFetch([
    tokenJson(),
    json({
      itemSummaries: [
        {
          itemId: "v1|1|0",
          title: "Charizard Base Set",
          itemWebUrl: "https://www.ebay.com/itm/1",
          image: { imageUrl: "https://img.ebay/x.jpg" },
          price: { value: "42.31", currency: "USD" },
        },
      ],
    }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "charizard base set", limit: 5, fetchImpl: fetch });
      assert.equal(out.ok, true);
      // Two fetches: token, then browse.
      assert.equal(calls.length, 2);
      const browse = calls[1];
      assert.match(browse.url, /^https:\/\/api\.ebay\.com\/buy\/browse\/v1\/item_summary\/search\?/);
      assert.match(browse.url, /[?&]q=charizard%20base%20set/);
      assert.match(browse.url, /[?&]limit=5/);
      const headers = browse.init.headers as Record<string, string>;
      assert.equal(headers.Authorization, "Bearer tok_test");
      assert.equal(headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_US");
      assert.equal((browse.init as { cache?: string }).cache, "no-store");
    },
  );
});

test("searchItems: parses item_summary payload (stringified price + image.imageUrl + itemWebUrl)", async () => {
  const { fetch } = fakeFetch([
    tokenJson(),
    json({
      itemSummaries: [
        {
          title: "Pikachu Holo",
          itemWebUrl: "https://www.ebay.com/itm/2",
          image: { imageUrl: "https://img.ebay/p.jpg" },
          price: { value: "8.50", currency: "USD" },
        },
        // Listing without a price → dropped.
        { title: "skip-me", itemWebUrl: "https://www.ebay.com/itm/3" },
        // Listing without a title → dropped.
        { itemWebUrl: "https://www.ebay.com/itm/4", price: { value: "1.00", currency: "USD" } },
      ],
    }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "pikachu", fetchImpl: fetch });
      assert.equal(out.ok, true);
      if (out.ok) {
        assert.equal(out.hits.length, 1);
        assert.equal(out.hits[0].title, "Pikachu Holo");
        assert.equal(out.hits[0].image, "https://img.ebay/p.jpg");
        assert.equal(out.hits[0].price, 8.5);
        assert.equal(out.hits[0].currency, "USD");
        assert.equal(out.hits[0].itemUrl, "https://www.ebay.com/itm/2");
      }
    },
  );
});

test("searchItems: returns ok:false on 401 (token expired / unauthorized)", async () => {
  const { fetch } = fakeFetch([
    tokenJson(),
    new Response("unauthorized", { status: 401 }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "x", fetchImpl: fetch });
      assert.equal(out.ok, false);
      if (!out.ok) {
        assert.equal(out.status, 401);
        assert.equal(out.error, "http_401");
      }
    },
  );
});

test("searchItems: returns ok:false on 429 (rate limited)", async () => {
  const { fetch } = fakeFetch([
    tokenJson(),
    new Response("rate limited", { status: 429 }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "x", fetchImpl: fetch });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.status, 429);
    },
  );
});

test("searchItems: returns ok:false on network exception", async () => {
  let callIndex = 0;
  const fetchImpl = (async () => {
    if (callIndex === 0) {
      callIndex++;
      return tokenJson();
    }
    throw new Error("ENETUNREACH");
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "x", fetchImpl });
      assert.equal(out.ok, false);
      if (!out.ok) assert.match(out.error, /^fetch_failed: /);
    },
  );
});

test("searchItems: returns ok:false on malformed JSON", async () => {
  const { fetch } = fakeFetch([
    tokenJson(),
    new Response("not json", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await searchItems({ query: "x", fetchImpl: fetch });
      assert.equal(out.ok, false);
      if (!out.ok) assert.match(out.error, /^bad_json: /);
    },
  );
});

test("getBestListing: picks the lowest-priced hit and wraps the URL with affiliate params", async () => {
  const { fetch } = fakeFetch([
    tokenJson(),
    json({
      itemSummaries: [
        {
          title: "Charizard MP",
          itemWebUrl: "https://www.ebay.com/itm/aaa",
          image: { imageUrl: "https://img.ebay/a.jpg" },
          price: { value: "120.00", currency: "USD" },
        },
        {
          title: "Charizard LP — best deal",
          itemWebUrl: "https://www.ebay.com/itm/bbb",
          image: { imageUrl: "https://img.ebay/b.jpg" },
          price: { value: "85.50", currency: "USD" },
        },
        {
          title: "Charizard NM",
          itemWebUrl: "https://www.ebay.com/itm/ccc",
          image: { imageUrl: "https://img.ebay/c.jpg" },
          price: { value: "199.99", currency: "USD" },
        },
      ],
    }),
  ]);
  await withEnv(
    {
      EBAY_DEVELOPER_APP_ID: "appid",
      EBAY_DEVELOPER_CERT_ID: "cert",
      EBAY_CAMPAIGN_ID: "555555",
    },
    async () => {
      __resetTokenCacheForTests();
      const best = await getBestListing({
        cardName: "Charizard",
        setName: "Base Set",
        customId: "foil-card-page",
        fetchImpl: fetch,
      });
      assert.ok(best);
      assert.equal(best?.title, "Charizard LP — best deal");
      assert.equal(best?.price, 85.5);
      // Affiliate URL must include campid + customid + EPN tracking params.
      assert.match(best!.affiliateUrl, /campid=555555/);
      assert.match(best!.affiliateUrl, /customid=foil-card-page/);
      assert.match(best!.affiliateUrl, /mkevt=1/);
      assert.match(best!.affiliateUrl, /mkrid=711-53200-19255-0/);
      // Wrapped around the lowest-priced item URL specifically.
      assert.match(best!.affiliateUrl, /^https:\/\/www\.ebay\.com\/itm\/bbb\?/);
    },
  );
});

test("getBestListing: returns null when search returns ok:false", async () => {
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: undefined, EBAY_DEVELOPER_CERT_ID: undefined },
    async () => {
      __resetTokenCacheForTests();
      const out = await getBestListing({ cardName: "Charizard" });
      assert.equal(out, null);
    },
  );
});

test("getBestListing: returns null on empty hits[]", async () => {
  const { fetch } = fakeFetch([tokenJson(), json({ itemSummaries: [] })]);
  await withEnv(
    { EBAY_DEVELOPER_APP_ID: "appid", EBAY_DEVELOPER_CERT_ID: "cert" },
    async () => {
      __resetTokenCacheForTests();
      const out = await getBestListing({ cardName: "Obscure Card", fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});
