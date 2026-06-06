// Daily X content-bot cron (ADR-058). Runs AFTER deals-refresh (08:00 UTC) at
// 14:00 UTC. Picks the day's angle, renders a branded portrait image from the
// buy_signals cache (R-008-safe), generates a voice-gated post, then:
//   - X_BOT_LIVE=true  → posts to X via the lib/social/x-client boundary.
//   - X_BOT_LIVE=false → (DEFAULT) posts a DRAFT to Discord #content-engine for
//     review. NO code path reaches the X API while false (see lib/social/bot.ts).
//
// Auth: same bearer-CRON_SECRET contract as the other crons. Soft-fail.

import { NextResponse } from "next/server";
import { runXBot } from "@/lib/social/bot";
import { getDealsForPost, getSpotlightForPost } from "@/lib/social/data";
import { generatePostText } from "@/lib/social/post-text";
import { renderDealsImage, renderSpotlightImage } from "@/lib/social/post-image";
import { postToX } from "@/lib/social/x-client";
import { postSocialDraft, postDiscordImage } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new NextResponse("missing_cron_secret", { status: 503 });
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) return new NextResponse("unauthorized", { status: 401 });

  const live = process.env.X_BOT_LIVE === "true"; // kill-switch; default false.
  const now = new Date();

  const result = await runXBot({
    live,
    now,
    getDeals: getDealsForPost,
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
      const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
      if (!webhook) return;
      await postSocialDraft(webhook, {
        angle: draft.angle,
        text: draft.text,
        link: draft.link,
        hasImage: !!draft.imagePng,
        dryRun: true,
      });
      // Attach the actual portrait so John reviews the image, not just a note.
      if (draft.imagePng) {
        await postDiscordImage(webhook, { filename: `x-${draft.angle}.png`, png: draft.imagePng });
      }
    },
  });

  return NextResponse.json(result);
}
