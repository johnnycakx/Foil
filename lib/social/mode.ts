// X content-bot run mode (ADR-071, extends ADR-058). Three modes:
//   - dry_run  : render a draft, post it to Discord #content-engine for review,
//                NEVER touch the X API. (The ADR-058 default.)
//   - approval : render a draft, PERSIST it, and ask the owner to approve in
//                Discord. Posts to X ONLY after an explicit owner approval
//                (the human-in-the-loop gate). No approval, no post.
//   - live     : render + post to X immediately, no review. (Full auto.)
//
// Resolution precedence (documented so a stale env can't surprise us):
//   1. X_BOT_MODE, if it is exactly one of the three values (case-insensitive).
//   2. else back-compat: X_BOT_LIVE === "true" → live.
//   3. else → dry_run (the safe default; the bot never posts unprompted).

export type XBotMode = "dry_run" | "approval" | "live";

export const X_BOT_MODES: readonly XBotMode[] = ["dry_run", "approval", "live"] as const;

export function isXBotMode(v: string): v is XBotMode {
  return (X_BOT_MODES as readonly string[]).includes(v);
}

/**
 * Resolve the run mode from env. `X_BOT_MODE` takes precedence; the legacy
 * `X_BOT_LIVE=true` switch still maps to `live` for back-compat (ADR-058), but
 * only when `X_BOT_MODE` is unset/invalid. Anything unrecognized → dry_run.
 */
export function resolveXBotMode(env: Record<string, string | undefined>): XBotMode {
  const mode = (env.X_BOT_MODE ?? "").trim().toLowerCase();
  if (isXBotMode(mode)) return mode;
  if ((env.X_BOT_LIVE ?? "").trim() === "true") return "live";
  return "dry_run";
}
