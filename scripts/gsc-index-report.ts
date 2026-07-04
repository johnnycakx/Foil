// gsc-index-report — pull the REAL index-coverage picture from Google Search
// Console (gsc-api-integration Phase 2, ADR-109). Replaces the seo-crawl-hygiene
// goal's INFERENCE of the "56 vs 2,079" indexed count with live API data.
//
// What it does:
//   1. Verify the service account has access to the property (else print the
//      exact GSC "add user" step and exit — Phase 1 step 3 is John-manual).
//   2. sitemaps.list  -> submitted + GSC-indexed counts per sitemap.
//   3. searchanalytics.query (page + query dims, last 28d) -> distinct pages
//      actually surfacing in search (a page must be indexed to get impressions).
//   4. urlInspection.index.inspect on a REPRESENTATIVE, quota-safe sample
//      (core routes + pillars + all blog + a slice of cards/sets) -> the API's
//      own coverageState + "why" per URL.
//   -> writes docs/goals/_results/gsc-index-report.md.
//
// Run: node --experimental-strip-types scripts/gsc-index-report.ts [--max N]
// The SA key is read from GSC_SA_KEY_JSON (.env.local); it is never logged.

import fs from "node:fs";
import path from "node:path";
import { GscClient, DEFAULT_SITE_URL, type UrlIndexSummary, type SearchAnalyticsRow } from "../lib/seo/gsc.ts";

// ---- env (.env.local, same loader as the other scripts) -------------------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SITE = "https://foiltcg.com";
const OUT = path.join(process.cwd(), "docs", "goals", "_results", "gsc-index-report.md");
const MAX_INSPECT = Number(process.argv[find("--max") + 1]) || 70;

