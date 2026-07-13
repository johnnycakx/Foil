// Item-5 pins (quality-bar-fixes, 2026-07-13): the market brain on screen.
// The audit's biggest finding — Foil's brain only ever manifested as a
// future email. These pin the payoff's honesty rules: same sold basis as
// the alert engine (soldLine, never restated math), fresh listing per seat
// (R-008), USD-only comparison (ADR-069), affiliate links server-built with
// rel="sponsored", and register-clean copy.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Pure helpers live in lib/start/binder.ts (node-importable — .tsx can't load
// under strip-types); the component render is source-pinned like the rest of
// the start-binder suite (no DOM here).
import { distanceLine, pctUnderUsual } from "../start/binder.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const BRAIN = read("components/start/pocket-brain.tsx");
const DESK = read("components/start/binder-desk.tsx");

test("distanceLine: at-or-under the number says so; above states the real gap + the promise", () => {
  assert.equal(distanceLine(1900_00, 1900_00), "That one is already at your number.");
  assert.equal(distanceLine(1800_00, 1900_00), "That one is already at your number.");
  assert.equal(
    distanceLine(2000_00, 1900_00),
    "$100 above your number today. Foil emails you the moment one crosses.",
  );
});

test("pctUnderUsual: real percent when the basis exists, null on a thin read (never invented)", () => {
  assert.equal(pctUnderUsual(85_00, 100_00), 15);
  assert.equal(pctUnderUsual(110_00, 100_00), -10);
  assert.equal(pctUnderUsual(85_00, null), null);
  assert.equal(pctUnderUsual(85_00, 0), null);
});

test("the brain reuses the alert engine's sold read — soldLine imported, no restated math", () => {
  assert.match(
    BRAIN,
    /import \{ soldLine, distanceLine, pctUnderUsual, type BinderCard \} from "@\/lib\/start\/binder"/,
  );
  assert.doesNotMatch(BRAIN, /avg30d|0\.85|marketFloor/, "no re-derived market math in the component");
});

test("the listing is fetched FRESH per seat from the R-008 endpoint, USD-gated", () => {
  assert.match(BRAIN, /\/api\/listing\/\$\{encodeURIComponent\(card\.slug\)\}\?src=start/);
  assert.match(BRAIN, /currency === "USD"/, "non-USD asks never compare against the USD sold basis (ADR-069)");
  assert.doesNotMatch(BRAIN, /localStorage|sessionStorage/, "nothing about the listing is persisted client-side");
});

test("affiliate links are server-built and rel=sponsored — the component never constructs one", () => {
  assert.doesNotMatch(BRAIN, /ebay\.com|campid|customid/i, "no client-side affiliate URL construction");
  const sponsoredCount = (BRAIN.match(/rel="sponsored noopener noreferrer"/g) ?? []).length;
  assert.equal(sponsoredCount, 2, "both outbound listing links carry rel=sponsored (EPN compliance)");
});

test("the desk mounts the brain for the LAST seated card, keyed so state never bleeds between cards", () => {
  assert.match(DESK, /<PocketBrain/, "the desk renders the brain");
  assert.match(DESK, /key=\{brainCard\.id\}/, "keyed per card — a reseat remounts, no stale listing");
  assert.match(DESK, /targetCents=\{targetCentsFor\(brainCard\)\}/, "the armed number feeds the distance line");
  const seatIdx = DESK.indexOf("setLastSeated(card.id)");
  assert.ok(seatIdx > -1, "seating records the brain's subject");
  assert.match(DESK, /setLastSeated\(\(prev\) => \(prev === id \? null : prev\)\)/, "unseating clears it");
});

test("register: the brain speaks card-shop words, third person, no em dash", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
  assert.ok(!strip(BRAIN).includes("—"), "no em dash in shippable text");
  assert.match(BRAIN, /Foil is checking the live market/, "loading state is in-world");
  assert.match(BRAIN, /Best live one right now/, "the listing line is plain words");
  assert.doesNotMatch(BRAIN, /\b(threshold|momentum|aggregate)/i, "no banned jargon");
});
