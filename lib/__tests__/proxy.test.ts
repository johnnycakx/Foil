// Contract test for the auth-proxy public-route allowlist.
//
// The bug this pins: marketing pages and the magic-link callback were getting
// redirected to /login by the proxy's default-deny posture, which broke SEO
// (Google can't crawl gated pages) AND broke the magic-link flow (the redirect
// consumed the OTP code before /auth/callback could exchange it).
//
// We test the pure routing predicate (isPublicRoute) rather than the full
// updateSession() flow — exercising the predicate is what fails first when the
// allowlist regresses, and it doesn't require mocking the Supabase client.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPublicRoute, PUBLIC_ROUTES } from "../supabase/public-routes.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("marketing pillar pages are public", () => {
  assert.equal(isPublicRoute("/pokemon-card-value-calculator"), true);
  assert.equal(isPublicRoute("/pokemon-card-condition-guide"), true);
  assert.equal(isPublicRoute("/japanese-pokemon-cards-value"), true);
});

test("blog index and every blog post are public", () => {
  assert.equal(isPublicRoute("/blog"), true);
  assert.equal(isPublicRoute("/blog/how-much-is-my-pokemon-card-worth-a-60-second-checklist"), true);
  assert.equal(isPublicRoute("/blog/some-future-post-slug"), true);
});

test("homepage is public", () => {
  assert.equal(isPublicRoute("/"), true);
});

test("buy-signal methodology page is public (ADR-053)", () => {
  assert.equal(isPublicRoute("/pricing-methodology"), true);
});

test("lead-magnet pages under /free/* are public + crawlable (ADR-068)", () => {
  // The magnet landing page must rank and be reachable anonymously; the gated
  // asset reveals client-side after subscribe. Prefix covers future magnets.
  assert.equal(isPublicRoute("/free"), true);
  assert.equal(isPublicRoute("/free/pokemon-card-pricing-cheat-sheet"), true);
  assert.equal(isPublicRoute("/free/some-future-magnet"), true);
  // The keepable PDF asset (cheat-sheet-flow-fix). Static /public file under
  // /free/* — the welcome email links straight to it, so it must resolve
  // unauthenticated. Covered by the prefix (belt-and-suspenders: PDF requests
  // also bypass middleware via the proxy.ts matcher's static-extension exclude).
  assert.equal(isPublicRoute("/free/foil-pokemon-card-pricing-cheat-sheet.pdf"), true);
  // Bleed guard: an adjacent stem must stay gated.
  assert.equal(isPublicRoute("/freebies"), false);
  assert.equal(isPublicRoute("/free-stuff"), false);
});

test("auth-proxy matcher excludes static .pdf requests (they bypass middleware)", () => {
  // The keepable cheat-sheet PDF is served straight from /public. The proxy
  // matcher in proxy.ts excludes static extensions (incl. pdf), so the request
  // never hits updateSession — there is no auth gate to re-prompt an already-
  // subscribed visitor. Pin the exclude so a future matcher change can't
  // silently route PDFs (and other static assets) through the auth redirect.
  const proxySrc = readFileSync(join(ROOT, "proxy.ts"), "utf8");
  const matcher = proxySrc.match(/matcher:\s*\[([\s\S]*?)\]/);
  assert.ok(matcher, "proxy.ts must declare a matcher");
  assert.match(matcher![1], /pdf/, "matcher must exclude .pdf static requests");
});

test("/go/deal/[slug] click-time redirect is public (ADR-056)", () => {
  // Buyer click-through from the leaderboard; must be reachable anonymously.
  assert.equal(isPublicRoute("/go/deal/base1-4-charizard"), true);
  assert.equal(isPublicRoute("/go"), true);
  // Prefix must not bleed into an adjacent stem.
  assert.equal(isPublicRoute("/google-thing"), false);
});

test("/deals leaderboard is public — screenshot surface + homepage CTA (ADR-054)", () => {
  // Renders from the buy_signals cache; anonymous-friendly, crawlable. The
  // refresh cron at /api/cron/deals-refresh is covered by the /api/cron prefix.
  assert.equal(isPublicRoute("/deals"), true);
  assert.equal(isPublicRoute("/api/cron/deals-refresh"), true);
  // Exact rule — must not bleed into an adjacent stem.
  assert.equal(isPublicRoute("/dealsroom"), false);
});

