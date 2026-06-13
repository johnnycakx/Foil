"use server";

// /host venue-funnel lead capture (vending pivot — docs/vending Goal A §2).
//
// PRIMARY channel: a Resend email to the founder, so every lead lands in a
// human inbox. lib/notifications/resend.ts is the single email boundary.
// Goal A specified email-only; because the Jun-12 host_leads table is already
// applied in prod, we ALSO best-effort persist the lead (a durable record that
// can never be lost to a Resend outage) and best-effort ping Discord. The
// email is the channel that MUST work — a submission only fails if no channel
// accepted it.
//
// Security (the /security-review focus area): every field is shape-validated +
// length-capped by validateHostLead before use; the email subject strips CR/LF
// (defensive header-injection guard) and the HTML body escapes every
// user-controlled value (HTML/script-injection guard). The recipient is a
// fixed founder address, never derived from form input (no open relay).

import { supabaseAdmin } from "@/lib/supabase/admin";
import { postHostLead } from "@/lib/notifications/discord";
import { sendTransactionalEmail } from "@/lib/notifications/resend";
import { validateHostLead, type ValidatedHostLead } from "@/lib/vending/validate";

export type HostLeadFormState = {
  status: "idle" | "success" | "error";
  error?: string;
};

/** Max submissions per email per 24h. Legitimate hosts submit once, maybe
 *  twice after a typo; anything past this is scripted. */
const MAX_LEADS_PER_EMAIL_PER_DAY = 3;

// Confirmed lead inbox (goal directive 2026-06-13). Env-overridable so moving
// to a leads@/hello@ alias later is a config change, not a redeploy. NEVER
// derived from form input — the recipient is fixed.
const LEAD_NOTIFICATION_EMAIL =
  process.env.LEAD_NOTIFICATION_EMAIL ?? "john.c.craig24@gmail.com";

const FIELD_LABELS: Record<keyof ValidatedHostLead, string> = {
  name: "Contact name",
  business_name: "Business",
  venue_type: "Venue type",
  city: "City / area",
  email: "Email",
  phone: "Phone",
  foot_traffic: "Daily foot traffic",
  hours_of_access: "Hours of access",
  placement_outlet: "Space + outlet",
  sells_cards: "Already sells cards",
  priority: "What matters most",
  notes: "About the space",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse any CR/LF so a value can't be smuggled into the subject header. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function renderLeadEmail(lead: ValidatedHostLead): string {
  const rows = (Object.keys(FIELD_LABELS) as Array<keyof ValidatedHostLead>)
    .map((key) => {
      const raw = lead[key];
      if (raw == null || raw === "") return null;
      return `<tr><td style="font-weight:600;padding:6px 10px;background:#f5f5f5;vertical-align:top;white-space:nowrap;">${escapeHtml(
        FIELD_LABELS[key],
      )}</td><td style="padding:6px 10px;">${escapeHtml(String(raw))}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  return [
    `<!doctype html>`,
    `<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;line-height:1.5;color:#1a1a1a;">`,
    `<h1 style="font-size:18px;margin:0 0 4px;">New host-a-machine lead</h1>`,
    `<p style="color:#555;font-size:13px;margin:0 0 16px;">${escapeHtml(
      lead.business_name,
    )} — ${escapeHtml(lead.city)}. Reply directly to start the conversation.</p>`,
    `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`,
    `<p style="color:#888;font-size:12px;margin-top:20px;">Sent by the foiltcg.com /host form.</p>`,
    `</body></html>`,
  ].join("\n");
}

export async function createHostLead(
  _prev: HostLeadFormState,
  formData: FormData,
): Promise<HostLeadFormState> {
  // Honeypot: silently succeed so bots get no signal to iterate against.
  if (String(formData.get("website") ?? "").length > 0) {
    return { status: "success" };
  }

  const parsed = validateHostLead({
    name: formData.get("name"),
    business_name: formData.get("business_name"),
    venue_type: formData.get("venue_type"),
    city: formData.get("city"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    foot_traffic: formData.get("foot_traffic"),
    hours_of_access: formData.get("hours_of_access"),
    placement_outlet: formData.get("placement_outlet"),
    sells_cards: formData.get("sells_cards"),
    priority: formData.get("priority"),
    notes: formData.get("notes"),
  });
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }
  const lead = parsed.value;

  // Best-effort DB handle. If unavailable, we still email — email is primary.
  let admin: ReturnType<typeof supabaseAdmin> | null = null;
  try {
    admin = supabaseAdmin();
  } catch {
    console.warn("[host-lead] supabaseAdmin() unavailable — email-only path");
  }

  // Per-email 24h cap when the DB is reachable. Soft-fail OPEN on a count
  // error (a metrics hiccup must not drop a real venue lead).
  if (admin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("host_leads")
      .select("id", { count: "exact", head: true })
      .eq("email", lead.email)
      .gte("created_at", since);
    if (!countError && (count ?? 0) >= MAX_LEADS_PER_EMAIL_PER_DAY) {
      return { status: "error", error: "rate_limited" };
    }
  }

  // PRIMARY: email the founder. Subject fields are CR/LF-stripped so they
  // cannot inject extra headers; the recipient is fixed.
  const subject = oneLine(`New host lead: ${lead.business_name} (${lead.city})`).slice(0, 200);
  const emailResult = await sendTransactionalEmail({
    to: LEAD_NOTIFICATION_EMAIL,
    subject,
    html: renderLeadEmail(lead),
  });
  if (!emailResult.ok) {
    console.warn(`[host-lead] email send failed: ${emailResult.error ?? "unknown"}`);
  }

  // SECONDARY (best-effort, never blocks success): durable DB record.
  let persisted = false;
  if (admin) {
    const { error } = await admin.from("host_leads").insert(lead);
    if (error) {
      console.warn("[host-lead] insert failed:", error.message);
    } else {
      persisted = true;
    }
  }

  // SECONDARY (best-effort, fire-and-forget): founder Discord ping.
  const webhook = process.env.DISCORD_WEBHOOK_SUBSCRIBERS;
  if (webhook) {
    void postHostLead(webhook, {
      businessName: lead.business_name,
      venueType: lead.venue_type,
      city: lead.city,
      email: lead.email,
      footTraffic: lead.foot_traffic,
      sellsCards: lead.sells_cards,
    });
  }

  // Only a true failure if NO durable channel accepted the lead.
  if (!emailResult.ok && !persisted) {
    return { status: "error", error: "send_failed" };
  }

  return { status: "success" };
}
