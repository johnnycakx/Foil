# SUMMARY.md — overnight-design-loop, 2026-07-02 (morning deliverable)

**TL;DR: The homepage is rebuilt as "the lit room" — a dark, pull-model page
where your grail cards are the light sources — and it hit the quality bar
(avg ≥ 8.5, min ≥ 7.5, two consecutive iterations). /start and /deals carry
the register's consequences (vermillion succession, plain language, grail
chips). Everything is on branch `design/overnight-loop-2026-07-02`, 8 commits,
all gates green. Nothing was pushed or deployed — the merge is yours.**

## Score trajectory (rubric: design-loop/RUBRIC.md, log: ITERATION-LOG.md)

| iter | surface | thesis | avg | min |
|---|---|---|---|---|
| 00 | all | baseline capture (John's verdict confirmed: wallpaper watermark, push-model hero, sparse) | — | — |
| 01 | home | DARK: the lit room (hero rebuild, holo-tilt, night chrome) | 8.06 | 7.0 |
| 02 | home | WARM control: the dealer's daylight table (honest, not strawmanned) | 7.81 | 7.0 |
| 03 | home | depth pass: light logic + Moonbreon focal | 8.29 | 7.8 |
| 04 | home | the Moonbreon hunt told in product fragments | 8.41 | 8.0 |
| 05 | home | the room gets a floor | **8.56** | 8.3 |
| 06 | home | sustain pass — **bar held ×2, loop terminated on quality** | **8.59** | 8.3 |
| 07 | /start | grail chips + plain words + vermillion | 8.29 | 7.5 |
| 08 | /deals | ticker jargon dies + pull hook | 8.21 | 7.5 |

## The DIVERGE verdict (your morning choice is between real alternatives)

- **DARK — "the lit room" (WINNER, iters 01→06, final commit `34e48b3`):**
  homepage-scoped night register; the card fan glows, Moonbreon leads scaled
  with the brightest halo; every section's artifact is its light source.
  Screenshots: `design-loop/gallery/iter-06/home-desktop.png`,
  `home-desktop-fold.png`, `home-mobile-fold.png`, `home-mobile.png`.
- **WARM control — "the dealer's daylight table" (iter 02, commit `efc26ac`):**
  the strongest cream homepage Foil has had — same pull bones, vermillion
  accents, binder proof shot as a navy inset. Screenshots:
  `design-loop/gallery/iter-02/home-desktop.png`, `home-mobile-fold.png`.
  To resurrect it instead: `git checkout efc26ac -- "app/(site)/page.tsx"`
  (plus re-pin the H1/night guards; 15-minute job).
- **Why dark won:** the (d) ICP and (h) card-spotlight dimensions — holo art
  visibly dims on cream and ignites on dark. Your functional argument
  ("card art is holographic art, and art pops on dark walls") is empirically
  visible in the side-by-side galleries. The warm leg's best idea (dark-wall
  inset for art) is itself evidence.

## What shipped (all on the branch, chronological)

