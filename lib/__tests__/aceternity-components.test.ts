// Structural drift guards for the Aceternity-pattern components shipped
// in Session 38 / ADR-028, retuned in Session 39 / ADR-029.
//
// These components are pure presentational + use CSS keyframes / pointer
// listeners for motion — there is no meaningful HTML snapshot to assert
// against (the actual visual is in the animation, not the markup). The
// tests below pin the structural anchors a refactor would slip past:
//   - Each component file exists and exports the named API the rest of
//     the codebase imports.
//   - The Session-39 gold/navy default palette stays in
//     BackgroundGradientAnimation so a refactor can't quietly drift the
//     niche-signal palette back to the pre-pivot coral.
//   - The MagneticButton + MagneticLink siblings exist (the layout uses
//     MagneticLink for navigation CTAs, MagneticButton for form CTAs).
//   - Card3D composes the three-piece API (Card3D / Card3DBody /
//     Card3DItem) the /cards thumbnail wrap depends on.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ---------------------------------------------------------------------------
// background-gradient-animation.tsx
// ---------------------------------------------------------------------------

test("BackgroundGradientAnimation: exports the named function", () => {
  const src = readFile("components/aceternity/background-gradient-animation.tsx");
  assert.match(src, /export\s+function\s+BackgroundGradientAnimation/);
});

