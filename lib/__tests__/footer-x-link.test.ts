// Footer "Follow on X" link (audit 2026-06-29) — closes the site→X funnel loop.
// Pins: the link renders, points at the live profile, opens safely in a new tab,
// is accessible, and is a LIGHTWEIGHT plain link — never the heavy official embed
// (which ships third-party JS that hurts LCP/Core Web Vitals).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const layout = readFileSync(join(ROOT, "app", "(site)", "layout.tsx"), "utf8");

test("footer links to the live X profile x.com/FoilTCG", () => {
  assert.match(layout, /href="https:\/\/x\.com\/FoilTCG"/);
  assert.match(layout, /Follow on X/);
});

test("the X link opens in a new tab safely (target=_blank + noopener noreferrer)", () => {
  // Isolate the anchor so the assertions are about THIS link, not the file.
  const anchor = layout.slice(layout.indexOf('href="https://x.com/FoilTCG"'));
  assert.match(anchor.slice(0, 400), /target="_blank"/);
  assert.match(anchor.slice(0, 400), /rel="[^"]*noopener[^"]*"/);
  assert.match(anchor.slice(0, 400), /rel="[^"]*noreferrer[^"]*"/);
  // rel="me" — the zero-cost brand-entity identity signal.
  assert.match(anchor.slice(0, 400), /rel="[^"]*\bme\b[^"]*"/);
});

test("the X link is accessible (aria-label) and uses an inline SVG glyph, not an icon font", () => {
  const anchor = layout.slice(layout.indexOf('href="https://x.com/FoilTCG"'), layout.indexOf("</a>", layout.indexOf("x.com/FoilTCG")));
  assert.match(anchor, /aria-label="[^"]*X[^"]*"/);
  assert.match(anchor, /<svg/);
  assert.match(anchor, /fill="currentColor"/); // glyph inherits the calm navy ink
});

test("does NOT embed the heavy official X/Twitter widget (LCP/CWV guard)", () => {
  assert.doesNotMatch(layout, /platform\.twitter\.com|widgets\.js|twitter-tweet|twitter-timeline/);
});

test("the X link stays calm + token-styled (ADR-066: secondary to the email ask, no loud color)", () => {
  const anchor = layout.slice(layout.indexOf('href="https://x.com/FoilTCG"'), layout.indexOf("</a>", layout.indexOf("x.com/FoilTCG")));
  // Chrome ink on hover, like the sibling footer links (the footer reads the
  // --chrome-* tone variables since the overnight-design-loop night register) —
  // no raw hex, no resting coral.
  assert.match(anchor, /hover:text-\[var\(--chrome-ink\)\]/);
  assert.doesNotMatch(anchor, /#[0-9a-fA-F]{3,6}/);
  assert.doesNotMatch(anchor, /(?<!hover:)(?:text|bg)-foil-coral/);
});
