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

test("newsletter subscribe endpoint is public — unauth visitors can opt in", () => {
  // The EmailCapture component currently calls a Server Action colocated with
  // the blog page (POSTs to /blog/<slug>, which is already public). Pin
  // /api/subscribe as the contract anchor so refactoring to a discrete route
  // can't accidentally regress to gated.
  assert.equal(isPublicRoute("/api/subscribe"), true);
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
});

test("PUBLIC_ROUTES is exported and non-empty so the doc has a single source of truth", () => {
  assert.ok(PUBLIC_ROUTES.length > 0);
  assert.ok(PUBLIC_ROUTES.some((r) => r.path === "/"));
  assert.ok(PUBLIC_ROUTES.some((r) => r.path === "/blog"));
});
