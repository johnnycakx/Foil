// Contract test for the XML sitemap's fixed landing-page set.
//
// The bug this pins: /deals (the "Today's best deals" leaderboard, ADR-054 —
// the X-bot screenshot surface and homepage primary CTA) shipped public and
// crawlable but was never added to app/sitemap.ts, so Google had no path to it
// from the sitemap. /pricing-methodology (the buy-signal trust page, ADR-053)
// had the same gap. Surfaced in the 2026-06-06 GSC review.
//
// We test the pure LANDING_PATHS data module (extracted from app/sitemap.ts so
// it carries no Next.js runtime imports) the same way proxy.test.ts tests the
// public-routes predicate — exercising the data is what fails first when the
// sitemap's fixed-page set regresses, with no Next/MDX/catalog machinery.

import test from "node:test";
import assert from "node:assert/strict";
import { LANDING_PATHS } from "../seo/sitemap-landings.ts";
import { isPublicRoute } from "../supabase/public-routes.ts";

test("both tracks' fixed surfaces are in the sitemap (dual-track, ADR-064)", () => {
  // Deal-finder (primary) + vending lead-gen (at /host). The per-post
  // /blog/[slug] URLs, the ~1k /cards/[slug] pages, and the
  // /service-areas/[city] pages are layered on at the app/sitemap.ts dynamic
  // layer; this just pins the fixed landing set.
  for (const path of [
    // deal-finder primary
    "/", "/blog", "/deals", "/start", "/newsletter", "/pricing-methodology",
    "/japanese-pokemon-cards-value", "/pokemon-card-value-calculator",
    "/pokemon-card-condition-guide",
    // vending lead-gen
    "/host", "/faq", "/service-areas",
  ]) {
    assert.ok(
      LANDING_PATHS.some((e) => e.path === path),
      `${path} must be present in the sitemap landing set`,
    );
  }
});

test("/machines stays out of the sitemap (indexable but no live locations yet, ADR-064)", () => {
  // /machines is un-noindexed in the dual-track restore but carries no live
  // locations to recover, so it is deliberately NOT in the crawl set — no thin
  // page in the sitemap until machine #1 lands.
  const paths = new Set(LANDING_PATHS.map((e) => e.path));
  assert.ok(!paths.has("/machines"), "/machines must not be in the sitemap until it has live content");
});

test("every sitemap landing path is a public, crawlable route", () => {
  // A gated route in the sitemap would tell Google to crawl a /login redirect.
  for (const entry of LANDING_PATHS) {
    assert.equal(
      isPublicRoute(entry.path),
      true,
      `${entry.path} is in the sitemap but is not public per public-routes.ts`,
    );
  }
});

test("sitemap omits auth/api/redirect/metadata routes", () => {
  const paths = new Set(LANDING_PATHS.map((e) => e.path));
  for (const omitted of [
    "/login",
    "/auth",
    "/upload",
    "/account",
    "/go", // click-time affiliate redirect, not indexable content
    "/api/cron",
    "/api/watchlist",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    assert.ok(!paths.has(omitted), `${omitted} must not be in the sitemap`);
  }
});

test("landing paths are unique and well-formed", () => {
  const paths = LANDING_PATHS.map((e) => e.path);
  assert.equal(new Set(paths).size, paths.length, "duplicate sitemap path");
  for (const e of LANDING_PATHS) {
    assert.ok(e.path.startsWith("/"), `${e.path} must be root-relative`);
    assert.ok(
      e.priority >= 0 && e.priority <= 1,
      `${e.path} priority ${e.priority} out of [0,1]`,
    );
  }
});
