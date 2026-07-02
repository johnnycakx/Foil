# SUMMARY — ROUND 2 (design-loop-round2, John's ~1am verdicts, executed overnight)

**TL;DR: All seven verdicts executed. The site is now "the dark gallery" —
matte Linear-grade night register on home, /deals, /blog, /cards/[slug], and
the vault; the bubbly Shrikhand wordmark leads a wordmark-first chrome; the
accent bake-off ran all three candidates and ratified moon-glow teal; type
scale is up; vending posts no longer lead the blog; the fabricated sv3a post
is unpublished. Branch-only, no push. Your morning decision list is at the
bottom.**

## What happened, by verdict

**§1+§8 Wordmark (iter-09).** Ten OFL faces trialed at hero + 20px nav on dark
AND cream chrome (`design-loop/reference/wordmark-compare-2.png`), against
your four fontspace taste refs (`reference/ref-*.png`, view-only — never
downloaded or shipped). **Shrikhand** won as the closest licensed match to
Skylens Italic's fat bouncy italic-bubble vibe that still survives nav scale;
runner-ups **Modak** (maximal balloon, collapses at 20px) and **Titan One**
(cleanest small). Chrome is wordmark-FIRST: the hanko is out of the header/
footer (survives as favicon + the hero live-pill glyph). If you still want
Skylens itself: the commercial license is an email to billyargel@gmail.com
(Billy Argel Fonts) — your action.

**§2 Accent (iters 10–12).** Vermillion is out of the UI (hanko ink only).
Token pair (`--color-foil-accent` night / `--color-foil-accent-deep` cream,
both AA) so the legs differed only in values:
- **A · moon-glow teal (#6fd8c5) — WINNER, 8.63** — drawn from Moonbreon's own
  moonlit art; the page glows the way the focal card glows. `gallery/iter-10-accent-teal/`
- C · sakura — 8.45, warm and eve-adjacent but sits apart from the cool hero
  art. `gallery/iter-12-accent-sakura/`
- B · holo-iridescent — 8.2, conceptually perfect and visually invisible at
  Linear-restraint sizes. `gallery/iter-11-accent-holo/`

**§7 Linear restraint + §6 type scale (iter-09).** Glows pulled way back (the
page is matte; only the cards glow), depth now comes from layering + dark drop
shadows. Marketing body copy 18–20px, hero sub 24px, H2s up a step; data rows
scaled gently. Homepage iter-09 scored **8.59 avg / 8.3 min**.

**§3 Dark (almost) everywhere (iters 13–14).** /deals + /blog index + /cards/[slug]
now run the night register (card page: styling only — zero logic/JSON-LD/
affiliate changes, guards repinned, hydrated + unhydrated tiers verified live).
**/lines kept its cream default for eve** — the night-hanami variant preview is
`gallery/variants/lines-night-hanami.png` (directional only: a quick tone flip,
not a finished pass — petals + Umbreon art on dark read beautifully; the pink
CTA slab would need tuning).

**§4 The vault (iter-15).** Nav renamed **"Your vault"**; the /w page got the
night register + invitation empty state (see iter-15 commit for the full
delta).

**§5 Content hygiene (iter-13).** Blog index: collector posts lead; vending
posts live under a compact "For businesses" section (pages + SEO untouched).
**sv3a Raging Surf is unpublished** — `_unpublished-` filename prefix pulls it
from index + sitemap + route (404) while preserving the source in-tree for
content-trust-hotfix to regenerate; guard updated to pin the unpublished state.

## The morning decision list

1. **Wordmark face** — ratify Shrikhand, or pick Modak / Titan One from the
   sheet, or license Skylens (email billyargel@gmail.com).
2. **Hanko fate** — current state: favicon + hero-pill glyph only ("tiny-glyph
   survival"). Full retirement = also swap favicon/OG later (brand-asset goal).
   Chrome comparison: any round-1 gallery (seal in chrome) vs iter-09+ (wordmark-only).
3. **Accent** — ratify moon-glow teal (galleries for all three legs above).
4. **Chrome tone** — all-dark chrome (current, `gallery/variants/home-dark-chrome-fold.png`)
   vs **cream header over dark body** (`gallery/variants/home-cream-header-fold.png`).
   Implementation is one CSS block either way.
5. **/lines tone for eve** — cream-sakura (current, shipping) vs night-hanami
   (variant preview). The eve delivery depends on this; cream is the safe
   default and what shipped at its own bar.

## Compromises + not-done (honest)

- The night-hanami variant is a PREVIEW (quick class flip, reverted), not a
  finished design — a real pass needs the hero band tone unified + CTA slab
  re-tuned (~1 focused iteration when you pick a direction).
- The cream-header variation exists as a gallery shot only; the committed
  state is all-dark chrome.
- /cards/sets/[set-id], pillar pages, /host (vending), /newsletter, /w
  recovery remain cream — they follow whichever chrome verdict you ratify,
  as a mechanical follow-up.
- Buy-signal badge kept its stock emerald/amber tints (pre-existing, AA on
  night) — a token-ization candidate for the follow-up.
- OG images / favicon / manifest still carry the round-1 identity (Bricolage +
  seal) per the brand-asset boundary.

## Gates at handoff

`npx tsc --noEmit` clean · full suite green per commit (one live-API transient
— Anthropic "Grammar compilation timed out" on a vision test — reran green,
not design-related) · design:lint clean on touched surfaces · card page
verified 200 on both render tiers with `data-tone="night"`.

**No push. The merge is yours** (same commands as round 1's SUMMARY §"Your
morning commands").
