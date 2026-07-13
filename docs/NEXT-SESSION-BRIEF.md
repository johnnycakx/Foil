# Next-Session Brief — updated 2026-07-13 (final, session close) — POKETRACE IS OUT (John's call: won't fix, don't renew). Two tracks now: A) data independence in ~48h, B) UX re-plan BEFORE any more building. Fable opens next session by AUTHORING BOTH PLANS, not by firing goals.

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE TWO DECISIONS THAT CLOSE THIS SESSION (John, 2026-07-13 night)
1. **PokeTrace: DO NOT RENEW.** Their eBay sold ingest froze 2026-07-05, it's now user-visible on prod (static "N sales on record", static "usually" prices, the same "most-chased" pack dealt daily), and John's verdict is they won't fix it. Consequence with a CLOCK: the key lapses ~Jul 15; after that, sold tiers/hydration soft-fail to empty and the site's sold-basis data goes from frozen → gone. **Track A must land inside ~48h.**
2. **No more building until the plan exists.** John's read on the freshly-shipped surfaces: "clunky and outdated… I'm not impressed with the usability." The pattern to break: we keep shipping competent fix-beats into an experience whose overall shape nobody has designed end-to-end. Track B is a PLAN artifact first, ratified by John, THEN build beats.

## TRACK A — data independence (~48h, before the lapse)
Fable's first deliverable next session: `docs/goals/pricing-bridge.md`, written FROM the spike memo (`docs/goals/_results/data-source-spike.md` — adapters, costs, candidates already evaluated). Contents, already decided in principle:
- Pricing adapter layer with per-quote provenance `{source, basis: sold|listed, lastUpdated}` — product code never knows the vendor.
- **Honesty rule survives the bridge:** where sold data exists (PokeTrace's frozen-but-real history, PriceCharting within ToS limits), it renders as sold with its date; where only listed exists (tcgcsv), it says listed — "Foil reads real sales" never silently becomes asking-price guessing. Stale sold data gets an honest age label, not silence.
- tcgcsv ingest is the backbone (free, daily, full catalog incl. presale) → **`presale-ingest.md` (specced, unfired) FOLDS INTO this goal** — one tcgcsv pipeline, presale is a tier of it, not a separate cron.
- Scrydex Growth + JustTCG trials ride behind the adapter as candidate sold sources; decision by evidence after a week.
- Kill/keep: strip PriceCharting from user-visible surfaces per R-072 unless permission obtained.
- **John's parallel human step (the permanent fix): the eBay Marketplace Insights application ($0) — own the sold source. START THE CLOCK.** Also: GCP billing card (past due) still open.

## TRACK B — the UX plan (Fable authors, John ratifies, THEN we build)
Fable's second deliverable next session: `docs/UX-DIRECTION.md` — the end-to-end experience design, not a fix list:
- Inputs: John's "clunky/outdated" verdict + his round-2 tour narration + the audit (`design-loop/SITE-QUALITY-AUDIT-2026-07-13.md`, items 6–9 still open: /start IA flip, hero first-paint, desktop composition, /alert-sample + naming) + the Collectr test (the standing frame) + the Bao/ADR-115 reference feel (Finding 6, twice-complained, still unaddressed).
- Scope: the FULL stranger journey — land → understand → first card seated → binder alive → alert → return → upgrade — with the clunk named at each step and the intended feel specified before any component is touched.
- Method: journey-map against Collectr's first-30-seconds, then design the beats; invoke the design skills (impeccable/soft-skill/redesign-skill) at authoring time, not just build time.
- Output: ratification checklist for John, then sequenced build beats each with its own rubric axis targets. **The ads gate (all axes ≥7) now sits BEHIND Track B's execution.**
- V8 ads spec: still Fable's, still gated on the re-score clearing. V6.6 cycle-4 merges INTO Track B (it was always the register/feel pass — now it's part of a whole design, not a bolt-on).

## Standing state (unchanged from tonight's earlier close, compressed)
- Prod: main through `03cb076`, deploys Ready, 1,733 live markers / 0 fail. Rubric: 3.5 → 6.5 (history in the audit doc). Catalog bake autonomous + proven; freshness watchdog live; request-tracking V1 live; binder-brain live; moonbreon resolves.
- Vendor risks: R-070 (PokeTrace — now being executed away), R-071 (pokemontcg.io→Scrydex images), R-072 (PriceCharting ToS).
- Digest rail: first approval card Wed 14:13 UTC · AUTO_PUBLISH_WEEKLY_POSTS false · @mollipen thread alive.
- QA hygiene: John saw a full binder page of QA-run watches on his signed-in account — clear them (put-away) so his binder is his real chase list.

## Standing doctrine (additions this session — MIGRATE TO COWORK-CONTEXT next session, mount-fresh)
- The Collectr test frames every product call · the rubric gates ads, re-scored in the audit doc, no vibes.
- Any recurring script feeding prod content gets a cron + alarm the day it's born (the manual bake cost three sets).
- **Plan before build when the complaint is about the WHOLE, not a part** (tonight's learning: three competent fix-beats in one day still left "clunky and outdated" — because nobody designed the whole).
- /clear between goals · ultracode YES for read-only fan-out spikes, NO for prod-touching builds · Cowork mount caveat · zero-traffic veto doctrine · judgment stays in the Fable seat.

## Next session, first 10 minutes
Read this brief → author `docs/goals/pricing-bridge.md` (Track A, fire same session — the lapse clock is real) → author `docs/UX-DIRECTION.md` (Track B, John ratifies before anything builds). Don't fire presale-ingest standalone — it's folded into Track A.
