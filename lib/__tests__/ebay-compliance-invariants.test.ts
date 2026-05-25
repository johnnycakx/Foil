// Structural compliance invariants for the eBay integration.
//
// Fails CI when any of the eBay 2025 License Agreement structural
// guards documented in docs/EBAY-COMPLIANCE.md regress. Each test is
// a single grep/regex/read — if any one trips, the diff that broke the
// posture is the one being merged.
//
// The expanded human-readable rationale for each guard lives in
// docs/EBAY-COMPLIANCE.md. When that doc gains a new requirement row,
// add the matching test here.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const SCAN_DIRS = ["lib", "app"];
const TEST_DIR_BASENAME = "__tests__";

function* walkFiles(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
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
  return filePath.includes(`${TEST_DIR_BASENAME}`) || filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx");
}

function rel(filePath: string): string {
  // Normalize to forward-slash, repo-relative.
  const rootForward = ROOT.replace(/\\/g, "/").replace(/\/$/, "");
  const fileForward = filePath.replace(/\\/g, "/");
  return fileForward.replace(`${rootForward}/`, "");
}

// ---------------------------------------------------------------------------
// Allowlists. Updating these is the explicit intent gate — adding a file to
// either list means "this new file is also allowed to do the otherwise-
// restricted thing." Edit consciously, never silently.
// ---------------------------------------------------------------------------

const EBAY_API_ALLOWED_FILES = new Set([
  "lib/affiliate/ebay-browse.ts",
  "lib/affiliate/ebay-oauth.ts",
  // Documentation-only — the reviewer-facing /legal/ebay-api-compliance
  // page's content module. References the URL in prose (e.g. "never
  // calls api.ebay.com") to describe the compliance posture. Makes no
  // fetch call, contains no actual integration code. Session 33 (Phase 3
  // of ROADMAP NOW #10) added this entry.
  "lib/legal/ebay-compliance-content.ts",
  // Session 34 rewrite: POST notification verification fetches eBay's
  // public key from api.ebay.com/commerce/notification/v1/public_key/{kid}
  // (Notification API) to ECDSA-verify the x-ebay-signature header. This
  // is the canonical eBay-SDK pattern — the previous HMAC-keyed-on-
  // verification-token implementation was wrong and caused the
  // Send-Test-Notification 401s eBay flagged in the 24h monitoring email.
  // No listing payload is stored; the in-memory public-key cache (~1h TTL)
  // holds operational metadata only and is R-008 / ADR-025 compliant.
  "lib/ebay-marketplace-deletion.ts",
]);

const AFFILIATE_PARAM_ALLOWED_FILES = new Set([
  "lib/affiliate/epn.ts",
]);

// ---------------------------------------------------------------------------
// Invariant 1: api.ebay.com appears only in the two Browse modules + tests.
// ---------------------------------------------------------------------------

test("invariant: 'api.ebay.com' is referenced only in the Browse modules (lib/__tests__ excepted)", () => {
  const NEEDLE = "api.ebay.com";
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(join(ROOT, dir))) {
      const r = rel(file);
      if (EBAY_API_ALLOWED_FILES.has(r)) continue;
      if (isTestFile(file)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes(NEEDLE)) {
        offenders.push(r);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `\nFiles referencing '${NEEDLE}' outside the allowed Browse modules:\n  ${offenders.join("\n  ")}\nIf this is intentional, update EBAY_API_ALLOWED_FILES in this test + add a row to docs/EBAY-COMPLIANCE.md.`,
  );
});

// ---------------------------------------------------------------------------
// Invariant 2: raw affiliate-tracking param assembly stays in epn.ts only.
// ---------------------------------------------------------------------------

