# Next-Session Brief — updated 2026-07-14 (3am close, corrected post-goal) — pricing-bridge DONE (committed `9bf6315`), Track A essentially complete, PokeTrace ingest RESUMED so the lapse is de-risked. LinkedIn syndication + Featured live. Sold-truth positioning drafted.

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.) NOTE: an earlier version of this brief carried two stale premises the goal's P0 check corrected — see "corrections" below.

## What happened this session (2026-07-14)
- **`pricing-bridge` — committed `9bf6315` (unpushed, ADR-118, R-070 → the lapse is survivable).** Phase 1 (the lapse mitigation) shipped: price basis is now a TYPE (`SoldBasisPrice`) — a listed price is a **compile error** on a sold-labeled surface, backed by a runtime throw + pinned test; the card page degrades **sold-null → labeled TCGplayer-listed** when the sold spine is dark. Measured result: **2,673 / 3,248 cards (82.3%)** now show an honest, dated, labeled price instead of zero. The listed fallback needed NO new vendor (TCGplayer prices already baked into the snapshot; zero new keys/id-mapping/network; cannot fail with PokeTrace). Weekly refresh cron + Discord alarm added (fixed a real bug: the daily bake's `--only-missing` never refreshed existing prices → they'd have aged past the freshness window and the safety net would've silently resolved to null exactly when needed). Gates: tsc clean · 1,733 tests 0 fail · build 0 · design:lint 0 · security review no findings (it caught + fixed a real retry-overlay bug).
- **CORRECTIONS the goal's P0 check surfaced (I'd written these wrong earlier):** (1) **PokeTrace's eBay sold ingest has RESUMED** — re-probed live: key authenticates, high-velocity cards read 1–3 days old (not "frozen at 07-05"). Freshness is now *uneven* (Moonbreon 13d stale; low-velocity 28–102d), which the freshness/age label handles. So "don't renew because it's frozen" is now an OPEN re-decision, not settled. (2) **Track A Phase 2 (catalog automation) was ALREADY SHIPPED** hours before the spike memo — the 541-card gap is closed (1,885 → 3,248 cards, me2pt5/me3/me4 all present, daily bake cron autonomous on main). Phase 2 was dropped, not rebuilt.
- **LinkedIn personal-profile syndication Phase 1 shipped** (commit `8ace4d2`, unpushed, ADR-117): `scripts/generate-linkedin-post.ts --slug` → voice-swept caption + UTM → `#content-engine` card → John pastes to his OWN feed. Env-gated `LINKEDIN_SYNDICATION_ENABLED` (off), `human_only` pinned.
- **LinkedIn profile worked over live (Chrome):** FDE-forward headline; About rewritten (John's edit, he's happy); **Featured link to foiltcg.com added live** (thumbnail is the site OG image — a bit blurry, sharpen in-repo later, improves every share).
- **Sold-truth positioning drafted** — `docs/STRATEGY-SOLD-TRUTH-POSITIONING.md` (buyer-protection: "eBay shows asking prices; Foil shows what it actually sold for"). Gated on the spine — which is now materially healthier (ingest resumed + Phase 1 safety net).

## The clock (now de-risked)
Phase 1 landed AND PokeTrace's ingest resumed, so the ~Jul 15 lapse is no longer a fire — cards degrade to an honest labeled price either way. Remaining John calls: (1) **PokeTrace renewal is now a real re-decision** — re-look at the uneven-freshness evidence (resumed but Moonbreon-class cards lag); Phase 1 makes renew-or-not both safe. (2) **Apply for the eBay Marketplace Insights API ($0)** — the permanent own-the-sold-source fix; start the slow approval clock regardless of the renewal call. (Cowork can drive the form over Chrome, John submits.) (3) Optional: the 2 support emails (PokeTrace ingest status / Scrydex id-compat).

## Prioritized plan — next session, in order
1. **Push `pricing-bridge` `9bf6315` + LinkedIn `8ace4d2` + the docs commit** (ship gate), then live-verify on prod that the labeled listed fallback renders correctly (price-marker verification, not just HTTP 200).
2. **PokeTrace renewal re-decision + the eBay Marketplace Insights application** (John's human steps).
3. **Track B — the UX plan** (`docs/UX-DIRECTION.md`) — now the biggest UN-started rock (Track A is essentially complete). Still gates further UI building ("no more building until the plan exists"). Cowork authors, John ratifies.
4. **Sold-truth positioning:** ratify the 4 pillars → add the buyer-protection hook to the ads/WTP test → THEN re-copy hero + card page (John's voice veto) + build the listed-vs-sold contrast. Spine is healthier now, but still verify data is fresh before shipping "source of truth" copy.
5. **LinkedIn / career:** ready to use (captions on publish → John posts). Low-pri profile polish: 5 Skills (Python, SQL, Solutions Engineering, TypeScript, AI), optional Foil-bullet "Python/SQL"→"TypeScript/SQL". FDE job lane locked; John applying. See memory `john-career-track` (BA Finance; MS-in-DS is a GOAL, never claimed held).
6. **Optional Track A remainder (nice-to-have, not do-or-die):** tcgcsv presale early-warning watcher (detects net-new sets weeks early). Catalog gap is already closed, so this is polish.

## Push stack (John)
Unpushed: pricing-bridge `9bf6315`, LinkedIn `8ace4d2`, and the 3 Cowork docs (this brief + COWORK-CONTEXT learnings + `STRATEGY-SOLD-TRUTH-POSITIONING.md`) via the `docs:` one-liner. Push completed goals before firing the next.

## Standing state (compressed)
- Track A (data independence) essentially DONE; Track B (UX plan) is the next big rock, still gating UI builds.
- Vendor risks: R-070 (PokeTrace — mitigated behind the adapter + ingest resumed), R-071 (Scrydex images), R-072 (PriceCharting ToS → internal-QA only).
- `AUTO_PUBLISH_WEEKLY_POSTS` false (approve-gated). Digest rail live.
- Real external subscribers still ~0 — bottleneck remains AUDIENCE/validation, not build. Sold-truth positioning + the ads test is the path to the one missing number: does anyone pay/convert.
