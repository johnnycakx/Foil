import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  CARD_SCAN_SCHEMA,
  DETECT_SCHEMA,
  DETECT_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type BoundingBox,
  type DetectPayload,
  type ScanPayload,
} from "../lib/vision.ts";
import { cropFromBuffer } from "../lib/crop.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

const imgPath = process.argv[2] ?? "tmp/charizard.png";
if (!fs.existsSync(imgPath)) {
  console.error(`[verify] fixture not found: ${imgPath}`);
  console.error(
    `[verify] Single-card fixtures exist at tmp/charizard.png and tmp/pikachu.png.`,
  );
  console.error(
    `[verify] For multi-card testing, drop a binder/multi-card photo at tmp/binder.jpg or pass an explicit path:`,
  );
  console.error(`[verify]   node --experimental-strip-types scripts/verify-vision.ts path/to/photo.jpg`);
  process.exit(2);
}

const imgBytes = fs.readFileSync(imgPath);
const ext = path.extname(imgPath).toLowerCase();
const mediaType: "image/png" | "image/webp" | "image/jpeg" =
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

console.log(`[verify] image=${imgPath} bytes=${imgBytes.length} mediaType=${mediaType}`);
console.log(`[verify] model=${VISION_MODEL}`);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function detect(): Promise<{ detected: DetectPayload; ms: number; cacheRead: number; cacheWrite: number }> {
  const start = Date.now();
  const r = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: DETECT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    output_config: { format: { type: "json_schema", schema: DETECT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imgBytes.toString("base64") } },
          { type: "text", text: "Return one bounding box per visible Pokémon card. No identification — just locate the cards." },
        ],
      },
    ],
  });
  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    detected: JSON.parse(text) as DetectPayload,
    ms: Date.now() - start,
    cacheRead: r.usage.cache_read_input_tokens ?? 0,
    cacheWrite: r.usage.cache_creation_input_tokens ?? 0,
  };
}

async function identifyOne(
  source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp"; data: string },
): Promise<{ payload: ScanPayload; ms: number; cacheRead: number; cacheWrite: number }> {
  const start = Date.now();
  const r = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 16000,
    system: [
      { type: "text", text: VISION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    output_config: { format: { type: "json_schema", schema: CARD_SCAN_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          { type: "text", text: "Identify every Pokémon card visible in this photo and return the JSON described in your instructions." },
        ],
      },
    ],
  });
  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    payload: JSON.parse(text) as ScanPayload,
    ms: Date.now() - start,
    cacheRead: r.usage.cache_read_input_tokens ?? 0,
    cacheWrite: r.usage.cache_creation_input_tokens ?? 0,
  };
}

function fmtBox(b: BoundingBox): string {
  return `x=${b.x.toFixed(3)} y=${b.y.toFixed(3)} w=${b.width.toFixed(3)} h=${b.height.toFixed(3)}`;
}

const { detected, ms: detectMs, cacheRead: dRead, cacheWrite: dWrite } = await detect();
console.log(
  `\n[detect] count=${detected.count} ms=${detectMs} cache_read=${dRead} cache_write=${dWrite}`,
);
for (const [i, b] of detected.cards.entries()) console.log(`  [${i + 1}] ${fmtBox(b)}`);

if (detected.count <= 1) {
  console.log(`\n[mode] single-pass (count=${detected.count}) — running identify on whole image`);
  const { payload, ms, cacheRead, cacheWrite } = await identifyOne({
    type: "base64",
    media_type: mediaType,
    data: imgBytes.toString("base64"),
  });
  console.log(`[identify] ms=${ms} cache_read=${cacheRead} cache_write=${cacheWrite}`);
  console.log(`[result] overallConfidence=${payload.overallConfidence} unidentified=${payload.unidentifiedCount}`);
  for (const c of payload.cards) {
    console.log(
      `  - ${c.name} | ${c.setCode} #${c.collectorNumber} | ${c.rarity} | ${c.conditionEstimate} | ${c.confidence}%`,
    );
  }
} else {
  console.log(`\n[mode] multi-pass (count=${detected.count}) — cropping and identifying in parallel`);
  const cropStart = Date.now();
  const crops = await Promise.all(detected.cards.map((b) => cropFromBuffer(imgBytes, b)));
  const cropMs = Date.now() - cropStart;
  console.log(`[crop] ${crops.length} crops in ${cropMs}ms`);

  const idStart = Date.now();
  const outcomes = await Promise.all(
    crops.map((c) =>
      identifyOne({ type: "base64", media_type: c.mediaType, data: c.base64 }),
    ),
  );
  const idMs = Date.now() - idStart;

  let identified = 0;
  let unidentified = 0;
  let confSum = 0;
  let confN = 0;
  console.log(`[identify] parallel total wall=${idMs}ms`);
  for (const [i, o] of outcomes.entries()) {
    const card = o.payload.cards[0];
    if (card) {
      identified++;
      confSum += card.confidence ?? 0;
      confN++;
      console.log(
        `  [${i + 1}] ${o.ms}ms · ${card.name} | ${card.setCode} #${card.collectorNumber} | ${card.rarity} | ${card.confidence}%`,
      );
    } else {
      unidentified++;
      console.log(`  [${i + 1}] ${o.ms}ms · (no card identified)`);
    }
    unidentified += o.payload.unidentifiedCount;
  }
  console.log(
    `\n[result] identified=${identified}/${detected.count} unidentified=${unidentified} meanConfidence=${confN ? Math.round(confSum / confN) : 0}%`,
  );
}
