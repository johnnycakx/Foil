# Next-Session Brief — 2026-06-30 (end) — two live funnel bugs FIXED (hero, share cards); OG-cards commit awaits ONE push; next = JOHN POSTS

> Read first: current state + the prioritized plan. (Cowork edits this; commits run on John's machine.)

## Headline
A Cowork + Claude Code session that FIXED live funnel bugs a passing test suite was hiding. Two shipped: the **blank hero + founder image** (eager-load fix — `0f0a306` + live-verify `d3f8206`, PUSHED, verified in prod: all 8 cards + avatar paint on first load) and the **blank OG/Twitter share cards on 14 pages** (`1dc1148`, COMMITTED but **NOT pushed** — John's computer crashed before the push; repo is clean, nothing lost). Also: **@FoilTCG handle canonicalized** across footer + all `twitter:creator` (`5c0cf3c`, live). Ran three read-only audits → a prioritized fix list. Checked GSC (the vending pivot did NOT harm SEO — measured). Checked the X profile (populated; the incognito "no posts" was logged-out gating, not a shadowban). **The bottleneck is unchanged: AUDIENCE. John is posting — that's the needle. The builds were legit funnel/trust hygiene, not the scoreboard.**

## THE one open item (do first)
- **`git push origin main`** — local `main` is exactly 1 commit ahead of origin (`1dc1148`, the OG share-cards fix). Committed + safe, just unpushed (crash timing). Pushing takes it live (Vercel auto-deploys) and fixes the blank share cards on every foiltcg.com link John tweets. Low risk (metadata strings only, gates green, `/security-review` clean). **After it deploys, verify** the `og:image`/`twitter:image` tags resolve on a pillar + a blog post + `/start` (Cowork can do this via fetch/Chrome).

## What's LIVE now (pushed, prod-verified)
- Hero + founder eager-load fix (`d3f8206`) — all 8 cards + avatar paint on first load, confirmed live.
- @FoilTCG handle canonical: footer "Follow on X" + all `twitter:creator` + `OWN_USERNAME` (`5c0cf3c`).
- (Carried from prior: newsletter `/approve`→editorial→Resend loop; engagement engine v2; format-mining dry-run; Phase-0 UTM attribution.)

## Queued (priority order — ALL behind "John posts" + real audience signal)
1. **`trust-hardening-currency-and-affiliate.md`** (spec written, not run). P0: the wishlist alert fires FALSE "price drop" emails on a currency mismatch (a £/€ listing compared cents-to-cents against a USD target). P1: the affiliate "we earn a commission" claim can render false if `EBAY_CAMPAIGN_ID` ever lapses (no render-path guard; only newsletter HTML is gated). Trust-critical, cheap, ~0 users hit it today.
2. **`/cards/[slug]` + set-logo CDN self-host** (described, not yet specced as a file). The primary SEO landing surface's hero rides the flaky `images.pokemontcg.io` CDN with no self-hosted fallback — the exact CDN ADR-056 already moved the homepage hero off of. Bigger job (bake catalog images).
3. **SEO keyword-opportunity pass → content-engine backlog** (`docs/seo-strategy.md`). The leveraged SEO move: feed the autonomous twice-weekly engine better low-competition, high-intent niche targets so it compounds on the right terms. Slow lever; strictly behind posting.
4. **`fix-blank-og-share-cards.md`** — DONE (`1dc1148`), pending only the push above.
5. **Repo housekeeping** (optional, cosmetic): archive dated one-offs in `docs/` root (the 4 `CONTEXT-HANDOFF-*`, `PLAN-2026-06-05`, etc.) into `docs/archive/`; tighten the goal-closure contract in AGENTS.md (a goal isn't "done" until the commit WITH the SESSION-LOG lands — the hero goal stranded on this); trim the 55 accumulated `docs/goals/` scratch files. NOT the needle.
6. **`design-review-loop.md`** — the screenshot-gated approve/try-again design loop John wants; self-learning write-back to DESIGN.md. Motivated by today (structural tests passed while hero + OG cards shipped blank). First job = catch rendered-reality regressions.

## Audit P2s (captured — do NOT act now)
`siteUrl()` www-vs-apex fallback drift; `aggregateStat` `|| null` numeric edge case; set-logo header flaky CDN + no priority. (Homepage `alternates.canonical` was folded into `1dc1148` — verify it's present after push.)

## X / audience (the ACTUAL bottleneck)
- @FoilTCG: 20 posts, verified badge, strong original content (pinned sold-prices thread; movers posts; `/deals` link), bio + foiltcg.com link correct. **4 followers / 69 following.**
- **Reach mechanic at low-follower count: REPLIES are the discovery lever, not own posts.** Own posts reach ~4 people; replies surface under bigger accounts' posts in front of THEIR audiences. So growth = thoughtful, data-cited replies on high-reach posts (engagement engine ranks by reach), spaced out (not bursts).
- **Stop mass-following** (69:4 is a spam signal that can deepen a new-account throttle) — let followers come from replies.
- Incognito "no posts" = X's logged-out login-wall gating on a young account, NOT a confirmed shadowban. Can't cleanly diagnose a throttle; the right actions (quality + patience + no spam signals) are identical either way → don't rabbit-hole.

## Standing
- PokeTrace renews ~Jul 15 (reminder Jul 13) — load-bearing pricing spine. `AUTO_PUBLISH_WEEKLY_POSTS` ON. `FORMAT_MINING_ENABLED` dry-run ON. `ENGAGEMENT_BRIEF_ENABLED` ON. Cowork CANNOT commit/push — hand John `docs:` one-liners + `/goal` pastes.

## Uncommitted at session end
This brief + the COWORK-CONTEXT learnings are Cowork edits in the working tree. Code: `1dc1148` committed-unpushed (the ONE push); `d3f8206` live. Hand John TWO things: (1) `git push origin main` (ships the OG fix), (2) one `docs:` commit for this brief + COWORK-CONTEXT.