1. **Pull-model hero** — H1 "Tell us the cards you're hunting." · sub judged
   against "what cards really sell for" · primary CTA **Start your vault** →
   `/start?src=home-hero` · newsletter demoted to the closing band (still the
   page's ONE email ask). Push-model headline is guard-forbidden now.
2. **Night register mechanism** — `--color-foil-night/night-2/vermillion`
   tokens; chrome (header/footer) reads `--chrome-*` vars flipped by
   `body:has([data-tone="night"])`. No layout fork. Homepage-scoped.
3. **HoloCard** (`components/cards/holo-card.tsx`) — THE signature: pointer
   3D tilt + foil sheen (pokemon-cards-css technique in-house). Verified live
   (`design-loop/verify-holo.mjs`): tilt/sheen/reset OK, touch never tilts,
   reduced-motion fully static. Transform/opacity only.
4. **Vault moment** — 3×3 binder proof shot with plausible targets; ninth
   pocket is the invitation. **Sample alert email** artifact with internally
   consistent numbers. **Steps as product fragments** telling one Moonbreon
   hunt ($1,900 target / $1,845 listing / ~$2,214 avg — checks out).
5. **The seal-watermark wallpaper is dead** (and guard-forbidden: no SVG
   `<pattern>` tiles on the homepage, ever again).
6. **Scroll ambience** — CSS-only `animation-timeline: view()` reveals behind
   `@supports` + reduced-motion exclusion; hero never reveals (LCP).
7. **Wordmark** — "Foil" in **Baloo 2 600** (soft cut) live in chrome at nav
   size; Bricolage stays on OG/favicon (brand-asset swaps are your follow-up
   goal, per the boundary). Face-off sheet:
   `design-loop/reference/wordmark-compare.png` (Baloo 2 vs Fredoka vs
   Comfortaa, dark + cream, hero + nav sizes).
8. **Nav** — "Your watchlist" → /start first-class; "Host a machine" → footer
   only.
9. **/start** — three one-tap grail chips with real art (verified end-to-end),
   blank-target behavior in plain words, success state links this week's
   drops (`src=start-success`), `<noscript>` fallback, full de-gold.
10. **/deals** — "NM $16.71 (7d) vs $19.19 (30d)" → "Near Mint copies: ~$16.71
    this week, usually $19.19 · 148 recent sales"; pull line "Want them for
    your cards? Start your vault →" (`src=deals`); de-gold.
11. **Vermillion succession** on every touched surface (email-capture,
    typeahead, boards, chrome hovers) — gold survives ONLY on untouched
    surfaces (card pages, blog, pillars, vending).

## Rubric compromises accepted (and why)

- **(c) depth peaked at 8.3** — stills can't show the holo-tilt or scroll
  reveals; I refused to inflate for motion the screenshots can't prove
  (it IS verified live, just not scoreable from PNGs).
- **Screenshot harness emulates reduced-motion** — full-page captures render
  scroll-driven reveals at "not entered" (blank) otherwise. The stills judge
  the static-truth fallback, which must hold anyway.
- **The warm control got 2 of 12 iterations** — the gap on (d)/(h) was
  structural (surface physics, not polish); more iterations would not flip it.
- **Vault targets are illustrative** — real cards, plausible numbers
  (Moonbreon $1,900 target vs ~$2,214 sold avg), labeled as the product's own
  UI rather than fabricated user data. If you want zero illustrative numbers,
  the pockets can render "watching" only.

## NOT done (deliberately — these are follow-up goals, not omissions)

- **/lines/[pokemon] + /cards/[slug] restyles** — /lines shipped yesterday at
  its own bar (ADR-095, sakura register); the card page's tiered-render
  logic is too load-bearing for an unattended overnight restyle. Both need
  your call on whether the night register extends beyond the homepage.
- **Dark mode beyond the homepage** — the `data-tone` mechanism makes any
  page one attribute away; extending it (esp. /start and card pages) is a
  product-register decision you should make awake.
- **Brand-asset re-rolls** (favicon/OG-template/manifest/email masthead in
  Baloo 2 / night) — explicitly out of bounds tonight per the goal.
- **Emails** — untouched, per the absolute boundary.
- **GSAP** — never needed; native CSS scroll-timeline carried everything.
- **Blog index collector/vending split** (fable-design-overhaul §5) — content
  scope, not design-loop scope.

## Your morning commands

```powershell
# 1. Review the branch (you are probably already on it; verify)
git checkout design/overnight-loop-2026-07-02
git log --oneline main..HEAD          # 8 design commits
npm run dev                            # walk / , /start, /deals — hover the hero cards

# 2. Compare directions side-by-side (galleries)
#    dark:  design-loop/gallery/iter-06/
#    warm:  design-loop/gallery/iter-02/
#    baseline (what it replaced): design-loop/gallery/iter-00-baseline/

# 3. Merge (if the dark direction is a go)
git checkout main
git merge --no-ff design/overnight-loop-2026-07-02
git push origin main                   # Vercel auto-deploys

# 4. Post-merge checks (the "green tests lie" gate)
#    - OG re-verify: share foiltcg.com in a X/Discord draft — card must render
#      (homepage OG untouched, but re-verify per the blank-OG regression class)
#    - Live walk: home (hover the fan, scroll the reveals), /start (tap a
#      grail chip), /deals on your phone
CONTENT_VERIFY_BASE_URL=https://foiltcg.com npm test   # content-marker live verification
npm run design:lint
```

Gates at handoff: `npx tsc --noEmit` clean · `npm test` 1,418 tests / 0 fail ·
`npm run design:lint` clean on touched surfaces · /security-review: see
SESSION-LOG entry. **No push happened. The merge is yours.**
