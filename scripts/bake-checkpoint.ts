// Resumable-bake checkpoint (Session 47.5 / ADR-047).
//
// A long bake (1,000s of cards × per-card API calls) that dies partway loses
// everything if progress isn't persisted. This helper records processed card
// ids to a small state file and, every `flushEvery` cards, flushes BOTH the
// state file AND the script's main snapshot together (so the two never drift —
// the state never claims a card the snapshot hasn't saved). With `--resume`,
// already-processed ids are skipped; the run picks up where it stopped.
//
// Pure-ish + injectable (statePath + persistSnapshot) so it's unit-testable
// without running a real bake. Shared by bake-poketrace-uuids.ts and
// bake-card-metadata.ts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BakeCheckpointState = { processed: string[]; updatedAt: string };

export type BakeCheckpoint = {
  /** ids already persisted (loaded from the state file on --resume). */
  readonly done: Set<string>;
  /** True when --resume is on AND this id was already processed → skip it. */
  shouldSkip(id: string): boolean;
  /** Mark an id processed; flushes snapshot + state every `flushEvery` marks. */
  mark(id: string): void;
  /** Final flush of snapshot + state (call once at the end of the run). */
  finalize(): void;
};

export type BakeCheckpointOptions = {
  /** cwd-relative path for the JSON state file, e.g. ".bake-poketrace-state.json". */
  statePath: string;
  /** When true, load prior state + skip already-processed ids. */
  resume: boolean;
  /** Cards between snapshot+state flushes (default 25). */
  flushEvery?: number;
  /** Persists the script's main output (e.g. baked-metadata.json). Called on
   *  every flush so the snapshot is always at least as fresh as the state. */
  persistSnapshot: () => void;
  /** Test seam — override fs (defaults to node:fs). */
  fs?: {
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    writeFileSync: typeof writeFileSync;
  };
};

export function createBakeCheckpoint(opts: BakeCheckpointOptions): BakeCheckpoint {
  const fs = opts.fs ?? { existsSync, readFileSync, writeFileSync };
  const flushEvery = opts.flushEvery ?? 25;
  const abs = join(process.cwd(), opts.statePath);
  const done = new Set<string>();

  if (opts.resume && fs.existsSync(abs)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(abs, "utf8")) as Partial<BakeCheckpointState>;
      for (const id of parsed.processed ?? []) done.add(id);
    } catch {
      // Corrupt/partial state file → start fresh rather than crash.
    }
  }

  let sinceFlush = 0;
  const writeState = () => {
    const state: BakeCheckpointState = { processed: [...done], updatedAt: new Date().toISOString() };
    fs.writeFileSync(abs, JSON.stringify(state, null, 2), "utf8");
  };
  const flush = () => {
    opts.persistSnapshot();
    writeState();
    sinceFlush = 0;
  };

  return {
    done,
    shouldSkip: (id: string) => opts.resume && done.has(id),
    mark: (id: string) => {
      done.add(id);
      if (++sinceFlush >= flushEvery) flush();
    },
    finalize: () => flush(),
  };
}
