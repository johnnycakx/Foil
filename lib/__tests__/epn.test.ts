// Contract tests for the EPN client. Pins:
//   1. GET to api.partner.ebay.com with Bearer auth + AccountSID in path.
//   2. cache: 'no-store' on every EPN call (License Agreement compliance —
//      see R-008 in docs/RISKS.md).
//   3. Affiliate URLs always include campid + customid + the documented
//      tracking-param set (mkevt/mkcid/mkrid/toolid).
//   4. Soft-fail on missing creds / 401 / 429 / fetch-throw — never throws.
//   5. getBestListing picks the lowest-priced hit and wraps the URL.

import test from "node:test";
import assert from "node:assert/strict";
import {
  affiliateSearchUrl,
  alertMissingCampaignId,
  buildAffiliateUrl,
  getBestListing,
  searchProducts,
  __resetCampaignIdAlertForTest,
} from "../affiliate/epn.ts";

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withEnv(
  env: Partial<Record<"EBAY_EPN_ACCOUNT_SID" | "EBAY_EPN_AUTH_TOKEN" | "EBAY_CAMPAIGN_ID", string | undefined>>,
  fn: () => Promise<void> | void,
): Promise<void> {
  const prev = {
    EBAY_EPN_ACCOUNT_SID: process.env.EBAY_EPN_ACCOUNT_SID,
    EBAY_EPN_AUTH_TOKEN: process.env.EBAY_EPN_AUTH_TOKEN,
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
  });
}

test("searchProducts soft-fails when EPN creds are missing", async () => {
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: undefined, EBAY_EPN_AUTH_TOKEN: undefined },
    async () => {
      const out = await searchProducts({ query: "charizard" });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.error, "missing_epn_credentials");
    },
  );
});

test("searchProducts rejects empty query without hitting the network", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await searchProducts({ query: "   ", fetchImpl });
      assert.equal(out.ok, false);
      if (!out.ok) assert.equal(out.error, "empty_query");
      assert.equal(called, false);
    },
  );
});

test("searchProducts GETs api.partner.ebay.com with AccountSID in path, Bearer auth, and no-store cache", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({ products: [{ title: "Card", itemUrl: "https://ebay.com/itm/1", price: 10 }] }),
  ]);
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "acct_abc", EBAY_EPN_AUTH_TOKEN: "tok_test" },
    async () => {
      const out = await searchProducts({ query: "charizard base set", limit: 10, fetchImpl: fetch });
      assert.equal(out.ok, true);
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /^https:\/\/api\.partner\.ebay\.com\/v1\/acct_abc\/products\?/);
      assert.match(calls[0].url, /q=charizard%20base%20set/);
      assert.match(calls[0].url, /limit=10/);
      const headers = calls[0].init.headers as Record<string, string>;
      assert.equal(headers["Authorization"], "Bearer tok_test");
      assert.equal((calls[0].init as { cache?: string }).cache, "no-store");
    },
  );
});

test("searchProducts soft-fails on 401 (auth) without throwing", async () => {
  const { fetch } = fakeFetch([new Response("unauthorized", { status: 401 })]);
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await searchProducts({ query: "x", fetchImpl: fetch });
      assert.equal(out.ok, false);
      if (!out.ok) {
        assert.equal(out.status, 401);
        assert.equal(out.error, "http_401");
      }
    },
  );
});

test("searchProducts soft-fails on 429 (rate limit) without throwing", async () => {
  const { fetch } = fakeFetch([new Response("slow down", { status: 429 })]);
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await searchProducts({ query: "x", fetchImpl: fetch });
      assert.equal(out.ok, false);
      if (!out.ok) {
        assert.equal(out.status, 429);
        assert.equal(out.error, "http_429");
      }
    },
  );
});

test("searchProducts soft-fails when fetch throws", async () => {
  const fetchImpl = (async () => {
    throw new Error("ENETDOWN");
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await searchProducts({ query: "x", fetchImpl });
      assert.equal(out.ok, false);
      if (!out.ok) assert.match(out.error, /fetch_failed: ENETDOWN/);
    },
  );
});

test("buildAffiliateUrl wraps an eBay URL with campid + customid + tracking params", () => {
  withEnv({ EBAY_CAMPAIGN_ID: "5339154326" }, () => {
    const wrapped = buildAffiliateUrl(
      "https://www.ebay.com/itm/Charizard-Base-Set-4/12345",
      "foil-card-page",
    );
    const u = new URL(wrapped);
    assert.equal(u.searchParams.get("campid"), "5339154326");
    assert.equal(u.searchParams.get("customid"), "foil-card-page");
    assert.equal(u.searchParams.get("mkevt"), "1");
    assert.equal(u.searchParams.get("mkcid"), "1");
    assert.equal(u.searchParams.get("mkrid"), "711-53200-19255-0");
    assert.equal(u.searchParams.get("toolid"), "10001");
    // Original path preserved.
    assert.equal(u.pathname, "/itm/Charizard-Base-Set-4/12345");
  });
});

