# Runbook — autonomous goal-runner

**Status:** Built 2026-06-27 ([ADR-075](../DECISIONS.md#adr-075--autonomous-goal-runner-headless-claude-code-queue-fed-commit-never-push)), extends the ADR-009 local-CLI-autonomy line. The keystone that lets Cowork feed work to Claude Code while John is away: John starts ONE process before he leaves, it drains a queue of pre-scoped goal specs, runs each headlessly, enforces the gates, **commits but never pushes**, writes a result, and pings Discord.

## The one operating rule

**The runner OWNS the working tree while it runs.** Do NOT run an interactive Claude Code goal in the same repo at the same time — two committers race on `git add -A` and corrupt each other's commits. The runner processes one goal at a time (no parallel agents). Start it on a **clean tree** (it refuses to start on a dirty one, so it can never clobber unrelated WIP).

## Start / stop

```bash
# Poll forever (the away-from-keyboard mode):
npm run goals:watch

# Drain the current queue then exit:
npm run goals:watch -- --once

# Stop after the first blocked/decision goal (so you can look before more run):
npm run goals:watch -- --halt-on-block
```

**Kill switch:** Ctrl-C, or close the terminal. There is no daemon; killing the process stops it.

## Queue / results convention (all gitignored, under `docs/goals/`)

- `docs/goals/_queue/<NN>-<name>.md` — drop goal specs here. Processed oldest-first (FIFO by the `NN-` prefix). Cowork writes these from its sandbox.
- `docs/goals/_queue/_done/` — processed specs are moved here.
- `docs/goals/_results/<name>.md` — one result per goal: status, the per-gate pass/fail table, the commit SHA (if committed, **never pushed**), and a **DECISION NEEDED** block when the goal hit a fork that needs John. Cowork polls these.

A spec is just a normal goal prompt (the same thing you'd paste into Claude Code). Write it to follow the repo's goal contract (P0 premise check, gates, SESSION-LOG, conventional commit).

## What each goal run does

1. **Run the goal headlessly:** `claude -p` with the spec piped on stdin, plus a preamble that forbids push/deploy/prod-migration and tells the agent to print `DECISION NEEDED:` if the goal genuinely requires one. Default permission mode = `--dangerously-skip-permissions` (the only mode that runs a gate-running goal end-to-end without prompting; containment is commit-not-push + the gates, not the prompt gate).
2. **Independently run the closure gates** (the runner, not the agent): `tsc → test → build → design:lint` (configurable). `/security-review` is a Claude Code skill, not a CLI, so the **agent** runs it as part of the goal contract; the runner can't, and the runbook treats it as the agent's responsibility (flag in the result if you want a manual pass).
3. **Decide:**
   - **All gates green** → `git add -A` + a conventional commit. **Never `git push`.**
   - **Any gate fails / the agent errored** → discard the agent's work (`git reset --hard` + `git clean -fd`, restoring the clean tree) and mark the result **BLOCKED** with the failing gate's output.
   - **A fork needs John** (the agent printed `DECISION NEEDED:`) → if the work otherwise passed gates it's still **committed** (never pushed, so nothing reaches prod) and the result is flagged **DECISION_NEEDED** for John to do the manual step.
4. **Archive + report:** move the spec to `_done/`, write `_results/<name>.md`, ping Discord (soft-fail — a Discord outage can't stop the runner).

## Safety model (why this is safe to leave running)

Unattended Claude Code with auto-accept is powerful. The containment is **not** the permission prompt (which is bypassed so goals run unattended) — it is:

- **Commits, never pushes.** `lib/goal-runner/core.ts::gitArgsAreSafe` is the single chokepoint; the runner asserts it before every `git` spawn and refuses `push`/`pull`/`fetch`/`remote`/`clone`/`--force`. **Nothing reaches prod unattended** — John reviews the local commits, then pushes.
- **Every commit passed the full gate suite.** A gate failure discards the work; it never commits broken code.
- **Goals are pre-scoped specs, not freeform.** And the agent is told to STOP + `DECISION NEEDED` on any push / deploy / `supabase db push` to remote / Stripe-live / irreversible action. Those stay manual.
- **Sole committer.** The runner refuses a dirty tree at startup and processes one goal at a time, so it can't race another committer or clobber WIP.
- **Kill switch** = Ctrl-C.

Pushes, deploys, prod DB migrations, and any irreversible/financial action stay **manual**. If a goal needs one, the runner writes DECISION NEEDED and pings — it does not act.

## Config (env vars / flags)

| Var / flag | Default | Purpose |
| --- | --- | --- |
| `--once` | off | Drain the queue, then exit (vs. poll forever). |
| `--halt-on-block` | off | Stop the loop on the first BLOCKED / DECISION_NEEDED / ERROR. |
| `GOAL_RUNNER_MAX` | `0` (unlimited) | Stop after N goals. |
| `GOAL_RUNNER_POLL_MS` | `10000` | Queue poll interval when idle. |
| `GOAL_RUNNER_GATES` | `tsc,test,build,design:lint` | Which closure gates to run. |
| `GOAL_RUNNER_PERMISSION_MODE` | `skip` | `skip` = `--dangerously-skip-permissions`; `acceptedits` = `--permission-mode acceptEdits` (will prompt on Bash → not fully unattended). |
| `GOAL_RUNNER_MODEL` | (inherit) | `--model` override for the headless agent. |
| `GOAL_RUNNER_CLAUDE_BIN` | `claude` | Path to the Claude Code CLI if not on PATH. |
| `GOAL_RUNNER_AGENT_TIMEOUT_MS` | `2400000` (40m) | Per-goal agent timeout. |
| `GOAL_RUNNER_GATE_TIMEOUT_MS` | `900000` (15m) | Per-gate timeout (build is the slow one). |
| `GOAL_RUNNER_WEBHOOK_URL` | `DISCORD_WEBHOOK_CONTENT_ENGINE` | Discord webhook for status pings. |
| `GOAL_RUNNER_ALLOW_DIRTY` | unset | `1` overrides the clean-tree refusal (NOT recommended). |

## First run (do this supervised, once)

The runner is powerful; trust it incrementally. For the first run: commit/stash your WIP (clean tree), drop ONE small spec in `_queue/`, run `npm run goals:watch -- --once --halt-on-block`, watch it run the goal + gates, inspect the local commit (`git show`), confirm nothing was pushed (`git status` shows "ahead of origin"), then push yourself if happy.
