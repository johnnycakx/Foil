// Channel-safety classification for content syndication (ADR-085).
//
// The load-bearing policy, encoded as data so it can't drift: auto-post ONLY to
// surfaces Foil OWNS or broadcasts to its own feed; NEVER auto-post into
// communities Foil doesn't own (subreddits, third-party Discords) — that's
// ban-risk and stays on the human weekly distribution kit.
//
// This is the POLICY layer ONLY. There is deliberately NO Postiz API code here:
// the syndication integration is parked pending Postiz setup (account + OAuth
// channel connection = John's hands) — see docs/runbooks/postiz-syndication-
// setup.md. When that ships, the tap reads `autoSafeChannels()` to decide where
// it may post, and `isAutoSafe()` is the default-deny gate (unknown → human).

export type ChannelSafety =
  /** Own feed / Foil-owned, no new account needed — auto-post is safe NOW. */
  | "auto_safe"
  /** Own account but it must be CREATED first (John) before auto-post — deferred. */
  | "auto_safe_needs_account"
  /** Someone else's community — auto-post = ban risk. NEVER auto; human only. */
  | "human_only";

export type ChannelTransport = "x_api" | "postiz" | "discord_webhook" | "telegram_bot" | "manual_paste";

export type SyndicationChannel = {
  key: string;
  label: string;
  safety: ChannelSafety;
  /** How a post would reach it once the integration is built. */
  transport: ChannelTransport;
  note: string;
};

export const SYNDICATION_CHANNELS: readonly SyndicationChannel[] = [
  {
    key: "x",
    label: "X / Twitter",
    safety: "auto_safe",
    transport: "x_api",
    note: "Already live, direct via lib/social/x-client.ts (NOT Postiz).",
  },
  {
    key: "bluesky",
    label: "Bluesky",
    safety: "auto_safe",
    transport: "postiz",
    note: "Own feed; free; the primary net-new Postiz target.",
  },
  { key: "threads", label: "Threads", safety: "auto_safe", transport: "postiz", note: "Own feed." },
  { key: "mastodon", label: "Mastodon", safety: "auto_safe", transport: "postiz", note: "Own feed." },
  {
    key: "telegram_owned",
    label: "Foil-owned Telegram channel",
    safety: "auto_safe",
    transport: "telegram_bot",
    note: "Broadcast to our own channel; John creates the channel once.",
  },
  {
    key: "discord_owned",
    label: "Foil-owned Discord announce channel",
    safety: "auto_safe",
    transport: "discord_webhook",
    note: "Already auto-postable via lib/notifications/discord.ts — no Postiz needed.",
  },
  {
    key: "instagram",
    label: "Instagram",
    safety: "auto_safe_needs_account",
    transport: "postiz",
    note: "Own account, but John must create FoilTCG IG first.",
  },
  {
    key: "tiktok",
    label: "TikTok",
    safety: "auto_safe_needs_account",
    transport: "postiz",
    note: "Own account, but John must create it first; the MP4 is the asset.",
  },
  {
    key: "linkedin",
    label: "John's personal LinkedIn profile",
    safety: "human_only",
    transport: "manual_paste",
    note:
      "PERSONAL profile (John's call, 2026-07-14 — retargeted off the company page): " +
      "the paste rail generates the caption (lib/social/linkedin-caption.ts), John posts " +
      "it himself. Human-posted FOREVER — authenticity is the point; no LinkedIn API " +
      "client may be added without a new policy decision.",
  },
  {
    key: "reddit",
    label: "Subreddits (r/pkmntcgdeals, r/PokeInvesting)",
    safety: "human_only",
    transport: "postiz",
    note: "Others' communities; strict self-promo rules; BAN RISK — human weekly kit only.",
  },
  {
    key: "discord_thirdparty",
    label: "Third-party Discord servers",
    safety: "human_only",
    transport: "postiz",
    note: "Others' communities; BAN RISK — human only.",
  },
];

/** Channels we may auto-post to NOW (own feed / Foil-owned, no new account). */
export function autoSafeChannels(): SyndicationChannel[] {
  return SYNDICATION_CHANNELS.filter((c) => c.safety === "auto_safe");
}

/**
 * The default-deny gate: only an explicitly `auto_safe` channel returns true.
 * An unknown key, a `human_only` community, or an account-not-yet-created
 * channel ALL return false — so the syndication tap can never auto-post into a
 * community or a surface that isn't ready, even by mistake.
 */
export function isAutoSafe(key: string): boolean {
  return SYNDICATION_CHANNELS.find((c) => c.key === key)?.safety === "auto_safe";
}
