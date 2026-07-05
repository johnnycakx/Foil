# Next-Session Brief — updated 2026-07-05 — STRATEGIC REFRAME: validate willingness-to-pay (gated daily deal drop + $6/mo + bounded ads test). Tomorrow = a full PLANNING + STRESS-TEST day, no building.

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE HEADLINE — 07-05 STRATEGIC REFRAME (supersedes the SEO/perf/distribution-via-replies framing below)
After a full strategy session, Foil is reframing around ONE question it has never answered in 14 months and four pivots (scanner → vending → deal-finder → market-insight board): **will anyone PAY for this?** The `/deals` board is supply-constrained — **0–6 real good-buys/day** (proven by the deals-freshness diagnosis AND the ranking-rework premise check). That's fatal for an always-on webpage but PERFECT for an inbox. So: **retire the board as the hero → turn the deals into a gated DAILY DEAL DROP delivered by email** (top 2 shown publicly, rest gated), **add a $6/mo paid tier (1 month free via Stripe) for personalized price alerts**, and run a **bounded ads test (~$150–300) that measures willingness to PAY** (a card is conviction; a free email is not). The whole prior strategy rested on invented conversion numbers (15–25% signup, 70× LTV) never tested against real traffic. This finally tests them. **Two planning docs written (on disk; `docs/goals/` is gitignored, so they persist locally but aren't committed): `foil-gated-drop-paid-test.md` (the product/model/validation plan — READ FIRST) + `autonomous-distribution-engine.md` (the honest distribution architecture).**

## THE VALIDATION INITIATIVE — HELD until Fable returns (after Jul 7), per John (2026-07-05)
**Do NOT start, plan, or pre-spec this before Fable is back.** John's call: this pivot is judgment-heavy and spends real money, so it gets **Fable's fresh judgment on a clean surface** — not an Opus/Cowork pre-baked plan. Between now and Jul 7: light work / distribution / the @mollipen thread / rest — NOT this initiative. When Fable's back, it plans the whole thing fresh; the two planning docs (`foil-gated-drop-paid-test.md`, `autonomous-distribution-engine.md`) are **RAW CONTEXT + facts learned this session, NOT a committed spec** — Fable is free to restructure or discard the framing entirely.

**The pre-launch map below is REFERENCE for Fable, not a to-do for tomorrow.** It captures what must be true before any ad spends (every decision locked + every funnel path stress-tested):
1. **Lock the ICP — exactly ONE beachhead** (not "collectors"). Pick the sharpest, most-reachable, most-frustrated segment (e.g. modern-set singles chasers who buy monthly and hate junk listings, vs vintage grail hunters, vs flippers). The ICP decides the ad platform, targeting, copy, AND which cards the deal engine prioritizes. Stress-test: would THIS person pay $6/mo, and why is Foil better than what they use now (eBay saved searches, Discord alert servers)?
2. **Lock offer + tiers + price — the free/paid line is now an OPEN A/B, not settled.** John's intuition (07-05, grounded in thin-supply/frequency): the generic **daily drop** is likely the better $6 paid DRAW than personalized alerts — personalized fires only ~every 1–4 weeks per person (churn risk), while the drop always delivers + builds a daily habit. Candidate structure: **free = 2-deal teaser; $6 = full daily drop + personal watches bundled** (drop = the draw, watches = the stickiness/retention). Because WTP intuitions are untrustworthy (our own rule), TEST it: two ad hooks at the same $6 — "today's best deals, daily" vs "watch your grail, ping at your price" — whichever converts wins. Counter-evidence to weigh: proven PAID monitoring (Keepa) is personalized; generic deal lists are usually free/ad-supported. Stress-test $6 vs $5/$9 (anchor = one avoided overpay). Write the promise in words.
3. **Theory-craft + pick platforms:** ad platform (Reddit vs Meta vs X vs Google — map each to ICP/cost/creative/rules), payment stack (Stripe **live** + LLC banking; repurpose the in-tree $14.99 Pro paywall code → $6 + 1-mo trial), email deliverability at higher volume (Resend broadcast, hold Gmail Primary), welcome sequence.
4. **⚠️ DATA-TRUST prerequisites — NON-NEGOTIABLE before ads.** Foil's whole promise is "real numbers, sold not asking." The ranking-rework premise check found live trust bugs: the **card page renders a stale ~2×-inflated price** (gap 4: Neo Umbreon $840 vs ~$450 live) and the **inflated TCGplayer $229 shows on the variants panel + `/lines`** (gap 5). A paid-trial user who sees a wrong number churns and burns the test. **Fixing these is the highest-priority pre-ads build.** (Findings: `docs/goals/_results/deals-ranking-rework-premise-check.md`.)
5. **Stress-test the funnel END-TO-END (the "no bugs before ads" gate):** ad → landing (mobile-fast, offer clear, gate obvious) → email capture (lands in Supabase+Resend, Primary inbox, welcome fires) → daily drop (generates + sends reliably, deals ACCURATE) → paid trial (Stripe live works, card captured, personalized alert actually delivers, trial→paid fires) → unsubscribe/billing edges. Every path gets the premise-check treatment.
6. **Instrumentation:** UTM every path + a dashboard for the THREE signals (email-signup %, trial-start %, trial→paid %). Without it the ads spend teaches us nothing.

