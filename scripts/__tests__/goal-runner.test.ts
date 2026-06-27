// Autonomous goal-runner — pure-core tests (ADR-075). The I/O loop in
// scripts/goal-runner.ts shells out to Claude Code + git; these tests pin the
// DECISION logic without any of that: queue ordering, the commit/no-commit +
// status derivation, the load-bearing NEVER-PUSH guard, commit-type inference,
// result-file + Discord shaping, and the DECISION-NEEDED extraction.

import test from "node:test";
import assert from "node:assert/strict";
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
} from "../../lib/goal-runner/core.ts";

const PASS: GateResult[] = [{ name: "tsc", pass: true, summary: "ok" }, { name: "test", pass: true, summary: "ok" }];
const FAIL: GateResult[] = [{ name: "tsc", pass: true, summary: "ok" }, { name: "test", pass: false, summary: "3 failing" }];

// --- queue ordering (FIFO by filename) ---

test("orderQueue: FIFO by NN- prefix, .md only, ignores _ entries", () => {
  const files = ["02-second.md", "10-tenth.md", "01-first.md", "_done", "_results", "notes.txt", "03-third.md"];
  assert.deepEqual(orderQueue(files), ["01-first.md", "02-second.md", "03-third.md", "10-tenth.md"]);
});

test("orderQueue: empty + non-md inputs yield an empty queue", () => {
  assert.deepEqual(orderQueue([]), []);
  assert.deepEqual(orderQueue(["readme.txt", "_done", ".gitkeep"]), []);
});

test("goalNameFromFile strips the NN- prefix and .md", () => {
  assert.equal(goalNameFromFile("03-wire-foo.md"), "wire-foo");
  assert.equal(goalNameFromFile("12_do_thing.md"), "do_thing");
  assert.equal(goalNameFromFile("plain.md"), "plain");
});

// --- THE never-push guard (the keystone safety property) ---

test("gitArgsAreSafe: REFUSES push and every outbound/rewrite command", () => {
  assert.equal(gitArgsAreSafe(["push", "origin", "main"]), false);
  assert.equal(gitArgsAreSafe(["push", "--force-with-lease"]), false);
  assert.equal(gitArgsAreSafe(["push"]), false);
  assert.equal(gitArgsAreSafe(["pull"]), false);
  assert.equal(gitArgsAreSafe(["fetch", "origin"]), false);
  assert.equal(gitArgsAreSafe(["remote", "add", "x", "y"]), false);
  assert.equal(gitArgsAreSafe(["clone", "url"]), false);
  assert.equal(gitArgsAreSafe(["commit", "--amend", "--force"]), false, "--force is refused anywhere");
  assert.equal(gitArgsAreSafe(["-c", "x=y", "push"]), false, "a forbidden subcommand is refused even when not at args[0]");
  assert.equal(gitArgsAreSafe([]), false);
});

test("gitArgsAreSafe: ALLOWS exactly the commit + cleanup commands the runner needs", () => {
  assert.equal(gitArgsAreSafe(["add", "-A"]), true);
  assert.equal(gitArgsAreSafe(["commit", "-F", "/tmp/msg"]), true);
  assert.equal(gitArgsAreSafe(["reset", "--hard", "HEAD"]), true);
  assert.equal(gitArgsAreSafe(["clean", "-fd"]), true, "the discard path must be allowed");
  assert.equal(gitArgsAreSafe(["rev-parse", "HEAD"]), true);
  assert.equal(gitArgsAreSafe(["status", "--porcelain"]), true);
});

// --- commit / status decision ---

test("shouldCommit: commit only when no agent error, all gates pass, and the tree changed", () => {
  assert.equal(shouldCommit({ agentError: null, gates: PASS, treeChanged: true }), true);
  assert.equal(shouldCommit({ agentError: null, gates: PASS, treeChanged: false }), false, "no change → no commit");
  assert.equal(shouldCommit({ agentError: null, gates: FAIL, treeChanged: true }), false, "gate fail → no commit");
  assert.equal(shouldCommit({ agentError: "boom", gates: PASS, treeChanged: true }), false, "agent error → no commit");
  assert.equal(shouldCommit({ agentError: null, gates: [], treeChanged: true }), false, "no gates ran → no commit");
});

test("deriveStatus: ERROR > BLOCKED > DECISION_NEEDED > COMMITTED > NOOP", () => {
  assert.equal(deriveStatus({ agentError: "x", gates: PASS, decision: null, treeChanged: true, committed: false }), "ERROR");
  assert.equal(deriveStatus({ agentError: null, gates: FAIL, decision: "DECISION NEEDED: push", treeChanged: true, committed: false }), "BLOCKED", "a gate failure outranks a decision");
  assert.equal(deriveStatus({ agentError: null, gates: PASS, decision: "DECISION NEEDED: deploy", treeChanged: true, committed: true }), "DECISION_NEEDED");
  assert.equal(deriveStatus({ agentError: null, gates: PASS, decision: null, treeChanged: true, committed: true }), "COMMITTED");
  assert.equal(deriveStatus({ agentError: null, gates: PASS, decision: null, treeChanged: false, committed: false }), "NOOP");
});

