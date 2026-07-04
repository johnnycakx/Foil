// Visual-regression invariants for the Session 39 cream/navy/gold
// identity overhaul (ADR-029). The actual visual is in CSS animations
// and computed-style at run time; these tests pin the markup anchors a
// refactor would slip past — palette tokens, structural choices, and
// the "coral is hover-only" defense-in-depth rule.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// Every public-surface file that landed the palette migration. New
// surfaces added under (site) should be appended so the invariants below
// pick them up automatically.
const PUBLIC_SURFACES: readonly string[] = [
  "app/(site)/layout.tsx",
  "app/(site)/page.tsx",
  "app/(site)/start/page.tsx",
  "components/start-page-form.tsx",
  "app/(site)/cards/page.tsx",
  "app/(site)/cards/cards-search.tsx",
  "app/(site)/cards/[slug]/page.tsx",
  "app/(site)/cards/sets/[set-id]/page.tsx",
  "app/(site)/blog/page.tsx",
  "app/(site)/blog/[slug]/page.tsx",
  // G-EMAIL / ADR-065: the three SEO pillar pages were ported from the
  // pre-Session-39 dark palette (white/zinc text on cream — a live contrast
  // bug) to cream/navy/gold while raising email capture on the ranking
  // surfaces. Adding them here extends the no-raw-hex + coral-hover-only
  // invariants so they can't drift back.
  "app/(site)/japanese-pokemon-cards-value/page.tsx",
  "app/(site)/pokemon-card-value-calculator/page.tsx",
  "app/(site)/pokemon-card-condition-guide/page.tsx",
  "app/(site)/legal/privacy/page.tsx",
  "app/(site)/legal/terms/page.tsx",
  "app/(site)/legal/ebay-api-compliance/page.tsx",
  "app/(site)/newsletter/page.tsx",
  // /newsletter "recent read" proof (newsletter-conversion-fixes): real
  // market_movers snippet that replaced the fabricated SAMPLE_EXCERPTS. Same
  // cream/navy/gold register; coral-hover-only + no-raw-hex invariants cover it.
  "components/newsletter/recent-read-snippet.tsx",
  "components/email-capture.tsx",
  // ADR-068: lead-magnet surfaces (landing page + gate + CTA). Same cream/navy/
  // gold register; the palette + coral-hover-only invariants cover them.
  "app/(site)/free/pokemon-card-pricing-cheat-sheet/page.tsx",
  "components/lead-magnet-gate.tsx",
  "components/lead-magnet-cta.tsx",
  "components/buy-signal-badge.tsx",
  // Session 42 / ADR-031: MDX components rendered inside blog post
  // bodies were missed by the Session 39 sweep — adding them to the
  // public-surfaces list extends the no-coral-default + no-raw-hex
  // invariants to cover callouts, FAQ, TopicLink, code blocks, etc.
  "mdx-components.tsx",
  // Session 43 / ADR-032: brand logo component rendered in the header
  // (and any future hero/marquee surface). Same no-coral-default rule
  // applies — the gold rhombus is the brand mark, coral has no place
  // in the brand surface.
  "components/brand/logo.tsx",
  // Session 47.4 / ADR-046: long-tail listing fallback rendered on
  // longtail-tier /cards/[slug] pages in place of the live best-listing.
  "components/cards/long-tail-listing-fallback.tsx",
  // Session 47.5 / ADR-047: metadata-only listing block (3rd tier) — SDK
  // metadata + two search CTAs, no eBay/PokeTrace.
  "components/cards/metadata-only-listing.tsx",
  // ADR-047 v2 (SEO crawlability fix): the curated live eBay best-listing +
  // buy-signal now hydrate client-side here so the card page render stays fast.
  // Same cream/navy/gold register + coral-hover-only Buy CTA — invariants cover it.
  "components/cards/live-listing-section.tsx",
  // ADR-069: the insight-led /deals surface — the market-movers board (lead),
  // the demoted single-listing board, and the page itself. Same cream/navy/gold
  // register; coral-hover-only + no-raw-hex invariants cover them.
  "app/(site)/deals/page.tsx",
  "components/deals/movers-board.tsx",
  "components/deals/deals-board.tsx",
  // Dual-track (ADR-064): the vending lead-gen surfaces at /host stay live and
  // use the same cream/navy/gold register, so the coral-hover-only + no-raw-hex
  // invariants cover them too. (Their copy firewall lives in
  // vending-surfaces.test.ts.)
  "app/(site)/host/page.tsx",
  "app/(site)/machines/page.tsx",
  "app/(site)/faq/page.tsx",
  "app/(site)/service-areas/page.tsx",
  "app/(site)/service-areas/[city]/page.tsx",
  "components/vending/host-lead-form.tsx",
  "components/vending/restock-alert-form.tsx",
  // ADR-093: the vault surface (the token-access watchlist page + its
  // components + the recovery page + the shared type-ahead). design-loop-round2
  // §4 (vault night register): both /w pages now carry data-tone="night" —
  // night/night-2 surfaces, cream ink, teal foil-accent (no gold/coral at
  // rest); the no-raw-hex + coral-hover-only invariants still cover them so
  // the binder aesthetic can't drift back toward a generic-template look. The
  // pocket's plastic-sleeve inset shadow uses rgba() (a depth cue, not a hex
  // literal), which the no-raw-hex guard doesn't flag.
  "app/(site)/w/[token]/page.tsx",
  "app/(site)/w/page.tsx",
  "components/vault/vault-add-card.tsx",
  "components/cards/card-typeahead.tsx",
  // ADR-095: the line-tracker surface (/lines/[pokemon] + its client
  // components). It layers a SAKURA register accent over the cream/navy base —
  // sakura is used as the hover/accent color (like coral elsewhere), never a
  // resting fill beyond the soft --color-foil-sakura-wash tint. The no-raw-hex +
  // coral-hover-only invariants cover them so the accent can't drift into a
  // loud default. The OG image (opengraph-image.tsx) is intentionally excluded:
  // it uses raw hex for Satori inline styles, same as every other OG route.
  "app/(site)/lines/[pokemon]/page.tsx",
  "components/lines/sakura-petals.tsx",
  "components/lines/line-card-rail.tsx",
  "components/lines/line-track-form.tsx",
  // card-page-vault-first: the hero action + the collapsible depth shell on
  // /cards/[slug]. Night register (charcoal/sakura); the no-raw-hex +
  // coral-hover-only invariants cover both.
  "components/cards/add-to-vault.tsx",
  "components/cards/detail-section.tsx",
];

// ---------------------------------------------------------------------------
// globals.css — palette tokens
// ---------------------------------------------------------------------------

test("globals.css: declares all five Foil palette tokens", () => {
  const css = readFile("app/globals.css");
  assert.match(css, /--color-foil-cream:\s*#[Ff]8[Ff]5[Ff]0/);
  assert.match(css, /--color-foil-navy:\s*#0[Ff]1[Ee]3[Aa]/);
  assert.match(css, /--color-foil-slate:\s*#4[Aa]5568/);
  assert.match(css, /--color-foil-gold:\s*#[Cc]9[Aa]24[Bb]/);
  assert.match(css, /--color-foil-coral:\s*#[Ff][Ff]6[Bb]5[Cc]/);
});

test("globals.css: :root background is cream + foreground is navy (ADR-029)", () => {
  const css = readFile("app/globals.css");
  // The body default flipped from white/near-black to cream/navy.
  assert.match(css, /--background:\s*#[Ff]8[Ff]5[Ff]0/);
  assert.match(css, /--foreground:\s*#0[Ff]1[Ee]3[Aa]/);
});

test("globals.css: no dark-mode media-query override (ADR-029: cream is consistent across OS prefs)", () => {
  const css = readFile("app/globals.css");
  // The previous `@media (prefers-color-scheme: dark)` flipped --background
  // back to near-black. Cream-only identity drops that override.
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/);
});

// ---------------------------------------------------------------------------
// Homepage — single-color navy headline + corner-shimmer + Card3D wrap
// ---------------------------------------------------------------------------

test("Homepage: H1 is a single-color ink headline with no inline color split (overnight-design-loop)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The hero sets the headline in ONE continuous ink line — cream on the night
  // register, navy on the warm register — with no inline
  // <span className="text-…"> splits (the pre-Session-39 coral split must
  // never return in any palette). Direction-agnostic during DIVERGE; the
  // winner's exact ink gets pinned at CONVERGE.
  const h1Block = src.match(/<h1\b[^>]*text-foil-(?:cream|navy)[^>]*>[\s\S]*?<\/h1>/);
  assert.ok(h1Block, "H1 with a single foil ink color must exist");
  assert.doesNotMatch(h1Block![0], /<span\b[^>]*text-[^>]*>/);
});

test("Homepage: pull-model hero — 'Start your vault' → /start is the primary CTA; newsletter is the demoted secondary ask (fable-design-overhaul §1)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The hero promise is PULL (tell us what you chase), never push ("stop
  // guessing what your cards are worth"). One primary action: /start.
  assert.match(src, /Tell me the cards you&apos;re chasing\./, "the pull-model H1 copy must be present (first person — John, 2026-07-03)");
  assert.doesNotMatch(src, /Stop guessing what your cards are worth/, "the push-model headline must be gone");
  assert.match(src, /href="\/start\?src=home-hero"/, "the primary CTA must link /start with src attribution");
  assert.match(src, /Start your vault/, "the primary CTA copy is 'Start your vault'");
  // The newsletter survives as the ONE email ask on the page (ADR-066), but
  // demoted below the fold — the /start CTA must come first in the document.
  assert.match(src, /<EmailCapture\s+source="homepage_hero"/, "the homepage still renders EmailCapture source=homepage_hero");
  const startIdx = src.indexOf('href="/start?src=home-hero"');
  const captureIdx = src.indexOf('source="homepage_hero"');
  assert.ok(startIdx > -1 && captureIdx > -1, "both the /start CTA and the capture must exist");
  assert.ok(startIdx < captureIdx, "the /start CTA must precede the demoted newsletter capture");
});

test("Homepage: no 'Level-4' / 'TCGplayer Verified Seller' jargon anywhere in the file (homepage-v2, ADR-065)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The insider seller-credential jargon means nothing to a cold visitor; it's
  // replaced by the founder credit. Pin the negative across the whole file
  // (copy + comments) so a refactor can't reintroduce it.
  assert.doesNotMatch(src, /Level-4/i, "'Level-4' jargon must not appear on the homepage");
  assert.doesNotMatch(src, /TCGplayer Verified Seller/i, "'TCGplayer Verified Seller' jargon must not appear on the homepage");
});

test("Site-wide: no 'Level-4 TCGplayer' / 'TCGplayer Verified Seller' jargon under app/ or components/ (email-ask-cleanup, ADR-066)", () => {
  // The insider seller-credential badge means nothing to a cold visitor and is
  // replaced site-wide by the founder presence. Walk every source file and pin
  // the negative so it can't creep back. NOTE: a BARE "TCGplayer seller" (no
  // "Level-N") is a legitimate marketplace term used in blog prose — only the
  // credential badge ("Level-4/Level 4 TCGplayer ..." / "TCGplayer Verified
  // Seller") is forbidden.
  const exts = new Set([".ts", ".tsx", ".mdx"]);
  const offenders: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (exts.has(extname(entry.name))) {
        const src = readFileSync(full, "utf8");
        if (/Level[\s-]?4\s+TCGplayer/i.test(src) || /TCGplayer Verified Seller/i.test(src)) {
          offenders.push(full);
        }
      }
    }
  }
  for (const root of ["app", "components"]) walk(join(ROOT, root));
  assert.deepEqual(offenders, [], `seller-credential jargon found in: ${offenders.join(", ")}`);
});

test("lib/social: no 'Level 4' / 'Level-4' jargon anywhere — the X bot posts publicly (ADR-066)", () => {
  // The daily X content bot (lib/social/*) generates posts that publish to X.
  // The site-wide guard above only scans app/ + components/, so the bot's copy
  // slipped through and shipped "Level-4 TCGplayer seller" (off the ADR-066
  // standard — a bare "TCGplayer seller" is fine, the "Level-4" credential
  // qualifier is not). This guard is STRICTER for lib/social: it fails on ANY
  // "Level 4"/"Level-4" so a public post can never reintroduce the qualifier.
  const exts = new Set([".ts", ".tsx"]);
  const offenders: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (exts.has(extname(entry.name))) {
        if (/Level[\s-]?4\b/i.test(readFileSync(full, "utf8"))) offenders.push(full);
      }
    }
  }
  walk(join(ROOT, "lib", "social"));
  assert.deepEqual(offenders, [], `'Level 4'/'Level-4' jargon found in: ${offenders.join(", ")}`);
});

