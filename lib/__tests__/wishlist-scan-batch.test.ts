// Contract tests for the wishlist scan orchestrator, rebuilt on the honest
// event model (alert-engine-rebuild, ADR-091). Pins the batch mechanics AND
// the goal's acceptance criteria end-to-end through the scan:
//   1. Resolve dedup per (slug, variant, condition) + Browse-call cap +
//      verified-only gating (kept from the Tranche-A migration — the
//      resolver's identity gates are the ONLY path to an email).
//   2. Below-target at FIRST scan → one "already below" email, then silence
//      on the next scan (state 'fired').
//   3. Oscillation around target → exactly one alert until price exits the
//      hysteresis band upward (re-arm), then a real "dropped" on re-cross.
//   4. A GBP listing (fixture 12 — the Moonbreon false deal) NEVER alerts and
//      never writes a baseline.
//   5. Blank target (null) alerts only at ≥15% under the 30-day sold avg;
//      with no comp it never fires (heldNoBasis).
//   6. Baseline freshness: last_seen_price_cents written on EVERY evaluation.
//   7. Send failure → observation recorded but state stays 'armed' (the next
//      scan retries honestly as "already below").

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  scanWatchlists,
  type ScanWatchlistsInput,
  type SupabaseLike,
  type WatchlistRow,
  type WatchStatePatch,
} from "../wishlist/scan-batch.ts";
import type { SoldComp } from "../wishlist/alert-decision.ts";
import type { VerifiedListing, ResolveTrace } from "../listing/resolve.ts";

const NOW = new Date("2026-07-01T20:00:00Z");
const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function rows(extra: Partial<WatchlistRow>[]): WatchlistRow[] {
  return extra.map((r, i) => ({
    id: r.id ?? `row-${i}`,
    email: r.email ?? `user${i}@example.com`,
    card_slug: r.card_slug ?? "base1-4-charizard",
    target_price_cents: r.target_price_cents !== undefined ? r.target_price_cents : 4000,
    variant: r.variant ?? "default",
    condition: r.condition ?? "any-raw",
    last_notified_at: r.last_notified_at ?? null,
    last_seen_price_cents: r.last_seen_price_cents ?? null,
    alert_state: r.alert_state ?? "armed",
  }));
}

