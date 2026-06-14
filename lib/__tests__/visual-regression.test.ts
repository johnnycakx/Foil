// Visual-regression invariants for the Session 39 cream/navy/gold
// identity overhaul (ADR-029). The actual visual is in CSS animations
// and computed-style at run time; these tests pin the markup anchors a
// refactor would slip past — palette tokens, structural choices, and
// the "coral is hover-only" defense-in-depth rule.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  "app/(site)/legal/privacy/page.tsx",
  "app/(site)/legal/terms/page.tsx",
  "app/(site)/legal/ebay-api-compliance/page.tsx",
  "app/(site)/newsletter/page.tsx",
  "components/email-capture.tsx",
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
  // Vending Phase V-1 (2026-06-12): the /machines locator hub, the /host
  // venue funnel, and their form components. Same cream/navy/gold register;
  // the copy firewall for these surfaces lives in vending-surfaces.test.ts.
  "app/(site)/machines/page.tsx",
  "app/(site)/host/page.tsx",
  "components/vending/restock-alert-form.tsx",
  "components/vending/host-lead-form.tsx",
  // Vending pivot (docs/vending Goal A): the host lead-gen surfaces that
  // replaced the deal-finder as the public face — homepage, FAQ, and the
  // service-area hub + city pages. Same cream/navy/gold register.
  "app/(site)/faq/page.tsx",
  "app/(site)/service-areas/page.tsx",
  "app/(site)/service-areas/[city]/page.tsx",
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

