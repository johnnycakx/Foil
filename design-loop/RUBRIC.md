# RUBRIC.md — the evaluator's contract (overnight-design-loop, 2026-07-02)

Every iteration is scored 1–10 on each dimension, judged from the SCREENSHOTS
(rendered truth), by a hostile design critic. The evaluator hunts John's four
named enemies BY NAME every pass: **flat/no depth · empty/sparse ·
generic-AI-template smell · weak hero moment.** Any of the four visibly present
caps the relevant dimension at 5.

## Dimensions

**(a) 3-second pull-model clarity** — A cold visitor (from an X reply, phone in
hand) understands within 3 seconds: "they watch cards for me and email me when
prices drop" + sees ONE obvious action (Start your vault → /start). Push-model
framing ("stop guessing what your cards are worth"), competing CTAs, or a
buried promise = fail. Judged on the fold screenshot only.

**(b) Craft / intentionality** — Would a working designer believe a human
sweated this? Optical alignment, deliberate spacing scale, type contrast with
purpose, no default-Tailwind-component smell, no orphan widows in headlines, a
grid that resolves. The enemy: "AI made a landing page."

**(c) Depth & character** — Feels alive without noise. Layered composition
(planes, shadow logic, light), scroll ambience, the one signature effect per
page, restraint budget respected (Tier-1 ambience + ONE signature). Flat
wallpaper textures, tiled watermarks, and decoration-as-depth score LOW here —
depth is structural, not applied.

**(d) ICP resonance** — Would a collector in @possiblyeve's audience
screenshot this unprompted? Vault/binder soul intact; card art treated as the
treasure it is; zero generic-AI-template smell; warm, not sterile; premium,
not crypto-hype. The functional test: do the cards feel like the reason the
page exists?

**(e) Mobile excellence** — 390px is the primary device. Fold composition
works, type scales hold hierarchy, touch targets thumb-sized, the signature
moment survives (or gracefully degrades) on mobile, no horizontal overflow, no
cramped stacking.

**(f) Plain-language compliance** — The 15-year-old-collector test on every
visible label. No finance/ticker jargon ("30d avg · NM tier"), no insider
abbreviations. "Sold for ~$92 recently" energy throughout.

**(g) Performance discipline** — Nothing added to the critical path; hero
paints instantly (no blocking scripts/fonts for the first view); effects are
transform/opacity only; images sized + local; reduced-motion static fallbacks
present in code (verified at gate time, reported here).

**(h) Card-art spotlight** — Do the cards read as the visual heroes — the art
doing the talking? On a dark direction: are the cards the light sources of the
page? Tiny thumbnails, cropped-to-death art, or cards as decoration behind
text = fail.

## Scoring discipline

- Score from the screenshots. If something only "works" in code, it doesn't count.
- Write the WEAKEST dimension + why, and derive the next iteration's thesis from it.
- Sandbagging is as dishonest as inflation: a real 9 is a 9.
- DIVERGE phase (iters 1–4): both art directions scored against this same rubric;
  neither gets a handicap. The dark direction doesn't win points for being dark;
  the warm control isn't strawmanned.

## Termination (from the goal)

- **Bar:** avg ≥ 8.5 AND no dimension < 7.5, sustained 2 consecutive iterations.
- **Plateau:** 3 consecutive iterations without avg improvement → stop.
- **Cap:** 12 iterations / ~6h wall-clock.