test("login + magic-link callback are public (or the magic link loops)", () => {
  assert.equal(isPublicRoute("/login"), true);
  assert.equal(isPublicRoute("/auth/callback"), true);
  // Any future /auth/* sub-route (eg /auth/verify) must also stay public —
  // they're all part of the unauthenticated handshake.
  assert.equal(isPublicRoute("/auth/verify"), true);
});

test("3rd-party webhooks are public — Stripe POSTs with its own signature", () => {
  assert.equal(isPublicRoute("/api/webhooks/stripe"), true);
});

test("Vercel deploy webhook is public — Vercel signs requests with its own HMAC", () => {
  // Covered by the /api/webhooks prefix already. Pin the contract so a future
  // refactor that swaps the prefix for individual exact rules can't silently
  // gate this route.
  assert.equal(isPublicRoute("/api/webhooks/vercel-deploys"), true);
});

test("/legal/* pages are public — reviewer-facing compliance surface (Session 33)", () => {
  // The public mirror of docs/EBAY-COMPLIANCE.md is the URL pasted into
  // eBay's Application Growth Check supporting-evidence field. It MUST
  // stay crawlable. Future privacy / ToS pages land under the same prefix.
  assert.equal(isPublicRoute("/legal/ebay-api-compliance"), true);
  assert.equal(isPublicRoute("/legal/privacy"), true); // future
  assert.equal(isPublicRoute("/legal/terms"), true); // future
});

test("/legal prefix doesn't bleed into adjacent path stems", () => {
  // The /legal prefix is "prefix" type — matches /legal and /legal/...
  // but must NOT match /legalsomething or /legal-archive.
  assert.equal(isPublicRoute("/legalsomething"), false);
  assert.equal(isPublicRoute("/legal-archive"), false);
});

test("Engagement-brief cron route is public — Vercel cron infra invokes with Bearer (ADR-086)", () => {
  // Read+draft+deliver engine; self-gates on CRON_SECRET + ENGAGEMENT_BRIEF_ENABLED.
  // Covered by the /api/cron prefix; pinned so a refactor can't gate it.
  assert.equal(isPublicRoute("/api/cron/engagement-brief"), true);
});

test("Format-mining cron route is public — Vercel cron infra invokes with Bearer (ADR-087)", () => {
  // Content-intelligence sweep; self-gates on CRON_SECRET + FORMAT_MINING_ENABLED.
  // Covered by the /api/cron prefix; pinned so a refactor can't gate it.
  assert.equal(isPublicRoute("/api/cron/format-mining"), true);
});

test("Wishlist alert cron route is public — Vercel cron infra invokes with Bearer (ADR-024)", () => {
  // The route does its own bearer gate; the proxy must not redirect a
  // bearer-authenticated request to /login or it would defeat the cron
  // entirely. Pinned via prefix for parity with /api/webhooks.
  assert.equal(isPublicRoute("/api/cron/wishlist-alerts"), true);
});

test("Resend unsubscribe webhook is public — Resend POSTs with its own Svix signature (ADR-082)", () => {
  // Covered today by the /api/webhooks prefix (same as Stripe / Vercel / eBay).
  // The Svix signature header IS the auth; the route self-verifies. Pinned here
  // so a refactor to per-route exact rules can't silently gate the endpoint —
  // Resend would then get a 302 to /login and unsubscribe sync would break.
  assert.equal(isPublicRoute("/api/webhooks/resend"), true);
});

test("eBay Marketplace Account Deletion webhook is public (ADR-022)", () => {
  // Same contract anchor as the Vercel-deploys webhook: covered today by
  // the /api/webhooks prefix, pinned here so a refactor to per-route exact
  // rules can't silently gate the endpoint. eBay's GET-challenge handshake
  // hard-fails if the URL redirects to /login, so this MUST stay public.
  assert.equal(isPublicRoute("/api/webhooks/ebay-marketplace-deletion"), true);
});

test("eBay deletion webhook is reachable but adjacent stems can't bleed past /api/webhooks", () => {
  // The /api/webhooks prefix legitimately covers any sub-path including
  // /api/webhooks/ebay-marketplace-deletion. What MUST NOT bleed: an
  // adjacent stem at the /api/webhooks boundary. If the prefix ever swaps
  // to exact-list rules and someone forgets the trailing-slash safety,
  // /api/webhooks-public could silently match.
  assert.equal(isPublicRoute("/api/webhooks-public"), false);
  assert.equal(isPublicRoute("/api/webhookspublic"), false);
});

