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
  // Session 42 / ADR-031: MDX components rendered inside blog post
  // bodies were missed by the Session 39 sweep — adding them to the
  // public-surfaces list extends the no-coral-default + no-raw-hex
  // invariants to cover callouts, FAQ, TopicLink, code blocks, etc.
  "mdx-components.tsx",
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

test("Homepage: BackgroundGradientAnimation uses corner-shimmer variant (ADR-029)", () => {
  const src = readFile("app/(site)/page.tsx");
  // Explicit variant prop OR no variant prop at all (component defaults
  // to corner-shimmer). Pin to the explicit form for clarity.
  assert.match(src, /variant=["']corner-shimmer["']/);
});

test("Homepage: Card3D wraps the HERO_CARDS grid (ADR-029)", () => {
  const src = readFile("app/(site)/page.tsx");
  // The 8-card backdrop is the visual interest now (sparkles dropped).
  // Card3D wraps each thumbnail for hover-tilt.
  assert.match(src, /<Card3D\b/);
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
