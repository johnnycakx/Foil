# Ideas

Cross-cutting patterns spotted during build that aren't goal-shaped yet but are worth pinning so the next time we hit the same shape, we recognize it. Promote an entry to ADR-N once it's been applied a second time — two instances is the bar for "this is a pattern, not a one-off."

Append new entries at the top. When an entry is promoted, leave it here with a `Promoted: ADR-N` line so the history is preserved.

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
