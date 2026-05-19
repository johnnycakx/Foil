// Framework integration tests for the new Vision identifier.
//
// These tests exercise the real Vision pipeline end-to-end (detect → crop →
// identify → price) against fixture images in `__fixtures__/cards/`. They
// require ANTHROPIC_API_KEY + POKETRACE_API_KEY in .env.local and make real
// API calls — they are skipped when the API keys or fixtures are missing.
//
// Run with:
//   node --experimental-strip-types --no-warnings --test lib/__tests__/vision-prompt.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  CARD_SCAN_SCHEMA,
  DETECT_SCHEMA,
  DETECT_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type DetectPayload,
  type IdentifiedCard,
  type ScanPayload,
} from "../vision.ts";
import { cropFromBuffer } from "../crop.ts";
import { priceCard } from "../poketrace.ts";

// --- env wiring ---
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const HAS_KEYS = !!(process.env.ANTHROPIC_API_KEY && process.env.POKETRACE_API_KEY);
const FIXTURES_DIR = path.join("lib", "__fixtures__", "cards");

// Best-effort fallback: if a fixture isn't checked in under
// __fixtures__/cards/, fall back to the equivalent under tmp/ so dev test runs
// can reuse what's already on disk.
function findFixture(name: string): string | null {
  const checkedIn = path.join(FIXTURES_DIR, name);
  if (fs.existsSync(checkedIn)) return checkedIn;
  const tmpCopy = path.join("tmp", name);
  if (fs.existsSync(tmpCopy)) return tmpCopy;
  return null;
}

// --- helpers (one-shot client) ---
const client = HAS_KEYS ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

async function detect(buf: Buffer, mediaType: "image/png" | "image/jpeg"): Promise<DetectPayload> {
  if (!client) throw new Error("no client");
  const r = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: DETECT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: DETECT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } },
          { type: "text", text: "Return one bounding box per visible Pokémon card." },
        ],
      },
    ],
  });
  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as DetectPayload;
}

async function identify(
  source: { type: "base64"; media_type: "image/jpeg"; data: string },
): Promise<ScanPayload> {
  if (!client) throw new Error("no client");
  const r = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: VISION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: CARD_SCAN_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          { type: "text", text: "Identify every Pokémon card visible. Apply the hard rules." },
        ],
      },
    ],
  });
  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as ScanPayload;
}

// Run the full detect → crop → identify → price pipeline on one image.
async function scan(file: string): Promise<{ cards: IdentifiedCard[]; pricings: Awaited<ReturnType<typeof priceCard>>[] }> {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mediaType = (ext === ".png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg";

  const detected = await detect(buf, mediaType);
  if (detected.count === 0) {
    return { cards: [], pricings: [] };
  }

  const crops = await Promise.all(detected.cards.map((b) => cropFromBuffer(buf, b)));
  const sources = crops.map((c) => ({ type: "base64" as const, media_type: c.mediaType, data: c.base64 }));
  // Serialized: a binder of 10+ cards fanned out in parallel blows past the
  // org's 30k-input-tokens/minute budget. Test stability > test speed.
  const payloads: ScanPayload[] = [];
  for (const s of sources) {
    payloads.push(await identify(s));
  }
  const cards = payloads.flatMap((p) => p.cards);

  const pricings = await Promise.all(
    cards.map((c) =>
      priceCard({
        status: c.status,
        name: c.name,
        setCode: c.setCode,
        collectorNumber: c.collectorNumber,
        rarity: c.rarity,
        regulationMark: c.regulationMark,
      }),
    ),
  );

  return { cards, pricings };
}

// ------------- TESTS -------------

test("prismatic-binder: returns confident matches with collector numbers, no hallucinations", { skip: !HAS_KEYS }, async () => {
  const file = findFixture("prismatic-binder.jpg");
  if (!file) return; // node:test 'skip' is option-only at definition time; bail quietly when missing

  const { cards, pricings } = await scan(file);
  assert.ok(cards.length >= 9, `expected ≥9 cards, got ${cards.length}`);

  // The framework's load-bearing assertion: no card can be a confident,
  // priced match while also having a null collectorNumber.
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const p = pricings[i];
    if (p.matched && !p.lowConfidence) {
      assert.ok(
        c.collectorNumber !== null && c.collectorNumber !== undefined,
        `card[${i}] (${c.name}) is a confident match but collectorNumber is null`,
      );
    }
  }

  // The set code for Prismatic Evolutions is PRE; assert at least one card came back tagged with it.
  const preCount = cards.filter((c) => c.setCode === "PRE").length;
  assert.ok(preCount >= 3, `expected ≥3 cards tagged setCode=PRE, got ${preCount}`);
});

test("real-world-mixed: flags unreadable cards rather than mismatching", { skip: !HAS_KEYS }, async () => {
  const file = findFixture("real-world-mixed.jpg");
  if (!file) return;

  const { cards, pricings } = await scan(file);
  assert.ok(cards.length > 0, "real-world fixture detected zero cards");

  // No confident match with a null collector number.
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const p = pricings[i];
    if (p.matched && !p.lowConfidence) {
      assert.ok(
        c.collectorNumber !== null && c.collectorNumber !== undefined,
        `card[${i}] is a confident match but collectorNumber is null — framework violation`,
      );
    }
  }

  // At least half the unmatched cards should carry status:insufficient_information
  // (the framework's "flag, don't mismatch" guarantee).
  const insufficient = cards.filter((c) => c.status === "insufficient_information").length;
  const mismatched = pricings.filter(
    (p, i) => !p.matched && cards[i].status === "identified",
  ).length;
  console.log(
    `[real-world-mixed] total=${cards.length} insufficient=${insufficient} mismatched=${mismatched} priced=${pricings.filter((p) => p.matched).length}`,
  );
  assert.ok(
    insufficient >= mismatched,
    `framework guarantee: insufficient (${insufficient}) should be ≥ mismatched (${mismatched})`,
  );
});

test("japanese-charizard: detects language='JA'", { skip: !HAS_KEYS }, async () => {
  const file = findFixture("japanese-charizard.jpg");
  if (!file) return;

  const { cards } = await scan(file);
  assert.ok(cards.length > 0, "japanese fixture detected zero cards");
  const ja = cards.filter((c) => c.language === "JA").length;
  assert.ok(ja > 0, `expected ≥1 card with language='JA', got ${ja}`);
});
