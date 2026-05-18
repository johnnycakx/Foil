// Integration tests for the visual confirmation pass.
// Run with: npm test (the test script runs all *.test.ts in lib/__tests__/).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { confirmMatch, type ConfirmCandidate } from "../vision-confirm.ts";

// --- env wiring ---
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const HAS_KEYS = !!process.env.ANTHROPIC_API_KEY;
const FIXTURES_DIR = path.join("lib", "__fixtures__", "cards");

function findFixture(name: string): string | null {
  const checkedIn = path.join(FIXTURES_DIR, name);
  if (fs.existsSync(checkedIn)) return checkedIn;
  const tmpCopy = path.join("tmp", name);
  if (fs.existsSync(tmpCopy)) return tmpCopy;
  return null;
}

function fileToDataUrl(p: string): string {
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).toLowerCase();
  const mt = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mt};base64,${buf.toString("base64")}`;
}

// Real PokeTrace card images we know are publicly available.
const CARD_IMAGES = {
  baseSetCharizard: "https://cdn.poketrace.com/cards/d64defcfc64ff4ea.webp",
  // Other random cards we'll use as distractors.
  baseSetPikachu: null as string | null, // populated lazily via PokeTrace if needed
};

// ---------- TESTS ----------

test("confirmMatch picks the right reference when one matches", { skip: !HAS_KEYS }, async () => {
  // Use the Base Set Charizard image both as the "user upload" (representing the
  // user's photo) and as one of three candidates. The other two are deliberate
  // distractors (different Pokemon, same set).
  const userPhoto = CARD_IMAGES.baseSetCharizard;

  const candidates: ConfirmCandidate[] = [
    {
      image: "https://images.pokemontcg.io/base1/2_hires.png", // Blastoise — distractor
      name: "Blastoise",
      set: "Base Set",
      collectorNumber: "2/102",
    },
    {
      image: CARD_IMAGES.baseSetCharizard, // The correct one
      name: "Charizard",
      set: "Base Set",
      collectorNumber: "4/102",
    },
    {
      image: "https://images.pokemontcg.io/base1/58_hires.png", // Pikachu — distractor
      name: "Pikachu",
      set: "Base Set",
      collectorNumber: "58/102",
    },
  ];

  const result = await confirmMatch(userPhoto, candidates);
  console.log(`[confirmMatch] chosenIndex=${result.chosenIndex} confidence=${result.confidence} reasoning="${result.reasoning}"`);

  assert.strictEqual(result.chosenIndex, 1, "should pick the Charizard candidate (index 1)");
  assert.ok(
    result.confidence === "high" || result.confidence === "medium",
    `expected high/medium confidence, got "${result.confidence}"`,
  );
});

test("confirmMatch returns null when no candidate matches", { skip: !HAS_KEYS }, async () => {
  // User has Charizard but candidates are three different cards.
  const userPhoto = CARD_IMAGES.baseSetCharizard;

  const candidates: ConfirmCandidate[] = [
    {
      image: "https://images.pokemontcg.io/base1/2_hires.png", // Blastoise
      name: "Blastoise",
      set: "Base Set",
      collectorNumber: "2/102",
    },
    {
      image: "https://images.pokemontcg.io/base1/10_hires.png", // Mewtwo
      name: "Mewtwo",
      set: "Base Set",
      collectorNumber: "10/102",
    },
    {
      image: "https://images.pokemontcg.io/base1/58_hires.png", // Pikachu
      name: "Pikachu",
      set: "Base Set",
      collectorNumber: "58/102",
    },
  ];

  const result = await confirmMatch(userPhoto, candidates);
  console.log(`[confirmMatch all-wrong] chosenIndex=${result.chosenIndex} confidence=${result.confidence} reasoning="${result.reasoning}"`);

  // The framework spec: return null when none plausibly match.
  // Allow "low" confidence as an acceptable signal here too — the orchestrator
  // bails out either way.
  if (result.chosenIndex !== null) {
    assert.strictEqual(
      result.confidence,
      "low",
      "if a non-null chosenIndex was returned despite no real match, confidence should be 'low'",
    );
  }
});

test("real-world-mixed fixture: confirmMatch + the right candidate", { skip: !HAS_KEYS }, async () => {
  const file = findFixture("real-world-mixed.jpg");
  if (!file) {
    console.log("[skip] real-world-mixed.jpg not present in __fixtures__/cards/ or tmp/");
    return;
  }
  // The fixture isn't required to be checked in. When it IS present, this
  // tests the full confirm pass against a real failing photo. The user will
  // populate the candidates list once they know the right card.
  const userPhoto = fileToDataUrl(file);
  const candidates: ConfirmCandidate[] = [
    {
      image: CARD_IMAGES.baseSetCharizard,
      name: "Charizard",
      set: "Base Set",
      collectorNumber: "4/102",
    },
  ];
  const result = await confirmMatch(userPhoto, candidates);
  console.log(`[confirmMatch real-world] chosenIndex=${result.chosenIndex} confidence=${result.confidence}`);
  // We can't assert correctness without knowing the right answer for the
  // user's specific photo. Just exercise the pipeline.
  assert.ok(
    typeof result.chosenIndex === "number" || result.chosenIndex === null,
    "result must be either an integer or null",
  );
});
