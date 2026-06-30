// Foil HQ ops bot — entry point.
//
// Boots discord.js, loads env, registers slash commands, then wires the
// messageCreate + interactionCreate events to the handlers in ./handlers/.
//
// Single-process deploy (Railway). No PM2 / cluster — discord.js maintains
// its own websocket connection; one process is sufficient until ops volume
// blows past tens of QPS, which is years away for our scale.

import "dotenv/config";
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { handleMention } from "./handlers/mention.ts";
import { handleSlashCommand, registerSlashCommands } from "./handlers/slash-commands.ts";
import { handleEngagementButton, startEngagementBriefPoller } from "./engagement/handler.ts";

const REQUIRED_ENV = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_APPLICATION_ID",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[boot] missing required env var: ${key}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Partials let us receive messageCreate events for uncached messages —
  // matters in low-traffic channels where the message wasn't seen during the
  // current process lifetime.
  partials: [Partials.Message, Partials.Channel],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[boot] online as ${c.user.tag} (id=${c.user.id})`);
  await registerSlashCommands(c);
  // Arm the engagement-brief delivery poller (ADR-086 v2). No-op until
  // ENGAGEMENT_BRIEF_CHANNEL_ID is set — the bot, not the webhook, posts the
  // brief because only an app-owned message can carry working Skip/Post buttons.
  startEngagementBriefPoller(c);
});

client.on(Events.MessageCreate, async (message) => {
  if (!client.user) return;
  await handleMention(message, client.user.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Engagement-brief Skip/Post buttons (ADR-086 v2). The handler ignores any
  // button that isn't ours, owner-gates the rest, and NEVER posts to X.
  if (interaction.isButton()) {
    try {
      await handleEngagementButton(interaction);
    } catch (err) {
      console.warn("[interaction] button handler threw:", err);
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleSlashCommand(interaction);
  } catch (err) {
    console.warn("[interaction] handler threw:", err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: `Error: ${(err as Error).message}`, ephemeral: true });
      } catch {
        // ignore
      }
    }
  }
});

client.on(Events.Error, (err) => {
  console.warn("[client] discord.js error:", err);
});

await client.login(process.env.DISCORD_BOT_TOKEN);