test("Founder credit: moved OFF the homepage hero (homepage-hero-simplify); the footer keeps the face", () => {
  // History: ADR-065 put the founder byline in the hero as the trust signal;
  // homepage-hero-simplify succeeded it with the X follow widget. The human
  // trust presence lives on in the (site)/layout footer.
  const page = readFile("app/(site)/page.tsx");
  assert.doesNotMatch(page, /founder\/john-craig\.webp/, "no founder headshot in the homepage anymore");
  assert.doesNotMatch(page, /Built by John Craig/, "the hero founder byline is retired");
  const layout = readFile("app/(site)/layout.tsx");
  assert.match(layout, /founder\/john-craig\.webp/, "the footer keeps the founder face");
  const file = join(ROOT, "public/founder/john-craig.webp");
  assert.ok(existsSync(file), "founder headshot must exist at public/founder/john-craig.webp");
  assert.ok(
    !existsSync(join(ROOT, "public/founder/john-craig@512.webp")),
    "the stray john-craig@512.webp must be deleted",
  );
});

test("Hero simplify tripwire: stats chip + hedging CTA are GONE; the follow widget owns the tail (homepage-hero-simplify)", () => {
  const src = readFile("app/(site)/page.tsx");
  const hero = src.slice(src.indexOf("function Hero"), src.indexOf("function VaultMoment"));
  // The chip read like a template flex — the belt IS the proof of coverage.
  assert.doesNotMatch(src, /Live · watching/, "the stats chip must not resurrect");
  assert.doesNotMatch(src, /cards across .* sets/, "no coverage-count copy on the homepage");
  // The hero stops hedging: one decisive CTA (the deals page keeps its nav entry).
  assert.doesNotMatch(hero, /best drops/, "no secondary deals CTA in the hero");
  assert.match(hero, /Start your vault/, "the single CTA stays");
  // The follow loop: one-tap intent, new tab, monochrome official glyph.
  assert.match(src, /https:\/\/x\.com\/intent\/follow\?screen_name=FoilTCG/, "one-tap follow intent URL");
  assert.match(src, /Follow along on X/, "the follow copy (voice: plain words)");
  const widget = src.slice(src.indexOf("x.com/intent/follow"), src.indexOf("Follow along on X"));
  assert.match(widget, /target="_blank"/, "follow opens a new tab");
  assert.match(widget, /rel="noopener noreferrer"/, "noopener on the outbound intent");
  assert.match(src, /function XGlyph/, "the official X mark renders as an inline glyph");
  assert.match(src, /fill-current/, "the glyph is monochrome (currentColor) — never blue, never gold");
  assert.match(src, /const FOLLOW_TRUST_LINE = false/, "option (a) is the committed default; (b) is the one-line flip");
});

test("Homepage: hero has no BackgroundGradientAnimation / corner-shimmer (ADR-038 — solid cream)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Session 47.1 removed the corner-shimmer gradient — it read as a stray
  // amber glow in the bottom-right. The hero must be solid cream with no
  // gradient overlay.
  assert.doesNotMatch(src, /BackgroundGradientAnimation/, "BackgroundGradientAnimation should be gone from the hero");
  assert.doesNotMatch(src, /corner-shimmer/, "corner-shimmer variant should be gone");
});

