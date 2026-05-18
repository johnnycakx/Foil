"use server";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import {
  CARD_SCAN_SCHEMA,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
  type ScanPayload,
} from "@/lib/vision";

export type ScanResult =
  | {
      ok: true;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      latencyMs: number;
      cache: { read: number; written: number; input: number };
      data: ScanPayload;
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

  console.log(
    `[scanPhoto] user=${user.id} cards=${payload.cards.length} unidentified=${payload.unidentifiedCount} overallConfidence=${payload.overallConfidence} latencyMs=${latencyMs} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0}`,
  );

  return {
    ok: true,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    latencyMs,
    cache: {
      read: response.usage.cache_read_input_tokens ?? 0,
      written: response.usage.cache_creation_input_tokens ?? 0,
      input: response.usage.input_tokens,
    },
    data: payload,
  };
}
