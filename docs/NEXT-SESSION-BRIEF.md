# Next-Session Brief — 2026-06-30 (late) — engine v2 LIVE + format-mining dry-run ON; next = JOHN POSTS (audience is the bottleneck)

> Read this first: current state + the prioritized next plan. (Written by Cowork; commits run on John's machine.)

## Headline
The X stack is now fully built AND activated. **Engagement engine v2 is LIVE** (advisory replies + Discord Skip/Post buttons; bot-delivered; **John posts every reply by hand — zero-X-write firewall holds**), and the **content-intelligence format-mining engine is built + its Sunday dry-run brief is ENABLED** (`FORMAT_MINING_ENABLED=true`; previews "what's working" formats to `#content-engine`; **never posts to X this rung**). Bio updated to the live version John likes. The unblocker John named (frictionless triage) is delivered. **The bottleneck from here is unchanged and is NOT a build: it's John posting daily + real audience.** Two excellent builds shipped tonight for ~0 real subscribers — that's the trap; the next move is reps, not code.

## What's LIVE now
- **Engagement engine v2** (ADR-086 v2): LIVE, activated 2026-06-30. Daily 15:30 UTC the cron enqueues; the **foil-bot** drains `engagement_brief_items` (60s poll) and posts each candidate to `#content-engine` as a card with **Skip / Post** buttons. **Post NEVER posts to X** — it surfaces copy-ready reply text + a deep link; John posts by hand (~2 taps). Owner-gated, `custom_id` validated, firewall test extended to the 4 bot files. First live brief: scanned 58 / 19 delivered (all **advisory** mode — no resolvable chase card in a reachy thread today; data-cite path fires on a Moonbreon/Prismatic-eeveelution day). `ENGAGEMENT_BRIEF_CHANNEL_ID` set on Railway foil-bot; `ENGAGEMENT_BRIEF_ENABLED=true` on Vercel.
- **Format-mining engine** (ADR-087): built + committed `b58eb63` (pushed). `FORMAT_MINING_ENABLED=true` on Vercel prod → the **Sunday 16:20 UTC cron** posts a dry-run "what's working" format brief to `#content-engine`. **Does NOT post to X** (rung 1 of the autonomy ladder). Ranks niche posts by engagement-RATE (punching above follower count), extracts reusable `MinedPattern[]`, generates Foil posts in John's voice + data behind anti-hype + correct-card + figures-trace gates. Instant local preview: `node --experimental-strip-types --no-warnings --env-file=.env.local scripts/format-mining-dryrun.ts` → `docs/content-intelligence/{date}.md`.
- **Newsletter** `/approve` → editorial → Resend-broadcast loop (live, hardened, Primary-verified, attributed). ADR-078/080/081/082/083.
- **Phase 0 attribution** (ADR-084): `/deals` capture + UTM→source; `npm run subscriber-sources`; `docs/runbooks/acquisition-utm.md`.
- **Live X bio (set by John 2026-06-30):** *Founder | Pokémon TCG market insights from a TCGplayer seller. Tracking sold prices, not asking prices. Free weekly deal drop ↓* (canonical in STRATEGY-AUDIENCE-MOAT.md; supersedes the old workshop bio John disliked).
- Scheduled tasks: daily GSC indexing; daily X-engagement nudge 9:39am PT; Monday distribution kit 8am PT; **Sunday acquisition review 9am PT** (the autonomy-graduation checkpoint — see below).

## Immediate next-session sequence (do in this order)
1. **JOHN POSTS — the daily X habit (THE growth act).** Open the engine-v2 cards in `#content-engine`, tap Post on the best ones, reply by hand on X. **Pace: 5–10 thoughtful replies spaced over time** (gaps between, not bursts — fresh low-follower accounts get throttled on volume+uniformity; quality + spacing keeps you clear). Prioritize data-cite replies when they appear (the real conversion moat); advisory replies build credibility + profile visits. Make sure the bio link lands somewhere with the email capture visible.
2. **No new build by default.** The build side is well ahead of distribution. Before starting ANY new goal, apply the standing test: does it produce the one missing number — proof that traffic converts (signups)? If not, it's likely procrastination; steer back to posting + the Sunday review.
3. **Sunday acquisition review (9am PT)** — the real checkpoint. Judge: (a) are engine-v2 replies being posted + pulling profile visits / signups (UTM readout: `npm run subscriber-sources`)? (b) is the format-mining dry-run brief producing posts John would actually publish? Decide autonomy graduation from evidence (below), not a calendar.

## Format-mining autonomy graduation (proof-gated, NOT date-gated — no reminder set by design)
"Auto-posting" only ever means **our OWN format-mined posts**. Engagement replies on others' posts stay human-posted **forever** (platform-manipulation ban risk — permanent firewall). The ladder for our own posts: **dry-run (now) → `/approve`-gated → fully autonomous.** Advance a rung only on proof:
- **Rung 2 (`/approve`-gated):** route format posts through the X bot's existing runXBot approval seam (John approves each in Discord, ~2 taps). **Trigger:** dry-run briefs consistently produce posts John would publish (eyeball 1–2 Sundays or the local preview).
- **Rung 3 (autonomous):** drop the gate only after several clean approve-gated runs prove quality unattended.
- **The real gate is AUDIENCE, not the ladder.** Auto-posting our own content to ~4 followers moves nothing; format-mining's near-term value is giving John better containers for his MANUAL posts. Don't flip autonomy into an empty room. Reassess at the Sunday review.

## Queued goals (priority order — all behind "John posts" + audience signal)
- `content-intelligence-format-mining` — DONE (dry-run live; verified prod: scanned 136 / 6 patterns / 3 generated, zero X). **Fast-follow surfaced by the FIRST live brief: the mining query is OFF-LANE.** The top engagement-RATE outliers it surfaced were furry/OC fan-art accounts (NeoVulpeku, Vulpeku_NSFW — rate 0.14/0.07), whose formats ("fan-art process," "OC reveal") the keep-the-soul gate rejects, so the generated section is chronically thin. The ONE transferable container was #5 "drop-alert-framed-as-a-service" (GlitchedDrops) — structurally Foil's deal-alert lane. **Tune the source query toward value/market-intent posts** (price talk, "what's it worth," deal/drop alerts), not raw engagement-rate across all fan content. This is the gating fix before format-mining graduates any autonomy rung — judge it at the Sunday review. (Also queued: the own-metrics half — learn from John's OWN post performance — unlocks after a few weeks of his posts exist.)
- `graduate-newsletter-x-to-autonomous.md` — drop the newsletter/X-bot `/approve` gates after a clean run (John's zero-input goal).
- `owned-deal-channel-scenario-a.md` — free owned Discord/Telegram deal channel (collectibles playbook). Build once there's audience signal.
- `postiz-multichannel-autosyndication.md` — PARKED until John sets up Postiz account + OAuth (Bluesky/Threads/Mastodon reach). Policy layer shipped (ADR-085).

## Strategy decisions (carry forward)
- **Conversion model = FREEMIUM** (recommended): free list/channel + affiliate for reach; a paid tier (faster/better alerts) as real revenue. Flipper/investor segment has real willingness-to-pay (the "below sold-average" flip signal); collectors pay less readily. **Decide deliberately when there's funnel signal.**
- **The $1K (Mercury): HOLD** until the funnel is proven to convert organically. Paid-validation plan ready: `docs/PAID-ACQUISITION-VALIDATION-2026-06-29.md`.
- **Content principle: "steal the container, keep the soul"** — copy proven formats/hooks; keep Foil's data + calm anti-hype voice. (Now encoded in the format-mining engine.)
- **Hard NOs (don't relitigate):** buying followers; automating engagement ACTIONS on others' posts (permanent firewall).

## Hard truths (don't relearn)
- **Building ahead of audience is THE trap** — two builds tonight (v2 live + format-mining) for ~0 users. Both respected the autonomy ladder (v2 firewall; format-mining dry-run-first), so the build quality is real — but the scoreboard that matters is replies posted → profile visits → signups, and only John posting moves it.
- **SEO is a slow background play, not the near-term lever** (GSC 2026-06-30: 9 clicks / 1.38K impr / 3mo, position 18.2, impressions cratered post-6/14 = the known crawl throttle). Don't rabbit-hole on it now; X distribution is the near-term lever.
- **Verify irreducible/irreversible things LIVE** (the Beehiiv no-op + the Moonbreon wrong-card both passed earlier checks; only live use caught them).
- **Engagement = reach, not signups** — the UTM attribution + Sunday review are the check on whether loud actually converts.

## Standing
- PokeTrace renews ~Jul 15 (reminder Jul 13). `AUTO_PUBLISH_WEEKLY_POSTS` ON. `FORMAT_MINING_ENABLED` ON (dry-run only). `ENGAGEMENT_BRIEF_ENABLED` ON. Cowork CANNOT commit/push — hand John `docs:` one-liners + `/goal` pastes.

## Uncommitted at session end
This brief + the COWORK-CONTEXT learning + the STRATEGY-AUDIENCE-MOAT bio update are in the working tree (Cowork edits). The code stack (`b58eb63`) is committed AND pushed. Hand John one `docs:` commit to persist the doc updates.
