> 🗄️ **ARCHIVED / SUPERSEDED (2026-07-06)** — historical record, kept per the never-delete rule. Not current state. See [HOME.md](HOME.md) · index: [archive/README.md](archive/README.md).

# Cowork session handoff — 2026-06-02

Read this FIRST before doing anything else. This is the replacement-context doc for the new cowork session taking over from yesterday's run.

## Who you're working with

John Craig — solo founder of Foil (foiltcg.com), Pokemon TCG deal-finder. Non-technical. Works in email/calendar/Notion/Drive/content. Drives engineering through Claude Code (separate Anthropic CLI he runs in his terminal). You are his strategy + prep partner; Claude Code is the hands.

How John wants you to communicate:
- Plain English, no jargon, warm but direct
- Challenge him. Flag rabbit holes
- Concise. Cut unnecessary explanation
- Never delete/send/publish/spend without confirmation
- Confirm long-running tasks before starting. Show progress

John is an active TCGPlayer seller (Level 4 in progress) — he has real-world Pokemon market intuition. Trust it.

## North star

Build Foil into the best Pokemon TCG deal-finder. Tomorrow's user-facing goal: ship the buy signal MVP. Long-arc: revenue-generating product John can operate without writing code himself.

## What shipped yesterday (2026-06-01)

Seven production goals through Claude Code:

1. **Goal V** — Brand voice integration (ADR-048). Matt Levine × Morning Brew × active-seller POV. `docs/BRAND-VOICE.md`. Ban list, hard rules (exact numbers, no em dashes).
2. **Goal V.1** — Post migration. 4 corrected posts moved to `app/(site)/blog/posts/` (live route).
3. **Goal V.2** — Content-pipeline reconciliation (ADR-049, R-015 resolved). `lib/blog/posts-dir.ts` shared constant. Writer/reader pinned by `posts-dir-consistency.test.ts`. Orphan `app/blog/posts/` deleted. Content-marker live verification promoted to standing closure-gate.
4. **Goal C.1** — Creator-content ingestion pilot (ADR-050). yt-dlp wrapper for 5 whitelisted YouTube channels. Daily 06:00 UTC cron writes `docs/transcript-digests/{date}.md`. Gate 11 (attribution: unattributed claims + verbatim copy >25 words).
5. **Gate 12 blog** — Em-dash HARD gate added to `lib/seo/quality-gates.ts` (ADR-051). Vague-number SOFT.
6. **Gate 12 newsletter** — Parity for newsletter pipeline.
7. **R-018 confirmed + clobber-fix** — CI datacenter IP gets bot-blocked by YouTube. Empty digest was overwriting real one; `transcript-digest.ts` now skips write if 0 transcripts. Real digest restored from local 74 transcripts.

Last commit: `6dbfd85` (clobber-guard).

## What was being typed when context ran out

John was about to paste the **YT_DLP_COOKIES R-018 mitigation** goal (Path A). Tightened ~1.4K char version had 7 specific requirements: GH secret stores file contents, tempfile in `os.tmpdir`, cleanup on exit, anchored test, soft-fail on invalid cookies, ENV-VARS rotation note (2-4 weeks), document rotation cadence.

If he hasn't run it yet, that's the immediate next goal.

## Open the day with this check

1. Check yesterday's 06:00 UTC GH Actions run (if cookies got wired before sleep): did it fetch real transcripts or fire R-018 again?
2. Check yesterday's 14:03 UTC autonomous content cron — first run against full V+C.1+Gate 12 stack. Did Gate 12 hold (zero em dashes)? Did creator citations appear?
3. **Do not start new product work until John gives the go-ahead.** Open with: "Good morning. Here's the overnight status: [X]. Queue when you're ready: [Y]." Wait.

## Queued goals in priority order

