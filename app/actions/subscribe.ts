"use server";

import { subscribeEmail } from "@/lib/beehiiv";
import { postError, postSubscriberJoined } from "@/lib/notifications/discord";
import { queueEvent } from "@/lib/notifications/digest";

export type SubscribeActionResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_ERROR = "Could not subscribe. Try again.";

export async function subscribeAction(formData: FormData): Promise<SubscribeActionResult> {
  const rawEmail = String(formData.get("email") ?? "");
  const source = String(formData.get("source") ?? "unknown");

  const result = await subscribeEmail({ email: rawEmail, source });

  if (!result.ok) {
    // Fire-and-forget #errors notification. Soft-fail — Discord outage must
    // not block the form (we already return the generic error string).
    const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
    if (webhook) {
      void postError(webhook, {
        source: "subscribe-action",
        errorType: "BeehiivSubscribeFailed",
        message: "subscribeEmail returned ok:false",
        context: { source, email_masked: maskInline(rawEmail) },
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  // Route to either real-time Discord post OR daily-digest queue (ADR-018).
  // DIGEST_MODE=daily → queue (one summary embed once a day). Default
  // ("realtime" or unset) → fire the per-event ping immediately.
  const digestMode = (process.env.DIGEST_MODE ?? "realtime").toLowerCase();
  if (digestMode === "daily") {
    void queueEvent({
      eventType: "subscriber_joined",
      channelTarget: "subscribers",
      payload: { email_masked: maskInline(rawEmail), source },
    });
  } else {
    const subWebhook = process.env.DISCORD_WEBHOOK_SUBSCRIBERS;
    if (subWebhook) {
      // Fire-and-forget; soft-fail. We don't await it so a slow Discord
      // doesn't add latency to the form submit.
      void postSubscriberJoined(subWebhook, {
        email: rawEmail,
        source,
        activeCount: null,
      });
    }
  }

  return { ok: true };
}

// Local inline mask so we don't import the full discord.ts maskEmail into the
// "use server" boundary unnecessarily — the postError helper would mask it
// via the email_masked field below anyway.
function maskInline(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
