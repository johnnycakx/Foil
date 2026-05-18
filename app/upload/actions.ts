"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { cropFromBuffer } from "@/lib/crop";
import {
  CARD_SCAN_SCHEMA,
  DETECT_SCHEMA,
  DETECT_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type BoundingBox,
  type DetectPayload,
  type IdentifiedCard,
  type ScanPayload,
} from "@/lib/vision";
import {
  collectionTotalRawNm,
  priceCards,
  type CardPricing,
} from "@/lib/poketrace";

export type PricedCard = IdentifiedCard & { pricing: CardPricing };

export type PricedScanPayload = {
  cards: PricedCard[];
  overallConfidence: number;
  unidentifiedCount: number;
  totalValue: number;
  pricedCount: number;
};

export type ScanResult =
  | {
      ok: true;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      latencyMs: number;
      pricingMs: number;
      passes: "single" | "multi";
      detectedCount: number;
      cache: { read: number; written: number; input: number };
      data: PricedScanPayload;
    }
  | { ok: false; error: string };

export type DetectResult =
  | { ok: true; count: number; cards: BoundingBox[]; detectMs: number }
  | { ok: false; error: string };

const SUPPORTED_MEDIA: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

type Source = { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

async function readUploadedImage(
  formData: FormData,
): Promise<
  | { ok: true; userId: string; buffer: Buffer; source: Source; fileName: string; sizeBytes: number; rawMime: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }

  const mediaType = SUPPORTED_MEDIA[file.type.toLowerCase()];
  if (!mediaType) {
    if (file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name)) {
      return {
        ok: false,
        error:
          "HEIC photos aren't supported yet. On iPhone: Settings → Camera → Formats → Most Compatible, or export this photo as JPG.",
      };
    }
    return { ok: false, error: `Unsupported image type: ${file.type || "unknown"}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    userId: user.id,
    buffer,
    source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
    fileName: file.name,
    sizeBytes: file.size,
    rawMime: file.type,
  };
}

type IdentifyOutcome = {
  payload: ScanPayload;
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
};

async function runIdentify(source: Source): Promise<IdentifyOutcome> {
  const response = await anthropic().messages.create({
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
          { type: "image", source },
          {
            type: "text",
            text: "Identify every Pokémon card visible in this photo and return the JSON described in your instructions.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const payload = JSON.parse(text) as ScanPayload;

  return {
    payload,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    inputTokens: response.usage.input_tokens,
  };
}

async function runDetect(source: Source): Promise<DetectPayload> {
  const response = await anthropic().messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: DETECT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: { type: "json_schema", schema: DETECT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          {
            type: "text",
            text: "Return one bounding box per visible Pokémon card. No identification — just locate the cards.",
          },
        ],
      },
    ],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as DetectPayload;
}

export async function detectScan(formData: FormData): Promise<DetectResult> {
  const r = await readUploadedImage(formData);
  if (!r.ok) return { ok: false, error: r.error };

  const start = Date.now();
  try {
    const detected = await runDetect(r.source);
    const detectMs = Date.now() - start;
    console.log(
      `[detectScan] user=${r.userId} count=${detected.count} detectMs=${detectMs}`,
    );
    return { ok: true, count: detected.count, cards: detected.cards, detectMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[detectScan] error: ${message}`);
    return { ok: false, error: `Detection failed: ${message}` };
  }
}

function safeParseBoxes(raw: FormDataEntryValue | null): BoundingBox[] | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (b): b is BoundingBox =>
          b !== null &&
          typeof b === "object" &&
          typeof (b as BoundingBox).x === "number" &&
          typeof (b as BoundingBox).y === "number" &&
          typeof (b as BoundingBox).width === "number" &&
          typeof (b as BoundingBox).height === "number",
      )
      .map((b) => ({
        x: Math.max(0, Math.min(1, b.x)),
        y: Math.max(0, Math.min(1, b.y)),
        width: Math.max(0, Math.min(1, b.width)),
        height: Math.max(0, Math.min(1, b.height)),
      }));
  } catch {
    return null;
  }
}