test("invariant: raw 'mkevt' / 'campid' assembly appears only in lib/affiliate/epn.ts", () => {
  // Match assembly contexts — object-literal keys (mkevt:), quoted
  // string args (set("campid", …)), or URL-fragment literals (mkevt=1)
  // — but NOT bare word occurrences (e.g., a comment that says
  // "see mkevt below"). Documentation comments referencing the boundary
  // are legitimate and shouldn't trip this guard.
  const ASSEMBLY_PATTERNS = [
    /\bmkevt\s*:/,                // object literal key
    /["']mkevt["']/,              // quoted string arg
    /\bmkevt\s*=/,                // URL-fragment literal
    /\bcampid\s*:/,
    /["']campid["']/,
    /\bcampid\s*=/,
  ];
  const offenders: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(join(ROOT, dir))) {
      const r = rel(file);
      if (AFFILIATE_PARAM_ALLOWED_FILES.has(r)) continue;
      if (isTestFile(file)) continue;
      const text = readFileSync(file, "utf8");
      if (ASSEMBLY_PATTERNS.some((re) => re.test(text))) {
        offenders.push(r);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `\nFiles with raw affiliate-tracking-param assembly outside lib/affiliate/epn.ts:\n  ${offenders.join("\n  ")}\nIf intentional, update AFFILIATE_PARAM_ALLOWED_FILES + EBAY-COMPLIANCE.md row #8.`,
  );
});

// ---------------------------------------------------------------------------
// Invariant 3: ebay-browse.ts passes cache:'no-store' on every fetch.
// ---------------------------------------------------------------------------

test("invariant: lib/affiliate/ebay-browse.ts contains cache: 'no-store'", () => {
  const text = readFileSync(join(ROOT, "lib/affiliate/ebay-browse.ts"), "utf8");
  // Match cache: "no-store" with either single or double quotes,
  // tolerating whitespace and any surrounding shape.
  const matches = text.match(/cache\s*:\s*['"]no-store['"]/g);
  assert.ok(matches && matches.length >= 1, "expected cache: 'no-store' to appear in ebay-browse.ts");
});

// ---------------------------------------------------------------------------
// Invariant 4: /cards/[slug] page exports dynamic = 'force-dynamic'.
// ---------------------------------------------------------------------------

test("invariant: /cards/[slug] page exports dynamic = 'force-dynamic'", () => {
  const path = "app/(site)/cards/[slug]/page.tsx";
  const text = readFileSync(join(ROOT, path), "utf8");
  const match = text.match(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  assert.ok(match, `${path} must export dynamic = 'force-dynamic' (R-008)`);
});

// ---------------------------------------------------------------------------
// Invariant 5: browse_calls migration schema is exactly the operational-
// metadata-only shape — no columns that could hold a listing payload.
// ---------------------------------------------------------------------------

test("invariant: browse_calls migration has only operational metadata columns", () => {
  // Resolve the migration file (timestamp-prefixed).
  const migrationsDir = join(ROOT, "supabase/migrations");
  const file = readdirSync(migrationsDir).find((f) => f.endsWith("_browse_calls.sql"));
  assert.ok(file, "browse_calls migration missing from supabase/migrations/");
  const sql = readFileSync(join(migrationsDir, file!), "utf8");

  // Required columns must all be present.
  const REQUIRED = [
    /\bid\s+bigserial/,
    /\bcalled_at\s+timestamptz/,
    /\bsurface\s+text/,
    /\bsuccess\s+boolean/,
    /\blatency_ms\s+integer/,
  ];
  for (const re of REQUIRED) {
    assert.ok(re.test(sql), `browse_calls migration missing required column matching ${re}`);
  }

  // FORBIDDEN columns — any listing-payload-shaped column added is a
  // compliance regression and the migration should be rejected.
  const FORBIDDEN_COLUMN_NAMES = [
    "title", "price", "currency", "url", "item_url", "item_web_url",
    "card_slug", "card_id", "card_name", "seller", "image", "image_url",
    "payload", "raw_response", "body",
  ];
  for (const col of FORBIDDEN_COLUMN_NAMES) {
    const re = new RegExp(`^\\s*${col}\\s+(text|varchar|integer|numeric|jsonb|json|uuid)\\b`, "im");
    assert.ok(
      !re.test(sql),
      `browse_calls migration has a forbidden payload-shaped column "${col}" — this is an R-008 / ADR-025 regression. If intentional, update EBAY-COMPLIANCE.md row #7 + this test FIRST.`,
    );
  }
});

// ---------------------------------------------------------------------------
// Invariant 6: lib/seo/* does not import from lib/affiliate/* (no AI-on-
// eBay-data crossover surface).
// ---------------------------------------------------------------------------

test("invariant: lib/seo/* does not import from lib/affiliate/*", () => {
  const seoDir = join(ROOT, "lib/seo");
  let entries: string[];
  try {
    entries = readdirSync(seoDir);
  } catch {
    return; // No seo/ dir → vacuously satisfied.
  }
  const offenders: string[] = [];
  for (const f of entries) {
    if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
    const text = readFileSync(join(seoDir, f), "utf8");
    // Match either relative (../affiliate/...) or alias (@/lib/affiliate/...).
    if (/from\s+['"](\.\.\/affiliate|@\/lib\/affiliate)/.test(text)) {
      offenders.push(`lib/seo/${f}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `\nlib/seo files importing lib/affiliate (would expose eBay data to the content engine):\n  ${offenders.join("\n  ")}`,
  );
});
