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
} from "../lib/vision.ts";
import { cropFromBuffer } from "../lib/crop.ts";
import { priceCard, type CardPricing } from "../lib/poketrace.ts";
import { retryIdentify } from "../lib/vision-retry.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
for (const k of ["ANTHROPIC_API_KEY", "POKETRACE_API_KEY"] as const) {
  if (!process.env[k]) throw new Error(`${k} missing`);
}

const imgPath = process.argv[2] ?? "tmp/prismatic-binder.jpg";
if (!fs.existsSync(imgPath)) throw new Error(`fixture not found: ${imgPath}`);
const imgBytes = fs.readFileSync(imgPath);
const ext = path.extname(imgPath).toLowerCase();
const mediaType: "image/png" | "image/webp" | "image/jpeg" =
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
console.log(`[verify-retry] image=${imgPath} bytes=${imgBytes.length}`);

// ---- Detect ----
const detectResp = await client.messages.create({
  model: VISION_MODEL,
  max_tokens: 4096,
  system: [{ type: "text", text: DETECT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
const detected = JSON.parse(
  detectResp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(""),
) as DetectPayload;
console.log(`[detect] count=${detected.count}`);

// ---- Crop + identify (Sonnet) ----
type CropSource = { type: "base64"; media_type: "image/jpeg"; data: string };
const crops = await Promise.all(detected.cards.map((b) => cropFromBuffer(imgBytes, b)));
const cropSources: CropSource[] = crops.map((c) => ({
  type: "base64",
  media_type: c.mediaType,
  data: c.base64,
}));
console.log(`[crop] ${crops.length} crops; example size ${crops[0]?.width}x${crops[0]?.height}`);

async function identify(source: CropSource): Promise<ScanPayload> {
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
          { type: "text", text: "Identify every Pokémon card visible in this photo and return the JSON described in your instructions." },
        ],
      },
    ],
  });
  const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text) as ScanPayload;
}

const idStart = Date.now();
const payloads = await Promise.all(cropSources.map(identify));
const cards: IdentifiedCard[] = payloads.map((p) => p.cards[0]).filter((c): c is IdentifiedCard => !!c);
console.log(`[identify] ${cards.length} cards in ${Date.now() - idStart}ms (Sonnet)`);

function lite(c: IdentifiedCard) {
  return {
    status: c.status,
    name: c.name,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber,
    rarity: c.rarity,
    regulationMark: c.regulationMark,
  };
}

// ---- First-pass pricing ----
const firstPricings = await Promise.all(cards.map((c) => priceCard(lite(c))));
const beforeMatched = firstPricings.filter((p) => p.matched).length;
const beforeInsufficient = cards.filter((c) => c.status === "insufficient_information").length;
console.log(
  `\n[BEFORE retry] priced=${beforeMatched}/${cards.length} insufficient=${beforeInsufficient}`,
);
cards.forEach((c, i) => {
  const p = firstPricings[i];
  const status = p.matched
    ? `✓ $${p.topPrice?.amount ?? "—"} (${p.candidate.set} #${p.candidate.cardNumber})${p.lowConfidence ? " [low_confidence]" : ""}`
    : `✗ ${(p as { failure: { code: string } }).failure.code}`;
  const langTag = c.language && c.language !== "EN" && c.language !== "unknown" ? ` [${c.language}]` : "";
  console.log(`  [${i + 1}] ${c.name ?? "(unreadable)"} (${c.setCode ?? "?"} #${c.collectorNumber ?? "?"})${langTag} → ${status}`);
});

// ---- Retry pass (Opus 4.5) ----
const RETRYABLE = new Set(["no_candidates", "low_score", "regulation_mismatch"]);
const finalPricings: CardPricing[] = [...firstPricings];
const finalCards: IdentifiedCard[] = [...cards];
const retryStart = Date.now();
const retryTasks: Promise<void>[] = [];
for (let i = 0; i < cards.length; i++) {
  const p = firstPricings[i];
  if (p.matched) continue;
  if (cards[i].status !== "identified") continue;
  const f = (p as { failure: { code: string } }).failure;
  if (!RETRYABLE.has(f.code)) continue;
  const source = cropSources[i];
  if (!source) continue;
  retryTasks.push(
    (async () => {
      try {
        const out = await retryIdentify(source, cards[i], (p as { failure: typeof p extends { failure: infer F } ? F : never }).failure);
        if (!out.card) return;
        const repriced = await priceCard(lite(out.card));
        finalCards[i] = out.card;
        finalPricings[i] = repriced;
      } catch (err) {
        console.error(`  [${i + 1}] retry error: ${err instanceof Error ? err.message : err}`);
      }
    })(),
  );
}
await Promise.all(retryTasks);
const retryMs = Date.now() - retryStart;
const afterMatched = finalPricings.filter((p) => p.matched).length;
const afterInsufficient = finalCards.filter((c) => c.status === "insufficient_information").length;
console.log(
  `\n[AFTER retry] priced=${afterMatched}/${cards.length} insufficient=${afterInsufficient} (retry wall=${retryMs}ms, ${retryTasks.length} retries)`,
);
finalCards.forEach((c, i) => {
  const before = cards[i];
  const p = finalPricings[i];
  const changed =
    c.name !== before.name ||
    c.setCode !== before.setCode ||
    c.collectorNumber !== before.collectorNumber;
  const status = p.matched
    ? `✓ $${p.topPrice?.amount ?? "—"} (${p.candidate.set} #${p.candidate.cardNumber})${p.lowConfidence ? " [low_confidence]" : ""}`
    : c.status === "insufficient_information"
      ? `⚠ ${c.insufficientReason ?? "needs review"}`
      : `✗ needs manual review`;
  const tag = changed ? " [retry-corrected]" : "";
  console.log(`  [${i + 1}] ${c.name ?? "(unreadable)"} (${c.setCode ?? "?"} #${c.collectorNumber ?? "?"})${tag} → ${status}`);
});

// Framework assertion: no card should be in a confident match yet missing the collector number.
const violations = finalPricings.filter((p, i) => {
  return p.matched && !p.lowConfidence && !finalCards[i].collectorNumber;
});
if (violations.length > 0) {
  console.error(`\n[ASSERT FAIL] ${violations.length} confidently-matched cards missing collectorNumber`);
} else {
  console.log(`\n[ASSERT OK] no confident match with null collectorNumber`);
}

console.log(`\nSUMMARY: ${beforeMatched}/${cards.length} → ${afterMatched}/${cards.length} priced; ${afterInsufficient} flagged insufficient_information`);
