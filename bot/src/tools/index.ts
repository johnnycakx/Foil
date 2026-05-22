// Curated Anthropic tool surface for the Foil ops bot.
//
// Deliberately narrow — full MCP integration is Goal B. Each tool is a thin,
// auditable wrapper around a single read-only operation. Nothing here writes
// to the repo, Postgres, or any external service.
//
// Layout: every tool is a { definition, handler } pair. The handler returns
// a string (Anthropic's tool_result content_type). Errors are returned as
// `Error: <message>` strings so the assistant can react instead of crashing.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

export type ToolDefinition = Anthropic.Tool;
export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

/** Repo root resolved from the bot/ subdirectory at runtime. */
const REPO_ROOT = path.resolve(process.cwd(), "..");

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

const readFileDef: ToolDefinition = {
  name: "read_file",
  description:
    "Read a UTF-8 text file from the Foil repository. Paths are resolved relative to the repo root. Use for fetching specific source files, ADRs, blog posts, or fixtures.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Repo-relative path, e.g. 'docs/DECISIONS.md' or 'lib/beehiiv.ts'. Must NOT contain '..'.",
      },
      max_bytes: {
        type: "number",
        description: "Optional cap to avoid blowing context. Defaults to 20000 (≈5K tokens).",
      },
    },
    required: ["path"],
  },
};

async function readFileHandler(input: Record<string, unknown>): Promise<string> {
  const relPath = String(input.path ?? "");
  const maxBytes = typeof input.max_bytes === "number" ? input.max_bytes : 20000;
  if (!relPath || relPath.includes("..")) return `Error: invalid path "${relPath}"`;
  const abs = path.resolve(REPO_ROOT, relPath);
  if (!abs.startsWith(REPO_ROOT)) return `Error: path escapes repo root`;
  try {
    const stats = await stat(abs);
    if (stats.isDirectory()) return `Error: ${relPath} is a directory`;
    const raw = await readFile(abs, "utf8");
    return raw.length > maxBytes ? raw.slice(0, maxBytes) + `\n\n[…truncated to ${maxBytes} bytes]` : raw;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// search_codebase
// ---------------------------------------------------------------------------

const searchCodebaseDef: ToolDefinition = {
  name: "search_codebase",
  description:
    "Search the Foil repository for files containing a substring (case-insensitive). Returns a list of repo-relative paths with the first matching line in each. Walks lib/, app/, scripts/, docs/, bot/ — skips node_modules, .next, dist.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Substring to look for (case-insensitive)." },
      max_results: { type: "number", description: "Cap on result rows. Defaults to 20." },
    },
    required: ["query"],
  },
};

const SEARCH_ROOTS = ["lib", "app", "scripts", "docs", "bot"] as const;
const SEARCH_SKIP = new Set([
  "node_modules",
  ".next",
  "dist",
  ".git",
  "_pending",
  "__tests__", // skip test files so search results focus on source
]);

async function walkDir(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SEARCH_SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkDir(full, out);
    else if (entry.isFile() && /\.(ts|tsx|md|mdx|sql|json|yml|yaml|sh)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

async function searchCodebaseHandler(input: Record<string, unknown>): Promise<string> {
  const query = String(input.query ?? "").trim();
  const maxResults = typeof input.max_results === "number" ? input.max_results : 20;
  if (!query) return `Error: empty query`;
  const needle = query.toLowerCase();
  const hits: string[] = [];

  for (const root of SEARCH_ROOTS) {
    const abs = path.join(REPO_ROOT, root);
    try {
      const files: string[] = [];
      await walkDir(abs, files);
      for (const file of files) {
        if (hits.length >= maxResults) break;
        try {
          const raw = await readFile(file, "utf8");
          const lower = raw.toLowerCase();
          const idx = lower.indexOf(needle);
          if (idx >= 0) {
            const lineStart = raw.lastIndexOf("\n", idx) + 1;
            const lineEnd = raw.indexOf("\n", idx);
            const line = raw.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
            const rel = path.relative(REPO_ROOT, file).replace(/\\/g, "/");
            hits.push(`${rel}: ${line.slice(0, 200)}`);
          }
        } catch {
          // Skip unreadable files silently.
        }
      }
    } catch {
      // Skip missing roots silently.
    }
    if (hits.length >= maxResults) break;
  }

  if (hits.length === 0) return `No matches for "${query}".`;
  return hits.join("\n");
}

// ---------------------------------------------------------------------------
// get_recent_subscribers — Beehiiv MCP would do this in Goal B, but for now
// we go direct to Beehiiv's REST API to honor the ADR-010 import-boundary.
// ---------------------------------------------------------------------------

const getRecentSubscribersDef: ToolDefinition = {
  name: "get_recent_subscribers",
  description:
    "Count active Beehiiv subscribers for the Foil publication. Returns total + the N most recent emails + their acquisition source. Live data — pulled from Beehiiv at call time.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "How many recent subscribers to return. Default 10, max 25." },
    },
    required: [],
  },
};

