"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import {
  CARD_SCAN_SCHEMA,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
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
      cache: { read: number; written: number; input: number };
      data: PricedScanPayload;
    }
  | { ok: false; error: string };

const SUPPORTED_MEDIA: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export async function scanPhoto(formData: FormData): Promise<ScanResult> {
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

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  console.log(
    `[scanPhoto] user=${user.id} name=${file.name} size=${file.size}B type=${file.type}`,
  );

  const start = Date.now();
  let response: Anthropic.Message;
  try {
    response = await anthropic().messages.create({
      model: VISION_MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: VISION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: CARD_SCAN_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Identify every Pokémon card visible in this photo and return the JSON described in your instructions.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scanPhoto] anthropic error: ${message}`);
    return { ok: false, error: `Vision call failed: ${message}` };
  }
  const latencyMs = Date.now() - start;

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let payload: ScanPayload;
  try {
    payload = JSON.parse(text) as ScanPayload;
  } catch {
    console.error(`[scanPhoto] non-JSON response: ${text.slice(0, 500)}`);
    return { ok: false, error: "Model returned non-JSON output." };
  }

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
    `[scanPhoto] user=${user.id} cards=${payload.cards.length} priced=${pricedCount} total=$${totalValue} unidentified=${payload.unidentifiedCount} overallConfidence=${payload.overallConfidence} visionMs=${latencyMs} pricingMs=${pricingMs} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0}`,
  );

  return {
    ok: true,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    latencyMs,
    pricingMs,
    cache: {
      read: response.usage.cache_read_input_tokens ?? 0,
      written: response.usage.cache_creation_input_tokens ?? 0,
      input: response.usage.input_tokens,
    },
    data: {
      cards: pricedCards,
      overallConfidence: payload.overallConfidence,
      unidentifiedCount: payload.unidentifiedCount,
      totalValue,
      pricedCount,
    },
  };
}
