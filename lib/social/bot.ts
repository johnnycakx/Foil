// X content bot orchestrator (ADR-058). Picks the day's angle, gathers data,
// renders the image, generates the gated post text, then EITHER posts to X
// (live) OR delivers a draft for review (dry-run). All deps are injected so the
// dry-run/live switch is unit-testable.
//
// SAFETY INVARIANT (mirrors the newsletter never-auto-send, ADR-011 / R-001):
// when `live` is false, `deps.post` (the X API boundary) is NEVER invoked. The
// cron passes live = (X_BOT_LIVE === "true"); default false. Proven by test.

import { resolveAngle, type PostAngle } from "./angles.ts";
import { buildUserPrompt, linkFor, type DealData, type GeneratedPost, type PostInput, type SpotlightData } from "./post-text.ts";
import type { PostToXResult } from "./x-client.ts";

export type XBotDraft = { angle: PostAngle; text: string; link: string; imagePng: Uint8Array | null };

export type XBotDeps = {
  live: boolean;
  now?: Date;
  getDeals: () => Promise<DealData[]>;
  getSpotlight: () => Promise<SpotlightData | null>;
  generateText: (input: PostInput) => Promise<GeneratedPost>;
  /** Render the angle's portrait PNG. Soft-fails to null (text-only post). */
  renderImage: (input: PostInput, deals: DealData[]) => Promise<Uint8Array | null>;
  /** THE X API boundary. Called ONLY when live === true. */
  post: (input: { text: string; imagePng: Uint8Array | null }) => Promise<PostToXResult>;
  /** Dry-run delivery (Discord review ping + optional disk). Called when live === false. */
  review: (draft: XBotDraft) => Promise<void>;
};

export type XBotResult = {
  ok: boolean;
  live: boolean;
  angle: PostAngle;
  posted: boolean;
  postId?: string;
  text?: string;
  error?: string;
  /** Why nothing was posted (dry_run / no-op). */
  reason?: string;
};

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Build the angle's PostInput from the gathered data. */
function toPostInput(angle: PostAngle, date: string, deals: DealData[], spotlight: SpotlightData | null): PostInput {
  if (angle === "deal_of_day") return { angle, date, deal: deals[0] };
  if (angle === "price_spotlight") return { angle, date, spotlight: spotlight as SpotlightData };
  return { angle, date };
}

export async function runXBot(deps: XBotDeps): Promise<XBotResult> {
  const now = deps.now ?? new Date();
  const date = dateLabel(now);

  let deals: DealData[] = [];
  let spotlight: SpotlightData | null = null;
  try {
    [deals, spotlight] = await Promise.all([deps.getDeals(), deps.getSpotlight()]);
  } catch (err) {
    return { ok: false, live: deps.live, angle: "educational", posted: false, error: `data: ${(err as Error).message}` };
  }

  const angle = resolveAngle(now, { hasDeal: deals.length > 0, hasSpotlight: !!spotlight });
  const input = toPostInput(angle, date, deals, spotlight);

  let generated: GeneratedPost;
  try {
    generated = await deps.generateText(input);
  } catch (err) {
    return { ok: false, live: deps.live, angle, posted: false, error: `text: ${(err as Error).message}` };
  }

  let imagePng: Uint8Array | null = null;
  try {
    imagePng = await deps.renderImage(input, deals);
  } catch {
    imagePng = null; // image is best-effort; post text still goes out.
  }

  // --- The dry-run / live boundary. ---
  if (!deps.live) {
    // DRY-RUN: never touch the X API. Hand the draft to the reviewer.
    try {
      await deps.review({ angle, text: generated.text, link: linkFor(input), imagePng });
    } catch {
      /* review delivery is best-effort */
    }
    return { ok: true, live: false, angle, posted: false, text: generated.text, reason: "dry_run" };
  }

  // LIVE: the only path that calls the X API boundary.
  const res = await deps.post({ text: generated.text, imagePng });
  if (!res.ok) {
    return { ok: false, live: true, angle, posted: false, text: generated.text, error: res.error };
  }
  return { ok: true, live: true, angle, posted: true, postId: res.postId, text: generated.text };
}

/** Re-export so the cron/script wire one consistent prompt link. */
export { buildUserPrompt };