test("newsletter subscribe endpoint is public — unauth visitors can opt in", () => {
  // The EmailCapture component currently calls a Server Action colocated with
  // the blog page (POSTs to /blog/<slug>, which is already public). Pin
  // /api/subscribe as the contract anchor so refactoring to a discrete route
  // can't accidentally regress to gated.
  assert.equal(isPublicRoute("/api/subscribe"), true);
});

test("/newsletter landing page is public — Twitter-CTA target (Task #18 / Session 37)", () => {
  // The newsletter landing page must be crawlable for SEO and reachable
  // anonymously — the entire point is to convert a Twitter visitor into
  // an email subscriber.
  assert.equal(isPublicRoute("/newsletter"), true);
});

test("/api/x/approve is public — bot-triggered, self-gates on X_APPROVE_SECRET (ADR-071)", () => {
  // The Foil HQ bot POSTs here after the owner approves a draft; the route does
  // its own bearer check. It must be reachable without a Supabase session or the
  // proxy would 302 the bot to /login and approval would silently break.
  assert.equal(isPublicRoute("/api/x/approve"), true);
  // Exact rule — must not bleed into an adjacent stem.
  assert.equal(isPublicRoute("/api/x/approve-all"), false);
  assert.equal(isPublicRoute("/api/x"), false);
});

test("/api/newsletter/approve is public — bot-triggered, self-gates on NEWSLETTER_APPROVE_SECRET (ADR-077)", () => {
  // The Foil HQ bot POSTs here when the owner approves a digest draft whose id
  // was not an X draft; the route does its own bearer check. Must be reachable
  // without a Supabase session or the proxy would 302 the bot to /login.
  assert.equal(isPublicRoute("/api/newsletter/approve"), true);
  // Exact rule — must not bleed into an adjacent stem.
  assert.equal(isPublicRoute("/api/newsletter/approve-all"), false);
  assert.equal(isPublicRoute("/api/newsletter"), false);
});

test("/api/reply-desk/approve is public — bot-triggered, self-gates on X_REPLY_DESK_SECRET (ADR-107)", () => {
  // The Foil HQ bot POSTs here after the owner clicks Reply/Edit/Skip; the route
  // does its own bearer check + API-posts the reply. Must be reachable without a
  // Supabase session or the proxy would 302 the bot to /login and Approve breaks.
  assert.equal(isPublicRoute("/api/reply-desk/approve"), true);
  // Exact rule — must not open the rest of the stem.
  assert.equal(isPublicRoute("/api/reply-desk"), false);
  assert.equal(isPublicRoute("/api/reply-desk/anything"), false);
});

test("/api/receipts is public — bookmarklet-triggered, self-gates on X_RECEIPTS_SECRET (ADR-107)", () => {
  // John's receipts bookmarklet/Shortcut POSTs here cross-origin from x.com; the
  // route does its own bearer check + rate limit + CORS. Must be reachable
  // without a Supabase session or the proxy would 302 the cross-origin call to
  // /login and the in-flow tool would break.
  assert.equal(isPublicRoute("/api/receipts"), true);
  // Exact rule — must not bleed into an adjacent stem.
  assert.equal(isPublicRoute("/api/receipts-all"), false);
  assert.equal(isPublicRoute("/api/receipt"), false);
});

test("/api/unsubscribe is public — RFC 8058 one-click + token IS the auth (Task #18)", () => {
  // The endpoint accepts GET (visible-link path) and POST (List-Unsubscribe-
  // Post). The HMAC token in the query string is the only auth — the route
  // cannot redirect to /login or mail clients can't fulfil the one-click flow.
  assert.equal(isPublicRoute("/api/unsubscribe"), true);
});

test("/start onboarding page + supporting APIs are public (Task #20 / Session 38)", () => {
  // /start is the new headline Twitter-CTA target. Must be crawlable for
  // SEO AND reachable anonymously. The supporting /api/start (bulk insert)
  // + /api/cards/search (typeahead) must also be reachable without auth —
  // the page is anonymous-friendly per ADR-020.
  assert.equal(isPublicRoute("/start"), true);
  assert.equal(isPublicRoute("/api/start"), true);
  assert.equal(isPublicRoute("/api/cards/search"), true);
});

test("/newsletter prefix doesn't bleed (exact route, not prefix)", () => {
  // /newsletter is registered as exact, NOT prefix, so it must NOT match
  // /newsletters or /newsletter-archive. If a future change needs nested
  // routes, swap to prefix consciously + add a bleed guard.
  assert.equal(isPublicRoute("/newsletters"), false);
  assert.equal(isPublicRoute("/newsletter-archive"), false);
  assert.equal(isPublicRoute("/newsletter/anything"), false);
});