**B — Buy signal MVP** (ROADMAP #32). Paste-ready 2,896-char goal exists from yesterday's prep. Builds `lib/buy-signal/compute.ts` with BELOW/AT/ABOVE median tiers, `buy-signal-badge.tsx`, `/pricing-methodology` public route, copy-gate anti-hype guard. This is the next user-facing feature — the one that turns Foil from "price viewer" into "decision tool."

**B.2 — Halo-watch input.** Extract Pokemon names from set-pulse digest, cross-ref catalog, feed into buy signal. Uses C.1 data already shipped.

**B.3 — Buyout-detection signal.** `saleCount_7d > 3x weekly avg` → contrarian WAIT.

**M — Market-pulse library refactor.** JSON sidecar + `lib/market-pulse/digest.ts`. Consumers: buy signal, per-card sidebar, alert emails, watchlist nudges, newsletter, homepage, Discord bot, Claude Code grounding. This is the shared spine.

**Manual John tasks (still pending):**
- Ahrefs MCP authentication + first probe (task #15)
- GSC sitemap verification (1 of 209 indexed currently)
- eBay Application Growth Check Phase 6 portal submission
- Twitter pinned-post launch when ready
- $20K capital plan execution (LLC via Stripe Atlas, creator sponsorships)

## Standing concerns

- **R-018** cookie rotation cadence (every 2-4 weeks). Set a recurring reminder.
- Tomorrow's 06:00 UTC ingest cron — first read after cookies wired
- Tomorrow's 14:03 UTC autonomous content cron — first read after Gate 12

## Where things live

Project root: `C:\Users\John\dev\foil`

Read these in this order for full context:
- `CLAUDE.md` — Hard rules + standing gates (P0 premise check, content-marker live verification, writer/reader POSTS_DIR consistency, before/after regeneration measurement)
- `docs/SESSION-LOG.md` — Yesterday's full entries (V, V.1, V.2, C.1, Gate 12)
- `docs/ROADMAP.md` — #32 (buy signal, promoted), #33 done, #34 done, #35 (R-018) pending
- `docs/RISKS.md` — R-015 resolved, R-017 captured, R-018 confirmed empirically
- `docs/DECISIONS.md` — ADRs 048-051
- `docs/BRAND-VOICE.md` — Voice rules + ban list
- `docs/creator-whitelist.md` — 5 channels (PokeRev, Pirate King Investments, PokeChuck, PikaPikaPaPa, PokeBeard). John owns curation.
- `docs/IDEAS.md` — 5 entries added yesterday (buy signal, creator-content, Foil as cited reference, Google Trends, market-pulse lib, halo-watch)
- `docs/transcript-digests/2026-06-01.md` — Latest real digest (74 transcripts; 30th anniversary HIGH, Mega Evolution HIGH, White Flare leak)

## Hard-won lessons from yesterday — don't re-learn

1. **Writer/reader directory drift is a class of bug, not a one-off.** Both Session 47.4 fact-check AND V.1 voice cleanup edited the orphan `app/blog/posts/`. Production served fabrications for 24+ hours. PATTERN I-008 captured: write/read mismatch in autonomous pipelines.
2. **A 200 OK with wrong content is worse than 500.** Always content-marker verify after deploy.
3. **Before chasing infrastructure, verify the source compiled into the build.** 30+ minutes burned diagnosing "Vercel cache" when the bug was source-file location.
4. **Empty data can clobber real data.** Always guard writes when input is zero-length (the digest clobber).
5. **My (the AI's) recommendations need John's curation.** Smpratte hadn't posted in 2 years. He caught it. He owns the creator whitelist — full stop.
6. **Goal files saved via Write tool get NUL-padded.** Paste goal text inline in chat, not via file. Goals are 4K char hard limit for Claude Code.
7. **No semicolons in slash commands.** `/goal` not `/goal:`.
8. **P0 premise check** opens every Claude Code goal. Standing rule.

## What NOT to do

- Don't start B (buy signal) without John's explicit go-ahead
- Don't push to main without him there
- Don't recommend a creator John hasn't whitelisted
- Don't propose more than 2-3 things at once — he's solo, ship-focused
- Don't summarize what you just did at the end of every response — he can read it

## Opening message template for tomorrow

> Good morning. Quick overnight check:
>
> [06:00 UTC ingest result] — [X transcripts fetched / bot-blocked / cookies worked]
> [14:03 UTC autonomous post result] — [Gate 12 held / em-dashes zero / creator cites appeared]
>
> Queue when you're ready:
> 1. B — Buy signal MVP (paste-ready)
> 2. M — Market-pulse library refactor
> 3. R-018 cookie rotation cadence reminder
>
> What's the move?

Then wait. He'll drive.
