// The LOCKED offer's tier mechanics (offer-implementation, 2026-07-11; free
// cap amended to ONE BINDER PAGE = 9 by the 2026-07-12 cycle-3 brief):
// free one-page cap (gift vaults exempt), the free-daily / pro-hourly cadence
// split, the email-keyed tier resolution, the daily-drop composer's thin-day
// honesty, and the market-temperature stat.

import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_PAGE_SLEEVES,
  FREE_WATCH_CAP,
  FREE_ALERT_HOUR_UTC,
  countsTowardFreeCap,
  watchDueThisRun,
} from "../offer.ts";
import { evaluateFreeCap } from "../wishlist/free-cap.ts";
import { resolveTierRecord } from "../entitlements.ts";
import { buildDailyDropModel } from "../newsletter/daily-drop.ts";
import { computeMarketTemperature, temperatureSentence } from "../deals/market-temperature.ts";
import type { DealRow } from "../deals/leaderboard.ts";

// --- cadence split (offer 1b) ------------------------------------------------

test("pro watches are due on every hourly run", () => {
  for (let h = 0; h < 24; h++) {
    assert.equal(watchDueThisRun("pro", new Date(Date.UTC(2026, 6, 11, h))), true);
  }
});

test("free watches are due ONLY on the daily hour", () => {
  for (let h = 0; h < 24; h++) {
    const due = watchDueThisRun("free", new Date(Date.UTC(2026, 6, 11, h)));
    assert.equal(due, h === FREE_ALERT_HOUR_UTC, `hour ${h}`);
  }
});

// --- free cap (offer 1a) ------------------------------------------------------

const row = (slug: string, opts: { src?: string | null; paused?: boolean } = {}) => ({
  card_slug: slug,
  src: opts.src ?? null,
  alerts_paused_at: opts.paused ? "2026-07-11T00:00:00Z" : null,
});

/** A full free page of active watches (slugs p0..p8). */
const fullPage = () => Array.from({ length: FREE_PAGE_SLEEVES }, (_, i) => row(`p${i}`));

test("free cap is ONE BINDER PAGE (9 active watches)", () => {
  assert.equal(FREE_PAGE_SLEEVES, 9);
  assert.equal(FREE_WATCH_CAP, FREE_PAGE_SLEEVES, "the cap IS the page — one constant");
  // The whole page fills in one submit…
  assert.equal(evaluateFreeCap("free", [], Array.from({ length: 9 }, (_, i) => `n${i}`)).allowed, true);
  // …and the 10th card is rejected server-side (the page is full).
  assert.equal(evaluateFreeCap("free", fullPage(), ["d"]).allowed, false);
  assert.equal(evaluateFreeCap("free", [], Array.from({ length: 10 }, (_, i) => `n${i}`)).allowed, false);
  assert.equal(evaluateFreeCap("free", fullPage().slice(0, 8), ["c"]).allowed, true);
});

test("re-adding an already-watched card is an update, not a new watch (idempotent at a full page)", () => {
  const existing = fullPage();
  assert.equal(evaluateFreeCap("free", existing, ["p0"]).allowed, true);
  // A whole-page duplicate resubmit is still an update, not 9 new watches.
  assert.equal(
    evaluateFreeCap("free", existing, existing.map((r) => r.card_slug)).allowed,
    true,
  );
});

test("seeded gift-vault rows never count toward the cap", () => {
  assert.equal(countsTowardFreeCap("eve-vault"), false);
  assert.equal(countsTowardFreeCap("seeded-vault-demo"), false);
  assert.equal(countsTowardFreeCap("vault"), true);
  assert.equal(countsTowardFreeCap(null), true);
  const seeded = fullPage().map((r) => ({ ...r, src: "eve-vault" }));
  assert.equal(
    evaluateFreeCap("free", seeded, Array.from({ length: 9 }, (_, i) => `d${i}`)).allowed,
    true,
  );
});

test("paused rows don't count as active", () => {
  const existing = [...fullPage().map((r) => ({ ...r, alerts_paused_at: "2026-07-11T00:00:00Z" })), row("z")];
  assert.equal(evaluateFreeCap("free", existing, Array.from({ length: 8 }, (_, i) => `d${i}`)).allowed, true);
  assert.equal(evaluateFreeCap("free", existing, Array.from({ length: 9 }, (_, i) => `d${i}`)).allowed, false);
});

