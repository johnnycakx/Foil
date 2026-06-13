// Structural guards for the vending surfaces (Phase V-1,
// STRATEGY-VENDING-2026-06-12). Three rule families, all source-level pins in
// the visual-regression style:
//
//   1. COPY FIREWALL (amended §4 rule 1): the deal-finder's trust vocabulary
//      ("deal", "best price", "below market", "verified") must never appear
//      on a vending surface. Machine product is convenience, full stop.
//   2. FTC HARD NOs (§5b): the /host funnel may not carry host-income
//      projections, passive-income vocabulary, or operator-recruitment copy.
//      (The 2025 proposed Earnings Claim Rule targets exactly this genre.)
//   3. IMPORT FIREWALL (§4 rule 2, both directions): vending code never
//      touches lib/listing, lib/buy-signal, or lib/affiliate, and the
//      listing/signal stack never touches lib/vending. Machine inventory must
//      remain structurally invisible to listing selection and rankings.
//
// Plus the pure-validator unit tests and the pricing-disclosure voice checks
// (Gate 13 anti-hype via the same antiHypeCheck the methodology page uses;
// Gate 12 no-em-dash).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateRestockSignup, validateHostLead } from "../vending/validate.ts";
import {
  MACHINE_PRICING_SECTIONS,
  machinePricingText,
} from "../vending/machine-pricing-content.ts";
import { MACHINE_LOCATIONS } from "../vending/machines.ts";
import { antiHypeCheck } from "../seo/quality-gates.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Every source file that renders or feeds a vending surface. New vending
 *  files must be appended (the import-firewall sweep below also walks
 *  lib/vending/ automatically). */
const VENDING_SURFACE_FILES: readonly string[] = [
  "app/(site)/machines/page.tsx",
  "app/(site)/host/page.tsx",
  "components/vending/restock-alert-form.tsx",
  "components/vending/host-lead-form.tsx",
  "lib/vending/machines.ts",
  "lib/vending/validate.ts",
];

// ---------------------------------------------------------------------------
// 1. Copy firewall — deal vocabulary never appears on vending surfaces.
// ---------------------------------------------------------------------------

// Word-boundary so "dealer"/"ideal" can't false-positive; "deals" covered.
const DEAL_VOCAB: readonly { name: string; re: RegExp }[] = [
  { name: '"deal"', re: /\bdeals?\b/i },
  { name: '"best price"', re: /best\s+price/i },
  { name: '"below market"', re: /below\s+market/i },
  { name: '"verified"', re: /\bverified\b/i },
];