function aggregatePayloads(payloads: ScanPayload[]): ScanPayload {
  const cards: IdentifiedCard[] = [];
  let unidentifiedCount = 0;
  let confSum = 0;
  let confN = 0;
  for (const p of payloads) {
    for (const c of p.cards) cards.push(c);
    unidentifiedCount += p.unidentifiedCount;
    if (typeof p.overallConfidence === "number" && p.cards.length > 0) {
      confSum += p.overallConfidence * p.cards.length;
      confN += p.cards.length;
    }
  }
  return {
    cards,
    overallConfidence: confN > 0 ? Math.round(confSum / confN) : 0,
    unidentifiedCount,
  };
}

export async function identifyScan(formData: FormData): Promise<ScanResult> {
  const r = await readUploadedImage(formData);
  if (!r.ok) return { ok: false, error: r.error };

  const boxes = safeParseBoxes(formData.get("boxes"));
  const rawDetected = formData.get("detectedCount");
  const detectedCount =
    typeof rawDetected === "string" ? parseInt(rawDetected, 10) || 0 : boxes?.length ?? 0;
  const useMulti = !!boxes && boxes.length > 1;

  console.log(
    `[identifyScan] user=${r.userId} name=${r.fileName} size=${r.sizeBytes}B type=${r.rawMime} mode=${useMulti ? "multi" : "single"} detectedCount=${detectedCount}`,
  );

  const visionStart = Date.now();
  let payload: ScanPayload;
  let cacheRead = 0;
  let cacheWrite = 0;
  let inputTokens = 0;

  try {
    if (useMulti) {
      const crops = await Promise.all(
        boxes.map((box) => cropFromBuffer(r.buffer, box)),
      );
      const outcomes = await Promise.all(
        crops.map((crop) =>
          runIdentify({
            type: "base64",
            media_type: crop.mediaType,
            data: crop.base64,
          }),
        ),
      );
      payload = aggregatePayloads(outcomes.map((o) => o.payload));
      for (const o of outcomes) {
        cacheRead += o.cacheRead;
        cacheWrite += o.cacheWrite;
        inputTokens += o.inputTokens;
      }
    } else {
      const outcome = await runIdentify(r.source);
      payload = outcome.payload;
      cacheRead = outcome.cacheRead;
      cacheWrite = outcome.cacheWrite;
      inputTokens = outcome.inputTokens;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[identifyScan] vision error: ${message}`);
    return { ok: false, error: `Vision call failed: ${message}` };
  }
  const visionMs = Date.now() - visionStart;

  const pricingStart = Date.now();
  const pricings = await priceCards(
    payload.cards.map((c) => ({
      name: c.name,
      set: c.set,
      cardNumber: c.cardNumber,
      rarity: c.rarity,
    })),
  );
  const pricingMs = Date.now() - pricingStart;

  const pricedCards: PricedCard[] = payload.cards.map((card, i) => ({
    ...card,
    pricing: pricings[i],
  }));
  const totalValue = collectionTotalRawNm(pricings);
  const pricedCount = pricings.filter((p) => p.matched).length;

  console.log(
    `[identifyScan] user=${r.userId} mode=${useMulti ? "multi" : "single"} crops=${useMulti ? boxes.length : 1} identified=${payload.cards.length} priced=${pricedCount} total=$${totalValue} unidentified=${payload.unidentifiedCount} overallConfidence=${payload.overallConfidence} visionMs=${visionMs} pricingMs=${pricingMs} cache_read=${cacheRead} cache_write=${cacheWrite}`,
  );

  return {
    ok: true,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    mimeType: r.rawMime,
    latencyMs: visionMs,
    pricingMs,
    passes: useMulti ? "multi" : "single",
    detectedCount: detectedCount || payload.cards.length,
    cache: { read: cacheRead, written: cacheWrite, input: inputTokens },
    data: {
      cards: pricedCards,
      overallConfidence: payload.overallConfidence,
      unidentifiedCount: payload.unidentifiedCount,
      totalValue,
      pricedCount,
    },
  };
}