**THE GATE TO ADS-LIVE:** ICP + offer + platforms locked · data-trust bugs fixed · funnel stress-tested with ZERO known bugs · instrumentation live. Only then does the ~$150 go out.

## Standing items carried forward
- **Model:** keep Claude Code default on **Opus 4.8** (Fable promo 50%-weekly until **July 7**, re-check after; the wall is a saved-default, not a real limit — `/model` fixes it).
- **⚠️ GCP billing:** `n8n-content-project` (hosts the GSC service account) flagged for suspension — billing acct `01CBF6-7D6D18-F894B6` past due. Fix at `console.cloud.google.com/billing/01CBF6-7D6D18-F894B6/settings`.
- **PokeTrace $98/mo** renewal ~Jul 15/Aug — the deals-freshness diagnosis WEAKENS the case (its unique input, eBay windowed *sold*, is the stale part; eBay active-lowest we already own). Feed into the renewal call.
- **Stripe live + LLC banking** must be wired before charging (ADR-020 deferred it; Foil TCG LLC exists). First real dependency for the $6 tier.
- **@mollipen (Mollie L Patterson, 2.4K journalist) — live warm thread.** Got the E3 red-cheeks Pikachu valuation in DM (sealed ~$1–1.5k sold vs $4–10k listed; John sending). If she engages it's BOTH a conversion and a **press/citation seed** (a journalist mention breaks the GSC authority gate). Nurture — don't let it die in DMs.
- **SEO/perf are DONE** — the 07-04 verdict (0 clicks, authority-gated) + the closed perf campaign still hold; do NOT reopen either. The lever is validation now, not more pages/speed.

## Superseded this session (kept for history, below)
The 07-04 "the work is distribution via replies / queued builds" framing is superseded by the reframe above. `deals-ranking-rework` (5c) is PARKED — its premise check already delivered the decisive finding (board is supply-constrained → retire it); do NOT ship its ranking code. The prior brief detail (EVE STRAND, COPY, competitive intel) remains valid context but is no longer the lead plan.

