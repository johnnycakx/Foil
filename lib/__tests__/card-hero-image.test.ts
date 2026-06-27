// Card-hero + board image tests (ADR-072 follow-up). The Satori render itself
// can't run under node --strip-types (next/og), so the template is pinned
// STRUCTURALLY by reading post-image.tsx; the pure helpers (hero-fields, card-
// art, the weekly_board angle) are exercised directly.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { heroFieldsForDeal, heroFieldsForSpotlight, clampName } from "../social/hero-fields.ts";
import { fetchCardArtBuffer } from "../social/card-art.ts";
import { resolveAngle, WEEKLY_BOARD_UTC_DAY } from "../social/angles.ts";
import { buildUserPrompt, type DealData, type SpotlightData } from "../social/post-text.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const POST_IMAGE = readFileSync(join(ROOT, "lib/social/post-image.tsx"), "utf8");

const DEAL: DealData = {
  cardName: "Blastoise", setName: "Base Set", slug: "base1-2-blastoise", deltaPct: -16.8,
  soldReference: 120, matchedTier: "NEAR_MINT", saleCount: 51, computedAt: "2026-06-27T00:00:00Z",
  imageUrl: "https://img.example/blastoise.png",
};

// --- hero fields (pure) ---

test("heroFieldsForDeal: % below framing, real support line (no arrow field — v2.1)", () => {
  const f = heroFieldsForDeal(DEAL);
  assert.equal(f.bigNumber, "17%"); // 16.8 rounds to 17
  assert.equal(f.subline, "below its 30-day sold average");
  assert.equal(f.supportLine, "Blastoise · Base Set · Near Mint · $120 avg · 51 sales");
  assert.equal("showArrow" in f, false, "the arrow flag was removed in v2.1");
});

test("heroFieldsForSpotlight: a price", () => {
  const s: SpotlightData = { cardName: "Charizard", setName: "Base Set", slug: "base1-4-charizard", soldReference: 350, sampleSize: 168, imageUrl: "x" };
  const f = heroFieldsForSpotlight(s);
  assert.equal(f.bigNumber, "$350");
  assert.match(f.supportLine, /Charizard · Base Set · \$350 avg · 168 sales/);
  assert.equal("showArrow" in f, false, "the arrow flag was removed in v2.1");
});

test("clampName: long names are truncated so they can't collide with the % column", () => {
  assert.equal(clampName("Blastoise"), "Blastoise");
  const long = clampName("Team Rocket's Giovanni's Pikachu");
  assert.ok(long.length <= 19, `clamped to ${long.length}`);
  assert.ok(long.endsWith("…"));
});

// --- card-art fetch (soft-fail, never an artless hero) ---

test("fetchCardArtBuffer: returns a Buffer on 200, null on every failure mode", async () => {
  const ok = (async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as unknown as typeof fetch;
  const got = await fetchCardArtBuffer("https://img/x.png", { fetchImpl: ok });
  assert.ok(Buffer.isBuffer(got) && got.length === 3);

  const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  assert.equal(await fetchCardArtBuffer("https://img/x.png", { fetchImpl: notFound }), null);

  const empty = (async () => new Response(new Uint8Array([]), { status: 200 })) as unknown as typeof fetch;
  assert.equal(await fetchCardArtBuffer("https://img/x.png", { fetchImpl: empty }), null);

  assert.equal(await fetchCardArtBuffer("", { fetchImpl: ok }), null, "empty url");
  assert.equal(await fetchCardArtBuffer("not-a-url", { fetchImpl: ok }), null, "non-http url");

  const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
  assert.equal(await fetchCardArtBuffer("https://img/x.png", { fetchImpl: boom }), null, "soft-fails on throw");
});

// --- weekly_board angle ---

test("resolveAngle: the board posts on the board day when there are enough deals", () => {
  // Find a date that is the board weekday (Monday UTC).
  let monday: Date | null = null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2026, 5, 1 + i));
    if (d.getUTCDay() === WEEKLY_BOARD_UTC_DAY) { monday = d; break; }
  }
  assert.ok(monday);
  assert.equal(resolveAngle(monday!, { hasDeal: true, hasSpotlight: true, hasBoard: true }), "weekly_board");
  // Without enough for a board, it falls back to the daily rotation (not the board).
  assert.notEqual(resolveAngle(monday!, { hasDeal: true, hasSpotlight: true, hasBoard: false }), "weekly_board");
});

