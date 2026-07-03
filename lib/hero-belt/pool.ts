// Hero-belt pool reader (hero-chase-belt, ADR-102). The committed pool
// artifact is produced by scripts/generate-hero-belt.ts from the baked
// snapshot (value-ranked, adjacency-arranged, faces self-hosted under
// public/belt/). Data-level invariants are pinned in
// lib/__tests__/hero-belt.test.ts (I-010 discipline).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type BeltCard = {
  slug: string;
  name: string;
  setName: string;
  img: string;
  usd: number;
};

function loadPool(): BeltCard[] {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "pool.generated.json"), "utf8");
    const parsed = JSON.parse(raw) as { cards?: BeltCard[] };
    return parsed.cards ?? [];
  } catch {
    return []; // honest degradation: no pool -> the hero renders the static fan
  }
}

const POOL = loadPool();

/** The full arranged wheel pool (~200). */
export function getHeroBeltPool(): BeltCard[] {
  return POOL;
}
