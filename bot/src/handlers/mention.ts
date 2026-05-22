// @mention listener for the Foil ops bot.
//
// Triggers only on direct mentions of the bot user — quiet otherwise.
// Discord rate-limits message.edit() to ~5/5s per channel, so the
// progressive-edit hook below debounces hard.
//
// Long replies are split across multiple messages by `message-splitter.ts`
// (Discord caps a single message at 2000 chars). During streaming we cut at
// the same boundaries the final split would use, send each finalized chunk
// as a new message with a "(continued ↓)" cue, then rewrite all chunks with
// definitive "N/M " prefixes once the model is done.

import { Message, TextChannel, type SendableChannels } from "discord.js";
import { insertMessage } from "../db.ts";
import { handleConversation } from "./conversation.ts";
import {
  CONTINUATION_MARKER,
  DISCORD_CHUNK_LIMIT,
  findSplitPoint,
  splitForDiscord,
  withChunkPrefixes,
} from "./message-splitter.ts";

const EDIT_DEBOUNCE_MS = 1200; // safely under Discord's 5/5s edit budget

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
  const chunks: Message[] = [placeholder];
  // Total chars of `partial` that have been "committed" to prior chunk
  // messages. Everything after this index renders into chunks[last].
  let committedLength = 0;
  let lastEditAt = 0;
  let lastSent = "…";

  try {
    const result = await handleConversation({
      channelId,
      channelName,
      userMessage,
      onPartial: async (partial) => {
        const now = Date.now();
        let current = partial.slice(committedLength);

        // If the live chunk overflowed, lock it in and open a new placeholder.
        // We do this UNCONDITIONALLY of the debounce — the cut is durable;
        // the subsequent live edits go back to being debounced.
        if (current.length > DISCORD_CHUNK_LIMIT) {
          const cut = findSplitPoint(current, DISCORD_CHUNK_LIMIT);
          const finalizedText = current.slice(0, cut).trimEnd();
          const live = chunks[chunks.length - 1];
          try {
            await live.edit(finalizedText + CONTINUATION_MARKER);
          } catch {
            // ignore; finalization pass will rewrite this anyway
          }
          try {
            const next = await (message.channel as SendableChannels).send("…");
            chunks.push(next);
          } catch {
            // If we can't open a new chunk, give up streaming the rest;
            // finalize() will send the missing chunks as new messages.
          }
          committedLength += cut;
          current = partial.slice(committedLength);
          lastEditAt = now;
          lastSent = "…";
        }

        if (now - lastEditAt < EDIT_DEBOUNCE_MS) return;
        const next = current.length ? current : "…";
        if (next === lastSent) return;
        lastEditAt = now;
        lastSent = next;
        try {
          await chunks[chunks.length - 1].edit(next);
        } catch {
          // Discord edit errors are non-fatal — finalize() will recover.
        }
      },
    });

    await finalizeChunks(chunks, message, result.reply || "(no reply)");

    await insertMessage({
      channelId,
      userId: botUserId,
      role: "assistant",
      content: result.reply,
    });

    console.log(
      `[mention] reply (${result.model}, ${result.toolCalls.length} tool calls, ${chunks.length} chunks) to #${channelName} in ${Date.now() - message.createdTimestamp}ms`,
    );
  } catch (err) {
    const errText = `⚠️ Error: ${(err as Error).message}`.slice(0, DISCORD_CHUNK_LIMIT);
    try {
      await chunks[chunks.length - 1].edit(errText);
    } catch {
      // ignore — last-resort fallback
    }
    console.warn("[mention] handler threw:", err);
  }
}

/**
 * Re-split the full reply for definitive numbering and update every chunk.
 * Edits existing chunk messages in-place; sends new ones if the final split
 * yields more chunks than streaming created.
 */
export async function finalizeChunks(
  chunks: Message[],
  origin: Message,
  reply: string,
): Promise<void> {
  const final = withChunkPrefixes(splitForDiscord(reply));
  for (let i = 0; i < final.length; i++) {
    if (i < chunks.length) {
      try {
        await chunks[i].edit(final[i]);
      } catch {
        // ignore — best-effort
      }
    } else {
      try {
        const m = await (origin.channel as SendableChannels).send(final[i]);
        chunks.push(m);
      } catch {
        // ignore — best-effort
      }
    }
  }
  // If streaming over-shot (sent more placeholders than the final split
  // produced), blank the excess so they don't show "…" forever. In practice
  // this should be rare — the streaming cut and the final cut use the same
  // splitter — but guard against it.
  for (let i = final.length; i < chunks.length; i++) {
    try {
      await chunks[i].edit("*(continued above)*");
    } catch {
      // ignore
    }
  }
}

/**
 * @deprecated kept exported for the existing unit test; new code should
 * call `splitForDiscord` instead. Truncates a single message at the
 * Discord chunk limit with a tail marker.
 */
export function truncateForDiscord(text: string): string {
  if (text.length <= DISCORD_CHUNK_LIMIT) return text;
  const marker = "\n\n[…truncated for Discord]";
  return text.slice(0, DISCORD_CHUNK_LIMIT - marker.length) + marker;
}
