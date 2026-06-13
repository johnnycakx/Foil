// Email-capture drift guards (Task #18 / Session 37).
//
// Unified email-capture flow has four surfaces, each tagged with a distinct
// `source` string for downstream Beehiiv segmentation:
//   - Watchlist form on /cards/[slug] → 'watchlist-form' (opt-in checkbox)
//   - /newsletter landing page → 'newsletter-landing'
//   - Footer email capture (every (site) page) → 'footer'
//
// These tests are STRUCTURAL drift guards, not behavioural tests — they
// verify the source-tag literal appears at each call site and that the
// watchlist route gates its Beehiiv subscribe on the opt_in_newsletter
// boolean with the correct source. A drift in either direction (someone
// renames the source string, or forgets to gate the subscribe on the
// opt-in flag) fails CI.
//
// Live behavioural verification is part of the closure-gate manual probe
// (submit each form, confirm the Beehiiv subscriber lands with the right
// source). This pair — structural CI guard + live verification — is the
// R-010 application: tests can't validate live integration end-to-end,
// but they can pin the structural anchors a refactor would slip past.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// /api/watchlist route — opt-in gate + source string
// ---------------------------------------------------------------------------

test("watchlist route: imports subscribeEmail from lib/beehiiv", () => {
  const src = readFile("app/api/watchlist/route.ts");
  assert.match(
    src,
    /import\s+\{[^}]*\bsubscribeEmail\b[^}]*\}\s+from\s+["']@\/lib\/beehiiv["']/,
    "watchlist route must import subscribeEmail from @/lib/beehiiv",
  );
});

test("watchlist route: zod schema declares opt_in_newsletter as optional boolean", () => {
  const src = readFile("app/api/watchlist/route.ts");
  // The shape must accept the boolean from the form even when absent (older
  // clients won't send it). We don't assert the exact zod chain — just that
  // the field name appears alongside z.boolean().
  assert.match(src, /opt_in_newsletter\s*:\s*z\.boolean\(\)/);
});

