"use server";

import { subscribeEmail } from "@/lib/beehiiv";
import { recordSubscriber } from "@/lib/newsletter/subscribers";
import { postError, postSubscriberJoined } from "@/lib/notifications/discord";
import { queueEvent } from "@/lib/notifications/digest";

export type SubscribeActionResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_ERROR = "Could not subscribe. Try again.";

export async function subscribeAction(formData: FormData): Promise<SubscribeActionResult> {
  const rawEmail = String(formData.get("email") ?? "");
  const source = String(formData.get("source") ?? "unknown");

  // Inbound channel attribution (ADR-084). EmailCapture mirrors the landing
  // URL's utm_* (or a single ?src=) into hidden fields; recordSubscriber
  // sanitizes them. Missing params → null, never an error.
  const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : null);
  const utm = {
    source: str(formData.get("utm_source")),
    medium: str(formData.get("utm_medium")),
    campaign: str(formData.get("utm_campaign")),
  };

  const result = await subscribeEmail({ email: rawEmail, source });

  // Dual-write to the owned list (Supabase) + the Resend marketing audience
  // (ADR-078). Best-effort + non-blocking: the Beehiiv result above is what
  // gates the user-facing success; this just keeps our owned send-list in sync.
  if (result.ok) {
    void recordSubscriber({ email: rawEmail, source, utm });
  }

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
