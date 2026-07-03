// Alert plausibility guard (alert-plausibility-guard, ADR-103).
//
// Pins the live 2026-07-03 03:08 incident end-to-end (would-have-mailed →
// now suppressed with a logged reason), the band's threshold boundaries
// (a real 35%-under fire-sale still mails), the basis-less dramatic-delta
// suppression (null-over-guess for deals), and the counter surface the cron
// posts to Discord. The incident listing is reconstructed in
// lib/__fixtures__/ebay-listings/13-umbreon-ex-sir-cheap-printing-scam-class.json.

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
import {
  assessAlertPlausibility,
  PLAUSIBLE_FLOOR_FRACTION,
} from "../wishlist/alert-plausibility.ts";
import type { SoldComp } from "../wishlist/alert-decision.ts";
import type { VerifiedListing } from "../listing/resolve.ts";

const NOW = new Date("2026-07-03T10:08:00Z");
const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// The incident figures, straight from the alert email John received.
const INCIDENT_PRICE_CENTS = 5724; // $57.24
const INCIDENT_BASIS_CENTS = 124486; // $1,244.86 30-day sold avg

const FIXTURE = JSON.parse(
  readFileSync(
    join(ROOT, "lib/__fixtures__/ebay-listings/13-umbreon-ex-sir-cheap-printing-scam-class.json"),
    "utf8",
  ),
) as { title: string; price: { value: string; currency: string } };

function comp(avg30dCents: number): SoldComp {
  return { avg30dCents, saleCount: 34, tierLabel: "Near Mint", computedAt: NOW.toISOString() };
}

function rows(extra: Partial<WatchlistRow>[]): WatchlistRow[] {
  return extra.map((r, i) => ({
    id: r.id ?? `row-${i}`,
    email: r.email ?? `user${i}@example.com`,
    card_slug: r.card_slug ?? "sv8pt5-161-umbreon-ex",
    target_price_cents: r.target_price_cents !== undefined ? r.target_price_cents : null,
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
  return {
    supabase: {
      async fetchDueRows() {
        return { rows: initialRows, error: null };
      },
      async updateWatchState(rowId, patch) {
        patches.push({ rowId, patch });
        return { error: null };
      },
    },
    patches,
  };
}

function verified(priceUsd: number, title: string): VerifiedListing {
  return {
    itemId: "v1|13|0",
    affiliateUrl: "https://www.ebay.com/itm/13?campid=555&customid=wl-sv8pt5-161-umbreon-ex",
    price: priceUsd,
    currency: "USD",
    title,
    condition: "NM",
    // The incident's admission shape: name + set verified, NUMBER ABSENT
    // (corroboration unavailable) — identity passed it; the band catches it.
    verifiedAspects: { set: "Prismatic Evolutions", number: null, finish: null, language: "English", graded: false },
    aspects: {},
  };
}

function input(over: Partial<ScanWatchlistsInput>): ScanWatchlistsInput {
  const { supabase } = fakeSupabase([]);
  return {
    supabase,
    resolveListing: async () => verified(10, "x"),
    sendEmail: async () => ({ ok: true }),
    getSoldComp: async () => null,
    getCardMetadata: async () => ({
      id: "sv8pt5-161",
      name: "Umbreon ex",
      setName: "Prismatic Evolutions",
      setId: "sv8pt5",
      series: "Scarlet & Violet",
      number: "161",
      image: "https://img/x.png",
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
    }),
    now: NOW,
    siteUrl: "https://foiltcg.com",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// The incident, end-to-end: would have mailed, now suppressed with reason.
// ---------------------------------------------------------------------------

test("THE $57.24 INCIDENT: a junk-priced listing against a $1,244.86 basis never mails — suppressed + counted + observation still recorded", async () => {
  const { supabase, patches } = fakeSupabase(
    rows([{ id: "eve-class", email: "collector@example.com", target_price_cents: null }]),
  );
  const emails: string[] = [];
  const result = await scanWatchlists(
    input({
      supabase,
      resolveListing: async () =>
        verified(Number(FIXTURE.price.value), FIXTURE.title),
      getSoldComp: async () => comp(INCIDENT_BASIS_CENTS),
      sendEmail: async (msg) => {
        emails.push(msg.subject);
        return { ok: true };
      },
    }),
  );
  assert.equal(emails.length, 0, "the scam-class listing must never be mailed");
  assert.equal(result.alerted, 0);
  assert.equal(result.suppressedImplausible.length, 1, "suppression is counted");
  const s = result.suppressedImplausible[0];
  assert.equal(s.cardSlug, "sv8pt5-161-umbreon-ex");
  assert.equal(s.priceCents, INCIDENT_PRICE_CENTS);
  assert.equal(s.basisCents, INCIDENT_BASIS_CENTS);
  assert.equal(s.reason, "under_sold_basis");
  assert.match(s.detail, /95% under/, "the logged detail names the delta");
  // The observation still recorded (we DID see the price) and the row stays
  // armed — hysteresis untouched, no fired stamp.
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch.last_seen_price_cents, INCIDENT_PRICE_CENTS);
  assert.notEqual(patches[0].patch.alert_state, "fired");
});

// ---------------------------------------------------------------------------
// Threshold boundaries: real deals mail, junk doesn't.
// ---------------------------------------------------------------------------

test("a real 35%-under fire-sale still mails (the band keeps real deals)", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "deal", target_price_cents: null }]));
  const emails: string[] = [];
  const basis = 100_000; // $1,000
  const result = await scanWatchlists(
    input({
      supabase,
      resolveListing: async () => verified(650, "Umbreon ex SIR real fire sale"), // $650 = 65% of basis
      getSoldComp: async () => comp(basis),
      sendEmail: async (msg) => {
        emails.push(msg.subject);
        return { ok: true };
      },
    }),
  );
  assert.equal(result.suppressedImplausible.length, 0);
  assert.equal(result.alerted, 1);
  assert.equal(emails.length, 1);
});

