# ITERATION-LOG.md — overnight-design-loop, 2026-07-02

> **ROUND 2 (design-loop-round2.md, John's ~1am verdicts) runs iters 09+ at the
> BOTTOM of this file.** Budget 10 iterations. Verdicts: bubbly wordmark
> (hanko demoted — wordmark-first chrome), vermillion OUT (bake-off: moon-teal
> vs holo-iridescent vs sakura, on-dark AA), dark extends to /deals + /blog
> index + /w + /cards/[slug] (styling only; /lines keeps cream default,
> night-sakura variant gallery-only), vault designed + nav renamed "Your
> vault", blog vending split + sv3a unpublish, type scale UP (marketing body
> 18–20px), Linear restraint (matte dark gallery, cards glow / page doesn't),
> cream-header variation galleried. Skylens Italic is John's fave but
> PERSONAL-USE-ONLY — never ship/commit; trial licensed lookalikes
> (Shrikhand etc.); license note goes in SUMMARY.

Scored per design-loop/RUBRIC.md, from the screenshots in
design-loop/gallery/iter-NN/, as a hostile critic. Dimensions:
(a) pull-clarity · (b) craft · (c) depth · (d) ICP · (e) mobile ·
(f) plain-language · (g) perf · (h) card-spotlight.

---

## iter-01 — DARK direction: "the lit room" (dark pull-model hero rebuild)

**Thesis:** Night register (homepage-scoped via data-tone + body:has chrome
flip). Cards as the light sources: arced grail fan with holo-tilt + light
spill. Pull-model hero (H1 "Tell us the cards you're hunting," CTA "Start your
vault" → /start). Vault binder proof shot, pull-loop steps, sample-alert
artifact, newsletter demoted to closing band. Seal-watermark wallpaper killed.
Baloo 2 soft wordmark in chrome. Gold swept from touched surfaces (vermillion
succession). Nav: Your watchlist in, Host-a-machine footer-only.

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Fold = promise + one cream CTA; mobile fold complete. Sub slightly long. |
| (b) craft | 7.5 | Fold strong; below-fold left columns run empty on desktop; steps section plain. |
| (c) depth | **7.0** | Hero light-spill works; below the fold the page goes FLAT — one panel tone, hairlines only, no layered planes or light logic. |
| (d) ICP | 7.5 | Binder-with-targets is collector-brained; plausible numbers. Not yet screenshot-bait — no single "whoa" focal moment. |
| (e) mobile | 8.0 | Fold composition genuinely good; fan peek reads deliberate. |
| (f) plain-language | 9.0 | Zero jargon; "what cards really sell for" register throughout. |
| (g) perf | 8.5 | CSS-only ambience; local eager webp; one added font (Baloo 2). Nothing on critical path. |
| (h) card-spotlight | 8.0 | Cards light the fold + binder; desktop fan could own more of the giant dark expanse. |

**avg 8.06 · min 7.0 (depth)**

**Weakest:** (c) depth below the fold — the night surface reads as one flat
sheet after the hero. (b) is the sibling: desktop section layouts leave dead
dark space.

**Harness note:** full-page screenshots evaluate animation-timeline reveals at
"not entered" (blank sections) — shoot.mjs now emulates prefers-reduced-motion,
so stills capture the static-truth render (the fallback that must hold anyway).

**Next thesis (iter-02):** DIVERGE leg 2 — the evolved-warm control (cream
register, same pull-model bones, light-based depth, vermillion accents, no
strawman). Dark's depth pass follows in iter-03.

---

## iter-02 — WARM direction: "the dealer's daylight table" (evolved-warm control)

**Thesis:** Same pull-model bones on the cream register, evolved — vermillion
accents, navy-tinted physical shadows on the fan, and its OWN earned moment:
the binder proof shot as a NAVY dark-wall inset (holo art gets its dark
backdrop inside the warm page). Not strawmanned: this is the strongest cream
homepage Foil has had.

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Identical structure; fold works. |
| (b) craft | 7.5 | Sections clean; but the alert email panel is cream-on-cream — barely separates. Hero wash imperceptible. |
| (c) depth | 7.0 | Fan shadows give physical presence; binder inset is a real layer; the rest is flat paper. |
| (d) ICP | **7.0** | Warm collector energy, but reads "nice editorial SaaS" — a document, not a place. Less screenshot-pull than the lit room. |
| (e) mobile | 8.0 | Same bones. |
| (f) plain-language | 9.0 | Same copy. |
| (g) perf | 8.5 | Same. |
| (h) card-spotlight | **7.0** | The decisive dimension: holo art visibly dims on the bright surface. The navy binder inset restores it — and in doing so PROVES the dark thesis. |

**avg 7.81 · min 7.0**

**DIVERGE verdict: DARK WINS (8.06 vs 7.81).** The gap is structural, not
polish-level — (d) and (h) fail for the warm direction precisely where John's
functional argument predicted: holographic card art is a light source, and
light sources need a dark room. The warm control's best section (binder on
navy) is itself evidence. What the warm leg contributes to the winner: the
inset-contrast idea — a single CREAM artifact (the alert email) glowing inside
the dark page is the same trick inverted, already present in iter-01; keep it
and sharpen it.

**Next thesis (iter-03):** CONVERGE on dark — the depth pass. Below-fold
spatial identity: light logic per section, tighter left columns, bigger fan
presence, one focal "whoa" (Moonbreon center-stage).

---

## iter-03 — CONVERGE: the depth pass (dark)

**Thesis:** Moonbreon as the focal card (scaled, brightest glow, leads the
fan); [text-wrap:balance] on the H1; vermillion live-ping in the pill; per-
section light spills (each section's artifact is its light source — binder and
email glow onto the night surface); panel elevation shadows; left columns
filled with real micro-artifacts (sold-history stat strip; alert reassurance
bullets).

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Unchanged fold logic; balanced H1 reads cleaner. |
| (b) craft | 8.0 | Columns balanced; the dl stat strip is the weakest element (label copy slightly widget-y). |
| (c) depth | **7.8** | Light logic now consistent (artifact = light source per section); spills subtle in stills. Steps band still the flattest. |
| (d) ICP | 8.0 | Moonbreon leading the fan is the community-correct focal choice. |
| (e) mobile | 8.0 | Focal scale holds at 390 (scale-112 mobile). |
| (f) plain-language | 9.0 | Bullets stay plain ("before we bother you"). |
| (g) perf | 8.5 | All additions CSS-only. |
| (h) card-spotlight | 8.5 | Focal card + binder + alert thumb — art carries every section. |

**avg 8.29 · min 7.8** (bar: 8.5/7.5 ×2 — not yet)

**Weakest:** (c) depth — the steps band is the last flat stretch; stat-strip
craft.

**Next thesis (iter-04):** steps as MINIATURE PRODUCT ARTIFACTS (a real
typeahead chip, a real price input, a real judged-listing row, a real subject
line) — the Vercel proof-block principle, NOT an icon grid; polish stat-strip
copy; sleeve-glint inset on binder pockets.

---

## iter-04 — CONVERGE: the Moonbreon hunt told in product fragments

**Thesis:** The four steps carry miniature REAL product artifacts telling one
continuous story ("One hunt, start to finish — here's Moonbreon's"): typeahead
chip → $1,900 target input → $1,845 judged-listing row (17% under the ~$2,214
sold avg — internally consistent) → the email subject. Stat strip replaced
with the section-grammar bullets (eyebrow → h2 → body → vermillion-dot bullets
→ link, consistent across sections). Pocket hover lift.

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Fold unchanged; still one obvious action. |
| (b) craft | 8.3 | Unified section grammar; artifacts consistently styled; step-3 pill slightly loud. |
| (c) depth | **8.0** | Every section owns an object; hero still the only true "room" moment. |
| (d) ICP | 8.3 | The Moonbreon narrative is collector-brained screenshot material. |
| (e) mobile | 8.2 | Full page coherent at 390; steps stack cleanly with artifacts. |
| (f) plain-language | 9.0 | Artifacts speak product truth in plain words. |
| (g) perf | 8.5 | All static markup + CSS. |
| (h) card-spotlight | 8.5 | Art carries hero, binder, alert; steps stay quiet. |

**avg 8.41 · min 8.0** (bar: 8.5/7.5 ×2 — one step away)

**Weakest:** (c) — the lit room lacks a FLOOR; the light spill is too subtle
to register in stills; mobile fan could carry more art.

**Next thesis (iter-05):** the room gets a floor — a glossy-surface reflection
glow under the fan, brighter hero spill, larger mobile fan presence.

---

## iter-05 — CONVERGE: the room gets a floor

**Thesis:** Brighter hero light spill (0.10 → 0.16 — now visible in stills), a
thin pool of reflected light under the fan (the cards stand ON something),
mobile fan cards up to 6.75rem with tighter overlap (more art in the
screenshot unit).

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Fold logic unchanged, cleaner light hierarchy. |
| (b) craft | 8.4 | Fold composition resolved; step-3 pill still slightly cramped. |
| (c) depth | 8.3 | The room finally reads in stills: light source, floor, standing objects. |
| (d) ICP | 8.6 | Desktop + mobile folds are both screenshot-bait now — Moonbreon glowing center-stage. |
| (e) mobile | 8.4 | Bigger art, focal intact, no overflow issues. |
| (f) plain-language | 9.0 | Unchanged. |
| (g) perf | 8.5 | Two more static CSS gradients, nothing on the critical path. |
| (h) card-spotlight | 8.8 | The cards ARE the page's light — thesis fully realized above the fold. |

**avg 8.56 · min 8.3 — BAR HIT (1 of 2 consecutive needed)**

**Next thesis (iter-06):** sustain pass — no-regression polish (step-3 pill
sizing, live interactive verification of the holo-tilt in a real browser,
micro-spacing), re-score. If the bar holds, the loop terminates on quality and
remaining time goes to extending the won register's polish to /start + /deals
(de-gold → vermillion, plain-language sweep) as scoped follow-through.

---

## iter-06 — CONVERGE: sustain pass (bar held)

**Thesis:** No-regression polish + live interactive verification. The step-3
pill wraps safely (whitespace-nowrap + flex-wrap). **Holo-tilt verified in a
real browser** (design-loop/verify-holo.mjs): pointer sweep → real 3D matrix +
sheen opacity 1, pointer leave → clean reset to 0.5/0.5, and under
prefers-reduced-motion the card never tilts (listeners bail). 

**Scores:**
| dim | score | note |
|---|---|---|
| (a) pull-clarity | 8.5 | Unchanged. |
| (b) craft | 8.5 | Pill fixed; no remaining cramped elements found. |
| (c) depth | 8.3 | Unchanged (still-image ceiling without motion). |
| (d) ICP | 8.6 | Unchanged. |
| (e) mobile | 8.4 | Unchanged. |
| (f) plain-language | 9.0 | Unchanged. |
| (g) perf | 8.6 | Motion now VERIFIED live: transform-only, reduced-motion fully static. |
| (h) card-spotlight | 8.8 | Unchanged. |

**avg 8.59 · min 8.3 — BAR SUSTAINED (2 consecutive ≥ 8.5 / ≥ 7.5).
The homepage loop TERMINATES ON QUALITY.**

**Remaining budget** goes to the brief's follow-through surfaces in priority
order — /start → /lines polish → /deals — carrying the won register's
consequences (gold → vermillion, plain language, chrome coherence) WITHOUT
migrating them dark (form/data surfaces staying cream is the deliberate
marketing-dark / task-light split; John decides any full dark migration awake).

---

## iter-07 — /start: the money page earns the vault name

**Thesis:** Kill the blank-form cold start — three one-tap grail chips with
real card art (Moonbreon / Base Charizard / Giratina V alt, catalog-guarded);
blank-target behavior explained in plain words; success state gains the
/deals retention hook (src=start-success); full gold → vermillion sweep
(form, typeahead, page shell); `<noscript>` fallback (newsletter + mailto).

**Verified live:** chip click → card added with target row, button reads
"Track 1 card", chips row hides after pick (design-loop/verify-chips.mjs).

**Scores (rubric applied to /start):**
(a) 8.5 · (b) 8.0 · (c) 7.5 (flat but task-appropriate) · (d) 8.3 (grail
chips are collector-instant) · (e) 8.2 · (f) 9.2 (blank-target copy) ·
(g) 8.8 · (h) 7.8 — **avg 8.29 · min 7.5.** A form page doesn't need
spectacle; it needed a warm start and honest words, and now has both.

**Next thesis (iter-08):** /deals — de-gold, methodology copy tightened to the
pull promise ("want them for YOUR cards? → /start"), consistency pass.

---

## iter-08 — /deals: plain words, vermillion, the pull hook

**Thesis:** The ticker jargon dies — "NM $16.71 (7d) vs $19.19 (30d) · 148
sales" becomes "Near Mint copies: ~$16.71 this week, usually $19.19 · 148
recent sales"; "below 30-day avg" → "below its average"; "vs 30-day" → "vs its
average". Full gold → vermillion on the page + both boards (coral hovers →
vermillion for succession coherence). New pull-promise line under the boards:
"These are this week's drops across the whole market. Want them for your
cards? Start your vault →" (src=deals).