test("pro is uncapped", () => {
  const existing = Array.from({ length: 60 }, (_, i) => row(`c${i}`));
  assert.equal(evaluateFreeCap("pro", existing, ["new-1", "new-2"]).allowed, true);
});

// --- tier resolution ----------------------------------------------------------

test("resolveTierRecord: trialing and active are pro, everything else free", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(resolveTierRecord({ tier: "pro", status: "trialing", current_period_end: future }), "pro");
  assert.equal(resolveTierRecord({ tier: "pro", status: "active", current_period_end: future }), "pro");
  assert.equal(resolveTierRecord({ tier: "pro", status: "canceled", current_period_end: future }), "free");
  assert.equal(resolveTierRecord({ tier: "pro", status: "past_due", current_period_end: future }), "free");
  assert.equal(resolveTierRecord({ tier: "free", status: "active", current_period_end: future }), "free");
  const past = new Date(Date.now() - 86_400_000).toISOString();
  assert.equal(resolveTierRecord({ tier: "pro", status: "active", current_period_end: past }), "free");
});

// --- daily drop composer (offer 2a) --------------------------------------------

const deal = (over: Partial<DealRow> = {}): DealRow => ({
  cardSlug: "umbreon-vmax-alt-evolving-skies-215",
  cardName: "Umbreon VMAX (Alternate Art)",
  setName: "Evolving Skies",
  imageUrl: "",
  signal: "BELOW",
  deltaPct: -18,
  soldReference: 19.11,
  soldSampleSize: 9,
  matchedTier: "NEAR_MINT",
  computedAt: "2026-07-11T08:00:00Z",
  ...over,
});

test("daily drop: a 0-deal day SENDS the honest quiet-day email", () => {
  const model = buildDailyDropModel([], null, new Date("2026-07-11T09:47:00Z"));
  assert.equal(model.dealCount, 0);
  assert.equal(model.subject, "Quiet day. Nothing worth your money today.");
  const html = model.bodyHtmlFor("a@b.com");
  assert.match(html, /nothing cleared the bar/i);
  assert.match(html, /No filler/);
});

test("daily drop: deal lines use card-shop words and link to the card page", () => {
  const model = buildDailyDropModel([deal()], null, new Date("2026-07-11T09:47:00Z"));
  assert.equal(model.subject, "Today's drop: 1 real buy");
  const html = model.bodyHtmlFor("a@b.com");
  assert.match(html, /listed 18% under what it usually sells for/);
  assert.match(html, /Usually \$19\.11/);
  assert.match(html, /foiltcg\.com\/cards\/umbreon-vmax-alt-evolving-skies-215\?utm_source=daily-drop/);
  assert.match(html, /Foil doesn't guess prices\. It reads real sales\./);
  // No em dashes in customer copy (John's standing rule).
  assert.ok(!html.includes("—"));
});

test("daily drop: temperature line renders when the stat is fresh", () => {
  const model = buildDailyDropModel([deal()], { belowCount: 120, totalCount: 390 }, new Date());
  assert.match(
    model.bodyHtmlFor("a@b.com"),
    /120 of the 390 cards Foil tracks are going for less than usual this week\./,
  );
});

// --- market temperature (offer item 6) -----------------------------------------

test("computeMarketTemperature counts only fully-priced cards", () => {
  const stat = computeMarketTemperature([
    { avg7d: 10, avg30d: 12 }, // below
    { avg7d: 15, avg30d: 12 }, // above
    { avg7d: null, avg30d: 12 }, // unpriced — excluded
    { avg7d: 9, avg30d: null }, // unpriced — excluded
    { avg7d: 5, avg30d: 0 }, // degenerate — excluded
    { avg7d: 8, avg30d: 9 }, // below
  ]);
  assert.deepEqual(stat, { belowCount: 2, totalCount: 3 });
  assert.equal(
    temperatureSentence(stat),
    "2 of the 3 cards Foil tracks are going for less than usual this week.",
  );
});
