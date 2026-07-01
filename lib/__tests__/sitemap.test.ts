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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PATHS } from "../seo/sitemap-landings.ts";
import { isPublicRoute } from "../supabase/public-routes.ts";
import { CARD_CATALOG } from "../cards/catalog.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("both tracks' fixed surfaces are in the sitemap (dual-track, ADR-064)", () => {
  // Deal-finder (primary) + vending lead-gen (at /host). The per-post
  // /blog/[slug] URLs, the ~1k /cards/[slug] pages, and the
  // /service-areas/[city] pages are layered on at the app/sitemap.ts dynamic
  // layer; this just pins the fixed landing set.
  for (const path of [
    // deal-finder primary
    "/", "/blog", "/cards", "/deals", "/start", "/newsletter", "/pricing-methodology",
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

test("sitemap covers the programmatic long tail (URL count well over 1,000)", () => {
  // The crawlability goal (SEO health audit, 2026-06-28) depends on Google
  // discovering every card. The builder layers CARD_CATALOG onto LANDING_PATHS
  // (+ blog + cities), so the catalog size is the long-tail count. Pin it well
  // above 1,000 so a catalog-load regression (empty/partial) fails loudly — a
  // shrunk sitemap silently de-lists the long tail. (Live sitemap.xml served
  // 1,224 URLs at audit time.)
  assert.ok(
    CARD_CATALOG.length + LANDING_PATHS.length > 1000,
    `sitemap long tail too small: ${CARD_CATALOG.length} cards + ${LANDING_PATHS.length} landings`,
  );
});

test("sitemap builder emits ABSOLUTE urls (base-prefixed) for the card long tail", () => {
  // A relative or wrong-host <loc> breaks crawling. The builder prefixes every
  // url with the resolved base (NEXT_PUBLIC_SITE_URL → https://foiltcg.com in
  // prod, via the shared lib/seo/site-url.ts constant), incl. the programmatic
  // /cards/[slug] set. Source-assert it (the builder pulls Next + MDX + the
  // catalog, so it's pinned structurally like the page tests; the live
  // sitemap.xml was separately verified all-https at audit).
  const src = readFileSync(join(ROOT, "app/sitemap.ts"), "utf8");
  // base is the SHARED resolved site URL (lib/seo/site-url.ts — one canonical
  // origin across layout, card pages, and the sitemap).
  assert.match(src, /from "@\/lib\/seo\/site-url"/);
  assert.match(src, /const base = siteUrl\(\)/);
  // every section builds `${base}...` urls — no bare relative paths.
  assert.match(src, /url: `\$\{base\}\$\{entry\.path\}`/, "landings are base-prefixed");
  assert.match(src, /url: `\$\{base\}\/cards\/\$\{entry\.slug\}`/, "card long tail is base-prefixed");
  assert.match(src, /CARD_CATALOG\.map/, "the full catalog is layered into the sitemap");
});

test("shared site-url constant: non-www fallback, env override, trailing slash stripped", async () => {
  const { siteUrl, DEFAULT_SITE_URL } = await import("../seo/site-url.ts");
  assert.equal(DEFAULT_SITE_URL, "https://foiltcg.com", "canonical fallback must be the non-www apex");
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    assert.equal(siteUrl(), "https://foiltcg.com");
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    assert.equal(siteUrl(), "https://example.com", "trailing slash stripped");
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  }
});

test("sitemap layers the /cards/sets/[set-id] hub pages and uses REAL lastmod dates", () => {
  // The set hubs are the crawl path INTO the card long tail — they were
  // omitted from the sitemap entirely until 2026-07-01. And lastModified must
  // come from real data (snapshot bakedAt / post dates), never a fabricated
  // `new Date()` per request ("everything changed today" on every crawl).
  const src = readFileSync(join(ROOT, "app/sitemap.ts"), "utf8");
  assert.match(src, /setIdsInCatalog\(\)\.map/, "set hub pages are layered into the sitemap");
  assert.match(src, /url: `\$\{base\}\/cards\/sets\/\$\{id\}`/, "set hub URLs are base-prefixed");
  assert.match(src, /getBakedSnapshotTimestamp/, "card/set lastmod comes from the snapshot bakedAt");
  assert.doesNotMatch(src, /const now = new Date\(\)/, "no fabricated uniform lastModified");
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