function find(flag: string): number {
  return process.argv.indexOf(flag);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fetch sitemap.xml (following a sitemap index) and return all page <loc>s. */
async function fetchSitemapUrls(url: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sitemap fetch ${url} -> ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (/<sitemapindex/i.test(xml)) {
    const nested = await Promise.all(locs.map((l) => fetchSitemapUrls(l, depth + 1)));
    return nested.flat();
  }
  return locs;
}

type Bucket = "pillar" | "core" | "blog" | "card" | "set" | "other";
function bucket(u: string): Bucket {
  const p = new URL(u).pathname;
  if (/^\/(japanese-pokemon-cards-value|pokemon-card-value-calculator|pokemon-card-condition-guide)\/?$/.test(p)) return "pillar";
  if (p.startsWith("/blog/") && p !== "/blog/") return "blog";
  if (p.startsWith("/cards/sets/")) return "set";
  if (p.startsWith("/cards/") && p !== "/cards/") return "card";
  if (["/", "/deals", "/start", "/cards", "/blog", "/host", "/faq", "/pricing-methodology", "/newsletter"].includes(p)) return "core";
  return "other";
}

/** Every Nth item, capped at `n`. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

function pct(a: number, b: number): string {
  return b ? `${((a / b) * 100).toFixed(1)}%` : "—";
}

async function main() {
  const client = new GscClient({ siteUrl: DEFAULT_SITE_URL });

  // 1) verify access
  let sites;
  try {
    sites = await client.listSites();
  } catch (e) {
    console.error("GSC auth FAILED:", e instanceof Error ? e.message : e);
    console.error("The service account authenticated but the API call failed — is the Search Console API enabled on the GCP project?");
    process.exit(1);
  }
  const has = sites.some((s) => s.siteUrl === DEFAULT_SITE_URL);
  if (!has) {
    console.error(`\nThe service account authenticated, but it does NOT yet have access to ${DEFAULT_SITE_URL}.`);
    console.error("Properties it CAN see:", sites.map((s) => s.siteUrl).join(", ") || "(none)");
    console.error("\nGSC add-user step (John, Phase 1 step 3):");
    console.error("  Search Console -> foiltcg.com property -> Settings -> Users and permissions");
    console.error("  -> Add user -> paste the SA email (from .env.local's key: client_email) -> role Full or Restricted.");
    console.error("Then re-run this script.\n");
    process.exit(2);
  }
  console.log(`✓ access confirmed for ${DEFAULT_SITE_URL}`);

  // 2) sitemaps
  const sitemaps = await client.listSitemaps();
  console.log(`✓ ${sitemaps.length} sitemap(s)`);

  // fetch the live sitemap URL set
  const allUrls = await fetchSitemapUrls(`${SITE}/sitemap.xml`);
  const byBucket = new Map<Bucket, string[]>();
  for (const u of allUrls) {
    const b = bucket(u);
    (byBucket.get(b) ?? byBucket.set(b, []).get(b)!).push(u);
  }
  console.log(`✓ sitemap carries ${allUrls.length} URLs`);

  // 3) search analytics (last 28d) — pages + queries
  const end = new Date();
  const start = new Date(Date.now() - 28 * 864e5);
  const [pages, queries] = await Promise.all([
    client.searchAnalytics({ startDate: iso(start), endDate: iso(end), dimensions: ["page"], rowLimit: 1000 }),
    client.searchAnalytics({ startDate: iso(start), endDate: iso(end), dimensions: ["query"], rowLimit: 25 }),
  ]);
  console.log(`✓ ${pages.length} distinct pages surfaced in search (28d); ${queries.length} top queries`);

  // 4) URL-inspection sample — representative + quota-safe
  const pillars = byBucket.get("pillar") ?? [];
  const core = byBucket.get("core") ?? [];
  const blog = byBucket.get("blog") ?? [];
  const cards = byBucket.get("card") ?? [];
  const sets = byBucket.get("set") ?? [];
  const budget = MAX_INSPECT;
  const fixed = [...core, ...pillars, ...sample(blog, 12)];
  const remaining = Math.max(0, budget - fixed.length);
  const inspectList = [
    ...fixed,
    ...sample(cards, Math.ceil(remaining * 0.7)),
    ...sample(sets, Math.floor(remaining * 0.3)),
  ].filter((v, i, a) => a.indexOf(v) === i);
  console.log(`Inspecting ${inspectList.length} URLs (pacing ~150ms; quota-safe)…`);
  const inspected = await client.inspectUrls(inspectList, {
    max: budget,
    onProgress: (d, t) => {
      if (d === t || d % 10 === 0) process.stdout.write(`\r  inspected ${d}/${t}`);
    },
  });
  process.stdout.write("\n");

  writeReport({ allUrls, byBucket, sitemaps, pages, queries, inspected, start, end });
  console.log(`\n✓ wrote ${path.relative(process.cwd(), OUT)}`);
}

function writeReport(d: {
  allUrls: string[];
  byBucket: Map<Bucket, string[]>;
  sitemaps: Awaited<ReturnType<GscClient["listSitemaps"]>>;
  pages: SearchAnalyticsRow[];
  queries: SearchAnalyticsRow[];
  inspected: UrlIndexSummary[];
  start: Date;
  end: Date;
}) {
  const { allUrls, byBucket, sitemaps, pages, queries, inspected } = d;

  // coverage distribution from the inspection sample
  const cov = new Map<string, number>();
  for (const r of inspected) cov.set(r.coverageState, (cov.get(r.coverageState) ?? 0) + 1);
  const indexed = inspected.filter((r) => /indexed/i.test(r.coverageState) && !/not indexed/i.test(r.coverageState));
  const notIndexed = inspected.filter((r) => /not indexed|excluded|crawled/i.test(r.coverageState));
  const errored = inspected.filter((r) => r.verdict === "ERROR");

  const distinctPages = pages.length;
  const totalClicks = pages.reduce((s, r) => s + r.clicks, 0);
  const totalImpr = pages.reduce((s, r) => s + r.impressions, 0);

  const L: string[] = [];
  L.push(`# GSC index-coverage report — foiltcg.com`);
  L.push("");
  L.push(`Generated by \`scripts/gsc-index-report.ts\` against the live Search Console API (${DEFAULT_SITE_URL}). Window: ${iso(d.start)} → ${iso(d.end)} (28d). This is LIVE API data — it replaces the sitemap-count inference the seo-crawl-hygiene goal had to make.`);
  L.push("");
  L.push(`## The headline number (56-vs-2,079, answered with data)`);
  L.push("");
  L.push(`- **Sitemap submits ${allUrls.length} URLs.**`);
  L.push(`- **${distinctPages} distinct pages actually surfaced in Google search in the last 28 days** (a page must be indexed to earn an impression — this is a real lower bound on the *useful* indexed set), earning ${totalClicks} clicks / ${totalImpr} impressions.`);
  L.push(`- URL-inspection sample of ${inspected.length} representative URLs: **${indexed.length} indexed (${pct(indexed.length, inspected.length)}), ${notIndexed.length} crawled/excluded-not-indexed, ${errored.length} error.**`);
  L.push("");
  L.push(`## Sitemaps (GSC's own submitted vs indexed)`);
  L.push("");
  if (sitemaps.length === 0) {
    L.push(`_No sitemaps returned by the API._`);
  } else {
    L.push(`| sitemap | last downloaded | submitted | indexed | warnings | errors |`);
    L.push(`|---|---|--:|--:|--:|--:|`);
    for (const s of sitemaps) {
      const c = (s.contents ?? []).reduce(
        (a, x) => ({ sub: a.sub + Number(x.submitted ?? 0), idx: a.idx + Number(x.indexed ?? 0) }),
        { sub: 0, idx: 0 },
      );
      L.push(`| ${s.path.replace(SITE, "")} | ${s.lastDownloaded?.slice(0, 10) ?? "—"} | ${c.sub || "—"} | ${c.idx || "—"} | ${s.warnings ?? 0} | ${s.errors ?? 0} |`);
    }
  }
  L.push("");
  L.push(`> Note: the Sitemaps API reports "indexed" as \`0\`/absent for many properties (Google deprecated per-sitemap indexed counts in the UI); the URL-inspection sample + Search-Analytics page count below are the reliable index signals.`);
  L.push("");
  L.push(`## Coverage distribution (URL Inspection sample, n=${inspected.length})`);
  L.push("");
  L.push(`| coverageState | count |`);
  L.push(`|---|--:|`);
  for (const [k, v] of [...cov.entries()].sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} |`);
  L.push("");
  L.push(`### Sample by section`);
  L.push("");
  L.push(`| section | in sitemap | inspected | indexed |`);
  L.push(`|---|--:|--:|--:|`);
  for (const b of ["core", "pillar", "blog", "card", "set", "other"] as const) {
    const total = byBucket.get(b)?.length ?? 0;
    const seen = inspected.filter((r) => bucket(r.url) === b);
    const idx = seen.filter((r) => /indexed/i.test(r.coverageState) && !/not indexed/i.test(r.coverageState));
    L.push(`| ${b} | ${total} | ${seen.length} | ${idx.length} (${pct(idx.length, seen.length)}) |`);
  }
  L.push("");
  L.push(`## Not-indexed URLs, with the API's own "why"`);
  L.push("");
  if (notIndexed.length + errored.length === 0) {
    L.push(`_Every inspected URL is indexed._`);
  } else {
    L.push(`| url | coverageState | last crawl | google-canonical | note |`);
    L.push(`|---|---|---|---|---|`);
    for (const r of [...notIndexed, ...errored].slice(0, 60)) {
      const p = new URL(r.url).pathname;
      L.push(`| ${p} | ${r.coverageState} | ${r.lastCrawlTime?.slice(0, 10) ?? "—"} | ${r.googleCanonical ? new URL(r.googleCanonical).pathname : "—"} | ${r.error ?? r.robotsTxtState ?? ""} |`);
    }
  }
  L.push("");
  L.push(`## Top pages in search (28d)`);
  L.push("");
  L.push(`| page | clicks | impressions | ctr | position |`);
  L.push(`|---|--:|--:|--:|--:|`);
  for (const r of pages.slice(0, 20)) {
    const p = r.keys?.[0] ? new URL(r.keys[0]).pathname : "—";
    L.push(`| ${p} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(1)}% | ${r.position.toFixed(1)} |`);
  }
  L.push("");
  L.push(`## Top queries (28d)`);
  L.push("");
  L.push(`| query | clicks | impressions | ctr | position |`);
  L.push(`|---|--:|--:|--:|--:|`);
  for (const r of queries.slice(0, 25)) {
    L.push(`| ${r.keys?.[0] ?? "—"} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(1)}% | ${r.position.toFixed(1)} |`);
  }
  L.push("");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, L.join("\n"));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
