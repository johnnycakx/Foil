// Unit tests for the PriceCharting adapter logic. Network is mocked via
// global fetch override — no real API calls. The tests pin two contracts:
//   (1) the field-to-tier mapping (loose-price = RAW_UNGRADED, etc.)
//   (2) the search-result ranking (Base Set should pick "Charizard #4", not
//       "[1st Edition]" or "[Shadowless]" variants)
// These were both derived from scripts/probe-pricecharting.ts findings.

import test from "node:test";
import assert from "node:assert/strict";
import { lookupPriceCharting } from "../pricecharting.ts";

const originalFetch = globalThis.fetch;

function withMockedFetch(handler: (url: string) => unknown, body: () => Promise<void>): Promise<void> {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const data = handler(url);
    if (data === null) {
      return new Response("error", { status: 500 }) as unknown as Response;
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as typeof fetch;
  return body().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

// Mirror the real /api/product detail response for Charizard Base Set #4.
const CHARIZARD_DETAIL = {
  status: "success",
  id: "630417",
  "product-name": "Charizard #4",
  "console-name": "Pokemon Base Set",
  "loose-price": 34716, // $347.16 → RAW_UNGRADED
  "cib-price": 76039, // $760.39 → PSA 7
  "new-price": 129086, // $1290.86 → PSA 8
  "graded-price": 244304, // $2443.04 → PSA 9
  "box-only-price": 430000, // $4300 → PSA 9.5
  "condition-17-price": 713750, // $7137.50 → CGC 10
  "condition-18-price": 1696400, // $16964 → SGC 10
  "manual-only-price": 2827250, // $28272.50 → PSA 10
  "bgs-10-price": 3675400, // $36754 → BGS 10
};

const CHARIZARD_VARIANTS = [
  { ...CHARIZARD_DETAIL }, // "Charizard #4" — plain Base Set
  { ...CHARIZARD_DETAIL, id: "715593", "product-name": "Charizard [1st Edition] #4" },
  { ...CHARIZARD_DETAIL, id: "715695", "product-name": "Charizard [Shadowless] #4" },
];

test("pricecharting: field-to-tier mapping covers ungraded + every graded tier", async () => {
  // We can't import the private function directly, so exercise it through
  // lookupPriceCharting against a stubbed search hit.
  await withMockedFetch(
    (url) => {
      if (url.includes("/api/products?")) return { status: "success", products: [CHARIZARD_DETAIL] };
      if (url.includes("/api/product?")) return CHARIZARD_DETAIL;
      return null;
    },
    async () => {
      process.env.PRICECHARTING_API_KEY = "test-key";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

      const result = await lookupPriceCharting({
        poketraceId: "pt-charizard-4",
        name: "Charizard",
        setName: "Base Set",
        collectorNumber: "4/102",
      });

      assert.ok(result, "lookup must return a result");
      const byTier = new Map(result!.quotes.map((q) => [q.tier, q.amount]));

      assert.strictEqual(byTier.get("RAW_UNGRADED"), 347.16, "loose-price → RAW_UNGRADED");
      assert.strictEqual(byTier.get("PSA_7"), 760.39, "cib-price → PSA_7");
      assert.strictEqual(byTier.get("PSA_8"), 1290.86, "new-price → PSA_8");
      assert.strictEqual(byTier.get("PSA_9"), 2443.04, "graded-price → PSA_9");
      assert.strictEqual(byTier.get("PSA_9_5"), 4300, "box-only-price → PSA_9_5");
      assert.strictEqual(byTier.get("PSA_10"), 28272.5, "manual-only-price → PSA_10");
      assert.strictEqual(byTier.get("CGC_10"), 7137.5, "condition-17-price → CGC_10");
      assert.strictEqual(byTier.get("SGC_10"), 16964, "condition-18-price → SGC_10");
      assert.strictEqual(byTier.get("BGS_10"), 36754, "bgs-10-price → BGS_10");

      // Every quote must be sourced from PriceCharting.
      for (const q of result!.quotes) {
        assert.strictEqual(q.source, "pricecharting");
        assert.ok(q.amount > 0, `tier ${q.tier} must have positive amount`);
      }
    },
  );
});

test("pricecharting: ranker prefers plain set over 1st-edition/shadowless variants", async () => {
  // The search returns variants in API order (plain first here, but the ranker
  // must penalize "[1st Edition]" / "[Shadowless]" regardless of order). Shuffle
  // them to confirm the ranker, not insertion order, picks the winner.
  await withMockedFetch(
    (url) => {
      if (url.includes("/api/products?")) {
        return {
          status: "success",
          products: [
            CHARIZARD_VARIANTS[1], // 1st Edition first
            CHARIZARD_VARIANTS[2], // Shadowless second
            CHARIZARD_VARIANTS[0], // plain last
          ],
        };
      }
      if (url.includes("/api/product?")) return CHARIZARD_DETAIL;
      return null;
    },
    async () => {
      process.env.PRICECHARTING_API_KEY = "test-key";

      const result = await lookupPriceCharting({
        poketraceId: "pt-charizard-4-plain",
        name: "Charizard",
        setName: "Base Set", // does NOT mention 1st edition or shadowless
        collectorNumber: "4/102",
      });

      assert.ok(result, "lookup must return a result");
      assert.strictEqual(result!.productName, "Charizard #4", "must pick the plain Base Set printing");
    },
  );
});

test("pricecharting: returns null on empty search hits", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("/api/products?")) return { status: "success", products: [] };
      return null;
    },
    async () => {
      process.env.PRICECHARTING_API_KEY = "test-key";

      const result = await lookupPriceCharting({
        poketraceId: "pt-nonexistent",
        name: "ImaginaryCard",
        setName: "Imaginary Set",
        collectorNumber: null,
      });

      assert.strictEqual(result, null, "empty search must return null, not throw");
    },
  );
});
