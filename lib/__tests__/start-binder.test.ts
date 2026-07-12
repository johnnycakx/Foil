// The binder mechanics (start-binder-delight, 2026-07-12).
//
// The scene is judged by taste, but its RULES are pinned here: the free cap is
// furniture (never an error), every payoff is a real figure or an honest
// absence, and a suggestion never claims a relationship the data can't support.

import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_POCKETS,
  POCKETS_PER_PAGE,
  freeSlotsLeft,
  layoutPockets,
  soldLine,
  suggestNeighbor,
  suggestionLine,
  tagLine,
  type BinderCard,
} from "../start/binder.ts";
import { FREE_WATCH_CAP } from "../offer.ts";
import { startSchema } from "../start/wire.ts";

const card = (over: Partial<BinderCard> = {}): BinderCard => ({
  id: "swsh7-215",
  slug: "swsh7-215-umbreon-vmax",
  name: "Umbreon VMAX",
  setName: "Evolving Skies",
  setId: "swsh7",
  number: "215",
  image: "/x.webp",
  soldCents: 228545,
  saleCount: 64,
  ...over,
});

// --- the page ---------------------------------------------------------------

test("the page is nine pockets and the free tier owns three", () => {
  assert.equal(POCKETS_PER_PAGE, 9);
  assert.equal(FREE_POCKETS, 3);
});

test("FREE_POCKETS must not drift from the offer's watch cap", () => {
  // binder.ts restates the constant because it ships to the CLIENT and
  // lib/offer.ts drags server-only code (node:fs) into the browser bundle —
  // a real build break. This test is the seam that keeps them equal.
  assert.equal(FREE_POCKETS, FREE_WATCH_CAP);
});

test("the free cap renders as FURNITURE: empty sleeves, then visible Pro sleeves", () => {
  const page = layoutPockets([], {});
  assert.equal(page.length, 9);
  assert.deepEqual(
    page.map((p) => p.kind),
    ["empty", "empty", "empty", "locked", "locked", "locked", "locked", "locked", "locked"],
  );
});

test("filled cards take pockets in order; the rest of the page stays honest", () => {
  const page = layoutPockets([card(), card({ id: "b" })], { "swsh7-215": "40" });
  assert.equal(page[0]?.kind, "filled");
  assert.equal(page[1]?.kind, "filled");
  assert.equal(page[2]?.kind, "empty");
  assert.equal(page[3]?.kind, "locked");
  if (page[0]?.kind === "filled") assert.equal(page[0].targetUsd, "40");
});

test("freeSlotsLeft never goes negative", () => {
  assert.equal(freeSlotsLeft(0), 3);
  assert.equal(freeSlotsLeft(3), 0);
  assert.equal(freeSlotsLeft(9), 0);
});

// --- truth density ----------------------------------------------------------

test("the payoff line is a REAL figure with its sale count", () => {
  assert.equal(soldLine(card()), "Usually $2,285.45 · 64 sales on record");
  assert.equal(soldLine(card({ soldCents: 1322, saleCount: 1 })), "Usually $13.22 · 1 sale on record");
});

test("no clean figure means an HONEST ABSENCE, never a fabricated number", () => {
  const absent = "No clean sold read yet. Foil starts watching from here.";
  assert.equal(soldLine(card({ soldCents: null })), absent);
  assert.equal(soldLine(card({ soldCents: 0 })), absent);
  assert.equal(soldLine(card({ saleCount: 0 })), absent);
});

test("a blank price tag is a real state, in pencil", () => {
  assert.equal(tagLine(""), "any good price");
  assert.equal(tagLine("  "), "any good price");
  assert.equal(tagLine("0"), "any good price");
  assert.equal(tagLine("abc"), "any good price");
  assert.equal(tagLine("40"), "$40");
  assert.equal(tagLine("1900"), "$1,900");
});

// --- the one-more loop ------------------------------------------------------

