# Next-Session Brief — 2026-07-01 (evening) — THROUGH-LINE: the Fable-5 surgical overhaul (audit done; foundation KEEP; 3 Phase-1/2 goals specced)

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## What just happened
Fable 5 came back; John upgraded to the $200/mo plan. Full six-branch audit ran (**docs/AUDIT-2026-07-01-FABLE.md** — the canonical findings doc). Grades: live surfaces C+ · SEO D+ · **funnel D** · content C- · code/ops B- · X C+. John proposed a ground-up rebuild; **decision: KEEP the foundation, rebuild surgically** — the audit showed architecture is the strongest layer and every 🔴 is a wiring/content/copy fix. Rebuild-from-the-goal is reserved for the two subsystems that failed at design level: the alert engine and the bake/render data pipeline. The paused `card-page-perf-regression` goal is **SUPERSEDED** (its Part B premise was false: the baked snapshot has had ZERO prices for all cards since ≥May 30 — stale duplicate parseCard in the bake script; tsc never saw it because tsconfig excludes scripts/).

## Headline audit discoveries (full detail in AUDIT-2026-07-01-FABLE.md)
1. Baked snapshot price-empty 5+ weeks (bake parser drift — 2nd R-015-class incident).
2. /start funnel is a black hole: newsletter opt-ins write only to Beehiiv (which doesn't send); zero UTM; duplicate re-submit 500s; alert-email unsubscribe stops nothing (CAN-SPAM); no rate limit; blank-target sentinel renders "you wanted ≤ $100,000" alerts by default; alert prices can be live auction bids (no FIXED_PRICE filter).
3. Live content fabrications: sv3a post (fake set structure/numbers/cards), Moonbreon 12x contradiction across 3 posts, deals-page first-click integrity failure (Poor-condition listing sold as "23% below, condition-matched"). Gates check form, not facts — entity-grounding gate vs the baked catalog is the fix.
4. Catalog expansion did NOT unblock movers (3 blockers: variants requirement, tier filter, 460 cap). Movers signal dies ~Jul 15 without PokeTrace renewal.
5. SEO: sitemap omits the 159 fast set pages + /cards hub; lastmod fabricated; cache hierarchy inverted (live-first, baked-fallback). TTFB fix urgency = DAYS (GSC refetch wave from the Jul 1 resubmit).

## THE plan (Fable overhaul, surgical — goal files ready in docs/goals/)
- **Phase 0 — DONE 2026-07-01:** goal cleared ✅ · `pre-fable-overhaul` tag pushed ✅ · **PokeTrace: "Don't cancel" clicked (CORRECTED — not a fresh renewal payment; it was scheduled to cancel Jul 16 at $98/mo and now continues)**. Spine secure short-term; benchmark decision ~Aug 10 (R-062): Scrydex $99/mo (owns pokemontcg.io now) vs PriceCharting cross-check vs eBay MI application.
- **Phase 1 — `perf-and-data-foundation.md` (RUN FIRST, days-urgent):** timeout guard + bake-parser fix (variant-wipe guarded) + FULL re-bake + baked-first rendering + sitemap hygiene (add hub/set pages, real lastmod) + title/canonical fixes.
- **Phase 2a — `start-funnel-integrity.md`:** tri-store opt-in from /start + UTM attribution + upsert + working unsubscribe + minimal abuse guard. The conversion counter must work before ANY traffic push.
- **Phase 2b — `alert-engine-rebuild.md`:** from-the-goal event model (state transitions, hysteresis re-arm, 30d-sold reference floor, FIXED_PRICE/US/USD filters, sentinel killed, sold-comp evidence line). Supersedes watchlist-alert-quality-overhaul; absorbs trust-hardening Bug 1 (trim that goal).
- **Phase 3 — Fable design/UI/copy overhaul (Cowork specs next):** pull-model hero + /start UX + card/deals pages + emails; folds in homepage-reposition (verdict: good as-is + add /start to nav) and the Pokeball-logo IP refresh (IDEAS #295) — must precede creator traffic.
- **Phase 4 — content trust:** unpublish/regenerate sv3a, fix 2 stale Moonbreon posts, sweep scanner CTAs from post bodies + seo-strategy template, deals re-verify + "verified Xh ago" stamp, then entity-grounding + price-sanity + cross-post gates.
- **THEN eve** (reply drafted in prior brief — do NOT send her to the current funnel).
- **Post-eve wave (unlocked ideas):** buy-signal (#388, partly ships in the alert evidence line), Foil as AI-cited data layer/MCP (#282/#375), Scoreboard series (#111), programmatic 25K-card SEO (#414/#494, crawl-budget-gated).

## Other queued-goal verdicts (from the audit)
`homepage-reposition-watchlist` resume as-is (+nav /start, folds into Phase 3) · `content-engine-market-card-upgrade` AMEND (premise-check value-rank's data source — baked prices were empty; movers wiring gap is the real unblock) · `trust-hardening` AMEND (strip Bug 1, keep affiliate render-guard + add loud-fail on missing EBAY_CAMPAIGN_ID).

## Token-allocation doctrine (new, John 2026-07-01)
Fable = judgment/design/specs/audits, never bulk execution. Claude Code = execution from goal files. Research agents staggered 2–3 max (the six-wide audit burned ~800K tokens in one shot — worked, but don't repeat).

## Standing
PokeTrace renews ~Jul 15 (**decision now dated, on John**). AUTO_PUBLISH reconciliation needed (docs say ON; Jun 25 draft landed in _pending — behavior says OFF). @FoilTCG 4 followers; replies = the lever; verify bio link carries UTM params (30-sec check). Cowork cannot commit/push — hand-offs below.

## Hand-offs for John (in order)
1. Claude Code: `clear the goal`
2. `git tag pre-fable-overhaul && git push origin pre-fable-overhaul`
3. `git add docs/NEXT-SESSION-BRIEF.md docs/AUDIT-2026-07-01-FABLE.md docs/COWORK-CONTEXT.md && git commit -m "docs: fable-5 six-branch audit + surgical overhaul plan" && git push`
4. `/goal Read docs/goals/perf-and-data-foundation.md and execute it, closing all gates before commit.`