function fakeSupabase(initialRows: WatchlistRow[]): {
  supabase: SupabaseLike;
  patches: Array<{ rowId: string; patch: WatchStatePatch }>;
} {
  const patches: Array<{ rowId: string; patch: WatchStatePatch }> = [];
  const supabase: SupabaseLike = {
    async fetchDueRows() {
      return { rows: initialRows, error: null };
    },
    async updateWatchState(rowId, patch) {
      patches.push({ rowId, patch });
      return { error: null };
    },
  };
  return { supabase, patches };
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

const NO_COMP: ScanWatchlistsInput["getSoldComp"] = async () => null;

function comp(avg30dCents: number): SoldComp {
  return { avg30dCents, saleCount: 12, tierLabel: "Near Mint", computedAt: NOW.toISOString(), soldAsOfIso: null };
}

function baseInput(over: Partial<ScanWatchlistsInput> = {}): ScanWatchlistsInput {
  const { supabase } = fakeSupabase([]);
  return {
    supabase,
    resolveListing: fakeResolver(10),
    sendEmail: async () => ({ ok: true }),
    getSoldComp: NO_COMP,
    getCardMetadata: fakeMetadata(),
    now: NOW,
    siteUrl: "https://foiltcg.com",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Batch mechanics (kept behaviors from the Tranche-A migration)
// ---------------------------------------------------------------------------

test("dedups resolves by card_slug — one resolve per slug regardless of row count", async () => {
  const { supabase } = fakeSupabase(
    rows([
      { id: "a", email: "a@x.com", target_price_cents: 4000 },
      { id: "b", email: "b@x.com", target_price_cents: 5000 },
      { id: "c", email: "c@x.com", target_price_cents: 3000 },
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
  assert.equal(out.browseCalls, 1);
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
  assert.equal(out.slugsConsidered, 1);
  assert.equal(out.browseCalls, 2);
  assert.equal(out.slugsWithListing, 1);
  assert.ok(
    seen.some(
      (s) =>
        s.requestedVariant === "1st-edition-holofoil" &&
        JSON.stringify(s.condition) === JSON.stringify({ graded: { service: "PSA", grade: "10" } }),
    ),
  );
  assert.ok(seen.some((s) => s.requestedVariant === "unlimited-holofoil" && s.condition === "ANY_RAW"));
});

test("a NULL resolve (no verified listing) NEVER alerts — the resolver gate is untouched", async () => {
  const sent: string[] = [];
  const { supabase, patches } = fakeSupabase(rows([{ id: "a", email: "a@x.com", target_price_cents: 9_999_999 }]));
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () => null,
      sendEmail: async (i) => {
        sent.push(i.to);
        return { ok: true };
      },
    }),
  );
  assert.equal(out.alerted, 0);
  assert.equal(sent.length, 0);
  assert.equal(patches.length, 0, "no observation, no baseline write");
  assert.equal(out.errors.length, 0, "an honest null is not an error");
});

test("getItem spend from the resolver trace counts against browseCalls", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "a", email: "a@x.com" }]));
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async (_c, _cond, opts) => {
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
  // Target sized realistically vs the $50 listing: the ADR-103 plausibility
  // guard suppresses basis-less fires deeper than 65% under the user's own
  // target, and the old 9_999_999 "alert on anything" fixture target was
  // exactly that (correctly) suppressed class. $55 target isolates the
  // Black-Label narrowing this test is about.
  const mk = () =>
    fakeSupabase(rows([{ id: "bl", email: "bl@x.com", condition: "bgs-10-bl", target_price_cents: 5_500 }]));
  const plain = await scanWatchlists(
    baseInput({
      supabase: mk().supabase,
      resolveListing: async () => verified(50, { title: "Charizard Base Set BGS 10 PRISTINE", condition: "GRADED" }),
    }),
  );
  assert.equal(plain.alerted, 0);
  const bl = await scanWatchlists(
    baseInput({
      supabase: mk().supabase,
      resolveListing: async () => verified(50, { title: "Charizard Base Set BGS 10 BLACK LABEL", condition: "GRADED" }),
    }),
  );
  assert.equal(bl.alerted, 1);
});

test("respects the Browse-call cap and reports capHit=true", async () => {
  const realCatalogSlugs = [
    "base1-1-alakazam", "base1-2-blastoise", "base1-3-chansey", "base1-4-charizard",
    "base1-5-clefairy", "base1-6-gyarados", "base1-7-hitmonchan", "base1-8-machamp",
    "base1-9-magneton", "base1-10-mewtwo",
  ];
  const inputRows = rows(
    realCatalogSlugs.map((slug, i) => ({
      id: `row-${i}`,
      email: `u${i}@x.com`,
      card_slug: slug,
      target_price_cents: 9_999_999,
    })),
  );
  const { supabase } = fakeSupabase(inputRows);
  let resolves = 0;
  const resolveListing: ScanWatchlistsInput["resolveListing"] = async () => {
    resolves += 1;
    return verified(1);
  };
  const CAP = 3;
  const out = await scanWatchlists(baseInput({ supabase, resolveListing, maxBrowseCalls: CAP }));
  assert.equal(out.browseCalls, CAP);
  assert.equal(resolves, CAP);
  assert.equal(out.capHit, true);
});

test("propagates fetchDueRows error as a single error entry and returns empty stats", async () => {
  const supabase: SupabaseLike = {
    async fetchDueRows() {
      return { rows: [], error: "db_unreachable" };
    },
    async updateWatchState() {
      return { error: null };
    },
  };
  const out = await scanWatchlists(baseInput({ supabase }));
  assert.equal(out.rowsScanned, 0);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].stage, "fetch_rows");
});

test("logs an error and skips a slug that isn't in the catalog", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "missing", email: "u@x.com", card_slug: "totally-fake-slug" }]));
  const out = await scanWatchlists(baseInput({ supabase }));
  assert.equal(out.browseCalls, 0);
  assert.equal(out.alerted, 0);
  assert.equal(out.errors[0].stage, "catalog_lookup");
});

