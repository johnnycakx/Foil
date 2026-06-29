// Structural guard for the editorial newsletter template (NL-EDIT-SHIP). The
// test harness (node --experimental-strip-types) strips TS types but does NOT
// transform JSX, so a .tsx cannot be imported + rendered here — the repo's
// convention is to guard .tsx surfaces by reading the SOURCE as text (mirrors
// visual-regression.test.ts and the bot-slash-commands guard). The RENDERED
// HTML (affiliate wrapping, no em dash in output, Gmail Primary placement) is
// verified by the live send in the HARD test gate, exactly as ADR-079 did.
//
// This pins two things the live test can't catch early: every editorial segment
// is wired into the template, and the Primary-safe constraints (no images, no
// big CTA buttons) can't silently regress.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = readFileSync(join(ROOT, "emails/editorial-digest-email.tsx"), "utf8");

test("renders every editorial segment field", () => {
  for (const field of [
    "issue.subject",
    "issue.open",
    "issue.bigMove.cardName",
    "issue.bigMove.body",
    "issue.coolingPicks",
    "issue.heatingPicks",
    "issue.sellersNote",
    "issue.theRead",
    "issue.oneMoreThing",
    "issue.signoff",
  ]) {
    assert.ok(SRC.includes(field), `template never renders ${field}`);
  }
});

test("labels every signature segment for the reader", () => {
  for (const label of ["Foil Weekly", "The Big Move", "Cooling off", "Heating up", "Seller's Note", "The Read", "One more thing"]) {
    assert.ok(SRC.includes(label), `missing segment label: ${label}`);
  }
});

test("attaches an affiliate browse link per pick (Big Move + every PickRow)", () => {
  // BrowseLink is the only link-to-eBay primitive; it must appear in the Big
  // Move block AND inside PickRow (which renders cooling + heating).
  const browseLinkUses = (SRC.match(/<BrowseLink\b/g) ?? []).length;
  assert.ok(browseLinkUses >= 2, `expected BrowseLink in Big Move + PickRow, found ${browseLinkUses}`);
  assert.ok(/function PickRow\b/.test(SRC), "PickRow component (cooling/heating rows) must exist");
  assert.ok(SRC.includes("matchModelCard"), "links must be mapped from the model, never fabricated");
});

test("Primary-safe: no images and no big CTA buttons (the ADR-079 constraint)", () => {
  // No images at all — image-heavy templates get sorted to Promotions.
  assert.ok(!/<img\b/i.test(SRC), "no raw <img> tags");
  assert.ok(!/\bImg\b/.test(SRC), "no react-email <Img> component");
  assert.ok(!/background-image|backgroundImage/i.test(SRC), "no CSS background images");
  // No button primitives — styled text links only.
  assert.ok(!/\bButton\b/.test(SRC), "no react-email <Button> (text links only)");
  assert.ok(!/<button\b/i.test(SRC), "no raw <button> tags");
  // The only @react-email import line must not pull Button or Img.
  const importLine = SRC.match(/from "@react-email\/components";/);
  assert.ok(importLine, "imports from @react-email/components");
});

test("carries the compliance footer: native unsubscribe + CAN-SPAM address", () => {
  assert.ok(SRC.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"), "native one-click unsubscribe merge tag");
  assert.ok(SRC.includes("Foil TCG, LLC"), "CAN-SPAM physical mailing address");
});
