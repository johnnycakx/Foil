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

test("vending host surfaces are in the sitemap (docs/vending Goal A §3)", () => {
  for (const path of ["/", "/host", "/faq", "/service-areas"]) {
    assert.ok(
      LANDING_PATHS.some((e) => e.path === path),
      `${path} must be present in the sitemap landing set`,
    );
  }
});

test("deal-finder routes are ABSENT from the sitemap (dormant under the vending pivot)", () => {
  // The pivot makes the deal-finder dormant: noindexed + unlinked + off the
  // sitemap so its already-indexed URLs drop out of Google. The fixed landing
  // set must carry none of them (the ~1k /cards/* and /blog/* URLs are dropped
  // at the app/sitemap.ts layer — they're no longer concatenated on).
  const paths = new Set(LANDING_PATHS.map((e) => e.path));
  for (const dormant of [
    "/deals",
    "/pricing-methodology",
    "/newsletter",
    "/start",
    "/blog",
    "/machines",
    "/japanese-pokemon-cards-value",
    "/pokemon-card-value-calculator",
    "/pokemon-card-condition-guide",
    "/legal/ebay-api-compliance",
  ]) {
    assert.ok(!paths.has(dormant), `${dormant} is dormant and must not be in the sitemap`);
  }
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
