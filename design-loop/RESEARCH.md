# RESEARCH.md — reference principles (overnight-design-loop, 2026-07-02)

Shot with puppeteer into `design-loop/reference/` (basement.studio, linear.app,
stripe.com, vercel.com; courtyard.io blocked headless capture — principles for
premium collectible framing taken from the PSA/slab-display convention instead:
dark display case, object lit, provenance beneath). PRINCIPLES extracted, not
pixels copied.

## What the references actually do

**basement.studio** — the whole page is a dark PHYSICAL SPACE, not a dark
theme. Depth comes from an environment with light sources: lit shelves, a
glowing arcade cabinet, neon signage. Objects are the light. Nav is tiny and
utilitarian; one accent (signal orange) used like a highlighter, twice. The
lesson for Foil is not WebGL — it's that darkness is a ROOM you light objects
inside, and holographic card art is a born light source.

**linear.app** — near-black is never pure black (#0a0a0a-ish, warm). Massive
display type (~90px) with tight leading does the hero's work; the subhead is
one calm sentence. Whitespace discipline survives dark mode — dark pages can
still breathe. Product proof (a real UI screenshot) sits directly below the
promise. Accents are pinpricks: one yellow star, tiny status dots. Craft =
restraint at scale.

**stripe.com** — the one big gradient moment is a single hero ribbon, then the
page goes disciplined and information-dense. Type contrast (giant serif-scale
display vs small dense UI text) creates hierarchy without color. Every section
has a concrete artifact (dashboard, snippet, card) — no section is only words.

**vercel.com** — geometry + spacing as brand. Sections alternate rhythm
(full-bleed → contained → split). Buttons are quiet; the triangle mark and
type do the identity work. Proof-blocks (deploy logs, metrics) are styled as
real objects with chrome (window dots, tabs) — "product screenshot as
furniture."

## The 8 principles I hold myself to tonight

1. **Dark is a room, not a filter.** If the direction goes dark, the page is a
   lit space: card art supplies the light; surfaces respond to it (glow spill,
   reflected tint). Never "same layout, inverted colors."
2. **Warm-black, never #000.** The dark surface is navy-derived (deepened
   `foil-navy`, e.g. #0a1226-ish), keeping the No-Pure-Black rule's spirit.
   Cream survives as the text/ink color — the brand inverts, it doesn't fork.
3. **One giant type moment.** The H1 carries the fold at true display scale
   (clamp up to ~5.5rem desktop), tight leading, no gradient text. Everything
   else steps DOWN hard — type contrast is the hierarchy engine.
4. **Every section owns an artifact.** No words-only sections: the vault
   binder spread, a real alert email, a real deal row — product truth as
   furniture (Vercel's proof-block pattern), never icon-card filler grids.
5. **Accent as pinprick.** Vermillion (the hanko ink) is used like basement's
   orange: the live dot, one underline, one hover. If it exceeds a highlighter's
   footprint, it's wallpaper again.
6. **Depth is light + parallax planes, not texture.** Shadows/glows imply a
   light source consistent per page. Tiled watermarks are dead (John's verdict:
   cheap wallpaper). 2–3 scroll planes max, small deltas, CSS-only.
7. **Motion is entrance + response, never ambient noise.** Scroll-driven
   settles (CSS animation-timeline), pointer-driven holo-tilt on cards, and
   nothing else moving unprompted. `prefers-reduced-motion` = fully static.
8. **The fold closes the deal alone.** Promise ("we watch your cards") + proof
   (the cards, alive) + ONE action ("Start your vault") all visible at 390×844.
   Secondary links whisper.

## Wordmark exploration set (John's cloudy/bubbly brief)

Self-hostable Google Fonts, judged at hero AND nav size, live text only:
- **Baloo 2** — chunky rounded, confident at 600–700, holds weight at nav size.
- **Fredoka** — soft geometric rounded (was the pre-hanko wordmark; ADR-094
  retired it for clashing with the carved seal — back on the board because the
  seal treatment itself is unlocked tonight).
- **Comfortaa** — cloudiest of the three, geometric, needs weight care at 16px.

## Anti-checklist (from the four anti-references + John's four enemies)

flat/no-depth · empty/sparse · generic-AI-template · weak hero — hunted by name
every evaluation. Plus: no neon-crypto (dark ≠ hype), no sterile-enterprise
(dark ≠ cold — warmth via cream ink + card art + rounded wordmark), no
coupon-clutter.
