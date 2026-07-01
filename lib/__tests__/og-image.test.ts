// OG/social card-art tests (ADR-055 amendment). The next/og render can't run
// under node --strip-types (edge/Satori), so the template is pinned STRUCTURALLY
// (card-art <img>, wordmark, never-500 soft-fall) the same way the other Satori
// templates are; the generated data-URL module is verified directly.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

// --- metadata completeness (fix-blank-og-share-cards) -----------------------
//
// A page that exports its own `openGraph` object SUPPRESSES the file-based
// app/opengraph-image.tsx (Next.js behaviour, verified live 2026-06-30), so it
// MUST reference an OG image or every shared link renders a BLANK card — the
// exact bug this pins. 16 public pages shipped blank because they overrode
// openGraph without an `images:`. This is a structural source-scan (resolving
// generateMetadata would need per-route param mocks + server-only imports); it
// fails the build on ANY new (site) page that overrides openGraph/twitter
// without an OG image. Pages with NO openGraph override are skipped — they
// correctly inherit the file-based image.

/** Extract a metadata sub-object (`openGraph`/`twitter`) by brace-matching. */
function metadataBlock(src: string, key: "openGraph" | "twitter"): string | null {
  const at = src.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (at < 0) return null;
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/** A block "has an OG image" if it names the dynamic file OG or a real per-
 *  entity image binding (card image / set logo). */
const referencesOgImage = (block: string) =>
  /["']\/opengraph-image["']/.test(block) || /(card\.image|set\.logoUrl)/.test(block);

test("Metadata completeness: every (site) openGraph/twitter block references an OG image (blank-share-card regression)", () => {
  const siteDir = join(ROOT, "app", "(site)");
  const pages: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "page.tsx") pages.push(full);
    }
  })(siteDir);
  assert.ok(pages.length >= 15, `expected the public (site) pages, found ${pages.length}`);

  const offenders: string[] = [];
  for (const full of pages) {
    const src = readFileSync(full, "utf8");
    const rel = full.slice(ROOT.length + 1).replace(/\\/g, "/");
    const og = metadataBlock(src, "openGraph");
    if (og && !referencesOgImage(og)) offenders.push(`${rel} (openGraph)`);
    const tw = metadataBlock(src, "twitter");
    if (tw && !referencesOgImage(tw)) offenders.push(`${rel} (twitter)`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these blocks override openGraph/twitter without an OG image (blank share card): ${offenders.join(", ")}`,
  );
});
