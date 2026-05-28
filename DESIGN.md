---
name: Foil
description: The best price on any Pokémon card — a trusted collector concierge, not a hype machine.
colors:
  cream: "#f8f5f0"
  navy: "#0f1e3a"
  slate: "#4a5568"
  gold: "#c9a24b"
  coral: "#ff6b5c"
  gold-deep: "#a07d2c"
  gold-light: "#e6c170"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  gutter: "20px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.cream}"
    rounded: "{rounded.xl}"
    padding: "14px 24px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.cream}"
    rounded: "{rounded.xl}"
    padding: "14px 24px"
  button-secondary:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.navy}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  input-field:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.navy}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.navy}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  card-premium:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.navy}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  badge-pill:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.navy}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    typography: "{typography.label}"
---

# Design System: Foil

## 1. Overview

**Creative North Star: "The Dealer's Quiet Backroom"**

Foil should feel like stepping behind the counter of a reputable card shop and
having the owner slide one sleeve across the glass: *"This is the one. I already
checked the rest."* The surface is warm and unhurried, cream paper rather than
screen-white, with navy ink and a single thread of gold reserved for the things
that actually matter. It reads as collector-niche and expert, the relief of
someone reliable having done the scrubbing for you, never the adrenaline of a
flash sale.

The system is type-led and restraint-driven. Fraunces (a warm humanist serif) carries the
headlines with tight, editorial tracking so the page reads like a considered
publication, not a SaaS template. Color is the discipline: the entire surface
lives on cream and navy, and gold is rationed so hard that its appearance is a
signal in itself. Coral exists only as a touch response, the warmth of a thing
reacting to your hand. Depth is whispered through navy-tinted shadow and hairline
borders, never stacked panels or glass.

This system explicitly rejects four things. It is **not** a generic AI SaaS
template (no gradient-text heroes, no identical icon-card grids, no big-number
hero-metric cliché). It is **not** a loud crypto or hype marketplace (no
neon-on-dark, no countdown urgency, no "DEALS!" energy). It is **not** a sterile
enterprise dashboard (no cold gray, no warmth-free data tables). And it is **not**
a bargain-bin coupon site (no clutter, no ad noise, no screaming discounts). Foil
curates; it does not shout.

**Key Characteristics:**
- Cream paper surface, navy ink, gold rationed to ≤10% of any screen.
- Type-led hierarchy in Fraunces (humanist serif) with tight display tracking.
- Navy-tinted shadows and hairline borders; flat at rest, a gentle lift on touch.
- Coral is a hover-only response, never a resting color.
- Mobile-first: thumb-sized targets, one best answer over a wall of results.

## 2. Colors

A warm, two-tone foundation of cream and navy, threaded with a single disciplined
gold and a coral that only ever appears under a cursor.

