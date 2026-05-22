// Builds the Foil-grounded system prompt that every conversation turn ships
// with. Reads the canonical second-brain docs from ../docs/ at startup (and
// keeps them in memory until process restart — these don't change inside a
// single bot session). Channel personas adapt tone per Discord channel.
//
// Token cap (15k) is enforced by truncating the SESSION-LOG section first
// since the briefing + ROADMAP NOW/NEXT + RISKS High/Med are load-bearing.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_TOKEN_CAP = 15000;
// Rough chars-per-token estimate — matches Anthropic's ~4 chars/token rule
// of thumb for English. Used only for the cap; the real tokenizer is
// Anthropic-server-side.
const CHARS_PER_TOKEN = 4;

export type ChannelPersona = "content" | "subscribers" | "errors" | "general";

const CHANNEL_NAME_TO_PERSONA: Record<string, ChannelPersona> = {
  "content-engine": "content",
  subscribers: "subscribers",
  errors: "errors",
  general: "general",
};

const PERSONAS: Record<ChannelPersona, string> = {
  content: [
    `You are operating as Foil's content-engine lead. Channel: #content-engine.`,
    `Bias: prioritize the autonomous content pipeline — Mon/Thu cron, quality gates, ADRs 005-007 (full autonomy + 8 gates + skip-on-failure), 010-012 (Beehiiv + newsletter draft + manual-paste fallback). When John asks "what should we ship", read the ROADMAP NOW/NEXT in your context and propose the highest-leverage move on that surface.`,
  ].join(" "),
  subscribers: [
    `You are operating as Foil's growth lead. Channel: #subscribers.`,
    `Bias: focus on the waitlist + Beehiiv list dynamics (13 legacy subs, no real Foil subs yet pre-launch). When John shares a number, contextualize it against the Sep/Oct soft + public launch dates in CLAUDE.md and the $1.5K MRR Day-90 target.`,
  ].join(" "),
  errors: [
    `You are operating as Foil's on-call engineer. Channel: #errors.`,
    `Bias: assume the user is debugging a live incident. Lead with the single highest-probability root cause for the symptom they describe, then enumerate confirmation steps. If they paste a log line, parse it concretely and map to a file:line in the repo. Quality-gate exhaustion, Beehiiv 403s, Stripe webhook signature failures, and PokeTrace rate-limit pulses are the most common.`,
  ].join(" "),
  general: [
    `You are operating as a helpful pair to John, the Foil founder. Channel: #general.`,
    `Bias: terse, declarative, no hedging. If a question maps to ROADMAP / DECISIONS / RISKS / SESSION-LOG, ground your answer in those docs (provided below in <foil_context>). If you need a fact you don't have, call the read_file / search_codebase / get_session_log tools rather than guessing.`,
  ].join(" "),
};

/**
 * Resolve a Discord channel name → persona. Falls back to "general" so an
 * unknown / DM channel is still useful.
 */
