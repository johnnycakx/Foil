// OG/social card-art tests (ADR-055 amendment). The next/og render can't run
// under node --strip-types (edge/Satori), so the template is pinned STRUCTURALLY
// (card-art <img>, wordmark, never-500 soft-fall) the same way the other Satori
// templates are; the generated data-URL module is verified directly.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OG_CARD_ART } from "../../app/og-card-art.generated.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// --- the generated card-art module (webp -> jpeg, base64-inlined at build) ---

test("OG_CARD_ART: 2-4 cards, each a valid base64 JPEG data-URL, Charizard anchor present", () => {
  assert.ok(OG_CARD_ART.length >= 2 && OG_CARD_ART.length <= 4, `expected 2-4 cards, got ${OG_CARD_ART.length}`);
  for (const c of OG_CARD_ART) {
    assert.match(c.dataUrl, /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/, `${c.slug} is not a base64 jpeg data-url`);
    assert.ok(c.dataUrl.length > 1000, `${c.slug} data-url suspiciously short (blank art?)`);
  }
  // The anchor card the goal pins (Charizard Base Set) must be present.
  assert.ok(OG_CARD_ART.some((c) => c.slug === "base1-4"), "Charizard base1-4 (the anchor) must be in the fan");
  // Reasonable total inlined size for the edge bundle (cards are resized + jpeg).
  const totalKb = OG_CARD_ART.reduce((a, c) => a + c.dataUrl.length, 0) / 1024;
  assert.ok(totalKb < 700, `inlined card art ${Math.round(totalKb)}KB too large for the edge function`);
});

// --- the OG template: features the card art + keeps the never-500 soft-fall ---

test("opengraph-image.tsx: renders the card-art fan, the wordmark, and the text-only soft-fall", () => {
  const src = read("app/opengraph-image.tsx");
  // Inlined card art (no fs/sharp/fetch at edge request time).
  assert.match(src, /import \{ OG_CARD_ART \} from "\.\/og-card-art\.generated"/);
  assert.match(src, /src=\{c\.dataUrl\}/, "the fan renders the card-art data-URLs");
  // Wordmark lockup (the brand) stays.
  assert.match(src, /MARK_DATA_URL/);
  assert.match(src, /<span style=\{\{ color: GOLD \}\}>TCG<\/span>/);
  // Never-500 soft-fall: empty art -> text-only (left column goes full width,
  // the fan block is omitted) + the font still falls back to sans-serif.
  assert.match(src, /const hasArt = art\.length > 0/);
  assert.match(src, /width: hasArt \? 660 : "100%"/, "left column goes full-width when there's no art");
  assert.match(src, /hasArt \? \(/, "the fan block is gated on hasArt");
  assert.match(src, /fredoka \? "Fredoka" : "sans-serif"/, "font soft-fall retained");
  // Edge config unchanged.
  assert.match(src, /export const runtime = "edge"/);
  assert.match(src, /width: 1200, height: 630/);
});

test("twitter-image.tsx: still re-exports the OG renderer (single source for both)", () => {
  const src = read("app/twitter-image.tsx");
  assert.match(src, /import OgImage from "\.\/opengraph-image"/);
  assert.match(src, /export default OgImage/);
  assert.match(src, /width: 1200, height: 630/);
});
