// Email-template guard (welcome-email-overhaul; extends the ADR-099
// retired-asset tripwire to email surfaces).
//
// The deliverability doctrine (ADR-079): user-facing email is TEXT-FORWARD —
// no images, no button-styled links, system fonts. That's what holds Gmail
// Primary. And the brand doctrine (ADR-094/ADR-099): the retired identities
// (gold-"TCG" lockup, vermillion seal, the old FoilTCG image logo) must not
// render anywhere — a succession that misses an email template ships the old
// brand to every new subscriber's first impression.
//
// Voice: "chasing", never "hunting" (John's verdict, 2026-07-02 — the site
// sweep never covered emails; this pins it).
//
// Covered templates: every file in emails/ (auto-discovered, so a new template
// is guarded the day it lands) + the transactional composers in lib/wishlist/.
// The Beehiiv-hosted welcome automation body can't be repo-guarded — it's
// verified by eyeball at publish time (see docs/goals/welcome-email-overhaul.md).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const TEMPLATE_FILES: string[] = [
  ...readdirSync(join(ROOT, "emails"))
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => `emails/${f}`),
  "lib/wishlist/vault-email.ts",
  "lib/wishlist/alert-email.ts",
];

/** Strip block comments, line comments (not `https://`), and JSX comments so
 *  bans apply to rendered output, not to the comments documenting the bans. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

test("email templates: no images — text-forward is what holds Gmail Primary (ADR-079)", () => {
  for (const rel of TEMPLATE_FILES) {
    const src = stripComments(readFileSync(join(ROOT, rel), "utf8"));
    assert.doesNotMatch(src, /<img\b/i, `${rel}: <img> is banned in email templates`);
  }
});

test("email templates: no buttons, no button-styled links (ADR-079)", () => {
  for (const rel of TEMPLATE_FILES) {
    const src = stripComments(readFileSync(join(ROOT, rel), "utf8"));
    assert.doesNotMatch(src, /<button\b/i, `${rel}: <button> is banned in email templates`);
    // A background-styled anchor IS the email-button pattern (the old welcome's
    // navy CTA). Panels/sections may carry backgrounds; links may not.
    const anchors = src.match(/<(a|Link)\b[^>]*>/g) ?? [];
    for (const tag of anchors) {
      assert.doesNotMatch(
        tag,
        /background/i,
        `${rel}: background-styled link (an email "button") is banned: ${tag.slice(0, 120)}`,
      );
    }
  }
});

test("email templates: voice — 'chasing', never 'hunting' (welcome-email-overhaul sweep)", () => {
  for (const rel of TEMPLATE_FILES) {
    const src = stripComments(readFileSync(join(ROOT, rel), "utf8"));
    assert.doesNotMatch(src, /hunt/i, `${rel}: "hunt(ing)" is banned in email copy — say "chasing"`);
  }
});

test("RETIRED-ASSET TRIPWIRE: the old identities are dead in every email template (extends ADR-099)", () => {
  for (const rel of TEMPLATE_FILES) {
    const src = stripComments(readFileSync(join(ROOT, rel), "utf8"));
    assert.doesNotMatch(src, /#d85a30/i, `${rel}: the retired vermillion seal ink must be gone`);
    assert.doesNotMatch(src, /MARK_DATA_URL|SEAL_DATA_URL/, `${rel}: no seal data-url`);
    assert.doesNotMatch(src, /x="3\.2" y="3\.2"/, `${rel}: no seal square geometry`);
    assert.doesNotMatch(src, /foil-logo\.png/i, `${rel}: the retired FoilTCG image logo must be gone`);
    // The gold-"TCG" lockup as a rendered node ("Foil TCG, LLC" legal text in
    // plain strings is fine; a JSX >TCG< text node is the retired wordmark).
    assert.doesNotMatch(src, />TCG</, `${rel}: no "TCG" lockup node (ADR-094 dropped it)`);
    assert.doesNotMatch(src, /FoilTCG/, `${rel}: the retired one-word FoilTCG lockup must be gone`);
  }
});

test("guard coverage: the template list actually contains the known templates", () => {
  // If emails/ moves or the composers are renamed, fail loudly instead of
  // silently guarding nothing.
  assert.ok(TEMPLATE_FILES.length >= 4, `expected >=4 templates, got ${TEMPLATE_FILES.length}`);
  assert.ok(TEMPLATE_FILES.includes("lib/wishlist/vault-email.ts"));
  assert.ok(TEMPLATE_FILES.includes("lib/wishlist/alert-email.ts"));
  assert.ok(TEMPLATE_FILES.some((f) => f.startsWith("emails/")));
});
