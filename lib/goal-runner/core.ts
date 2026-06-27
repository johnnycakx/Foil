// Autonomous goal-runner — PURE core (ADR-075). No fs / git / network / clock
// side effects: every function here is a deterministic transform so the
// commit/no-commit decision, the never-push guard, queue ordering, and the
// result/Discord shaping are unit-testable without shelling out. The I/O loop
// lives in scripts/goal-runner.ts and imports these.
//
// The keystone safety property is encoded here: the runner COMMITS, NEVER PUSHES.
// `gitArgsAreSafe` is the single chokepoint — the script asserts it before every
// git spawn, so no code path (present or future) can push, force, or rewrite.

export type CommitType = "feat" | "fix" | "docs" | "test" | "refactor";

export type GateResult = {
  /** "tsc" | "test" | "build" | "design:lint" | … */
  name: string;
  pass: boolean;
  /** A short, already-truncated tail of the gate output for the result file. */
  summary: string;
};

export type RunStatus = "COMMITTED" | "BLOCKED" | "DECISION_NEEDED" | "NOOP" | "ERROR";

export type RunOutcome = {
  name: string;
  specFile: string;
  status: RunStatus;
  gates: GateResult[];
  commitSha: string | null;
  commitType: CommitType;
  /** Non-null when the headless Claude Code invocation itself errored. */
  agentError: string | null;
  /** Non-null when the goal hit a fork that needs John (push/deploy/migration). */
  decision: string | null;
  /** ISO timestamps — passed in by the script (core stays clock-free). */
  startedAt: string;
  finishedAt: string;
};

// --- queue ordering -------------------------------------------------------

/**
 * FIFO order for the queue: `<NN>-<name>.md` specs, oldest (lowest NN) first.
 * Filters to `.md`, drops anything starting with `_` (e.g. the `_done` dir or
 * `_results`), sorts lexicographically (zero-padded NN sorts chronologically).
 */