test("buildUserPrompt(weekly_board): lists the real cards + aggregate framing, points to the board", () => {
  const p = buildUserPrompt({ angle: "weekly_board", date: "June 29, 2026", deals: [DEAL, { ...DEAL, cardName: "Alakazam", slug: "base1-1-alakazam", deltaPct: -12 }] });
  assert.match(p, /Blastoise/);
  assert.match(p, /Alakazam/);
  assert.match(p, /30-day average/);
  assert.match(p, /foiltcg\.com\/deals/);
  assert.match(p, /17% below/); // Blastoise 16.8 -> 17
});

// --- structural anchors: the card-hero template (post-image.tsx) ---

test("card-hero template: derived bg + real card + dominant-glow box-shadow + NO red ▼ (v2.1)", () => {
  // background = the sharp-derived world (data URI) behind everything.
  assert.match(POST_IMAGE, /buildCardWorld/);
  assert.match(POST_IMAGE, /src=\{bgUri\}/);
  assert.match(POST_IMAGE, /src=\{cardUri\}/, "the REAL card art is composed");
  // card lift = drop shadow + dominant-color glow halo (Satori box-shadow).
  assert.match(POST_IMAGE, /boxShadow:.*rgba\(\$\{dominant\.r\}/, "card glow uses the dominant color");
  // the giant number has a bold layered black outline (Satori-reliable stroke)
  // PLUS the soft drop-shadow for depth (v2 number-legibility fix).
  assert.match(POST_IMAGE, /NUM_OUTLINE =/);
  assert.match(POST_IMAGE, /textShadow: NUM_OUTLINE/);
  assert.match(POST_IMAGE, /-3px -3px 0 #000/, "8-direction black outline offsets");
  assert.match(POST_IMAGE, /0 12px 26px rgba\(0,0,0,0\.82\)/, "soft drop-shadow retained for depth");
  // v2.1: the red ▼ is GONE from the card-hero (it encoded as a red rectangle in
  // the MP4 frame). The number block must not draw the triangle or read showArrow.
  assert.equal(POST_IMAGE.includes("38px solid ${RED}"), false, "the card-hero red ▼ is removed");
  assert.doesNotMatch(POST_IMAGE, /input\.showArrow/, "no showArrow flag in the card-hero");
  // brand restraint: lockup ONCE (no slogan — the lifted competitor line was
  // removed), single foiltcg.com CTA.
  assert.doesNotMatch(POST_IMAGE, /FIND\.|TRACK\.|SAVE\./, "the competitor slogan must not ship");
  assert.match(POST_IMAGE, /foiltcg\.com/);
  // white number default + gold toggle.
  assert.match(POST_IMAGE, /goldNumber \? GOLD_L : WHITE/);
});

test("card-hero template (v2): the number band clears the card — no red ▼ overlaps the card art", () => {
  // The v2 fix: card shrunk + raised, number band TOP-anchored below it. Pin the
  // chosen offsets and assert the no-overlap invariant on the worst-case (tallest)
  // pokemontcg.io large image (734×1024).
  const cardW = Number(POST_IMAGE.match(/const CARD_W = (\d+)/)?.[1]);
  const cardTop = Number(POST_IMAGE.match(/const CARD_TOP = (\d+)/)?.[1]);
  const bandTop = Number(POST_IMAGE.match(/const NUMBER_BAND_TOP = (\d+)/)?.[1]);
  assert.ok(cardW && cardTop && bandTop, "v2 layout constants are present");
  const cardBottom = cardTop + Math.round(cardW * (1024 / 734));
  assert.ok(cardBottom < bandTop, `card bottom ${cardBottom} must sit above the number band ${bandTop}`);
  // the band is TOP-anchored (not the old bottom-anchored column that pushed the ▼ up into the card).
  assert.match(POST_IMAGE, /position: "absolute", top: NUMBER_BAND_TOP/);
});

test("board template: DARK name on the light row + long-name clamp + red ▼ + real thumbnail", () => {
  // the ref's fix: dark navy name on the light row (not the prototype's light-name bug).
  assert.match(POST_IMAGE, /rowName = "#13213f"/);
  assert.match(POST_IMAGE, /color: rowName[\s\S]*\{clampName\(d\.cardName\)\}/, "name is dark + clamped");
  assert.match(POST_IMAGE, /clampName\(d\.cardName\)/);
  assert.match(POST_IMAGE, /src=\{d\.imageUrl\}/, "real card thumbnail per row");
  assert.match(POST_IMAGE, /below 30-day avg/);
});
