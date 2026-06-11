// Contract tests for the wishlist scan orchestrator (migrated onto the
// VERIFIED resolver — DESIGN-VERIFIED-LISTING-RESOLVER.md §5, Tranche A #3).
// Pins:
//   1. Resolves deduplicate per card_slug (two rows watching the same
//      slug/combo → one resolve).
//   2. Per-row threshold gate — only rows whose target meets the VERIFIED
//      price get an email; others are skipped.
//   3. Stamps last_notified_at after a successful send.
//   4. Soft-fails per row — a Resend hiccup on one row doesn't kill the
//      rest of the batch.
//   5. Browse-call cap (MAX_BROWSE_CALLS) is enforced and reported via
//      capHit=true; getItem spend from the resolver trace counts against it.
//   6. Missing catalog entry → error logged, slug skipped.
//   7. THE migration's point: a null (no verified listing) NEVER alerts;
//      condition tokens map to resolver conditions; variant rows pin
//      requestedVariant; bgs-10-bl narrows by Black Label title.

import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BROWSE_CALLS,
  scanWatchlists,
  type ScanWatchlistsInput,
  type SupabaseLike,
  type WatchlistRow,
} from "../wishlist/scan-batch.ts";
import type { VerifiedListing, ResolveTrace } from "../listing/resolve.ts";

const NOW = new Date("2026-05-24T20:00:00Z");

function rows(extra: Partial<WatchlistRow>[]): WatchlistRow[] {
  return extra.map((r, i) => ({
    id: r.id ?? `row-${i}`,
    email: r.email ?? `user${i}@example.com`,
    card_slug: r.card_slug ?? "base1-4-charizard",
    target_price_cents: r.target_price_cents ?? 4000,
    variant: r.variant ?? "default",
    condition: r.condition ?? "any-raw",
    last_notified_at: r.last_notified_at ?? null,
  }));
}

function fakeSupabase(initialRows: WatchlistRow[]): {
  supabase: SupabaseLike;
  marked: Array<{ rowId: string; when: Date }>;
} {
  const marked: Array<{ rowId: string; when: Date }> = [];
  const supabase: SupabaseLike = {
    async fetchDueRows() {
      return { rows: initialRows, error: null };
    },
    async markNotified(rowId, when) {
      marked.push({ rowId, when });
      return { error: null };
    },
  };
  return { supabase, marked };
}

function fakeMetadata(name = "Charizard", setName = "Base", image = "https://img/tcg.png") {
  return async () => ({
    id: "base1-4",
    name,
    setName,
    setId: "base1",
    series: "Base",
    number: "4",
    image,
    rarity: null,
    releaseDate: null,
    types: [],
    subtypes: [],
    hp: null,
    artist: null,
    attacks: [],
    weaknesses: [],
    tcgplayerPrices: {},
    tcgplayerUpdatedAt: "",
  });
}

function verified(price: number, over: Partial<VerifiedListing> = {}): VerifiedListing {
  return {
    itemId: "v1|1|0",
    affiliateUrl: "https://www.ebay.com/itm/1?campid=555&customid=wl-base1-4-charizard",
    price,
    currency: "USD",
    title: `Verified listing @ $${price}`,
    condition: "NM",
    verifiedAspects: { set: "Base Set", number: "4/102", finish: "Holo", language: "English", graded: false },
    aspects: {},
    ...over,
  };
}

function fakeResolver(price: number): ScanWatchlistsInput["resolveListing"] {
  return async () => verified(price);
}

function baseInput(over: Partial<ScanWatchlistsInput> = {}): ScanWatchlistsInput {
  const { supabase } = fakeSupabase([]);
  return {
    supabase,
    resolveListing: fakeResolver(10),
    sendEmail: async () => ({ ok: true }),
    getCardMetadata: fakeMetadata(),
    now: NOW,
    siteUrl: "https://foiltcg.com",
    ...over,
  };
}

