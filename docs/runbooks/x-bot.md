# Runbook — daily X content bot

**Status:** Built dry-run-first (ADR-058), now with an **approval mode** (ADR-071). Three modes via `X_BOT_MODE`:
- **`dry_run`** (default) — draft to Discord `#content-engine`, never touch the X API.
- **`approval`** — draft + persist + ask the owner to approve in Discord; posts only after `/approve <id>`.
- **`live`** — auto-post, no review.

`X_BOT_MODE` takes precedence; the legacy `X_BOT_LIVE="true"` still maps to `live` when `X_BOT_MODE` is unset. The bot **never touches the X API** until John completes the setup below and chooses a posting mode.

## Approval mode (the recommended middle ground)

"I'll approve, but I won't write or post them myself." The daily cron drafts the post, **persists it** (`x_post_drafts`, the exact text + image), and posts an approval-request embed to `#content-engine` carrying a **draft id**. Nothing posts until you act:
- **`/approve <id>`** (Foil HQ bot slash command, owner only) → the bot relays to `/api/x/approve`, which posts the persisted draft to X via the single `x-client.ts` boundary.
- **`/skip <id>`** → marked skipped, never posted.
- **No action within 12h** → the draft auto-expires and is never posted (the next day's cron sweeps it).

The post is **idempotent** (a draft posts at most once — double-`/approve` is a no-op) and **owner-gated** (`X_BOT_OWNER_DISCORD_ID`; fail-closed if unset).

**To enable approval mode (John, one time, at deploy):**
1. Apply the migration: `SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push` (creates `x_post_drafts`).
2. Generate a secret: `X_APPROVE_SECRET` (32+ random bytes). Set it on **Vercel production** AND the **bot Railway** env (`railway variables --set X_APPROVE_SECRET=...`).
3. Set `X_BOT_OWNER_DISCORD_ID` (your Discord user id) on the **bot Railway** env. (Optional `FOIL_APP_URL` — defaults to `https://foiltcg.com`.)
4. Set `X_BOT_MODE=approval` on **Vercel production**.
5. Redeploy the bot so the new `/approve` + `/skip` commands register: `git push origin main` (Railway auto-deploys).
6. Wait for the 14:00 UTC cron (or trigger it), confirm the approval embed lands in `#content-engine`, then `/approve <id>` once to smoke-test the live poster path end-to-end.

The four X credentials (`X_API_KEY` etc.) stay **only on Vercel** — the bot never holds them; it only asks Vercel to post.

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
