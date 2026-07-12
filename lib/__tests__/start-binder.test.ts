// The binder mechanics (start-binder-delight, 2026-07-12).
//
// The scene is judged by taste, but its RULES are pinned here: the free cap is
// furniture (never an error), every payoff is a real figure or an honest
// absence, and a suggestion never claims a relationship the data can't support.

import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CHECK_HOUR_UTC,
  FREE_POCKETS,
  PACK_MIN_CARDS,
  PACK_SIZE,
  POCKETS_PER_PAGE,
  SUGGEST_MIN_SALES,
  dealPack,
  foilSuggestsCents,
  foilTagLine,
  freeSlotsLeft,
  heartbeatLine,
  layoutPockets,
  soldLine,
  suggestNeighbor,
  suggestionLine,
  tagLine,
  type BinderCard,
} from "../start/binder.ts";
import { FREE_ALERT_HOUR_UTC, FREE_WATCH_CAP } from "../offer.ts";
import { MOVER_MIN_SALES } from "../deals/market-movers.ts";
import { marketFloorCents } from "../wishlist/alert-decision.ts";
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

test("the page is nine pockets and free owns the WHOLE page (cycle-3 entitlement)", () => {
  assert.equal(POCKETS_PER_PAGE, 9);
  assert.equal(FREE_POCKETS, 9, "Free fills a page. Pro fills the binder.");
});

test("FREE_POCKETS must not drift from the offer's watch cap", () => {
  // binder.ts restates the constant because it ships to the CLIENT and
  // lib/offer.ts drags server-only code (node:fs) into the browser bundle —
  // a real build break. This test is the seam that keeps them equal.
  assert.equal(FREE_POCKETS, FREE_WATCH_CAP);
});

test("a fresh free page is NINE open sleeves — no locked wall (cycle-3 A3)", () => {
  const page = layoutPockets([], {});
  assert.equal(page.length, 9);
  assert.deepEqual(
    page.map((p) => p.kind),
    Array.from({ length: 9 }, () => "empty"),
  );
});

test("filled cards take pockets in order; the rest of the page stays honest", () => {
  const page = layoutPockets([card(), card({ id: "b" })], { "swsh7-215": "40" });
  assert.equal(page[0]?.kind, "filled");
  assert.equal(page[1]?.kind, "filled");
  assert.equal(page[2]?.kind, "empty");
  assert.equal(page[8]?.kind, "empty");
  if (page[0]?.kind === "filled") assert.equal(page[0].targetUsd, "40");
});

