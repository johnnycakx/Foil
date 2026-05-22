// Beehiiv REST tools for the Foil HQ bot. Three live tools that the bot can
// invoke when John asks subscriber/post questions in chat:
//
//   beehiiv_list_subscriptions(status?, limit?)
//   beehiiv_get_publication_stats()
//   beehiiv_list_posts(status?, limit?)
//
// We talk to api.beehiiv.com directly with BEEHIIV_API_KEY. ADR-017 explains
// the choice over MCP — Beehiiv's MCP server uses interactive OAuth which is
// ill-suited for a headless bot running on Railway. The REST surface is
// stable, key-auth only, and sufficient for the read-only queries we need.
//
// Same import-boundary rule as lib/beehiiv.ts: this file is the only place
// in the bot subtree that talks to api.beehiiv.com.

import type { ToolDefinition, ToolHandler } from "./index.ts";

const BASE = "https://api.beehiiv.com/v2";

// ---------------------------------------------------------------------------
// beehiiv_list_subscriptions
// ---------------------------------------------------------------------------

const listSubscriptionsDef: ToolDefinition = {
  name: "beehiiv_list_subscriptions",
  description:
    "List Beehiiv subscribers for the Foil publication. Returns a count + recent emails (masked-domain only) with status + acquisition source. Use to answer 'how many subs?' or 'what's the recent signup pattern?'.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        description: "Filter by subscription status. Defaults to 'active'.",
        enum: ["active", "inactive", "pending", "needs_attention"],
      },
      limit: {
        type: "number",
        description: "Max recent rows to return (default 10, max 25).",
      },
    },
    required: [],
  },
};

async function listSubscriptionsHandler(input: Record<string, unknown>): Promise<string> {
  const status = typeof input.status === "string" ? input.status : "active";
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 10, 25);
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!pubId || !apiKey) return "Error: BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set";

  try {
    const url = `${BASE}/publications/${pubId}/subscriptions?status=${encodeURIComponent(status)}&limit=${limit}&order_by=created&direction=desc`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return `Error: Beehiiv HTTP ${response.status}`;
    const json = (await response.json()) as {
      data: Array<{ email: string; status: string; created: number; utm_source?: string }>;
      total_results?: number;
    };
    const total = json.total_results ?? json.data.length;
    if (json.data.length === 0) {
      return `Beehiiv status="${status}": ${total} subscribers (no recent rows in this slice).`;
    }
    const lines = json.data.map((s) => {
      const masked = maskEmailForBot(s.email);
      const when = new Date((s.created ?? 0) * 1000).toISOString().slice(0, 10);
      return `${when} · ${masked} · ${s.status} · ${s.utm_source ?? "(direct)"}`;
    });
    return `Beehiiv status="${status}": ${total} subscribers.\nMost recent ${lines.length}:\n${lines.join("\n")}`;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// beehiiv_get_publication_stats
// ---------------------------------------------------------------------------

const getPublicationStatsDef: ToolDefinition = {
  name: "beehiiv_get_publication_stats",
  description:
    "Roll up Beehiiv publication stats — name, active + total subscriber counts. Use to give a single-number 'how big is the list?' answer.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

async function getPublicationStatsHandler(_input: Record<string, unknown>): Promise<string> {
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!pubId || !apiKey) return "Error: BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set";

  try {
    const url = `${BASE}/publications/${pubId}?expand[]=stats`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return `Error: Beehiiv HTTP ${response.status}`;
    const json = (await response.json()) as {
      data?: {
        name?: string;
        stats?: { active_subscriptions?: number; total_subscriptions?: number };
      };
    };
    const stats = json.data?.stats;
    return [
      `Publication: ${json.data?.name ?? "(unknown)"}`,
      `Active subscriptions: ${stats?.active_subscriptions ?? "(n/a)"}`,
      `Total subscriptions: ${stats?.total_subscriptions ?? "(n/a)"}`,
    ].join("\n");
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// beehiiv_list_posts
// ---------------------------------------------------------------------------

const listPostsDef: ToolDefinition = {
  name: "beehiiv_list_posts",
  description:
    "List Beehiiv posts (drafts, scheduled, or published) for the Foil publication. Use to check 'what's queued for send?' or 'what was the last newsletter we shipped?'.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        description: "Filter by post status. Default: 'draft'.",
        enum: ["draft", "scheduled", "published", "archived"],
      },
      limit: { type: "number", description: "Max rows to return. Default 10, max 25." },
    },
    required: [],
  },
};

async function listPostsHandler(input: Record<string, unknown>): Promise<string> {
  const status = typeof input.status === "string" ? input.status : "draft";
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 10, 25);
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!pubId || !apiKey) return "Error: BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set";

  try {
    const url = `${BASE}/publications/${pubId}/posts?status=${encodeURIComponent(status)}&limit=${limit}&order_by=created&direction=desc`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return `Error: Beehiiv HTTP ${response.status}`;
    const json = (await response.json()) as {
      data: Array<{ id: string; title?: string; status?: string; created?: number; updated?: number }>;
      total_results?: number;
    };
    const total = json.total_results ?? json.data.length;
    if (json.data.length === 0) {
      return `Beehiiv posts status="${status}": 0 results.`;
    }
    const lines = json.data.map((p) => {
      const when = new Date((p.updated ?? p.created ?? 0) * 1000).toISOString().slice(0, 10);
      const title = (p.title ?? "(no title)").slice(0, 80);
      return `${when} · ${p.id.slice(0, 12)} · ${title}`;
    });
    return `Beehiiv posts status="${status}": ${total} total.\nRecent ${lines.length}:\n${lines.join("\n")}`;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// Registry exports — wired into bot/src/tools/index.ts
// ---------------------------------------------------------------------------

export const BEEHIIV_TOOL_DEFINITIONS: ToolDefinition[] = [
  listSubscriptionsDef,
  getPublicationStatsDef,
  listPostsDef,
];

export const BEEHIIV_TOOL_HANDLERS: Record<string, ToolHandler> = {
  beehiiv_list_subscriptions: listSubscriptionsHandler,
  beehiiv_get_publication_stats: getPublicationStatsHandler,
  beehiiv_list_posts: listPostsHandler,
};

/** Mask the local part of an email like lib/notifications/discord.ts::maskEmail. */
function maskEmailForBot(email: string): string {
  const trimmed = (email ?? "").trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at < 1) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  if (local.length <= 1) return `${local}${domain}`;
  return `${local[0]}***${domain}`;
}