test("dedups resolves by card_slug — one resolve per slug regardless of row count", async () => {
  const { supabase } = fakeSupabase(
    rows([
      { id: "a", email: "a@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "b", email: "b@x.com", card_slug: "base1-4-charizard", target_price_cents: 5000 },
      { id: "c", email: "c@x.com", card_slug: "base1-4-charizard", target_price_cents: 3000 },
    ]),
  );
  let resolves = 0;
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async () => {
    resolves += 1;
    return verified(35);
  };

  const out = await scanWatchlists(baseInput({ supabase, resolveListing }));
  assert.equal(out.rowsScanned, 3);
  assert.equal(out.slugsConsidered, 1);
  assert.equal(out.browseCalls, 1, "1 search; the fake fired no trace so no getItem spend counted");
  assert.equal(resolves, 1);
});

test("splits resolves per (variant, condition) — same slug, different combo → 2 resolves (Session 49b)", async () => {
  const { supabase } = fakeSupabase(
    rows([
      { id: "a", email: "a@x.com", variant: "1st-edition-holofoil", condition: "psa-10" },
      { id: "b", email: "b@x.com", variant: "unlimited-holofoil", condition: "any-raw" },
    ]),
  );
  const seen: Array<{ requestedVariant?: string; condition: unknown }> = [];
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async (_cardId, condition, opts) => {
    seen.push({ requestedVariant: opts?.requestedVariant, condition });
    return verified(1);
  };

  const out = await scanWatchlists(baseInput({ supabase, resolveListing }));
  assert.equal(out.slugsConsidered, 1, "still one distinct slug");
  assert.equal(out.browseCalls, 2, "but two resolves — one per variant/condition combo");
  assert.equal(out.slugsWithListing, 1, "slug counted once even across combos");
  // Tokens mapped to resolver shapes: psa-10 → graded PSA 10; any-raw → ANY_RAW.
  assert.ok(
    seen.some(
      (s) =>
        s.requestedVariant === "1st-edition-holofoil" &&
        JSON.stringify(s.condition) === JSON.stringify({ graded: { service: "PSA", grade: "10" } }),
    ),
  );
  assert.ok(seen.some((s) => s.requestedVariant === "unlimited-holofoil" && s.condition === "ANY_RAW"));
});

test("a NULL resolve (no verified listing) NEVER alerts — the migration's core invariant", async () => {
  const sent: string[] = [];
  const { supabase, marked } = fakeSupabase(
    rows([{ id: "a", email: "a@x.com", target_price_cents: 100_000_000 }]),
  );
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () => null, // honest null — e.g. only a Japanese/wrong-print listing exists
      sendEmail: async (i) => {
        sent.push(i.to);
        return { ok: true };
      },
    }),
  );
  assert.equal(out.alerted, 0);
  assert.equal(sent.length, 0);
  assert.equal(marked.length, 0);
  assert.equal(out.slugsWithListing, 0);
  assert.equal(out.errors.length, 0, "an honest null is not an error");
});

test("getItem spend from the resolver trace counts against browseCalls", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "a", email: "a@x.com" }]));
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async (_c, _cond, opts) => {
    // Simulate a resolve that evaluated 3 candidates (3 getItem calls).
    opts?.onTrace?.({
      cardId: "base1-4-charizard",
      condition: "ANY_RAW",
      searchOk: true,
      searchHitCount: 10,
      prefilteredCount: 6,
      candidatesEvaluated: 3,
      candidates: [
        { itemId: "a", price: 1, rank: 0, gates: [], verdict: "rejected", reason: "x" },
        { itemId: "b", price: 2, rank: 1, gates: [], verdict: "detail_failed", reason: "x" },
        { itemId: "c", price: 3, rank: 2, gates: [], verdict: "verified", reason: "ok" },
      ],
      result: "verified",
      reason: "ok",
    } satisfies ResolveTrace);
    return verified(35);
  };
  const out = await scanWatchlists(baseInput({ supabase, resolveListing }));
  assert.equal(out.browseCalls, 4, "1 search + 3 getItem");
});

test("unknown condition token → error logged, combo skipped, no resolve", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "a", email: "a@x.com", condition: "mint-fresh-bro" }]));
  let resolves = 0;
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () => {
        resolves += 1;
        return verified(1);
      },
    }),
  );
  assert.equal(resolves, 0);
  assert.equal(out.alerted, 0);
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0].error, /unknown_condition_token/);
});

test("bgs-10-bl narrows by Black Label title — a plain BGS 10 slab never alerts", async () => {
  const { supabase } = fakeSupabase(
    rows([
      { id: "bl", email: "bl@x.com", condition: "bgs-10-bl", target_price_cents: 100_000_000 },
    ]),
  );
  // Verified BGS 10, but the title is NOT Black Label → suppressed.
  const plain = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () => verified(50, { title: "Charizard Base Set BGS 10 PRISTINE", condition: "GRADED" }),
    }),
  );
  assert.equal(plain.alerted, 0, "plain BGS 10 must not satisfy a Black Label watch");

  // Same verified grade, Black Label in the title → alerts.
  const bl = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () => verified(50, { title: "Charizard Base Set BGS 10 BLACK LABEL", condition: "GRADED" }),
    }),
  );
  assert.equal(bl.alerted, 1);
});

