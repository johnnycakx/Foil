import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";
import {
  CARD_SCAN_SCHEMA,
  VISION_SYSTEM_PROMPT,
  type IdentifiedCard,
  type ScanPayload,
} from "./vision.ts";
import type { Failure } from "./poketrace.ts";

// Higher-accuracy retry pass. Sonnet 4.6 ran the first pass; this one calls
// Opus 4.5 with the original crop + concrete PokeTrace failure context.
export const RETRY_MODEL = "claude-opus-4-5";

type Source = {
  type: "base64";
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
};

export type RetryOutcome = {
  card: IdentifiedCard | null;
  cacheRead: number;
  cacheWrite: number;
  inputTokens: number;
  outputTokens: number;
};

function buildRetryPrompt(prev: IdentifiedCard, failure: Failure): string {
  const candidates = failure.topCandidates.length
    ? failure.topCandidates
        .map((c) => `  - "${c.name}" — ${c.set} (slug: ${c.setSlug}) #${c.cardNumber} (${c.variant})`)
        .join("\n")
    : "";

  const legible: string[] = [];
  if (prev.name) legible.push(`name: ${prev.name}`);
  if (prev.hp) legible.push(`hp: ${prev.hp}`);
  if (prev.collectorNumber) legible.push(`collectorNumber: ${prev.collectorNumber}`);
  if (prev.setCode) legible.push(`setCode: ${prev.setCode}`);
  if (prev.setCodeRaw) legible.push(`setCodeRaw: ${prev.setCodeRaw}`);
  if (prev.regulationMark) legible.push(`regulationMark: ${prev.regulationMark}`);
  if (prev.rarity) legible.push(`rarity: ${prev.rarity}`);
  if (prev.illustrator) legible.push(`illustrator: ${prev.illustrator}`);
  if (prev.variant) legible.push(`variant: ${prev.variant}`);
  if (prev.language) legible.push(`language: ${prev.language}`);

  return [
    "You are reviewing a previous failed identification of a single Pokémon TCG card.",
    "The previous attempt was structurally complete but the PokeTrace database couldn't find a price match.",
    "Look at the crop again and reconsider — focus on what is PRINTED on the card, not the artwork.",
    "",
    "PREVIOUS ATTEMPT (only legible fields shown):",
    legible.length > 0 ? legible.map((l) => `  ${l}`).join("\n") : "  (no fields read)",
    "",
    "WHY THE LOOKUP FAILED:",
    failure.message,
    "",
    candidates ? `Nearest PokeTrace candidates by name (one of these may be correct — verify against the card):\n${candidates}\n` : "",
    "INSTRUCTIONS — choose one of:",
    "  (a) The same card with a corrected setCode, collectorNumber, or both — if you can now read the previously-missed field on the crop.",
    "  (b) One of the PokeTrace candidates above, IF its name, set, and number visually match the crop. Verify the set symbol and number.",
    "  (c) Decline. Return status: \"insufficient_information\" with an insufficientReason. Do NOT invent fields.",
    "",
    "Hard rules carry over from the system prompt: null means unreadable. Never fabricate a number or set code. The crop's collector number is the source of truth — if it conflicts with every candidate, mark insufficient_information.",
    "",
    "Return JSON conforming to the same schema as the original — a single card in the cards array.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export async function retryIdentify(
  source: Source,
  previous: IdentifiedCard,
  failure: Failure,
): Promise<RetryOutcome> {
  const prompt = buildRetryPrompt(previous, failure);

  const response = await anthropic().messages.create({
    model: RETRY_MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: VISION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    output_config: { format: { type: "json_schema", schema: CARD_SCAN_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let payload: ScanPayload;
  try {
    payload = JSON.parse(text) as ScanPayload;
  } catch {
    return {
      card: null,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  return {
    card: payload.cards[0] ?? null,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
