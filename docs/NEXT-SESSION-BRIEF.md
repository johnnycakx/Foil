# Next-Session Brief — 2026-06-27 (evening) — X engine + autonomy loop + approval gate ALL LIVE

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## State: the X distribution engine is fully operational end-to-end. Today crossed from building to operating.

The daily flow now runs: cron → renders the card-hero → posts a Discord approval card → John `/approve` → posts live to X. The motion render, the autonomy loop, and the approval gate are all proven in prod. Remaining work is polish + the first *good* post, then growth.

### Shipped today (2026-06-27), pushed to origin/main
- **X profile optimized + LIVE** — name `John | FoilTCG.com` (verified badge), bio ("Each week I post what's actually moving and where the real deals are. Real eBay numbers, no hype. Free newsletter below."), website → `foiltcg.com/newsletter`, pinned = the tighter origin-story tweet. **@FoilTCG rename pending X profile review** (handle read as claimable; retry when review clears).
- **X Premium bought** — founder-side wins (reply-boost, verified, analytics). Does NOT help the bot/API (consumer-side).
- **Card-hero v2 (ADR-074)** — Phase 0 static fixes → Phase 0.5 spike (MP4 chosen over GIF) → Phase 1 MP4 motion: h264-mp4-encoder WASM, ~1MB seamless holo-shimmer loop, chunked `tweet_video` upload (still fallback), `video_base64` column so `/approve` posts the exact reviewed clip + Discord previews the MP4. **Verified live in prod**: a manual cron run rendered the first MP4 approval card (Blastoise), the encoder ran in the Vercel function, both media persisted.
- **Autonomous goal-runner (ADR-075)** — `npm run goals:watch`: headless `claude -p` → gates → commit (NEVER push) / discard+BLOCKED / DECISION_NEEDED, Discord ping, hardened never-push guard. **Proven** via a supervised smoke run that caught + fixed 2 of its own bugs (env-isolation leak + decision false-positive). This is the "go to the gym and it works" machine.
- **Approval-gate bot enablement (ADR-071 completed)** — root cause was global slash-command registration (~1h propagation); fixed to **guild-scoped (instant)**. `/approve` + `/skip` now appear in Foil HQ and are confirmed working; Railway secrets verified; relay + owner-gate proven end-to-end. The daily approval workflow is now usable.

### Open / next (in order)
1. **Run v2.1 polish** — `docs/goals/x-card-hero-v2.1-polish.md` (interactive Claude Code, so John can eyeball the render): remove the red ▼ (renders as a rectangle in the MP4), simplify the muddy card-derived background to a clean navy + dominant-color-tint gradient (keep the glow halo, drop the blurred-card cover + vignette), and rework the deal-post copy — hook → the insight the image can't show (the volume read) → teach one mechanic → light conversation hook, **beat-spaced line breaks**, **link in the first reply not the body**. Validated Blastoise copy is in the goal. Add a post-text quality gate.
2. **Approve the first polished card** in Discord (`/approve <id>`) → first *good* motion post live on @Johnnycakx + verifies the chunked `tweet_video` upload (the LAST VERIFY-ON-ENABLE). Let the current pre-polish Blastoise draft `18b2d14e…` **auto-skip**.
3. **Feed `launch-thread-refresh` through the loop** — queued at `docs/goals/_queue/01-launch-thread-refresh.md` (gitignored, collision-safe). Generates the launch thread from live PokeTrace data. Post as a deliberate moment, paired with a polished motion post, when John can reply for the first hour.
4. **Trickle the evergreen warmup tweets** — `docs/social-drafts/warmup-evergreen-2026-06-27.md` (one a day, value-first).
5. **Retry the @FoilTCG rename** once X profile review clears.

### Idea backlog (logged in IDEAS.md today, for Sunday triage)
- **Close the content→metrics loop** — let `x_post_metrics` steer the bot (measure virality, stop guessing). Highest-leverage.
- **"Scoreboard" series** — call → result follow-up posts (credibility + 2x content surface).
- **Borrow Collectrics' data-story framings** — PSA 10 premium movers, graded-vs-raw gap, set heating/cooling (all from PokeTrace data we hold).

## Standing
- **PokeTrace ACTIVE** (Paddle: paid through, cancels **Jul 16** — re-confirm/renew before then). The old "stale data" guard is moot while billing is live.
- **Autonomy model:** John starts `goals:watch` before stepping away; Cowork writes specs to `docs/goals/_queue/` (gitignored, collision-safe); the runner executes + commits (never pushes) + pings Discord. **Push to prod stays manual by design.**
- **Cowork sole-committer rule (learned today):** don't edit tracked repo files while Claude Code / the runner is mid git-op (stash/commit/reset) — they collide (bit us once, no data lost). Pushes are tree-safe. Lesson in COWORK-CONTEXT.
- Cowork CANNOT commit/push from its sandbox or type into John's terminal — the file-queue goal-runner is the autonomy bridge, not GUI puppeting.
- **Competitive:** Collectrics (PokeDataDadGuy / @TheDayFamilyProject) is a fast-shipping, monetized, YouTube-funneled peer — full reassessment in `docs/competitive-collectric.md`. His gap: no live eBay listings. Foil's wedge: buyer-side live-deal signal feeding the email-list moat.
- `AUTO_PUBLISH_WEEKLY_POSTS` intentionally ON. Cosmetic leftover: Beehiiv "Rise & Close" SEO title.

## Uncommitted at session end (hand John the docs commit)
This session's Cowork doc work sits uncommitted in the working tree: `NEXT-SESSION-BRIEF.md`, `COWORK-CONTEXT.md` (sole-committer lesson + co-CEO mandate), `IDEAS.md` (3 new entries), `competitive-collectric.md` (Collectrics reassessment). John's vending assets + newsletter draft are separate WIP — leave unstaged.