**Scores (rubric applied to /deals):**
(a) 8.3 (board self-explains; pull hook present) · (b) 8.0 · (c) 7.5 (data
table register, appropriately flat) · (d) 8.0 · (e) 8.3 (mobile rows
self-label in sentences) · (f) 9.0 (the jargon is gone) · (g) 8.8 (zero new
weight) · (h) 7.8 (thumbs only — art density is the card pages' job) —
**avg 8.21 · min 7.5.**

**Loop status after iter-08:** homepage terminated on quality (iters 5+6);
/start and /deals carried the register's consequences. /lines/[pokemon] and
/cards/[slug] inspected in the gallery and left untouched — /lines shipped
yesterday at its own bar (ADR-095) and the card page's tiered-render surface
is too load-bearing for an unattended overnight restyle; both are morning-
scope with John (see SUMMARY).


---

## iter-09 â€” ROUND 2: "the dark gallery" (restraint + type crank + balloon wordmark)

**Thesis (John's verdicts 6+7+1+4):** Linear register â€” glows pulled way back
(hero spill 0.16â†’0.07 + vermillion tint gone, floor pool 0.035, card glows
dimmed/tightened, binder panel glow â†’ dark drop shadow, alert halo 0.04):
matte walls, art lit, chrome silent. Type scale cranked (hero sub 20â†’24px,
section H2s 4xlâ†’5xl, marketing body â†’18px, steps/bullets â†’16px). Wordmark:
**Shrikhand** won the ten-face bubbly bake-off (closest OFL match to John's
personal-use-only Skylens Italic ref; survives 20px nav) â€” chrome is now
wordmark-FIRST (seal demoted out of chrome; survives in favicon + hero pill
pending the morning call). Nav renamed "Your vault".

**Face-off evidence:** design-loop/reference/wordmark-compare-2.png (Modak /
Titan One / Bagel Fat One / Chewy / Shrikhand / Luckiest Guy / Lilita One /
Fredoka 700 / Lobster Two BoldItalic / Baloo 2 oblique, hero + nav, dark +
cream chrome) + the four fontspace taste-ref shots (ref-*.png, view-only).
Runner-ups for the morning list: Modak (maximal balloon, weak at nav size),
Titan One (cleanest small-size survivor).

**Scores:** (a) 8.5 Â· (b) 8.7 (restraint + scale + the wordmark charm) Â·
(c) 8.3 (layering does the depth now â€” quieter per directive) Â· (d) 8.7
(sticker test: "Foil" in Shrikhand is an ownable mark) Â· (e) 8.3 Â·
(f) 9.0 Â· (g) 8.5 (font swap net-zero: Baloo out, Shrikhand in, one weight) Â·
(h) 8.7 (cards are now the ONLY glow) â€” **avg 8.59 Â· min 8.3.**

**Next (iters 10â€“12):** the accent bake-off on this restrained base â€” one
iteration per candidate, token-swapped so the legs differ ONLY in accent:
(10) moon-teal from Moonbreon's palette Â· (11) holo-iridescent interactive
accents Â· (12) sakura. Two-tone token pair (--color-foil-accent on night,
--color-foil-accent-deep on cream) so AA holds on both surfaces.



---

## iters 10â€“12 â€” ROUND 2: the accent bake-off (vermillion OUT)

**Method:** accent token pair (`--color-foil-accent` night / `--color-foil-accent-deep`
cream) plumbed through every touched surface, so the three legs differ ONLY in
the tokens (+ leg B's scarce gradients). Vermillion survives solely as the
hanko INK (seal geometry, favicon) â€” zero accent classes reference it.

**Leg A â€” moon-glow teal (#6fd8c5 / #0e7c6b), gallery/iter-10-accent-teal:**
Drawn from Moonbreon's own moonlit palette â€” the page glows the way the focal
card glows. Distinct at every size, expensive on the matte night, deep variant
handsome on cream. Contrast: ~8:1 on night, 4.85:1 on cream â€” AA both.
**avg 8.63.**

**Leg B â€” holo-iridescent (#a9c6f5 + foil gradients), gallery/iter-11-accent-holo:**
Conceptually the most on-brand ("foil accents on a foil site") but at Linear-
restraint sizes it VANISHES â€” pale blue eyebrows read as muted cream, the
gradient underline/dot are too small to register as iridescent. Scarcity
became invisibility. **avg ~8.2.**

**Leg C â€” sakura (#d98aa0 / #a5546e), gallery/iter-12-accent-sakura:**
Visible, warm, romantic, eve-adjacent (the /lines register promoted). But the
pink sits apart from the cool moonlit hero art â€” it decorates the page rather
than emerging from it. Contrast AA both surfaces. **avg ~8.45.**

**VERDICT: MOON-GLOW TEAL RATIFIED** (subject to John's morning sign-off; all
three legs galleried + committed for comparison). Tokens set to leg A; leg B's
gradient artifacts reverted; no accent archaeology remains (the sweep is the
token pair itself).


---

## iters 13-15 - ROUND 2: dark everywhere + hygiene + the vault

**iter-13** /deals + /blog night (boards re-toned, cream CTA buttons; collector posts lead the index, vending under 'For businesses'; sv3a unpublished via _ prefix, guard repinned). Scores: /deals on night reads richer than cream - the thumbs pop; est avg 8.4.

**iter-14** /cards/[slug] night, STYLING ONLY (subagent execution under strict brief; guards repinned with citations; hydrated + unhydrated tiers verified 200 + data-tone). The Moonbreon card page on night is the strongest single surface of the whole loop - est avg 8.6.

**iter-15** the vault /w: night register + invitation empty state (subagent; gated).

**Variants galleried (shot-and-reverted, committed state unchanged):** cream-header-over-dark-body chrome vs all-dark (variants/home-*.png); /lines night-hanami preview (variants/lines-night-hanami.png - directional only, cream default ships to eve).

---

## ROUND 3 (design-round3-fixes) - iters 16-18, rubric (a)hero-depth (b)data-viz (c)sakura (d)rhythm (e)coherence

**iter-16 - the fan becomes a real lit fan [fixes 1/4/5].** Depth slots (focal Moonbreon ~1.35x + teal rim-glow; neighbors step down + rotate away + blur/darken toward edges; z-stack from center), VISIBLE floor (contact shadow + reflection pool), edge fade mask (no hard crops), dead band killed (paddings tightened, pitch pulled up), wordmark pure lettering at 24px both tones. Fold shot: gallery/iter-16/home-desktop-fold.png - the flagship miss is fixed; the fan reads lit + grounded. Scores: (a) 9.0 (d) 8.5 (e) 8.5.

**iter-17 - the spread gets drawn [fix 2, /deals + card].** Two-point dumbbell per mover row (cream anchor = usual price, teal dot = this week, distance = % below; real aggregates only), magnitude depth bar on below-sold rows (ADR-054: never the ask position), thumbs 64px + dark shadow, stock white pills -> teal ghost buttons. Card-page: SoldHistoryChart already draws real history (de facto done, verified). Shot: gallery/iter-17/deals-desktop.png. Scores: (b) 8.7 (e) 8.6.

**iter-18 - sakura hanami + /lines structure [fixes 2-lines/3/6]** (subagent under strict brief; see commit + report): real SVG petals in two depth layers with density gradient + hero wash, drift motion-safe only; spread/pending chips on tiles; era grouping; lineup strip unified + edge-faded; empty-slot verdict recorded.

**ROUND-3 FINAL SCORES (rubric a-e):** (a) hero depth 9.0 - the fan is lit + grounded, mobile included · (b) data-viz 8.6 - dumbbells/bars/chips drawn from real aggregates only · (c) sakura 8.8 - hanami at a glance; root-cause keyframe bug found + fixed · (d) rhythm 8.5 - dead band gone, cascade holds at 1440 + 390 · (e) coherence 8.6 - one system night+cream, no stock tells left on touched surfaces. **avg 8.70 · min 8.5 - BAR HIT (>= 8.5 / >= 8.0) with all six fixes visibly landed in gallery shots. Round 3 exits on quality at 3 of 6 iterations.**

---

## iter-21 - binder-aesthetic-pass (bar hit iteration 1 of 2)

**Fix 1 - the binder page:** VAULT_POCKETS = the SV-151 Gen-1 starter evolution lines in order (Bulbasaur->Venusaur ex / Charmander->Charizard ex / Squirtle->Blastoise ex, IR/SIR printings) - one curated painterly composition instead of clashing rainbow chase cards. All nine slug-verified in the catalog with baked market data (spot-checked two pages rendering prices); targets sit 10-12% under the real holofoil market figures (bake 2026-07-01); art self-hosted under public/binder/ (ADR-056 rationale); the tenth pocket stays the invitation.

**Fix 2 - hanami comes home:** components/sakura-ambience.tsx ports the /lines petal machinery (notched-teardrop SVG + breeze/amp/wobble physics) at ambient density: homepage night mode 16 petals (6 near brighter-tinted for charcoal, 10 far), /deals + vault headers 9 far-only. Density ladder 28 (/lines flagship) > 16 > 9. All deterministic, motion-safe gated, pointer-events-none, under content.

**Skill trace:** impeccable-quieter -> the density ladder + the restraint verdict on the /deals shot (petals read as atmosphere, none touch a data row); soft-skill -> kept the physics identical to /lines (mass-plausible drift, no new motion grammar); frontend-design -> the sequencing-is-the-aesthetic pocket order + plain card names (dropped IR/SIR abbreviations from captions - the art says it).

**Shots:** gallery/iter-21-binder/ (home full + 1152 + 390, deals fold + mobile). Guards: pocket evolution order + /binder art existence + ambience determinism/mounts/density pinned. Gates: 1,428 tests (1,410 pass incl. 2 new guards) / 0 fail - build 208/208 - lint clean on touched surfaces.

## iter-22 - petal-fidelity-pass (bar hit iteration 2 of 3)

**The root fix - geometry before density:** components/lines/petal-shapes.ts is now the ONE petal source of truth: three distinct silhouettes (classic notched teardrop / wind-curl / slender - the notch is THE sakura identifier), a five-petal blossom used sparingly (2 on /lines, 1 on home, 0 on headers), a two-stop radial gradient per ground (pale center -> deeper pink edge; night #f0c3d0->#c9718c, day #eeb7c8->#c05a7b) + hairline edge stroke, and MIN_PETAL_PX=9 (below that a petal is a dot, whatever the path). Winner picked off a static screenshot grid at 32/26/20/14/10px on charcoal + cream - the 3-stop gradient candidate washed out gray and lost; the old prod path at any size confirmed the "pink dot" verdict.

**Density 3x, ladder preserved, deterministic:** hand-authored ZONES (the art direction: sky band, margins, around the fan, never over body text at rest) x a seeded mulberry32 field builder (no Math.random - guards forbid it) = /lines 78 + 2 blossoms > home 48 + 1 > headers 30. Margin zones gate max-sm:hidden (mobile text spans full width). Iter-1 -> iter-2 fix: a far-only header field on charcoal read as blurred smudges (the dot bug reborn), so headers carry a 5-petal SHARP minority in the side margins - verdict-1 (shape read) outranks far-layer purity.

**Perf (the honest number):** 4x-CPU-throttle rAF probe (design-loop/perf-petals.mjs, reusable). Dev-mode: /lines 84 petals at blur-[2px] = ~55fps -> blur to 1px + backed the two least-visible /lines zones off 12/12 -> 10/8 (84 -> 78). Reduced-motion baseline 240fps pinned the cost to the animated field itself, not the page. Final prod-build numbers in the SESSION-LOG entry.

**Assets on the same geometry:** banner.html rebuilt (petals 18-42px static-fidelity + one blossom per variant, wordmark 120/132/110 -> 168/176/150px, variant-B tagline collision fixed) and shot NATIVELY at 1x/2x/3x via deviceScaleFactor to gallery/banner-v2/ (no CSS upscaling; @3x wordmark crop verified sub-pixel crisp). Lines OG: border-radius blob petals replaced with shared-path gradient petals as data-URI imgs + one blossom (Satori-safe; render eyeballed, gallery/petal-fidelity/og-umbreon.png). favicon.svg/icon.svg re-cut on the classic path + PNGs regenerated.

**Skill trace:** frontend-design -> "botanical fact, not particle dust": the two-stop gradient direction + notch-carries-the-read geometry + cluster-into-open-zones art direction; impeccable (craft) -> the static shape-read bar ("a stranger says cherry blossom at 100% zoom with zero motion context"), the preview-grid verification method, the blossom 1-2-per-viewport restraint cap, and the header smudge -> sharp-anchor fix; emil-design-eng -> far layer falls SLOWER than near (22-29s vs 15-20s, parallax mass), per-petal negative delays so no two share a phase, transform/opacity only, reduced-motion = static scatter (unchanged contract).

**Shots:** gallery/petal-fidelity/ (iter-1, iter-2, og-umbreon; final post-build shots per SESSION-LOG). Guards: one-source-of-truth tripwire (favicon/icon/banner byte-synced to petal-shapes.ts, OG blob banned), density ladder sums pinned (78/48/30), MIN_PETAL_PX floor pinned in component + builder, blossom caps pinned, blur-[1px] pinned.

---

## iter-23 - hero-fan-widescreen-fix (bar hit iteration 2 of 3)

**Bug (John, live at ~2100px+):** the fan was frozen at its 1024-tuned size (fixed lg widths, max-w-6xl cage) — floating small and bunched in empty charcoal at wide/ultrawide.

**Skills invoked + the concrete change each drove:**
- **frontend-design** → the fan OPENS, not just enlarges: two separate fluid factors — `--fan-s` (card scale/overlap/floor/container) and the faster-growing `--fan-w` (arc amplitude) with `--fan-r` (rotation, damped to 55% of --fan-w) — so at 2560 the hand spreads like a fan opening; caps 1.34/1.45 at ~2200px, judged on the shot matrix as the width where the composition stops improving.
- **impeccable (layout)** → one token source: every lg dimension is `calc(base * var(--fan-*, 1))` off vars defined once on the fan container (no per-card arbitrary values); the container max-width and vertical breathing derive from the same scale so the edge-dissolve mask tracks the hand; the sub-lg ladder untouched.
- **emil-design-eng** → NOT invoked: zero motion values touched (holo-tilt, hover transitions, petal physics all unchanged — static pose only).

**iter-1 (broken, kept as exhibit `iter-1/iter1-2560.png`):** naive `1 + (100vw - 1440px)/2600` is TYPE-INVALID CSS (number + length) — the custom property computes to garbage and every dependent declaration goes to UNSET, rendering giant flat natural-width cards. Score: 2560 ≈ 1.
**iter-2 (bar hit):** `tan(atan2(a, b))` = a/b as a real unitless number (Baseline 2023) + `var(--fan-*, 1)` fallbacks so non-supporting browsers degrade to the 1440 composition, never to unset.

**Rubric (a: one lit grounded object · b: no bunching/tucking/slivers · c: page uses its width · d: sub-1440 unchanged):**
390: 9.0 · 768: 8.7 · 1024: 8.7 · 1152: 8.7 · 1280: 8.7 · 1440: 8.7 (vars ≡ 1, the John-approved tuned composition) · 1680: 8.7 · 1920: 8.8 · 2560: 8.4.
**avg 8.71 / min 8.4 — bar (≥8.5 / ≥8.0) MET.** Petals verified coexisting at 2560 (field scales with the hero, none over text at rest). Shots: `gallery/hero-widescreen/iter-2/`.

---

## iter-24 - hero-polish-followups (bar hit iteration 1 of 2)

**John's post-deploy verdicts (2026-07-03 ~01:15, ~2100px):** (1) Rayquaza VMAX still tucked to a sliver behind Giratina; (2) the alert mock wears the retired seal + old lockup; (addendum) (3) the mock's figures are invented ($162/$189 vs Giratina's real market).

**Skills (loaded in-session, per-change trace):**
- **frontend-design** → REMOVAL over re-spread: a 7-card fan that composes beats 8 with a sliver — judged on the matrix, both wings now 3 cards with mirrored depth/tilt/arc cadence (Pikachu inherits the far-edge slot with its luminance-equalized treatment, mirroring Base Charizard). Also the mock-as-artifact principle: the sample alert mirrors what the REAL alert renders (ADR-091 evidence line, ADR-079 text-forward, one quiet underlined link — the navy button pill dies).
- **impeccable (craft/honesty)** → figures derive from the data path, never literals: `getSnapshotSold("swsh7-215...")` (the same committed outlier-suppressed basis the vault/lines read), listing computed at the exact ADR-091 market floor (`soldCents * 0.85`); featured card switched to Moonbreon (snapshot-guaranteed sold basis + the fan's focal — narrative coherence). Honest soft-fail: no snapshot → copy without invented numbers.

**Shots (`gallery/hero-widescreen/polish/`):** hero-2100 (every card reads, no sliver — 8.8) · hero-1440 (tighter 7-card balance — 8.7) · hero-390 (5-card mobile fan, unchanged breathing — 8.8) · alert-section-1440 (real $2,214 sold avg → $1,882 floor listing, plain "Foil" from-row, quiet link — pass). Bar met iteration 1.

**Class closed:** UI-wide retired-asset tripwire (visual-regression) — NO file under app/ or components/ may reference SealMark/FoilCornerMark/SEAL_VERMILLION/#d85a30 except the logo.tsx definition site; swept the two other survivors it caught (hero live-pill, sold-history-panel heading). Mock-figures guard: no `$<digit>` literal in SampleAlert + data-level pin that the snapshot carries real sold data for the featured slug.

**Flagged, not crept:** the PullLoop step-chips carry hand-written Moonbreon figures ($1,900 target / $1,845 / 17%-under) — currently ~accurate against the real $2,214 basis, but the same literals class; candidate follow-up to extend the derive-from-snapshot discipline.

---

## iter-25 - hero-chase-belt (bar hit iteration 1 of 4; motion felt-review = John, pre-push)

**Skills invoked + the concrete change each drove:**
- **emil-design-eng** → the three motion laws of the belt: LINEAR drift (constant-motion class, never eased), pause-as-deceleration (speed proxy tweened to 0 over 0.45s power2.out on hover/focus/offscreen/hidden — nothing halts instantly), and hover shine gated to `(hover:hover) and (pointer:fine)` so touch taps never strand a stuck state. Also: transform written directly to the track by the ticker (no per-frame CSS vars — I-011).
- **frontend-design** → the hero-as-thesis: the wheel IS the claim ("everything you'd chase, we're already watching") — 200 real chase cards, no mascot, self-updating with each bake; the fan survives only as the reduced-motion fallback.
- **impeccable** → honesty + restraint: every face links a real data-bearing page (catalog-join enforced at selection), the widget is a quiet service card (sakura accent, no gold, not a billboard), adjacency-arranged so the wheel reads like the hobby drifting past.

**Iter-1 (bar hit):** 26-node windowed recycling over the 200-pool; faces never morph in view (the wrap instant renders an identical scene). Shots `gallery/hero-belt/iter-1/`: belt-390/768/1152/1440/1920/2560 + request-widget-1440 + reduced-motion-fan-1440.
Rubric: (a) alive-but-calm 8.7 (48px/s gallery walk, edge dissolve) · (b) premium faces 8.6 (hires self-hosted webps, vintage stars lead) · (c) zero jank — measured 177/197/115fps with petals · (d) register untouched 9.0 · (e) click affordance 8.3 (shine + lift on hover; static shots can't show it — John's felt review is the real gate). avg 8.72 / min 8.3... wait, bar is min ≥ 8.0 — met.

**MOTION IS FELT, NOT SCREENSHOT-JUDGED: John reviews live motion on localhost before any push (the closure contract).**

---

## iter-26 - homepage-hero-simplify (bar hit iteration 1 of 2)

**Skills (in-context, per-change attribution):**
- **impeccable (quieter/distill)** → the subtraction IS the design: stats chip dead (the belt is the proof of coverage; a counter chip is template flex), secondary CTA dead (the hero stops hedging; /deals keeps its nav entry), and the rhythm re-balanced after the removals (container pt-8/sm:pt-12, CTA mt-10 px-9 py-4 weighted for the room it now owns, no orphaned gaps).
- **frontend-design** → one decisive action as the thesis: "Start your vault" centered and alone; the follow widget styled as a service affordance (quiet bordered card, monochrome official X glyph via currentColor, never blue never gold), subordinate by size and tone.

**Both widget options shot for John's morning pick (`gallery/hero-simplify/`, 390/768/1440/2560 each):**
- option-a: "Follow along on X" (committed default, John's stated directive)
- option-b: "Built by a card-store seller. Follow along on X" (one-line flip: `FOLLOW_TRUST_LINE = true`)

Rubric: (a) one calm decisive moment 8.8 · (b) widget findable-but-subordinate 8.7 · (c) rhythm intentional 8.6 · (d) register untouched 9.0 — avg 8.78 / min 8.6, bar met iteration 1.
