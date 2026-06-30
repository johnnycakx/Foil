// Shared Discord webhook poster. Every outbound notification (#deploys,
// #content-engine, #subscribers, #errors) routes through here. See ADR-014.
//
// Two architectural rules this module enforces:
//   1. Soft-fail. Notifications must NEVER block business logic — a Discord
//      outage cannot undo a blog publish or a subscribe. Every failure path
//      logs and returns; no throws escape.
//   2. Single import boundary. Other modules in this repo import postWebhook
//      / postEmbed from this file, never raw `fetch("https://discord.com/...")`.
//      Audit grep: if "discord.com/api/webhooks" appears anywhere except
//      here + .env.local + ENV-VARS.md, that's the regression.
//
// Discord rate limits webhook POSTs to ~30 messages / channel / minute.
// We retry on 429 and 5xx with exponential backoff capped at 3 attempts.

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const DISCORD_USERNAME = "Foil Ops";

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
};

export type PostWebhookInput = {
  webhookUrl: string;
  content?: string;
  embeds?: DiscordEmbed[];
  /** Optional override for tests — injects a custom fetch impl. */
  fetchImpl?: typeof fetch;
};

export type PostWebhookResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

/**
 * POST a payload to a Discord webhook URL. Soft-fail. Always resolves; never
 * throws. Use postEmbed / postError below for shaped helpers.
 */
export async function postWebhook(input: PostWebhookInput): Promise<PostWebhookResult> {
  if (!input.webhookUrl) {
    return { ok: false, error: "missing_webhook_url" };
  }
  if (!input.content && (!input.embeds || input.embeds.length === 0)) {
    return { ok: false, error: "empty_payload" };
  }

  const fetchFn = input.fetchImpl ?? fetch;
  // Suppress ALL mention parsing (ADR-086 security fix): untrusted content can
  // flow into `content` (e.g. an X post's text in the engagement brief), and no
  // Foil webhook ever intends to @-ping anyone. This is Discord's authoritative
  // control against @everyone/@here/role-mention injection through our webhooks.
  const body: Record<string, unknown> = { username: DISCORD_USERNAME, allowed_mentions: { parse: [] } };
  if (input.content) body.content = input.content;
  if (input.embeds && input.embeds.length) body.embeds = input.embeds;

  let lastStatus: number | undefined;
  let lastError = "unknown";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchFn(input.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      lastStatus = response.status;
      if (response.ok) return { ok: true, status: response.status };

      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === MAX_RETRIES - 1) {
        const errText = await safeText(response);
        lastError = `HTTP ${response.status}: ${errText.slice(0, 200)}`;
        break;
      }

      // 429: respect Discord's retry_after if present, else exponential.
      let waitMs = RETRY_BASE_MS * Math.pow(2, attempt);
      if (response.status === 429) {
        try {
          const json = (await response.clone().json()) as { retry_after?: number };
          if (typeof json.retry_after === "number") {
            waitMs = Math.max(waitMs, Math.ceil(json.retry_after * 1000));
          }
        } catch {
          // Body didn't parse — fall back to exponential.
        }
      }
      await new Promise((r) => setTimeout(r, waitMs));
    } catch (err) {
      lastError = (err as Error).message;
      if (attempt === MAX_RETRIES - 1) break;
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }

  // eslint-disable-next-line no-console
  console.warn(`[discord] webhook post failed: ${lastError} (status=${lastStatus ?? "n/a"})`);
  return { ok: false, status: lastStatus, error: lastError };
}

/**
 * Send an arbitrary one-off text message to a channel webhook. The sanctioned
 * path for ad-hoc ops pings (e.g. the autonomous goal-runner status, ADR-075)
 * that don't warrant a shaped embed helper. Soft-fail; Discord content caps at
 * 2000 chars. Keeps the single-import-boundary rule intact.
 */
export async function notifyChannel(
  webhookUrl: string,
  text: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  return postWebhook({ webhookUrl, content: (text ?? "").slice(0, 2000), fetchImpl: opts.fetchImpl });
}

// ---------------------------------------------------------------------------
// Shape helpers — encode each channel's "look" so callers stay terse.
// ---------------------------------------------------------------------------

