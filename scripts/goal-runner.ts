// Autonomous goal-runner (ADR-075) — the I/O loop. Watches a queue folder,
// runs each goal spec headlessly through Claude Code, independently enforces the
// closure gates, COMMITS but NEVER PUSHES, writes a result file, and pings
// Discord. Cowork drops specs into the queue from its sandbox and polls results;
// John starts ONE process before he leaves and the work continues.
//
// Run:  npm run goals:watch            (poll forever)
//       npm run goals:watch -- --once  (drain the queue, then exit)
//
// SAFETY MODEL (see docs/runbooks/goal-runner.md + ADR-075):
//  - Commits, never pushes. `runGit` asserts `gitArgsAreSafe` before every spawn;
//    push/pull/fetch/remote/force are refused. Nothing reaches prod unattended.
//  - Every commit passed the full gate suite. A gate failure → discard, no commit.
//  - Goals are pre-scoped specs, not freeform. The agent is told to STOP +
//    "DECISION NEEDED" on any push/deploy/prod-migration/irreversible fork.
//  - Sole committer: the runner OWNS the working tree (one goal at a time). It
//    refuses to start on a dirty tree so it can never clobber unrelated WIP.
//  - Kill switch: Ctrl-C / close the terminal.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  orderQueue,
  goalNameFromFile,
  gitArgsAreSafe,
  shouldCommit,
  deriveStatus,
  inferCommitType,
  buildCommitMessage,
  extractDecisionNeeded,
  shapeResultDoc,
  shapeDiscordLine,
  needsAttention,
  truncate,
  type GateResult,
  type RunOutcome,
} from "../lib/goal-runner/core.ts";
import { notifyChannel } from "../lib/notifications/discord.ts";

const REPO = process.cwd();
const QUEUE = path.join(REPO, "docs", "goals", "_queue");
const DONE = path.join(QUEUE, "_done");
const RESULTS = path.join(REPO, "docs", "goals", "_results");
const WIN = process.platform === "win32";

// Parse .env.local into a LOCAL map for the runner's OWN config only (Discord
// webhook + GOAL_RUNNER_*). CRITICAL: we do NOT mutate process.env — if we did,
// the spawned gate subprocesses (npm test/build) would inherit .env.local and
// run in a DIFFERENT environment than a clean `npm test` shell, changing which
// env-coupled tests run and falsely BLOCKing healthy goals (the maiden run hit
// exactly this: BEEHIIV_PUBLICATION_ID leaked → a hermetic test failed). Gates,
// the agent, and git all inherit the canonical process.env, nothing more.
function loadDotEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const FILE_ENV = loadDotEnv(path.join(REPO, ".env.local"));
/** Runner config: a live env var wins, else the .env.local value (never injected
 *  into process.env, so it can't reach gate/agent subprocesses). */
function cfg(name: string): string | undefined {
  return process.env[name] ?? FILE_ENV[name];
}

const FLAGS = new Set(process.argv.slice(2));
const ONCE = FLAGS.has("--once");
const HALT_ON_BLOCK = FLAGS.has("--halt-on-block");

const MAX = Number(cfg("GOAL_RUNNER_MAX") ?? "0") || 0; // 0 = unlimited
const POLL_MS = Number(cfg("GOAL_RUNNER_POLL_MS") ?? "10000") || 10000;
const GATE_TIMEOUT_MS = Number(cfg("GOAL_RUNNER_GATE_TIMEOUT_MS") ?? "900000") || 900000;
const AGENT_TIMEOUT_MS = Number(cfg("GOAL_RUNNER_AGENT_TIMEOUT_MS") ?? "2400000") || 2400000;
const CLAUDE_BIN = cfg("GOAL_RUNNER_CLAUDE_BIN") ?? "claude";
const CLAUDE_MODEL = cfg("GOAL_RUNNER_MODEL") ?? "";
const PERMISSION = (cfg("GOAL_RUNNER_PERMISSION_MODE") ?? "skip").toLowerCase();
const GATES = (cfg("GOAL_RUNNER_GATES") ?? "tsc,test,build,design:lint").split(",").map((g) => g.trim()).filter(Boolean);
const webhook = cfg("GOAL_RUNNER_WEBHOOK_URL") ?? cfg("DISCORD_WEBHOOK_CONTENT_ENGINE") ?? "";

