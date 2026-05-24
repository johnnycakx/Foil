// Structural guard for the watchlist seed set used by
// scripts/seed-watchlists.ts. Pins distribution invariants so a future
// diversification edit stays shape-consistent.
//
// This is NOT a DB integration test — it never connects to Supabase.
// It exercises the pure SEED_ROWS constant in lib/wishlist/seed-data.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { SEED_ROWS } from "../wishlist/seed-data.ts";
import { CARD_CATALOG } from "../cards/catalog.ts";

const KNOWN_SLUGS = new Set(CARD_CATALOG.map((e) => e.slug));

test("seed has exactly 12 rows", () => {
  assert.equal(SEED_ROWS.length, 12);
});

test("seed slugs are all distinct", () => {
  const slugs = SEED_ROWS.map((r) => r.card_slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("seed slugs all exist in CARD_CATALOG (no hallucinated slugs)", () => {
  const missing = SEED_ROWS.filter((r) => !KNOWN_SLUGS.has(r.card_slug));
  assert.deepEqual(
    missing.map((r) => r.card_slug),
    [],
    `Seed references slugs not in the catalog: ${missing.map((r) => r.card_slug).join(", ")}`,
  );
});

test("seed emails are all distinct + use the +alias pattern", () => {
  const emails = SEED_ROWS.map((r) => r.email);
  assert.equal(new Set(emails).size, emails.length);
  for (const e of emails) {
    assert.match(e, /^john\.c\.craig24\+wDIV\d{2}@gmail\.com$/);
  }
});

test("bucket distribution: 4 vintage / 4 modern / 2 modern_substitute / 2 unreachable", () => {
  const counts: Record<string, number> = {};
  for (const r of SEED_ROWS) {
    counts[r.bucket] = (counts[r.bucket] ?? 0) + 1;
  }
  assert.equal(counts.vintage, 4);
  assert.equal(counts.modern, 4);
  assert.equal(counts.modern_substitute, 2);
  assert.equal(counts.unreachable, 2);
});

test("vintage bucket only contains slugs from the pre-2001 WotC set prefixes", () => {
  const VINTAGE_PREFIXES = ["base2", "base3", "base4", "base5", "base6", "gym1", "gym2", "neo1", "neo2", "neo3", "neo4"];
  for (const r of SEED_ROWS.filter((x) => x.bucket === "vintage")) {
    const prefix = r.card_slug.split("-")[0];
    assert.ok(
      VINTAGE_PREFIXES.includes(prefix),
      `vintage row ${r.card_slug} has set prefix ${prefix}, expected one of ${VINTAGE_PREFIXES.join(",")}`,
    );
  }
});

test("modern + modern_substitute buckets only contain slugs from sv/swsh/cel/sm sets", () => {
  for (const r of SEED_ROWS.filter((x) => x.bucket === "modern" || x.bucket === "modern_substitute")) {
    const prefix = r.card_slug.split("-")[0];
    assert.ok(
      prefix.startsWith("sv") || prefix.startsWith("swsh") || prefix.startsWith("cel") || prefix.startsWith("sm"),
      `modern row ${r.card_slug} has set prefix ${prefix}; expected sv*/swsh*/cel*/sm*`,
    );
  }
});

test("unreachable bucket targets are far below typical Pokemon TCG prices (< $5)", () => {
  // The "scan-but-skip" path needs targets that effectively never
  // trigger an alert. Anything < $5 satisfies that for the
  // chase-card slugs we're using.
  for (const r of SEED_ROWS.filter((x) => x.bucket === "unreachable")) {
    assert.ok(
      r.target_price_cents <= 500,
      `unreachable row ${r.card_slug} has target ${r.target_price_cents} cents — should be ≤ 500`,
    );
  }
});

test("non-unreachable buckets carry targets that are plausibly alertable (≥ $20)", () => {
  for (const r of SEED_ROWS.filter((x) => x.bucket !== "unreachable")) {
    assert.ok(
      r.target_price_cents >= 2000,
      `${r.bucket} row ${r.card_slug} has target ${r.target_price_cents} cents — should be ≥ 2000`,
    );
  }
});

test("no seed slug duplicates a slug already in the 7-row production cooldown set", () => {
  // The 7 pre-existing rows (Sessions 27/28/30) used these slugs. The
  // seed set must NOT collide — duplicates produce a (email,card_slug)
  // collision that could deduplicate at the cron's per-slug grouping
  // step and obscure the diversification intent.
  const PRE_EXISTING = new Set([
    "base1-2-blastoise",
    "base1-4-charizard",
    "base1-6-gyarados",
    "base1-10-mewtwo",
    "base1-15-venusaur",
    "sv3pt5-199-charizard-ex",
    "swsh7-8-leafeon-vmax",
  ]);
  const overlap = SEED_ROWS.filter((r) => PRE_EXISTING.has(r.card_slug));
  assert.deepEqual(
    overlap.map((r) => r.card_slug),
    [],
    `seed overlaps existing rows: ${overlap.map((r) => r.card_slug).join(", ")}`,
  );
});
