# Next-Session Brief — updated 2026-07-04 (session 2) — GSC wired + verdict IN, font/JS LCP floor pushed, copy going function-first

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## THE HEADLINE FROM THIS SESSION
**The "why aren't we indexed" investigation is CLOSED with live data.** GSC API is wired (Phase 1+2 LIVE, `d6b7f46` pushed). Verdict (n=45): **1 indexed / 12 crawled-not-indexed / 32 unknown-to-Google / 0 defects.** Nothing is broken. The gate is **discovery + authority**, which is off-page. **Operating consequence: STOP building for SEO — the lever is distribution** (replies, newsletter, backlinks/citations). 4th confirmation of "measure before you build," now with the real instrument. Report: `docs/goals/_results/gsc-index-report.md`.

## FIRST ACTIONS OF THE MORNING
1. **Model/budget:** keep Claude Code's default on **Opus 4.8** (Fable promo = 50%-weekly until **July 7**, then re-check; the wall is a saved-default setting, not a real limit).
2. **⚠️ Fix the GCP billing card.** `n8n-content-project` (hosts the GSC service account we now depend on) is flagged **at risk of suspension** — billing acct `01CBF6-7D6D18-F894B6` past due. Fix at `console.cloud.google.com/billing/01CBF6-7D6D18-F894B6/settings` or the GSC integration breaks. (Same card likely on the Google Workspace invoice.)
3. **Font/JS LCP floor pushed (`8d6df33`) but UNVERIFIED on prod** — run ONE real mobile PageSpeed on foiltcg.com to confirm the projected ~2s LCP. **After it, perf is DONE** (don't chase green on a throttled emulator).
4. **THE WORK IS DISTRIBUTION, now data-proven — not another build.** Be in the replies (the discovery lever). Do **NOT** re-reply @possiblyeve — that thread is won + pinned (see EVE STRAND below).
5. **Queued builds** (only if not doing distribution, in order): the **function-first hero copy** goal (tiny — see COPY below), then **CSV bulk import** (competitor-switch on-ramp), then **`#5b` deals-freshness-diagnosis** (HIGH strategic). NOT more SEO content.
6. **Optional nudge Cowork can run:** drive GSC "Request Indexing" over Chrome on the ~6 priority crawled-not-indexed pages (pillars, /blog, /deals). Legit ≤10/day nudge — not a fix (authority is the gate).

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
