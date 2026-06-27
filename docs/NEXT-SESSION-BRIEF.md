# Next-Session Brief — prepared 2026-06-27 (X bot live end-to-end; card-hero Phase 1 shipped)

> Read this first. Where things stand + tomorrow's plan. (Written by Cowork; commits run on John's machine — the sandbox shows whole-repo line-ending churn and can't commit cleanly.)

## State: the X distribution engine is live and proven end-to-end, with a real-art card-hero image.

Today went from "emails landing in spam" to a working, human-approved autonomous X bot that posts honest, fresh, branded card-deal images. The list is still ~1; the machine to grow it now runs.

### Shipped today (2026-06-26 → 06-27)
- **Email deliverability hardened** — reputation diagnosis (not auth), CAN-SPAM footer address set, sender "John at Foil", reply-to John's Gmail.
- **Cheat-sheet lead magnet fixed** — real branded PDF live; welcome email links straight to it (no re-gate).
- **X content bot LIVE end-to-end** (ADR-071): approval mode proven — daily cron → renders image → posts approval card to Discord `#content-engine` → John `/approve <id>` → posts to X (@Johnnycakx). Write path verified (real posts live). Spend cap $100/cycle.
- **Deal data fixed** (ADR-072): deal angle now sources fresh `market_movers` (no phantom deals), volume-ranked, with a 48h freshness guard + a `x-metrics` cron logging engagement from day one.
- **Card-hero image SHIPPED** (ADR-073): sharp-generated **card-derived background** (the card's own colors become its blurred "world" + navy undertone), **real card art**, Satori hero (daily) + board (weekly) templates, **Fredoka** brand font, wordmark + "FIND. TRACK. SAVE." slogan, white number (gold toggle), red ▼. Rendered real-art in prod — **first pass is good** ("call it there for today"). Validated over 8 prototype rounds + a virality score vs @getcollectr (hero 8.35 > board 7.75). Reference assets: `docs/social/ref/`.
- **Webhook bug fixed:** `DISCORD_WEBHOOK_CONTENT_ENGINE` was only in `.env.local`, never mirrored to Vercel prod → the approval card was silently guard-skipped in prod. Now set + redeployed; approval cards deliver to `#content-engine`.

### Open item right now
The card-hero approval draft `6d087d4a-77bd-4ff7-8c27-4c2586e9e552` is **pending in `#content-engine`**. John can `/approve` to post it (it's good), or leave it (auto-expires ~12h) and post a finalized version tomorrow.

## Tomorrow's plan (prioritized)
1. **Finalize the card-hero design** (it's a strong first pass; polish to ship-quality): decide **white vs gold number** (Cowork leans white — looked great with real art), lock the **slogan**, tune blur/number-size/spacing, and check a small red artifact seen overlapping the card's flavor text in the render. Then approve/post a real one.
2. **Motion/animated card-hero** — the logged idea (`docs/IDEAS.md`, John wants to attempt 2026-06-28): holo shimmer/3D-tilt as MP4/GIF; X autoplays video and Collectr leans on motion. Highest-virality version. Bigger build (video encode + the approval card must preview the clip).
3. **Phase 2: homepage "Latest from X" flywheel** — secondary section (below the email capture), server-fetched + cached, soft-fail. Spec is in `docs/goals/x-flywheel-card-hero-and-homepage.md` (Phase 2).
4. **Approval-card decision-ready enrichment** — `docs/goals/discord-decision-ready-actions.md` (queued): add a one-click "verify on live page" link + rationale to every Discord approval card.
5. **Demand-weighted content selection** (bigger; `docs/IDEAS.md`) — rank X/newsletter/blog topics by sales volume + GSC search + Pokémon popularity.

## Queued goal files (gitignored scratch, ready to paste)
- `docs/goals/discord-decision-ready-actions.md`
- `docs/goals/x-flywheel-card-hero-and-homepage.md` (Phase 2 remainder)
- (tomorrow: write the motion goal)

## Standing
- **PokeTrace renewal CONFIRMED** (John) — live ongoing dependency, do not architect around it lapsing.
- The daily X bot now runs autonomously with John's Discord approval as the only manual step; auto-replies/likes/follows stay off (X ToS).
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON.
- 6 Vercel crons: wishlist, browse-telemetry, deals-refresh, market-movers, x-post, x-metrics.
- Cosmetic leftovers: Beehiiv Website SEO title still "Rise & Close…"; R&C tags/thumbnail; @Johnnycakx → @FoilTCG rename when ready.
