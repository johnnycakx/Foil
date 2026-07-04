# Next-Session Brief — 2026-07-05 (written at 07-04 close) — brand live in gold, X reply tooling LIVE, first real inbound caught

> Read first: current state + prioritized plan. (Cowork edits this; commits on John's machine.)

## FIRST ACTIONS OF THE MORNING
1. **Model/budget:** Fable's weekly cap is exhausted (drained 07-04). **Keep Claude Code's default on Opus 4.8** — it runs everything free; only switch to Fable for a specific judgment call, then switch back. Fable promo = 50%-weekly until **July 7**, changes after (check what it becomes). The blocker when Fable's capped is a saved-default setting, not a real limit.
2. **Verify `#4f` engagement-brief-widen-scan landed** (it was running at 07-04 close). The next brief should surface ~5-15 candidates, not 1. If it didn't commit, re-fire it.
3. **BE IN THE REPLIES — this is the growth act, not another build.** The receipts bookmarklet + Discord candidates are live. Reply to **@possiblyeve** first (Edit → point her at her vault; she's the eve you seeded `/eve` for, 2,092 followers, "can u do it for me").

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

## Standing
- **PokeTrace $98/mo** renewal ~Jul 15 — the `#5b` diagnosis is the due-diligence input.
- **Fable** weekly cap exhausted; promo ends Jul 7. Opus runs everything.
- AUTO_PUBLISH_WEEKLY_POSTS stays false. Repo PRIVATE (confirmed).

## Session-close hygiene
Brief + COWORK-CONTEXT learnings written by Cowork at 07-04 close (uncommitted on disk — the go-live goal deliberately left them untouched). John commits via the handed `docs:` one-liner AFTER `#4f` finishes committing.
