# Runbook — daily X content bot

**Status:** Built dry-run-first (ADR-058). `X_BOT_LIVE` defaults to **false** — the bot generates a daily draft and posts it to Discord `#content-engine` for review, and **never touches the X API** until John completes the setup below and flips the switch.

## What it does
A daily Vercel cron (`/api/cron/x-post`, 14:00 UTC, after the 08:00 deals-refresh) picks one of three rotating angles, renders a branded 1080×1350 portrait image from the `buy_signals` cache (R-008-safe — no eBay listing data), generates a voice-gated post (Gates 12/13, exact numbers, "as of today"), and:
- **dry-run (default):** posts the draft text + image to Discord for review.
- **live:** posts to the Foil X account via the X API.

Angles rotate by day: (1) deal of the day, (2) price spotlight, (3) educational/trust. A thin board falls back gracefully (see `lib/social/angles.ts`).

## To enable live posting (John, one time)
1. **Create an app** at [console.x.com](https://console.x.com) under the Foil X account. Enable **User authentication** with **Read and Write**.
2. **Get OAuth 1.0a user tokens** (the bot uses user-context OAuth 1.0a — long-lived, no refresh flow): copy the **API Key**, **API Key Secret**, **Access Token**, **Access Token Secret**. (App-only Bearer tokens CANNOT post — must be user tokens for the Foil account.)
3. **Load credits + set a SPENDING CAP** in the developer console. Pricing is pay-per-use; **a post containing a URL is $0.20 per request** (our posts link foiltcg.com, so ≈$0.20/day ≈ $6/mo). Set a monthly cap (e.g. $10) so a bug can't run away. (Source: docs.x.com pricing, 2026 pay-per-use.)
4. **Set the env vars** (`.env.local` + Vercel, both):
   ```
   X_API_KEY=...
   X_API_SECRET=...
   X_ACCESS_TOKEN=...
   X_ACCESS_SECRET=...
   ```
5. **Verify once in dry-run** that the Discord draft looks right (text + image). Optionally run locally: `node --experimental-strip-types --no-warnings --env-file=.env.local scripts/x-post-dryrun.ts` (writes `docs/social-drafts/{date}/post.txt`).
6. **Verify the poster path once** before trusting the daily cron: with creds set, the media-upload + create-post path (`lib/social/x-client.ts`) should be smoke-tested manually (X's media-upload auth has been migrating; this client targets v1.1 media upload + `/2/tweets` with OAuth 1.0a — confirm it succeeds end-to-end on the real account, then trust the cron).
7. **Flip the switch:** set `X_BOT_LIVE=true` in Vercel. The next 14:00 UTC cron posts live. To pause, set it back to `false` (or unset) — the kill-switch.

## Kill-switch
`X_BOT_LIVE` (Vercel env). Anything other than the exact string `true` = dry-run, no posting. There is no other code path to the X API; `lib/social/x-client.ts` is the only module that calls it.

## Cost & ToS posture
- Own-account posts only (no automated replies, follows, likes, DMs, or engagement — that's where X's automation ToS bites). One scheduled post/day.
- Cost bounded by the daily cadence + the console spending cap. Monitor the X console credit balance.
