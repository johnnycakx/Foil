// Email-capture drift guards (Task #18 / Session 37).
//
// Unified email-capture flow, ONE ask per page (email-ask-cleanup, ADR-066),
// each surface tagged with a distinct `source` for downstream Beehiiv segmentation:
//   - Watchlist form on /cards/[slug] → 'watchlist-form' (opt-in checkbox; a
//     price alert, not a newsletter ask — kept)
//   - /newsletter landing page → 'newsletter-landing' (the dedicated capture)
//   - Homepage hero → 'homepage_hero'; /deals → 'deals_board'; blog body →
//     'blog_inline'; pillars → 'pillar_*'
//   - The global footer email form was REMOVED — the footer is nav/legal/trust
//     only (the 'footer' source is retired).
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
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Strip JS/JSX block + line comments so a literal in an explanatory comment
 *  (e.g. documenting a number we REMOVED) can't trip a "no hardcoded X" guard. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
// newsletter-conversion-fixes — cadence consistency, no-fabrication, social card
// ---------------------------------------------------------------------------

test("Task 1: EmailCapture carries NO 'twice a week' email-cadence copy (one email a week)", () => {
  const src = readFile("components/email-capture.tsx");
  // The newsletter promise is ONE email a week (the blog auto-publishes twice
  // weekly — a separate thing that must not leak into email-cadence copy).
  assert.doesNotMatch(src, /twice a week/i, "email-capture must not promise a twice-a-week cadence");
  assert.match(src, /once a week/i, "email-capture must state the one-a-week cadence");
});

test("Task 2: newsletter page has NO hardcoded fabricated excerpts / dollar comps (R-001)", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  // The old SAMPLE_EXCERPTS invented three dated newsletter issues with
  // fabricated specific market figures presented as real past issues. They
  // violated the no-fabrication discipline. The page must carry neither the
  // const nor any of its invented comps.
  assert.doesNotMatch(src, /SAMPLE_EXCERPTS/, "the fabricated SAMPLE_EXCERPTS const must be gone");
  assert.doesNotMatch(src, /cleared at \$32/, "the invented '$32' Charizard comp must be gone");
  assert.doesNotMatch(src, /151\/165/, "the invented 151/165 comp must be gone");
  assert.doesNotMatch(src, /32% premium/, "the invented reverse-holo premium figure must be gone");
  assert.doesNotMatch(src, /Week of 2026-05/, "the stale dated-issue labels must be gone");
  // No hardcoded dollar literal may survive on the page — every figure now
  // traces to live market_movers data through the snippet component.
  assert.doesNotMatch(src, /\$\d/, "no hardcoded dollar figure may appear on the newsletter page");
});

test("Task 2: newsletter page renders the real-data RecentReadSnippet (not invented issues)", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  assert.match(src, /import\s+\{[^}]*\bRecentReadSnippet\b[^}]*\}\s+from\s+["']@\/components\/newsletter\/recent-read-snippet["']/);
  assert.match(src, /import\s+\{[^}]*\bgetMarketMovers\b[^}]*\}\s+from\s+["']@\/lib\/deals\/market-movers-read["']/);
  assert.match(src, /<RecentReadSnippet\s+movers=\{movers\}/);
  // The page must actually await the live read, so the proof is real.
  assert.match(src, /await\s+getMarketMovers\(/);
});

test("Task 2: RecentReadSnippet sources every figure from MoverRow data, no hardcoded comps", () => {
  const src = readFile("components/newsletter/recent-read-snippet.tsx");
  // The component formats real avg7d/avg30d/momentumPct fields — outside its own
  // explanatory comments it must carry no hardcoded dollar literal (which would
  // be a fabricated number).
  assert.doesNotMatch(stripComments(src), /\$\d/, "no hardcoded dollar figure in the snippet component");
  assert.match(src, /m\.avg7d/, "figures must come from the live avg7d field");
  assert.match(src, /m\.avg30d/, "figures must come from the live avg30d field");
});