test("alerts only the rows whose target meets the current price", async () => {
  const sent: Array<{ to: string }> = [];
  const { supabase, marked } = fakeSupabase(
    rows([
      { id: "high", email: "h@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "low",  email: "l@x.com", card_slug: "base1-4-charizard", target_price_cents: 3000 },
    ]),
  );
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: fakeResolver(35),
      sendEmail: async (input) => {
        sent.push({ to: input.to });
        return { ok: true };
      },
    }),
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "h@x.com");
  assert.equal(out.alerted, 1);
  // last_notified_at stamped only for the row that actually fired.
  assert.equal(marked.length, 1);
  assert.equal(marked[0].rowId, "high");
  assert.equal(marked[0].when.toISOString(), NOW.toISOString());
});

test("soft-fails per row — a Resend hiccup on one row doesn't kill the batch", async () => {
  let callIdx = 0;
  const { supabase } = fakeSupabase(
    rows([
      { id: "fails",     email: "a@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "succeeds",  email: "b@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
    ]),
  );
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: fakeResolver(35),
      sendEmail: async () => {
        callIdx += 1;
        return callIdx === 1 ? { ok: false, error: "rate_limited" } : { ok: true };
      },
    }),
  );
  assert.equal(out.alerted, 1);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].stage, "send");
  assert.equal(out.errors[0].rowId, "fails");
});

test("respects the Browse-call cap and reports capHit=true", async () => {
  // Use the real catalog's Base Set slugs (base1-1 … base1-16 all exist)
  // and the per-call override on the cap so the test is deterministic.
  const realCatalogSlugs = [
    "base1-1-alakazam", "base1-2-blastoise", "base1-3-chansey", "base1-4-charizard",
    "base1-5-clefairy", "base1-6-gyarados", "base1-7-hitmonchan", "base1-8-machamp",
    "base1-9-magneton", "base1-10-mewtwo",
  ];
  const inputRows = realCatalogSlugs.map((slug, i) => ({
    id: `row-${i}`,
    email: `u${i}@x.com`,
    card_slug: slug,
    target_price_cents: 100_000_000, // any price meets this
    variant: "default",
    condition: "any-raw",
    last_notified_at: null,
  }));
  const { supabase } = fakeSupabase(inputRows);

  let resolves = 0;
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async () => {
    resolves += 1;
    return verified(1);
  };

  const CAP = 3;
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing,
      maxBrowseCalls: CAP,
    }),
  );
  assert.equal(out.browseCalls, CAP);
  assert.equal(resolves, CAP);
  assert.equal(out.capHit, true);
  // Only the first CAP slugs were evaluated, so alerts are ≤ CAP rows.
  assert.ok(out.alerted <= CAP);
});

test("respects the 24h cooldown — rows with recent last_notified_at filtered upstream by SQL, not re-checked here", async () => {
  // scan-batch trusts the SupabaseLike contract: fetchDueRows already
  // applied the 24h filter. This test pins that we don't double-filter
  // by accident — if fetchDueRows returns a row, we evaluate it.
  const { supabase, marked } = fakeSupabase(
    rows([
      {
        id: "stale-but-returned",
        email: "u@x.com",
        card_slug: "base1-4-charizard",
        target_price_cents: 4000,
        // Stale per the SQL filter but it's been returned to us anyway.
        last_notified_at: new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      },
    ]),
  );
  const out = await scanWatchlists(baseInput({ supabase, resolveListing: fakeResolver(35) }));
  assert.equal(out.alerted, 1);
  assert.equal(marked.length, 1);
});

test("logs an error and skips a slug that isn't in the catalog", async () => {
  const { supabase } = fakeSupabase(
    rows([{ id: "missing", email: "u@x.com", card_slug: "totally-fake-slug" }]),
  );
  const out = await scanWatchlists(baseInput({ supabase }));
  assert.equal(out.browseCalls, 0);
  assert.equal(out.alerted, 0);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].stage, "catalog_lookup");
});

test("propagates fetchDueRows error as a single error entry and returns empty stats", async () => {
  const supabase: SupabaseLike = {
    async fetchDueRows() {
      return { rows: [], error: "db_unreachable" };
    },
    async markNotified() {
      return { error: null };
    },
  };
  const out = await scanWatchlists(baseInput({ supabase }));
  assert.equal(out.rowsScanned, 0);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].stage, "fetch_rows");
  assert.equal(out.errors[0].error, "db_unreachable");
});