test("Homepage: H1 is single-color navy with no inline coral split (ADR-029)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Find the H1 tag block. The pre-Session-39 implementation split the
  // headline with an inline <span className="text-[#FF6B5C]">…</span>;
  // ADR-029 removes the split so the headline reads as one continuous
  // navy line.
  const h1Block = src.match(/<h1\b[^>]*text-foil-navy[^>]*>[\s\S]*?<\/h1>/);
  assert.ok(h1Block, "H1 with text-foil-navy must exist");
  assert.doesNotMatch(h1Block![0], /<span\b[^>]*text-[^>]*>/);
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

test("/start form: renders the three named section headers (ADR-029)", () => {
  const src = readFile("components/start-page-form.tsx");
  assert.match(src, /Tell me a card/);
  assert.match(src, /Set target prices/);
  assert.match(src, /Where to email you/);
});

// ---------------------------------------------------------------------------
// /cards browse + /cards/[slug] — palette anchors
// ---------------------------------------------------------------------------

test("/cards browse: catalog label uses gold accent (ADR-029)", () => {
  const src = readFile("app/(site)/cards/page.tsx");
  // Catalog · N cards label, was text-[#FF6B5C], is now text-foil-gold.
  assert.match(src, /text-foil-gold/);
});

test("/cards/[slug]: best-listing block uses gold border + cream surface (ADR-029)", () => {
  const src = readFile("app/(site)/cards/[slug]/page.tsx");
  // Gold border on the premium block + cream BG everywhere else.
  assert.match(src, /border-foil-gold\/40/);
  assert.match(src, /bg-foil-cream/);
});

test("/cards/[slug]: Buy CTA uses navy bg with gold hover-ring (ADR-029)", () => {
  const src = readFile("app/(site)/cards/[slug]/page.tsx");
  // Navy default + gold hover-ring = the niche signal on the primary CTA.
  assert.match(src, /bg-foil-navy[^"']*hover:[^"']*ring-foil-gold/);
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
// Session 43 / ADR-032 — Brand mark: gold rhombus glyph + Foil wordmark.
// ---------------------------------------------------------------------------

test("Logo component: foil-corner card mark, zero Pokeball geometry (ADR-055)", () => {
  const src = readFile("components/brand/logo.tsx");
  // ADR-055 retired the Pokeball (trade-dress exposure). The mark is now an
  // abstract foil-corner card: navy body + two-tone gold folded corner.
  assert.match(src, /function FoilCornerMark/, "FoilCornerMark must exist");
  assert.doesNotMatch(src, /function PokeballMark/, "PokeballMark must be gone");
  assert.doesNotMatch(src, /#e63946/i, "the Pokémon red must be gone");
  assert.match(src, /#0f1e3a/i, "navy card body");
  assert.match(src, /#c9a24b/i, "gold foil corner");
  assert.match(src, /#a8842f/i, "darker gold fold underside");
});

test("Logo component: FoilTCG wordmark — Fredoka, navy 'Foil' + gold 'TCG', accessible name (ADR-055)", () => {
  const src = readFile("components/brand/logo.tsx");
  assert.match(src, /font-wordmark/, "wordmark uses the Fredoka font-wordmark utility");
  assert.match(src, /aria-label="FoilTCG home"/, "accessible name (no em dash — Gate 12)");
  assert.match(src, /text-foil-navy/, "onCream tone: navy 'Foil'");
  assert.match(src, /text-foil-cream/, "onNavy tone: cream 'Foil'");
  assert.match(src, />Foil</, "'Foil' word");
  assert.match(src, />\s*TCG\s*</, "'TCG' word");
});

test("Wordmark font Fredoka is pinned + exposed as font-wordmark (ADR-055)", () => {
  const layout = readFile("app/layout.tsx");
  assert.match(layout, /Fredoka/, "layout imports Fredoka");
  assert.match(layout, /variable:\s*["']--font-wordmark["']/, "Fredoka backs the --font-wordmark var");
  const css = readFile("app/globals.css");
  assert.match(css, /--font-wordmark:\s*var\(--font-wordmark\)/, "the font-wordmark utility token exists");
});

test("Brand assets: favicon + icon + OG carry the foil-corner mark / wordmark, no Pokeball (ADR-055)", () => {
  const fav = readFile("public/favicon.svg");
  assert.doesNotMatch(fav, /#e63946/i, "favicon must not be the red Pokeball");
  assert.match(fav, /M 17 4 L 26 13/, "favicon carries the foil-corner fold path");
  const icon = readFile("public/icon.svg");
  assert.doesNotMatch(icon, /#e63946/i, "icon.svg must not be the Pokeball");
  assert.match(icon, /Foil<\/tspan>/, "icon.svg carries the 'Foil' wordmark");
  assert.match(icon, /TCG<\/tspan>/, "icon.svg carries the 'TCG' wordmark");
  const og = readFile("app/opengraph-image.tsx");
  assert.doesNotMatch(og, /#FF6B5C/i, "OG must not use the retired coral");
  assert.match(og, /FoilTCG|Fredoka/, "OG carries the FoilTCG wordmark");
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

test("Vending homepage: hero is the host pitch, navy H1, no deal-finder grail showcase", () => {
  // The pivot replaced the deal-finder grail-card hero with a host-acquisition
  // pitch. Pin the new H1 + the absence of the old card showcase so a refactor
  // can't drag the deal-finder hero back onto the public face of the site.
  const src = readFile("app/(site)/page.tsx");
  assert.match(src, /A Pokémon card vending machine in your business/, "vending H1 copy");
  assert.doesNotMatch(src, /HERO_CARDS/, "the deal-finder grail showcase must be gone");
  assert.doesNotMatch(src, /lg:w-40/, "the large grail-card hero visual must be gone");
});

test("Hero: the copy-area scrim is gone (ADR-037 — cards no longer overlap text)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Cards sit above the headline now, so there's nothing to scrim. Pin
  // the removal of every prior scrim form.
  assert.doesNotMatch(src, /via-foil-cream\/88/, "the ADR-036 mobile scrim should be gone");
  assert.doesNotMatch(src, /linear-gradient\(to_right,var\(--color-foil-cream\)/, "the ADR-036 desktop scrim should be gone");
  assert.doesNotMatch(src, /radial-gradient\(ellipse_at_top_left/, "the ADR-033 radial scrim should be gone");
});

test("Vending homepage: renders the host lead form + the key host CTAs", () => {
  const src = readFile("app/(site)/page.tsx");
  // The homepage is now the primary lead-gen surface: it must render the host
  // lead form and link the core host journey (host / faq / service-areas).
  assert.match(src, /import\s*\{\s*HostLeadForm\s*\}/, "homepage must import the HostLeadForm");
  assert.match(src, /<HostLeadForm\b[^>]*\/>/, "homepage must render the HostLeadForm");
  assert.match(src, /href="\/service-areas"/, "homepage links to /service-areas");
  assert.match(src, /href="\/faq"/, "homepage links to /faq");
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

test("Vending homepage: rev-share number is NOT published, routes to a call, no Pokeball (2026-06-13 OFF-SITE decision)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The revenue-share number is a call topic, not a website claim (supersedes
  // the old "publish 10–15% verbatim" pin). No percentage / "gross" in rendered
  // copy; the page routes the rev-share to a call. Strip comments first so the
  // rule can be documented in comments.
  const rendered = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(rendered, /10\s?[–-]\s?15/, "no rev-share percentage on the homepage");
  assert.doesNotMatch(rendered, /\bgross\b/i, "no 'gross' on the homepage");
  assert.match(rendered, /walk through the revenue share/i, "homepage routes the rev-share to a call");
  assert.doesNotMatch(src, /<PokeballMark\b/, "no PokeballMark bullets remain");
});

test("Display font is Fraunces with the SOFT warmth axis (ADR-036)", () => {
  const layout = readFile("app/layout.tsx");
  assert.match(layout, /Fraunces/, "layout must import Fraunces");
  assert.doesNotMatch(layout, /Bricolage_Grotesque/, "Bricolage import should be gone");
  assert.match(layout, /variable:\s*["']--font-display["']/, "Fraunces must back the --font-display token");
  const css = readFile("app/globals.css");
  // The SOFT axis (no wght set, so font-weight utilities still compose).
  assert.match(css, /font-variation-settings:\s*["']SOFT["']\s+30/);
});

// ---------------------------------------------------------------------------
// Session 47 / ADR-037 — hero rework + floral section distinction.
// ---------------------------------------------------------------------------

test("Vending homepage: evolved section spine, navy contrast band, no FAQ teaser (ADR-061)", () => {
  const src = readFile("app/(site)/page.tsx");
  // ADR-061 redesign: spine is hero -> value props -> how it works (dark navy
  // band) -> operating proof -> lead form. The "Quick answers" FAQ teaser was
  // cut (the homepage links to /faq instead).
  assert.match(src, /<ValueProps \/>/, "value-props section present");
  assert.match(src, /<HowItWorks \/>/, "how-it-works section present");
  assert.match(src, /<OperatingProof \/>/, "operating-proof section present");
  assert.match(src, /<LeadSection \/>/, "lead form section present");
  assert.doesNotMatch(src, /<FaqTeaser/, "the homepage Quick-answers FAQ teaser was cut (link to /faq instead)");
  // At least one dark navy contrast section (ADR-061 cream↔navy alternation).
  assert.match(src, /bg-foil-navy/, "homepage must carry a dark navy contrast section");
  // No deal-finder hero artifacts crept back.
  assert.doesNotMatch(src, /images\.pokemontcg\.io/, "no external SDK CDN hero images");
  assert.doesNotMatch(src, /function FoilCornerPattern/, "deal-finder watermark section gone");
});

test("Vending homepage: emits LocalBusiness + Service JSON-LD; FAQPage lives on /faq (ADR-061)", () => {
  const src = readFile("app/(site)/page.tsx");
  assert.match(src, /localBusinessSchema/, "homepage emits LocalBusiness JSON-LD");
  assert.match(src, /serviceSchema/, "homepage emits Service JSON-LD");
  // The visible FAQ block was cut from the homepage, so FAQPage JSON-LD moved
  // off it (structured data must match visible content); /faq keeps its FAQPage.
  assert.doesNotMatch(src, /faqPageSchema/, "homepage no longer emits FAQPage (no visible FAQ block)");
  assert.match(src, /application\/ld\+json/, "homepage renders a JSON-LD script tag");
});