test("Task 3: /newsletter exposes a page-specific twitter card matching the subscribe value-prop", () => {
  const src = readFile("app/(site)/newsletter/page.tsx");
  // Without its own block the page inherits the generic site twitter card. The
  // block must exist, use a large image, and reuse the subscribe-ask copy.
  assert.match(src, /twitter:\s*\{/, "page must declare a twitter metadata block");
  assert.match(src, /twitter:\s*\{[\s\S]*?card:\s*["']summary_large_image["']/);
  assert.match(src, /twitter:\s*\{[\s\S]*?title:\s*PAGE_TITLE/, "twitter title must reuse the subscribe-ask PAGE_TITLE");
  assert.match(src, /twitter:\s*\{[\s\S]*?description:\s*PAGE_DESCRIPTION/, "twitter description must reuse the one-a-week PAGE_DESCRIPTION");
});

// ---------------------------------------------------------------------------
// One email ask per page (email-ask-cleanup, ADR-066): the global footer email
// form was removed (footer = nav/legal/trust only); the homepage asks once.
// ---------------------------------------------------------------------------

test("(site) layout: footer renders NO email capture (nav/legal/trust only)", () => {
  const src = readFile("app/(site)/layout.tsx");
  assert.doesNotMatch(src, /FooterEmailCapture/, "footer email form was removed");
  assert.doesNotMatch(src, /<EmailCapture\b/, "no inline EmailCapture in the global footer/layout");
});

test("footer-email-capture component is deleted", () => {
  assert.ok(
    !existsSync(join(ROOT, "components/footer-email-capture.tsx")),
    "components/footer-email-capture.tsx should no longer exist",
  );
});

test("homepage: renders exactly ONE EmailCapture (the hero ask)", () => {
  const src = readFile("app/(site)/page.tsx");
  const count = (src.match(/<EmailCapture\b/g) ?? []).length;
  assert.equal(count, 1, `homepage must make exactly one email ask, found ${count}`);
});

test("(site) layout: footer surfaces Privacy + Terms + Newsletter links", () => {
  const src = readFile("app/(site)/layout.tsx");
  assert.match(src, /href=["']\/newsletter["']/);
  assert.match(src, /href=["']\/legal\/privacy["']/);
  assert.match(src, /href=["']\/legal\/terms["']/);
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

// ---------------------------------------------------------------------------
// G-EMAIL / ADR-065 — homepage reorient (email-capture-primary) + inline
// capture on the ranking content surfaces. Each surface keeps a distinct
// `source` so blog / pillar / hero / footer signups segment apart in Beehiiv.
// ---------------------------------------------------------------------------

test("homepage: hero EmailCapture is tagged source='homepage_hero' (primary CTA)", () => {
  const src = readFile("app/(site)/page.tsx");
  assert.match(src, /<EmailCapture\s+source="homepage_hero"/);
});

test("blog post body: non-vending inline EmailCapture tagged source='blog_inline'", () => {
  const src = readFile("app/(site)/blog/[slug]/page.tsx");
  assert.match(src, /source="blog_inline"/);
  // The vending branch must NOT carry the blog_inline capture (host CTA only).
  assert.match(src, /href="\/host"/, "vending branch keeps the host CTA");
});

test("pillar pages: surface the lead-magnet CTA, not a generic inline capture (ADR-068, one ask per page)", () => {
  // ADR-068 replaced the generic pillar_* inline EmailCapture with the stronger,
  // specific lead-magnet offer (a CTA -> the /free magnet page where the capture
  // + on-page delivery live). One ask per page (ADR-066) is preserved.
  const files = [
    "app/(site)/pokemon-card-condition-guide/page.tsx",
    "app/(site)/pokemon-card-value-calculator/page.tsx",
    "app/(site)/japanese-pokemon-cards-value/page.tsx",
  ];
  for (const f of files) {
    const src = readFile(f);
    assert.match(src, /<LeadMagnetCTA\b/, `${f} must render the LeadMagnetCTA`);
    assert.doesNotMatch(src, /source="pillar_/, `${f} must no longer carry a pillar_* EmailCapture`);
  }
});
