// X content bot orchestrator (ADR-058 + ADR-071). Picks the day's angle, gathers
// data, renders the image, generates the gated post text, then branches on the
// run mode: post to X (live), persist + ask the owner to approve (approval), or
// deliver a draft for review (dry_run). All deps are injected so the mode switch
// is unit-testable.
//
// SAFETY INVARIANT (mirrors the newsletter never-auto-send, ADR-011 / R-001):
// `deps.post` (the X API boundary) is invoked ONLY in `live` mode. In dry_run
// AND approval mode the orchestrator NEVER calls it — in approval mode the post
// happens later, out-of-band, only after an explicit owner approval. Proven by test.

import { resolveAngle, utcDayNumber, WEEKLY_BOARD_MIN_DEALS, type PostAngle } from "./angles.ts";
import { buildReplyText, buildUserPrompt, linkFor, type DealData, type GeneratedPost, type PostInput, type SpotlightData } from "./post-text.ts";
import type { XBotMode } from "./mode.ts";
import type { PostToXResult } from "./x-client.ts";

export type XBotDraft = {
  angle: PostAngle;
  text: string;
  link: string;
  /** The threaded-reply text (v2.2): a value-framed link line, or the newsletter
   *  CTA on a rotation day (weekly_board adds the save ask). The body is link-free;
   *  this is what gets posted as the first reply (Fix 3b). Persisted so /approve
   *  posts the SAME reviewed reply. */
  replyText: string;
  /** The Phase 0 still (the guaranteed fallback). */
  imagePng: Uint8Array | null;
  /** The MP4 motion clip when motion rendered (ADR-074 Phase 1). Null → still-only. */
  videoMp4: Uint8Array | null;
};

export type XBotDeps = {
  mode: XBotMode;
  now?: Date;
  getDeals: () => Promise<DealData[]>;
  getSpotlight: () => Promise<SpotlightData | null>;
  generateText: (input: PostInput) => Promise<GeneratedPost>;
  /** Render the angle's portrait PNG (the still / fallback). Soft-fails to null. */
  renderImage: (input: PostInput, deals: DealData[]) => Promise<Uint8Array | null>;
  /** Optional: render the MOTION clip (ADR-074 Phase 1) from the rendered still.
   *  Returns null for non-motion angles or on any encode failure → the still
   *  posts. Strictly additive: when absent, behavior is the still-only path. */
  renderVideo?: (input: PostInput, deals: DealData[], still: Uint8Array) => Promise<Uint8Array | null>;
  /** THE X API boundary. Called ONLY when mode === "live". `linkReply` is the
   *  card/board link posted as the first reply (Fix 3b); the body is link-free. */
  post: (input: { text: string; imagePng: Uint8Array | null; videoMp4: Uint8Array | null; linkReply: string | null }) => Promise<PostToXResult>;
  /** Dry-run delivery (Discord review ping + optional disk). Called in dry_run. */
  review: (draft: XBotDraft) => Promise<void>;
  /** Approval delivery: persist the draft + ask the owner to approve in Discord.
   *  Called in `approval` mode. Returns the persisted draft id (or null on a
   *  soft-fail). NEVER posts to X — the post happens on later approval. */
  requestApproval?: (draft: XBotDraft) => Promise<{ id: string } | null>;
  /** Dev/preview override: force a specific angle (e.g. to preview the card-hero
   *  on a day the rotation lands elsewhere). Applied ONLY when that angle's data
   *  is available, so it can never produce a contentless post. */
  forceAngle?: PostAngle;
};

export type XBotResult = {
  ok: boolean;
  mode: XBotMode;
  angle: PostAngle;
  posted: boolean;
  postId?: string;
  text?: string;
  error?: string;
  /** The persisted pending-draft id (approval mode). */
  draftId?: string;
  /** Why nothing was posted (dry_run / awaiting_approval / no-op). */
  reason?: string;
};

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Build the angle's PostInput from the gathered data. */
/** Whether a (possibly forced) angle has the data it needs to render. */
function angleHasData(angle: PostAngle, deals: DealData[], hasSpotlight: boolean): boolean {
  if (angle === "deal_of_day") return deals.length > 0;
  if (angle === "price_spotlight") return hasSpotlight;
  if (angle === "weekly_board") return deals.length >= WEEKLY_BOARD_MIN_DEALS;
  return true; // educational always renders
}