// ---------------------------------------------------------------------------
// ACCEPTANCE — the event model (ADR-091)
// ---------------------------------------------------------------------------

test("ACCEPTANCE: below-target at first scan → ONE honest 'already below' email, then silence", async () => {
  const sent: Array<{ subject: string; html: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push({ subject: i.subject, html: i.html });
    return { ok: true };
  };

  // Scan 1: fresh watch (no baseline), price $35 already under the $40 target.
  const scan1 = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: 4000 }]));
  const out1 = await scanWatchlists(
    baseInput({ supabase: scan1.supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.equal(out1.alerted, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /is \$35\.00/, "first-observation subject must NOT claim a drop");
  assert.doesNotMatch(sent[0].subject, /dropped/);
  assert.match(sent[0].html, /already at \$35\.00/);
  // State transitioned to fired with the baseline + alert stamps. Since
  // alert-digest-batching, a firing row takes TWO writes: the observation
  // (baseline) at evaluation time, then the 'fired' stamp after the batched
  // send succeeds — so assert on the stamp write, not the first patch.
  const observed = scan1.patches.find((p) => p.rowId === "w");
  assert.equal(observed?.patch.last_seen_price_cents, 3500, "observation recorded at evaluation time");
  const fired = scan1.patches.filter((p) => p.rowId === "w").at(-1);
  assert.equal(fired?.patch.alert_state, "fired");
  assert.equal(fired?.patch.last_alerted_price_cents, 3500);

  // Scan 2: same price, state now 'fired' → SILENCE (but baseline still written).
  const scan2 = fakeSupabase(
    rows([
      {
        id: "w",
        email: "w@x.com",
        target_price_cents: 4000,
        last_seen_price_cents: 3500,
        alert_state: "fired",
      },
    ]),
  );
  const out2 = await scanWatchlists(
    baseInput({ supabase: scan2.supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.equal(out2.alerted, 0, "no re-alert while fired");
  assert.equal(sent.length, 1, "still exactly one email");
  assert.equal(scan2.patches.length, 1, "baseline freshness: the evaluation is still recorded");
  assert.equal(scan2.patches[0].patch.last_seen_price_cents, 3500);
  assert.equal(scan2.patches[0].patch.alert_state, undefined, "no state change");
});

test("ACCEPTANCE: oscillation around target fires once; re-arms only past the hysteresis band; re-cross is a real 'dropped'", async () => {
  const sent: Array<{ subject: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push({ subject: i.subject });
    return { ok: true };
  };
  const target = 4000; // $40 → re-arm above $42 (5% hysteresis)

  // Fired at $39.50; price oscillates to $40.50 (inside the band) → stays fired.
  const inBand = fakeSupabase(
    rows([{ id: "w", email: "w@x.com", target_price_cents: target, last_seen_price_cents: 3950, alert_state: "fired" }]),
  );
  const outInBand = await scanWatchlists(
    baseInput({ supabase: inBand.supabase, resolveListing: fakeResolver(40.5), sendEmail }),
  );
  assert.equal(outInBand.alerted, 0);
  assert.equal(outInBand.rearmed, 0, "$40.50 is inside the $42 band — no re-arm");
  assert.equal(inBand.patches[0].patch.alert_state, undefined);

  // Price exits the band upward ($45 > $42) → re-armed, still no alert.
  const exits = fakeSupabase(
    rows([{ id: "w", email: "w@x.com", target_price_cents: target, last_seen_price_cents: 4050, alert_state: "fired" }]),
  );
  const outExits = await scanWatchlists(
    baseInput({ supabase: exits.supabase, resolveListing: fakeResolver(45), sendEmail }),
  );
  assert.equal(outExits.alerted, 0);
  assert.equal(outExits.rearmed, 1);
  assert.equal(exits.patches[0].patch.alert_state, "armed");

  // Armed again with a seen price above target → the next cross is a REAL drop.
  const recross = fakeSupabase(
    rows([{ id: "w", email: "w@x.com", target_price_cents: target, last_seen_price_cents: 4500, alert_state: "armed" }]),
  );
  const outRecross = await scanWatchlists(
    baseInput({ supabase: recross.supabase, resolveListing: fakeResolver(38), sendEmail }),
  );
  assert.equal(outRecross.alerted, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /dropped to \$38\.00/, "an observed cross earns the word 'dropped'");
});

test("ACCEPTANCE: GBP listing (fixture 12, the Moonbreon false deal) never alerts, never writes a baseline", async () => {
  const fixture = JSON.parse(
    readFileSync(join(ROOT, "lib/__fixtures__/ebay-listings/12-moonbreon-uk-gbp-lp.json"), "utf8"),
  ) as { price: number; currency: string; title: string; itemId: string };
  assert.equal(fixture.currency, "GBP", "fixture must stay GBP — it IS the regression");

  const sent: string[] = [];
  const { supabase, patches } = fakeSupabase(
    rows([{ id: "w", email: "w@x.com", target_price_cents: 200_000 }]), // $2,000 target — £1,000 would "clear" it numerically
  );
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: async () =>
        verified(fixture.price, { currency: fixture.currency, title: fixture.title, itemId: fixture.itemId }),
      sendEmail: async (i) => {
        sent.push(i.subject);
        return { ok: true };
      },
    }),
  );
  assert.equal(out.alerted, 0, "a GBP figure must never clear a USD target");
  assert.equal(out.skippedNonUsd, 1);
  assert.equal(sent.length, 0);
  assert.equal(patches.length, 0, "a GBP price is not an observation on the USD axis");
});

test("ACCEPTANCE: blank target alerts only at ≥15% under the 30-day sold average", async () => {
  const sent: Array<{ subject: string; html: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push({ subject: i.subject, html: i.html });
    return { ok: true };
  };
  const avg = comp(10000); // $100 avg → floor $85

  // $90 listing: only 10% under → NO alert.
  const above = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: null }]));
  const outAbove = await scanWatchlists(
    baseInput({ supabase: above.supabase, resolveListing: fakeResolver(90), getSoldComp: async () => avg, sendEmail }),
  );
  assert.equal(outAbove.alerted, 0);
  assert.equal(above.patches[0].patch.last_seen_price_cents, 9000, "held rows still record the baseline");

  // $80 listing: 20% under → fires, market basis, evidence line cites the comp.
  const under = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: null }]));
  const outUnder = await scanWatchlists(
    baseInput({ supabase: under.supabase, resolveListing: fakeResolver(80), getSoldComp: async () => avg, sendEmail }),
  );
  assert.equal(outUnder.alerted, 1);
  assert.match(sent[0].subject, /20% under what it usually sells for/);
  // The evidence line names the tier and DATES the comp (audit 2026-07-14).
  // This fixture's comp carries no sold_as_of, so it must disclose that rather
  // than re-assert an undatable "last 30 days".
  assert.match(sent[0].html, /Usually sells for \$100\.00 \(Near Mint, sale date unknown\)/);
  assert.doesNotMatch(sent[0].subject, /100000/, "the sentinel string must never render");
  assert.doesNotMatch(sent[0].html, /100000/);
});