test("vending surfaces /machines + /host are public (Phase V-1, STRATEGY-VENDING-2026-06-12)", () => {
  // /machines is the locator hub — prefix, because /machines/[location]
  // pages arrive in V-2 and GBP kiosk rules require a crawlable locator.
  assert.equal(isPublicRoute("/machines"), true);
  assert.equal(isPublicRoute("/machines/some-future-location"), true);
  // /host is the venue-acquisition funnel — exact.
  assert.equal(isPublicRoute("/host"), true);
  // Bleed guards: neighbors must stay gated.
  assert.equal(isPublicRoute("/machinesroom"), false);
  assert.equal(isPublicRoute("/hosting"), false);
  assert.equal(isPublicRoute("/host/anything"), false);
});

test("vending host-lead-gen surfaces /faq + /service-areas[/city] are public (docs/vending Goal A)", () => {
  // /faq is the host FAQ — exact. /service-areas is the hub + its city pages
  // (prefix), all crawlable marketing surfaces under the vending pivot.
  assert.equal(isPublicRoute("/faq"), true);
  assert.equal(isPublicRoute("/service-areas"), true);
  assert.equal(isPublicRoute("/service-areas/napa"), true);
  assert.equal(isPublicRoute("/service-areas/walnut-creek"), true);
  // Bleed guards: adjacent stems stay gated.
  assert.equal(isPublicRoute("/faqs"), false);
  assert.equal(isPublicRoute("/faq-archive"), false);
  assert.equal(isPublicRoute("/service-areas-internal"), false);
});

test("per-card landing pages /cards/<slug> are public — buyer-side anonymous-friendly (ADR-020 + ADR-021)", () => {
  assert.equal(isPublicRoute("/cards"), true);
  assert.equal(isPublicRoute("/cards/charizard-base-set-4"), true);
  assert.equal(isPublicRoute("/cards/some-future-slug"), true);
});

test("line-tracker pages /lines/<pokemon> are public — shareable SEO surfaces (ADR-095)", () => {
  assert.equal(isPublicRoute("/lines/umbreon"), true);
  assert.equal(isPublicRoute("/lines/espeon"), true);
  assert.equal(isPublicRoute("/lines/umbreon/opengraph-image"), true);
  // Segment-scoped: /linesomething stays gated.
  assert.equal(isPublicRoute("/linesomething"), false);
});

test("watchlist email-capture endpoint is public — same contract as /api/subscribe", () => {
  assert.equal(isPublicRoute("/api/watchlist"), true);
});

test("/api/listing/[slug] is public — client-hydrated curated listing (ADR-047 v2 SEO fix)", () => {
  // The per-card page fetches its live eBay best-listing here client-side so the
  // server render stays fast + crawlable. Must be reachable anonymously (same as
  // the card page). Deliberately under /api/listing so it does NOT open the rest
  // of /api/cards/* (the "user-data API routes require auth" test keeps
  // /api/cards gated).
  assert.equal(isPublicRoute("/api/listing/base1-2-blastoise"), true);
  assert.equal(isPublicRoute("/api/listing/some-future-slug"), true);
  // Bleed guard: an adjacent stem stays gated.
  assert.equal(isPublicRoute("/api/listings"), false);
  assert.equal(isPublicRoute("/api/listing-internal"), false);
});

test("metadata routes are public so crawlers can fetch them", () => {
  assert.equal(isPublicRoute("/robots.txt"), true);
  assert.equal(isPublicRoute("/sitemap.xml"), true);
  // llms.txt must be public or the proxy 307s it to /login (SEO/agent audit fail).
  assert.equal(isPublicRoute("/llms.txt"), true);
});

test("/upload requires auth", () => {
  assert.equal(isPublicRoute("/upload"), false);
});

test("/account requires auth", () => {
  assert.equal(isPublicRoute("/account"), false);
});

test("user-data API routes require auth", () => {
  // None of these exist yet (scan/identify run via Server Actions), but pin
  // the contract so the day someone adds an /api/scan endpoint it doesn't
  // accidentally land in the public list.
  assert.equal(isPublicRoute("/api/scan"), false);
  assert.equal(isPublicRoute("/api/identify"), false);
  assert.equal(isPublicRoute("/api/cards"), false);
});

test("an unknown new route defaults to gated", () => {
  // Default-deny is the safety property — adding a new private surface should
  // never require remembering to update an exclusion list.
  assert.equal(isPublicRoute("/some-new-private-route"), false);
});