function toPostInput(angle: PostAngle, date: string, deals: DealData[], spotlight: SpotlightData | null): PostInput {
  if (angle === "deal_of_day") return { angle, date, deal: deals[0] };
  if (angle === "price_spotlight") return { angle, date, spotlight: spotlight as SpotlightData };
  if (angle === "weekly_board") return { angle, date, deals };
  return { angle, date };
}

export async function runXBot(deps: XBotDeps): Promise<XBotResult> {
  const now = deps.now ?? new Date();
  const date = dateLabel(now);
  const mode = deps.mode;

  let deals: DealData[] = [];
  let spotlight: SpotlightData | null = null;
  try {
    [deals, spotlight] = await Promise.all([deps.getDeals(), deps.getSpotlight()]);
  } catch (err) {
    return { ok: false, mode, angle: "educational", posted: false, error: `data: ${(err as Error).message}` };
  }

  let angle = resolveAngle(now, {
    hasDeal: deals.length > 0,
    hasSpotlight: !!spotlight,
    hasBoard: deals.length >= WEEKLY_BOARD_MIN_DEALS,
  });
  // Dev/preview override — honored only when the forced angle has data to render,
  // so a force can never produce a contentless post.
  if (deps.forceAngle && angleHasData(deps.forceAngle, deals, !!spotlight)) {
    angle = deps.forceAngle;
  }
  const input = toPostInput(angle, date, deals, spotlight);

  let generated: GeneratedPost;
  try {
    generated = await deps.generateText(input);
  } catch (err) {
    return { ok: false, mode, angle, posted: false, error: `text: ${(err as Error).message}` };
  }

  let imagePng: Uint8Array | null = null;
  try {
    imagePng = await deps.renderImage(input, deals);
  } catch {
    imagePng = null; // image is best-effort; post text still goes out.
  }

  // Motion is rendered FROM the still, and only when we have a still to animate.
  // Any failure leaves videoMp4 null → the still is posted (the fallback).
  let videoMp4: Uint8Array | null = null;
  if (deps.renderVideo && imagePng) {
    try {
      videoMp4 = await deps.renderVideo(input, deals, imagePng);
    } catch {
      videoMp4 = null;
    }
  }

  // The value-framed / newsletter-rotated reply (v2.2). Deterministic by UTC day
  // so the persisted reply (approval mode) is reproducible + reviewable.
  const replyText = buildReplyText(input, utcDayNumber(now));
  const draft: XBotDraft = { angle, text: generated.text, link: linkFor(input), replyText, imagePng, videoMp4 };

  // --- DRY-RUN: never touch the X API. Hand the draft to the reviewer. ---
  if (mode === "dry_run") {
    try {
      await deps.review(draft);
    } catch {
      /* review delivery is best-effort */
    }
    return { ok: true, mode, angle, posted: false, text: generated.text, reason: "dry_run" };
  }

  // --- APPROVAL: persist + ask the owner to approve. NEVER posts here; the
  //     post happens out-of-band only after an explicit owner approval. ---
  if (mode === "approval") {
    if (!deps.requestApproval) {
      return { ok: false, mode, angle, posted: false, text: generated.text, error: "approval_mode_misconfigured: no requestApproval dep" };
    }
    let persisted: { id: string } | null = null;
    try {
      persisted = await deps.requestApproval(draft);
    } catch (err) {
      return { ok: false, mode, angle, posted: false, text: generated.text, error: `approval: ${(err as Error).message}` };
    }
    if (!persisted) {
      return { ok: false, mode, angle, posted: false, text: generated.text, error: "approval_persist_failed" };
    }
    return { ok: true, mode, angle, posted: false, text: generated.text, draftId: persisted.id, reason: "awaiting_approval" };
  }

  // --- LIVE: the only path that calls the X API boundary. The body is link-free;
  //     the value-framed reply (v2.2) is posted as the first reply (Fix 3b). ---
  const res = await deps.post({ text: generated.text, imagePng, videoMp4, linkReply: draft.replyText });
  if (!res.ok) {
    return { ok: false, mode, angle, posted: false, text: generated.text, error: res.error };
  }
  return { ok: true, mode, angle, posted: true, postId: res.postId, text: generated.text };
}

/** Re-export so the cron/script wire one consistent prompt link. */
export { buildUserPrompt };
