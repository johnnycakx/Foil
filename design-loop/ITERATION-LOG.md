# ITERATION-LOG.md — overnight-design-loop, 2026-07-02

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
