# Next-Session Brief — prepared 2026-06-27 (later) — the autonomy loop + MP4 motion card-hero are BUILT

> Read this first. Where things stand + the next plan. (Written by Cowork; commits run on John's machine — the sandbox can't commit cleanly.)

## State: two big builds landed locally this session — the autonomous goal-runner AND the MP4 motion card-hero. Both committed, gate-clean, NOT pushed.

### Built today (2026-06-27 later), committed locally (4 commits ahead of origin, nothing pushed)
- **X profile optimized + LIVE** — name `John | FoilTCG.com` (verified badge), bio "Each week I post what's actually moving and where the real deals are. Real eBay numbers, no hype. Free newsletter below.", website → `foiltcg.com/newsletter`, pinned = the tighter origin-story tweet. Handle rename to **@FoilTCG** is **pending X profile review** (the handle read as claimable — "doesn't exist" — likely no Premium+ needed; retry the rename once review clears).
- **X Premium bought** — real wins are founder-side (reply-boost amplifies the manual reply strategy, verified badge, analytics). **Does NOT help the bot/API** (the bot posts via the developer API; Premium is consumer-side). Premium+ only needed for the handle IF it turns out squatted — it isn't.
- **Card-hero v2 Phase 0** (committed `d4b271c`): white number + 8-dir black text-shadow outline, **slogan removed** (it was lifted from a competitor), red ▼ overlap fixed by layout. Locked + the still is now the motion fallback.
- **Phase 0.5 spike → MP4 chosen** (committed `5df4225`): "render still once, animate shimmer in sharp" is cheap; GIF busts Discord's 10MB preview + X res caps; **MP4 (H.264) won**. ADR-074 amendment.
- **Goal 1 — Phase 1 MP4 motion** (committed `459e850`): h264-mp4-encoder WASM, ~1MB seamless loop @ 864×1080, chunked `tweet_video` upload (still-fallback on reject), `video_base64` column so `/approve` posts the exact reviewed clip + Discord previews the MP4. Gates all green. ADR-074 Phase 1.
- **Goal 2 — the autonomous goal-runner** (committed `0b248f8`): `npm run goals:watch` — headless `claude -p` → independent gates → commit (NEVER push) / discard+BLOCKED / commit+DECISION_NEEDED, Discord ping, `gitArgsAreSafe` never-push guard (hardened in security review). Runbook + ADR-075 + ENV-VARS. **This is the semi-async unlock.**

### Open RIGHT NOW (the push sequence — do in order)
1. **Apply the migration BEFORE/with the push:** `supabase db push` (the `20260627130000_x_post_drafts_video.sql` video column). Pushing the code without it breaks the next X approval-draft persistence in prod.
2. **Push the 4 commits** → Vercel auto-deploys. (John's call; was at the push prompt end of session.)
3. **Verify live:** next daily `x-post` cron posts an approval card with the **MP4 preview** to `#content-engine` — that's also the one live confirmation of the chunked `tweet_video` OAuth-1.0a multipart path. Eyeball the motion + `/approve` a real one.
4. **Supervised runner first-run** before trusting it unattended: `npm run goals:watch` with one spec, `--once --halt-on-block`, clean tree.

## Next plan (prioritized)
1. Push + migration + live-verify the MP4 path (above).
2. **Maiden runner run** = feed `docs/goals/x-launch-thread-refresh.md` into `docs/goals/_queue/` as the first real spec (PokeTrace confirmed ACTIVE). Validates the loop AND produces the launch thread with fresh numbers.
3. **Post the launch thread** as a deliberate moment, paired with the first MP4 card-hero, when John can reply for an hour (first-hour reply velocity = reach; Premium reply-boost helps).
4. Trickle the evergreen warmup tweets (`docs/social-drafts/warmup-evergreen-2026-06-27.md`) to wake the account.
5. Retry the @FoilTCG rename once X profile review clears.
6. Future loop upgrade option: opt-in auto-push for docs-only commits (app/prod pushes stay manual).

## Standing
- **PokeTrace ACTIVE** (Paddle: Jun 16 renewal paid $98, scheduled to cancel **Jul 16** — re-confirm/renew before then). The old "stale data" guard is moot while billing is live.
- **The autonomy model:** John starts `goals:watch` before stepping away; Cowork writes goal specs into `docs/goals/_queue/`; the runner executes + commits (never pushes) + pings Discord. **Push to prod stays manual by design** — the guardrail that makes unattended runs sane. Sole-committer rule: don't run an interactive Claude Code goal in the repo while the watcher is active.
- Cowork still CANNOT commit/push from its sandbox, and CANNOT type into John's terminal (terminals are click-only) — which is exactly why the goal-runner (file-queue fed) is the right autonomy bridge, not GUI puppeting.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON. 6 Vercel crons live.
- Cosmetic leftovers: Beehiiv "Rise & Close" SEO title; @Johnnycakx → @FoilTCG rename when review clears.
