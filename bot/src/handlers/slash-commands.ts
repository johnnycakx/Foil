// Slash command surface for the Foil ops bot.
//
// /reset       — clear all bot_messages for this channel
// /recall <q>  — top-5 semantic recall over the channel's history
// /help        — list tools + commands
//
// Registered on startup via REST API. Discord rate-limits global command
// registration to 200/day; we register guild-scoped instead to make new
// commands appear instantly during dev.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { resetChannel, semanticSearchMessages } from "../db.ts";
import { TOOL_DEFINITIONS } from "../tools/index.ts";
import { IDEA_CATEGORIES, parseIdeasFile, type IdeaCategory } from "../system-prompt.ts";

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
    .setName("ideas")
    .setDescription("Show the 10 most-recent captured ideas from docs/IDEAS.md.")
    .addStringOption((opt) =>
      opt
        .setName("category")
        .setDescription("Filter to a single category")
        .setRequired(false)
        .addChoices(...IDEA_CATEGORIES.map((c) => ({ name: c, value: c }))),
    ),
  new SlashCommandBuilder()
    .setName("approve")
    .setDescription("Approve the pending X post draft with this id — posts it to X. Owner only.")
    .addStringOption((opt) =>
      opt.setName("id").setDescription("The draft id from the #content-engine approval message").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the pending X post draft with this id — it is never posted. Owner only.")
    .addStringOption((opt) =>
      opt.setName("id").setDescription("The draft id from the #content-engine approval message").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("List my tools and slash commands."),
].map((c) => c.toJSON());

/**
 * Which guilds to register commands to. Guild-scoped registration is INSTANT,
 * whereas global registration takes ~1h to propagate AND the stale set lingers
 * until it does (which is why a new `/approve` looked "not registered"). So
 * prefer guild-scoped: an explicit `DISCORD_GUILD_ID` wins; otherwise register
 * to every guild the bot is currently in (the ops bot lives in one private
 * server, so this needs no extra config). An empty result tells the caller to
 * fall back to global registration. Pure + unit-tested.
 */
export function resolveRegistrationGuildIds(
  explicitGuildId: string | undefined,
  joinedGuildIds: string[],
): string[] {
  const explicit = explicitGuildId?.trim();
  if (explicit) return [explicit];
  return joinedGuildIds;
}

/**
 * Register the slash commands on startup. Registers GUILD-SCOPED (instant) to the
 * bot's joined guild(s) by default — `client.guilds.cache` is populated by the
 * time ClientReady fires — so newly-added commands (e.g. `/approve` + `/skip`)
 * appear immediately on deploy, with no ~1h global-propagation lag. Set
 * `DISCORD_GUILD_ID` to pin a single guild; if no guild is known it falls back
 * to global registration. Soft-fails (logs, never throws).
 */
export async function registerSlashCommands(client: Client): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APPLICATION_ID;
  if (!token || !appId) {
    console.warn("[slash] DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID missing — skipping command registration");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  const guildIds = resolveRegistrationGuildIds(process.env.DISCORD_GUILD_ID, [...client.guilds.cache.keys()]);
  try {
    if (guildIds.length > 0) {
      for (const gid of guildIds) {
        await rest.put(Routes.applicationGuildCommands(appId, gid), { body: COMMAND_DEFS });
      }
      console.log(`[slash] registered ${COMMAND_DEFS.length} command(s) to ${guildIds.length} guild(s): ${guildIds.join(", ")}`);
    } else {
      // No guild in cache (shouldn't happen post-ClientReady) → global (~1h).
      await rest.put(Routes.applicationCommands(appId), { body: COMMAND_DEFS });
      console.log(`[slash] registered ${COMMAND_DEFS.length} command(s) globally (no guilds in cache)`);
    }
  } catch (err) {
    console.warn("[slash] command registration failed:", (err as Error).message);
  }
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "reset":
      return resetHandler(interaction);
    case "recall":
      return recallHandler(interaction);
    case "ideas":
      return ideasHandler(interaction);
    case "approve":
      return approvalHandler(interaction, "approve");
    case "skip":
      return approvalHandler(interaction, "skip");
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

async function ideasHandler(interaction: ChatInputCommandInteraction): Promise<void> {
  const category = interaction.options.getString("category") as IdeaCategory | null;
  const ideasPath = process.env.IDEAS_PATH ?? path.resolve(process.cwd(), "..", "docs", "IDEAS.md");
  let raw = "";
  try {
    if (existsSync(ideasPath)) raw = readFileSync(ideasPath, "utf8");
  } catch {
    // ignore — fall through to empty handling
  }
  const parsed = parseIdeasFile(raw);
  const filtered = parsed.filter(
    (e) => e.status === "captured" && (!category || e.category === category),
  );
  const top = filtered.slice(0, 10);
  if (top.length === 0) {
    await interaction.reply({
      content: category
        ? `No captured ideas in category \`${category}\`. Try \`/ideas\` for the full backlog.`
        : `No captured ideas yet. Add one to \`docs/IDEAS.md\`.`,
      ephemeral: true,
    });
    return;
  }
  const heading = category
    ? `**Top ${top.length} captured ideas — \`[${category}]\`**`
    : `**Top ${top.length} captured ideas** (across all categories)`;
  const lines = top.map((e, i) => `**${i + 1}.** \`[${e.category}]\` ${e.title} _(${e.date})_`);
  const text = [heading, "", ...lines].join("\n").slice(0, 1900);
  await interaction.reply({ content: text, ephemeral: true });
}

/**
 * Fail-closed owner check for the X approval commands. ONLY the configured owner
 * may approve/skip. If X_BOT_OWNER_DISCORD_ID is unset, NO ONE qualifies (safe
 * default — better a locked-out owner than an open approval surface).
 */
export function isApprovalOwner(userId: string, ownerId: string | undefined): boolean {
  return !!ownerId && userId === ownerId;
}

export type ApprovalEndpointResult =
  | { ok: true; action: string; postId?: string }
  | { ok: false; error: string; status?: number };

/**
 * Relay the owner's decision to the Foil app's /api/x/approve endpoint — the
 * single X boundary lives there (the bot never calls the X API itself). Bearer
 * X_APPROVE_SECRET. Injectable appUrl/secret/fetch for tests.
 */
export async function callApprovalEndpoint(
  action: "approve" | "skip",
  id: string,
  actor: string,
  deps: { appUrl?: string; secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<ApprovalEndpointResult> {
  const appUrl = (deps.appUrl ?? process.env.FOIL_APP_URL ?? "https://foiltcg.com").replace(/\/+$/, "");
  const secret = deps.secret ?? process.env.X_APPROVE_SECRET;
  if (!secret) return { ok: false, error: "X_APPROVE_SECRET not configured" };
  const fetchFn = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(`${appUrl}/api/x/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ id, action, actor }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && json.ok === true) {
      return { ok: true, action: String(json.action ?? action), postId: json.postId as string | undefined };
    }
    return { ok: false, error: String(json.error ?? `http_${res.status}`), status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function approvalHandler(
  interaction: ChatInputCommandInteraction,
  action: "approve" | "skip",
): Promise<void> {
  if (!isApprovalOwner(interaction.user.id, process.env.X_BOT_OWNER_DISCORD_ID)) {
    await interaction.reply({ content: "Only the configured owner can approve or skip X posts.", ephemeral: true });
    return;
  }
  const id = interaction.options.getString("id", true).trim();
  await interaction.deferReply({ ephemeral: true });
  const result = await callApprovalEndpoint(action, id, interaction.user.tag);
  if (result.ok) {
    await interaction.editReply(
      result.action === "posted"
        ? `Posted to X.${result.postId ? ` Post id \`${result.postId}\`.` : ""}`
        : `Draft \`${id}\` skipped — it will not be posted.`,
    );
    return;
  }
  await interaction.editReply(`Could not ${action} draft \`${id}\`: ${result.error}`);
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
    `• \`/ideas [category]\` — top-10 captured ideas from docs/IDEAS.md (optionally filtered).`,
    `• \`/approve <id>\` — (owner) approve a pending X post draft → posts it to X.`,
    `• \`/skip <id>\` — (owner) skip a pending X post draft → never posted.`,
    `• \`/help\` — this list.`,
    ``,
    `**Tools available to me**`,
    toolList,
  ].join("\n");
  await interaction.reply({ content: text, ephemeral: true });
}
