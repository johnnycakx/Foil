> 🗄️ **ARCHIVED / SUPERSEDED (2026-07-06)** — historical record, kept per the never-delete rule. Not current state. See [HOME.md](HOME.md) · index: [archive/README.md](archive/README.md).

# Cowork session handoff — 2026-06-05 (READ THIS FIRST)

Replaces CONTEXT-HANDOFF-2026-06-04.md. Captures end-of-day state after a large build + strategy session. New Claude Code / Cowork sessions: read this, then the docs listed at the bottom.

## TL;DR

Foil shipped end-to-end today: a live, honest deal-finder. The product is largely built; the bottleneck now is **traffic/distribution**, not features. Next phase is fueling the funnel (X bot live, SEO, catalog scale) and building subscription-ready.

## What shipped today (all DEPLOYED + live, verified)

1. **/deals leaderboard** (B.4 / ADR-054). Daily cron `/api/cron/deals-refresh` (08:00 UTC) precomputes each curated card's buy-signal into a `buy_signals` cache table (derived-only, R-008-safe, no eBay listing persisted). Board renders from cache.
2. **Logo** (ADR-055). Retired the Pokeball (Nintendo trademark) -> Fredoka "FoilTCG" wordmark (navy Foil + gold TCG) + foil-corner mark. Footer wordmark + homepage/deals OG image fixed.
3. **Click-time redirect** (ADR-056). "See it on eBay" now routes through `/go/deal/[slug]` -> live getBestListing -> 302 to the SPECIFIC item's affiliate URL (deals- customid), search fallback, no open redirect. Also self-hosted the 8 hero images (the "broken row" was a flaky external CDN, images.pokemontcg.io).
4. **F4 like-for-like matching** (ADR-057). Reads eBay structured item specifics (localizedAspects) for **Condition/Grade + Language**. Excludes cross-market false deals (the Japanese Alakazam priced vs the English sold ref). Board honestly went 5 -> 3.
5. **deals_cron telemetry fix.** Root cause was a stale `browse_calls` CHECK constraint (never widened for the deals_cron/deals_redirect surfaces). Widened via migration; R-012 quota monitoring now works (~411/day for the deals cron).
6. **X content bot** (ADR-058). Daily own-account posts, DRY-RUN-FIRST. Rotation: deal-of-day / price-spotlight / educational. Satori-composed image (Playwright/chromium dropped to avoid the function-size deploy risk). Deployed in dry-run; writes drafts to Discord #content-engine at 14:00 UTC. **NOT posting to X.**

## Current state

- **Board:** ~3 trustworthy deals from 207 curated cards (honest after condition+language gating). Fluctuates daily as listings rotate. It is small because the catalog is small (~2% genuine-deal rate), NOT because anything is broken. It scales ~linearly with catalog size.
- **X bot:** dry-run only. Drafts land in Discord daily. Will not post until John adds X creds + flips `X_BOT_LIVE=true`.
- **Banking:** Stripe Atlas LLC formed; Mercury application submitted (~approval). On approval: connect Mercury to Stripe + clear the Stripe verify-business task -> live mode ready -> subscription path un-parked.

## Strategic frame (from today's rethink — see BUSINESS-MODEL + PLAN docs)

- **Lead with the utility:** "the best price on any Pokemon card, instantly, free." The deals board + X bot are the hook/traffic engine, not the whole product. The per-card pages (1,007) are the revenue engine.
- **It is a distribution problem.** Product mostly built; ~0 organic traffic, 7 of 220 pages indexed in GSC. Traffic is the bottleneck.
- **Affiliate = bootstrap. Subscription = the margin lever.** 150 subs at $10 ~= 150K monthly affiliate visitors. Build subscription-READY now (free/paid seam + the instant-alerts wedge), flip it on once an audience exists. Do NOT paywall the free funnel.
- **Board richness comes from catalog scale**, never looser filters. The eBay Growth Check + catalog expansion are the real board-fattening levers.

## John's manual TODOs

- **X bot go-live:** create the X app + OAuth 1.0a user tokens, set `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` in Vercel, set a console spending cap, smoke-test, then `X_BOT_LIVE=true`. Review the daily Discord drafts first. Runbook: docs/runbooks/x-bot.md.
- **GSC:** Request Indexing on ~10-15 priority URLs (homepage, top card pages, /deals, pillar/blog).
- **Mercury approval -> connect to Stripe + clear the verify-business task.**
- **Verify the homepage headline** (a goal already flipped the hero to the utility-first framing; confirm it matches docs/website-copy-deal-finder.md and pick a final headline).
- **Fix the 2710 vs 3710 home-address mismatch** across Stripe + Mercury.
- **Claude Code context:** sessions hit the cap (98% today). Stay on Opus 4.8 (it supports 1M context; do NOT downgrade to 4.6). The 1M window is included on Max/Team/Enterprise; on Pro it needs usage credits enabled. Consider Max. Start fresh sessions and rehydrate from these docs.

## Queued goals (run order, fresh session)

1. **Structured-matching backbone** — verify Set + Number + Finish (+ language + condition) on the picked listing before it counts as a deal, using eBay item specifics. The accuracy moat John flagged. Quota-hungry (getItem per listing) -> sequence with the Growth Check.
2. **SEO / indexability audit** — confirm all card/catalog/deals pages return 200 to Googlebot (diagnose the 3 GSC "page with redirect" failures), no stray noindex, canonical + sitemap correct. A ready goal exists in chat history.
3. **Catalog scale + eBay Growth Check** — fatten the board + the SEO surface. Deals cron is ~411/day (2 calls/card); ~5x headroom before the 5,000/day ceiling, so expansion + the Growth Check go together.
4. **Roadmap reconciliation** — fold PLAN-2026-06-05 into ROADMAP.md + PRODUCT.md + a strategy ADR (utility-first, subscription-ready). Perfect for a fresh session since it just reads the docs.
5. **Subscription-ready seam + instant-alerts wedge** — entitlement/tier check at alert-frequency + watch-limit boundaries (default free); the paid wedge is "watch unlimited cards, get alerted the instant one drops below market." Gated on an engaged-free-user threshold + demand.

## ADRs added today

054 (leaderboard), 055 (logo wordmark), 056 (deal redirect + self-hosted hero), 057 (condition+language like-for-like matching), 058 (X content bot, dry-run-first). Plus the browse_calls CHECK-constraint migration.

## Open risks / notes

- **R-012 (eBay quota):** deals cron ~411/day; structured-matching + catalog scale will eat headroom -> Growth Check becomes the gate. Telemetry now tracks it.
- **R-019 (X automation):** ToS + cost runaway. Mitigated by own-posts-only, dry-run-first, and a spending cap (set it before going live).
- **Board thin (~3)** until catalog scales — expected, not a bug.
- **R-009 (.env.local drift):** eBay creds keep dropping from .env.local (blocked an eBay deploy AND the F4 probe today). EBAY_DEVELOPER_CERT_ID was re-added. Worth permanently re-mirroring the full eBay cred set.

## Read these next (in order)

CLAUDE.md -> this handoff -> docs/PLAN-2026-06-05.md -> docs/BUSINESS-MODEL-2026-06-05.md -> top of docs/SESSION-LOG.md -> docs/ROADMAP.md. Supporting: docs/grading-leaderboard-data-sources.md, docs/website-copy-deal-finder.md, docs/runbooks/x-bot.md.