test("Homepage: hero dropped Card3D + MagneticLink (ADR-037 — static foreground showcase)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Session 47 made the cards a static foreground showcase; the 3D tilt
  // and the magnetic CTA were removed as distracting now that the cards
  // are foreground. Subtle CSS hover lift only.
  assert.doesNotMatch(src, /<Card3D\b/, "Card3D should not wrap the hero cards");
  assert.doesNotMatch(src, /from ["']@\/components\/aceternity\/card-3d["']/, "Card3D import should be gone");
  assert.doesNotMatch(src, /<MagneticLink\b/, "MagneticLink should not be used in the hero");
  assert.doesNotMatch(src, /from ["']@\/components\/aceternity\/magnetic-button["']/, "MagneticLink import should be gone");
});

// ---------------------------------------------------------------------------
// /start form — section headers replace 1/2/3 numbering (ADR-029)
// ---------------------------------------------------------------------------

test("/start form: drops numeric step-numbering (1./2./3.) in favor of named section headers (ADR-029)", () => {
  const src = readFile("components/start-page-form.tsx");
  // The pre-Session-39 form had `1. Type a card name`, `2. Set targets`,
  // `3. Your email`. Section 2 only rendered conditionally, creating a
  // visible 1→3 jump for first-time visitors. The fix drops numbering.
  assert.doesNotMatch(src, />\s*1\.\s*Type\s+a\s+card/);
  assert.doesNotMatch(src, />\s*2\.\s*Set\s+targets/);
  assert.doesNotMatch(src, />\s*3\.\s*Your\s+email/);
});

test("/start form: renders the named section headers (ADR-029)", () => {
  const src = readFile("components/start-page-form.tsx");
  // "Tell me a card" moved into the shared CardTypeahead's default label
  // (ADR-093 extraction); the other two headers stay in the form.
  assert.match(readFile("components/cards/card-typeahead.tsx"), /Tell me a card/);
  assert.match(src, /Set target prices/);
  assert.match(src, /Where to email you/);
});

// ---------------------------------------------------------------------------
// /cards browse + /cards/[slug] — palette anchors
// ---------------------------------------------------------------------------

test("/cards browse: catalog label uses the sakura accent on the night register (blackout-brand Workstream D, was gold ADR-029)", () => {
  const src = readFile("app/(site)/cards/page.tsx");
  // History: text-[#FF6B5C] → text-foil-gold (ADR-029, cream register) →
  // text-foil-accent (blackout-brand Workstream D, night register). Gold is
  // wordmark-only on night surfaces, so the eyebrow now uses the sakura accent.
  assert.match(src, /text-foil-accent/);
  assert.doesNotMatch(src, /foil-gold/);
});

test("/cards/[slug]: best-listing block uses accent border + night panel (design-loop-round2 §3 night register)", () => {
  // The best-listing block moved into the client-hydrated section (ADR-047 v2).
  // Assertions repinned for the night register: accent border + night-2 panel;
  // bg-foil-cream survives only as the light Buy CTA button on dark.
  const src = readFile("components/cards/live-listing-section.tsx");
  assert.match(src, /border-foil-accent\/40/); // design-loop-round2 §3 (night register)
  assert.match(src, /bg-foil-night-2/); // design-loop-round2 §3 (night register)
  // The page's top-level element opts into the night tone.
  assert.match(readFile("app/(site)/cards/[slug]/page.tsx"), /data-tone="night"/); // design-loop-round2 §3 (night register)
  assert.match(readFile("app/(site)/cards/[slug]/page.tsx"), /bg-foil-night/); // design-loop-round2 §3 (night register)
});

test("/cards/[slug]: Buy CTA is the light cream button with accent hover-ring (design-loop-round2 §3 night register)", () => {
  // The Buy CTA moved into the client live-listing section (ADR-047 v2); on the
  // night register the primary button is cream-on-night (homepage hero pattern)
  // with the accent hover-ring replacing the gold one.
  const src = readFile("components/cards/live-listing-section.tsx");
  assert.match(src, /bg-foil-cream[^"']*hover:[^"']*ring-foil-accent/); // design-loop-round2 §3 (night register)
});

// ---------------------------------------------------------------------------
// Cross-cutting — coral is hover-only (defense-in-depth)
// ---------------------------------------------------------------------------

test("Every public surface: bg-foil-coral never appears without the hover: prefix (ADR-029)", () => {
  // The whole point of the cream/navy/gold identity is that coral is a
  // hover state, not a default. If a refactor reintroduces a default
  // bg-foil-coral somewhere, the page reads as the pre-Session-39 SaaS
  // template again — the niche signal collapses.
  for (const rel of PUBLIC_SURFACES) {
    const src = readFile(rel);
    // Look for every occurrence of `bg-foil-coral` and check that each
    // is preceded by `hover:` within 8 characters.
    const re = /(\S*)bg-foil-coral/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const lead = m[1] ?? "";
      assert.ok(
        lead.endsWith("hover:") || lead.endsWith("group-hover:"),
        `bg-foil-coral without hover: prefix in ${rel} — context "${src.slice(Math.max(0, m.index - 12), m.index + 14)}"`,
      );
    }
  }
});

test("Every public surface: ring-foil-coral never appears without the hover: prefix (ADR-029)", () => {
  for (const rel of PUBLIC_SURFACES) {
    const src = readFile(rel);
    const re = /(\S*)ring-foil-coral/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const lead = m[1] ?? "";
      assert.ok(
        lead.endsWith("hover:") || lead.endsWith("group-hover:"),
        `ring-foil-coral without hover: prefix in ${rel}`,
      );
    }
  }
});

test("Every public surface: no raw #FF6B5C hex literal — use the foil-coral token instead (ADR-029)", () => {
  // The migration replaced every hardcoded `#FF6B5C` (and its sibling
  // `#FF8775`) with the `foil-coral` Tailwind token. A raw hex literal
  // surviving in code means someone copy-pasted from the old palette.
  for (const rel of PUBLIC_SURFACES) {
    const src = readFile(rel);
    assert.doesNotMatch(src, /#FF6B5C/i, `raw #FF6B5C hex in ${rel} — use bg-foil-coral / hover:bg-foil-coral`);
    assert.doesNotMatch(src, /#FF8775/i, `raw #FF8775 hex in ${rel} — pre-Session-39 darker-coral hover, drop it`);
    assert.doesNotMatch(src, /#0B1428/i, `raw #0B1428 hex in ${rel} — pre-Session-39 deep-navy bg, use bg-foil-navy or bg-foil-cream`);
    assert.doesNotMatch(src, /#101D38/i, `raw #101D38 hex in ${rel} — pre-Session-39 lighter-dark bg, use bg-foil-cream`);
  }
});

// ---------------------------------------------------------------------------
// Session 42 / ADR-031 — MDX components don't drift back to dark-mode tokens.
// ---------------------------------------------------------------------------

test("MDX components: no text-white / text-zinc-* / bg-white/<n> on text-bearing nodes", () => {
  const src = readFile("mdx-components.tsx");
  // The Session-39 sweep missed mdx-components.tsx. The "Heads up"
  // callout was rendering text-amber-100 on bg-amber-500/5 — light-on-
  // light = invisible against the new cream surface. Pin the negative.
  assert.doesNotMatch(src, /text-white\b/, "text-white in mdx-components.tsx — should be text-foil-navy");
  assert.doesNotMatch(src, /text-zinc-\d+/, "text-zinc-* in mdx-components.tsx — should be text-foil-navy / text-foil-slate");
  assert.doesNotMatch(src, /text-zinc-100\/\d+/, "text-zinc-100/<opacity> in mdx-components.tsx — pre-cream leftover");
  assert.doesNotMatch(src, /text-sky-\d+/, "text-sky-* (pre-cream info palette)");
  assert.doesNotMatch(src, /text-amber-\d+/, "text-amber-* (pre-cream warning palette)");
  assert.doesNotMatch(src, /text-emerald-\d+/, "text-emerald-* (pre-cream tip palette)");
});

test("Callout: all three variants ship the cream/navy palette + a foil-* label", () => {
  const src = readFile("mdx-components.tsx");
  // CALLOUT_STYLES must declare info + warning + tip and each must use
  // foil-* tokens for wrap + label. Pin by structural anchors.
  assert.match(src, /info\s*:\s*\{[\s\S]*?wrap:\s*["'][^"']*foil-(?:cream|navy|gold)/);
  assert.match(src, /warning\s*:\s*\{[\s\S]*?wrap:\s*["'][^"']*foil-(?:cream|navy|gold)/);
  assert.match(src, /tip\s*:\s*\{[\s\S]*?wrap:\s*["'][^"']*foil-(?:cream|gold)/);
  // Body text wrapper must be foil-navy (not the pre-cream text-zinc-100/90).
  assert.match(src, /<div className="text-foil-navy/);
});

test("FAQ component: heading + question + answer all use foil-* tokens", () => {
  const src = readFile("mdx-components.tsx");
  // Question: text-foil-navy. Answer: text-foil-navy/85 (per spec for readability contrast).
  assert.match(src, /<h3[^>]*text-foil-navy[^>]*>\{q\.question\}<\/h3>/);
  assert.match(src, /<p[^>]*text-foil-navy\/85[^>]*>\{q\.answer\}<\/p>/);
});

test("MDX pre/code overrides match the prose-* cream styling (no drift)", () => {
  const src = readFile("mdx-components.tsx");
  // The MDX <pre> override SHADOWS the prose-pre chain. If they disagree
  // the rendered code block looks different from what blog/[slug] specs.
  // Both should be navy bg + cream text.
  assert.match(src, /<pre[\s\S]*?bg-foil-navy[\s\S]*?text-foil-cream/);
  // Inline code: navy/10 bg + navy text matches prose-code:bg-foil-navy/10 prose-code:text-foil-navy.
  assert.match(src, /<code[\s\S]*?bg-foil-navy\/10[\s\S]*?text-foil-navy/);
});

test("CardScannerEmbed + TopicLink: cream palette, no pre-cream coral defaults", () => {
  const src = readFile("mdx-components.tsx");
  // CardScannerEmbed CTA: navy bg + cream text + gold-ring on hover.
  assert.match(src, /CardScannerEmbed[\s\S]*?bg-foil-navy[\s\S]*?text-foil-cream/);
  // TopicLink anchor: navy text, gold underline, coral on hover.
  assert.match(src, /TopicLink[\s\S]*?text-foil-navy[\s\S]*?decoration-foil-gold[\s\S]*?hover:text-foil-coral/);
});

// ---------------------------------------------------------------------------
// ADR-094 — Brand mark: the hanko seal + "Foil" wordmark (Bricolage).
// ---------------------------------------------------------------------------

test("Logo component: hanko seal mark, vermillion + cream knockout, zero Pokéball/foil-corner geometry (ADR-094)", () => {
  const src = readFile("components/brand/logo.tsx");
  // ADR-094 supersedes the foil-corner card (ADR-055) with the vermillion
  // carved seal: a card slotting into a pocket, knocked out in cream.
  assert.match(src, /function SealMark/, "SealMark must exist");
  assert.doesNotMatch(src, /function PokeballMark/, "PokeballMark must be gone");
  assert.doesNotMatch(src, /#e63946/i, "the Pokémon red must be gone");
  assert.doesNotMatch(src, /M 17 4 L 26 13/, "the retired foil-corner fold path must be gone");
  assert.match(src, /#D85A30/i, "hanko vermillion seal");
  assert.match(src, /#f8f5f0/i, "cream knockout");
  assert.match(src, /variant === "mono"/, "a single-ink navy monochrome variant exists");
  assert.doesNotMatch(src, /#c9a24b/i, "the retired gold must be gone from the mark");
});

test("Logo component: 'Foil' + metallic gold 'TCG' lockup (blackout-brand, deliberately reverses the ADR-094 TCG drop)", () => {
  const src = readFile("components/brand/logo.tsx");
  assert.match(src, /font-wordmark/, "wordmark uses the font-wordmark utility");
  assert.match(src, /aria-label="FoilTCG home"/, "accessible name matches the visible lockup (no em dash — Gate 12)");
  assert.match(src, /text-foil-navy/, "onCream tone: navy 'Foil'");
  assert.match(src, /text-foil-cream/, "onNavy tone: cream 'Foil'");
  assert.match(src, />\s*Foil\s*<\/span>/, "'Foil' word");
  assert.match(src, /wordmark-tcg/, "'TCG' renders through the metallic gold ramp class");
  assert.match(src, />\s*TCG\s*</, "'TCG' is back in the display wordmark (John's 2026-07-03 verdict)");
  // TCG must read as the SAME font cut as 'Foil' (John, 2026-07-04): its span
  // inherits the lockup face + weight, never forces its own family or bold —
  // the old font-wordmark override made it Bricolage next to the Shrikhand
  // bubble 'Foil' in the chrome, a visibly different, thinner typeface.
  const tcgSpan = src.match(/wordmark-tcg[^"]*/)?.[0] ?? "";
  assert.doesNotMatch(tcgSpan, /font-wordmark|font-bold/, "'TCG' inherits the lockup face + weight, never forces its own");
});

test("Wordmark gold: #856a00-anchored metallic ramp with solid fallback; hover sheen reduced-motion gated (blackout-brand)", () => {
  const css = readFile("app/globals.css");
  assert.match(css, /--color-foil-gold-anchor:\s*#856a00/i, "the real-gold anchor token exists");
  assert.match(css, /\.wordmark-tcg\s*\{\s*[^}]*var\(--color-foil-gold-anchor\)/, "solid gold fallback outside @supports");
  assert.match(css, /background-clip:\s*text/, "the metallic ramp clips to the glyphs");
  assert.match(css, /#f4e3a1/i, "the specular highlight stop exists (metallic, not flat)");
  // The sheen sweep must be inside the reduced-motion no-preference gate.
  const sheenIdx = css.indexOf("transition: background-position");
  const gateIdx = css.lastIndexOf("prefers-reduced-motion: no-preference", sheenIdx);
  assert.ok(sheenIdx > -1 && gateIdx > -1, "hover sheen exists and sits behind the motion gate");
});

test("Wordmark font Bricolage Grotesque is pinned + exposed as font-wordmark (ADR-094)", () => {
  const layout = readFile("app/layout.tsx");
  assert.match(layout, /Bricolage_Grotesque/, "layout imports Bricolage Grotesque");
  assert.doesNotMatch(layout, /Fredoka\(/, "Fredoka is no longer loaded");
  assert.match(layout, /variable:\s*["']--font-wordmark["']/, "Bricolage backs the --font-wordmark var");
  const css = readFile("app/globals.css");
  assert.match(css, /--font-wordmark:\s*var\(--font-wordmark\)/, "the font-wordmark utility token exists");
});

test("Brand assets: favicon + icon are the petal-on-charcoal; OG runs the shared Shrikhand block (brand-og-unification, supersedes the ADR-094 seal pins)", () => {
  const fav = readFile("public/favicon.svg");
  assert.doesNotMatch(fav, /#e63946/i, "favicon must not be the red Pokéball");
  assert.doesNotMatch(fav, /#D85A30/i, "the retired vermillion seal is gone from the favicon");
  assert.match(fav, /#0d0d0e/i, "favicon ground is the charcoal");
  assert.match(fav, /#d98aa0/i, "favicon glyph is the sakura petal");
  assert.doesNotMatch(fav, /M 17 4 L 26 13/, "the retired foil-corner fold path is gone");
  const icon = readFile("public/icon.svg");
  assert.doesNotMatch(icon, /#D85A30/i, "the retired seal is gone from icon.svg");
  assert.match(icon, /#d98aa0/i, "icon.svg carries the petal glyph");
  assert.doesNotMatch(icon, /<text/, "no font-dependent <text> in icon contexts (never rendered reliably)");
  assert.doesNotMatch(icon, /TCG<\/(?:text|tspan)>/, "no 'TCG' rendered in the icon");
  const og = readFile("app/opengraph-image.tsx");
  assert.doesNotMatch(og, /#FF6B5C/i, "OG must not use the retired coral");
  assert.match(og, /OgWordmark/, "OG renders the shared Shrikhand wordmark block");
  assert.doesNotMatch(og, /#D85A30/i, "the retired seal ink is gone from the OG");
  const manifest = readFile("app/manifest.ts");
  assert.match(manifest, /theme_color: "#0d0d0e"/, "manifest theme is the charcoal ground");
});

test("Site header: uses the <Logo /> brand component (ADR-032)", () => {
  const src = readFile("app/(site)/layout.tsx");
  // The pre-Session-43 header inlined a gold round dot (h-2 w-2 rounded-full
  // bg-foil-gold). The fix replaces it with the <Logo /> component so
  // every brand surface picks up the same glyph + sizing ladder.
  assert.match(src, /import\s*\{\s*Logo\s*\}\s*from\s*["']@\/components\/brand\/logo["']/);
  assert.match(src, /<Logo\s+size=["']md["']/);
});

// ---------------------------------------------------------------------------
// Session 43 / ADR-033 — Hero card backdrop treatment.
// ---------------------------------------------------------------------------

test("Hero: grail cards are a full-opacity foreground showcase, not a ghosted backdrop (ADR-037)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Session 47 / ADR-037 moved the cards ABOVE the headline at full
  // opacity — no opacity ghosting, no blur, no desaturation. Pin the
  // removal of the ADR-036 backdrop treatment so a refactor can't
  // re-ghost the showcase.
  assert.doesNotMatch(src, /opacity:\s*0\.(?:28|5)\b/, "hero cards must not be opacity-ghosted");
  assert.doesNotMatch(src, /filter:\s*["']blur\(/, "hero cards must not be blurred");
  // Cards render large as the hero visual — the light sources of the night
  // register. Since hero-fan-widescreen-fix the lg widths are fluid (the
  // focal's 15rem base scales with --fan-s above 1440px).
  assert.match(src, /lg:w-\[calc\(15rem\*var\(--fan-s,1\)\)\]/);
});

test("Hero: the copy-area scrim is gone (ADR-037 — cards no longer overlap text)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Cards sit above the headline now, so there's nothing to scrim. Pin
  // the removal of every prior scrim form.
  assert.doesNotMatch(src, /via-foil-cream\/88/, "the ADR-036 mobile scrim should be gone");
  assert.doesNotMatch(src, /linear-gradient\(to_right,var\(--color-foil-cream\)/, "the ADR-036 desktop scrim should be gone");
  assert.doesNotMatch(src, /radial-gradient\(ellipse_at_top_left/, "the ADR-033 radial scrim should be gone");
});

test("Hero: HERO_CARDS is the 7-card modern-grail seed list (ADR-033; Rayquaza removed by hero-polish-followups)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Pin the 7 grail IDs so a future "let's freshen the hero" refactor
  // doesn't silently drop the moonbreon/charizard-rainbow signal that
  // anchors the launch surface.
  for (const id of [
    "swsh7/215",
    "swsh35/74",
    "swsh11/186",
    "swsh12/186",
    "swsh8/269",
    "swsh4/188",
    "base1/4",
  ]) {
    assert.match(src, new RegExp(id.replace("/", "\\/")), `HERO_CARDS missing ${id}`);
  }
  // Rayquaza VMAX was REMOVED (John, 2026-07-03): as the 4th right-wing card
  // it rendered as a sliver behind Giratina — 7 cards compose, 3 per wing.
  const heroBlock = src.slice(src.indexOf("const HERO_CARDS"), src.indexOf("];", src.indexOf("const HERO_CARDS")));
  assert.doesNotMatch(heroBlock, /swsh7\/218/, "the tucked Rayquaza must stay out of the fan");
});

// ---------------------------------------------------------------------------
// Session 46 / ADR-036 — home page warmth pass.
// ---------------------------------------------------------------------------

test("Home page: Founding Member pricing section removed (ADR-036, deferred per ADR-020)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The pricing section was always deferred until the newsletter crosses
  // ~100 subs (ADR-020). Session 46 removed it entirely; pin the negative
  // so a refactor doesn't reintroduce a price the product can't take yet.
  assert.doesNotMatch(src, /FoundingMember/, "FoundingMember component should be gone");
  assert.doesNotMatch(src, /Founding Member/, "Founding Member copy should be gone");
  assert.doesNotMatch(src, /\$59/, "the $59 price should be gone from the home page");
  assert.doesNotMatch(src, /Lock in lifetime/, "the lifetime CTA should be gone");
});

test("Home page: orphan CardPeek decorations removed (ADR-038)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Session 47.1 deleted both floating card peek-throughs (flagged as
  // "weird cards in the background"). Component + invocations all gone.
  assert.doesNotMatch(src, /CardPeek/, "CardPeek (component + invocations) should be gone");
});

test("Hero: seal-free and pill-free (hero-polish-followups closed the seal class; homepage-hero-simplify removed the chip)", () => {
  const src = readFile("app/(site)/page.tsx");
  // History: ADR-094's Live pill carried <SealMark /> + a pulse dot; the seal
  // died with hero-polish-followups and the whole chip died with
  // homepage-hero-simplify. Neither returns.
  assert.doesNotMatch(src, /<SealMark\b/, "the seal mark is retired from the homepage");
  assert.doesNotMatch(src, /<PokeballMark\b/, "no PokeballMark bullets remain");
});

test("Display font is Fraunces with the SOFT warmth axis; Bricolage is the wordmark cut (ADR-036/094)", () => {
  const layout = readFile("app/layout.tsx");
  assert.match(layout, /Fraunces/, "layout must import Fraunces");
  // Bricolage is back (ADR-094) but as the WORDMARK cut, not the display font —
  // Fraunces still backs --font-display, Bricolage backs --font-wordmark.
  assert.match(layout, /Fraunces\([\s\S]*?variable:\s*["']--font-display["']/, "Fraunces backs --font-display");
  assert.match(layout, /Bricolage_Grotesque\([\s\S]*?variable:\s*["']--font-wordmark["']/, "Bricolage backs --font-wordmark");
  const css = readFile("app/globals.css");
  // The SOFT axis (no wght set, so font-weight utilities still compose).
  assert.match(css, /font-variation-settings:\s*["']SOFT["']\s+30/);
});

// ---------------------------------------------------------------------------
// Session 47 / ADR-037 — hero rework + floral section distinction.
// ---------------------------------------------------------------------------

test("Hero: the grail showcase renders ABOVE the H1 (ADR-037)", () => {
  const src = readFile("app/(site)/page.tsx");
  const cardsIdx = src.search(/HERO_CARDS\.map/);
  const h1Idx = src.search(/<h1\b/);
  assert.ok(cardsIdx > -1 && h1Idx > -1, "both the card map and the H1 must exist");
  assert.ok(cardsIdx < h1Idx, "the HERO_CARDS showcase must render before the H1");
});

test("Homepage: the tiled seal watermark is DEAD — no wallpaper texture anywhere (John's 2026-07-02 verdict: cheap wallpaper)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The tiled hanko-seal background (ex-FoilCornerPattern, ex-PokeballPattern)
  // read as cheap wallpaper. Depth is structural (light, planes, tilt), never
  // an applied texture. Pin every prior wallpaper form dead.
  assert.doesNotMatch(src, /function PokeballPattern/, "PokeballPattern should be gone");
  assert.doesNotMatch(src, /foil-pokeball/, "the Pokeball pattern id should be gone");
  assert.doesNotMatch(src, /#e63946/i, "no Pokémon red");
  assert.doesNotMatch(src, /FoilCornerPattern/, "the tiled seal watermark component must be gone");
  assert.doesNotMatch(src, /<pattern\b/, "no SVG <pattern> tile on the homepage");
  assert.doesNotMatch(src, /patternUnits/, "no tiled background pattern of any kind");
});

test("Homepage hero images are self-hosted local webp that exist, no flaky external CDN (ADR-056)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The hero must NOT depend on images.pokemontcg.io (it intermittently rendered
  // the row as broken images in prod). Local /hero/*.webp only.
  assert.doesNotMatch(src, /https:\/\/images\.pokemontcg\.io/, "hero must not fetch from the external SDK CDN");
  assert.match(src, /\/hero\/\$\{c\.id\.replace\("\/", "-"\)\}\.webp/, "hero src must be a local /hero/*.webp path");
  // Every HERO_CARDS id must have a real file in public/hero/ — no broken
  // refs. Scope the extraction to the HERO_CARDS block: VAULT_POCKETS ids
  // live in /binder and are checked by their own guard (binder-aesthetic-pass).
  const heroBlock = src.slice(src.indexOf("const HERO_CARDS"), src.indexOf("];", src.indexOf("const HERO_CARDS")));
  const ids = [...heroBlock.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length === 7, `expected exactly 7 HERO_CARDS ids (hero-polish-followups), found ${ids.length}`);
  for (const id of ids) {
    const file = join(ROOT, "public/hero", `${id.replace("/", "-")}.webp`);
    assert.ok(existsSync(file), `missing self-hosted hero image: public/hero/${id.replace("/", "-")}.webp`);
  }
});

// ---------------------------------------------------------------------------
// fix-hero-image-loading — the above-the-fold hero + founder load EAGERLY.
// The lazy default (`priority={false}` on the hero, no priority on the founder)
// deferred all 8 hero cards + the founder avatar in prod, painting the hero
// BLANK on first load. Next 16 deprecated `priority`; the fix is the documented
// above-the-fold pattern `loading="eager"` + `fetchPriority="high"`. These are
// STRUCTURAL pins so a refactor can't silently re-lazy the hero — they do NOT
// prove the pixels render (the original bug was invisible to markup tests; that's
// what the live/screenshot verification is for, per the goal + design-review-loop).
// ---------------------------------------------------------------------------

/** Isolate the single <Image …/> block that contains `needle`. */
function imageBlockContaining(src: string, needle: string): string {
  const at = src.indexOf(needle);
  assert.ok(at > -1, `expected to find ${needle} in the homepage`);
  const start = src.lastIndexOf("<Image", at);
  const end = src.indexOf("/>", at);
  assert.ok(start > -1 && end > -1, `could not isolate the <Image> block around ${needle}`);
  return src.slice(start, end + 2);
}

test("Hero showcase: the grail cards load eagerly through HoloCard, never lazy (blank-on-paint regression)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The hero cards now render through HoloCard (the holo-tilt signature).
  // The page must pass `eager`, and HoloCard must translate that into the
  // documented above-the-fold pattern (loading="eager" + fetchPriority="high").
  const at = src.indexOf("/hero/${c.id");
  assert.ok(at > -1, "the hero card src expression must exist");
  const start = src.lastIndexOf("<HoloCard", at);
  const end = src.indexOf("/>", at);
  assert.ok(start > -1 && end > -1, "could not isolate the <HoloCard> block");
  const block = src.slice(start, end + 2);
  assert.match(block, /\beager\b/, "hero HoloCards must receive the eager flag");
  const holo = readFile("components/cards/holo-card.tsx");
  assert.match(holo, /loading=\{eager \? "eager" : "lazy"\}/, "HoloCard maps eager → loading=eager");
  assert.match(holo, /fetchPriority=\{eager \? "high" : undefined\}/, "HoloCard maps eager → fetchPriority=high");
});

// ---------------------------------------------------------------------------
// overnight-design-loop — night register + holo-tilt + scroll-reveal guards.
// ---------------------------------------------------------------------------

test("Night register: the tone mechanism exists — tokens + body:has() chrome flip (overnight-design-loop)", () => {
  // Whether the homepage opts in (dark direction) is a DIVERGE-phase choice;
  // the MECHANISM must exist and stay coherent either way. The winner's
  // homepage opt-in state gets pinned at CONVERGE.
  const css = readFile("app/globals.css");
  // pre-send-coherence §1: the ground is neutral matte CHARCOAL (zero blue
  // cast), superseding the navy-derived night hexes.
  assert.match(css, /--color-foil-night:\s*#0d0d0e/i, "the charcoal ground token exists");
  assert.match(css, /--color-foil-night-2:\s*#17171a/i, "the charcoal elevated token exists");
  assert.match(css, /--color-foil-vermillion:\s*#d85a30/i, "the vermillion (hanko ink) token exists");
  // pre-send-coherence §2 / ADR-097: sakura succeeds teal as THE accent pair —
  // the same hue family on both tones (/lines sets the standard). Teal retired.
  assert.match(css, /--color-foil-accent:\s*#d98aa0/i, "the accent IS the /lines sakura on dark");
  assert.match(css, /--color-foil-accent-deep:\s*#a5546e/i, "the deep sakura sibling for cream");
  assert.doesNotMatch(css, /#6fd8c5|#0e7c6b/i, "the retired teal hexes must be gone");
  assert.match(css, /body:has\(\[data-tone="night"\]\)/, "the chrome flips via body:has(), no layout fork");
  const layout = readFile("app/(site)/layout.tsx");
  assert.match(layout, /var\(--chrome-bg\)/, "the header reads the chrome tone variables");
  assert.match(layout, /var\(--chrome-surface\)/, "the shell reads the chrome surface variable");
});

test("Hero fan + vault pockets: every card is a slug-verified link to its card page (pre-send-coherence §4)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The fan resolves slugs from the catalog (null over guess — never a 404
  // promise) and each linked card carries the a11y contract.
  assert.match(src, /function cardSlug\(/, "the catalog slug lookup must exist");
  assert.match(src, /href=\{`\/cards\/\$\{slug\}`\}/, "fan/pocket cards must link /cards/[slug]");
  assert.match(src, /sold prices and live listings/, "linked cards carry the aria-label contract");
  assert.match(src, /focus-visible:ring-2 focus-visible:ring-foil-accent/, "linked cards get the accent focus ring");
  // The fan container is no longer aria-hidden (links must be reachable).
  const fanIdx = src.indexOf("HERO_CARDS.map");
  const heroBlock = src.slice(src.indexOf("function Hero"), fanIdx);
  assert.doesNotMatch(heroBlock.slice(heroBlock.lastIndexOf("<div")), /aria-hidden/, "the fan wrapper must not be aria-hidden");
});

test("Hero fan: fluid widescreen composition derives from clamped vars, sub-1440 pinned (hero-fan-widescreen-fix)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The three fluid vars exist as tan(atan2()) NUMBER factors that stay 1 at
  // ≤1440px — that floor is what pins 1024–1440 byte-identical to the tuned
  // composition (and below lg the fluid tier never applies at all). The
  // naive `1 + (100vw - X)/N` form is TYPE-INVALID CSS (number + length):
  // it computes to garbage and unsets every dependent declaration — the
  // giant-flat-naturals failure iter-1 caught. Don't reintroduce it.
  assert.match(src, /"--fan-s": "calc\(1 \+ [\d.]+ \* clamp\(0, tan\(atan2\(100vw - 1440px,/, "--fan-s: unitless tan(atan2) factor from 1440px");
  assert.match(src, /"--fan-w": "calc\(1 \+ [\d.]+ \* clamp\(0, tan\(atan2\(100vw - 1440px,/, "--fan-w: unitless tan(atan2) factor from 1440px");
  assert.match(src, /"--fan-r": "calc\(1 \+ \(var\(--fan-w, 1\) - 1\)/, "--fan-r rides --fan-w damped");
  // The sub-lg width ladder is untouched (the tuned sub-1440 composition),
  // and every consumer carries the `,1` fallback (old browsers degrade to
  // the 1440 composition, never to unset widths).
  assert.match(src, /w-32 sm:w-40 md:w-48 lg:w-\[calc\(15rem\*var\(--fan-s,1\)\)\]/, "focal width ladder + fluid lg");
  assert.match(src, /w-\[6\.5rem\] sm:w-32 md:w-\[9\.5rem\] lg:w-\[calc\(11rem\*var\(--fan-s,1\)\)\]/, "depth-1 ladder + fluid lg");
  assert.match(src, /w-24 sm:w-28 md:w-32 lg:w-\[calc\(10rem\*var\(--fan-s,1\)\)\]/, "depth-2 ladder + fluid lg");
  assert.match(src, /w-20 sm:w-24 md:w-28 lg:w-\[calc\(8\.5rem\*var\(--fan-s,1\)\)\]/, "depth-3 ladder + fluid lg");
  assert.doesNotMatch(src, /var\(--fan-[swr]\)/, "every --fan-* consumer must carry the ,1 fallback");
  // Overlap, arc, and rotation all derive from the same vars at lg (scale,
  // spread, cadence move together — the composition invariants).
  assert.match(src, /-ml-9 sm:-ml-10 md:-ml-12 lg:ml-\[calc\(-3rem\*var\(--fan-s,1\)\)\]/, "overlap scales with --fan-s");
  assert.match(src, /lg:translate-y-\[calc\(2\.5rem\*var\(--fan-w,1\)\)\]/, "arc amplitude scales with --fan-w");
  assert.match(src, /lg:rotate-\[calc\(-12deg\*var\(--fan-r,1\)\)\]/, "rotation cadence scales with --fan-r");
  // The fan container grows with the fan (no fixed max-w-6xl cage) and the
  // edge-dissolve mask stays.
  assert.match(src, /max-w-\[calc\(72rem\*var\(--fan-s,1\)\)\]/, "container max-width derives from --fan-s");
  assert.match(src, /mask-image:linear-gradient\(90deg,transparent,black_10%,black_90%,transparent\)/, "edge dissolve mask intact");
});

test("RETIRED-ASSET TRIPWIRE (UI scope): the seal/pocket mark is dead in every app/components surface (hero-polish-followups, extends ADR-099)", () => {
  // ADR-099 killed the seal on OG/meta surfaces; the alert mock proved the
  // class was still open in page components. Close it: NO file under app/ or
  // components/ may reference the retired seal/pocket mark — except its
  // definition site (components/brand/logo.tsx, kept so `Logo withMark`
  // call sites type-check; the header/footer render withMark={false}).
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(rel);
      return e.name.endsWith(".tsx") || e.name.endsWith(".ts") ? [rel] : [];
    });
  const files = [...walk("app"), ...walk("components")].filter(
    (f) => f !== "components/brand/logo.tsx",
  );
  for (const rel of files) {
    const src = readFile(rel);
    assert.doesNotMatch(src, /SealMark|FoilCornerMark/, `${rel}: retired seal mark reference`);
    assert.doesNotMatch(src, /SEAL_VERMILLION|#d85a30/i, `${rel}: retired seal ink reference`);
  }
});

test("Alert mock: figures DERIVE from the sold snapshot — no hand-written dollars (hero-polish-followups)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The mock reads the same committed sold basis the vault/lines surfaces
  // use, and computes the example listing at the ADR-091 market floor.
  assert.match(src, /import \{ getSnapshotSold \} from "@\/lib\/vault-seeds"/, "mock must import the snapshot reader");
  assert.match(src, /const MOCK_ALERT_SLUG = "swsh7-215-umbreon-vmax-alt-art"/, "featured card pinned to a snapshot-backed slug");
  assert.match(src, /getSnapshotSold\(MOCK_ALERT_SLUG\)/, "figures come from the data path");
  assert.match(src, /soldCents \* 0\.85/, "example listing computed at the ADR-091 market floor (15% under)");
  // No $<digit> literal anywhere in the SampleAlert component — a rebrand or
  // copy edit can't quietly reintroduce invented figures.
  const mockBlock = src.slice(src.indexOf("function SampleAlert"), src.indexOf("function NewsletterBand"));
  assert.doesNotMatch(mockBlock, /\$\d/, "no hand-written dollar figures in the alert mock");
  // And the data actually resolves at build time: the snapshot carries a
  // non-zero sold basis for the featured slug (data-level, I-010 discipline).
  const snapshot = JSON.parse(readFile("lib/lines/sold-snapshot.generated.json")) as {
    cards?: Record<string, { soldCents?: number }>;
  };
  const entry = snapshot.cards?.["swsh7-215-umbreon-vmax-alt-art"];
  assert.ok((entry?.soldCents ?? 0) > 0, "the featured mock card must have real sold data in the committed snapshot");
});

test("Vault pockets: the SV-151 starter evolution lines in order, self-hosted art (binder-aesthetic-pass)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The sequencing IS the aesthetic: Bulbasaur→Venusaur ex, Charmander→
  // Charizard ex, Squirtle→Blastoise ex — pinned in evolution order.
  const order = ["sv3pt5/166", "sv3pt5/167", "sv3pt5/198", "sv3pt5/168", "sv3pt5/169", "sv3pt5/199", "sv3pt5/170", "sv3pt5/171", "sv3pt5/200"];
  let at = src.indexOf("VAULT_POCKETS");
  for (const id of order) {
    const next = src.indexOf(`"${id}"`, at);
    assert.ok(next > -1, `pocket ${id} present and in evolution order`);
    at = next;
  }
  // Self-hosted pocket art (ADR-056 rationale) — every file must exist.
  assert.match(src, /\/binder\/\$\{p\.id\.replace\("\/", "-"\)\}\.webp/, "pockets render local /binder art");
  for (const id of order) {
    assert.ok(existsSync(join(ROOT, "public/binder", `${id.replace("/", "-")}.webp`)), `missing public/binder/${id.replace("/", "-")}.webp`);
  }
});

test("Sakura ambience: deterministic, motion-safe, layered — mounted on home + /deals + vault (binder-aesthetic-pass)", () => {
  const amb = readFile("components/sakura-ambience.tsx");
  const petals = readFile("components/lines/sakura-petals.tsx");
  const shapes = readFile("components/lines/petal-shapes.ts");
  // Call-form match — the files' own "no Math.random" comments must not trip.
  for (const [name, src] of [["sakura-ambience", amb], ["sakura-petals", petals], ["petal-shapes", shapes]] as const) {
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${name}: petal specs are deterministic (seeded builder only)`);
  }
  assert.match(petals, /motion-safe:animate-\[sakura-fall/, "fall is motion-safe gated");
  assert.match(petals, /motion-safe:animate-\[sakura-sway/, "sway is motion-safe gated");
  assert.match(petals, /blur-\[1px\]/, "the far depth layer blurs (1px — the 2px original cost ~5fps at 4x throttle)");
  assert.match(amb, /pointer-events-none/, "ambience petals never intercept input");
  assert.match(petals, /pointer-events-none/, "/lines petals never intercept input");
  assert.match(readFile("app/(site)/page.tsx"), /<SakuraAmbience mode="night"/, "homepage mounts the night ambience");
  assert.match(readFile("app/(site)/deals/page.tsx"), /<SakuraAmbience mode="header"/, "/deals mounts the header ambience");
  assert.match(readFile("app/(site)/w/[token]/page.tsx"), /<SakuraAmbience mode="header"/, "the vault mounts the header ambience");
});

test("Petal fidelity: one shape source of truth + density ladder + min size (petal-fidelity-pass)", () => {
  const shapes = readFile("components/lines/petal-shapes.ts");
  const petals = readFile("components/lines/sakura-petals.tsx");
  const amb = readFile("components/sakura-ambience.tsx");

  // Canonical geometry: the classic notched-teardrop + blossom petal paths.
  const classic = shapes.match(/classic:\s*\n?\s*"(M[^"]+)"/)?.[1];
  const curl = shapes.match(/curl:\s*"(M[^"]+)"/)?.[1];
  const slender = shapes.match(/slender:\s*\n?\s*"(M[^"]+)"/)?.[1];
  const blossom = shapes.match(/BLOSSOM_PETAL_PATH\s*=\s*\n?\s*"(M[^"]+)"/)?.[1];
  assert.ok(classic && curl && slender && blossom, "petal-shapes.ts exports the three petal paths + blossom petal");

  // Every petal consumer derives from the ONE module — never a second
  // implementation again (the pre-pass state was THREE: the React path, a
  // border-radius blob in the lines OG, and a stale path in the favicon).
  assert.match(petals, /from "\.\/petal-shapes"/, "sakura-petals renders the shared shapes");
  assert.match(amb, /from "\.\/lines\/petal-shapes"/, "sakura-ambience builds fields from the shared module");
  assert.match(
    readFile("app/(site)/lines/[pokemon]/opengraph-image.tsx"),
    /petalMarkup.*from "@\/components\/lines\/petal-shapes"|from "@\/components\/lines\/petal-shapes"/,
    "the lines OG renders shared-shape petals (no border-radius blobs)",
  );
  assert.doesNotMatch(readFile("app/(site)/lines/[pokemon]/opengraph-image.tsx"), /borderRadius: "70% 30%/, "the OG blob petal is retired");
  for (const asset of ["public/favicon.svg", "public/icon.svg"]) {
    assert.ok(readFile(asset).includes(classic), `${asset} carries the canonical classic petal path`);
  }
  // The banner artifact carries ONE synced copy of the geometry (it can't
  // import TS) — byte-identical or this trips.
  const banner = readFile("design-loop/banner/banner.html");
  for (const [label, p] of [["classic", classic], ["curl", curl], ["slender", slender], ["blossom", blossom]] as const) {
    assert.ok(banner.includes(p!), `banner.html ${label} path is byte-synced to petal-shapes.ts`);
  }

  // Min rendered size: below ~9px a petal is a dot, whatever the geometry.
  assert.match(shapes, /MIN_PETAL_PX = 9/, "the 9px floor is pinned");
  assert.match(petals, /Math\.max\(size, MIN_PETAL_PX\)/, "the Petal component enforces the floor");
  assert.match(shapes, /Math\.max\(Math\.round\(lerp\(rand\(\), zone\.size\)\), MIN_PETAL_PX\)/, "the field builder enforces the floor");

  // Density ladder (petal-fidelity-pass: 3x, ladder preserved):
  // /lines 78 (flagship) > homepage 48 > headers 30.
  const sumCounts = (src: string, constName: string) => {
    const block = src.slice(src.indexOf(constName), src.indexOf("];", src.indexOf(constName)));
    return (block.match(/count: (\d+)/g) ?? []).reduce((a, m) => a + Number(m.slice(7)), 0);
  };
  assert.equal(sumCounts(petals, "LINES_ZONES"), 84, "/lines runs 84 petals (full 3x — the quantized-keyframe fix paid for it)");
  assert.equal(sumCounts(amb, "NIGHT_ZONES"), 48, "homepage runs 48 petals (3x the pre-pass 16)");
  assert.equal(sumCounts(amb, "HEADER_ZONES"), 30, "headers run 30 petals (3x the pre-pass 9-10)");
  // Headers keep a small SHARP minority — a far-only field on charcoal reads
  // as smudges (the pink-dot bug); five near petals anchor the motif.
  const headerBlock = amb.slice(amb.indexOf("HEADER_ZONES"), amb.indexOf("];", amb.indexOf("HEADER_ZONES")));
  assert.match(headerBlock, /layer: "near"/, "headers carry a sharp anchor minority");

  // Blossoms stay SPARING: 1-2 per viewport max, none on headers.
  const countBlossoms = (src: string, constName: string) => {
    const idx = src.indexOf(constName);
    if (idx === -1) return 0;
    const block = src.slice(idx, src.indexOf("];", idx));
    return (block.match(/\{ left:/g) ?? []).length;
  };
  assert.equal(countBlossoms(petals, "LINES_BLOSSOMS"), 2, "/lines: exactly 2 blossoms");
  assert.equal(countBlossoms(amb, "NIGHT_BLOSSOMS"), 1, "homepage: exactly 1 blossom");
  assert.doesNotMatch(headerBlock, /blossom/i, "headers carry no blossom");
  assert.match(amb, /<PetalField petals=\{HEADER_PETALS\} tone="night" \/>/, "header mode passes no blossoms");

  // Perf contract: the sakura keyframes are QUANTIZED LITERALS. A var()
  // inside a keyframe forces the animation onto the main thread (style
  // recalc every frame) — at 3x density that measured ~54fps on a 4x-CPU
  // throttle; literal keyframes composite and restored 60+.
  const css = readFile("app/globals.css");
  for (const v of ["a", "b", "c", "d"]) {
    for (const kind of ["fall", "sway"]) {
      const name = `@keyframes sakura-${kind}-${v}`;
      const start = css.indexOf(name);
      assert.ok(start > -1, `${name} exists`);
      const body = css.slice(start, css.indexOf("\n}", start));
      assert.doesNotMatch(body, /var\(/, `${name} keyframe body is var()-free (compositor-friendly)`);
    }
  }
});

test("Nav: /start is a first-class item; 'Host a machine' is footer-only (fable-design-overhaul §1)", () => {
  const layout = readFile("app/(site)/layout.tsx");
  const headerBlock = layout.slice(layout.indexOf("function SiteHeader"), layout.indexOf("function SiteFooter"));
  assert.match(headerBlock, /href="\/start"/, "the header nav must link /start");
  assert.doesNotMatch(headerBlock, /href="\/host"/, "'Host a machine' must be out of the header nav");
  const footerBlock = layout.slice(layout.indexOf("function SiteFooter"));
  assert.match(footerBlock, /href="\/host"/, "'Host a machine' stays in the footer (SEO pages live)");
});

test("HoloCard: pointer-driven tilt is reduced-motion-gated and transform-only (fable-design-overhaul Tier 2)", () => {
  const holo = readFile("components/cards/holo-card.tsx");
  assert.match(holo, /prefers-reduced-motion:\s*reduce/, "HoloCard must check prefers-reduced-motion before tilting");
  assert.match(holo, /pointerType === "touch"/, "touch pointers must not drive the tilt");
  const css = readFile("app/globals.css");
  assert.match(css, /\.holo-card\s*\{[\s\S]*?perspective/, "the holo tilt transform lives in globals.css");
  assert.doesNotMatch(css.match(/\.holo-card\s*\{[\s\S]*?\}/)?.[0] ?? "", /(width|height|top|left|margin):/, "the tilt is transform-only, no layout properties");
});

test("Scroll reveals: animation-timeline is progressive-enhancement + reduced-motion-excluded (Tier 1 ambience)", () => {
  const css = readFile("app/globals.css");
  assert.match(css, /@supports\s*\(animation-timeline:\s*view\(\)\)/, "scroll reveals gate on @supports");
  const supportsBlock = css.slice(css.indexOf("@supports (animation-timeline: view())"));
  assert.match(supportsBlock, /prefers-reduced-motion:\s*no-preference/, "reveals only run for no-preference users");
  // The hero must NOT reveal — it paints instantly (LCP guard).
  const page = readFile("app/(site)/page.tsx");
  const heroBlock = page.slice(page.indexOf("function Hero"), page.indexOf("function VaultMoment"));
  assert.doesNotMatch(heroBlock, /reveal-rise/, "the hero never carries a scroll-reveal class");
});

// (The "hero founder avatar loads eagerly" pin died with the hero founder
// avatar itself — homepage-hero-simplify. The footer avatar stays lazy by
// design, below the fold.)

// ---------------------------------------------------------------------------
// ADR-095 — line-tracker (/lines/[pokemon]) sakura register + trust guards.
// The surface layers a sakura accent over cream/navy AND makes a hard
// null-over-guess promise (fabricated sold figures = anti-viral). Pin the
// structural anchors a refactor could slip past: the sakura tokens exist, the
// accent is hover/wash-scoped (never a loud resting fill), motion is
// motion-safe-gated, and the honest "pending" fallback can't be replaced by a
// guess.
// ---------------------------------------------------------------------------

test("globals.css: declares the sakura register tokens (ADR-095)", () => {
  const css = readFile("app/globals.css");
  assert.match(css, /--color-foil-sakura:\s*#[0-9a-fA-F]{6}/, "the sakura accent token must exist");
  assert.match(css, /--color-foil-sakura-wash:\s*#[0-9a-fA-F]{6}/, "the sakura wash token must exist");
  // The fall keyframe backs the motion-safe petal animation.
  assert.match(css, /@keyframes sakura-fall/, "the sakura-fall keyframe must exist");
});

test("Line page: sakura is an accent — resting fills stay cream/navy, sakura only on hover or the soft wash (ADR-095)", () => {
  const src = readFile("app/(site)/lines/[pokemon]/page.tsx");
  // `bg-foil-sakura` (the saturated accent) must never be a resting fill — only
  // `hover:bg-foil-sakura`. The soft `bg-foil-sakura-wash` tint IS allowed at
  // rest (it's the register's cream-adjacent surface, like a gold/5 panel).
  const re = /(\S*)bg-foil-sakura(?!-wash)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const lead = m[1];
    assert.ok(
      lead.endsWith("hover:") || lead.endsWith("group-hover:"),
      `saturated bg-foil-sakura without a hover: prefix in the line page — context "${src.slice(Math.max(0, m.index - 14), m.index + 16)}"`,
    );
  }
});

test("Line page: keeps the @possiblyeve dedication + the price-high, most-valuable-first ordering copy (ADR-095)", () => {
  const src = readFile("app/(site)/lines/[pokemon]/page.tsx");
  // The dedication ("Made for …") is the gift-economy hook; the sort copy is the
  // Moonbreon-on-top promise. Both are load-bearing to the surface's purpose.
  assert.match(src, /Made for \{config\.dedication\}/, "the dedication line must render config.dedication");
  assert.match(src, /most valuable first/i, "the price-high sort promise must be stated");
  // Every figure is real market data — the honesty line is part of the trust moat.
  assert.match(src, /Every figure is real market data/, "the null-over-guess honesty line must render");
});

test("Line data: the sold phrase is null-over-guess — no data renders 'pending', never a fabricated figure (ADR-095)", () => {
  const src = readFile("lib/lines/data.ts");
  // soldPhrase must gate on soldCents == null → a "pending"/"tracking" string,
  // NOT a guessed or SDK-derived dollar figure. Pin the honest fallback so a
  // refactor can't quietly backfill a fake number (the anti-viral failure mode).
  assert.match(src, /soldCents\s*==\s*null|soldCents\s*===\s*null|card\.soldCents\s*==\s*null/, "soldPhrase must branch on a null sold figure");
  assert.match(src, /pending|tracking/i, "the null branch must render an honest pending/tracking phrase");
});

test("Sakura petals: motion lives ONLY in motion-safe: — reduced-motion users see static petals, never auto-motion (ADR-095)", () => {
  const src = readFile("components/lines/sakura-petals.tsx");
  // The animate utility MUST carry the motion-safe: prefix. A bare `animate-`
  // would move for prefers-reduced-motion users (the accessibility bar).
  assert.match(src, /motion-safe:animate-\[sakura-fall/, "the petal animation must be motion-safe-gated");
  const bareAnimate = /(^|[\s"'`])animate-\[sakura-fall/;
  assert.doesNotMatch(src.replace(/motion-safe:animate-\[sakura-fall[^\]]*\]/g, ""), bareAnimate, "no un-gated sakura-fall animation");
  // Deterministic petals — no Math.random() CALL (harness ban + hydration
  // mismatch). Match the call form so the "no Math.random" note in the file's
  // own comment doesn't trip the guard.
  assert.doesNotMatch(src, /Math\.random\s*\(/, "petals must be deterministic (no Math.random() call)");
  // design-round3-fixes §3: the sway layer is motion too — same motion-safe bar.
  assert.match(src, /motion-safe:animate-\[sakura-sway/, "the petal sway must be motion-safe-gated");
  assert.doesNotMatch(
    src.replace(/motion-safe:animate-\[sakura-sway[^\]]*\]/g, ""),
    /(^|[\s"'`])animate-\[sakura-sway/,
    "no un-gated sakura-sway animation",
  );
  // design-round3-fixes §3: real petal silhouettes (SVG path) in two depth
  // layers (far layer blurred), not the old 3-4px border-radius dots.
  assert.match(src, /<path/, "petals must be real SVG petal shapes");
  // petal-fidelity-pass: 2px → 1px (the 2px blur cost ~5fps at 4x CPU
  // throttle across the 3x-density field; 1px keeps the depth read).
  assert.match(src, /blur-\[1px\]/, "the far petal layer must carry the depth blur");
});

test("Line page: the sold-vs-ask pair is DRAWN — spread chip only on good buys, designed pending chip, era headers (design-round3-fixes §2 + §6)", () => {
  const src = readFile("app/(site)/lines/[pokemon]/page.tsx");
  // §2: the spread chip exists, its math is presentation-only from the two
  // existing figures, and it renders ONLY when buy < sold (a good buy).
  assert.match(src, /% under recent sales/, "the spread chip copy must exist");
  assert.match(
    src,
    /card\.marketCents\s*<\s*card\.soldCents/,
    "the spread chip must gate on buy < sold (neutral otherwise)",
  );
  // §2: the pending state is a designed chip, never the broken-looking italic line.
  assert.match(src, /Sold data pending/, "the honest pending chip label must render");
  assert.doesNotMatch(src, /italic/, "the pending state must not be italic gray text");
  // §2: figures use tabular-nums so the price columns align.
  assert.match(src, /tabular-nums/, "figures must be tabular-nums");
  // §6: the printings are grouped into labeled eras with quiet headers.
  assert.match(src, /Modern grails/, "the modern era header must exist");
  assert.match(src, /Vintage &(amp;)? classics/, "the vintage era header must exist");
  assert.match(src, /Promos/, "the promos era header must exist");
  // §6: grouping is presentation-only — empty eras don't render.
  assert.match(src, /era\.cards\.length > 0/, "empty era buckets must not render");
});

test("Line card rail: unified tile height, navy-tinted shadow, edge-fade mask (design-round3-fixes §6)", () => {
  const src = readFile("components/lines/line-card-rail.tsx");
  assert.match(src, /mask-image:linear-gradient\(90deg,transparent,black_4%,black_96%,transparent\)/, "the rail must edge-fade");
  assert.match(src, /shadow-foil-navy\/10/, "rail tiles carry the navy-tinted shadow");
  assert.match(src, /h-\[134px\]/, "rail tiles must share a fixed height");
});

test("Line card rail: no auto-scroll, smooth-scroll is user-click-driven only (ADR-095)", () => {
  const src = readFile("components/lines/line-card-rail.tsx");
  // The rail scrolls only in response to a click (scrollIntoView in onClick).
  // No setInterval/requestAnimationFrame auto-advance (that would be motion the
  // reduced-motion query can't stop).
  assert.match(src, /onClick=\{\(\)\s*=>/, "rail navigation is click-driven");
  assert.doesNotMatch(src, /setInterval|requestAnimationFrame/, "no auto-scroll timer on the rail");
});

// ---------------------------------------------------------------------------
// card-page-vault-first — the card page leads with the service, the data
// supports it. Four structural guards: button-above-fold, collapsed-content-
// in-DOM (SEO), one-write-path, honest fallback copy.
// ---------------------------------------------------------------------------

test("Card page: Add to vault is the hero action, above the proof and the depth (card-page-vault-first)", () => {
  const src = readFile("app/(site)/cards/[slug]/page.tsx");
  const vaultIdx = src.indexOf("<AddToVault");
  const buyIdx = src.indexOf("<LiveListingSection");
  const panelIdx = src.indexOf("<SoldHistoryPanel");
  const variantsIdx = src.indexOf("<CardVariantsSection");
  const metaIdx = src.indexOf("<CardMetadataBlock");
  assert.ok(vaultIdx > -1, "the page must mount AddToVault");
  assert.ok(vaultIdx < buyIdx, "Add to vault renders above the best-listing proof module");
  assert.ok(vaultIdx < panelIdx && vaultIdx < variantsIdx && vaultIdx < metaIdx, "Add to vault renders above every depth section");
  // The proof (affiliate module) stays in plain sight ABOVE the depth — never
  // demoted behind a dropdown (goal tier 2).
  assert.ok(buyIdx < panelIdx && buyIdx < variantsIdx, "the best-listing module sits above the collapsible depth");
  // The button copy is the brand noun, verbatim, ONE noun sitewide.
  const button = readFile("components/cards/add-to-vault.tsx");
  assert.match(button, />\s*Add to vault\s*</, "the button says 'Add to vault' verbatim");
  assert.doesNotMatch(button, /\+ Watchlist|Watchlist\b(?![A-Za-z])/, "no 'Watchlist' in user-facing vault copy (identifiers excluded by word-boundary check)");
});

test("Card page: collapsed depth stays in the server-rendered DOM — native <details>, no client fetch-on-expand (SEO)", () => {
  const shell = readFile("components/cards/detail-section.tsx");
  assert.match(shell, /<details/, "the depth shell is native <details>");
  assert.match(shell, /<summary/, "with a native <summary> disclosure");
  assert.doesNotMatch(shell, /"use client"/, "the shell is a Server Component (content always in the HTML)");
  assert.doesNotMatch(shell, /fetch\(/, "no fetch in the depth shell");
  // Every depth section renders server-side: none of them may become a client
  // component or fetch on expand.
  for (const rel of [
    "components/cards/sold-history-panel.tsx",
    "components/card-variants-section.tsx",
    "components/card-metadata-block.tsx",
  ]) {
    const src = readFile(rel);
    assert.doesNotMatch(src, /"use client"/, `${rel} must stay a Server Component`);
    assert.match(src, /DetailSection|<details/, `${rel} renders through the details shell`);
  }
  // Defaults: sold panel open (the chart is the evidence), variants + card
  // details collapsed, the per-condition table nested + collapsed.
  const panel = readFile("components/cards/sold-history-panel.tsx");
  assert.match(panel, /headingId="sold-history-heading" open/, "sold panel is open by default");
  assert.match(panel, /<details className="group\/conditions/, "condition table is a nested collapsed details");
  const variants = readFile("components/card-variants-section.tsx");
  assert.doesNotMatch(variants, /DetailSection[^>]*\bopen\b/, "variants section is collapsed by default");
});

test("Card page: ONE watch write path — AddToVault wraps WatchlistForm, no second creation path (card-page-vault-first P0)", () => {
  const button = readFile("components/cards/add-to-vault.tsx");
  assert.match(button, /import \{ WatchlistForm \} from "@\/components\/cards\/watchlist-form"/, "AddToVault reuses the existing form");
  assert.doesNotMatch(button, /fetch\(|supabase|createWatchlist/, "AddToVault carries no write logic of its own");
  const page = readFile("app/(site)/cards/[slug]/page.tsx");
  const mounts = page.match(/<AddToVault/g) ?? [];
  assert.equal(mounts.length, 1, "exactly one AddToVault entry point on the page");
  assert.doesNotMatch(page, /<WatchlistForm/, "the page never mounts a second raw WatchlistForm");
  // The form's submit carries the same noun as the entry button.
  const form = readFile("components/cards/watchlist-form.tsx");
  assert.match(form, /"Add to vault"/, "the submit button says 'Add to vault'");
});

test("Card page: honest fallback on thin-data cards — pending copy, no invented figures (null-over-guess in the CTA)", () => {
  const page = readFile("app/(site)/cards/[slug]/page.tsx");
  // The hero stat is coherence-gated and the button state derives from it.
  assert.match(page, /hasSoldData=\{heroStat != null\}/, "the button's fallback state derives from the gated hero stat");
  assert.match(page, /Sold data pending for this card/, "the hero renders the honest pending line when the stat is null");
  const button = readFile("components/cards/add-to-vault.tsx");
  assert.match(button, /hasSoldData\s*\?/, "the reveal copy branches on hasSoldData");
  assert.match(button, /Sold data is still pending for this card/, "the fallback reveal says so in plain words");
  // Voice rules: no em dashes anywhere in the new hero/action copy.
  for (const rel of ["components/cards/add-to-vault.tsx", "components/cards/detail-section.tsx"]) {
    assert.ok(!readFile(rel).includes("—"), `${rel} contains no em dash`);
  }
});

// ---------------------------------------------------------------------------
// blackout-brand Workstream D — /start + /cards index + /cards/sets migrated
// from the cream register to the charcoal night register (matching /deals, the
// vault, and /cards/[slug]). Each page opts into the tone, drops every cream
// page/panel background, and carries no gold (gold is wordmark-only on night).
// ---------------------------------------------------------------------------

test("Night register pinned on /start + /cards index + sets (blackout-brand Workstream D)", () => {
  for (const rel of [
    "app/(site)/start/page.tsx",
    "app/(site)/cards/page.tsx",
    "app/(site)/cards/sets/[set-id]/page.tsx",
  ]) {
    const src = readFile(rel);
    // Opts into the night tone (flips the shared chrome via body:has()) and
    // paints the charcoal ground.
    assert.match(src, /data-tone="night"/, `${rel} must render data-tone="night"`);
    assert.match(src, /bg-foil-night/, `${rel} must paint the charcoal ground`);
    // No cream page/panel background survives. text-foil-cream (ink) is fine;
    // only a `bg-foil-cream` fill (optionally with a /opacity or -shade suffix)
    // is forbidden — the negative lookahead lets bg-foil-night / -night-2 pass.
    assert.doesNotMatch(
      src,
      /bg-foil-cream(?![\w-])/,
      `${rel} must not keep a cream page/panel background`,
    );
    // Gold is retired on night surfaces (wordmark-only).
    assert.doesNotMatch(src, /foil-gold/, `${rel} must carry no gold on the night register`);
  }
});

test("Movers board: heating-up rows at full parity — shared row, thumbnails, /cards links, designed null thumb (blackout-brand Workstream C)", () => {
  const src = readFile("components/deals/movers-board.tsx");
  // ONE row component renders both directions — parity by construction.
  assert.match(src, /function MoverRowItem\(\{ m, direction \}/, "shared row component exists");
  const upSection = src.slice(src.indexOf('id="heating-up"'));
  assert.match(upSection, /<MoverRowItem key=\{m.cardSlug\} m=\{m\} direction="up"/, "heating rows render the shared row (with the thumbnail)");
  // The thumbnail null state is DESIGNED (card glyph), never a blank box.
  assert.match(src, /function CardThumb/, "thumb helper exists");
  assert.match(src, /<svg viewBox="0 0 24 24"/, "designed placeholder glyph");
  // Internal links: identity → our card page; affiliate CTA untouched.
  assert.match(src, /href=\{`\/cards\/\$\{m.cardSlug\}`\}/, "identity links to /cards/[slug]");
  assert.match(src, /affiliateSearchUrl\(query, buildCustomId\(\{ tier: "deals", slug: m.cardSlug, src: "movers" \}\)\)/, "affiliate URL construction unchanged");
  // No gold anywhere on this night surface.
  assert.doesNotMatch(src, /foil-gold/, "gold is wordmark-only on night surfaces");
  // Readability: the stats sentence is 13px, not 11-12px muted.
  assert.match(src, /text-\[13px\] leading-snug text-foil-cream\/70/, "stats line readable");
  // Jump links + footnote block on the page.
  const page = readFile("app/(site)/deals/page.tsx");
  assert.match(page, /aria-label="Board sections"/, "section jump links exist");
  assert.match(page, /How to read this board/, "explainer is a labeled footnote block");
  assert.match(page, /id="below-sold"/, "below-sold jump target exists");
});
