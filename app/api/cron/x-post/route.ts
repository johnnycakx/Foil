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
import { POST_ANGLES, type PostAngle } from "@/lib/social/angles";
import { resolveXBotMode } from "@/lib/social/mode";
import { getDealsForPost, getSpotlightForPost } from "@/lib/social/data";
import { generatePostText } from "@/lib/social/post-text";
import { renderDealsImage, renderCardHeroImage } from "@/lib/social/post-image";
import { renderCardHeroMotion } from "@/lib/social/card-motion";
import { heroFieldsForDeal, heroFieldsForSpotlight } from "@/lib/social/hero-fields";
import { fetchCardArtBuffer } from "@/lib/social/card-art";
import { postToX } from "@/lib/social/x-client";
import {
  supabaseDraftStore,
  bytesToBase64,
  expiryFrom,
  DEFAULT_APPROVAL_EXPIRY_HOURS,
} from "@/lib/social/drafts";
import { postSocialDraft, postSocialApprovalRequest, postDiscordImage, postDiscordMedia } from "@/lib/notifications/discord";
import type { XBotDraft } from "@/lib/social/bot";

// Attach the review artifact to #content-engine: the MOTION clip when it
// rendered (Discord inline-previews MP4, muted/looping), else the still PNG.
// Soft-fail — a Discord outage can't block the post.
async function attachDraftMedia(webhook: string, draft: XBotDraft): Promise<void> {
  if (draft.videoMp4) {
    await postDiscordMedia(webhook, {
      filename: `x-${draft.angle}.mp4`,
      bytes: draft.videoMp4,
      contentType: "video/mp4",
      content: "▶ motion preview (autoplays muted; the still is the fallback)",
    });
  } else if (draft.imagePng) {
    await postDiscordImage(webhook, { filename: `x-${draft.angle}.png`, png: draft.imagePng });
  }
}

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

  // Dev/preview override: ?angle=deal_of_day forces an angle (bearer-gated, so
  // only the trusted caller can use it). Ignored unless it's a valid angle.
  const forceParam = new URL(request.url).searchParams.get("angle");
  const validAngles = [...POST_ANGLES, "weekly_board"];
  const forceAngle = forceParam && validAngles.includes(forceParam) ? (forceParam as PostAngle) : undefined;

  const result = await runXBot({
    mode,
    forceAngle,
    now,
    getDeals: () => getDealsForPost(now),
    getSpotlight: () => getSpotlightForPost(now),
    generateText: (input) => generatePostText(input),
    renderImage: async (input, deals) => {
      // Validated image system (ADR-072 follow-up): the daily deal/spotlight is a
      // CARD-HERO (real card art over its own sharp-derived "world"); the weekly
      // digest is the board. Real art is fetched here; a missing/broken art URL
      // falls back to the board (then text-only) so we never ship an artless hero.
      if (input.angle === "weekly_board") {
        return deals.length > 0 ? renderDealsImage({ deals, date: input.date }) : null;
      }
      if (input.angle === "deal_of_day" && deals[0]) {
        const art = await fetchCardArtBuffer(deals[0].imageUrl);
        if (art) return renderCardHeroImage({ artBuffer: art, ...heroFieldsForDeal(deals[0]), date: input.date });
        return deals.length > 0 ? renderDealsImage({ deals, date: input.date }) : null;
      }
      if (input.angle === "price_spotlight" && input.spotlight) {
        const art = await fetchCardArtBuffer(input.spotlight.imageUrl);
        if (art) return renderCardHeroImage({ artBuffer: art, ...heroFieldsForSpotlight(input.spotlight), date: input.date });
        return null;
      }
      // educational → text-only.
      return null;
    },
    renderVideo: async (input, _deals, still) => {
      // Motion is the standard for the card-hero angles only (ADR-074). The
      // board/educational stay still. Soft-fails to null → the still is posted.
      if (input.angle !== "deal_of_day" && input.angle !== "price_spotlight") return null;
      return renderCardHeroMotion({ stillPng: still });
    },
    post: (x) => postToX({ text: x.text, imagePng: x.imagePng, videoMp4: x.videoMp4 }),
    review: async (draft) => {
      if (!contentWebhook) return;
      await postSocialDraft(contentWebhook, {
        angle: draft.angle,
        text: draft.text,
        link: draft.link,
        hasImage: !!draft.imagePng || !!draft.videoMp4,
        dryRun: true,
      });
      // Attach the actual clip/portrait so John reviews the media, not just a note.
      await attachDraftMedia(contentWebhook, draft);
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
        videoBase64: draft.videoMp4 ? bytesToBase64(draft.videoMp4) : null,
        expiresAt,
      });
      if (!created) return null; // soft-fail: bot.ts reports approval_persist_failed.
      if (contentWebhook) {
        await postSocialApprovalRequest(contentWebhook, {
          draftId: created.id,
          angle: draft.angle,
          text: draft.text,
          link: draft.link,
          hasImage: !!draft.imagePng || !!draft.videoMp4,
          expiresLabel: `${DEFAULT_APPROVAL_EXPIRY_HOURS}h (then auto-skipped)`,
        });
        // Preview the EXACT reviewed media (clip if present, else still).
        await attachDraftMedia(contentWebhook, draft);
      }
      return { id: created.id };
    },
  });

  return NextResponse.json(result);
}
