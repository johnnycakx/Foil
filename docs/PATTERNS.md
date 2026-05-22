# Ideas

Cross-cutting patterns spotted during build that aren't goal-shaped yet but are worth pinning so the next time we hit the same shape, we recognize it. Promote an entry to ADR-N once it's been applied a second time — two instances is the bar for "this is a pattern, not a one-off."

Append new entries at the top. When an entry is promoted, leave it here with a `Promoted: ADR-N` line so the history is preserved.

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
