# Runbook — Postiz multi-channel syndication (PARKED: setup prerequisites + design)

**Status (2026-06-29):** Design captured, build **parked** pending Postiz setup. The P0 premise check for `docs/goals/postiz-multichannel-autosyndication.md` found the goal's foundation absent — the `postiz:postiz` skill is not installed, no Postiz account/API key/connected channels exist (Postiz was only an idea, `IDEAS.md` 2026-06-28), and connecting channels is OAuth-via-dashboard = John's hands. Per AGENTS.md we don't build against an external API we can't verify end-to-end, so the syndication tap is deferred until the prerequisites below are done. Policy + architecture recorded in [ADR-085](../DECISIONS.md#adr-085--content-syndication-safe-vs-human-channel-split-postiz-as-the-headless-layer-build-gated-on-setup).

## What Postiz actually buys us (scope sharpener)
- **X** is already syndicated — directly, via `lib/social/x-client.ts` (the X bot), NOT Postiz.
- A **Foil-owned Discord** announce channel is already auto-postable via the existing `lib/notifications/discord.ts` webhook lib — **no Postiz needed**.
- So Postiz's **net-new** value is **Bluesky / Threads / Mastodon** today (own feeds, free, safe), and **Instagram / TikTok** later (need new Foil accounts).

## Channel-safety split (the load-bearing policy — ADR-085)
Auto-post ONLY to surfaces Foil **owns** or broadcasts to its **own feed**. NEVER auto-post into communities Foil doesn't own — that's ban-risk and stays on the **human** track (the weekly distribution kit).

| Tier | Channels | Transport | Auto-post? |
|---|---|---|---|
| **Auto-safe (own/owned, no new account)** | X | `x-client.ts` (direct) | ✅ already live |
|  | **Bluesky, Threads, Mastodon** | Postiz | ✅ once connected (net-new) |
|  | Foil-owned Telegram channel | Telegram bot | ✅ once John creates the channel |
|  | Foil-owned Discord announce channel | our webhook lib | ✅ already possible, no Postiz |
| **Auto-safe but needs a new account first (John)** | Instagram, TikTok | Postiz | ⏸ defer until accounts exist |
| **Human-only (others' communities — BAN RISK)** | subreddits (r/pkmntcgdeals, r/PokeInvesting), third-party Discords | — | ❌ never auto; weekly human kit |

**Default-deny:** any channel whose ownership/safety is unclear defaults to the human track.

## Prerequisites — John's one-time setup (account + OAuth = your hands)
1. **Get Postiz.** Sign up for **Postiz Cloud** (`api.postiz.com/public/v1`) OR self-host (`{NEXT_PUBLIC_BACKEND_URL}/public/v1`). Cloud is the faster start; self-host avoids a vendor + per-seat cost (the daily/weekly cadence is well under the self-host 90-posts/hour limit). Decide which.
2. **Generate a public API key** (Postiz settings → Public API).
3. **OAuth-connect the auto-safe channels in the Postiz dashboard** (can't be done via API). Start free + safe: **Bluesky, Threads, Mastodon**. (Defer IG/TikTok until those accounts exist.)
4. **Retrieve the integration IDs** for each connected channel (Postiz API: list integrations) and hand them to me, plus the API key.

## Then the build (fast + verifiable, once unblocked)
- **New env (added at build time, not before):** `POSTIZ_API_KEY` (secret), `POSTIZ_BASE_URL` (cloud default or self-host URL), `POSTIZ_SYNDICATION_ENABLED` (kill-switch, default off), and the per-channel integration IDs (e.g. `POSTIZ_INTEGRATION_BLUESKY`).
- **Syndication tap:** at the existing asset-finalization point (the daily card-hero/board image + caption + the `foiltcg.com` UTM link already built for the X bot), call the Postiz public API to schedule the platform-adapted post to each connected auto-safe channel. Reuse the SAME asset (don't regenerate). Per-platform caption length/format adaptation; one UTM-tagged link per post (per `acquisition-utm.md`, e.g. `utm_source=bluesky`).
- **Discipline:** idempotent (one post per asset/day/channel), soft-fail per channel (one down never blocks the rest), kill-switch (`POSTIZ_SYNDICATION_ENABLED`), and **dry-run first** — initial runs post to a Postiz draft/queue (or one test channel) and notify `#content-engine` with what WOULD go out, then flip live per channel after a clean run (mirrors the X-bot proven-in-prod pattern, ADR-058/071).
- **Attribution:** per-channel UTM so the Sunday acquisition review (`npm run subscriber-sources`) shows which syndication surface converts.

## Verified facts (Postiz public API, from docs.postiz.com, 2026-06-29)
- Base URL: `https://api.postiz.com/public/v1` (cloud) or self-host equivalent. Auth: `Authorization: <api-key>` header.
- The public API CAN: schedule/publish posts to connected channels, upload images, set per-platform options, list integration IDs.
- The public API CANNOT: connect accounts or run OAuth (dashboard-only). Self-host create-post rate limit: 90/hour (batchable) — far above our cadence.