test("band boundary: just above the floor mails, just below suppresses", () => {
  const basis = 100_000;
  const floor = basis * PLAUSIBLE_FLOOR_FRACTION;
  const above = assessAlertPlausibility({ currentPriceCents: floor + 1, comp: comp(basis), targetPriceCents: null });
  const below = assessAlertPlausibility({ currentPriceCents: floor - 1, comp: comp(basis), targetPriceCents: null });
  assert.equal(above.plausible, true);
  assert.equal(below.plausible, false);
});

// ---------------------------------------------------------------------------
// Null-over-guess: no sold basis → no dramatic-delta alert.
// ---------------------------------------------------------------------------

test("no sold basis + deep under the user's own target = suppressed (dramatic delta with nothing to stand on)", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "nb", target_price_cents: 100_000 }]));
  const emails: string[] = [];
  const result = await scanWatchlists(
    input({
      supabase,
      resolveListing: async () => verified(57.24, FIXTURE.title), // $57 vs $1,000 target, no comp
      getSoldComp: async () => null,
      sendEmail: async (msg) => {
        emails.push(msg.subject);
        return { ok: true };
      },
    }),
  );
  assert.equal(emails.length, 0);
  assert.equal(result.suppressedImplausible.length, 1);
  assert.equal(result.suppressedImplausible[0].reason, "under_target_no_basis");
});

test("no sold basis + a modest under-target price keeps ADR-091 semantics and mails", async () => {
  const { supabase } = fakeSupabase(rows([{ id: "ok", target_price_cents: 6_000 }]));
  const emails: string[] = [];
  const result = await scanWatchlists(
    input({
      supabase,
      resolveListing: async () => verified(55, "Umbreon ex regular printing"), // $55 vs $60 target
      getSoldComp: async () => null,
      sendEmail: async (msg) => {
        emails.push(msg.subject);
        return { ok: true };
      },
    }),
  );
  assert.equal(result.suppressedImplausible.length, 0);
  assert.equal(emails.length, 1);
});

// ---------------------------------------------------------------------------
// Condition coherence rides the band (goal rule 2, subsumed with margin).
// ---------------------------------------------------------------------------

test("condition incoherence: a price below every real raw tier of the watched card fails the band (damaged ~80% of NM on the fixture card)", () => {
  // On the incident card the lowest raw tier (damaged) averages ~$1,006 vs
  // the $1,244.86 NM basis (~80%). The 35%-of-basis floor sits far beneath
  // ANY real raw condition — so a listing failing the band cannot be a
  // coherent condition of the watched card, only a different card or junk.
  const dmgAvgCents = 100_600;
  assert.ok(dmgAvgCents > INCIDENT_BASIS_CENTS * PLAUSIBLE_FLOOR_FRACTION, "every real tier clears the floor");
  const v = assessAlertPlausibility({
    currentPriceCents: INCIDENT_PRICE_CENTS,
    comp: comp(INCIDENT_BASIS_CENTS),
    targetPriceCents: null,
  });
  assert.equal(v.plausible, false);
});
