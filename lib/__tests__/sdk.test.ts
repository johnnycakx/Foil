// Pokemon TCG SDK wrapper contract tests. Pins:
//   1. GET to api.pokemontcg.io/v2/cards/{id} with 24h cache (revalidate).
//   2. Response parsing: name, set.id, set.name, number, images.large, rarity.
//   3. Soft-fail on 404 / 500 / network → minimal record built from id.
//   4. Empty/missing id is handled defensively (no network call).

import test from "node:test";
import assert from "node:assert/strict";
import { getCardMetadata } from "../cards/sdk.ts";

type CapturedRequest = { url: string; init: RequestInit };

function fakeFetch(responses: Array<Response | (() => Response | Promise<Response>)>): {
  fetch: typeof fetch;
  calls: CapturedRequest[];
} {
  const calls: CapturedRequest[] = [];
  let i = 0;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === "string" ? url : url.toString(), init: init ?? {} });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return typeof r === "function" ? await r() : r;
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("getCardMetadata GETs api.pokemontcg.io/v2/cards/{id} with 24h revalidate", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({
      data: {
        id: "base1-4",
        name: "Charizard",
        number: "4",
        rarity: "Rare Holo",
        set: { id: "base1", name: "Base", releaseDate: "1999/01/09" },
        images: { small: "https://images.pokemontcg.io/base1/4.png", large: "https://images.pokemontcg.io/base1/4_hires.png" },
      },
    }),
  ]);
  const out = await getCardMetadata({ id: "base1-4", fetchImpl: fetch });
  assert.equal(out.id, "base1-4");
  assert.equal(out.name, "Charizard");
  assert.equal(out.setName, "Base");
  assert.equal(out.setId, "base1");
  assert.equal(out.number, "4");
  assert.equal(out.rarity, "Rare Holo");
  assert.equal(out.releaseDate, "1999/01/09");
  assert.equal(out.image, "https://images.pokemontcg.io/base1/4_hires.png");
  assert.equal(out.fallback, undefined);
  // Network shape.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.pokemontcg.io/v2/cards/base1-4");
  const init = calls[0].init as RequestInit & { next?: { revalidate?: number } };
  assert.equal(init.next?.revalidate, 86_400);
});

test("getCardMetadata falls back to small image when large is missing", async () => {
  const { fetch } = fakeFetch([
    jsonResponse({
      data: {
        id: "base1-1",
        name: "Alakazam",
        number: "1",
        set: { id: "base1", name: "Base" },
        images: { small: "https://images.pokemontcg.io/base1/1.png" },
      },
    }),
  ]);
  const out = await getCardMetadata({ id: "base1-1", fetchImpl: fetch });
  assert.equal(out.image, "https://images.pokemontcg.io/base1/1.png");
});

test("getCardMetadata soft-fails to minimal record on 404", async () => {
  const { fetch } = fakeFetch([new Response("not found", { status: 404 })]);
  const out = await getCardMetadata({ id: "fake-999", fetchImpl: fetch });
  assert.equal(out.id, "fake-999");
  assert.equal(out.fallback, true);
  assert.equal(out.image, "");
  // The derived setId from "fake-999" is "fake" (everything before the first "-").
  assert.equal(out.setId, "fake");
  assert.equal(out.number, "999");
});

test("getCardMetadata soft-fails to minimal record on 500", async () => {
  const { fetch } = fakeFetch([new Response("boom", { status: 500 })]);
  const out = await getCardMetadata({ id: "base1-4", fetchImpl: fetch });
  assert.equal(out.fallback, true);
  assert.equal(out.id, "base1-4");
});

test("getCardMetadata soft-fails when fetch throws (network drop)", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNRESET");
  }) as unknown as typeof fetch;
  const out = await getCardMetadata({ id: "base1-4", fetchImpl });
  assert.equal(out.fallback, true);
  assert.equal(out.id, "base1-4");
});

test("getCardMetadata returns minimal record for an empty id without hitting the network", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const out = await getCardMetadata({ id: "", fetchImpl });
  assert.equal(called, false);
  assert.equal(out.fallback, true);
  assert.equal(out.id, "");
});

test("getCardMetadata soft-fails when the response is missing data.{} payload", async () => {
  const { fetch } = fakeFetch([jsonResponse({ data: null })]);
  const out = await getCardMetadata({ id: "base1-4", fetchImpl: fetch });
  assert.equal(out.fallback, true);
});
