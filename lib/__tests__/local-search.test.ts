// P0-4 pins (quality-bar-fixes, 2026-07-13): local-first search + near-miss
// suggestions + the converting fail state. The audit's finding: "umbreon
// vmax" sat on "Searching…" for 4+ seconds and a miss offered nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { searchLocalCatalog, suggestNearMisses } from "../cards/local-search.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("local search answers the audit's slow query instantly from the snapshot", () => {
  const t0 = performance.now();
  const hits = searchLocalCatalog("umbreon vmax");
  const ms = performance.now() - t0;
  assert.ok(hits.length > 0, "'umbreon vmax' has local hits");
  assert.ok(hits.some((h) => h.id === "swsh7-215"), "Moonbreon is among them");
  // Generous bound (first call builds the index): the budget is 600ms
  // perceived END TO END; the local scan must be a rounding error in it.
  assert.ok(ms < 250, `local search took ${ms.toFixed(1)}ms — must be near-instant`);
});

test("set-name tokens narrow the match ('charizard base' → Base-set Charizards)", () => {
  const hits = searchLocalCatalog("charizard base");
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => /base/i.test(h.setName) || /base/i.test(h.name)), "every hit honors the set token");
  assert.ok(hits.some((h) => h.id === "base1-4"));
});

test("recent-set cards are locally searchable (the do-or-die coverage)", () => {
  const hits = searchLocalCatalog("beedrill ex");
  assert.ok(hits.some((h) => h.setId === "me4"), "Chaos Rising Beedrill ex resolves locally");
});

test("near-miss suggester corrects a misspelled name ('gyrados' → Gyarados)", () => {
  const missed = searchLocalCatalog("gyrados");
  assert.equal(missed.length, 0, "the typo itself misses");
  const sugg = suggestNearMisses("gyrados");
  assert.ok(sugg.length > 0, "suggestions exist");
  assert.ok(sugg.some((h) => /gyarados/i.test(h.name)), "Gyarados is suggested");
});

test("no convincing near-miss → empty suggestions, never a wild guess", () => {
  assert.deepEqual(suggestNearMisses("zzzzqqqq"), []);
  assert.deepEqual(suggestNearMisses("xy"), [], "short tokens never fuzzy-match");
});

test("the route is local-first with a time-boxed upstream supplement", () => {
  const src = read("app/api/cards/search/route.ts");
  assert.match(src, /searchLocalCatalog\(/, "local search runs");
  assert.match(src, /UPSTREAM_BUDGET_MS/, "upstream is budgeted");
  assert.match(src, /suggestNearMisses\(/, "misses ship suggestions");
  const localIdx = src.indexOf("searchLocalCatalog(");
  const upstreamIdx = src.indexOf("searchCards({ query");
  assert.ok(localIdx > -1 && upstreamIdx > localIdx, "local answers before upstream merges");
});

test("the typeahead fail state converts: suggestions + the hunt-it capture (never a dead end)", () => {
  const src = read("components/cards/card-typeahead.tsx");
  assert.match(src, /Closest cards Foil knows:/, "near-miss rows render");
  assert.match(src, /Foil will hunt this one down/, "the request capture renders");
  assert.match(src, /\/api\/card-requests/, "the capture posts to the request API");
  assert.match(src, /Ask Foil to hunt it/, "the CTA is card-shop words");
  assert.match(src, /Foil is on it\./, "the sent state confirms in Foil's voice");
  assert.ok(!src.includes("Try the full card name, or add the set name."), "the old dead-end line is gone");
  // Latency budget: the debounce contributes ≤200ms of the 600ms budget.
  assert.match(src, /SEARCH_DEBOUNCE_MS = 200/, "debounce tightened to 200ms");
});

test("the request API is guarded: honeypot, IP limiter, zod caps, idempotent resubmit", () => {
  const src = read("app/api/card-requests/route.ts");
  assert.match(src, /isHoneypotTripped/, "honeypot");
  assert.match(src, /ipLimiter\.check/, "per-IP limiter");
  assert.match(src, /min\(2\)\.max\(64\)/, "query length caps match the DB check");
  assert.match(src, /23505/, "duplicate pending request is success, not error");
  assert.match(src, /DISCORD_WEBHOOK_CONTENT_ENGINE/, "demand signal pings #content-engine");
});

test("security review fixes hold: no attacker text in email or Discord, pending cap per address (2026-07-13 M1/M2)", () => {
  const route = read("app/api/card-requests/route.ts");
  // M1: unverified addresses get at most MAX_PENDING_PER_EMAIL queued sends,
  // and the cap answers success (no probing oracle).
  assert.match(route, /MAX_PENDING_PER_EMAIL = 3/, "pending cap exists");
  assert.match(route, /\.eq\("status", "pending"\)/, "cap counts pending rows only");
  // M2: the Discord embed strips markdown metacharacters and code-spans the
  // query — no masked links, no spoofed ops text.
  assert.match(route, /query\.replace\(\/\[`\\\[\\\]\(\)\*_~\|\]\/g, ""\)/, "markdown stripped");
  assert.match(route, /hunt: \\`\$\{safeQuery\}\\`/, "query pinned in a code span");
  // M1: the notify email carries ZERO requester-authored text — the stored
  // query never reaches the body.
  const notifier = read("scripts/notify-card-requests.ts");
  assert.doesNotMatch(notifier, /You searched for/, "the query reflection is gone");
  assert.doesNotMatch(notifier, /escapeHtml\(row\.query\)/, "row.query never enters the HTML");
});
