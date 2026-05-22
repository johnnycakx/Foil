// Wires a single @mention turn end-to-end:
//   1. Fetch last 50 channel messages from Postgres (context).
//   2. Build the Foil-grounded system prompt for this channel's persona.
//   3. Call Anthropic with the tools[] surface and cache the system + grounding.
//   4. Walk the tool-use loop until the model emits a final text response.
//   5. Stream partial text into the on-Discord placeholder via progressive edits.
//
// Model selection: default claude-opus-4-5 — long-context reasoning on Foil
// docs is what we're paying for here. If the user's message starts with
// "/sonnet" we strip the prefix and use claude-sonnet-4-6 for that turn —
// roughly 5× cheaper and 2× faster for "ping"-shaped questions.

import Anthropic from "@anthropic-ai/sdk";
import { getRecentChannelMessages } from "../db.ts";
import { buildSystemPrompt } from "../system-prompt.ts";
import { TOOL_DEFINITIONS, executeTool } from "../tools/index.ts";

const DEFAULT_MODEL = "claude-opus-4-5";
const SONNET_MODEL = "claude-sonnet-4-6";
const SONNET_PREFIX = "/sonnet";
const MAX_TOOL_ROUNDS = 6;
const MAX_OUTPUT_TOKENS = 2048;

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

export function __setAnthropicForTests(client: Anthropic | null): void {
  anthropicClient = client;
}

export type ConversationInput = {
  channelId: string;
  channelName: string | null;
  /** User-authored content for this turn — with the @mention already stripped. */
  userMessage: string;
  /** Optional progressive-edit hook fired as text streams in. */
  onPartial?: (text: string) => Promise<void> | void;
};

export type ConversationResult = {
  reply: string;
  model: string;
  toolCalls: string[];
};

/**
 * Default entry point used by the @mention handler. Drives the tool loop +
 * streams partial output. Returns the final reply text so the caller can
 * persist it to bot_messages.
 */
export async function handleConversation(input: ConversationInput): Promise<ConversationResult> {
  const { userMessage, sonnetOverride } = parseSonnetPrefix(input.userMessage);
  const model = sonnetOverride ? SONNET_MODEL : DEFAULT_MODEL;

  const recent = await getRecentChannelMessages(input.channelId, 50);
  const conversation: Anthropic.MessageParam[] = recent.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  conversation.push({ role: "user", content: userMessage });

  const systemPrompt = buildSystemPrompt({ channelName: input.channelName });

  // Anthropic's cache_control marks the system + tools block as cacheable so
  // subsequent turns within ~5 minutes get the discount. The grounding docs
  // are the largest static chunk we send each turn.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  ];

  const client = getAnthropic();
  const toolCalls: string[] = [];
  let lastText = "";
  let partialBuffer = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const streamingOn = !!input.onPartial;
    const requestPayload: Anthropic.MessageCreateParams = {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      tools: TOOL_DEFINITIONS,
      messages: conversation,
    };

    let finalMessage: Anthropic.Message;
    if (streamingOn) {
      const stream = client.messages.stream(requestPayload);
      stream.on("text", (chunk) => {
        partialBuffer += chunk;
        // Fire-and-forget — the handler debounces internally.
        Promise.resolve(input.onPartial?.(partialBuffer)).catch(() => {});
      });
      finalMessage = await stream.finalMessage();
    } else {
      finalMessage = (await client.messages.create({
        ...requestPayload,
        stream: false,
      })) as Anthropic.Message;
    }

    // Collect any text blocks in the assistant's response — they're the
    // "running commentary" the model emitted alongside its tool_use blocks.
    const textBlocks = finalMessage.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    if (textBlocks.length) {
      lastText = textBlocks.map((b) => b.text).join("\n").trim();
    }

    if (finalMessage.stop_reason !== "tool_use") {
      // Model is done. lastText is the final reply.
      return { reply: lastText, model, toolCalls };
    }

    // Tool-use loop: append assistant message, run tools, append tool results,
    // then continue.
    conversation.push({ role: "assistant", content: finalMessage.content });
    const toolUses = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      toolCalls.push(use.name);
      const result = await executeTool(use.name, (use.input ?? {}) as Record<string, unknown>);
      toolResults.push({ type: "tool_result", tool_use_id: use.id, content: result });
    }
    conversation.push({ role: "user", content: toolResults });
    partialBuffer = ""; // reset for the next round
  }

  // Tool-rounds budget exceeded. Return whatever we have.
  return {
    reply: lastText || `(Tool loop exceeded ${MAX_TOOL_ROUNDS} rounds without a final reply.)`,
    model,
    toolCalls,
  };
}

export function parseSonnetPrefix(message: string): { userMessage: string; sonnetOverride: boolean } {
  const trimmed = message.trim();
  if (trimmed.toLowerCase().startsWith(SONNET_PREFIX)) {
    return {
      userMessage: trimmed.slice(SONNET_PREFIX.length).trim() || "(empty message)",
      sonnetOverride: true,
    };
  }
  return { userMessage: trimmed, sonnetOverride: false };
}
