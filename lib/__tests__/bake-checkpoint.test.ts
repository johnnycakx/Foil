// Resumable-bake checkpoint tests (Session 47.5 / ADR-047). Pins that a
// killed run + --resume restart produces the same set of processed cards as an
// uninterrupted run, and that snapshot+state flush together (state never claims
// a card the snapshot lacks). Uses an injected in-memory fs — no real bake.

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { createBakeCheckpoint } from "../../scripts/bake-checkpoint.ts";

// Minimal in-memory fs honoring the {existsSync, readFileSync, writeFileSync}
// seam createBakeCheckpoint accepts.
function memFs() {
  const files = new Map<string, string>();
  return {
    files,
    existsSync: ((p: string) => files.has(p)) as unknown as typeof import("node:fs").existsSync,
    readFileSync: ((p: string) => {
      if (!files.has(p)) throw new Error(`ENOENT ${p}`);
      return files.get(p)!;
    }) as unknown as typeof import("node:fs").readFileSync,
    writeFileSync: ((p: string, data: string) => {
      files.set(p, String(data));
    }) as unknown as typeof import("node:fs").writeFileSync,
  };
}

const abs = (statePath: string) => join(process.cwd(), statePath);

test("checkpoint: no resume → nothing skipped; mark flushes snapshot+state every flushEvery", () => {
  const fs = memFs();
  let snapshots = 0;
  const cp = createBakeCheckpoint({
    statePath: ".state.json",
    resume: false,
    flushEvery: 2,
    persistSnapshot: () => snapshots++,
    fs,
  });
  assert.equal(cp.shouldSkip("a"), false);
  cp.mark("a"); // 1 — no flush
  assert.equal(snapshots, 0);
  cp.mark("b"); // 2 — flush
  assert.equal(snapshots, 1);
  cp.mark("c"); // 3 — no flush
  cp.finalize(); // final flush
  assert.equal(snapshots, 2);
  const state = JSON.parse(fs.files.get(abs(".state.json"))!);
  assert.deepEqual(new Set(state.processed), new Set(["a", "b", "c"]));
});

test("checkpoint: --resume loads prior state and skips already-processed ids", () => {
  const fs = memFs();
  fs.files.set(abs(".state.json"), JSON.stringify({ processed: ["a", "b"], updatedAt: "x" }));
  const cp = createBakeCheckpoint({ statePath: ".state.json", resume: true, persistSnapshot: () => {}, fs });
  assert.equal(cp.shouldSkip("a"), true);
  assert.equal(cp.shouldSkip("b"), true);
  assert.equal(cp.shouldSkip("c"), false);
});

test("checkpoint: resume ignores prior state when resume=false (fresh run)", () => {
  const fs = memFs();
  fs.files.set(abs(".state.json"), JSON.stringify({ processed: ["a", "b"], updatedAt: "x" }));
  const cp = createBakeCheckpoint({ statePath: ".state.json", resume: false, persistSnapshot: () => {}, fs });
  assert.equal(cp.shouldSkip("a"), false); // resume off → reprocess everything
});

test("checkpoint: kill-mid-run + --resume == uninterrupted run (same final processed set)", () => {
  const ALL = ["a", "b", "c", "d", "e"];

  // Uninterrupted run.
  const fs1 = memFs();
  const cp1 = createBakeCheckpoint({ statePath: ".s.json", resume: false, flushEvery: 2, persistSnapshot: () => {}, fs: fs1 });
  for (const id of ALL) if (!cp1.shouldSkip(id)) cp1.mark(id);
  cp1.finalize();

  // Interrupted run: marks a,b (flush → state {a,b}) then c, then "crashes"
  // before the next flush/finalize — so only {a,b} is persisted.
  const fs2 = memFs();
  const cp2a = createBakeCheckpoint({ statePath: ".s.json", resume: false, flushEvery: 2, persistSnapshot: () => {}, fs: fs2 });
  cp2a.mark("a");
  cp2a.mark("b"); // flush → state {a,b}
  cp2a.mark("c"); // not yet flushed; crash here
  // Restart with --resume: reads {a,b}, reprocesses c,d,e.
  const cp2b = createBakeCheckpoint({ statePath: ".s.json", resume: true, flushEvery: 2, persistSnapshot: () => {}, fs: fs2 });
  const reprocessed: string[] = [];
  for (const id of ALL) {
    if (cp2b.shouldSkip(id)) continue;
    reprocessed.push(id);
    cp2b.mark(id);
  }
  cp2b.finalize();

  assert.deepEqual(reprocessed, ["c", "d", "e"], "resume reprocessed only the unflushed tail");
  const finalSet = (fs: ReturnType<typeof memFs>) => new Set(JSON.parse(fs.files.get(abs(".s.json"))!).processed);
  assert.deepEqual(finalSet(fs2), finalSet(fs1));
  assert.deepEqual(finalSet(fs2), new Set(ALL));
});
