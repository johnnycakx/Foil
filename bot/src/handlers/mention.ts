// @mention listener for the Foil ops bot.
//
// Triggers only on direct mentions of the bot user — quiet otherwise.
// Discord rate-limits message.edit() to ~5/5s per channel, so the
// progressive-edit hook below debounces hard.

import { Message, TextChannel } from "discord.js";
import { insertMessage } from "../db.ts";
import { handleConversation } from "./conversation.ts";

const EDIT_DEBOUNCE_MS = 1200; // safely under Discord's 5/5s edit budget
const DISCORD_MESSAGE_CHAR_CAP = 1900; // leave 100-char headroom under 2000

/** Strip a leading `<@BOT_ID>` (or `<@!BOT_ID>` legacy) and surrounding whitespace. */
export function stripMention(content: string, botUserId: string): string {
  // Both `<@123>` and `<@!123>` (legacy nickname) match.
  const re = new RegExp(`^<@!?${botUserId}>\\s*`, "g");
  return content.replace(re, "").trim();
}

export function isBotMentioned(message: Message, botUserId: string): boolean {
  if (message.author.bot) return false;
  // discord.js exposes mentions.users — index by user id
  return message.mentions.users.has(botUserId);
}

/**
 * Process a single @mention message. Inserts the user turn, drives the
 * conversation, streams the reply via progressive edits, then persists the
 * final assistant turn.
 */
export async function handleMention(
  message: Message,
  botUserId: string,
): Promise<void> {
  if (!isBotMentioned(message, botUserId)) return;

  const channelId = message.channelId;
  const channelName = (message.channel as TextChannel).name ?? null;
  const userId = message.author.id;
  const userMessage = stripMention(message.content, botUserId);

  if (!userMessage) {
    await message.reply("👋 Mention me with a question — I'm listening.");
    return;
  }

  // Persist the user turn BEFORE generating the reply so the conversation
  // builder on a subsequent turn sees it even if generation fails.
  await insertMessage({
    channelId,
    userId,
    role: "user",
    content: userMessage,
  });

  // Send a placeholder Discord message that we'll edit progressively.
  const placeholder = await message.reply("…");
  let lastEditAt = 0;
  let lastSent = "…";

  try {
    const result = await handleConversation({
      channelId,
      channelName,
      userMessage,
      onPartial: async (partial) => {
        const now = Date.now();
        if (now - lastEditAt < EDIT_DEBOUNCE_MS) return;
        const next = truncateForDiscord(partial);
        if (next === lastSent) return;
        lastEditAt = now;
        lastSent = next;
        try {
          await placeholder.edit(next);
        } catch {
          // Discord edit errors are non-fatal — final edit below will recover.
        }
      },
    });

    const finalText = truncateForDiscord(result.reply || "(no reply)");
    if (finalText !== lastSent) await placeholder.edit(finalText);

    await insertMessage({
      channelId,
      userId: botUserId,
      role: "assistant",
      content: result.reply,
    });

    console.log(
      `[mention] reply (${result.model}, ${result.toolCalls.length} tool calls) to #${channelName} in ${Date.now() - message.createdTimestamp}ms`,
    );
  } catch (err) {
    const errText = `⚠️ Error: ${(err as Error).message}`.slice(0, DISCORD_MESSAGE_CHAR_CAP);
    try {
      await placeholder.edit(errText);
    } catch {
      // ignore — last-resort fallback
    }
    console.warn("[mention] handler threw:", err);
  }
}

export function truncateForDiscord(text: string): string {
  if (text.length <= DISCORD_MESSAGE_CHAR_CAP) return text;
  const marker = "\n\n[…truncated for Discord]";
  return text.slice(0, DISCORD_MESSAGE_CHAR_CAP - marker.length) + marker;
}
