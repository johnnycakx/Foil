// Ad-hoc compliance audit runner. Same invariants as
// lib/__tests__/ebay-compliance-invariants.test.ts, but prints a
// pass/fail summary table to stdout — easier to eyeball during a
// quarterly compliance review or right before submitting the Application
// Growth Check.
//
// Run via:
//   npm run compliance:check
//
// Exits 0 when every invariant passes, 1 when any fail (so this is also
// CI-friendly if you ever want a separate "compliance" workflow step).
//
// The duplication between this script and the test file is intentional:
// the test file is for the developer loop (fails the build), this script
// is for the human-readable audit surface (prints a table). Each layer
// is small enough that drift is caught at code review.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const EBAY_API_ALLOWED_FILES = new Set([
  "lib/affiliate/ebay-browse.ts",
  "lib/affiliate/ebay-oauth.ts",
  // Documentation-only — the public legal page's content module
  // references the URL in reviewer-facing prose. See the matching
  // allowlist in lib/__tests__/ebay-compliance-invariants.test.ts.
  "lib/legal/ebay-compliance-content.ts",
]);

const AFFILIATE_PARAM_ALLOWED_FILES = new Set([
  "lib/affiliate/epn.ts",
]);

function* walkFiles(dir: string): Generator<string> {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walkFiles(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      yield full;
    }
  }
}

function isTestFile(filePath: string): boolean {
  return filePath.includes("__tests__") || /\.test\.tsx?$/.test(filePath);
}

function rel(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(`${ROOT.replace(/\\/g, "/")}/`, "");
}

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string) {
  results.push({ name, pass: true });
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
}

// ---------------------------------------------------------------------------
// 1. api.ebay.com is referenced only in the Browse modules.
// ---------------------------------------------------------------------------
{
  const offenders: string[] = [];
  for (const dir of ["lib", "app"]) {
    for (const file of walkFiles(join(ROOT, dir))) {
      const r = rel(file);
      if (EBAY_API_ALLOWED_FILES.has(r)) continue;
      if (isTestFile(file)) continue;
      if (readFileSync(file, "utf8").includes("api.ebay.com")) offenders.push(r);
    }
  }
  if (offenders.length === 0) pass("api.ebay.com only in Browse modules");
  else fail("api.ebay.com only in Browse modules", offenders.join(", "));
}

// ---------------------------------------------------------------------------
// 2. mkevt / campid raw assembly only in epn.ts.
// ---------------------------------------------------------------------------
{
  const ASSEMBLY_PATTERNS = [
    /\bmkevt\s*:/, /["']mkevt["']/, /\bmkevt\s*=/,
    /\bcampid\s*:/, /["']campid["']/, /\bcampid\s*=/,
  ];
  const offenders: string[] = [];
  for (const dir of ["lib", "app"]) {
    for (const file of walkFiles(join(ROOT, dir))) {
      const r = rel(file);
      if (AFFILIATE_PARAM_ALLOWED_FILES.has(r)) continue;
      if (isTestFile(file)) continue;
      const text = readFileSync(file, "utf8");
      if (ASSEMBLY_PATTERNS.some((re) => re.test(text))) offenders.push(r);
    }
  }
  if (offenders.length === 0) pass("mkevt/campid raw assembly only in epn.ts");
  else fail("mkevt/campid raw assembly only in epn.ts", offenders.join(", "));
}

// ---------------------------------------------------------------------------
// 3. ebay-browse.ts uses cache: 'no-store'.
// ---------------------------------------------------------------------------
{
  const text = readFileSync(join(ROOT, "lib/affiliate/ebay-browse.ts"), "utf8");
  const ok = /cache\s*:\s*['"]no-store['"]/.test(text);
  if (ok) pass("ebay-browse.ts: cache: 'no-store' present");
  else fail("ebay-browse.ts: cache: 'no-store' present", "regex not found");
}

// ---------------------------------------------------------------------------
// 4. /cards/[slug] page exports dynamic = 'force-dynamic'.
// ---------------------------------------------------------------------------
{
  const path = "app/(site)/cards/[slug]/page.tsx";
  const text = readFileSync(join(ROOT, path), "utf8");
  const ok = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(text);
  if (ok) pass(`${path}: dynamic = 'force-dynamic'`);
  else fail(`${path}: dynamic = 'force-dynamic'`, "not found");
}

// ---------------------------------------------------------------------------
// 5. browse_calls migration: required columns present, payload columns absent.
// ---------------------------------------------------------------------------
{
  const migrationsDir = join(ROOT, "supabase/migrations");
  const file = readdirSync(migrationsDir).find((f) => f.endsWith("_browse_calls.sql"));
  if (!file) {
    fail("browse_calls migration columns", "migration file not found");
  } else {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const REQUIRED = [
      /\bid\s+bigserial/, /\bcalled_at\s+timestamptz/, /\bsurface\s+text/,
      /\bsuccess\s+boolean/, /\blatency_ms\s+integer/,
    ];
    const missing = REQUIRED.filter((re) => !re.test(sql)).map((re) => re.toString());
    const FORBIDDEN_NAMES = [
      "title", "price", "currency", "url", "item_url", "item_web_url",
      "card_slug", "card_id", "card_name", "seller", "image", "image_url",
      "payload", "raw_response", "body",
    ];
    const forbidden = FORBIDDEN_NAMES.filter((col) =>
      new RegExp(`^\\s*${col}\\s+(text|varchar|integer|numeric|jsonb|json|uuid)\\b`, "im").test(sql),
    );
    if (missing.length === 0 && forbidden.length === 0) pass("browse_calls migration columns");
    else fail(
      "browse_calls migration columns",
      [
        missing.length ? `missing: ${missing.join(", ")}` : "",
        forbidden.length ? `FORBIDDEN PRESENT: ${forbidden.join(", ")}` : "",
      ].filter(Boolean).join("; "),
    );
  }
}

// ---------------------------------------------------------------------------
// 6. lib/seo/* does not import lib/affiliate/*.
// ---------------------------------------------------------------------------
{
  const seoDir = join(ROOT, "lib/seo");
  const offenders: string[] = [];
  try {
    for (const f of readdirSync(seoDir)) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const text = readFileSync(join(seoDir, f), "utf8");
      if (/from\s+['"](\.\.\/affiliate|@\/lib\/affiliate)/.test(text)) {
        offenders.push(`lib/seo/${f}`);
      }
    }
  } catch {
    // lib/seo absent → vacuous pass
  }
  if (offenders.length === 0) pass("lib/seo/* does not import lib/affiliate/*");
  else fail("lib/seo/* does not import lib/affiliate/*", offenders.join(", "));
}

// ---------------------------------------------------------------------------
// Render the summary table + exit accordingly.
// ---------------------------------------------------------------------------

const nameWidth = Math.max(...results.map((r) => r.name.length), 30);
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;

console.log(`\nFoil eBay compliance audit — ${results.length} invariants\n`);
console.log("  " + "STATUS".padEnd(8) + "INVARIANT".padEnd(nameWidth + 2) + "DETAIL");
console.log("  " + "------".padEnd(8) + "---------".padEnd(nameWidth + 2) + "------");
for (const r of results) {
  const status = r.pass ? "PASS" : "FAIL";
  const detail = r.detail ?? "";
  console.log("  " + status.padEnd(8) + r.name.padEnd(nameWidth + 2) + detail);
}
console.log(`\n  ${passed} passed · ${failed} failed`);
console.log(`  See docs/EBAY-COMPLIANCE.md for the full requirement → enforcement → test map.\n`);

process.exit(failed === 0 ? 0 : 1);