test("buildAffiliateUrl returns the URL unwrapped (no attribution) when EBAY_CAMPAIGN_ID is missing — soft-fail preserves navigation", () => {
  withEnv({ EBAY_CAMPAIGN_ID: undefined }, () => {
    const out = buildAffiliateUrl("https://www.ebay.com/itm/abc", "foil-card-page");
    assert.equal(out, "https://www.ebay.com/itm/abc");
  });
});

// Defect 4 (content-trust-hotfix): the soft-fail must be LOUD, not silent. The
// unwrapped-URL behavior above is unchanged (navigation preserved); the alarm
// is the new observability — decision + once-per-process latch pinned here.
test("alertMissingCampaignId fires once per process in prod when a webhook is set", () => {
  __resetCampaignIdAlertForTest();
  let fired = 0;
  const deps = { webhook: "https://discord/errors", isProd: true, notify: () => { fired++; } };
  assert.equal(alertMissingCampaignId(deps), true, "first eligible call fires");
  assert.equal(alertMissingCampaignId(deps), false, "second call is latched — no spam");
  assert.equal(fired, 1, "notify invoked exactly once");
});

test("alertMissingCampaignId stays quiet outside prod or without a webhook (no dev/CI spam)", () => {
  let fired = 0;
  __resetCampaignIdAlertForTest();
  assert.equal(alertMissingCampaignId({ webhook: "https://d", isProd: false, notify: () => fired++ }), false);
  __resetCampaignIdAlertForTest();
  assert.equal(alertMissingCampaignId({ webhook: undefined, isProd: true, notify: () => fired++ }), false);
  assert.equal(fired, 0, "no notify in non-prod or when the webhook is unset");
});

test("affiliateSearchUrl wraps the eBay search URL with the query + campid + customid", () => {
  withEnv({ EBAY_CAMPAIGN_ID: "5339154326" }, () => {
    const wrapped = affiliateSearchUrl("Charizard Base Set", "foil-card-page");
    const u = new URL(wrapped);
    assert.equal(u.host, "www.ebay.com");
    assert.equal(u.pathname, "/sch/i.html");
    assert.equal(u.searchParams.get("_nkw"), "Charizard Base Set");
    assert.equal(u.searchParams.get("campid"), "5339154326");
    assert.equal(u.searchParams.get("customid"), "foil-card-page");
  });
});

test("getBestListing picks the lowest-priced hit and returns the affiliate-wrapped URL", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({
      products: [
        { title: "Charizard NM", itemUrl: "https://ebay.com/itm/1", price: 250.00, currency: "USD", image: "https://ebay.com/img/1.jpg" },
        { title: "Charizard LP", itemUrl: "https://ebay.com/itm/2", price: 199.99, currency: "USD", image: { url: "https://ebay.com/img/2.jpg" } },
        { title: "Charizard HP", itemUrl: "https://ebay.com/itm/3", price: 320.00, currency: "USD" },
      ],
    }),
  ]);
  await withEnv(
    {
      EBAY_EPN_ACCOUNT_SID: "sid",
      EBAY_EPN_AUTH_TOKEN: "tok",
      EBAY_CAMPAIGN_ID: "5339154326",
    },
    async () => {
      const out = await getBestListing({
        cardName: "Charizard",
        setName: "Base Set",
        fetchImpl: fetch,
      });
      assert.ok(out !== null);
      assert.equal(out!.price, 199.99);
      assert.equal(out!.title, "Charizard LP");
      assert.equal(out!.image, "https://ebay.com/img/2.jpg");
      const u = new URL(out!.affiliateUrl);
      assert.equal(u.searchParams.get("campid"), "5339154326");
      assert.equal(u.searchParams.get("customid"), "foil-card-page");
      assert.match(u.pathname, /\/itm\/2/);
    },
  );
});

test("getBestListing returns null when EPN responds with no usable hits — page falls back to affiliateSearchUrl", async () => {
  const { fetch } = fakeFetch([jsonResponse({ products: [] })]);
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await getBestListing({ cardName: "Charizard", fetchImpl: fetch });
      assert.equal(out, null);
    },
  );
});

test("getBestListing returns null on EPN failure — never throws into the Server Component render", async () => {
  const fetchImpl = (async () => {
    throw new Error("DNS_TIMEOUT");
  }) as unknown as typeof fetch;
  await withEnv(
    { EBAY_EPN_ACCOUNT_SID: "sid", EBAY_EPN_AUTH_TOKEN: "tok" },
    async () => {
      const out = await getBestListing({ cardName: "Charizard", fetchImpl });
      assert.equal(out, null);
    },
  );
});