test("freeSlotsLeft never goes negative", () => {
  assert.equal(freeSlotsLeft(0), 9);
  assert.equal(freeSlotsLeft(9), 0);
  assert.equal(freeSlotsLeft(12), 0);
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

// --- Foil writes the tag first (cycle 2) --------------------------------------

test("the pencil number IS the alert engine's below-usual basis, dollar-rounded", () => {
  // No new pricing math: the suggestion must equal marketFloorCents (ADR-091,
  // 15% under the 30-day sold average on the NM axis), rounded to a whole
  // dollar so the written number is exactly what arms.
  const c = card();
  const floor = marketFloorCents(
    { avg30dCents: c.soldCents!, saleCount: c.saleCount, tierLabel: "Near Mint", computedAt: "" },
    "any-raw",
  );
  assert.ok(floor != null);
  assert.equal(foilSuggestsCents(c), Math.round(floor / 100) * 100);
  assert.equal(foilSuggestsCents(c), 194300); // 228545 × 0.85 → $1,943
});

test("a thin basis writes NOTHING (the tag honestly stays 'any good price')", () => {
  assert.equal(foilSuggestsCents(card({ saleCount: SUGGEST_MIN_SALES - 1 })), null);
  assert.equal(foilSuggestsCents(card({ soldCents: null })), null);
  assert.equal(foilSuggestsCents(card({ soldCents: 0 })), null);
  // A floor that rounds below a dollar is not a suggestion.
  assert.equal(foilSuggestsCents(card({ soldCents: 50, saleCount: 40 })), null);
});

test("the sample floor must not drift from the deals engine's", () => {
  // Restated for the client bundle (market-movers.ts has server-leaning
  // imports); this is the seam that keeps them equal — same as FREE_POCKETS.
  assert.equal(SUGGEST_MIN_SALES, MOVER_MIN_SALES);
});

test("the pencil line names Foil and the bound", () => {
  assert.equal(foilTagLine(194300), "Foil suggests: under $1,943");
  assert.equal(foilTagLine(3800), "Foil suggests: under $38");
});

// --- the heartbeat (cycle 2) --------------------------------------------------

test("the heartbeat is TIME-HONEST about the next free check", () => {
  // Free watches are evaluated once a day at a fixed UTC hour. Before that
  // run the next look is later today; after it, tomorrow. Never "tonight".
  assert.equal(heartbeatLine(false, 0), "Foil checks this page later today.");
  assert.equal(heartbeatLine(false, FREE_CHECK_HOUR_UTC - 1), "Foil checks this page later today.");
  assert.equal(heartbeatLine(false, FREE_CHECK_HOUR_UTC), "Foil checks this page tomorrow.");
  assert.equal(heartbeatLine(false, 23), "Foil checks this page tomorrow.");
  assert.equal(heartbeatLine(true, 3), "Foil checks this page every hour.");
});

test("the heartbeat hour must not drift from the offer's daily-run hour", () => {
  assert.equal(FREE_CHECK_HOUR_UTC, FREE_ALERT_HOUR_UTC);
});

// --- the booster pack (cycle 2) -----------------------------------------------

test("the pack deals the most-chased slice of the REAL deck, in deck order", () => {
  const pool = Array.from({ length: 12 }, (_, i) =>
    card({ id: `c${i}`, soldCents: 1000 + i, saleCount: 50 - i }),
  );
  const hand = dealPack(pool, []);
  assert.equal(hand.length, PACK_SIZE);
  assert.deepEqual(
    hand.map((c) => c.id),
    ["c0", "c1", "c2", "c3", "c4", "c5", "c6"],
  );
});

test("the pack never deals a card without a real sold read, nor one already sleeved", () => {
  const pool = [
    card({ id: "a" }),
    card({ id: "ghost", soldCents: null }),
    card({ id: "zero", saleCount: 0 }),
    card({ id: "b" }),
    card({ id: "c" }),
    card({ id: "d" }),
  ];
  assert.deepEqual(
    dealPack(pool, ["a"]).map((c) => c.id),
    ["b", "c", "d"],
  );
});

test("a pack too thin to be a pack stays off the desk (honest absence)", () => {
  const pool = [card({ id: "a" }), card({ id: "b" })];
  assert.ok(pool.length < PACK_MIN_CARDS + 1);
  assert.deepEqual(dealPack(pool, []), []);
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

/** Exactly what components/start/binder-desk.tsx sends per seated card —
 *  including cycle 2's tag rule: the collector's own number if they took the
 *  pencil, else exactly what Foil wrote, else NULL. */
function clientPayload(
  cards: BinderCard[],
  targets: Record<string, string> = {},
  suggested: Record<string, number> = {},
  touched: string[] = [],
) {
  const targetCentsFor = (c: BinderCard): number | null => {
    const raw = (targets[c.id] ?? "").trim();
    if (!touched.includes(c.id) && suggested[c.id] != null) return suggested[c.id];
    const n = parseFloat(raw);
    return raw && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  return {
    email: "collector@example.com",
    opt_in_newsletter: true,
    cards: cards.map((c) => ({
      pokemon_tcg_id: c.id,
      name: c.name,
      set_name: c.setName,
      set_id: c.setId,
      number: c.number,
      target_price_cents: targetCentsFor(c),
    })),
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

test("an untouched Foil-written tag posts EXACTLY the penciled cents (the tag never lies to the wire)", () => {
  const pencil = foilSuggestsCents(card());
  assert.ok(pencil != null);
  const res = startSchema.safeParse(clientPayload([card()], {}, { "swsh7-215": pencil }, []));
  assert.ok(res.success);
  if (res.success) assert.equal(res.data.cards[0]?.target_price_cents, pencil);
});

test("taking the pencil back makes the collector's number win, and clearing it posts NULL", () => {
  const pencil = foilSuggestsCents(card())!;
  const edited = startSchema.safeParse(
    clientPayload([card()], { "swsh7-215": "1500" }, { "swsh7-215": pencil }, ["swsh7-215"]),
  );
  assert.ok(edited.success);
  if (edited.success) assert.equal(edited.data.cards[0]?.target_price_cents, 150000);

  const cleared = startSchema.safeParse(
    clientPayload([card()], { "swsh7-215": "" }, { "swsh7-215": pencil }, ["swsh7-215"]),
  );
  assert.ok(cleared.success);
  if (cleared.success) assert.equal(cleared.data.cards[0]?.target_price_cents, null);
});

test("a full free page (9 cards) parses on the wire in one submit", () => {
  // The cap itself is SERVER-enforced (evaluateFreeCap, offer-mechanics tests:
  // 9 accepted, 10th rejected); the wire must not strangle a legal full page.
  const nine = Array.from({ length: 9 }, (_, i) => card({ id: `sv9-${i}` }));
  assert.ok(startSchema.safeParse(clientPayload(nine)).success);
});

test("a card missing its identity is REJECTED by the schema (regression guard)", () => {
  // This is the shape the broken first cut sent.
  const broken = {
    email: "collector@example.com",
    cards: [{ pokemon_tcg_id: "swsh7-215", target_price_cents: null }],
  };
  assert.equal(startSchema.safeParse(broken).success, false);
});