async function getRecentSubscribersHandler(input: Record<string, unknown>): Promise<string> {
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 10, 25);
  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !pubId) return `Error: Beehiiv credentials not set (BEEHIIV_API_KEY/BEEHIIV_PUBLICATION_ID)`;
  try {
    const url = `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions?limit=${limit}&order_by=created&direction=desc&status=active`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return `Error: Beehiiv HTTP ${response.status}`;
    const json = (await response.json()) as {
      data: Array<{ email: string; created: number; utm_source?: string }>;
      total_results?: number;
    };
    const total = json.total_results ?? json.data.length;
    const lines = json.data.slice(0, limit).map((s) => {
      const when = new Date((s.created ?? 0) * 1000).toISOString().slice(0, 10);
      return `${when} · ${s.email} · ${s.utm_source ?? "(no utm_source)"}`;
    });
    return `Active subscribers: ${total}\nMost recent ${lines.length}:\n${lines.join("\n")}`;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// get_publication_stats
// ---------------------------------------------------------------------------

const getPublicationStatsDef: ToolDefinition = {
  name: "get_publication_stats",
  description:
    "Roll up Beehiiv publication stats for the Foil newsletter. Returns active + inactive sub counts and any totals Beehiiv exposes on the publication object.",
  input_schema: {
    type: "object",
    properties: {
      time_period: {
        type: "string",
        description: "Currently unused — Beehiiv's free tier exposes lifetime counts only. Accepts any string; ignored.",
      },
    },
    required: [],
  },
};

async function getPublicationStatsHandler(_input: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !pubId) return `Error: Beehiiv credentials not set`;
  try {
    const url = `https://api.beehiiv.com/v2/publications/${pubId}?expand[]=stats`;
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
// get_session_log
// ---------------------------------------------------------------------------

const getSessionLogDef: ToolDefinition = {
  name: "get_session_log",
  description:
    "Return the N most recent SESSION-LOG entries from docs/SESSION-LOG.md. Use to recall what shipped in the last few sessions without re-deriving from git log.",
  input_schema: {
    type: "object",
    properties: {
      entries: { type: "number", description: "How many entries to return. Default 3, max 10." },
    },
    required: [],
  },
};

async function getSessionLogHandler(input: Record<string, unknown>): Promise<string> {
  const entries = Math.min(typeof input.entries === "number" ? input.entries : 3, 10);
  try {
    const raw = await readFile(path.join(REPO_ROOT, "docs", "SESSION-LOG.md"), "utf8");
    const matches = [...raw.matchAll(/## \d{4}-\d{2}-\d{2}[\s\S]*?(?=\n## \d{4}-\d{2}-\d{2}|\n## How to log a session|$)/g)];
    const slice = matches.slice(0, entries).map((m) => m[0].trim());
    return slice.join("\n\n---\n\n");
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  readFileDef,
  searchCodebaseDef,
  getRecentSubscribersDef,
  getPublicationStatsDef,
  getSessionLogDef,
];

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  read_file: readFileHandler,
  search_codebase: searchCodebaseHandler,
  get_recent_subscribers: getRecentSubscribersHandler,
  get_publication_stats: getPublicationStatsHandler,
  get_session_log: getSessionLogHandler,
};

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return `Error: unknown tool "${name}"`;
  try {
    return await handler(input);
  } catch (err) {
    return `Error: tool "${name}" threw: ${(err as Error).message}`;
  }
}