export function orderQueue(filenames: string[]): string[] {
  return filenames
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** `03-wire-foo.md` → `wire-foo`; falls back to the stem if there's no NN- prefix. */
export function goalNameFromFile(file: string): string {
  const stem = file.replace(/\.md$/i, "");
  return stem.replace(/^\d+[-_]/, "") || stem;
}

// --- never-push guard (the single chokepoint) ------------------------------

/** Git subcommands/flags the runner must NEVER run — anything that leaves the
 *  machine or rewrites shared history. The script calls this before every spawn. */
const FORBIDDEN_GIT = new Set(["push", "remote", "fetch", "pull", "clone"]);

/**
 * True only if `args` is a git invocation the runner is allowed to make. Rejects
 * push/pull/fetch/remote and `--force`/history-rewrite flags. This is the
 * load-bearing safety check — `git push` can never reach prod through the runner.
 */
export function gitArgsAreSafe(args: string[]): boolean {
  if (args.length === 0) return false;
  // Defense-in-depth: reject a forbidden subcommand appearing ANYWHERE, not just
  // at args[0], so a `["-c","x=y","push"]`-style vector can't slip past. None of
  // the runner's real commands (add/commit/reset/clean/rev-parse/status) carry
  // these words as args (the commit message goes via `-F <file>`, not inline).
  for (const a of args) {
    const t = a.toLowerCase();
    if (FORBIDDEN_GIT.has(t)) return false; // push/pull/fetch/remote/clone
    if (t === "--force" || t === "--force-with-lease") return false;
  }
  return true; // add / commit / reset --hard / clean -fd / rev-parse / status …
}

// --- commit decision -------------------------------------------------------

/**
 * Commit IFF the agent didn't error, every gate passed, and the tree changed.
 * A pending DECISION does NOT block the commit — committing (never pushing)
 * preserves the work and keeps the tree clean for the next goal; the runner
 * still refuses the irreversible follow-up (push/deploy/migration) and flags it.
 * A FAILED gate, by contrast, discards (no commit).
 */
export function shouldCommit(input: {
  agentError: string | null;
  gates: GateResult[];
  treeChanged: boolean;
}): boolean {
  if (input.agentError) return false;
  if (input.gates.length === 0) return false;
  if (!input.gates.every((g) => g.pass)) return false;
  return input.treeChanged;
}

/**
 * Derive the terminal status. Precedence: an agent error or a needed decision
 * outranks gates; a gate failure blocks; a clean pass with changes commits; a
 * clean pass with NO changes is a no-op.
 */
export function deriveStatus(input: {
  agentError: string | null;
  gates: GateResult[];
  decision: string | null;
  treeChanged: boolean;
  committed: boolean;
}): RunStatus {
  if (input.agentError) return "ERROR";
  // A gate failure means the work was discarded → BLOCKED outranks a decision
  // (the decision is moot once nothing is committed).
  if (input.gates.length > 0 && !input.gates.every((g) => g.pass)) return "BLOCKED";
  if (input.decision) return "DECISION_NEEDED";
  if (input.committed) return "COMMITTED";
  return "NOOP";
}

/** Infer a conventional-commit prefix from the spec name + first lines. */
export function inferCommitType(name: string, body: string): CommitType {
  const hay = `${name}\n${body.slice(0, 600)}`.toLowerCase();
  if (/\b(fix|bug|hotfix|patch)\b/.test(hay)) return "fix";
  if (/\b(docs?|documentation|runbook|adr)\b/.test(hay)) return "docs";
  if (/\b(test|spec|coverage)\b/.test(hay)) return "test";
  if (/\brefactor\b/.test(hay)) return "refactor";
  return "feat";
}

/** A conventional, scoped commit message for the runner's commit. */
export function buildCommitMessage(name: string, type: CommitType): string {
  const subject = `${type}: ${name} (autonomous goal-runner)`;
  return (
    `${subject}\n\n` +
    `Committed by the autonomous goal-runner (ADR-075) after the gate suite\n` +
    `passed. NOT pushed — John reviews before anything reaches prod.\n\n` +
    `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\n`
  );
}

// --- decision / output extraction ------------------------------------------

/**
 * Pull a real `DECISION NEEDED` block out of the agent's final output. The agent
 * is instructed to print a LINE that BEGINS with `DECISION NEEDED:` when it hits
 * a push/deploy/migration/irreversible fork. Anchored to line-start (after
 * markdown bullets/quotes) so a mid-line MENTION of the phrase — e.g. echoing the
 * instruction ("…begins with `DECISION NEEDED:`") or negating it ("no DECISION
 * NEEDED — nothing irreversible was required") — does NOT false-positive (the
 * maiden run hit exactly that). The captured remainder must be real prose, not a
 * quote/backtick fragment.
 */
export function extractDecisionNeeded(agentOutput: string): string | null {
  if (!agentOutput) return null;
  for (const raw of agentOutput.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[>*\-\s]+/, ""); // strip leading bullets/quote markers
    const m = line.match(/^DECISION NEEDED[:\-\s]+(.+)$/i);
    if (!m) continue; // not at line start (a mid-line mention/echo) → ignore
    const rest = m[1].trim();
    // Reject an echo of the literal instruction token (`DECISION NEEDED:` in
    // backticks/quotes) and any too-short / empty remainder.
    if (/^[`'"]/.test(rest) || rest.length < 4) continue;
    return `DECISION NEEDED: ${rest}`.slice(0, 820);
  }
  return null;
}

export function truncate(s: string, max = 1500): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}\n…(${s.length - max} more chars truncated)`;
}

// --- result-file + Discord shaping -----------------------------------------

const STATUS_EMOJI: Record<RunStatus, string> = {
  COMMITTED: "✅",
  BLOCKED: "⛔",
  DECISION_NEEDED: "🛑",
  NOOP: "➖",
  ERROR: "💥",
};

/** Whether the runner should ping John "a decision is needed" for this outcome. */
export function needsAttention(status: RunStatus): boolean {
  return status === "BLOCKED" || status === "DECISION_NEEDED" || status === "ERROR";
}

/** The `_results/<name>.md` document Cowork reads. */
export function shapeResultDoc(o: RunOutcome): string {
  const lines: string[] = [];
  lines.push(`# Goal result: ${o.name}`);
  lines.push("");
  lines.push(`- **Status:** ${STATUS_EMOJI[o.status]} ${o.status}`);
  lines.push(`- **Spec:** \`${o.specFile}\``);
  lines.push(`- **Started:** ${o.startedAt}`);
  lines.push(`- **Finished:** ${o.finishedAt}`);
  lines.push(`- **Commit:** ${o.commitSha ? `\`${o.commitSha}\` (${o.commitType}, NOT pushed)` : "(none)"}`);
  lines.push("");
  lines.push("## Gates");
  if (o.gates.length === 0) {
    lines.push("_(not run — the agent errored before gates)_");
  } else {
    lines.push("| Gate | Result |");
    lines.push("| --- | --- |");
    for (const g of o.gates) lines.push(`| ${g.name} | ${g.pass ? "✅ pass" : "❌ fail"} |`);
  }
  lines.push("");
  if (o.agentError) {
    lines.push("## Agent error");
    lines.push("```");
    lines.push(truncate(o.agentError, 1500));
    lines.push("```");
    lines.push("");
  }
  if (o.decision) {
    lines.push("## ⚠️ DECISION NEEDED");
    lines.push(o.decision);
    lines.push("");
    lines.push("The goal hit a fork the runner must not take (push / deploy / prod migration / irreversible action). It did **not** act. John: review, then act manually.");
    lines.push("");
  }
  const failed = o.gates.filter((g) => !g.pass);
  if (failed.length > 0) {
    lines.push("## Failing gate output");
    for (const g of failed) {
      lines.push(`### ${g.name}`);
      lines.push("```");
      lines.push(truncate(g.summary, 1500));
      lines.push("```");
    }
    lines.push("");
    lines.push("The agent's changes were **discarded** (the tree was reset clean for the next goal). Nothing was committed.");
    lines.push("");
  }
  return lines.join("\n");
}

/** The one-line Discord status (soft-failed by the caller). */
export function shapeDiscordLine(o: RunOutcome): string {
  const head = `${STATUS_EMOJI[o.status]} **goal-runner** \`${o.name}\` → ${o.status}`;
  if (o.status === "COMMITTED") return `${head} (${o.commitType} \`${o.commitSha?.slice(0, 7)}\`, not pushed)`;
  if (o.status === "BLOCKED") {
    const failed = o.gates.filter((g) => !g.pass).map((g) => g.name).join(", ");
    return `${head} — failed: ${failed || "gates"}. Changes discarded. **Needs you.**`;
  }
  if (o.status === "DECISION_NEEDED") return `${head} — ${truncate(o.decision ?? "", 180)} **Needs you.**`;
  if (o.status === "ERROR") return `${head} — ${truncate(o.agentError ?? "agent error", 180)} **Needs you.**`;
  return `${head} (no changes)`;
}