// The preamble prepended to every goal spec — the autonomy contract for the
// headless agent. Kept in the prompt (not --append-system-prompt) so the runner
// passes only simple single-token flags to the CLI (robust cross-shell).
const GUARD_PREAMBLE = [
  "You are running HEADLESS under the autonomous goal-runner. Execute the goal below end-to-end.",
  "",
  "HARD RULES:",
  "- The goal-runner handles the git commit AFTER you finish. You do NOT need to commit, but if you do, do NOT amend or force.",
  "- NEVER run an irreversible or outward-facing action: no `git push`, no `vercel deploy`, no `supabase db push`/remote migration apply, no Stripe/live API writes, no destructive prod action.",
  "- If the goal genuinely REQUIRES one of those to be 'done', STOP before it and print a single line that begins exactly with `DECISION NEEDED:` followed by what is needed and why. Do the safe parts; leave the irreversible step for John.",
  "- Run the repo's own closure gates as the goal contract requires (tsc, tests, build, design:lint, /security-review). The runner will ALSO run them independently; if they fail, your work is discarded.",
  "",
  "GOAL SPEC FOLLOWS:",
  "----------------------------------------",
].join("\n");

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[goal-runner ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run git, REFUSING anything `gitArgsAreSafe` rejects (the never-push chokepoint). */
function runGit(args: string[]): { code: number; out: string } {
  if (!gitArgsAreSafe(args)) {
    throw new Error(`goal-runner refused an unsafe git command: git ${args.join(" ")}`);
  }
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8", shell: WIN, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function gitHead(): string {
  return runGit(["rev-parse", "HEAD"]).out.trim();
}

function treeIsDirty(): boolean {
  return runGit(["status", "--porcelain"]).out.trim().length > 0;
}

/** Discard everything the agent did, restoring `head` + a clean tree. Ignored
 *  files (docs/goals/** queue+results, node_modules, .env) are preserved. */
function discardTo(head: string): void {
  runGit(["reset", "--hard", head]);
  runGit(["clean", "-fd"]);
}

/** Run a single closure gate; return pass + a truncated output tail. */
function runGate(name: string): GateResult {
  const cmd: Record<string, [string, string[]]> = {
    tsc: ["npx", ["tsc", "--noEmit"]],
    test: ["npm", ["test"]],
    build: ["npm", ["run", "build"]],
    "design:lint": ["npm", ["run", "design:lint"]],
  };
  const spec = cmd[name];
  if (!spec) return { name, pass: false, summary: `unknown gate "${name}"` };
  const r = spawnSync(spec[0], spec[1], { cwd: REPO, encoding: "utf8", shell: WIN, timeout: GATE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error) return { name, pass: false, summary: truncate(`spawn error: ${r.error.message}\n${out}`, 1200) };
  const pass = r.status === 0;
  return { name, pass, summary: pass ? "ok" : truncate(out.split(/\r?\n/).slice(-40).join("\n"), 1200) };
}

/** Invoke Claude Code headlessly with the spec piped on stdin. */
function runAgent(specText: string): { error: string | null; output: string } {
  // Default "skip" (--dangerously-skip-permissions) is the only mode that runs a
  // gate-running goal end-to-end without prompting (acceptEdits still prompts on
  // Bash). Containment is commit-not-push + the gate suite, not the prompt gate.
  const permArgs = PERMISSION === "acceptedits"
    ? ["--permission-mode", "acceptEdits"]
    : ["--dangerously-skip-permissions"];
  const args = ["-p", ...permArgs];
  if (CLAUDE_MODEL) args.push("--model", CLAUDE_MODEL);
  const prompt = `${GUARD_PREAMBLE}\n${specText}`;
  const r = spawnSync(CLAUDE_BIN, args, {
    cwd: REPO,
    input: prompt,
    encoding: "utf8",
    shell: WIN,
    timeout: AGENT_TIMEOUT_MS,
    maxBuffer: 128 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error) return { error: `claude spawn failed: ${r.error.message}`, output };
  if (r.status !== 0) return { error: `claude exited ${r.status}`, output };
  return { error: null, output };
}

function ensureDirs(): void {
  for (const d of [QUEUE, DONE, RESULTS]) fs.mkdirSync(d, { recursive: true });
}

function nextSpec(): string | null {
  const files = fs.existsSync(QUEUE) ? fs.readdirSync(QUEUE) : [];
  const ordered = orderQueue(files);
  return ordered.length > 0 ? ordered[0] : null;
}

async function ping(line: string): Promise<void> {
  if (!webhook) return;
  try {
    await notifyChannel(webhook, line);
  } catch {
    /* a Discord outage cannot stop the runner */
  }
}

async function processGoal(specFile: string): Promise<RunOutcome> {
  const name = goalNameFromFile(specFile);
  const startedAt = new Date().toISOString();
  const specPath = path.join(QUEUE, specFile);
  const specText = fs.readFileSync(specPath, "utf8");
  const preHead = gitHead();
  log(`▶ ${name} (${specFile}) — running agent`);

  const agent = runAgent(specText);
  const decision = agent.error ? null : extractDecisionNeeded(agent.output);

  // Gates only run if the agent didn't hard-error (no point building broken work).
  let gates: GateResult[] = [];
  if (!agent.error) {
    for (const g of GATES) {
      log(`  gate: ${g}`);
      gates.push(runGate(g));
    }
  }

  const treeChanged = treeIsDirty() || gitHead() !== preHead;
  const commit = shouldCommit({ agentError: agent.error, gates, treeChanged });

  let commitSha: string | null = null;
  const commitType = inferCommitType(name, specText);
  if (commit) {
    if (treeIsDirty()) {
      runGit(["add", "-A"]);
      const msgFile = path.join(os.tmpdir(), `goal-runner-msg-${preHead.slice(0, 7)}.txt`);
      fs.writeFileSync(msgFile, buildCommitMessage(name, commitType));
      const c = runGit(["commit", "-F", msgFile]);
      try { fs.unlinkSync(msgFile); } catch { /* */ }
      if (c.code !== 0) {
        // commit itself failed → treat as blocked, restore clean.
        discardTo(preHead);
        gates.push({ name: "commit", pass: false, summary: truncate(c.out, 800) });
      } else {
        commitSha = gitHead();
      }
    } else if (gitHead() !== preHead) {
      commitSha = gitHead(); // the agent committed; gates validated it.
    }
  } else {
    // Blocked / errored → discard the agent's work, restore the clean tree.
    discardTo(preHead);
  }

  const finishedAt = new Date().toISOString();
  const status = deriveStatus({ agentError: agent.error, gates, decision, treeChanged, committed: !!commitSha });
  return { name, specFile, status, gates, commitSha, commitType, agentError: agent.error ? truncate(agent.output || agent.error, 2000) : null, decision, startedAt, finishedAt };
}

function archiveAndReport(o: RunOutcome): void {
  // Move the spec to _done (processed), write the result file.
  try {
    fs.renameSync(path.join(QUEUE, o.specFile), path.join(DONE, o.specFile));
  } catch (err) {
    log(`! could not move ${o.specFile} to _done: ${(err as Error).message}`);
  }
  fs.writeFileSync(path.join(RESULTS, `${o.name}.md`), shapeResultDoc(o));
}

async function main(): Promise<void> {
  log(`autonomous goal-runner starting — queue=${QUEUE} gates=[${GATES.join(",")}] permission=${PERMISSION} ${ONCE ? "(--once)" : ""}`);
  if (!webhook) log("! no Discord webhook (GOAL_RUNNER_WEBHOOK_URL / DISCORD_WEBHOOK_CONTENT_ENGINE) — status pings disabled");
  ensureDirs();

  // Sole-committer invariant: refuse to start on a dirty tree so the runner can
  // never clobber unrelated WIP (its discard path resets hard + cleans).
  if (treeIsDirty() && process.env.GOAL_RUNNER_ALLOW_DIRTY !== "1") {
    log("✗ working tree is DIRTY. The runner owns the tree and resets it on failure.");
    log("  Commit/stash your WIP first, or set GOAL_RUNNER_ALLOW_DIRTY=1 to override (NOT recommended).");
    process.exitCode = 1;
    return;
  }

  let processed = 0;
  for (;;) {
    const spec = nextSpec();
    if (!spec) {
      if (ONCE) { log("queue drained (--once) — exiting"); return; }
      await sleep(POLL_MS);
      continue;
    }

    let outcome: RunOutcome;
    try {
      outcome = await processGoal(spec);
    } catch (err) {
      // A runner-level fault (e.g. git refused) — never leave the spec to loop.
      log(`✗ runner fault on ${spec}: ${(err as Error).message}`);
      const name = goalNameFromFile(spec);
      const now = new Date().toISOString();
      outcome = { name, specFile: spec, status: "ERROR", gates: [], commitSha: null, commitType: "feat", agentError: truncate((err as Error).message, 800), decision: null, startedAt: now, finishedAt: now };
    }

    archiveAndReport(outcome);
    await ping(shapeDiscordLine(outcome));
    log(`■ ${outcome.name} → ${outcome.status}${outcome.commitSha ? ` (${outcome.commitSha.slice(0, 7)}, not pushed)` : ""}`);

    processed++;
    if (MAX > 0 && processed >= MAX) { log(`reached GOAL_RUNNER_MAX=${MAX} — exiting`); return; }
    if (HALT_ON_BLOCK && needsAttention(outcome.status)) { log("halting on a blocked/decision outcome (--halt-on-block)"); return; }
  }
}

main().catch((err) => {
  log(`fatal: ${(err as Error).message}`);
  process.exitCode = 1;
});
