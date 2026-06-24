// Lead-magnet structural + honesty drift guards (ADR-068). Pins: the magnet
// page wires the gate with the right source; the gate reuses the existing
// subscribe Server Action (no new email backend) and reveals in place (no
// redirect = no open-redirect surface); the CTA points at the magnet; the
// page is in the sitemap; and the honesty discipline (no fake scarcity /
// fabricated social-proof counts) holds across all three surfaces.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PATHS } from "../seo/sitemap-landings.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const PAGE = "app/(site)/free/pokemon-card-pricing-cheat-sheet/page.tsx";
const GATE = "components/lead-magnet-gate.tsx";
const CTA = "components/lead-magnet-cta.tsx";
const MAGNET_HREF = "/free/pokemon-card-pricing-cheat-sheet";

test("magnet page: wires LeadMagnetGate with source='lead_magnet_cheatsheet'", () => {
  const src = readFile(PAGE);
  assert.match(src, /<LeadMagnetGate\s+source="lead_magnet_cheatsheet"/);
});

test("magnet page: is indexable + in the sitemap", () => {
  const src = readFile(PAGE);
  assert.match(src, /robots:\s*\{\s*index:\s*true/, "magnet page must be indexable");
  assert.ok(
    LANDING_PATHS.some((p) => p.path === MAGNET_HREF),
    "magnet page must be registered in the sitemap LANDING_PATHS",
  );
});

test("gate: reuses the existing subscribe Server Action (no new email backend)", () => {
  const src = readFile(GATE);
  assert.match(
    src,
    /import\s*\{[^}]*subscribeAction[^}]*\}\s*from\s*["']@\/app\/actions\/subscribe["']/,
    "gate must call the existing subscribeAction",
  );
  // It must NOT reach into Beehiiv directly (that boundary is lib/beehiiv.ts,
  // invoked by the action) nor build a parallel email path.
  assert.doesNotMatch(src, /@beehiiv\/sdk/, "gate must not import the Beehiiv SDK directly");
  assert.doesNotMatch(src, /from\s*["']@\/lib\/beehiiv["']/, "gate must not import lib/beehiiv directly");
});

test("gate: reveals the asset in place — no redirect (no open-redirect surface)", () => {
  const src = readFile(GATE);
  // Delivery is an on-page reveal of children on success, not a navigation.
  assert.match(src, /\{children\}/, "gate must render the gated asset (children) on success");
  assert.doesNotMatch(src, /window\.location/, "no window.location redirect");
  assert.doesNotMatch(src, /router\.(push|replace)/, "no router navigation");
  assert.doesNotMatch(src, /\bredirect\s*\(/, "no redirect() call");
});

test("CTA: links to the magnet landing page", () => {
  const src = readFile(CTA);
  assert.match(src, new RegExp(`["']${MAGNET_HREF}["']`), "CTA must link to the magnet page");
});

test("honesty: no fake scarcity / urgency / fabricated social-proof counts on any magnet surface", () => {
  // The gate is an honest value-for-email trade, not a dark pattern (goal's
  // honesty discipline). Pin the negatives across the page + gate + CTA.
  const forbidden: [RegExp, string][] = [
    [/countdown/i, "countdown timer"],
    [/limited[ -]time/i, "limited-time pressure"],
    [/only\s+\d+\s+(left|spots|seats|remaining)/i, "fake scarcity count"],
    [/\bact now\b/i, "urgency CTA"],
    [/join\s+\d[\d,]*\s+(collectors|subscribers|readers|people)/i, "fabricated subscriber count"],
    [/\d+\s+people\s+are\s+(viewing|watching)/i, "fake live-viewer count"],
  ];
  for (const rel of [PAGE, GATE, CTA]) {
    const src = readFile(rel);
    for (const [re, label] of forbidden) {
      assert.doesNotMatch(src, re, `${rel} must not use ${label}`);
    }
  }
});