export function personaForChannel(channelName: string | null | undefined): ChannelPersona {
  if (!channelName) return "general";
  const key = channelName.toLowerCase().replace(/^#/, "");
  return CHANNEL_NAME_TO_PERSONA[key] ?? "general";
}

export type SystemPromptInput = {
  /** Discord channel name (without the leading "#"). Used to pick persona. */
  channelName: string | null;
  /** Optional override of where to look for the docs/ directory. */
  docsDir?: string;
  /** Optional token cap; defaults to 15000. */
  tokenCap?: number;
};

/**
 * Build the full system prompt: persona + <foil_context> wrapping briefing,
 * ROADMAP NOW + NEXT, RISKS High + Medium, latest SESSION-LOG entry.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const persona = personaForChannel(input.channelName);
  const docsDir = input.docsDir ?? path.resolve(process.cwd(), "..", "docs");
  const cap = input.tokenCap ?? DEFAULT_TOKEN_CAP;

  const sections: string[] = [];
  sections.push(BASE_SYSTEM);
  sections.push(`\n## Channel persona\n${PERSONAS[persona]}`);
  sections.push(`\n## <foil_context>`);

  const briefing = safeRead(path.join(docsDir, "BRIEFING.md"));
  if (briefing) sections.push(`### BRIEFING.md\n${briefing}`);

  const roadmap = extractRoadmapNowNext(safeRead(path.join(docsDir, "ROADMAP.md")));
  if (roadmap) sections.push(`### ROADMAP.md (NOW + NEXT)\n${roadmap}`);

  const risks = extractRisksHighMedium(safeRead(path.join(docsDir, "RISKS.md")));
  if (risks) sections.push(`### RISKS.md (High + Medium)\n${risks}`);

  const session = extractLatestSession(safeRead(path.join(docsDir, "SESSION-LOG.md")));
  if (session) sections.push(`### SESSION-LOG.md (latest entry)\n${session}`);

  const ideas = extractRecentIdeas(safeRead(path.join(docsDir, "IDEAS.md")));
  if (ideas) sections.push(`### IDEAS.md (recent backlog — upstream of ROADMAP)\n${ideas}`);

  sections.push(`\n## </foil_context>`);

  return capToTokens(sections.join("\n"), cap);
}

const BASE_SYSTEM = `You are the Foil ops bot — an in-channel pair for John, the solo founder building Foil, a Pokémon TCG card valuation tool. You have access to the project's second-brain docs (below) plus curated tools:

- **Repo / docs:** read_file, search_codebase, get_session_log
- **Subscribers (Beehiiv REST):** beehiiv_list_subscriptions (recent rows with masked emails + status + utm), beehiiv_get_publication_stats (active/total counts), beehiiv_list_posts (drafts / scheduled / published)
- **Legacy aliases (still work):** get_recent_subscribers, get_publication_stats — prefer the beehiiv_* names going forward; they cover the same surface plus a wider parameter set.

Tone: terse, declarative, operational. No padding, no hedging. If a fact is in <foil_context>, cite the source doc inline. If you need a fact you don't have, call a tool — never invent.`;

function safeRead(filePath: string): string {
  try {
    if (!existsSync(filePath)) return "";
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Pull the NOW + NEXT tables from ROADMAP.md. Stops at the LATER section.
 * Returns empty string if the file is missing or doesn't match the expected
 * heading pattern.
 */
export function extractRoadmapNowNext(roadmap: string): string {
  if (!roadmap) return "";
  // Match "## NOW" through "## NEXT" → up to (but not including) "## LATER" or
  // "## PARKED" — whichever comes first.
  const startMatch = roadmap.match(/##\s+NOW[\s\S]*?(?=\n##\s+(?:LATER|PARKED|How))/);
  return startMatch ? startMatch[0].trim() : "";
}

/**
 * Pull the High + Medium severity risks. Skips Low + the "How to log" footer.
 */
export function extractRisksHighMedium(risks: string): string {
  if (!risks) return "";
  const lines = risks.split(/\r?\n/);
  const out: string[] = [];
  let inRisk = false;
  let currentSeverity: string | null = null;

  for (const line of lines) {
    if (line.startsWith("## R-")) {
      // New risk — buffer it; we'll decide whether to keep based on severity
      inRisk = true;
      currentSeverity = null;
      out.push("__RISK_START__" + line);
      continue;
    }
    if (line.startsWith("## How to log")) {
      inRisk = false;
      currentSeverity = null;
      continue;
    }
    if (inRisk) {
      const sevMatch = line.match(/\*\*Severity:\*\*\s*(\w+)/);
      if (sevMatch) currentSeverity = sevMatch[1];
      out.push("__RISK_LINE__" + (currentSeverity ?? "") + "::" + line);
    }
  }

  // Re-assemble keeping only High + Medium blocks.
  const grouped: string[][] = [];
  let cur: string[] = [];
  for (const item of out) {
    if (item.startsWith("__RISK_START__")) {
      if (cur.length) grouped.push(cur);
      cur = [item.replace("__RISK_START__", "")];
    } else {
      cur.push(item.replace(/^__RISK_LINE__[^:]*::/, ""));
    }
  }
  if (cur.length) grouped.push(cur);

  const kept = grouped.filter((block) => {
    return block.some(
      (l) =>
        /\*\*Severity:\*\*\s*(High|Medium)/i.test(l),
    );
  });

  return kept.map((block) => block.join("\n").trim()).join("\n\n---\n\n");
}

/**
 * Latest session log entry — everything from the first "## YYYY-MM-DD" heading
 * through the next "## YYYY-MM-DD" or "## How to log a session".
 */
export function extractLatestSession(sessionLog: string): string {
  if (!sessionLog) return "";
  const match = sessionLog.match(/## \d{4}-\d{2}-\d{2}[\s\S]*?(?=\n## \d{4}-\d{2}-\d{2}|\n## How to log a session)/);
  return match ? match[0].trim() : "";
}

/**
 * Parse `docs/IDEAS.md` entries. Each entry is a YAML frontmatter block
 * (`---` fence ... `---` fence) immediately followed by a `## <title>` line
 * and a body paragraph. Returns the most-recent N entries (top of file =
 * newest by the file's own convention), capped to `maxChars` total.
 */
export type IdeaEntry = {
  date: string;
  category: IdeaCategory;
  status: IdeaStatus;
  title: string;
  body: string;
  /** Raw markdown of this entry (frontmatter + heading + body), unmodified. */
  raw: string;
};

export const IDEA_CATEGORIES = [
  "product",
  "marketing",
  "content",
  "infra",
  "monetization",
  "ux",
  "growth",
] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export const IDEA_STATUSES = [
  "captured",
  "triaged",
  "promoted",
  "rejected",
  "shipped",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

const IDEAS_MAX_ENTRIES = 30;
// 5k tokens × ~4 chars/token ≈ 20k chars upper bound for the IDEAS section.
const IDEAS_MAX_CHARS = 5000 * CHARS_PER_TOKEN;

/**
 * Walk the file, find every `---\n...\n---\n## ...` block, parse the
 * frontmatter, and return entries in source order (newest-first by file
 * convention). Lenient — malformed entries are skipped silently rather than
 * throwing, so a typo in one row can't take the whole grounding offline.
 */
export function parseIdeasFile(ideas: string): IdeaEntry[] {
  if (!ideas) return [];
  const entries: IdeaEntry[] = [];
  // Match: opening "---\n", body up to closing "\n---\n", then "## title" then
  // body up to the next entry boundary (next "---\n" frontmatter open or EOF
  // or "## Review cadence" sentinel).
  const re = /^---\n([\s\S]*?)\n---\n##\s+(.+?)\n([\s\S]*?)(?=\n---\n|\n## (?:Review cadence|Format)\b|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ideas)) !== null) {
    const [raw, frontmatter, title, body] = m;
    const fields = parseFrontmatter(frontmatter);
    const date = fields.date ?? "";
    const category = fields.category as IdeaCategory | undefined;
    const status = (fields.status as IdeaStatus | undefined) ?? "captured";
    if (!date || !category) continue;
    if (!IDEA_CATEGORIES.includes(category)) continue;
    if (!IDEA_STATUSES.includes(status)) continue;
    entries.push({
      date,
      category,
      status,
      title: title.trim(),
      body: body.trim(),
      raw: raw.trim(),
    });
  }
  return entries;
}

function parseFrontmatter(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Render the IDEAS section for the bot's <foil_context>. Returns the
 * concatenated raw entries (in source order — newest first) up to the
 * smaller of `IDEAS_MAX_ENTRIES` and `IDEAS_MAX_CHARS`. Empty string when
 * the file is missing or has no parseable entries.
 */
export function extractRecentIdeas(
  ideas: string,
  opts: { maxEntries?: number; maxChars?: number } = {},
): string {
  const maxEntries = opts.maxEntries ?? IDEAS_MAX_ENTRIES;
  const maxChars = opts.maxChars ?? IDEAS_MAX_CHARS;
  const parsed = parseIdeasFile(ideas).slice(0, maxEntries);
  if (parsed.length === 0) return "";
  const out: string[] = [];
  let total = 0;
  for (const entry of parsed) {
    const block = renderIdeaEntry(entry);
    if (total + block.length > maxChars && out.length > 0) break;
    out.push(block);
    total += block.length;
  }
  return out.join("\n\n");
}

function renderIdeaEntry(entry: IdeaEntry): string {
  return [
    `**[${entry.category}] ${entry.title}** _(${entry.status}, ${entry.date})_`,
    entry.body,
  ].join("\n");
}

function capToTokens(text: string, tokenCap: number): string {
  const charCap = tokenCap * CHARS_PER_TOKEN;
  if (text.length <= charCap) return text;
  // Truncate from the END (which is the SESSION-LOG section) — briefing,
  // ROADMAP, RISKS are load-bearing and live at the top.
  return text.slice(0, charCap) + `\n\n[…truncated to fit ${tokenCap}-token cap]`;
}