test("BackgroundGradientAnimation: defaults to gold/navy palette (ADR-029)", () => {
  const src = readFile("components/aceternity/background-gradient-animation.tsx");
  // Foil gold #C9A24B = rgb(201, 162, 75); navy #0F1E3A = rgb(15, 30, 58).
  // We pin the RGB triplets so a refactor can't drift the palette back
  // to the pre-ADR-029 rainbow.
  assert.match(src, /firstColor\s*=\s*["']201,\s*162,\s*75["']/);
  assert.match(src, /secondColor\s*=\s*["']15,\s*30,\s*58["']/);
});

test("BackgroundGradientAnimation: containerBg defaults to cream (ADR-029)", () => {
  const src = readFile("components/aceternity/background-gradient-animation.tsx");
  // Cream #F8F5F0 is the page surface across every (site) route.
  assert.match(src, /containerBg\s*=\s*["']#F8F5F0["']/);
});

test("BackgroundGradientAnimation: default variant is corner-shimmer (ADR-029)", () => {
  const src = readFile("components/aceternity/background-gradient-animation.tsx");
  // The new restrained mode replaces the full-page rainbow; pin the prop
  // default so a refactor can't quietly re-enable the rainbow.
  assert.match(src, /variant\s*=\s*["']corner-shimmer["']/);
});

test("BackgroundGradientAnimation: SVG goo filter is present (blobs merge instead of overlap)", () => {
  const src = readFile("components/aceternity/background-gradient-animation.tsx");
  // The signature visual is the "gooey blobs" merging — provided by an
  // SVG feColorMatrix + feGaussianBlur filter. If a refactor drops the
  // <svg><defs><filter id="foil-blob-goo"></defs></svg> chain, the
  // visual collapses to flat overlapping circles.
  assert.match(src, /id="foil-blob-goo"/);
  assert.match(src, /feGaussianBlur/);
  assert.match(src, /feColorMatrix/);
});

// ---------------------------------------------------------------------------
// card-3d.tsx
// ---------------------------------------------------------------------------

test("Card3D: exports the three-piece API (Card3D, Card3DBody, Card3DItem)", () => {
  const src = readFile("components/aceternity/card-3d.tsx");
  assert.match(src, /export\s+function\s+Card3D\b/);
  assert.match(src, /export\s+function\s+Card3DBody\b/);
  assert.match(src, /export\s+function\s+Card3DItem\b/);
});

test("Card3D: uses CSS perspective + transform-style:preserve-3d (no framer-motion)", () => {
  const src = readFile("components/aceternity/card-3d.tsx");
  assert.match(src, /perspective/);
  assert.match(src, /preserve-3d/);
});

test("Card3D: pointer leaves reset the rotation to 0/0 (no stuck tilt)", () => {
  const src = readFile("components/aceternity/card-3d.tsx");
  // onMouseLeave handler must reset transform — checked by the literal
  // "rotateY(0deg) rotateX(0deg)" in the leave-handler branch.
  assert.match(src, /rotateY\(0deg\) rotateX\(0deg\)/);
});

test("Card3D: hover ring uses Foil gold (ADR-029 — gold = premium hover signal)", () => {
  const src = readFile("components/aceternity/card-3d.tsx");
  // Gold hover-ring is the niche signal — a refactor that drops it
  // returns the card to a generic CTA hover.
  assert.match(src, /hover:ring-foil-gold/);
});

// ---------------------------------------------------------------------------
// magnetic-button.tsx
// ---------------------------------------------------------------------------

test("MagneticButton: exports BOTH MagneticButton + MagneticLink siblings", () => {
  const src = readFile("components/aceternity/magnetic-button.tsx");
  assert.match(src, /export\s+function\s+MagneticButton\b/);
  assert.match(src, /export\s+function\s+MagneticLink\b/);
});

test("MagneticButton: default magnet strength + radius are stable (12px / 80px)", () => {
  const src = readFile("components/aceternity/magnetic-button.tsx");
  assert.match(src, /strength\s*=\s*12/);
  assert.match(src, /radius\s*=\s*80/);
});

test("MagneticButton: pointer leave resets transform to (0, 0)", () => {
  const src = readFile("components/aceternity/magnetic-button.tsx");
  // Both the button and link onMouseLeave handlers must reset.
  const occurrences = (src.match(/translate\(0,\s*0\)/g) ?? []).length;
  assert.ok(occurrences >= 2, "expected at least 2 resets (button + link onMouseLeave)");
});

test("MagneticButton: default chrome includes gold hover-ring (ADR-029)", () => {
  const src = readFile("components/aceternity/magnetic-button.tsx");
  // Universal hover-ring + shadow-expansion baked into MAGNETIC_DEFAULTS.
  assert.match(src, /hover:ring-foil-gold/);
});

// ---------------------------------------------------------------------------
// sparkles.tsx
// ---------------------------------------------------------------------------

test("Sparkles: exports the named function", () => {
  const src = readFile("components/aceternity/sparkles.tsx");
  assert.match(src, /export\s+function\s+Sparkles\b/);
});

test("Sparkles: defaults to 30 sparkles in Foil gold (ADR-029)", () => {
  const src = readFile("components/aceternity/sparkles.tsx");
  assert.match(src, /count\s*=\s*30/);
  // Gold #C9A24B = rgb(201, 162, 75). Pre-Session-39 default was coral.
  assert.match(src, /color\s*=\s*["']201,\s*162,\s*75["']/);
});

test("Sparkles: container is aria-hidden + pointer-events:none (decorative-only)", () => {
  const src = readFile("components/aceternity/sparkles.tsx");
  // Both must be present so the sparkles never interfere with click flow
  // or assistive-tech traversal.
  assert.match(src, /aria-hidden/);
  assert.match(src, /pointer-events-none/);
});

// ---------------------------------------------------------------------------
// Composition — homepage hero uses the components correctly
// ---------------------------------------------------------------------------

test("Homepage Hero: solid cream — no gradient/Card3D/Magnetic/Sparkles (ADR-038)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Session 47.1 / ADR-038 removed the BackgroundGradientAnimation
  // corner-shimmer (stray amber glow). The hero is solid cream; the
  // grail fan is static (Card3D + magnetic CTA already gone in ADR-037).
  assert.doesNotMatch(src, /BackgroundGradientAnimation/);
  assert.doesNotMatch(src, /<Card3D\b/);
  assert.doesNotMatch(src, /<MagneticLink\b/);
  assert.doesNotMatch(src, /<Sparkles\b/);
  // The hero keeps a plain Link to /start (now a demoted *secondary* link —
  // the primary CTA is the EmailCapture, G-EMAIL / ADR-065).
  assert.match(src, /<Link[^>]*href=["']\/start["']/);
});

test("Homepage Hero: H1 carries font-display class (Fraunces)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The H1 must render in the display font — pinning the className token.
  assert.match(src, /<h1[^>]*font-display/);
});

test("Homepage Hero: includes the 8-card grail showcase", () => {
  const src = readFile("app/(site)/page.tsx");
  // 8 hand-curated entries in HERO_CARDS. Count only entries with a
  // string id literal (not the type annotation's `{ id: string;`).
  const heroCardsBlock = src.match(/HERO_CARDS[^]*?\];/);
  assert.ok(heroCardsBlock, "HERO_CARDS array must exist");
  const matches = (heroCardsBlock![0].match(/\{\s*id:\s*["']/g) ?? []).length;
  assert.equal(matches, 8, "HERO_CARDS should have exactly 8 entries");
});