test("needsAttention flags the outcomes that should ping John", () => {
  assert.equal(needsAttention("BLOCKED"), true);
  assert.equal(needsAttention("DECISION_NEEDED"), true);
  assert.equal(needsAttention("ERROR"), true);
  assert.equal(needsAttention("COMMITTED"), false);
  assert.equal(needsAttention("NOOP"), false);
});

// --- commit-type inference + message ---

test("inferCommitType reads the conventional prefix from the spec, defaults feat", () => {
  assert.equal(inferCommitType("fix-the-overlap", ""), "fix");
  assert.equal(inferCommitType("runbook-update", "# Goal: write the docs runbook"), "docs");
  assert.equal(inferCommitType("add-coverage", "Add a test for the picker"), "test");
  assert.equal(inferCommitType("rename-things", "Refactor the module layout"), "refactor");
  assert.equal(inferCommitType("ship-motion", "Build the MP4 motion path"), "feat");
});

test("buildCommitMessage is conventional, co-authored, and never mentions push", () => {
  const msg = buildCommitMessage("ship-motion", "feat");
  assert.match(msg, /^feat: ship-motion \(autonomous goal-runner\)/);
  assert.match(msg, /Co-Authored-By: Claude Opus 4\.8/);
  assert.match(msg, /NOT pushed/);
  assert.doesNotMatch(msg, /git push/);
});

// --- decision extraction ---

test("extractDecisionNeeded pulls the block, returns null when absent", () => {
  const out = "Did the safe parts.\n\nDECISION NEEDED: this requires `supabase db push` to prod, which I must not run.\n\nDone.";
  const d = extractDecisionNeeded(out);
  assert.ok(d && d.startsWith("DECISION NEEDED:"));
  assert.match(d!, /supabase db push/);
  assert.equal(extractDecisionNeeded("all clean, gates green"), null);
  assert.equal(extractDecisionNeeded(""), null);
});

// --- result-file + Discord shaping ---

function outcome(over: Partial<RunOutcome> = {}): RunOutcome {
  return {
    name: "ship-motion", specFile: "01-ship-motion.md", status: "COMMITTED", gates: PASS,
    commitSha: "abc1234def", commitType: "feat", agentError: null, decision: null,
    startedAt: "2026-06-27T20:00:00Z", finishedAt: "2026-06-27T20:08:00Z", ...over,
  };
}

test("shapeResultDoc: committed result has the gate table + the (not-pushed) SHA", () => {
  const doc = shapeResultDoc(outcome());
  assert.match(doc, /Status:\*\* ✅ COMMITTED/);
  assert.match(doc, /\| tsc \| ✅ pass \|/);
  assert.match(doc, /`abc1234def` \(feat, NOT pushed\)/);
});

test("shapeResultDoc: blocked result surfaces the failing gate output + the discard note", () => {
  const doc = shapeResultDoc(outcome({ status: "BLOCKED", gates: FAIL, commitSha: null }));
  assert.match(doc, /⛔ BLOCKED/);
  assert.match(doc, /\| test \| ❌ fail \|/);
  assert.match(doc, /Failing gate output/);
  assert.match(doc, /3 failing/);
  assert.match(doc, /discarded/);
});

test("shapeResultDoc: decision-needed result carries the DECISION block for John", () => {
  const doc = shapeResultDoc(outcome({ status: "DECISION_NEEDED", decision: "DECISION NEEDED: needs a prod migration" }));
  assert.match(doc, /DECISION NEEDED/);
  assert.match(doc, /prod migration/);
});

test("shapeDiscordLine: one-liner per status, flags the ones that need John", () => {
  assert.match(shapeDiscordLine(outcome()), /✅ \*\*goal-runner\*\* `ship-motion` → COMMITTED \(feat `abc1234`, not pushed\)/);
  assert.match(shapeDiscordLine(outcome({ status: "BLOCKED", gates: FAIL, commitSha: null })), /failed: test.*Needs you/s);
  assert.match(shapeDiscordLine(outcome({ status: "DECISION_NEEDED", decision: "DECISION NEEDED: deploy" })), /Needs you/);
});

test("truncate caps long strings and notes the cut", () => {
  assert.equal(truncate("short", 100), "short");
  const big = "x".repeat(50);
  const t = truncate(big, 10);
  assert.ok(t.startsWith("xxxxxxxxxx"));
  assert.match(t, /more chars truncated/);
});
