# Ideas

Cross-cutting patterns spotted during build that aren't goal-shaped yet but are worth pinning so the next time we hit the same shape, we recognize it. Promote an entry to ADR-N once it's been applied a second time — two instances is the bar for "this is a pattern, not a one-off."

Append new entries at the top. When an entry is promoted, leave it here with a `Promoted: ADR-N` line so the history is preserved.

---

## I-003 — Silent autonomy-chain regressions: integrations can disconnect because nothing happens

**Spotted:** Session 19, while diagnosing the Railway auto-deploy gap that Session 18 first surfaced.

**Shape.** Vendor integrations (GitHub→Railway, GitHub→Vercel, Beehiiv subscribe → Foil DB, etc.) share an auth-chain pattern: a long-lived OAuth grant or App install on one side, a token/webhook target on the other, and a push-vs-pull boundary in between. When that grant lapses, gets revoked, never gets installed in the first place, or has its branch filter changed, the failure mode is *not* a noisy error — it's *nothing happens*. A push to main returns 0 exit code; the deploy never fires; the next session assumes the running service matches main. The drift can run for days before anyone notices, and the moment of noticing is usually a side-quest while doing something else ("wait, why is the bot still on the old behavior?").

**Two instances in the repo so far.**

1. **Session 13's Vercel `#deploys` proxy** caught five silently-failing Vercel deploys that had been broken since the tsconfig drift. Before the proxy + webhook fired, those failures lived in the "no notification = it must be fine" category.
2. **Session 18 → 19's Railway auto-deploy gap.** Six historical foil-bot deploys, every one user-triggered, zero github-triggered. Auto-deploy was on the implicit "we'll wire this up later" list — and only got noticed because Session 18 happened to check the deploy timestamp against the push timestamp.

**Suggested mitigation (capture only — don't build in this goal).** A daily cron job that compares `git rev-parse origin/main` against the deployed commit SHA on each integration target (Vercel's API for the web app, Railway's `lib/railway-api.ts::getServiceStatus` for foil-bot, etc.). If they diverge by more than one deploy cycle (~10 min), post a drift alert to `#errors`. That's the inverse of the "nothing happens" failure mode — it turns silence into a daily attestation.

**The shape worth flagging.** Anywhere we have **vendor X auto-acts on event Y from source Z** and the success path is "no notification," there's a latent drift class. Catalogue candidates: GitHub→Railway (Session 19), GitHub→Vercel (Session 13 precedent), Beehiiv ingest→Discord, Stripe webhook→Supabase, the autonomous-content cron→Beehiiv newsletter. Each gets the same drift-cron treatment when worth building.

**Promotion trigger.** Third silent-regression incident OR the day John decides to build the drift cron — at that point the mitigation pattern is concrete enough to ADR.

**Status:** Pattern noted; mitigation captured but deferred.

---

## I-002 — Cowork as tactical edit surface; Claude Code as autonomous/shipping surface

**Spotted:** Session 18, while iterating on the bot's system prompt + output cap.

**Shape.** Small, scoped edits with deterministic local verification (file change + `tsc --noEmit` + `npm test`) are faster done directly in a Cowork session than authored as a Claude Code goal — Cowork has no Stop-hook overhead, no goal-criterion framing tax, and the feedback loop is the same `npm test` you'd run by hand. Claude Code earns its keep when the work needs **git/deploy authority** (commit + push + Railway/Vercel deploy verification), **second-brain doc discipline** (SESSION-LOG entry, ADR, ENV-VARS, IDEAS capture — the hard-contract rules in CLAUDE.md), or **a multi-hour autonomous loop** (multi-file refactor, full pipeline build, anything that benefits from the Agent tool spawning subagents). Below that bar, Cowork is the lighter path.

**The compose.** Cowork validates and hands off the commit step to Claude Code via a goal exactly like this one — diff already in the working tree, criteria reduced to "stage these N paths, run the contract steps, push, verify deploy." That's the seam: edit-and-test in Cowork, ship + log in Claude Code.

**First instance.** Session 18 (this commit). System-prompt rewrite + token-cap bump + chunker threshold — five files, <60 lines net, validated in Cowork with 69/69 green and a clean typecheck; goal-authored only to take the diff through commit + push + SESSION-LOG + PATTERNS update + Railway deploy verification.

**Promotion trigger.** Third or fourth instance of this exact handoff shape (Cowork edits → Claude Code goal that just commits + logs). At that point the workflow is real enough to warrant an ADR codifying when to start in Cowork vs. when to start in Claude Code.

**Status:** Pattern noted; will promote to a dedicated ADR after the third instance lands.

---

## I-001 — Stop fighting interactive-first CLIs

**Spotted:** Session 15, while trying to verify a Railway redeploy.

**Shape.** Vendor CLIs sit on a spectrum:

- **TTY-optional CLIs** (`gh`, `vercel`, `supabase`, `aws`) take a credential, a flag set, and produce output a script can parse. Token auth + non-interactive flags = headless-clean.
- **TTY-required CLIs** (`railway`, parts of `gcloud`, some Heroku flows) assume a human is at the prompt. They prompt for workspace/project/environment picks, write `.<vendor>` link files into the CWD, and produce streamed text that an agent has to scrape.

A headless agent fighting a TTY-required CLI burns Stop-hook loops on prompts it can't answer. `--non-interactive` flags partially close the gap but the link-state handshake reappears every time.

**The pattern.** For TTY-required CLIs, **bypass the CLI** by wrapping the vendor's REST/GraphQL endpoint in a thin `lib/<vendor>-api.ts` module. Token in, JSON out, no link files, no environment picks. Keep the CLI installed for surfaces where it *is* clean (write-only ops that don't need link state).

**First instance.** [`lib/railway-api.ts`](../lib/railway-api.ts) wraps `backboard.railway.com/graphql/v2`. Replaces `railway status` / `railway logs --service ...` for goal verification. See [ADR-009 Session 15 amendment](DECISIONS.md#adr-009--local-cli-tooling-for-autonomous-infra-changes) for the routing rule.

**Promotion trigger.** Second vendor that fits the same shape. Likely candidates: Linear (search/filter UIs in the CLI), Stripe (`stripe listen` is fine; `stripe customers list` paginates interactively).

**Status:** Pattern noted; will promote to a dedicated ADR after the second instance lands.
