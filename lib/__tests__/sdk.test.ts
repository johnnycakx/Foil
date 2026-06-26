// Pokemon TCG SDK wrapper contract tests. Pins:
//   1. GET to api.pokemontcg.io/v2/cards/{id} with 24h cache (revalidate).
//   2. Response parsing: name, set.id, set.name, number, images.large, rarity.
//   3. Soft-fail on 404 / 500 / network → minimal record built from id.
//   4. Empty/missing id is handled defensively (no network call).

import test from "node:test";
import assert from "node:assert/strict";
import { getAllSets, getCardMetadata, getSetMetadata, getBakedCardMetadata } from "../cards/sdk.ts";

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

test("getSetMetadata GETs api.pokemontcg.io/v2/sets/{id} with 24h revalidate and parses every field", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({
      data: {
        id: "base1",
        name: "Base",
        series: "Base",
        printedTotal: 102,
        total: 102,
        releaseDate: "1999/01/09",
        images: {
          symbol: "https://images.pokemontcg.io/base1/symbol.png",
          logo: "https://images.pokemontcg.io/base1/logo.png",
        },
      },
    }),
  ]);
  const out = await getSetMetadata({ id: "base1", fetchImpl: fetch });
  assert.equal(out.id, "base1");
  assert.equal(out.name, "Base");
  assert.equal(out.series, "Base");
  assert.equal(out.total, 102);
  assert.equal(out.releaseDate, "1999/01/09");
  assert.equal(out.logoUrl, "https://images.pokemontcg.io/base1/logo.png");
  assert.equal(calls[0].url, "https://api.pokemontcg.io/v2/sets/base1");
  const init = calls[0].init as RequestInit & { next?: { revalidate?: number } };
  assert.equal(init.next?.revalidate, 86_400);
});

test("getSetMetadata soft-fails to minimal record on 404 — logo URL still derivable from id", async () => {
  const { fetch } = fakeFetch([new Response("nope", { status: 404 })]);
  const out = await getSetMetadata({ id: "unknown-set", fetchImpl: fetch });
  assert.equal(out.name, "unknown-set");
  assert.equal(out.total, 0);
  assert.equal(out.logoUrl, "https://images.pokemontcg.io/unknown-set/logo.png");
});

test("getAllSets fetches the full set list with pageSize=250 and parses every entry", async () => {
  const { fetch, calls } = fakeFetch([
    jsonResponse({
      data: [
        { id: "base1", name: "Base", series: "Base", total: 102, releaseDate: "1999/01/09", images: { logo: "https://images.pokemontcg.io/base1/logo.png" } },
        { id: "neo1", name: "Neo Genesis", series: "Neo", total: 111, releaseDate: "2000/12/16", images: { logo: "https://images.pokemontcg.io/neo1/logo.png" } },
        { id: "sv3pt5", name: "151", series: "Scarlet & Violet", total: 207, releaseDate: "2023/09/22", images: { logo: "https://images.pokemontcg.io/sv3pt5/logo.png" } },
      ],
    }),
  ]);
  const out = await getAllSets({ fetchImpl: fetch });
  assert.equal(out.length, 3);
  assert.equal(out[0].id, "base1");
  assert.equal(out[2].series, "Scarlet & Violet");
  assert.match(calls[0].url, /pageSize=250/);
});

test("getAllSets soft-fails to [] when the API errors", async () => {
  const { fetch } = fakeFetch([new Response("boom", { status: 500 })]);
  const out = await getAllSets({ fetchImpl: fetch });
  assert.deepEqual(out, []);
});

test("getAllSets soft-fails to [] when fetch throws", async () => {
  const fetchImpl = (async () => {
    throw new Error("ENETDOWN");
  }) as unknown as typeof fetch;
  const out = await getAllSets({ fetchImpl });
  assert.deepEqual(out, []);
});

// getBakedCardMetadata (ADR-070): the market-movers cron's network-free metadata
// path. A baked card carries display fields + PokeTrace variants; an unknown id
// is null (caller falls back to the live fetch). Reads the committed snapshot.
test("getBakedCardMetadata returns a baked card with variants, null for unknown", () => {
  const charizard = getBakedCardMetadata("base1-4");
  assert.ok(charizard, "base1-4 should be in the baked snapshot");
  assert.equal(charizard!.name, "Charizard");
  assert.ok((charizard!.variants?.length ?? 0) > 0, "baked card should carry PokeTrace variants");
  // A modern card from the ADR-070 expansion is baked too.
  const modern = getBakedCardMetadata("sv8pt5-161");
  assert.ok(modern, "a modern mover-set card should be baked");
  assert.equal(getBakedCardMetadata("totally-not-a-real-id-999"), null);
  assert.equal(getBakedCardMetadata(""), null);
});