### Primary
- **Ink Navy** (#0f1e3a): The voice of the system. All body and heading text,
  primary button fills, and the brand wordmark. This is Foil's true black, used
  in place of `#000` everywhere, and tinted into every shadow and hairline border.

### Secondary
- **Concierge Gold** (#c9a24b): The premium signal. Live-status dots, "good deal"
  badges, the brand spark mark, focus rings, hairlines on premium surfaces, and
  link-hover underlines. Never a background fill for large areas, never decorative.
  Its scarcity is the entire point. Two siblings exist only inside the brand
  glyph's holofoil gradient: **Gold Deep** (#a07d2c) and **Gold Light** (#e6c170).

### Tertiary
- **Touch Coral** (#ff6b5c): Reserved for interaction. Primary buttons swap their
  navy fill to coral on hover; error text uses it. It never appears at rest, so
  when it shows up, it always means "you are doing something."

### Neutral
- **Paper Cream** (#f8f5f0): The page surface and nearly every container fill.
  Foil's true white, used in place of `#fff`. Warmth lives here.
- **Slate** (#4a5568): Secondary and supporting copy, meta lines, placeholders,
  captions. The calm middle voice between cream and navy.

### Named Rules
**The Coral-Hover-Only Rule.** Coral (#ff6b5c) is forbidden as a resting color.
It appears only as a hover/active response or in an error message. A coral element
sitting still on the page is a bug.

**The Scarce Gold Rule.** Gold covers ≤10% of any screen. It marks one thing per
view: the live signal, the best-deal badge, the single premium accent. The moment
gold becomes a section background or a second button fill, it stops meaning
anything and the design has failed.

**The No-Pure-Black-Or-White Rule.** `#000` and `#fff` are prohibited. Navy
(#0f1e3a) is the darkest ink; cream (#f8f5f0) is the lightest surface. Every
neutral is tinted toward the brand.

## 3. Typography

**Display Font:** Fraunces (variable humanist serif; `opsz` optical-size +
`SOFT` axes), with Georgia / serif fallback. Swapped from Bricolage Grotesque in
Session 46 / ADR-036, the serif reads "trusted concierge", warm but considered,
where the grotesque read closer to "indie SaaS".
**Body Font:** Geist (with Arial / Helvetica fallback).
**Label / Mono Font:** Geist Mono, for prices, codes, and inline technical strings
(always paired with `tabular-nums`).

**Character:** A warm humanist serif display over a clean, neutral sans body. The
`opsz` axis (via `font-optical-sizing: auto`) lets the cut grow more elegant as
the headline grows; a touch of `SOFT` (30) rounds the terminals. The serif/sans
pairing reads "considered editorial" rather than "app chrome". Display weight is
600 (semibold), not 700, so the serif feels warm rather than heavy.

### Hierarchy
- **Display** (600, clamp 2.25–3.75rem, line-height 1.05, −0.01em): Hero H1 only.
  One per page. Fraunces.
- **Headline** (600, clamp 1.875–2.25rem, line-height 1.1, −0.01em): Section H2s.
- **Title** (700, 1.125–1.25rem): Card titles, plan names, form section labels.
- **Body** (400, 1.0625–1.25rem, line-height 1.6): Lead and supporting copy in
  slate or navy. Cap measure at 65–75ch (the `max-w-2xl` / `max-w-3xl` containers).
- **Label** (500, 0.75rem, +0.05em, often UPPERCASE): Eyebrows, meta tags, pill
  text. Gold or slate.
- **Mono** (400, 0.875rem, `tabular-nums`): Prices, grades, set codes, inline
  `code` chips on a navy/10 background.

### Named Rules
**The Display-for-Headlines Rule.** Fraunces is for H1/H2/H3, the
wordmark, and stat figures only. It is forbidden in body copy, captions, and form
help text. Crossing display into running text reads as template noise.

**The Tabular-Price Rule.** Every dollar figure renders with `tabular-nums` so
prices align and never jitter on update. Money is the product; it must sit still.

## 4. Elevation

Foil is nearly flat. Depth is conveyed by hairline borders (`border-foil-navy/10`),
soft rings, and shadows whose color is always navy at low alpha, never neutral
black. Surfaces rest flush on the cream and lift only in response to a hover. The
effect is paper on a desk, not panels floating in space. Glassmorphism is reserved
for the one backdrop-blurred "Live" pill and nothing else.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(15,30,58,0.05)`): The default for cards
  and list rows. Barely there, just enough to separate from the cream.
- **Lift** (`box-shadow: 0 4px 6px rgba(15,30,58,0.10)`): Hover state for
  interactive cards and the primary button.
- **Feature** (`box-shadow: 0 20px 25px rgba(15,30,58,0.10)`): The premium plan
  card, the example-result panel, and final-CTA slab. Used sparingly to mark the
  one container that should pull focus.

### Named Rules
**The Navy-Tinted Shadow Rule.** Every shadow carries `foil-navy` alpha, never
`rgba(0,0,0,...)`. A neutral-black shadow on the cream surface looks dirty and
breaks the warmth.

**The Flat-At-Rest Rule.** Surfaces are flat until touched. Shadow growth and a
−2px translate are a *response* to hover, not a resting decoration. If a card is
already lifted before you point at it, drop it back down.

## 5. Components

### Buttons
- **Shape:** Gently rounded (12px / `rounded-xl`). Pills (`rounded-full`) are for
  badges, not buttons.
- **Primary:** Navy fill, cream text, `padding: 14px 24px`, semibold. The workhorse
  CTA ("Start tracking cards →", "Track 3 cards →").
- **Hover / Focus:** Fill swaps navy → coral, a −0.5/−2px lift, shadow grows to
  Lift, and a `ring-2 ring-foil-gold/40` blooms. Disabled state drops all of it and
  sits at 60% opacity. This is the system's signature motion moment.
- **Secondary / Ghost:** Cream fill, navy text, `border-foil-navy/15`. Hover shifts
  the border to `gold/40` and the fill to `gold/5`. For lower-priority actions.
- **Text link:** Navy text, `underline decoration-foil-navy/20 underline-offset-4`,
  hover swaps the underline color to gold. No fill, no box.

### Chips / Badges
- **Style:** `rounded-full`, low-alpha tint fill (`gold/15` for positive signals,
  `navy/5` for neutral tags), navy text, label typography, `padding: 4px 10px`.
- **Live pill:** The one glassmorphism exception, `bg-cream/80 backdrop-blur-sm`
  with a gold border and an animated ping dot.

### Cards / Containers
- **Corner Style:** Radius ladder by importance, 16px (`rounded-2xl`) for standard
  cards, 24px (`rounded-3xl`) for hero slabs (final CTA, success states, the start
  form), 12px (`rounded-xl`) for list rows, 6–8px for inline thumbnails.
- **Background:** Cream. Always cream.
- **Border:** Hairline `border-foil-navy/10` by default.
- **Shadow Strategy:** Rest by default, Lift on hover (see Elevation).
- **Premium variant:** Same cream fill, but `border-foil-gold/50` + `ring-1
  ring-foil-gold/30` + Feature shadow. Gold framing is how "this one is special"
  is said, never a different background color.
- **Internal Padding:** 24px standard (`p-6`), 32px on hero slabs.

### Inputs / Fields
- **Style:** Cream fill, `border-foil-navy/15`, 12px radius, `padding: 12px 16px`,
  navy text, slate placeholder at 60% opacity.
- **Focus:** Border shifts to solid gold + `ring-2 ring-foil-gold/30`. No glow, no
  color flood, a clean, confident focus.
- **Numeric (price) fields:** Right-aligned, narrow, prefixed with a slate `$`.

### Navigation
- **Brand:** The Logo, spark glyph + "Foil" wordmark, in display font, navy.
- **Links:** Body/label scale, navy, gold-underline on hover, matching the text
  link pattern above.

### Signature Component: The Foil Spark (brand glyph)
A four-point gold sparkle with two smaller shimmer accents, the "spark of
holofoil" collectors chase (ADR-036, replaced the rhombus, which read as a
folder/square at favicon size). Filled with a three-stop holofoil gradient (Gold
Deep → Gold Light → Concierge Gold), inlined as SVG so it doubles as the favicon
(navy field at app-icon sizes for 16px legibility). It ladders sm/md/lg for footer
/ header / hero. This mark is the *only* sanctioned gradient in the system (see
Don'ts), it is a small mark, not a background. NOT a Pokeball.

## 6. Do's and Don'ts

### Do:
- **Do** keep the surface on cream (#f8f5f0) and the ink on navy (#0f1e3a); reach
  for gold (#c9a24b) only to mark the single most important signal on a screen.
- **Do** use Fraunces for headlines (semibold, optical-sizing on), and Geist
  for everything you actually read.
- **Do** render every price with `tabular-nums` in Geist Mono.
- **Do** tint shadows with `foil-navy` alpha and keep surfaces flat until hover.
- **Do** swap navy → coral on hover for primary buttons; it is the one place coral
  belongs.
- **Do** frame "premium" with a gold border + ring, not a different fill color.
- **Do** honor `prefers-reduced-motion` on the hover lift and the live-dot ping
  (an ADR-029 followup, required, not yet implemented everywhere).

### Don't:
- **Don't** build the generic AI SaaS template: no gradient text, no identical
  icon-card grids, no big-number hero-metric cliché (ADR-028 / 029 / 032 / 033
  de-risked exactly this).
- **Don't** go loud crypto/hype: no neon-on-dark, no countdown timers, no "DEALS!"
  urgency.
- **Don't** go sterile enterprise: no cold gray surfaces, no warmth-free dense
  data tables.
- **Don't** go bargain-bin coupon site: no clutter, no ad noise, no
  discount-screaming.
- **Don't** use `#000` or `#fff` anywhere; navy and cream are the true black/white.
- **Don't** let coral rest. If coral is visible without a hover or an error, it is
  a bug.
- **Don't** let gold spread past ~10% of a screen, the moment it becomes a section
  background or a second button fill, it stops meaning anything.
- **Don't** use `background-clip: text` gradients. The brand spark mark is the only
  sanctioned gradient, and it is a small SVG mark, not text and not a panel.
- **Don't** use side-stripe accents (`border-left`/`border-right` > 1px as a color
  bar) or default to a modal when an inline or progressive reveal would do.