test("prefix entries don't accidentally match adjacent path stems", () => {
  // "/blog/" (with trailing slash) shouldn't bleed into "/blogs" or
  // "/blog-archive" — that would silently expose siblings of any future
  // private route.
  assert.equal(isPublicRoute("/blogs"), false);
  assert.equal(isPublicRoute("/blog-archive"), false);
  // Likewise "/auth/" shouldn't match "/authentication" if we ever add one.
  assert.equal(isPublicRoute("/authentication"), false);
  // "/cards" prefix shouldn't bleed into a future "/api/cards" (which the
  // user-data test pins as gated) or "/card-condition-guide" (the existing
  // pillar, registered as exact).
  assert.equal(isPublicRoute("/cardsomething"), false);
});

test("PUBLIC_ROUTES is exported and non-empty so the doc has a single source of truth", () => {
  assert.ok(PUBLIC_ROUTES.length > 0);
  assert.ok(PUBLIC_ROUTES.some((r) => r.path === "/"));
  assert.ok(PUBLIC_ROUTES.some((r) => r.path === "/blog"));
});

test("eve vanity shortcuts /umbreon + /espeon are public and 302 to the UTM'd line pages (eve-clean-links)", async () => {
  // These paths appear in a LIVE TWEET — a refactor that kills them is
  // permanent public breakage. Pin the allowlist entries AND the redirect
  // contract (temporary 302, never permanent: the destination gets
  // re-pointed post-event and a cached 301/308 would freeze the UTM URL).
  assert.equal(isPublicRoute("/umbreon"), true);
  assert.equal(isPublicRoute("/espeon"), true);
  // Exact rules — no stem bleed.
  assert.equal(isPublicRoute("/umbreonx"), false);
  const { GET: umbreon } = await import("../../app/umbreon/route.ts");
  const { GET: espeon } = await import("../../app/espeon/route.ts");
  const u = umbreon(new Request("https://foiltcg.com/umbreon"));
  assert.equal(u.status, 302, "temporary 302, never 301/308");
  assert.equal(
    u.headers.get("location"),
    "https://foiltcg.com/lines/umbreon?utm_source=x&utm_medium=eve",
    "location carries the full UTM query",
  );
  const e = espeon(new Request("https://foiltcg.com/espeon"));
  assert.equal(e.status, 302);
  assert.equal(e.headers.get("location"), "https://foiltcg.com/lines/espeon?utm_source=x&utm_medium=eve");
});

test("bio link /x is public and 302s to the homepage with bio attribution (x-profile-banner addendum)", async () => {
  // Lives in the @FoilTCG bio — same permanence stakes as the tweet links.
  assert.equal(isPublicRoute("/x"), true);
  assert.equal(isPublicRoute("/xyz"), false, "exact rule - no stem bleed");
  const { GET } = await import("../../app/x/route.ts");
  const r = GET(new Request("https://foiltcg.com/x"));
  assert.equal(r.status, 302, "temporary 302, never 301/308");
  // x-reply-desk §4: the bio link now carries the full campaign attribution.
  assert.equal(r.headers.get("location"), "https://foiltcg.com/?utm_source=x&utm_medium=bio&utm_campaign=profile");
});

test("/eve is public and 302s to the seeded gift vault with eve UTMs; soft-falls to /start when the secret is missing (eve-vault)", async () => {
  // Lives in the SAME reply thread as /umbreon — permanence stakes identical.
  assert.equal(isPublicRoute("/eve"), true);
  assert.equal(isPublicRoute("/evex"), false, "exact rule - no stem bleed");
  const { GET } = await import("../../app/eve/route.ts");

  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  try {
    // With the secret: mint + 302 to /w/<seeded-token> carrying the UTMs.
    process.env.UNSUBSCRIBE_TOKEN_SECRET = "test-secret-key-that-is-long-enough";
    const r = GET(new Request("https://foiltcg.com/eve"));
    assert.equal(r.status, 302, "temporary 302, never 301/308");
    const loc = r.headers.get("location") ?? "";
    assert.match(loc, /^https:\/\/foiltcg\.com\/w\/.+\?utm_source=x&utm_medium=eve$/, "seeded vault + UTMs");

    // Without the secret: a tweeted link must NEVER 404 — soft-fall to /start.
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    const fallback = GET(new Request("https://foiltcg.com/eve"));
    assert.equal(fallback.status, 302);
    assert.match(fallback.headers.get("location") ?? "", /\/start\?/, "soft-fall keeps the link alive");
  } finally {
    if (prev === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
});