test("copy firewall: deal vocabulary absent from every vending surface file (§4 rule 1)", () => {
  for (const rel of VENDING_SURFACE_FILES) {
    const src = readFile(rel);
    for (const { name, re } of DEAL_VOCAB) {
      assert.doesNotMatch(src, re, `${name} found in ${rel} — vending surfaces never borrow the deal-finder's trust vocabulary`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. FTC hard NOs on the /host funnel (and the forms it renders).
// ---------------------------------------------------------------------------

const HOST_FUNNEL_FILES: readonly string[] = [
  "app/(site)/host/page.tsx",
  "components/vending/host-lead-form.tsx",
];

const FTC_BANNED: readonly { name: string; re: RegExp }[] = [
  { name: "passive-income vocabulary", re: /passive\s+income|passively/i },
  // Any dollars-per-period framing is an earnings projection.
  { name: "income projection ($/period)", re: /\$\s?\d[\d,.]*\s*(?:\/|per\s+|a\s+)(?:mo|month|week|day|year)/i },
  { name: "earn-$ framing", re: /earn\s+\$|make\s+\$|extra\s+\$\d/i },
  { name: "operator-recruitment copy", re: /start\s+your\s+own|your\s+own\s+route|become\s+an?\s+operator|vending\s+business\s+opportunity/i },
];

test("FTC hard NOs: no income projections / passive-income / operator recruitment on the /host funnel (§5b)", () => {
  for (const rel of HOST_FUNNEL_FILES) {
    const src = readFile(rel);
    for (const { name, re } of FTC_BANNED) {
      assert.doesNotMatch(src, re, `${name} found in ${rel}`);
    }
  }
});

// Strip JS line/block comments + JSX comments so these rules can be DOCUMENTED
// in comments (e.g. "no percentage or gross/net") without tripping the scan.
// Only rendered copy is checked.
function strippedSource(rel: string): string {
  return readFile(rel)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// The public vending surfaces whose RENDERED copy must stay clean.
const VENDING_RENDERED_FILES: readonly string[] = [
  "app/(site)/page.tsx",
  "app/(site)/host/page.tsx",
  "components/vending/host-lead-form.tsx",
  "app/(site)/faq/page.tsx",
  "app/(site)/service-areas/page.tsx",
  "app/(site)/service-areas/[city]/page.tsx",
  "lib/vending/faq.ts",
  "lib/vending/cities.ts",
];

test("no revenue-share percentage or gross/net figure is published (2026-06-13 OFF-SITE decision)", () => {
  // The rev-share number is a call topic, not a website claim: no percentage,
  // no dollar figure, no "gross"/"net" in rendered copy. The site frames the
  // value and routes to a call instead. (Instruction supersedes the old
  // "publish 10–15% verbatim" pin — John verdict 2026-06-13.)
  for (const rel of VENDING_RENDERED_FILES) {
    const src = strippedSource(rel);
    assert.doesNotMatch(src, /10\s?[–-]\s?15|10 to 15/, `revenue-share percentage rendered in ${rel}`);
    assert.doesNotMatch(src, /\bgross\b/i, `"gross" rendered in ${rel}`);
    assert.doesNotMatch(src, /\bnet (?:profit|sales)\b/i, `"net profit/sales" rendered in ${rel}`);
  }
});

test("no insurance/liability claim and no placeholder text on the vending surfaces (2026-06-13 OFF-SITE decision)", () => {
  // Insurance + liability are a call / in-person topic, removed from the public
  // site entirely; no [PLACEHOLDER] ships in rendered copy. Comments are exempt
  // (they document the rule), so strip them first. Word-boundary so
  // "reliability" / "Reliability" (a legit form label) can't false-positive.
  for (const rel of VENDING_RENDERED_FILES) {
    const src = strippedSource(rel);
    assert.doesNotMatch(src, /\binsur\w*/i, `insurance claim rendered in ${rel}`);
    assert.doesNotMatch(src, /\bliab(?:le|ility)\b/i, `liability claim rendered in ${rel}`);
    assert.doesNotMatch(src, /\[PLACEHOLDER/i, `placeholder text rendered in ${rel}`);
  }
});

// ---------------------------------------------------------------------------
// 3. Import firewall, both directions (§4 rule 2 — absolute).
// ---------------------------------------------------------------------------

const FORBIDDEN_IMPORTS_IN_VENDING = /from\s+["'][^"']*(?:lib\/listing|buy-signal|lib\/affiliate|listing-picker|ebay-browse)[^"']*["']/;

test("import firewall: vending files never import the listing/signal/affiliate stack", () => {
  // The two Server Actions are part of the vending write path — include them.
  const files = [
    ...VENDING_SURFACE_FILES,
    "app/actions/restock-alert.ts",
    "app/actions/host-lead.ts",
  ];
  for (const rel of files) {
    assert.doesNotMatch(readFile(rel), FORBIDDEN_IMPORTS_IN_VENDING, `${rel} imports from the deal stack — machine surfaces must stay structurally separate`);
  }
});

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "__fixtures__") continue;
      out.push(...walkTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

test("import firewall, reverse direction: the listing/signal/deals stack never imports lib/vending", () => {
  // THE absolute rule (§4 rule 2): machine inventory can never influence what
  // the site shows. If any of these modules gains a lib/vending import, the
  // structural blindness is broken and this fails the build.
  const guardedDirs = ["lib/listing", "lib/buy-signal", "lib/affiliate", "lib/deals"];
  for (const dir of guardedDirs) {
    let files: string[] = [];
    try {
      files = walkTsFiles(join(ROOT, dir));
    } catch {
      continue; // directory doesn't exist (lib/deals may be named differently)
    }
    for (const full of files) {
      const src = readFileSync(full, "utf8");
      // Import-shaped match only: a comment may NAME lib/vending (e.g. to
      // document this very rule); an import/require of it is the violation.
      assert.doesNotMatch(
        src,
        /(?:from\s+|require\()\s*["'][^"']*lib\/vending/,
        `${full} imports lib/vending — the deal stack must be structurally blind to machine inventory (§4 rule 2)`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Pricing-disclosure copy: required policy markers + Gate 13 + no em dashes.
// ---------------------------------------------------------------------------

test("pricing disclosure: the three load-bearing policy markers are present (amended §4)", () => {
  const text = machinePricingText();
  assert.match(text, /convenience-priced above the market/i, "the premium must be owned out loud");
  assert.match(text, /never influences what this site shows/i, "the inventory firewall must be stated publicly");
  assert.match(text, /per-customer purchase limit/i, "visible purchase limits are load-bearing at a premium");
});

test("pricing disclosure: passes Gate 13 anti-hype (no hard hype, no emojis)", () => {
  const r = antiHypeCheck(machinePricingText());
  assert.deepEqual(r.hard, [], `machine-pricing copy must be hype-free: ${JSON.stringify(r.hard)}`);
});

test("pricing disclosure: no em dashes (Gate 12 voice rule)", () => {
  assert.ok(!machinePricingText().includes("—"), "machine-pricing copy carries an em dash");
});

test("pricing disclosure: rendered by /pricing-methodology (writer/reader check)", () => {
  const page = readFile("app/(site)/pricing-methodology/page.tsx");
  assert.match(page, /MACHINE_PRICING_SECTIONS/, "the page must render the disclosure sections");
  assert.ok(MACHINE_PRICING_SECTIONS.length >= 4, "disclosure must keep its policy sections");
});

// ---------------------------------------------------------------------------
// Pre-placement honesty: locations are empty until a machine exists.
// ---------------------------------------------------------------------------

test("pre-placement: MACHINE_LOCATIONS is typed and the hub renders both states", () => {
  // V-1 ships with zero locations (Gate 13: nothing is live). The page must
  // carry BOTH branches so V-2 only adds data, not code.
  assert.equal(MACHINE_LOCATIONS.length, 0, "no machine is placed yet — adding a location is a V-2 act with its own checklist (GBP, NAP, photos)");
  const page = readFile("app/(site)/machines/page.tsx");
  assert.match(page, /MACHINE_LOCATIONS\.length === 0/, "hub must render the honest pre-placement state");
  assert.match(page, /MACHINE_LOCATIONS\.map/, "hub must already render per-location cards for V-2");
});

// ---------------------------------------------------------------------------
// Validators (pure).
// ---------------------------------------------------------------------------

test("validateRestockSignup: accepts email + optional city, lowercases email", () => {
  const r = validateRestockSignup({ email: "Collector@Example.com", city: "  Tampa  " });
  assert.ok(r.ok);
  assert.equal(r.value.email, "collector@example.com");
  assert.equal(r.value.city, "Tampa");
});

test("validateRestockSignup: rejects bad emails, city stays optional", () => {
  assert.equal(validateRestockSignup({ email: "not-an-email" }).ok, false);
  assert.equal(validateRestockSignup({ email: "" }).ok, false);
  const r = validateRestockSignup({ email: "a@b.co" });
  assert.ok(r.ok);
  assert.equal(r.value.city, null);
});

const VALID_LEAD = {
  name: "Sam Venue",
  business_name: "Sunrise Lanes",
  venue_type: "bowling_fec",
  city: "Tampa",
  email: "sam@sunriselanes.com",
  foot_traffic: "200_500",
};

test("validateHostLead: accepts the 6 required fields, optionals default null", () => {
  const r = validateHostLead(VALID_LEAD);
  assert.ok(r.ok);
  assert.equal(r.value.venue_type, "bowling_fec");
  assert.equal(r.value.phone, null);
  assert.equal(r.value.sells_cards, null);
  assert.equal(r.value.notes, null);
});

test("validateHostLead: each required field missing → its error tag", () => {
  const cases: Array<[string, string]> = [
    ["name", "missing_name"],
    ["business_name", "missing_business_name"],
    ["venue_type", "missing_venue_type"],
    ["city", "missing_city"],
    ["email", "invalid_email"],
    ["foot_traffic", "missing_foot_traffic"],
  ];
  for (const [field, tag] of cases) {
    const raw: Record<string, unknown> = { ...VALID_LEAD };
    delete raw[field];
    const r = validateHostLead(raw);
    assert.equal(r.ok, false, `missing ${field} must fail`);
    if (!r.ok) assert.equal(r.error, tag);
  }
});

test("validateHostLead: out-of-set tokens rejected (closed sets, mirror the CHECK constraints)", () => {
  assert.equal(validateHostLead({ ...VALID_LEAD, venue_type: "casino" }).ok, false);
  assert.equal(validateHostLead({ ...VALID_LEAD, foot_traffic: "millions" }).ok, false);
  const r = validateHostLead({ ...VALID_LEAD, priority: "world-domination" });
  assert.ok(r.ok, "optional out-of-set token degrades to null, not a rejection");
  if (r.ok) assert.equal(r.value.priority, null);
});

test("validateHostLead: free-text capped (notes 2000, name 120)", () => {
  const r = validateHostLead({ ...VALID_LEAD, notes: "x".repeat(5000), name: "n".repeat(500) });
  assert.ok(r.ok);
  assert.equal(r.value.notes!.length, 2000);
  assert.equal(r.value.name.length, 120);
});