const COLOR_FOIL_ORANGE = 0xff6b5c;
const COLOR_GREEN_OK = 0x4ade80;
const COLOR_RED_ERROR = 0xef4444;
const COLOR_SLATE = 0x64748b;

/** Mask an email for surfacing in chat. `john.craig@gmail.com` → `j***@gmail.com`. */
export function maskEmail(email: string): string {
  const trimmed = (email ?? "").trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at < 1) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  if (local.length <= 1) return `${local}${domain}`;
  return `${local[0]}***${domain}`;
}

export type SubscriberEvent = {
  email: string;
  source: string | null;
  activeCount: number | null;
};

export async function postSubscriberJoined(
  webhookUrl: string,
  ev: SubscriberEvent,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const fields: DiscordEmbed["fields"] = [
    { name: "Email", value: maskEmail(ev.email), inline: true },
    { name: "Source", value: ev.source || "(direct)", inline: true },
  ];
  if (ev.activeCount !== null) {
    fields.push({ name: "Active total", value: String(ev.activeCount), inline: true });
  }
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "✨ New subscriber",
        color: COLOR_FOIL_ORANGE,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type HostLeadEvent = {
  businessName: string;
  venueType: string;
  city: string;
  email: string;
  footTraffic: string;
  sellsCards: string | null;
};

/** /host venue-funnel lead (vending Phase V-1). Routed to the #subscribers
 *  channel webhook (a lead is the same "human raised a hand" class of event;
 *  a dedicated #leads channel is an optional later split). Email masked like
 *  every subscriber event; business fields are the founder's follow-up cue. */
export async function postHostLead(
  webhookUrl: string,
  ev: HostLeadEvent,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const fields: DiscordEmbed["fields"] = [
    { name: "Business", value: ev.businessName, inline: true },
    { name: "Venue type", value: ev.venueType, inline: true },
    { name: "City", value: ev.city, inline: true },
    { name: "Email", value: maskEmail(ev.email), inline: true },
    { name: "Foot traffic", value: ev.footTraffic, inline: true },
  ];
  if (ev.sellsCards) {
    fields.push({ name: "Already sells cards", value: ev.sellsCards, inline: true });
  }
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "🏪 New host-a-machine lead",
        color: COLOR_GREEN_OK,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type ContentEventInput = {
  blogTitle: string;
  blogUrl: string;
  blogWordCount?: number;
  newsletter?:
    | { subject: string; previewText: string; wordCount: number; artifactPath: string }
    | null;
};

export async function postContentPublished(
  webhookUrl: string,
  ev: ContentEventInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const fields: DiscordEmbed["fields"] = [
    { name: "Blog", value: `[${ev.blogTitle}](${ev.blogUrl})`, inline: false },
  ];
  if (typeof ev.blogWordCount === "number") {
    fields.push({ name: "Word count", value: String(ev.blogWordCount), inline: true });
  }
  if (ev.newsletter) {
    fields.push({ name: "Newsletter subject", value: ev.newsletter.subject, inline: false });
    fields.push({ name: "Preview text", value: ev.newsletter.previewText, inline: false });
    fields.push({
      name: "Artifact",
      value: `[\`${ev.newsletter.artifactPath}\`](https://github.com/johnnycakx/Foil/blob/main/${ev.newsletter.artifactPath.replace(/\\/g, "/")})`,
      inline: false,
    });
  }
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "📝 Autonomous post published",
        color: COLOR_GREEN_OK,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type SocialDraftInput = {
  /** "deal_of_day" | "price_spotlight" | "educational". */
  angle: string;
  /** The full generated post text (already voice-gated). */
  text: string;
  /** The page the post links to. */
  link: string;
  /** The threaded-reply text posted as the first reply (v2.2) — what actually
   *  carries the link + the value frame / newsletter CTA. Optional for back-compat. */
  reply?: string;
  /** Whether a portrait image was rendered (the image itself isn't attached —
   *  Discord webhooks need multipart; the review ping carries the text + a note). */
  hasImage: boolean;
  /** True when this is a dry-run draft (not posted to X). */
  dryRun: boolean;
};

/**
 * Post an X-bot DRAFT for review to Discord (#content-engine). Used by the
 * dry-run path (X_BOT_LIVE=false) so John sees the day's generated post + angle
 * without anything reaching X. Soft-fail per the lib contract.
 */
export async function postSocialDraft(
  webhookUrl: string,
  ev: SocialDraftInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: ev.dryRun ? "🧪 X post DRAFT (dry-run, not posted)" : "✅ X post sent",
        color: COLOR_GREEN_OK,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Angle", value: ev.angle, inline: true },
          { name: "Chars", value: String(ev.text.length), inline: true },
          { name: "Image", value: ev.hasImage ? "rendered" : "none", inline: true },
          { name: "Text", value: ev.text.slice(0, 1000), inline: false },
          { name: "Reply", value: (ev.reply ?? ev.link).slice(0, 1000), inline: false },
        ],
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type SocialApprovalInput = {
  /** The persisted pending-draft id the owner approves by. */
  draftId: string;
  angle: string;
  text: string;
  link: string;
  /** The threaded-reply text (v2.2) — what gets posted as the first reply. */
  reply?: string;
  hasImage: boolean;
  /** When the pending draft auto-skips if not approved (human-readable). */
  expiresLabel: string;
};

/**
 * Post an X-bot APPROVAL REQUEST to Discord (#content-engine) — the approval-mode
 * (ADR-071) draft the owner approves with `/approve <id>` or skips with
 * `/skip <id>` (the Foil HQ bot's owner-gated slash commands). The draft id is
 * the load-bearing field: it ties the Discord message to the persisted row that
 * gets posted. Soft-fail per the lib contract.
 */
export async function postSocialApprovalRequest(
  webhookUrl: string,
  ev: SocialApprovalInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "🕊️ X post awaiting approval",
        description: `Approve with \`/approve ${ev.draftId}\` or skip with \`/skip ${ev.draftId}\` (Foil HQ bot, owner only).`,
        color: COLOR_FOIL_ORANGE,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Draft id", value: `\`${ev.draftId}\``, inline: false },
          { name: "Angle", value: ev.angle, inline: true },
          { name: "Chars", value: String(ev.text.length), inline: true },
          { name: "Image", value: ev.hasImage ? "rendered" : "none", inline: true },
          { name: "Text", value: ev.text.slice(0, 1000), inline: false },
          { name: "Reply", value: (ev.reply ?? ev.link).slice(0, 1000), inline: false },
          { name: "Auto-skips", value: ev.expiresLabel, inline: false },
        ],
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type NewsletterApprovalInput = {
  /** The persisted pending-draft id the owner approves by. */
  draftId: string;
  /** ISO week tag, e.g. "2026-W26". */
  issueWeek: string;
  subject: string;
  previewText: string;
  downCount: number;
  upCount: number;
  /** A short, human-readable list of the top cooling-off cards for the at-a-glance
   *  decision (e.g. "Jamming Tower down 10.6%, Flareon VMAX down 10.4%, ..."). */
  topCards: string;
  /** When the pending draft auto-skips if not approved (human-readable). */
  expiresLabel: string;
  /** Which render produced this issue: "editorial" (the default LLM issue) or
   *  "deterministic" (the soft-fall digest when editorial generation failed).
   *  Lets the owner see at a glance whether the safety net fired. Optional for
   *  back-compat. */
  source?: "editorial" | "deterministic";
};

/**
 * Post a NEWSLETTER digest APPROVAL REQUEST to Discord (#content-engine) — the
 * no-spend rail (ADR-077) parity-clone of postSocialApprovalRequest. The owner
 * approves with `/approve <id>` or skips with `/skip <id>` (the same Foil HQ bot
 * commands, which fall through to the newsletter endpoint when the id is not an
 * X draft). On approve the paste-ready issue is emailed to the founder. The card
 * is a DECISION SUMMARY (subject + counts + top cards), not the full HTML body.
 * Soft-fail per the lib contract.
 */
export async function postNewsletterApprovalRequest(
  webhookUrl: string,
  ev: NewsletterApprovalInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "📰 Newsletter digest awaiting approval",
        description: `Approve with \`/approve ${ev.draftId}\` or skip with \`/skip ${ev.draftId}\` (Foil HQ bot, owner only). On approve, the paste-ready issue is emailed to you.`,
        color: COLOR_FOIL_ORANGE,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Draft id", value: `\`${ev.draftId}\``, inline: false },
          { name: "Week", value: ev.issueWeek, inline: true },
          {
            name: "Format",
            value: ev.source === "deterministic" ? "⚠️ deterministic (editorial fell back)" : "editorial",
            inline: true,
          },
          { name: "Cooling off", value: String(ev.downCount), inline: true },
          { name: "Heating up", value: String(ev.upCount), inline: true },
          { name: "Subject", value: ev.subject.slice(0, 256), inline: false },
          { name: "Preview", value: ev.previewText.slice(0, 256), inline: false },
          { name: "Top cards", value: ev.topCards.slice(0, 1000), inline: false },
          { name: "Auto-skips", value: ev.expiresLabel, inline: false },
        ],
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

/**
 * Attach an arbitrary rendered file (PNG or MP4) to a Discord channel via
 * multipart (webhooks accept a file part + payload_json). Discord inline-renders
 * both an image and a (muted, looping) MP4, so this is what lets John SEE the
 * card-hero still OR its motion clip in the review/approval card before anything
 * reaches X. Soft-fail; never throws.
 */
export async function postDiscordMedia(
  webhookUrl: string,
  input: { filename: string; bytes: Uint8Array; contentType: string; content?: string; fetchImpl?: typeof fetch },
): Promise<PostWebhookResult> {
  if (!webhookUrl) return { ok: false, error: "missing_webhook_url" };
  try {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ username: DISCORD_USERNAME, content: input.content ?? "" }));
    form.append(
      "files[0]",
      new Blob([input.bytes as unknown as BlobPart], { type: input.contentType }),
      input.filename,
    );
    const fetchFn = input.fetchImpl ?? fetch;
    const res = await fetchFn(webhookUrl, { method: "POST", body: form });
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Back-compat PNG helper — delegates to postDiscordMedia. */
export async function postDiscordImage(
  webhookUrl: string,
  input: { filename: string; png: Uint8Array; content?: string; fetchImpl?: typeof fetch },
): Promise<PostWebhookResult> {
  return postDiscordMedia(webhookUrl, {
    filename: input.filename,
    bytes: input.png,
    contentType: "image/png",
    content: input.content,
    fetchImpl: input.fetchImpl,
  });
}

export type ErrorEventInput = {
  source: string; // e.g. "content-engine", "subscribe-action", "ci-workflow"
  errorType: string; // e.g. "BeehiivApiError", "GenerationFailedAfterRetries"
  message: string;
  context?: Record<string, string | number | undefined>;
  runUrl?: string; // GH Actions run link if applicable
};

export async function postError(
  webhookUrl: string,
  ev: ErrorEventInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const fields: DiscordEmbed["fields"] = [
    { name: "Source", value: ev.source, inline: true },
    { name: "Type", value: ev.errorType, inline: true },
  ];
  for (const [k, v] of Object.entries(ev.context ?? {})) {
    if (v === undefined || v === "") continue;
    fields.push({ name: k, value: String(v).slice(0, 1024), inline: true });
  }
  if (ev.runUrl) fields.push({ name: "Run", value: `[GH Actions](${ev.runUrl})`, inline: false });
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: "⚠️ Error",
        description: `\`\`\`\n${ev.message.slice(0, 1500)}\n\`\`\``,
        color: COLOR_RED_ERROR,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type WishlistAlertRunInput = {
  rowsScanned: number;
  slugsConsidered: number;
  browseCalls: number;
  alerted: number;
  slugsWithListing: number;
  errorCount: number;
  capHit: boolean;
  /** Run duration in ms — for the at-a-glance perf signal. */
  durationMs: number;
};

/**
 * Post the hourly wishlist-alert cron's summary to a Discord channel. Used
 * by the cron route after every successful invocation; soft-fails like
 * every other Discord post.
 */
export async function postWishlistAlertRun(
  webhookUrl: string,
  ev: WishlistAlertRunInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const fields: DiscordEmbed["fields"] = [
    { name: "Rows scanned", value: String(ev.rowsScanned), inline: true },
    { name: "Slugs considered", value: String(ev.slugsConsidered), inline: true },
    { name: "Browse calls", value: String(ev.browseCalls), inline: true },
    { name: "With listing", value: String(ev.slugsWithListing), inline: true },
    { name: "Alerts sent", value: String(ev.alerted), inline: true },
    { name: "Errors", value: String(ev.errorCount), inline: true },
    { name: "Duration", value: `${(ev.durationMs / 1000).toFixed(1)}s`, inline: true },
  ];
  if (ev.capHit) {
    fields.push({ name: "Cap hit", value: "yes — increased run rate or daily quota next", inline: false });
  }
  const color =
    ev.errorCount > 0 ? COLOR_RED_ERROR :
    ev.alerted > 0 ? COLOR_FOIL_ORANGE :
    COLOR_SLATE;
  const emoji = ev.alerted > 0 ? "🔔" : ev.errorCount > 0 ? "⚠️" : "🕐";
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: `${emoji} Wishlist alert cron`,
        color,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export type BrowseTelemetryInput = {
  /** ISO yyyy-mm-dd of the day this summary covers (UTC, == cron fire day). */
  date: string;
  total24h: number;
  byCounts: { page_render: number; wishlist_cron: number; manual: number };
  successRatePct: number;
  pctOfCeiling: number;
  approachingCeiling: boolean;
  /** Daily totals oldest-first, length 7. Used for a small text chart. */
  daily7: Array<{ date: string; total: number }>;
  /** Rows deleted by the 90d retention sweep, for audit. */
  purgedRows?: number;
};

/**
 * Daily Browse-API call telemetry summary (ADR-025). Posted by the
 * /api/cron/browse-telemetry route after every 06:00 UTC fire.
 *
 * Color flips red + the body prepends "⚠ Approaching daily ceiling" when
 * yesterday's call count >= 80% of the 5,000/day Browse quota — that's
 * the load-bearing visual signal that the Application Growth Check
 * submission is due.
 */
export async function postBrowseTelemetry(
  webhookUrl: string,
  ev: BrowseTelemetryInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  const chart = ev.daily7
    .map((d) => `${d.date.slice(5)}: ${String(d.total).padStart(4, " ")}`)
    .join("\n");
  const fields: DiscordEmbed["fields"] = [
    { name: "24h total", value: String(ev.total24h), inline: true },
    { name: "% of 5,000/day", value: `${ev.pctOfCeiling.toFixed(1)}%`, inline: true },
    { name: "Success rate", value: `${ev.successRatePct.toFixed(1)}%`, inline: true },
    { name: "page_render", value: String(ev.byCounts.page_render), inline: true },
    { name: "wishlist_cron", value: String(ev.byCounts.wishlist_cron), inline: true },
    { name: "manual", value: String(ev.byCounts.manual), inline: true },
    { name: "Last 7 days", value: `\`\`\`\n${chart}\n\`\`\``, inline: false },
  ];
  if (typeof ev.purgedRows === "number" && ev.purgedRows > 0) {
    fields.push({ name: "Retention sweep", value: `${ev.purgedRows} rows purged (>90d)`, inline: false });
  }
  const title = ev.approachingCeiling
    ? `⚠ Approaching daily ceiling — Browse telemetry (${ev.date})`
    : `📊 Browse telemetry (${ev.date})`;
  const color = ev.approachingCeiling ? COLOR_RED_ERROR : COLOR_FOIL_ORANGE;
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title,
        color,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

export async function postDeploy(
  webhookUrl: string,
  ev: { status: "started" | "succeeded" | "failed"; url?: string; commitSha?: string },
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<PostWebhookResult> {
  // Only used if we ever bypass Vercel's native Discord integration. Today
  // #deploys is fed by Vercel directly; this helper is a fallback shape.
  const colors = {
    started: COLOR_SLATE,
    succeeded: COLOR_GREEN_OK,
    failed: COLOR_RED_ERROR,
  };
  return postWebhook({
    webhookUrl,
    embeds: [
      {
        title: `🚀 Deploy ${ev.status}`,
        color: colors[ev.status],
        timestamp: new Date().toISOString(),
        fields: [
          ...(ev.commitSha ? [{ name: "Commit", value: ev.commitSha.slice(0, 7), inline: true }] : []),
          ...(ev.url ? [{ name: "URL", value: ev.url, inline: false }] : []),
        ],
      },
    ],
    fetchImpl: opts.fetchImpl,
  });
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(no body)";
  }
}
