# Next-Session Brief — prepared 2026-06-26 (deliverability + cheat-sheet done; X bot mid-setup)

> Read this first. Where things stand + the next plan. (Written by Cowork; commits run on John's machine — the sandbox can't commit cleanly: it shows whole-repo line-ending churn.)

## State: foundation + delivery are done. We are mid-way through standing up autonomous X.

The newsletter machine is built, branded, compliant, conversion-ready, and the lead magnet now actually delivers. The list is still ~1 (John's seed). Everything left is distribution, and the active workstream is the X content bot.

### Shipped this session (2026-06-26)
- **Email deliverability hardened.** Diagnosed spam-foldering as virgin-domain reputation (DMARC `p=none` present, SPF/DKIM Live), not auth. Set the CAN-SPAM footer address (`2710 Southern Hills Ct, Fairfield, CA 94534`), sender now shows "John at Foil", reply-to is John's Gmail, gold email frame lightened.
- **Cheat-sheet lead-magnet loop fixed end-to-end.** Built a branded 2-page PDF (`public/free/foil-pokemon-card-pricing-cheat-sheet.pdf`, live in prod). The `/free` gate stays for cold SEO traffic; subscribers get an ungated "Download the PDF" path + a download button on unlock. The **welcome email button now links straight to the PDF** (repointed via Beehiiv + published) — no more "subscribe again" contradiction.
- **`/newsletter` conversion-ready** (earlier today): cadence copy fixed, fabricated "Recent issues" replaced with the real `market_movers` snippet, Twitter card added. Live.
- **X bot credentials wired.** OAuth 1.0a keys for **@Johnnycakx** (John will rename to @FoilTCG later) in Vercel prod + `.env.local`, encrypted. Dry-run smoke test passed; voice is good (deadpan, teaches). **"Level-4 TCGplayer seller" jargon dropped** from the bot's `post-text.ts` (kept "TCGplayer seller") + the jargon guard extended to scan `lib/social` (commit `3ff6d53`).

## The next build: X "approval gate" (then launch)
The X bot today is binary: dry-run (drafts to Discord, never posts) or `X_BOT_LIVE=true` (auto-posts, no review). John wants **auto-draft → he approves in Discord → it posts** (verify without writing/posting himself). That's a new mode.

1. **NEXT GOAL: `docs/goals/x-approval-gate.md`** — adds `X_BOT_MODE` (dry_run/approval/live); in approval mode the daily cron drafts to `#content-engine` with a one-tap approve → posts via the existing `lib/social/x-client.ts`; owner-only, expiry auto-skip, idempotent. One-liner: `/goal Read docs/goals/x-approval-gate.md and execute it. Commit, do not push.`
2. **Before/while building:** the daily cron (14:00 UTC) drops a dry-run draft into `#content-engine` — review a few to confirm the voice before approval/live.
3. **Launch thread** (one-time, manual founder post) is ready in `docs/social/x-launch-2026-06-26.md` (real movers, deadpan voice, link-last). The bot carries the daily cadence after.
4. **Verify creds against the X API** (read-only `GET /2/users/me`) before any live post — not yet done.

## John's job once live
Following relevant Pokémon accounts + replying to people (manual, ToS-safe, the real growth lever). The bot handles daily posting; auto-replies/likes/follows are X-ToS-prohibited.

## Lower-priority / cosmetic leftovers
- Beehiiv **Website SEO title** still reads "Rise & Close | Expert SDR Training…" (separate from General Info, which is correctly "Foil"). Cosmetic. Also R&C-era publication tags (News/Popular Culture) + the B&W default thumbnail in General Info.
- The Beehiiv **Preset Welcome Email** still holds R&C content but is OFF (doesn't send) — leave off.
- Old `riseandclose.com` form still pins 3 sales custom fields (API delete 400s). Invisible to subscribers.
- X handle rename @Johnnycakx → @FoilTCG when ready (keeps tokens).

## Standing infra / ops
- ⏰ **PokeTrace re-subscribe before ~July 15 — LOAD-BEARING.** Movers, `/deals`, the digest, and the `/newsletter` real-data snippet all run on it. Reminder July 13.
- X spend cap set ($100/cycle) + auto-recharge on; ~$8/mo realistic at one thread/day.
- Dead Supabase PAT (401) — regenerate at supabase.com/dashboard/account/tokens.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON — don't "fix" to false.