test("watchlist route: subscribe is gated on opt_in_newsletter being truthy", () => {
  const src = readFile("app/api/watchlist/route.ts");
  // The current structure is `if (parsed.data.opt_in_newsletter)`; future
  // refactor may use a different destructuring. The invariant: the literal
  // string "opt_in_newsletter" appears in an if-statement somewhere before
  // the subscribeEmail call.
  const optInIdx = src.indexOf("opt_in_newsletter");
  const subscribeIdx = src.search(/subscribeEmail\s*\(/);
  assert.ok(optInIdx >= 0, "expected opt_in_newsletter reference");
  assert.ok(subscribeIdx >= 0, "expected subscribeEmail call");
  // The opt-in check must appear textually BEFORE the subscribe call — if it
  // appears after, the subscribe runs unconditionally.
  const lastOptInBeforeSubscribe = src.slice(0, subscribeIdx).lastIndexOf("opt_in_newsletter");
  assert.ok(
    lastOptInBeforeSubscribe >= 0,
    "subscribeEmail must be gated on a textually-prior opt_in_newsletter reference",
  );
});

test("watchlist route: subscribeEmail is called with source='watchlist-form'", () => {
  const src = readFile("app/api/watchlist/route.ts");
  // The literal source string must appear so the Beehiiv UTM tag is right.
  // Renaming this source string changes downstream segmentation; the rename
  // must be conscious.
  assert.match(src, /source\s*:\s*["']watchlist-form["']/);
});

test("watchlist route: Beehiiv failure does NOT short-circuit the OK response", () => {
  const src = readFile("app/api/watchlist/route.ts");
  // The soft-fail pattern: catch around subscribeEmail, OR an `if (!result.ok)`
  // that logs and continues. Either way, the route must reach `NextResponse
  // .json({ ok: true })` regardless of Beehiiv outcome. We pin the structural
  // signal: `subscribeEmail` is inside a try/catch.
  const subscribeIdx = src.search(/subscribeEmail\s*\(/);
  assert.ok(subscribeIdx >= 0);
  // Walk backward from the subscribeEmail call site looking for a `try {`
  // within the same function — within the last 400 chars is the simplest
  // proxy for "wrapped in try/catch".
  const before = src.slice(Math.max(0, subscribeIdx - 400), subscribeIdx);
  assert.match(
    before,
    /\btry\s*\{/,
    "subscribeEmail call must be wrapped in try/catch for soft-fail",
  );
});

// ---------------------------------------------------------------------------
// /newsletter landing page — source='newsletter-landing'
// ---------------------------------------------------------------------------

test("newsletter page: EmailCapture invoked with source='newsletter-landing'", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  assert.match(src, /<EmailCapture[\s\S]*?source\s*=\s*["']newsletter-landing["']/);
});

test("newsletter page: declares force-static + 24h revalidate (per goal)", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  assert.match(src, /export\s+const\s+dynamic\s*=\s*["']force-static["']/);
  assert.match(src, /export\s+const\s+revalidate\s*=\s*86400/);
});

test("newsletter page: links to /legal/privacy (transparency footer)", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  assert.match(src, /href=["']\/legal\/privacy["']/);
});

// ---------------------------------------------------------------------------
// Footer email capture — source='footer'
// ---------------------------------------------------------------------------

test("footer email capture: wraps EmailCapture with source='footer'", () => {
  const src = readFile("components/footer-email-capture.tsx");
  assert.match(src, /source\s*=\s*["']footer["']/);
  assert.match(src, /variant\s*=\s*["']footer["']/);
});

test("(site) layout: footer drops the deal-finder newsletter capture (vending pivot)", () => {
  // The pivot removed FooterEmailCapture (a deal-finder newsletter signup) from
  // the footer; the footer now points at the vending host funnel instead.
  const src = readFile("app/(site)/layout.tsx");
  assert.doesNotMatch(src, /FooterEmailCapture/, "FooterEmailCapture must be gone from the layout");
  assert.match(src, /href="\/host"/, "footer surfaces the host CTA");
});

test("(site) layout: footer surfaces Privacy + Terms + host nav, no deal-finder links", () => {
  const src = readFile("app/(site)/layout.tsx");
  assert.match(src, /href=["']\/legal\/privacy["']/);
  assert.match(src, /href=["']\/legal\/terms["']/);
  assert.match(src, /href=["']\/service-areas["']/);
  assert.match(src, /href=["']\/faq["']/);
  // Deal-finder footer links are gone under the pivot.
  assert.doesNotMatch(src, /href=["']\/newsletter["']/, "the /newsletter link must be gone");
  assert.doesNotMatch(src, /href=["']\/pricing-methodology["']/, "the /pricing-methodology link must be gone");
});

// ---------------------------------------------------------------------------
// WatchlistForm UI — opt-in checkbox + correct label phrasing
// ---------------------------------------------------------------------------

// Session 49b moved the inline form to components/cards/watchlist-form.tsx, a
// Client Component submitting via the createWatchlist Server Action (the
// inline-script fetch is gone). The opt-in invariants now live there.

test("WatchlistForm: renders opt_in_newsletter checkbox, default-checked", () => {
  const src = readFile("components/cards/watchlist-form.tsx");
  assert.match(src, /name=["']opt_in_newsletter["']/);
  assert.match(src, /defaultChecked/);
});

test("WatchlistForm: label includes the goal's required honest framing", () => {
  const src = readFile("components/cards/watchlist-form.tsx");
  // The label must set explicit expectations: cadence + unsubscribe path.
  assert.match(src, /weekly deals newsletter/i);
  assert.match(src, /unsubscribe anytime/i);
});

test("WatchlistForm: submits via the createWatchlist Server Action with the opt-in field", () => {
  const src = readFile("components/cards/watchlist-form.tsx");
  // FormData carries opt_in_newsletter to the action (the action gates the
  // Beehiiv subscribe on its presence). Pin the action wiring + the field.
  assert.match(src, /createWatchlist/);
  assert.match(src, /useActionState/);
  assert.match(src, /name=["']opt_in_newsletter["']/);
});

test("createWatchlist action: gates the Beehiiv subscribe on opt_in_newsletter, soft-fails", () => {
  const src = readFile("app/actions/create-watchlist.ts");
  assert.match(src, /source:\s*["']watchlist-form["']/, "subscribe tagged source=watchlist-form");
  const optInIdx = src.indexOf("opt_in_newsletter");
  const subscribeIdx = src.search(/subscribeEmail\s*\(/);
  assert.ok(optInIdx >= 0 && subscribeIdx >= 0);
  assert.ok(
    src.slice(0, subscribeIdx).lastIndexOf("opt_in_newsletter") >= 0,
    "subscribe must be gated on a textually-prior opt_in_newsletter check",
  );
  // Soft-fail: subscribe wrapped in try/catch.
  const before = src.slice(Math.max(0, subscribeIdx - 400), subscribeIdx);
  assert.match(before, /\btry\s*\{/);
});
