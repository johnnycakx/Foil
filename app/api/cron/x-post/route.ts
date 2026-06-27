// Daily X content-bot cron (ADR-058 + ADR-071). Runs AFTER deals-refresh
// (08:00 UTC) at 14:00 UTC. Picks the day's angle, renders a branded portrait
// image from the buy_signals cache (R-008-safe), generates a voice-gated post,
// then branches on X_BOT_MODE (resolveXBotMode; X_BOT_LIVE=true still maps to
// live for back-compat):
//   - dry_run  → (DEFAULT) posts a DRAFT to Discord #content-engine for review.
//   - approval → persists a pending draft + posts an APPROVAL REQUEST (with the
//     draft id) to #content-engine. Posts to X only on later owner approval via
//     /api/x/approve. NO code path here reaches the X API in approval mode.
//   - live     → posts to X immediately via the lib/social/x-client boundary.
//
// Auth: same bearer-CRON_SECRET contract as the other crons. Soft-fail.

import { NextResponse } from "next/server";
import { runXBot } from "@/lib/social/bot";
import { resolveXBotMode } from "@/lib/social/mode";
import { getDealsForPost, getSpotlightForPost } from "@/lib/social/data";
import { generatePostText } from "@/lib/social/post-text";
import { renderDealsImage, renderSpotlightImage } from "@/lib/social/post-image";
import { postToX } from "@/lib/social/x-client";
import {
  supabaseDraftStore,
  bytesToBase64,
  expiryFrom,
  DEFAULT_APPROVAL_EXPIRY_HOURS,
} from "@/lib/social/drafts";
import { postSocialDraft, postSocialApprovalRequest, postDiscordImage } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new NextResponse("missing_cron_secret", { status: 503 });
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) return new NextResponse("unauthorized", { status: 401 });

  const mode = resolveXBotMode(process.env); // dry_run | approval | live
  const now = new Date();
  const contentWebhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;

  const result = await runXBot({
    mode,
    now,
    getDeals: () => getDealsForPost(now),
    getSpotlight: () => getSpotlightForPost(now),
    generateText: (input) => generatePostText(input),
    renderImage: async (input, deals) => {
      // Satori/next-og composed card is the SOLE image source (ADR-058): a
      // tight on-brand 1080x1350 card from the buy_signals data, not a page
      // screenshot. (The Playwright path was dropped — a ~50MB chromium dep +
      // function-size/deploy risk wasn't worth it for a dry-run feature.)
      if (input.angle === "price_spotlight") return renderSpotlightImage({ spotlight: input.spotlight, date: input.date });
      // deal_of_day + educational → the deals card (text-only when no deals).
      return deals.length > 0 ? renderDealsImage({ deals, date: input.date }) : null;
    },
    post: (x) => postToX({ text: x.text, imagePng: x.imagePng }),
    review: async (draft) => {
      if (!contentWebhook) return;
      await postSocialDraft(contentWebhook, {
        angle: draft.angle,
        text: draft.text,
        link: draft.link,
        hasImage: !!draft.imagePng,
        dryRun: true,
      });
      // Attach the actual portrait so John reviews the image, not just a note.
      if (draft.imagePng) {
        await postDiscordImage(contentWebhook, { filename: `x-${draft.angle}.png`, png: draft.imagePng });
      }
    },
    requestApproval: async (draft) => {
      // Persist the EXACT text + image so the approved row is the posted row,
      // then ask the owner to approve in Discord. Never posts to X here.
      const store = supabaseDraftStore();
      // Housekeeping: sweep any pending drafts that timed out (never auto-post).
      await store.expireStale(now.getTime());
      const expiresAt = expiryFrom(now.getTime(), DEFAULT_APPROVAL_EXPIRY_HOURS);
      const created = await store.create({
        angle: draft.angle,
        text: draft.text,
        link: draft.link,
        imageBase64: draft.imagePng ? bytesToBase64(draft.imagePng) : null,
        expiresAt,
      });
      if (!created) return null; // soft-fail: bot.ts reports approval_persist_failed.
      if (contentWebhook) {
        await postSocialApprovalRequest(contentWebhook, {
          draftId: created.id,
          angle: draft.angle,
          text: draft.text,
          link: draft.link,
          hasImage: !!draft.imagePng,
          expiresLabel: `${DEFAULT_APPROVAL_EXPIRY_HOURS}h (then auto-skipped)`,
        });
        if (draft.imagePng) {
          await postDiscordImage(contentWebhook, { filename: `x-${draft.angle}.png`, png: draft.imagePng });
        }
      }
      return { id: created.id };
    },
  });

  return NextResponse.json(result);
}
