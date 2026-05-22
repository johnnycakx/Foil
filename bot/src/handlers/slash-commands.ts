// Slash command surface for the Foil ops bot.
//
// /reset       — clear all bot_messages for this channel
// /recall <q>  — top-5 semantic recall over the channel's history
// /help        — list tools + commands
//
// Registered on startup via REST API. Discord rate-limits global command
// registration to 200/day; we register guild-scoped instead to make new
// commands appear instantly during dev.

import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { resetChannel, semanticSearchMessages } from "../db.ts";
import { TOOL_DEFINITIONS } from "../tools/index.ts";

export const COMMAND_DEFS = [
  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Clear my memory for this channel — every past message in #channel is forgotten."),
  new SlashCommandBuilder()
    .setName("recall")
    .setDescription("Semantic recall over my channel history. Returns the top 5 hits.")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("What to look up across past messages").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("List my tools and slash commands."),
].map((c) => c.toJSON());

/**
 * Register the slash commands. If a guild id is provided, registers
 * guild-scoped (instant); otherwise registers globally (1-hour propagation).
 *
 * Pass DISCORD_GUILD_ID via env to scope commands to your dev server.
 */
export async function registerSlashCommands(client: Client): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APPLICATION_ID;
  if (!token || !appId) {
    console.warn("[slash] DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID missing — skipping command registration");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = process.env.DISCORD_GUILD_ID;
  const route = guildId ? Routes.applicationGuildCommands(appId, guildId) : Routes.applicationCommands(appId);
  try {
    await rest.put(route, { body: COMMAND_DEFS });
    console.log(`[slash] registered ${COMMAND_DEFS.length} command(s) ${guildId ? `to guild ${guildId}` : "globally"}`);
  } catch (err) {
    console.warn("[slash] command registration failed:", (err as Error).message);
  }
  // Reference `client` so eslint doesn't complain — discord.js doesn't require
  // it for REST registration but accepting it keeps the API parallel to handlers.
  void client;
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "reset":
      return resetHandler(interaction);
    case "recall":
      return recallHandler(interaction);
    case "help":
      return helpHandler(interaction);
    default:
      await interaction.reply({ content: `Unknown command: ${interaction.commandName}`, ephemeral: true });
  }
}

async function resetHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const count = await resetChannel(interaction.channelId);
  await interaction.editReply(`Cleared ${count} message${count === 1 ? "" : "s"} from this channel's memory.`);
}

async function recallHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("query", true);
  await interaction.deferReply({ ephemeral: true });
  const hits = await semanticSearchMessages(interaction.channelId, query, 5);
  if (hits.length === 0) {
    await interaction.editReply(`No matches for "${query}".`);
    return;
  }
  const lines = hits.map((h, idx) => {
    const when = new Date(h.created_at).toISOString().replace("T", " ").slice(0, 16);
    const preview = h.content.length > 240 ? h.content.slice(0, 240) + "…" : h.content;
    return `**${idx + 1}.** [${h.role} · ${when} · sim=${h.similarity.toFixed(2)}]\n${preview}`;
  });
  // Cap to ~1900 chars to fit a single Discord message.
  const out = `Recall for "${query}":\n\n${lines.join("\n\n")}`.slice(0, 1900);
  await interaction.editReply(out);
}

async function helpHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  const toolList = TOOL_DEFINITIONS.map(
    (t) => `• \`${t.name}\` — ${(t.description ?? "").split(". ")[0]}.`,
  ).join("\n");
  const text = [
    `**Foil ops bot — help**`,
    ``,
    `**Mention me** with a question and I'll reply with Foil docs grounding. Prefix with \`/sonnet\` (e.g. \`@bot /sonnet ping\`) to use Sonnet 4.6 instead of Opus 4.5 for cheap quick replies.`,
    ``,
    `**Slash commands**`,
    `• \`/reset\` — wipe my memory for this channel.`,
    `• \`/recall <query>\` — top-5 semantic recall over my channel history.`,
    `• \`/help\` — this list.`,
    ``,
    `**Tools available to me**`,
    toolList,
  ].join("\n");
  await interaction.reply({ content: text, ephemeral: true });
}