## COPY DIRECTION — decided this session (function-first, voice → X)
Evidence-backed against comparables (Keepa/Collectr/TheRightTrader all lead with plain function, differentiator-as-fact, zero warmth): **homepage copy is function-first; save founder-voice for X.** The "salesy" feeling = voice carrying a line that should carry function. Working lines (John's final veto pending): H1 toward a function-led line (`Tell me what you're chasing.` is the current, may go fully functional), sub `I watch them and email you the second one hits your price. Priced on real sales, not asking prices.`, microcopy `Free · no account · one email for alert delivery`. **DURABLE METHOD RULE: copy is scored against competitor register, not taste.** Ships as one bounded goal (`hero-copy-evidence.md`) when John locks the lines.

## What went LIVE 07-04 (huge day)
- **Blackout brand** — metallic-gold "Foil TCG" wordmark, `/start` + `/cards` on charcoal, `/deals` parity + heating-up images. Pushed + verified (`30142b5` / `e276fee`), wordmark face-match + size-up (`7551415`, `a7cf705`).
- **X reply tooling FULLY LIVE** (`105ac22` pushed + wired via the go-live goal): `/api/receipts` (bookmarklet + iOS Shortcut — John's outbound tool), the Discord **reply desk** (caught @possiblyeve + @Slic_Ric_DaRula night one, Reply/Edit/Skip), and the intent-link **engagement brief** (cold candidates → `#content-engine`). Firewall intact — nothing auto-posts to X; John presses Post every time.

## John's open human steps (from the go-live closure)
- Install the receipts **bookmarklet** + build the **iOS Shortcut** (both handed in the Claude Code closure message; secret is `X_RECEIPTS_SECRET` — rotate on Vercel if that terminal session is ever shared).
- Clear the 2 reply-desk cards — the **first Approve is the ADR-107 supervised acceptance test** (watch it post correctly in-thread).
- Confirm X bio website = `foiltcg.com/x` (so reply→signup is attributable).

## THE QUEUE (docs/goals/QUEUE.md is the living tree)
- **`#4f` engagement-brief-widen-scan** — verify it landed (running at close). Widened queries + advisory floor 500→250 for ~5-15 candidates/run, high-reach quality preserved.
- **`#5b` deals-freshness-diagnosis — PARTIAL, resume on Opus. HIGH STRATEGIC.** Findings logged in the goal file: it's TWO diseases — (1) ~15% of cards byte-frozen (PokeTrace never updates them → the stale-passthrough John named, fix = eBay-lowest active basis), AND (2) a slowly-locking mover RANKING dominated by cheap ultra-liquid modern cards (Destined Rivals trainers $10-47) → needs a value-floor / liquidity selection fix. Our cron is healthy (ruled out). Resume: 46 frozen cards' trajectories + the full-catalog Chrome-walk of TCGplayer listings. Feeds the ~Jul 15 PokeTrace $98 renewal (may weaken it).
- Then: belt-touch-drag, belt-og-metadata, vending-delist, repo-security-audit (repo PRIVATE — low urgency), github-recruiter-ready.

## ⭐ EVE STRAND — VERIFIED live state (Cowork checked X directly 07-04)
The @possiblyeve thread is ALREADY HANDLED — do NOT re-reply. Verified timeline (read off X):
- **Jun 30:** eve → @FoilTCG "can u do it for me" (65 views, 1 like).
- **07-03 (~22h before the check):** John → eve, the vault gift reply — now **PINNED on @FoilTCG, 40 engagement**: *"ok I may have overdone it. built you a vault: six of your duo's grails already being watched… add any card you want and it watches that too: foiltcg.com/eve."* John already answered "can u do it for me" with the vault. Perfectly.
- **Since:** eve's only public activity is a Love Island tweet (4h before the check) — **no public reply to the gift yet.** Ball is in her court.
- **Vault claim status: almost certainly NOT claimed** (John 07-04: no `#subscribers` Discord ping, which the claim path fires — so no email entered). Confirm via `seeded_vault_claims` `vault_slug='eve'` if wanted. **Honest signal:** the highest-effort personalized gift (bespoke line-tracker + seeded vault + pinned reply) earned PUBLIC engagement (40) but ZERO conversion from the target so far. One data point — don't over-index — but it questions whether the gift-vault play converts or just earns a like. Watch whether it converts at all before repeating the play at that effort level.
- **NEXT MOVE: SKIP the reply-desk card, do NOT reply.** The thread is won; re-replying to the Jun-30 tweet would double-tap. Patience — let her claim/respond. Optional soft nudge only if she engages.
- **REPLY-DESK BUG surfaced (real, goal-worthy):** the desk re-queued a 4-day-old tweet John had ALREADY replied to. It must (a) exclude any inbound @FoilTCG has already replied to, and (b) apply a recency window so stale tweets don't resurface as "fresh." See `#4g` reply-desk-dedup.
- **Doctrine fix:** CHECK the live surface before advising on it (John, 07-04) — I asked instead of looking; Fable would have just checked. Live threads get verified off X, not inferred from the second brain.

## Content (drafted, John veto/post)
- **Reveal post** — drafted in John's voice, **PAUSED** (pin when ready; ties to the site being visibly honest first). Manipulation thread + vault-noun post still queued.

## Competitive intel (new 07-04)
**`docs/knowledge/competitor-teardown-therighttrader.md`** — teardown of @TheRightTrader, Foil's structural twin (niche market-data + alerts tool, X-grown, cheap sub vs an incumbent). Biggest takeaway: **Foil Pro has no "pays for itself" price anchor** — their whole monetization is anchoring a $2–15/mo sub against the ~$125/mo stack it replaces + an explicit competitor-comparison table + scarcity/lifetime-lock. Top transferable plays: (1) build a Foil Pro value anchor ("cheaper than one overpay" / vs PriceCharting+manual scrubbing), (2) an incumbent-kill hook ("stop scrubbing eBay"), (3) more free-tool SEO pages, (4) seat-scarcity + lifetime-lock copy for the founding-member launch. Worth turning into IDEAS entries + a goal. (Teardown doc is untracked — `git add` it whenever; persists on disk regardless.)

## Standing
- **PokeTrace $98/mo** renewal ~Jul 15 — the `#5b` diagnosis is the due-diligence input.
- **Fable** weekly cap exhausted; promo ends Jul 7. Opus runs everything.
- AUTO_PUBLISH_WEEKLY_POSTS stays false. Repo PRIVATE (confirmed).

## Session-close hygiene
Brief + COWORK-CONTEXT learnings written by Cowork at 07-04 close (uncommitted on disk — the go-live goal deliberately left them untouched). John commits via the handed `docs:` one-liner AFTER `#4f` finishes committing.
