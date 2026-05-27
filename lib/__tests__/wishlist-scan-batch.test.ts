// Contract tests for the wishlist scan orchestrator. Pins:
//   1. Browse calls deduplicate per card_slug (two rows watching the same
//      slug → one Browse call).
//   2. Per-row threshold gate — only rows whose target meets the current
//      price get an email; others are skipped.
//   3. Stamps last_notified_at after a successful send.
//   4. Soft-fails per row — a Resend hiccup on one row doesn't kill the
//      rest of the batch.
//   5. Browse-call cap (MAX_BROWSE_CALLS) is enforced and reported via
//      capHit=true.
//   6. Missing catalog entry → error logged, slug skipped.

import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BROWSE_CALLS,
  scanWatchlists,
  type ScanWatchlistsInput,
  type SupabaseLike,
  type WatchlistRow,
} from "../wishlist/scan-batch.ts";

const NOW = new Date("2026-05-24T20:00:00Z");

function rows(extra: Partial<WatchlistRow>[]): WatchlistRow[] {
  return extra.map((r, i) => ({
    id: r.id ?? `row-${i}`,
    email: r.email ?? `user${i}@example.com`,
    card_slug: r.card_slug ?? "base1-4-charizard",
    target_price_cents: r.target_price_cents ?? 4000,
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

function fakeListing(price: number, affiliateUrl = "https://www.ebay.com/itm/1?campid=555&customid=foil-wishlist-alert") {
  return async () => ({
    title: `Listing @ $${price}`,
    image: "https://img/listing.jpg",
    price,
    currency: "USD",
    affiliateUrl,
  });
}

function baseInput(over: Partial<ScanWatchlistsInput> = {}): ScanWatchlistsInput {
  const { supabase } = fakeSupabase([]);
  return {
    supabase,
    getBestListing: fakeListing(10),
    sendEmail: async () => ({ ok: true }),
    getCardMetadata: fakeMetadata(),
    now: NOW,
    siteUrl: "https://foiltcg.com",
    ...over,
  };
}

test("dedups Browse calls by card_slug — one Browse call per slug regardless of row count", async () => {
  const { supabase } = fakeSupabase(
    rows([
      { id: "a", email: "a@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "b", email: "b@x.com", card_slug: "base1-4-charizard", target_price_cents: 5000 },
      { id: "c", email: "c@x.com", card_slug: "base1-4-charizard", target_price_cents: 3000 },
    ]),
  );
  let browseCalls = 0;
  const getBestListing = (async () => {
    browseCalls += 1;
    return fakeListing(35)();
  }) as ScanWatchlistsInput["getBestListing"];

  const out = await scanWatchlists(baseInput({ supabase, getBestListing }));
  assert.equal(out.rowsScanned, 3);
  assert.equal(out.slugsConsidered, 1);
  assert.equal(out.browseCalls, 1);
  assert.equal(browseCalls, 1);
});

test("alerts only the rows whose target meets the current price", async () => {
  // Two rows watching same slug at $40 and $30 targets; current price = $35
  // → only the $40 row alerts.
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
      getBestListing: fakeListing(35),
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
      getBestListing: fakeListing(35),
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
    last_notified_at: null,
  }));
  const { supabase } = fakeSupabase(inputRows);

  let browseCalls = 0;
  const getBestListing = (async () => {
    browseCalls += 1;
    return fakeListing(1)();
  }) as ScanWatchlistsInput["getBestListing"];

  const CAP = 3;
  const out = await scanWatchlists(
    baseInput({
      supabase,
      getBestListing,
      maxBrowseCalls: CAP,
    }),
  );
  assert.equal(out.browseCalls, CAP);
  assert.equal(browseCalls, CAP);
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
  const out = await scanWatchlists(baseInput({ supabase, getBestListing: fakeListing(35) }));
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