test("suggestion prefers the same Pokémon line and SAYS SO truthfully", () => {
  const seated = card();
  const pool = [seated, card({ id: "swsh7-215b", name: "Umbreon V", setName: "Evolving Skies" })];
  const s = suggestNeighbor(seated, pool, [seated.id]);
  assert.ok(s);
  assert.equal(s.reason, "same-line");
  assert.equal(suggestionLine(s, seated), "Another Umbreon printing.");
});

test("a same-SET fallback never claims to be the same line (the honesty bug)", () => {
  // The first cut rendered "sits in the same run" over a same-set fallback —
  // a relationship the data did not support. The reason now rides along.
  const seated = card({ name: "Blaziken", setName: "Destined Rivals" });
  const other = card({ id: "z", name: "Team Rocket's Weezing", setName: "Destined Rivals" });
  const s = suggestNeighbor(seated, [seated, other], [seated.id]);
  assert.ok(s);
  assert.equal(s.reason, "same-set");
  assert.equal(suggestionLine(s, seated), "Also from Destined Rivals.");
  assert.doesNotMatch(suggestionLine(s, seated), /same run|printing/);
});

test("no genuine neighbor means NO suggestion (never filler)", () => {
  const seated = card({ name: "Blaziken", setName: "Destined Rivals" });
  const stranger = card({ id: "z", name: "Pikachu", setName: "Base" });
  assert.equal(suggestNeighbor(seated, [seated, stranger], [seated.id]), null);
});

test("a suggestion never repeats what is already in the binder or was dismissed", () => {
  const seated = card();
  const kin = card({ id: "kin", name: "Umbreon V", setName: "Evolving Skies" });
  assert.equal(suggestNeighbor(seated, [seated, kin], [seated.id, "kin"]), null);
});

// --- the wire contract ------------------------------------------------------
//
// THE BUG THIS PINS: the binder first shipped posting only
// { pokemon_tcg_id, target_price_cents } while /api/start required
// name/set_name/set_id/number. Every submit would have 400'd — and the test
// named "posts the wire shape the route parses" never parsed anything, so it
// stayed green. Caught by /security-review, not by the suite. Now the suite
// runs the REAL schema over the REAL payload the client builds.

/** Exactly what components/start/binder-desk.tsx sends per seated card. */
function clientPayload(cards: BinderCard[], targets: Record<string, string> = {}) {
  return {
    email: "collector@example.com",
    opt_in_newsletter: true,
    cards: cards.map((c) => {
      const raw = (targets[c.id] ?? "").trim();
      const n = parseFloat(raw);
      return {
        pokemon_tcg_id: c.id,
        name: c.name,
        set_name: c.setName,
        set_id: c.setId,
        number: c.number,
        target_price_cents: raw && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null,
      };
    }),
  };
}

test("the binder's payload PARSES against the route's real schema", () => {
  const res = startSchema.safeParse(clientPayload([card()]));
  assert.ok(res.success, res.success ? "" : JSON.stringify(res.error.issues));
});

test("a blank tag parses as a NULL target (the market-basis watch, ADR-091)", () => {
  const res = startSchema.safeParse(clientPayload([card()], { "swsh7-215": "" }));
  assert.ok(res.success);
  if (res.success) assert.equal(res.data.cards[0]?.target_price_cents, null);
});

test("a written tag parses as cents", () => {
  const res = startSchema.safeParse(clientPayload([card()], { "swsh7-215": "40" }));
  assert.ok(res.success);
  if (res.success) assert.equal(res.data.cards[0]?.target_price_cents, 4000);
});

test("a card missing its identity is REJECTED by the schema (regression guard)", () => {
  // This is the shape the broken first cut sent.
  const broken = {
    email: "collector@example.com",
    cards: [{ pokemon_tcg_id: "swsh7-215", target_price_cents: null }],
  };
  assert.equal(startSchema.safeParse(broken).success, false);
});
