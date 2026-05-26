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
import { isPublicRoute, PUBLIC_ROUTES } from "../supabase/public-routes.ts";

test("marketing pillar pages are public", () => {
  assert.equal(isPublicRoute("/pokemon-card-value-calculator"), true);
  assert.equal(isPublicRoute("/pokemon-card-condition-guide"), true);
  assert.equal(isPublicRoute("/japanese-pokemon-cards-value"), true);
});

test("blog index and every blog post are public", () => {
  assert.equal(isPublicRoute("/blog"), true);
  assert.equal(isPublicRoute("/blog/hello-world"), true);
  assert.equal(isPublicRoute("/blog/some-future-post-slug"), true);
});

test("homepage is public", () => {
  assert.equal(isPublicRoute("/"), true);
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

test("Wishlist alert cron route is public — Vercel cron infra invokes with Bearer (ADR-024)", () => {
  // The route does its own bearer gate; the proxy must not redirect a
  // bearer-authenticated request to /login or it would defeat the cron
  // entirely. Pinned via prefix for parity with /api/webhooks.
  assert.equal(isPublicRoute("/api/cron/wishlist-alerts"), true);
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

test("per-card landing pages /cards/<slug> are public — buyer-side anonymous-friendly (ADR-020 + ADR-021)", () => {
  assert.equal(isPublicRoute("/cards"), true);
  assert.equal(isPublicRoute("/cards/charizard-base-set-4"), true);
  assert.equal(isPublicRoute("/cards/some-future-slug"), true);
});

test("watchlist email-capture endpoint is public — same contract as /api/subscribe", () => {
  assert.equal(isPublicRoute("/api/watchlist"), true);
});

test("metadata routes are public so crawlers can fetch them", () => {
  assert.equal(isPublicRoute("/robots.txt"), true);
  assert.equal(isPublicRoute("/sitemap.xml"), true);
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
