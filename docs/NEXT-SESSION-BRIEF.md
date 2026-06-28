# Next-Session Brief — 2026-06-28 — first X post LIVE + launch thread posted + SEO crawl fix shipped

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## State: Foil crossed from "building the engine" to "operating it in public." The X flywheel is live, and the SEO crawl bottleneck is diagnosed + fixed (pending push).

Today went from polish → first real public posts → a measured SEO unlock. The big shift: we found WHY organic traffic was flat (a crawl throttle, not a content problem) and shipped the fix.

### Shipped + PUSHED today (2026-06-28)
- **Card-hero v2.1** (`f594370`) — removed the red ▼ (encoded as a rectangle in MP4), clean navy→tinted-navy gradient background (dropped the muddy blurred-card cover, kept the glow halo), four-beat viral copy restructure, relaxed the per-number "as of today" to a single present-tense anchor, **link-in-first-reply** mechanism (link-free body for reach), + a post-structure quality gate.
- **Card-hero v2.2** (`fd007b4`) — the reply is now the **newsletter lever**: value-framed card link ~80% of days, newsletter CTA every 5th day (`dayIndex % 5`), board-only "bookmark" save ask. Migration `20260627160000_x_post_drafts_reply_text` applied in prod.
- **FIRST REAL X POST is LIVE** — Blastoise card-hero (MP4 motion), approved via Discord `/approve`, posted to @Johnnycakx with the threaded value-framed reply. **The `tweet_video` chunked upload is now verified in prod — the last unproven path in the whole system is proven. The X engine works end-to-end.**
- **Launch thread POSTED** — the 6-tweet native thread (`docs/social/x-launch-thread-2026-06-28.md`), generated from fresh `market_movers` (3 down-movers + Pikachu 151 up-mover, all 50+ sales, honest). **T1 pinned.**
- **X profile** — bio → "Pokémon TCG market insights from a TCGplayer seller. What's moving and where the real deals are. Free newsletter below." Website link → **`foiltcg.com`** (homepage; its hero leads with the newsletter capture, so message-match holds, and it introduces the product to cold visitors better than /newsletter). **@FoilTCG handle rename still PENDING X profile review** (rate-limited; retry later).

### Shipped but NOT pushed (do this FIRST next session)
- **SEO crawl fix — Option B "dynamic-but-fast" (committed, NOT pushed).** THE diagnosis (from GSC, this session): **16 indexed / 1,007 "Discovered – currently not indexed" / 0 "Crawled – not indexed."** Discovery works (sitemap healthy: 0.42s, 1,224 URLs); there is **no quality problem** (0 crawled-not-indexed). The wall is **crawling** — and the measured cause is a **37.9s cold TTFB** on card pages: `force-dynamic` blocked the server HTML on a live eBay/PokeTrace fetch, so Google throttled crawl. The fix moved the live curated-tier blocks (eBay `resolveVerifiedListing` + buy-signal + PokeTrace sold-history) **off the server render to a new client-side `/api/listing/[slug]` route** (`components/cards/live-listing-section.tsx`). Server now returns fast evergreen HTML → throttle should lift. R-008 preserved (live blocks fetched client-side, never cached; affiliate HTML leaves the crawled DOM = cleaner for ranking). 1115 tests green, `/security-review` clean. **Chose B over full static/ISR (Option A) because the measurement showed the evergreen render was ALREADY fast (baked snapshot) — only the live blocks needed moving — so B lifts the throttle WITHOUT reopening the ADR-047 `searchParams` 500 landmine. Lower risk, same SEO outcome.**

## Open / next (in priority order)
1. **PUSH + verify + deploy the SEO crawl fix.** Review the card-page diff, confirm a live card page still renders the listing correctly (now client-hydrated) + content-marker verification (ADR-049), then push. **Then the GSC follow-up:** resubmit `sitemap.xml` (its last process date was 6/11), hit **"Validate Fix"** on the "Discovered – not indexed" row, and **URL Inspect → Request Indexing** on 5–10 top cards (Charizard + chase cards) to prime the re-crawl. This is the autonomous high-intent-traffic unlock — highest-leverage thing on the board.
2. **X growth = manual outbound + the syndication engine.** With ~1 follower, reach comes from John replying with value on bigger TCG accounts (Regannator, PokemonDealsX, SmartTCG, SanderWojcik, hegstertcg…) ~15 min/day — NOT from posting more (50x/day autobot = suspension; confirmed via research). The autonomous content-syndication engine (below) is the systematized version.
3. **Queued goal specs** (in `docs/goals/`, gitignored scratch):
   - `og-image-card-hero-art.md` — OG/link-preview image uses Pokémon card-hero art (currently flat text-on-navy) **+ reconcile the lockup drift** (the OG renderer and the card-hero renderer use different marks — John caught it). Note: Satori may not render the `.webp` hero art → likely needs PNG conversion; won't change the already-posted thread's cached preview.
   - `seo-crawlability-indexing-health.md` — DONE as Option B; the file documents Option A (full static/ISR) as a **later optimization** once B proves the throttle lifts.
   - `x-card-hero-v2.2-copy-cta.md` — DONE (v2.2).
4. **Build the social-syndication-engine goal spec** (not yet written) — see IDEAS. Multi-platform content fan-out (Postiz, 28+ channels) + a daily auto-generated engagement brief. Needs John to create a FoilTCG Instagram + TikTok and connect them. **Hard line (researched + settled): automate content DISTRIBUTION, never engagement ACTIONS (auto-reply/follow/DM = suspension).**

## Decisions settled today (don't relitigate)
- **Buying X followers — REJECTED.** Zero clicks/engagement, pollutes the metrics engine, craters engagement-rate → algorithmic suppression, ToS purge/suspension risk, kills the "real numbers, no hype" credibility that IS the brand.
- **Paid X boost/ads — deferred,** not now. Only makes sense later against a proven converting post + a tracked impression→subscribe funnel.
- **X vs GSC priority — GSC/SEO is the primary 90-day autonomous-traffic bet** (confirmed fixable bottleneck, high-intent traffic, zero daily human input, compounds permanently). X syndication is the parallel low-effort track. Neither is a fast-traffic source; both are slow-fuse.

## Standing
- **PokeTrace ACTIVE** (Paddle, cancels **~Jul 16** — re-confirm/renew before then). Load-bearing for the whole insight engine (deals, movers, card pages, X posts).
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- **Sole-committer rule:** don't edit tracked repo files while Claude Code / the runner is mid git-op (stash/commit/reset). Pushes are tree-safe.
- Cowork CANNOT commit/push from its sandbox — hand John the `docs:` one-liner.

## Uncommitted at session end (hand John the docs commit)
This session's Cowork doc work sits uncommitted in the working tree: `NEXT-SESSION-BRIEF.md`, `COWORK-CONTEXT.md` (the measure-before-rebuild lesson), `IDEAS.md` (syndication engine + up-mover angle + color-coding + paid-boost-later). The SEO crawl fix is committed-not-pushed on `main` separately. Commit the docs, then push the SEO fix when reviewed.
