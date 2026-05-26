// Contract pin for the /api/cards/search route — pins the 200 response +
// `{ hits: CardSearchHit[] }` shape that components/start-page-form.tsx
// expects on every successful query (Session 40 / Task #23 Bug 1).
//
// The route is the typeahead's only contract with the form. If the shape
// drifts (e.g. someone renames `hits` to `results`), the /start dropdown
// silently goes empty — the form reads `body.hits` and falls through to
// `setSearchResults([])` on undefined. We've already burned one launch on
// this; the test exists so we don't again.
//
// Strategy: the route imports `next/server` + path-aliased modules that
// don't resolve under `node --experimental-strip-types`, so we test the
// contract at two layers instead of executing the GET handler directly:
//   1. Source-level structural pins (file exists, shape constants stable,
//      handler shape is `NextResponse.json({ hits })`).
//   2. Behavioral tests against the underlying `searchCards()` — the
//      route is a thin pass-through, so pinning the SDK's contract +
//      the route's source shape covers the wire contract.
//
// Same pattern as `lib/__tests__/cron-wishlist-route.test.ts`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// Layer 1 — source-level structural pins.
// ---------------------------------------------------------------------------

test("route file: GET handler exists and returns NextResponse.json", () => {
  const src = readFile("app/api/cards/search/route.ts");
  assert.match(src, /export\s+async\s+function\s+GET\b/);
  // The response shape the form reads. If this drifts to `results`,
  // `matches`, etc., the form silently breaks.
  assert.match(src, /NextResponse\.json\(\s*\{\s*hits\s*:/);
});

test("route file: MAX_QUERY_LENGTH + RESULT_LIMIT constants are stable", () => {
  const src = readFile("app/api/cards/search/route.ts");
  assert.match(src, /MAX_QUERY_LENGTH\s*=\s*64/);
  assert.match(src, /RESULT_LIMIT\s*=\s*8/);
});

test("route file: returns empty hits on missing q (no SDK call wasted)", () => {
  const src = readFile("app/api/cards/search/route.ts");
  // The route returns `{ hits: [] }` early on missing/long q. Pattern:
  // either an explicit short-circuit return or a NextResponse.json({hits:[]}).
  assert.match(src, /\{\s*hits\s*:\s*\[\]\s*\}/);
});

test("route file: q clamped at MAX_QUERY_LENGTH (defense vs runaway queries)", () => {
  const src = readFile("app/api/cards/search/route.ts");
  // The length-cap check must reference MAX_QUERY_LENGTH directly so a
  // refactor that loosens the check trips this test.
  assert.match(src, /q\.length\s*>\s*MAX_QUERY_LENGTH/);
});

// ---------------------------------------------------------------------------
// Layer 2 — behavioral pins against searchCards (the route is a pass-through).
// ---------------------------------------------------------------------------

test("searchCards: returns a 6-field shape matching the form's SearchHit type", async () => {
  const { searchCards } = await import("../cards/sdk.ts");
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        data: [
          {
            id: "base1-4",
            name: "Charizard",
            number: "4",
            set: { id: "base1", name: "Base" },
            images: { small: "https://images.pokemontcg.io/base1/4.png" },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;
  const hits = await searchCards({ query: "charizard", limit: 8, fetchImpl });
  assert.equal(Array.isArray(hits), true);
  assert.equal(hits.length, 1);
  // Pin the 6 fields the /start form reads
  // (components/start-page-form.tsx lines 17-24 — SearchHit type).
  const hit = hits[0];
  assert.equal(typeof hit.id, "string");
  assert.equal(typeof hit.name, "string");
  assert.equal(typeof hit.setName, "string");
  assert.equal(typeof hit.setId, "string");
  assert.equal(typeof hit.number, "string");
  assert.equal(typeof hit.image, "string");
});

test("searchCards: empty query returns [] without hitting the SDK", async () => {
  const { searchCards } = await import("../cards/sdk.ts");
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  const hits = await searchCards({ query: "", fetchImpl });
  assert.equal(called, false);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Bug 1 retry guard — upstream 504s no longer surface as empty hits.
// ---------------------------------------------------------------------------

test("searchCards: retries on a single 504 and recovers with the second response", async () => {
  const { searchCards } = await import("../cards/sdk.ts");
  let calls = 0;
  const flakyFetch = (async () => {
    calls++;
    if (calls === 1) {
      return new Response("error code: 504", { status: 504 });
    }
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "sv3pt5-199",
            name: "Charizard ex",
            number: "199",
            set: { id: "sv3pt5", name: "Pokémon 151" },
            images: { small: "https://images.pokemontcg.io/sv3pt5/199.png" },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const hits = await searchCards({ query: "charizard", limit: 8, fetchImpl: flakyFetch });
  assert.equal(calls, 2, "expected one retry after the 504");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, "sv3pt5-199");
});

test("searchCards: returns [] after all retries 504 (soft-fail intact)", async () => {
  const { searchCards } = await import("../cards/sdk.ts");
  let calls = 0;
  const always504: typeof fetch = (async () => {
    calls++;
    return new Response("error code: 504", { status: 504 });
  }) as unknown as typeof fetch;
  const hits = await searchCards({ query: "charizard", limit: 8, fetchImpl: always504 });
  assert.equal(hits.length, 0, "soft-fail still returns []");
  // 1 initial + 3 retries = 4 calls (RETRY_DELAYS_MS = [200, 600, 1800]).
  assert.equal(calls, 4, "expected 1 initial call + 3 retries (4 total)");
});

test("searchCards: does NOT retry on 4xx (user query, empty result is a real outcome)", async () => {
  const { searchCards } = await import("../cards/sdk.ts");
  let calls = 0;
  const fourOhFour: typeof fetch = (async () => {
    calls++;
    return new Response("Not Found", { status: 404 });
  }) as unknown as typeof fetch;
  const hits = await searchCards({ query: "charizard", limit: 8, fetchImpl: fourOhFour });
  assert.equal(hits.length, 0);
  // searchCards opts OUT of retryOn4xx — 4xx is a real "no match" outcome
  // for user-input queries, not upstream flake.
  assert.equal(calls, 1, "expected no retries on 4xx for user-input search");
});

test("getCardMetadata: retries on 504 and recovers (Bug 3 — set page placeholders)", async () => {
  const { getCardMetadata } = await import("../cards/sdk.ts");
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls < 2) return new Response("error code: 504", { status: 504 });
    return new Response(
      JSON.stringify({
        data: {
          id: "base1-1",
          name: "Alakazam",
          number: "1",
          set: { id: "base1", name: "Base" },
          images: { large: "https://images.pokemontcg.io/base1/1_hires.png" },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const out = await getCardMetadata({ id: "base1-1", fetchImpl: flaky });
  assert.equal(calls, 2);
  assert.equal(out.name, "Alakazam");
  assert.equal(out.image, "https://images.pokemontcg.io/base1/1_hires.png");
  // The fallback flag must NOT be set — a successful retry is a real record.
  assert.equal(out.fallback, undefined);
});

test("getCardMetadata: ALSO retries on 4xx (catalog IDs are known-valid; 4xx == upstream flake)", async () => {
  // Session 40 verified upstream pokemontcg.io intermittently returns
  // 404 for cards that exist. Since our IDs come from CARD_CATALOG,
  // a 4xx response means upstream is flaky, not that the card is gone.
  // getCardMetadata opts into retryOn4xx; the retry recovers.
  const { getCardMetadata } = await import("../cards/sdk.ts");
  let calls = 0;
  const flaky404 = (async () => {
    calls++;
    if (calls < 3) return new Response("Not Found", { status: 404 });
    return new Response(
      JSON.stringify({
        data: {
          id: "base1-12",
          name: "Ninetales",
          number: "12",
          set: { id: "base1", name: "Base" },
          images: { large: "https://images.pokemontcg.io/base1/12_hires.png" },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  const out = await getCardMetadata({ id: "base1-12", fetchImpl: flaky404 });
  assert.equal(calls, 3, "expected 2 retries on 404 before recovery");
  assert.equal(out.name, "Ninetales");
  assert.equal(out.fallback, undefined);
});

// ---------------------------------------------------------------------------
// Bug 5 — footer email capture suppressed on /start.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Baked-snapshot fallback — Session 40 amendment.
// ---------------------------------------------------------------------------

test("baked-metadata fallback layer is wired in lib/cards/sdk.ts", () => {
  const src = readFile("lib/cards/sdk.ts");
  // The fallback layer must (a) load baked-metadata.json + (b) gate the
  // fallback on `usingDefaultFetch` so test-stubbed fetchImpl bypasses
  // it (preserving the soft-fail-to-minimal-record semantics tests assert).
  assert.match(src, /baked-metadata\.json/);
  assert.match(src, /usingDefaultFetch\s*=\s*!input\.fetchImpl/);
  assert.match(src, /usingDefaultFetch\s*&&\s*BAKED\.cards/);
});

test("bake script registered in package.json `bake:cards`", () => {
  const src = readFile("package.json");
  assert.match(src, /"bake:cards"\s*:\s*"node[^"]+scripts\/bake-card-metadata\.ts"/);
});

test("FooterEmailCapture: suppresses on /start via usePathname check", () => {
  const src = readFile("components/footer-email-capture.tsx");
  // The suppress-list must include /start.
  assert.match(src, /SUPPRESS_ON_ROUTES[\s\S]*?["']\/start["']/);
  // usePathname is the mechanism — anchored on the import + return-null path.
  assert.match(src, /from\s+["']next\/navigation["']/);
  assert.match(src, /usePathname/);
  assert.match(src, /return null/);
});
