// One-off probe script for the PriceCharting API.
//
// Goal: determine whether PriceCharting returns per-condition prices for
// Pokémon TCG singles (raw NM/LP/MP/HP/DMG and/or graded PSA tiers), so we can
// replace the fabricated condition multipliers (LP 0.88, MP 0.75, etc.) with
// real data — or remove the picker entirely if PriceCharting doesn't deliver.
//
// Auth: PriceCharting uses a `t=<40-char-token>` query parameter. Prices are
// integer pennies. Endpoints:
//   /api/products?q=<text>           — full-text product search (up to 20 hits)
//   /api/product?id=<id>             — single-product detail
//
// Run:  node --experimental-strip-types --no-warnings scripts/probe-pricecharting.ts
//
// Output: full JSON of each probe response to stdout, plus a CSV-ish summary
// of which fields were populated. The findings doc is hand-written from this.

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const TOKEN = process.env.PRICECHARTING_API_KEY;
if (!TOKEN) {
  console.error("PRICECHARTING_API_KEY missing from .env.local — aborting.");
  process.exit(1);
}

const BASE = "https://www.pricecharting.com/api";

type ProductsResponse = {
  status: "success" | "error";
  products?: Array<Record<string, unknown>>;
  "error-message"?: string;
};

type ProductResponse = {
  status: "success" | "error";
  "error-message"?: string;
} & Record<string, unknown>;

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T; ms: number } | { ok: false; error: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const ms = Date.now() - start;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data, ms };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const PROBES: Array<{ label: string; query: string }> = [
  { label: "Charizard Base Set #4/102 (vintage holo)", query: "pokemon charizard base set 4" },
  { label: "Pikachu Base Set #58/102 (vintage common)", query: "pokemon pikachu base set 58" },
  { label: "Oricorio ex (recent)", query: "pokemon oricorio ex" },
];

function priceFields(record: Record<string, unknown>): Record<string, unknown> {
  // Collect everything that looks like a price/condition/grade so we can see
  // the universe of fields PriceCharting returns for cards.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (
      k.includes("price") ||
      k.includes("grade") ||
      k.includes("psa") ||
      k.includes("bgs") ||
      k.includes("cgc") ||
      k.includes("condition")
    ) {
      out[k] = v;
    }
  }
  return out;
}

function nonNullPriceKeys(record: Record<string, unknown>): string[] {
  return Object.entries(priceFields(record))
    .filter(([, v]) => v !== null && v !== undefined && v !== 0 && v !== "")
    .map(([k]) => k);
}

console.log(`\n==== PriceCharting API probe — ${new Date().toISOString()} ====\n`);

for (const probe of PROBES) {
  console.log(`\n--------------------------------------------------`);
  console.log(`# ${probe.label}`);
  console.log(`  search query: "${probe.query}"`);
  console.log(`--------------------------------------------------`);

  // 1) Search.
  const searchUrl = `${BASE}/products?t=${encodeURIComponent(TOKEN)}&q=${encodeURIComponent(probe.query)}`;
  console.log(`  GET ${searchUrl.replace(TOKEN, "<TOKEN>")}`);
  const search = await fetchJson<ProductsResponse>(searchUrl);
  if (!search.ok) {
    console.log(`  ✗ search failed: ${search.error}`);
    continue;
  }
  console.log(`  ✓ ${search.ms}ms · status=${search.data.status} · products=${search.data.products?.length ?? 0}`);
  if (search.data.status !== "success" || !search.data.products?.length) {
    console.log(`  ${JSON.stringify(search.data, null, 2)}`);
    continue;
  }

  // Print the first 3 search hits so we can pick the right product manually.
  const top = search.data.products.slice(0, 3);
  for (const p of top) {
    console.log(
      `    - id=${p.id} | "${p["product-name"]}" | console="${p["console-name"]}" | nonNullPrices=[${nonNullPriceKeys(p).join(", ")}]`,
    );
  }

  // 2) Detail on the first hit.
  const firstId = top[0].id as string | number | undefined;
  if (!firstId) {
    console.log(`  ✗ first product has no id; skipping detail`);
    continue;
  }
  const detailUrl = `${BASE}/product?t=${encodeURIComponent(TOKEN)}&id=${encodeURIComponent(String(firstId))}`;
  console.log(`\n  GET ${detailUrl.replace(TOKEN, "<TOKEN>")}`);
  const detail = await fetchJson<ProductResponse>(detailUrl);
  if (!detail.ok) {
    console.log(`  ✗ detail failed: ${detail.error}`);
    continue;
  }
  console.log(`  ✓ ${detail.ms}ms`);
  console.log(`\n  FULL DETAIL JSON:`);
  console.log(JSON.stringify(detail.data, null, 2));
  console.log(`\n  price-ish fields:`);
  console.log(JSON.stringify(priceFields(detail.data), null, 2));
  console.log(`  non-null price keys: [${nonNullPriceKeys(detail.data).join(", ")}]`);
}

console.log(`\n==== probe complete ====\n`);
