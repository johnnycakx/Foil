// OG/social card-art tests (ADR-055 amendment). The next/og render can't run
// under node --strip-types (edge/Satori), so the template is pinned STRUCTURALLY
// (card-art <img>, wordmark, never-500 soft-fall) the same way the other Satori
// templates are; the generated data-URL module is verified directly.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
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
  // Identity block (brand-og-unification): the SHARED brand component — the
  // Shrikhand wordmark, no seal mark, self-hosted TTF (Satori can't parse
  // woff2; the old Google-css2 fetch never actually loaded a font).
  assert.match(src, /from "\.\.\/lib\/og\/brand"/, "must import the shared OG brand block");
  assert.match(src, /<OgWordmark\b/, "the wordmark renders via the shared component");
  assert.doesNotMatch(src, />TCG<\/span>/, "no gold 'TCG' in the OG wordmark (ADR-094)");
  // Never-500 soft-fall: empty art -> text-only (left column goes full width,
  // the fan block is omitted); font failure falls back to styled text, never
  // the retired mark (enforced inside lib/og/brand).
  assert.match(src, /const hasArt = art\.length > 0/);
  assert.match(src, /width: hasArt \? 660 : "100%"/, "left column goes full-width when there's no art");
  assert.match(src, /hasArt \? \(/, "the fan block is gated on hasArt");
  // Edge config unchanged.
  assert.match(src, /export const runtime = "edge"/);
  assert.match(src, /width: 1200, height: 630/);
});

// --- brand unification: every OG surface shares the brand block; the retired
// --- seal is a build-failing tripwire on ALL share/meta surfaces ---

test("every ImageResponse surface imports the shared OG brand block (brand-og-unification)", () => {
  // The lines card is the other generator (twitter-image re-exports the root).
  const lines = read("app/(site)/lines/[pokemon]/opengraph-image.tsx");
  assert.match(lines, /from "@\/lib\/og\/brand"/, "lines OG must import the shared brand block");
  assert.match(lines, /<OgWordmark\b/, "lines OG renders the shared wordmark");
  assert.match(lines, /loadOgFonts\(/, "lines OG loads fonts via the shared helper");
  const root = read("app/opengraph-image.tsx");
  assert.match(root, /loadOgFonts\(/, "root OG loads fonts via the shared helper");
  // The shared block itself: self-hosted TTFs + the never-the-seal fallback.
  const brand = read("lib/og/brand.tsx");
  assert.match(brand, /Shrikhand-Regular\.ttf/, "the brand block loads the self-hosted wordmark TTF");
  assert.match(brand, /Geist-Regular\.ttf/, "the brand block loads the self-hosted body TTF");
  // The regression this pins: a remote css2 fetch whose response is a woff2
  // Satori can't parse (the comment may MENTION woff2; code may not fetch it).
  assert.doesNotMatch(brand, /\.woff2|fonts\.googleapis|fonts\.gstatic/, "never the remote css2/woff2 fetch path");
  // nodejs runtime must NOT fetch the asset (undici rejects file: URLs — the
  // build-breaking bug this goal caught): the loader branches on NEXT_RUNTIME
  // and reads via fs on node.
  assert.match(brand, /process\.env\.NEXT_RUNTIME === "edge"/, "runtime-branched loader");
  assert.match(brand, /readFile\b/, "nodejs branch reads the TTF via fs, not fetch");
  // Never `fonts: []` — ImageResponse does `options.fonts || defaultFonts`,
  // so an empty array disables its bundled-Geist fallback and satori throws
  // "No fonts are loaded" (prerender/build failure).
  assert.match(brand, /fonts\.length \? fonts : undefined/, "empty font set must collapse to undefined");
});

test("RETIRED-ASSET TRIPWIRE: the seal mark is dead on every OG/meta surface (brand-og-unification)", () => {
  // A brand succession that misses a share surface must fail the build. The
  // page-visible SealMark (components/brand/logo.tsx, hero pill) is UI scope
  // and intentionally NOT swept here.
  const surfaces = [
    "app/opengraph-image.tsx",
    "app/twitter-image.tsx",
    "app/(site)/lines/[pokemon]/opengraph-image.tsx",
    "lib/og/brand.tsx",
    "public/favicon.svg",
    "public/icon.svg",
    "app/manifest.ts",
  ];
  for (const rel of surfaces) {
    const src = read(rel);
    assert.doesNotMatch(src, /#d85a30/i, `${rel}: the retired vermillion seal ink must be gone`);
    assert.doesNotMatch(src, /MARK_DATA_URL|SEAL_DATA_URL/, `${rel}: no seal data-url`);
    assert.doesNotMatch(src, /x="3\.2" y="3\.2"/, `${rel}: no seal square geometry`);
  }
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
 *  entity image binding (card image / set logo). What the guard forbids is an
 *  openGraph override with NO image at all — on a route WITHOUT a sibling
 *  opengraph-image.tsx (see hasSiblingOgFile below). */
const referencesOgImage = (block: string) =>
  /\/opengraph-image[`"']/.test(block) || /(card\.image|set\.logoUrl)/.test(block);

/** Routes with a SAME-SEGMENT opengraph-image.tsx are covered by the file
 *  convention: Next serves it at a HASHED url and auto-injects the correct
 *  og:image/twitter:image tags even when the page overrides openGraph
 *  (verified live + on dev, lines-petals-and-type 2026-07-02 — the hashed
 *  injection is exactly why a HAND-WRITTEN `/lines/x/opengraph-image` path
 *  404'd in prod: the real url is `/lines/x/opengraph-image-<hash>`). Such
 *  pages must NOT hand-reference the OG path; they're exempt here. */
const hasSiblingOgFile = (pageFile: string) =>
  existsSync(join(dirname(pageFile), "opengraph-image.tsx"));

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
    if (hasSiblingOgFile(full)) {
      // File-convention route: the hashed OG is auto-injected. A hand-written
      // unhashed path here IS the blank-card bug (it 404s) — pin its absence.
      const og = metadataBlock(src, "openGraph") ?? "";
      const tw = metadataBlock(src, "twitter") ?? "";
      if (/\/opengraph-image[`"']/.test(og + tw)) {
        offenders.push(`${rel} (hand-written OG path on a file-convention route — 404s; let Next inject the hashed url)`);
      }
      continue;
    }
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
