> 🗄️ **ARCHIVED / SUPERSEDED (2026-07-06)** — historical record, kept per the never-delete rule. Not current state. See [HOME.md](HOME.md) · index: [archive/README.md](archive/README.md).

# Brand Logo Concepts

**Date:** 2026-06-02
**Purpose:** Replace the current Pokeball brand glyph (`components/brand/logo.tsx`, ADR-040) with a distinctive, ownable mark. Feed any direction below into Canva Magic Media, or hand the brief to a Fiverr designer.
**Grounding:** [BRAND-VOICE.md](BRAND-VOICE.md) (ADR-048 voice), [DESIGN.md](../DESIGN.md) (cream/navy/gold system), [competitive-collectric.md](competitive-collectric.md) (differentiation target).

> **Why this matters / premise note.** The live logo is a pixel-art **Pokeball** — red top, white bottom, navy outline. "Pokeball" is a registered Nintendo/Pokémon trademark, so the current mark is both off-brand (it relaxes the cream/navy/gold discipline per ADR-040's own admission) and an **IP exposure** for a buyer-side affiliate business. Moving off it is risk reduction, not just polish. Note also that DESIGN.md still documents the retired "Foil Spark" sparkle (ADR-036) as canonical — pick a direction here and we update both DESIGN.md and the ADR record.

---

## The brief in one screen (paste this above any generator prompt)

- **The word "Foil"** = the holographic refraction pattern on a TCG card. That refraction — white light splitting into color when a card tilts under a lamp — is the conceptual anchor. The mark should evoke *light catching a surface*, not a cartoon.
- **Voice (ADR-048):** Matt Levine × Morning Brew × active seller. Dry, analytical, anti-hype, precise, calm. "The dealer's quiet backroom" (DESIGN.md North Star). The mark should read *considered and expert*, never excited.
- **Palette:** Cream `#f8f5f0`, Ink Navy `#0f1e3a`, Concierge Gold `#c9a24b`. Gold is rationed (≤10% of a screen) and is the *only* place a gradient is allowed — the holofoil ramp **Gold Deep `#a07d2c` → Concierge Gold `#c9a24b` → Gold Light `#e6c170`**. Coral `#ff6b5c` is hover-only and **never** belongs in a static logo.
- **Must clear all four anti-references:** not generic AI-SaaS (no gradient-mesh blob, no rainbow), not crypto-hype (no neon, no 3D chrome), not sterile-enterprise (no cold gray), not bargain-bin coupon (no starbursts, no "SALE" energy).
- **Differentiate from Collectric:** their logo is a text-only wordmark with a color gradient. Foil needs a **constructed glyph** (a mark, not just styled type) so the two are never confused.
- **Hard constraints:** No Pokémon trademarks (Pokeball, Pikachu, energy symbols). No emoji. No stock illustration. Must stay legible from an 800px hero down to a 32px favicon. Must hold on **both** cream and navy backgrounds.

---

## Direction 1 — "Light Split" (refraction prism)

**Concept.** A single thin beam of white/cream light strikes a vertical edge and splits into a narrow fan of *gold* tones — the literal optical event the word "foil" names. Not a Pink-Floyd rainbow: the spectrum is rationed to the three-stop holofoil ramp, so it stays on-palette and the "refraction" reads as *foil*, not *crypto*.

**Why it fits the voice.** It's the most conceptually honest mark — it depicts the exact physical phenomenon the brand is named for, with the restraint of using only the system's one sanctioned gradient. Analytical, precise, zero hype. It also reuses the existing holofoil ramp, so it slots into DESIGN.md without inventing new color.

**What to avoid (generator mistakes).**
- Full ROYGBIV rainbow or neon spectrum → reads crypto/Pride-flag, breaks palette. Constrain to gold only.
- A literal glass triangle prism (the Pink Floyd cliché) → too referential. Keep the splitter abstract: an *edge*, not a 3D prism.
- Gradient-mesh glow or lens-flare bloom → generic-AI tell. Keep the fan as crisp geometric bands.

**Canva Magic Media prompt.**
> Flat vector logo icon, minimalist and geometric. A single thin beam of pale light strikes a vertical edge and splits into a narrow fan of three warm gold bands — deep amber #a07d2c, mid gold #c9a24b, pale gold #e6c170. Sharp clean edges, generous negative space, editorial and premium. No rainbow, no neon, no 3D prism, no glow, no gradient-mesh background, no photorealism, no text, no letters. Centered on solid deep navy #0f1e3a. Designed to stay legible as a tiny app icon.

**Color / background notes.** The gold fan carries the mark, so it holds on **both** backgrounds with no redraw — navy field for app icons (per DESIGN.md's favicon convention), cream field for in-page use. The incoming beam switches cream-on-navy / navy-on-cream depending on surface. Most robust two-background direction here.

---

## Direction 2 — "Faceted F" (refraction monogram)

**Concept.** A single capital **F**, built from clean geometric strokes, with one diagonal facet sliced across it that catches a gold highlight — as if the letter itself were a foil surface tilted to the light. A monogram, so it's inherently favicon-safe and instantly distinct from Collectric's full-word gradient wordmark.

**Why it fits the voice.** A monogram is the most "established, confident operator" form — it implies a brand that doesn't need to over-explain itself. The single gold facet is the rationed-gold rule made literal: one glint, one signal. Pairs naturally with the Fraunces wordmark already in the system.

**What to avoid (generator mistakes).**
- **AI text-to-image mangles letterforms.** Magic Media will likely produce a warped or invented "F." Treat the Canva prompt as a *mood reference only* — this direction should really be **constructed by a human in Fiverr/Illustrator** (or built directly from the Fraunces capital F + a vector facet), not generated.
- Generic tech-startup gradient F (full-bleed blue→purple) → exactly the generic-AI look ADR-028/029 de-risked. One gold facet on a solid navy/cream F, nothing more.
- 3D extrude / chrome bevel → crypto-hype tell.

**Canva Magic Media prompt (reference only — prefer human build).**
> Flat vector monogram, a single capital letter F made of clean geometric strokes, navy #0f1e3a on cream #f8f5f0. One sharp diagonal facet cuts across the F and catches a warm gold highlight #c9a24b, like light glinting off a tilted foil card. Confident, editorial, premium, restrained. No gradient flood, no 3D bevel, no chrome, no glow, no rainbow, no extra letters. Single F only, centered, generous margin.

**Color / background notes.** Two locked versions: navy F + gold facet on cream; cream F + gold facet on navy. Gold facet is constant across both, preserving recognition. Favicon-trivial because it's a single glyph.

---

## Direction 3 — "Foil Corner" (card-corner with foil sweep)

**Concept.** The top corner of an abstract trading card (two rounded corners, navy outline) crossed by a single diagonal band of gold holofoil shimmer — the exact gesture of tilting a card under a lamp to check the holo. Reads as "trading cards" instantly without depicting any actual card art.

**Why it fits the voice.** Most legible to the *collector niche specifically* — a hobbyist recognizes "card corner + holo glint" in a quarter-second. It says "we are about the physical object and its condition" (Foil's whole job-to-be-done) while staying abstract enough to dodge any trademark. Warm, collectible, on-brand.

**What to avoid (generator mistakes).**
- Drawing a *real* card with a Charizard / character / energy symbol on it → trademark landmine. Keep the card blank: just a corner and the foil band.
- Full rainbow holographic sheen across the whole card → too loud. One diagonal gold band only.
- Photorealistic card render with drop shadow → breaks the flat-at-rest system. Keep it flat vector.
- Drawing the *whole* card → too detailed to survive 32px. It must be just the **corner**.

**Canva Magic Media prompt.**
> Flat vector logo icon: the top corner of a blank trading card, drawn as a clean navy outline #0f1e3a on cream #f8f5f0, with two softly rounded corners. A single diagonal band of warm gold foil shimmer (#c9a24b to #e6c170) sweeps across the corner, like light catching a holographic card tilted under a lamp. Minimal, geometric, premium, collectible. No characters, no card art, no text, no rainbow, no neon, no photorealism, no drop shadow. Centered with negative space, legible as a small icon.

**Color / background notes.** Default is navy outline on cream. For the navy app-icon background, invert to a cream/gold outline. The gold sweep is the constant. Slightly more detail than Directions 1/2, so test the 32px render early — simplify the corner radius if it muddies.

---

## Direction 4 — "The Tilt" (minimalist line mark)

**Concept.** The most reductive option: a card edge rendered as two thin navy strokes meeting at a corner, crossed by one diagonal gold sweep line standing in for the holo glint. Pure line art, maximum negative space. Where Direction 3 is a filled corner, this is a single confident gesture in line weight.

**Why it fits the voice.** This is the Matt-Levine register in visual form — dry, economical, nothing wasted. It's the quietest mark of the set, which is exactly the "calm, already-did-the-scrubbing" feeling DESIGN.md chases. Editorial line marks also read as *publication/intelligence* rather than *app* — flattering for a brand whose product is partly the newsletter.

**What to avoid (generator mistakes).**
- Magic Media tends to *fill and decorate* line art — it'll add shading, a glow, or a background. Push hard on "line only, no fill, flat."
- Too thin a stroke disappears at favicon size → specify a confident medium stroke weight.
- Adding more lines to "complete" the card → the power is in the incompleteness. Two strokes + one diagonal, nothing more.

**Canva Magic Media prompt.**
> Minimal line-art logo icon. A card edge drawn as two thin navy strokes #0f1e3a meeting at a single corner on cream #f8f5f0, crossed by one diagonal gold sweep line #c9a24b suggesting a glint of holographic foil. Extremely minimal, editorial, confident, medium stroke weight, lots of negative space. Line only — no fill, no shading, no gradient, no glow, no 3D, no rainbow, no characters, no text. Centered, intentional, legible at tiny favicon size.

**Color / background notes.** Strokes invert by surface (navy on cream / cream on navy); the gold diagonal is constant. Thinnest of the four at small sizes — bump stroke weight for the 16–32px favicon variant so it doesn't vanish.

---

## Recommendation

**Generate Direction 1 ("Light Split") and Direction 3 ("Foil Corner") first.**

- **Direction 1** is the purest conceptual fit (it depicts the literal meaning of "foil"), it reuses the *only* sanctioned gradient in the system so it can't drift off-palette, and it's the most robust across both backgrounds with zero redraw. Lowest risk, highest concept density. Lead here.
- **Direction 3** is the most *instantly legible to a Pokémon-card collector* — it reads "trading cards" in a glance, which matters for a cold audience arriving from Twitter. Strongest recognition, slightly more 32px risk to test.

Run both through Magic Media, generate ~10 variations each, and judge them shrunk to 32px on a browser tab first — favicon legibility kills more logo concepts than aesthetics do.

**Hold Direction 2 ("Faceted F") for a human designer**, not Magic Media — AI text-to-image reliably garbles letterforms, and a monogram lives or dies on precise construction. It's a strong mark; just build it from the Fraunces capital F in Illustrator (or brief a Fiverr designer with the prompt above as mood), not from a generator. **Direction 4** is the safe, quiet fallback if 1 and 3 come back too busy.

---

## Practical notes for whoever generates / draws this

- **Magic Media is weak at logos generally** (it's tuned for illustration/photography). Expect to use its output as *direction*, then have the chosen concept rebuilt as clean vector — either yourself in Canva's vector tools or via Fiverr. Don't ship a raster Magic Media PNG as the favicon.
- **Deliverables to ask a Fiverr designer for:** SVG (primary), plus PNG at 512 / 192 / 32 / 16px, in two lockups — glyph-only (favicon/app icon) and glyph + "Foil" wordmark (header). Wordmark stays Fraunces semibold per DESIGN.md.
- **When a direction is chosen,** the code swap is `components/brand/logo.tsx` (currently the Pokeball), `app/favicon.ico`, and `app/opengraph-image.tsx`; then update DESIGN.md §5 "Signature Component" and add an ADR superseding ADR-040.
