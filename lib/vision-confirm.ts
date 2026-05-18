import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";

// Visual tiebreaker. Sonnet 4.6 with multi-image input compares the user's
// crop against N PokeTrace reference images side-by-side. Used when text-only
// scoring is ambiguous (multiple candidates close together, or below the
// confident-match threshold).
export const CONFIRM_MODEL = "claude-sonnet-4-6";

export type ConfirmCandidate = {
  image: string; // PokeTrace image URL (or any HTTPS URL)
  name: string;
  set: string;
  collectorNumber: string;
};

export type ConfirmResult = {
  chosenIndex: number | null; // 0-based index into candidates, or null if no confident match
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

const CONFIRM_SCHEMA = {
  type: "object",
  properties: {
    chosenIndex: { type: ["integer", "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
  },
  required: ["chosenIndex", "confidence", "reasoning"],
  additionalProperties: false,
} as const;

const CONFIRM_SYSTEM_PROMPT = `You are comparing one user-uploaded photo of a Pokemon TCG card against N reference images of candidate cards. Your job: return the index of the reference image that depicts the SAME card as the user photo, or null if no reference matches confidently.

What "same card" means:
- Same Pokemon (or trainer / energy) name
- Same set (compare set symbol or printed set code)
- Same collector number
- Same variant / finish (if a reference is a Reverse Holo and the user's card is Normal, that's NOT the same SKU)

Comparison checklist — visually verify each:
1. Name text at top of card
2. Pokemon/character artwork and pose
3. Set symbol or 3-letter set code at bottom
4. Collector number (e.g. "004/165")
5. Rarity stars in bottom-left
6. Holographic / foil treatment (if both clearly show)
7. Frame style and border color (helps date the card)

Ignore these (they don't affect identity):
- Lighting, glare, shadows
- Camera angle, perspective skew
- Edge wear or surface scratches
- Sleeves or top-loader reflections
- Image resolution / compression artifacts

Confidence calibration:
- "high" — every checklist field matches between user photo and the chosen reference; no ambiguity
- "medium" — most fields match but at least one couldn't be verified (glare on number, off-angle on set symbol). Still your best pick.
- "low" — your pick is only marginally better than the alternatives; user should verify
- null — none of the references plausibly match; the user has a different card than any candidate

The user image is the FIRST image. The candidate references are the next N images, in order.

Output strict JSON: { "chosenIndex": <integer or null>, "confidence": "high" | "medium" | "low", "reasoning": "<one sentence>" }. No Markdown, no prose outside the JSON.`;

type Source =
  | { type: "url"; url: string }
  | {
      type: "base64";
      media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      data: string;
    };

// Sniff the real image format from magic bytes. CDN Content-Type headers are
// frequently wrong; Anthropic rejects mismatches.
function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // Default to jpeg — most permissive on the wire.
  return "image/jpeg";
}

async function userImageSource(userImage: string): Promise<Source> {
  // Accept three shapes for the user crop:
  //   1. data: URL — pull out media + data
  //   2. https URL — fetch and pass as base64 (sidesteps CDN hotlink policy)
  //   3. plain base64 JPEG — wrap as base64 source
  if (userImage.startsWith("data:")) {
    const m = userImage.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      return {
        type: "base64",
        media_type: m[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: m[2],
      };
    }
  }
  if (userImage.startsWith("http://") || userImage.startsWith("https://")) {
    const res = await fetch(userImage, {
      headers: { Accept: "image/webp,image/jpeg,image/png,*/*" },
    });
    if (!res.ok) throw new Error(`Failed to fetch user image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { type: "base64", media_type: sniffImage(buf), data: buf.toString("base64") };
  }
  return { type: "base64", media_type: "image/jpeg", data: userImage };
}

export async function confirmMatch(
  userCropDataUrl: string,
  candidates: ConfirmCandidate[],
): Promise<ConfirmResult> {
  if (candidates.length === 0) {
    return { chosenIndex: null, confidence: "low", reasoning: "No candidates supplied." };
  }

  const userSource = await userImageSource(userCropDataUrl);
  const candidateLines = candidates
    .map((c, i) => `  ${i + 1}. ${c.name} — ${c.set} #${c.collectorNumber}`)
    .join("\n");

  // Fetch each candidate image server-side and pass as base64. Anthropic's
  // image-by-URL ingestor sometimes rejects CDN images (User-Agent / hotlink
  // policy); base64 sidesteps that, and we'll cache these bytes downstream
  // anyway.
  const candidateBlocks: Anthropic.ContentBlockParam[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.image) continue;
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
    let base64: string;
    try {
      const res = await fetch(c.image, {
        headers: { Accept: "image/webp,image/jpeg,image/png,*/*" },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      mediaType = sniffImage(buf);
      base64 = buf.toString("base64");
    } catch (err) {
      console.warn(
        `[confirmMatch] failed to fetch candidate ${i + 1} image (${c.image}): ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }
    candidateBlocks.push({
      type: "text",
      text: `Reference ${i + 1}: ${c.name} (${c.set} #${c.collectorNumber})`,
    });
    candidateBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
  }

  const response = await anthropic().messages.create({
    model: CONFIRM_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: CONFIRM_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: { type: "json_schema", schema: CONFIRM_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `User's photo (first image) vs ${candidates.length} candidate references:\n${candidateLines}\n\nReturn the 0-based index of the reference that matches the user's card, or null if none match confidently.`,
          },
          { type: "image", source: userSource as Anthropic.ImageBlockParam["source"] },
          ...candidateBlocks,
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text) as ConfirmResult;
    // Defensive: chosenIndex must be in range or null.
    if (typeof parsed.chosenIndex === "number") {
      if (parsed.chosenIndex < 0 || parsed.chosenIndex >= candidates.length) {
        return { chosenIndex: null, confidence: "low", reasoning: `Out-of-range index returned: ${parsed.chosenIndex}` };
      }
    }
    return parsed;
  } catch {
    return { chosenIndex: null, confidence: "low", reasoning: "Confirmation model returned non-JSON." };
  }
}
