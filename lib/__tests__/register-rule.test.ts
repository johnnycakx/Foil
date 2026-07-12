// Register-rule guard (offer-implementation item 5, John's 2026-07-11 rule):
// customer-facing copy is written like explaining to a friend at a card shop.
// Collector words are fine (grail, chase, NM, pull); finance/tech words are
// banned in public copy. This test strips comments from the public copy
// surfaces and fails on any banned word that survives into shippable text —
// the structural backstop for the jargon sweep ("sample-size gated" →
// "we only show a price when enough copies actually sold").
//
// Also pins the LOCKED offer copy (offer-lock session, ratified 2026-07-11)
// verbatim, so a future edit can't silently drift the ratified lines.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Strip line comments, block comments and JSX comment bodies so only
 *  shippable text is scanned. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

// The public copy surfaces the register rule governs. New customer-facing
// surfaces should be appended here.
const COPY_SURFACES: readonly string[] = [
  "app/pro/page.tsx",
  "app/account/page.tsx",
  "app/(site)/page.tsx",
  "app/(site)/deals/page.tsx",
  "app/(site)/pricing-methodology/page.tsx",
  "components/start-page-form.tsx",
  "components/deals/deals-drop-gate.tsx",
  "components/deals/movers-board.tsx",
  "components/cards/add-to-vault.tsx",
  "components/cards/watchlist-form.tsx",
  "components/cards/card-typeahead.tsx",
  "lib/deals/gate.ts",
  "lib/deals/market-temperature.ts",
  "lib/wishlist/alert-email.ts",
  "lib/wishlist/vault-email.ts",
  "lib/newsletter/daily-drop.ts",
];

// Banned in public copy per the register rule. ("basis" is also banned in
// copy but is a legitimate identifier in the alert decision model, so the
// automated check omits it — the manual sweep covers it.)
const BANNED = /\b(sample-size|sample size|windowed|momentum|aggregates?|entitlements?|thresholds?)\b/i;

test("register rule: no finance/tech jargon in public copy surfaces", () => {
  const offenders: string[] = [];
  for (const rel of COPY_SURFACES) {
    const clean = stripComments(read(rel));
    const lines = clean.split("\n");
    lines.forEach((line, i) => {
      // Import lines aren't copy (e.g. `from "@/lib/entitlements"`).
      if (/^\s*import\b|^\s*\} from /.test(line)) return;
      const m = line.match(BANNED);
      // Identifier usages like momentumPct/aggregatedRow don't word-boundary
      // match; a hit here is real copy (or a string) and must be rewritten.
      if (m) offenders.push(`${rel}:${i + 1} — "${m[0]}"`);
    });
  }
  assert.deepEqual(offenders, [], `Register-rule violations:\n${offenders.join("\n")}`);
});

test("locked offer copy renders verbatim on /pro", () => {
  const pro = read("app/pro/page.tsx");
  assert.match(pro, /Foil watches your grails\. You get pinged when one hits your price\./);
  assert.match(
    pro,
    /Set a card and a target\. Foil checks the market and emails you the moment a real listing hits it\. Sold prices, not asking prices\./,
  );
  assert.match(
    pro,
    /Foil scans the singles market every day and sends only the buys worth it\. On a quiet day it says so\. No filler\./,
  );
  assert.match(pro, /Add every card you're chasing\. Pro checks hourly\. Free checks once a day\./);
  assert.match(pro, /Foil doesn't guess prices\. It reads real sales\./);
  assert.match(
    pro,
    /\$6 a month, locked\. The price rises as Foil gets faster\. Founding members keep their rate for life and get everything new first\./,
  );
  assert.match(pro, /Not ready\? Free gets you 3 watches and the weekly digest\./);
});

test("locked gate copy: real locked count + Pro line, free catcher present", () => {
  const gate = read("lib/deals/gate.ts");
  assert.match(gate, /more good \$\{buys\} today\./);
  assert.match(gate, /Pro sees everything Foil finds, first\./);
  const gateComponent = read("components/deals/deals-drop-gate.tsx");
  assert.match(gateComponent, /Not ready\? Free gets you 3 watches and the weekly digest\./);
});

test("no em dashes in locked/public copy strings", () => {
  // John's standing voice rule: NO em dashes in customer-facing copy. Scan
  // string literals + JSX text on the core offer surfaces.
  for (const rel of ["app/pro/page.tsx", "lib/deals/gate.ts", "lib/newsletter/daily-drop.ts"]) {
    const clean = stripComments(read(rel));
    assert.ok(!clean.includes("—"), `${rel} contains an em dash in shippable text`);
  }
});
