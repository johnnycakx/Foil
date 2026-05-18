import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  CARD_SCAN_SCHEMA,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type ScanPayload,
} from "../lib/vision.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

const imgPath = process.argv[2] ?? "tmp/charizard.png";
const imgBytes = fs.readFileSync(imgPath);
const ext = path.extname(imgPath).toLowerCase();
const mediaType =
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

console.log(`[verify] image=${imgPath} bytes=${imgBytes.length} mediaType=${mediaType}`);
console.log(`[verify] model=${VISION_MODEL}`);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const start = Date.now();

const response = await client.messages.create({
  model: VISION_MODEL,
  max_tokens: 16000,
  system: [
    {
      type: "text",
      text: VISION_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ],
  output_config: { format: { type: "json_schema", schema: CARD_SCAN_SCHEMA } },
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imgBytes.toString("base64") },
        },
        {
          type: "text",
          text: "Identify every Pokémon card visible in this photo and return the JSON described in your instructions.",
        },
      ],
    },
  ],
});

const latencyMs = Date.now() - start;
const text = response.content
  .filter((b): b is Anthropic.TextBlock => b.type === "text")
  .map((b) => b.text)
  .join("");
const data = JSON.parse(text) as ScanPayload;

console.log(`[verify] latency=${latencyMs}ms`);
console.log(
  `[verify] tokens input=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0} output=${response.usage.output_tokens}`,
);
console.log(`[verify] overallConfidence=${data.overallConfidence} unidentified=${data.unidentifiedCount}`);
console.log(`[verify] cards (${data.cards.length}):`);
for (const c of data.cards) {
  console.log(
    `  - ${c.name} | ${c.set} #${c.cardNumber} | ${c.rarity} | ${c.conditionEstimate} | ${c.confidence}%`,
  );
}
