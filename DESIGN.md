---
name: Foil
description: The best price on any Pokémon card — a trusted collector concierge, not a hype machine.
colors:
  cream: "#f8f5f0"
  navy: "#0f1e3a"
  slate: "#4a5568"
  gold: "#c9a24b"
  coral: "#ff6b5c"
  night: "#0d0d0e"
  night-2: "#17171a"
  vermillion: "#d85a30"
  sakura: "#d98aa0"
  sakura-wash: "#f6e6ea"
  accent: "#d98aa0"
  accent-deep: "#a5546e"
  gold-anchor: "#856a00"
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
- **Concierge Gold** (#c9a24b): The premium signal ON CREAM-REGISTER PAGES
  ONLY (legal, pillars, vending): badges, focus rings, hairlines on premium
  surfaces, link-hover underlines. Never a background fill for large areas,
  never decorative. Its scarcity is the entire point. On night surfaces gold
  is wordmark-only (ADR-106, see section 7a): the "TCG" metallic ramp anchored
  on **Gold Anchor** (#856a00), where #c9a24b survives as one gradient stop.

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
  CTA ("Start tracking cards →", "Fill a page →").
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
- **Brand:** The Logo in the site chrome is wordmark-first: "Foil" in the
  Shrikhand bubble face (chrome ink: cream on night, navy on cream, no seal
  mark in the chrome) followed by "TCG" in metallic gold via `.wordmark-tcg`
  (Bricolage bold caps at 0.5em, +0.18em tracking). ADR-106 deliberately
  reverses ADR-094's TCG drop. Accessible name: "FoilTCG home". The seal mark
  survives on favicon/OG/hero-glyph surfaces.
- **Links:** Body/label scale, navy, gold-underline on hover, matching the text
  link pattern above.

### Signature Component: The hanko seal mark + "Foil" wordmark
The brand lockup (`components/brand/logo.tsx`, **ADR-094**) is a wordmark plus a
small mark, laddering sm/md/lg for footer / header / hero:

- **Mark (`SealMark`):** the Foil hanko — a vermillion (`#D85A30`) carved seal
  square with a card slotting into a pocket, knocked out in cream (`#f8f5f0`) in
  negative space, centered on the seal's vertical axis. The seal square IS the
  mark: favicons/avatars render it full-bleed (rounded square, not circle-
  cropped). A single-ink navy monochrome variant exists for print / one-color
  embeds. It is the favicon (`public/favicon.svg`, legible at 16px — the card
  stroke thickens there), the lockup icon, the OG-card mark, and tiles as the
  faint "How it works" section watermark. Geometry-only and isolated so it can be
  swapped without touching the wordmark.
- **Wordmark:** "Foil" set in **Shrikhand** in the site chrome (the bubble
  face, `--font-wordmark-bubble`, rendered via `Logo face="bubble"`), with
  **Bricolage Grotesque 600** (`font-wordmark`) as the carved cut that also
  sets the "TCG" caps. Chrome ink follows the tone: cream on night, navy on
  cream. Accessible name: `"FoilTCG home"` (label-in-name, ADR-106).
- **"TCG" in metallic gold (`.wordmark-tcg`, ADR-106):** a bg-clip gradient
  ramp anchored on the real gold `--color-foil-gold-anchor` (#856a00) with a
  #f4e3a1 specular stop, solid #856a00 fallback where `background-clip: text`
  is unavailable, and a slow hover background-position sheen gated behind
  `prefers-reduced-motion`. Bricolage bold caps at 0.5em won the face trial
  (Shrikhand's counters smear at 12px caps; recorded via the `tcgFace` prop).
  On night surfaces this is the ONLY gold anywhere (scarce-gold, absolute
  form). Email/OG never use the class: solid gold only there (ADR-079).

**The hanko vermillion (`#D85A30`) is the hanko ink only.** John rejected
vermillion as the UI accent (design-loop-round2); the functional accent role
passed to the sakura pair (`--color-foil-accent` #d98aa0 on night /
`--color-foil-accent-deep` #a5546e on cream, ADR-097). The seal still carries
its own vermillion; do not use vermillion for new UI.

**No Pokémon trade dress.** The mark uses no Pokéball or other Pokémon-trademark
shape and avoids the Pokémon yellow+blue trade dress.

**History:** the lineage was "Foil Spark" (ADR-036) → navy Pokéball (ADR-038) →
red/white Pokéball (ADR-040) → **ADR-055 (2026-06-05)** retired the Pokéball for
an owned Fredoka "FoilTCG" wordmark + foil-corner card mark → **ADR-094
(2026-07-01)** replaced that with the hanko seal + "Foil" (Bricolage), driven by
the gold retirement → **ADR-106 (2026-07-03)** brought "TCG" back in metallic
real gold (#856a00 anchored) as the gold's one sanctioned home, and the chrome
went wordmark-first in the Shrikhand bubble face. Do not reintroduce the
Pokéball or any Pokémon-trademark shape; the old flat-gold "TCG" of ADR-055 is
also dead (the ADR-106 metallic ramp is a different treatment, not a revival).

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
- **Don't** use `background-clip: text` gradients, with ONE sanctioned
  exception: the wordmark's `.wordmark-tcg` metallic ramp (ADR-106), where the
  gradient IS the meaning (metal, not decoration). No other text gradient is
  permitted, and no panel gradients ever.
- **Don't** use side-stripe accents (`border-left`/`border-right` > 1px as a color
  bar) or default to a modal when an inline or progressive reveal would do.

> **ROUND-2 AMENDMENTS (design-loop-round2, John's 1am verdicts), as amended
> by pre-send-coherence (ADR-097) and blackout-brand (ADR-106):** the night
> register now covers home, /deals, /blog index, /cards/[slug], the vault
> (/w), and (per ADR-106 Workstream D) /start, the /cards index, and
> /cards/sets/[set-id]; /lines stays cream-sakura for the eve delivery.
> **Vermillion is OUT as the UI accent** (hanko ink only). Round 2 ratified
> **moon-glow teal** as THE accent; that call was SUPERSEDED in production:
> **sakura is THE functional accent** (`--color-foil-accent` #d98aa0 on
> night, about 7:1 / `--color-foil-accent-deep` #a5546e on cream, 4.8:1,
> ADR-097; the /lines pages set the standard site-wide). Teal is retired.
> The register is MATTE Linear-grade ("the dark gallery"): glows pulled back,
> depth from layering; the cards glow, the page doesn't. Wordmark: "Foil" in
> **Shrikhand** (`--font-wordmark-bubble`, `Logo face="bubble"`), wordmark-
> FIRST chrome (seal demoted to favicon + hero-pill glyph), now followed by
> "TCG" in the metallic gold ramp (ADR-106; see Components). Type scale up:
> marketing body 18–20px.

## 7a. Night register (SITE-WIDE CHARCOAL: overnight-design-loop 2026-07-02, re-grounded by pre-send-coherence + ADR-106, 2026-07-03)

The night register began as the homepage's **"lit room"** (won the DIVERGE
face-off against an evolved-warm control, design-loop/ITERATION-LOG.md:
holographic art visibly dims on cream; it pops on dark walls) and is now the
default register for the whole deal-finder funnel. **Coverage:** home, /deals,
/blog index, /cards/[slug], the vault (/w), /start, the /cards index, and
/cards/sets/[set-id] (the last three migrated in ADR-106 Workstream D, with a
visual-regression guard pinning the register). **/lines stays cream-sakura**
(eve's live links). The cream canon of sections 1 through 6 survives on
legal, pillar, and vending pages. A page opts in via `data-tone="night"`.

**Ground tokens (globals.css, supersede the round-1 navy-derived night):**
- **Night** (`--color-foil-night` #0d0d0e): the surface. Neutral matte
  CHARCOAL with zero blue cast; a whisper of warmth (oklch chroma about 0.004
  toward the sakura hue) keeps it matte rather than lifeless. Never `#000`
  (No-Pure-Black holds in spirit). The earlier navy-cast night (#0a1322) is
  dead; navy survives only as semantic ink and shadow tint on cream surfaces.
- **Night panel** (`--color-foil-night-2` #17171a): raised panels (binder
  spread, artifact chips, night email capture).
- **THE accent is the sakura pair** (`--color-foil-accent` #d98aa0 on night,
  about 7:1 / `--color-foil-accent-deep` #a5546e on cream, 4.8:1; ADR-097).
  One hue family across /lines and the night funnel: one site. Used as a
  pinprick: live dots, eyebrows, one underline, focus rings, delta dots.
  History: round 1 tried vermillion as the accent, round 2 ratified moon-glow
  teal; both are superseded. Vermillion (`--color-foil-vermillion` #d85a30)
  is the hanko ink ONLY. Teal is retired.
- **Gold is wordmark-only on night** (scarce-gold, absolute form; ADR-106).
  The "TCG" metallic ramp anchored on `--color-foil-gold-anchor` (#856a00) is
  the ONLY gold that may paint on any night surface. Every other night-surface
  gold was retinted to sakura; do not add new gold. Cream-register pages keep
  their ADR-029 gold until their own migration.

**Chrome tone mechanism:** the shared header/footer read `--chrome-*` variables;
`body:has([data-tone="night"])` flips them dark. No layout fork, no client JS.

**Signature effect — holo-tilt (`components/cards/holo-card.tsx`):** pointer-
tracked 3D tilt + foil-sheen gradient following the cursor (pokemon-cards-css
technique, in-house). Transform/opacity only; touch never tilts;
`prefers-reduced-motion` = fully static. One signature per page.

**Tier-1 ambience:** CSS scroll-driven reveals (`.reveal-rise`,
`animation-timeline: view()`) behind `@supports` + reduced-motion exclusion;
the hero NEVER reveals (paints instantly). Depth is light logic — each
section's artifact is its light source (glow spills), never tiled textures
(the seal-watermark wallpaper is dead and guarded against).

**Wordmark in the chrome:** "Foil" in **Shrikhand** (`--font-wordmark-bubble`,
`Logo face="bubble"`, no seal mark in the chrome) + "TCG" in the metallic
gold `.wordmark-tcg` ramp (see Components). The round-1 Baloo 2 soft cut is
retired; Bricolage (`font-wordmark`) remains the carved cut that sets the
"TCG" caps and serves OG/favicon surfaces pending the brand-asset follow-up.

**Vault-first card page (ADR-105):** `/cards/[slug]` leads with the action:
card identity + one coherence-gated sold figure + the "Add to vault" button
above the fold (mobile-first, 390x844), the listing module as visible proof,
and the data demoted to collapsible depth via `DetailSection` (native
`<details>/<summary>`, zero client JS, collapsed content still in the
server-rendered DOM). Sold panel defaults open; variants and card details
default collapsed. "Add to vault" is the one noun at every step. Thin-data
cards say "Sold data pending for this card" rather than inventing a figure.

**/deals row anatomy (ADR-106 Workstream C):** both directions render the
same `MoverRowItem` at full parity: thumbnail (designed card-glyph null
state, never a blank box), name + set linking to /cards/[slug], a 13px
plain-words stats sentence, the two-point delta dumbbell (down: sakura dot
left of the cream baseline; up: cream dot right; direction + label carry the
"warm" read since vermillion is hanko-only, coral hover-only, gold
wordmark-only), sample size on every row, and the affiliate Browse CTA.

## 7. Vending register (B2B host surfaces) — evolves §§1–6 for `/`, `/host`, `/faq`, `/service-areas`

The deal-finder canon above ("The Dealer's Quiet Backroom") was tuned for quiet
collector browsing: flat-at-rest, scarce gold, all-cream. That register reads as
*bleak* for a B2B vending pitch to business owners, who need contrast, energy,
and confidence. The vending surfaces evolve the canon (ADR-061 supersedes
ADR-029 **for these surfaces only**; the deal-finder surfaces keep §§1–6 as-is).

**New north star: "the confident local operator."** Energetic but not hype; a
real Bay-Area operator who shows up, not a flash sale. Still rejects all four
anti-references (generic-AI-SaaS / crypto-hype / sterile-enterprise / bargain-bin).

**KEEP unchanged:** the cream/navy/gold palette and its hex values, Fraunces
display + Geist body, the Coral-Hover-Only rule, the No-Pure-Black-Or-White rule,
the Navy-Tinted-Shadow rule, and `tabular-nums` for figures.

**CHANGE for vending surfaces:**
- **Cream ↔ navy alternation.** Dark navy (`bg-foil-navy`) feature sections are
  now sanctioned for rhythm and contrast — at least one per long page (e.g. a
  "how it works" band). On navy, text is `text-foil-cream`, supporting copy is a
  cream/slate tint (`text-foil-cream/80`), and gold reads as the accent. This
  replaces the all-cream surface rule for these pages.
- **Subtle resting elevation (relaxes Flat-At-Rest).** Feature cards may carry a
  resting shadow (`shadow-md shadow-foil-navy/10`) and lift further on hover. The
  page is no longer flat-until-touched; it has gentle standing depth. List rows
  and non-feature surfaces stay flat.
- **Gold as a structural accent (relaxes Scarce-Gold ≤10%).** Gold may mark
  eyebrows, step numbers, key figures, and hairline rules on navy — structural
  emphasis, not just a single per-view signal. It still never becomes a large
  fill or a second button color; the Coral-Hover-Only and gold-framing-for-premium
  rules hold. Aim for "confident accent," not "gold everywhere."

**Imagery (vending):** product/model photos of the machine sit on a **navy
panel or device-style frame** (dark-on-dark), cropped to read intentional, never
floating on cream. Captions are neutral and model-only ("our touchscreen card
machine," "the freestanding tower"); never a named venue, never an implied
install (docs/vending/02 §6).
