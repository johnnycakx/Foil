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
  const candidates = failure.topCandidates?.length
    ? failure.topCandidates
        .map((c) => `  - "${c.name}" — ${c.set} #${c.cardNumber} (${c.variant})`)
        .join("\n")
    : "";

  return [
    "You are reviewing a previous failed identification of a single Pokémon TCG card.",
    "Below is the same crop again, the previous attempt's output, and the concrete reason the database lookup failed.",
    "Reconsider carefully — focus on the set symbol icon and the printed card number.",
    "",
    "PREVIOUS ATTEMPT:",
    `  name: ${prev.name}`,
    `  set: ${prev.set}`,
    `  cardNumber: ${prev.cardNumber}`,
    `  rarity: ${prev.rarity}`,
    `  conditionEstimate: ${prev.conditionEstimate}`,
    `  confidence: ${prev.confidence}`,
    "",
    "WHY THE LOOKUP FAILED:",
    failure.message,
    "",
    candidates ? `Nearest valid PokeTrace candidates by name:\n${candidates}\n` : "",
    "INSTRUCTIONS:",
    "- If you are confident about the Pokémon name, preserve it. Otherwise correct it.",
    "- Focus on the SET. Look at the set symbol icon at the bottom of the artwork window — refer to 'Modern set symbols' in your system prompt.",
    "- The card number's T (denominator) must equal the set's known size. Cross-reference 'Recent set sizes'. If they disagree, you have the wrong set.",
    "- If multiple sets remain plausible after this second look, return your best calibrated guess with confidence between 50 and 75 — never 90+ on a guess.",
    "- If the printed number you originally read is impossible for any candidate set, you misread a digit; squint at the card.",
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