test("ACCEPTANCE: blank target with NO sold comp never fires (heldNoBasis) — nothing to measure against", async () => {
  const { supabase, patches } = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: null }]));
  const out = await scanWatchlists(
    baseInput({ supabase, resolveListing: fakeResolver(1), getSoldComp: NO_COMP }),
  );
  assert.equal(out.alerted, 0);
  assert.equal(out.heldNoBasis, 1);
  assert.equal(patches[0].patch.last_seen_price_cents, 100, "observation still recorded");
});

test("send failure records the observation but does NOT transition to 'fired' — the retry stays honest", async () => {
  const { supabase, patches } = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: 4000 }]));
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: fakeResolver(35),
      sendEmail: async () => ({ ok: false, error: "rate_limited" }),
    }),
  );
  assert.equal(out.alerted, 0);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].stage, "send");
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch.last_seen_price_cents, 3500);
  assert.equal(patches[0].patch.alert_state, undefined, "no fired transition on a failed send");
});

test("soft-fails per row — a Resend hiccup on one row doesn't kill the batch", async () => {
  let callIdx = 0;
  const { supabase } = fakeSupabase(
    rows([
      { id: "fails", email: "a@x.com", target_price_cents: 4000 },
      { id: "succeeds", email: "b@x.com", target_price_cents: 4000 },
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
  assert.equal(out.errors[0].rowId, "fails");
});

test("explicit-target row above the market floor: the floor can lift the trigger (max of the two), copy stays market-basis", async () => {
  // $30 target on a $100-avg card: effective = max($30, $85) = $85. A $75
  // listing fires on the MARKET basis (user's own target wasn't met).
  const sent: Array<{ subject: string }> = [];
  const { supabase } = fakeSupabase(rows([{ id: "w", email: "w@x.com", target_price_cents: 3000 }]));
  const out = await scanWatchlists(
    baseInput({
      supabase,
      resolveListing: fakeResolver(75),
      getSoldComp: async () => comp(10000),
      sendEmail: async (i) => {
        sent.push({ subject: i.subject });
        return { ok: true };
      },
    }),
  );
  assert.equal(out.alerted, 1);
  assert.match(sent[0].subject, /under what it usually sells for/);
  assert.doesNotMatch(sent[0].subject, /\$30\.00 target/, "must not claim the user's target was met");
});

// ---------------------------------------------------------------------------
// alert-digest-batching — the send-boundary contract (2026-07-02).
// ONE email per subscriber per run; these five tests ARE the contract.
// ---------------------------------------------------------------------------

const TEN_SLUGS = [
  "base1-4-charizard",
  "swsh35-74-charizard-vmax-rainbow-rare",
  "swsh12-186-lugia-v-alt-art",
  "swsh7-215-umbreon-vmax-alt-art",
  "swsh8-269-mew-vmax-alt-art",
  "swsh11-186-giratina-v-alt-art",
  "swsh7-218-rayquaza-vmax-alt-art",
  "swsh4-188-pikachu-vmax-rainbow",
  "swsh7-214-umbreon-vmax",
  "swsh7-95-umbreon-vmax",
] as const;

test("BATCH GROUPING: 10 fired cards, 1 user -> exactly ONE email listing all 10", async () => {
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push(i);
    return { ok: true };
  };
  const { supabase } = fakeSupabase(
    rows(TEN_SLUGS.map((slug, i) => ({ id: `r${i}`, email: "one@x.com", card_slug: slug, target_price_cents: 4000 }))),
  );
  const out = await scanWatchlists(
    baseInput({ supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.equal(sent.length, 1, "exactly one email for the whole run");
  assert.equal(sent[0].to, "one@x.com");
  assert.equal(sent[0].subject, "10 of your cards hit good buys today");
  for (const slug of TEN_SLUGS) {
    assert.ok(sent[0].html.includes(`/cards/${slug}`), `digest must list ${slug}`);
  }
  assert.equal(out.alerted, 10);
  assert.equal(out.subscribersEmailed, 1);
  assert.equal(out.dupesMerged, 0);
});

test("BATCH ISOLATION: 2 users in one run -> 2 emails, ZERO cross-user card leakage", async () => {
  const sent: Array<{ to: string; html: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push({ to: i.to, html: i.html });
    return { ok: true };
  };
  const { supabase } = fakeSupabase(
    rows([
      { id: "a1", email: "a@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "b1", email: "b@x.com", card_slug: "swsh12-186-lugia-v-alt-art", target_price_cents: 4000 },
    ]),
  );
  const out = await scanWatchlists(
    baseInput({ supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.equal(sent.length, 2);
  assert.equal(out.subscribersEmailed, 2);
  const toA = sent.find((s) => s.to === "a@x.com");
  const toB = sent.find((s) => s.to === "b@x.com");
  assert.ok(toA && toB, "each user gets their own email");
  // A privacy leak here is an incident — pin both directions hard.
  assert.ok(toA!.html.includes("/cards/base1-4-charizard"), "A sees A's card");
  assert.ok(!toA!.html.includes("/cards/swsh12-186-lugia-v-alt-art"), "A must NEVER see B's card");
  assert.ok(toB!.html.includes("/cards/swsh12-186-lugia-v-alt-art"), "B sees B's card");
  assert.ok(!toB!.html.includes("/cards/base1-4-charizard"), "B must NEVER see A's card");
  assert.ok(!toB!.html.includes("a@x.com") && !toA!.html.includes("b@x.com"), "no address leakage either");
});

test("BATCH DEDUPE: same (user, card) firing via two combos -> one entry, reasons merged, target framing wins", async () => {
  const sent: Array<{ subject: string; html: string }> = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push({ subject: i.subject, html: i.html });
    return { ok: true };
  };
  // Two rows for the SAME card + user in DIFFERENT combos (the two-Blastoise
  // class): one blank-target (market basis via comp), one explicit target.
  const fake = fakeSupabase(
    rows([
      { id: "m", email: "dupe@x.com", card_slug: "base1-4-charizard", target_price_cents: null, condition: "any-raw" },
      { id: "t", email: "dupe@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000, condition: "nm" },
    ]),
  );
  const out = await scanWatchlists(
    baseInput({
      supabase: fake.supabase,
      resolveListing: fakeResolver(35),
      sendEmail,
      getSoldComp: async () => comp(10000),
    }),
  );
  assert.equal(sent.length, 1, "ONE email, not two");
  assert.equal(out.dupesMerged, 1);
  assert.equal(out.subscribersEmailed, 1);
  assert.equal(out.alerted, 2, "both rows counted + stamped");
  // After the merge it is a single-card email and the explicit-target framing
  // won the copy (its evidence line already carries the market comparison).
  assert.match(sent[0].subject, /at your \$40\.00 target/);
  // BOTH rows got their fired stamp.
  for (const id of ["m", "t"]) {
    const last = fake.patches.filter((p) => p.rowId === id).at(-1);
    assert.equal(last?.patch.alert_state, "fired", `row ${id} must be stamped fired`);
  }
});

test("BATCH IDEMPOTENCY: re-running the send step for the same run resends nothing", async () => {
  const sent: string[] = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    sent.push(i.to);
    return { ok: true };
  };
  // Run 1 fires + stamps.
  const run1 = fakeSupabase(rows([{ id: "w", email: "idem@x.com", target_price_cents: 4000 }]));
  await scanWatchlists(baseInput({ supabase: run1.supabase, resolveListing: fakeResolver(35), sendEmail }));
  assert.equal(sent.length, 1);
  // Run 2 with the post-run-1 row state (fired + baseline): nothing resends.
  const run2 = fakeSupabase(
    rows([
      { id: "w", email: "idem@x.com", target_price_cents: 4000, alert_state: "fired", last_seen_price_cents: 3500 },
    ]),
  );
  const out2 = await scanWatchlists(
    baseInput({ supabase: run2.supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.equal(sent.length, 1, "no resend on re-run");
  assert.equal(out2.alerted, 0);
  assert.equal(out2.subscribersEmailed, 0);
});

test("BATCH SOFT-FAIL: one subscriber's send failure never blocks the rest of the run", async () => {
  const sent: string[] = [];
  const sendEmail: ScanWatchlistsInput["sendEmail"] = async (i) => {
    if (i.to === "down@x.com") return { ok: false, error: "provider_500" };
    sent.push(i.to);
    return { ok: true };
  };
  const fake = fakeSupabase(
    rows([
      { id: "d1", email: "down@x.com", card_slug: "base1-4-charizard", target_price_cents: 4000 },
      { id: "u1", email: "up@x.com", card_slug: "swsh12-186-lugia-v-alt-art", target_price_cents: 4000 },
    ]),
  );
  const out = await scanWatchlists(
    baseInput({ supabase: fake.supabase, resolveListing: fakeResolver(35), sendEmail }),
  );
  assert.deepEqual(sent, ["up@x.com"], "the healthy subscriber still gets their email");
  assert.equal(out.subscribersEmailed, 1);
  assert.ok(out.errors.some((e) => e.stage === "send" && e.rowId === "d1"), "the failure is recorded per row");
  // The failed subscriber's row stays armed (observation only) -> retries next run.
  const dLast = fake.patches.filter((p) => p.rowId === "d1").at(-1);
  assert.equal(dLast?.patch.alert_state, undefined, "no fired stamp on a failed send");
  const uLast = fake.patches.filter((p) => p.rowId === "u1").at(-1);
  assert.equal(uLast?.patch.alert_state, "fired");
});
