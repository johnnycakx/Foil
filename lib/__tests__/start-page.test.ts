// Structural + light behavioral guards for the /start stack.
//
// The SURFACE changed (Task #20's multi-add form → the binder desk,
// start-binder-delight 2026-07-12) but the INVARIANTS did not: the honeypot,
// the CAN-SPAM opt-in default, UTM attribution, the wire shape /api/start
// speaks, and the catalog gate on what is trackable. A redesign that quietly
// drops any of these is a regression, not a redesign — so these guards moved
// to the new component instead of being deleted with the old one.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const PAGE = "app/(site)/start/page.tsx";
const DESK = "components/start/binder-desk.tsx";

// ---------------------------------------------------------------------------
// /start page (Server Component)
// ---------------------------------------------------------------------------

test("/start page: gates picking on the catalog (only trackable cards are offerable)", () => {
  const src = readFile(PAGE);
  assert.match(src, /import\s*\{[^}]*\bCARD_CATALOG\b/);
  assert.match(src, /cataloguedIds=/);
});

test("/start page: is force-dynamic (the deck is live data and the tier is per-user)", () => {
  // It was force-static + 24h revalidate when the page was content-only. The
  // binder reads market_movers AND the viewer's tier, so a cached render would
  // serve one collector another's cadence copy.
  const src = readFile(PAGE);
  assert.match(src, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(src, /force-static/);
});

test("/start page: hands the scene a REAL deck and the viewer's tier", () => {
  const src = readFile(PAGE);
  assert.match(src, /getBinderDeck\(\)/, "cards come from the live deck, never invented");
  assert.match(src, /getTier\(/, "the tier decides the honest cadence line");
  assert.match(src, /signedInEmail=/, "a signed-in collector never retypes their address");
});

test("/start page: links to /legal/privacy (transparency footer)", () => {
  assert.match(readFile(PAGE), /href=["']\/legal\/privacy["']/);
});

test("/start page: headline uses the display font class", () => {
  assert.match(readFile(PAGE), /font-display/);
});

// ---------------------------------------------------------------------------
// The binder desk (Client Component) — the invariants that outlived the form
// ---------------------------------------------------------------------------

test("binder: renders the off-screen honeypot and posts it (ADR-090)", () => {
  const src = readFile(DESK);
  assert.match(src, /left-\[-9999px\]/, "honeypot stays visually hidden");
  assert.match(src, /website: website \|\| undefined/, "and it must reach the server");
});

test("binder: newsletter opt-in starts checked (US CAN-SPAM, ADR-027)", () => {
  const src = readFile(DESK);
  assert.match(src, /const \[optIn, setOptIn\] = useState\(true\)/);
  assert.match(src, /opt_in_newsletter: optIn/);
});

test("binder: captures utm_*/?src= on mount and posts attribution (ADR-084/ADR-090)", () => {
  const src = readFile(DESK);
  assert.match(src, /p\.get\("utm_source"\) \?\? p\.get\("src"\)/);
  assert.match(src, /src: utm\.source \|\| undefined/);
});

test("binder: POSTs to /api/start with the wire shape the route parses", () => {
  const src = readFile(DESK);
  assert.match(src, /fetch\("\/api\/start"/);
  assert.match(src, /method: "POST"/);
  assert.match(src, /pokemon_tcg_id: c\.id/);
});

test("binder: a blank price tag posts NULL, never a sentinel (ADR-091)", () => {
  // The market-basis watch: no target means "alert on a real dip below what it
  // usually sells for" — not $0, and never a magic number.
  assert.match(readFile(DESK), /Math\.round\(n \* 100\) : null/);
});

test("binder: surfaces the server's free-cap answer with an honest upgrade path", () => {
  // The cap is enforced SERVER-side (/api/start, ADR-113). The client must
  // render that answer rather than pretending it can never happen.
  const src = readFile(DESK);
  assert.match(src, /watch_limit_free/);
  assert.match(src, /\/pro/);
});

test("shared CardTypeahead: still the demoted typed path, debounced", () => {
  // 300ms → 200ms (quality-bar-fixes P0-4): the debounce spends a third of
  // the 600ms perceived-latency budget; the local-first route made the
  // remainder near-instant, so the tighter debounce is safe.
  assert.match(readFile("components/cards/card-typeahead.tsx"), /SEARCH_DEBOUNCE_MS\s*=\s*200/);
  assert.match(readFile(DESK), /CardTypeahead/, "the typed fallback survives for power users + a11y");
});
