// Resend transactional email wrapper. Two surfaces today:
//   1. Autonomous newsletter drafts emailed to the founder for manual
//      paste-into-Beehiiv (the Posts API is Enterprise-gated — see ADR-011
//      consequences → superseded by ADR-012). Repo-side artifact in
//      docs/newsletter-drafts/ is the permanent record.
//   2. Wishlist alert emails to subscribers when a watched card's current
//      best price meets their target (ADR-024).
//
// Server-side only. The free tier (3K/month, 100/day) covers both surfaces
// at current volume. Sender is `Foil <alerts@foiltcg.com>` — the
// foiltcg.com sending domain is verified on Resend (DNS records live in
// Vercel-managed DNS, verified 2026-05-24).

import { buildUnsubscribeUrl } from "../unsubscribe-token.ts";

export type NewsletterEmailInput = {
  /** Recipient inbox — founder by default; tests use a fixture address. */
  to: string;
  /** The newsletter's subject as Claude generated it (NOT the email subject). */
  subject: string;
  /** Inbox preview text (= 2nd-best subject candidate). */
  previewText: string;
  /** Full HTML body of the newsletter, exactly as it should land in Beehiiv. */
  body: string;
  /** Source blog post slug — used in the SOURCE BLOG POST section. */
  blogSlug: string;
  /** Absolute URL to the source blog post. */
  blogUrl: string;
  /** Why the engine chose this topic (from pickNextCandidateWithRationale). */
  topicRationale: string;
  /** Words in the generated newsletter body. */
  wordCount: number;
  /** Words in the source blog body — for the "source vs newsletter" ratio. */
  sourceWordCount: number;
  /** ISO timestamp when the draft was generated. */
  generatedAt: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; status?: number; error?: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_SENDER = "Foil <alerts@foiltcg.com>";

export const EMAIL_SUBJECT_PREFIX = "[Foil Draft] ";

// ---------------------------------------------------------------------------
// Generic transactional send. Used by the wishlist alert cron (ADR-024) +
// any future transactional surface (e.g. waitlist confirmations). Keeps the
// Resend fetch / API key / error shape in one place so callers stay terse.
// ---------------------------------------------------------------------------

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Optional override — defaults to DEFAULT_SENDER (`Foil <alerts@foiltcg.com>`). */
  sender?: string;
};

/**
 * Generic Resend POST. Soft-fail like sendNewsletterDraftEmail — never
 * throws; returns `{ok:false}` on any failure path so the caller (cron,
 * Server Action, etc) can log and continue.
 *
 * Task #18 (Session 37) adds RFC 8058 + RFC 2369 unsubscribe headers
 * whenever we can mint an unsubscribe token for the `to` address. Gmail,
 * Yahoo, and other deliverability-sensitive providers downgrade or
 * outright reject bulk mail without these headers; the inbox-level
 * "unsubscribe" button only appears when both List-Unsubscribe and
 * List-Unsubscribe-Post: List-Unsubscribe=One-Click are present and the
 * referenced endpoint returns 200 on POST.
 *
 * If UNSUBSCRIBE_TOKEN_SECRET is missing we soft-fail (no headers), since
 * sending a non-functional unsubscribe link is worse than sending none.
 */
export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "missing_api_key" };
  }
  if (!input.to?.trim() || !input.subject?.trim() || !input.html?.trim()) {
    return { ok: false, error: "missing_required_field" };
  }
  const fetchFn = opts.fetchImpl ?? fetch;

  const unsubscribeUrl = buildUnsubscribeUrl(input.to);
  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    // RFC 2369: at least one URI; RFC 8058: declare One-Click support so
    // mail clients render the inbox-level unsubscribe button.
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const payload: Record<string, unknown> = {
    from: input.sender ?? DEFAULT_SENDER,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (Object.keys(headers).length > 0) {
    payload.headers = headers;
  }

  try {
    const response = await fetchFn(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await safeText(response);
      return { ok: false, status: response.status, error: errText.slice(0, 200) };
    }
    const json = (await response.json()) as { id?: string };
    if (!json.id) {
      return { ok: false, status: response.status, error: "no_message_id" };
    }
    return { ok: true, messageId: json.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Send the manual-paste fallback email. Returns the Resend message id on
 * success or {ok:false} on any failure — the caller logs the warning and
 * continues so a Resend outage cannot break the autonomy pipeline.
 */
export async function sendNewsletterDraftEmail(
  input: NewsletterEmailInput,
  opts: { fetchImpl?: typeof fetch; sender?: string } = {},
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not set — skipping email send");
    return { ok: false, error: "missing_api_key" };
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const sender = opts.sender ?? DEFAULT_SENDER;

  const payload = {
    from: sender,
    to: [input.to],
    subject: `${EMAIL_SUBJECT_PREFIX}${input.subject}`,
    html: renderEmailHtml(input),
  };

  try {
    const response = await fetchFn(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await safeText(response);
      console.warn(`[resend] send failed: HTTP ${response.status} — ${errText.slice(0, 200)}`);
      return { ok: false, status: response.status, error: errText.slice(0, 200) };
    }
    const json = (await response.json()) as { id?: string };
    if (!json.id) {
      return { ok: false, status: response.status, error: "no_message_id" };
    }
    return { ok: true, messageId: json.id };
  } catch (err) {
    console.warn(`[resend] send threw: ${(err as Error).message}`);
    return { ok: false, error: (err as Error).message };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(no body)";
  }
}

// ---------------------------------------------------------------------------
// "Good buys this week" movers-digest delivery (ADR-077). On the owner's Discord
// /approve, the no-spend rail emails the founder the paste-ready issue (Beehiiv
// RSS-to-Send is a Max/Enterprise feature, not on Scale — so the send stays a
// manual Beehiiv paste). Deterministic body (no LLM); affiliate links already
// wrapped. Delegates to sendTransactionalEmail so the Resend plumbing stays in
// one place; soft-fail identical.
// ---------------------------------------------------------------------------

export type DigestApprovedEmailInput = {
  /** Founder inbox (the only recipient — this is an internal paste-ready email). */
  to: string;
  /** The newsletter subject the digest generated. */
  subject: string;
  previewText: string;
  /** The paste-ready Beehiiv body HTML (affiliate links already wrapped). */
  htmlBody: string;
  /** ISO week tag, e.g. "2026-W26". */
  issueWeek: string;
  downCount: number;
  upCount: number;
};

/** Wrap the approved digest in a paste-ready founder email: instructions + the
 *  subject/preview + the body in a bordered box + the deliverability reminders. */
export function renderDigestApprovedEmailHtml(input: DigestApprovedEmailInput): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.55; color: #1a1a1a;">`,
    `<h1 style="font-size: 20px; margin: 0 0 8px;">Approved: "Good buys this week" (${esc(input.issueWeek)})</h1>`,
    `<p style="color: #555; font-size: 13px; margin: 0 0 24px;">You approved this digest in Discord. Beehiiv RSS-to-Send is a Max/Enterprise feature (not on Scale), so paste the body below into Beehiiv to send. ${input.downCount} cooling-off + ${input.upCount} heating-up cards.</p>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #C9A24B;">Subject + preview</h2>`,
    `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">`,
    `<tr><td style="font-weight: 600; padding: 6px 8px; background: #f5f5f5; width: 130px;">Subject</td><td style="padding: 6px 8px; background: #f5f5f5;">${esc(input.subject)}</td></tr>`,
    `<tr><td style="font-weight: 600; padding: 6px 8px;">Preview text</td><td style="padding: 6px 8px;">${esc(input.previewText)}</td></tr>`,
    `</table>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #C9A24B;">Paste-ready body</h2>`,
    `<div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background: #fafafa; margin: 12px 0;">`,
    input.htmlBody,
    `</div>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #C9A24B;">How to send</h2>`,
    `<ol style="padding-left: 20px;">`,
    `<li>Open Beehiiv → <strong>Create New Post</strong>.</li>`,
    `<li>Paste the subject + preview text from above.</li>`,
    `<li>Paste the body HTML into the editor (use the code/source view if available).</li>`,
    `<li>Confirm the footer <strong>mailing address</strong> + <strong>sender display name</strong> are set (deliverability).</li>`,
    `<li>Send to the list (or schedule).</li>`,
    `</ol>`,
    `</body></html>`,
  ].join("\n");
}

export async function sendDigestApprovedEmail(
  input: DigestApprovedEmailInput,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<SendEmailResult> {
  return sendTransactionalEmail(
    {
      to: input.to,
      subject: `${EMAIL_SUBJECT_PREFIX}${input.subject}`,
      html: renderDigestApprovedEmailHtml(input),
    },
    opts,
  );
}

// ---------------------------------------------------------------------------
// Resend Audiences + Broadcasts (ADR-078). We OWN the newsletter send: the
// weekly digest goes out as a Resend Broadcast to our audience, instead of a
// manual Beehiiv paste (Beehiiv RSS-to-Send is Max/Enterprise; ADR-077). This
// is the SINGLE Resend boundary — no other module constructs api.resend.com
// broadcast/contact calls. Verified live 2026-06-28: create-audience, add-
// contact, create-broadcast, send-broadcast all work on our tier (a real test
// broadcast landed in the founder's Primary inbox).
//
// Resend injects List-Unsubscribe + the one-click unsubscribe natively for
// broadcasts via the {{{RESEND_UNSUBSCRIBE_URL}}} merge tag; that is the
// unsubscribe source of truth for the marketing list (the HMAC-token path in
// lib/unsubscribe-token.ts stays the transactional/wishlist unsubscribe).
// ---------------------------------------------------------------------------

const RESEND_AUDIENCES_ENDPOINT = "https://api.resend.com/audiences";
const RESEND_BROADCASTS_ENDPOINT = "https://api.resend.com/broadcasts";

/** Default broadcast sender. A dedicated marketing subdomain (news.foiltcg.com)
 *  is the deliverability best practice (protects the transactional reputation);
 *  until that DNS is set up, the verified transactional sender is used. */
export const DEFAULT_NEWSLETTER_FROM = "Foil <alerts@foiltcg.com>";

/** CAN-SPAM physical mailing address (Foil TCG, LLC). Appended to every
 *  broadcast footer alongside the native unsubscribe link. */
export const CAN_SPAM_ADDRESS = "Foil TCG, LLC, 2710 Southern Hills Ct, Fairfield, CA 94534";

export type ResendContactResult = { ok: true; contactId: string | null } | { ok: false; error: string };

/**
 * Upsert a contact into a Resend audience (the marketing list). Best-effort:
 * an "already exists" response is treated as success (the email is on the list,
 * which is the only outcome callers need). Soft-fail; never throws.
 */
export async function upsertResendContact(
  input: { email: string; audienceId: string; firstName?: string; unsubscribed?: boolean },
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<ResendContactResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "missing_api_key" };
  if (!input.email?.trim() || !input.audienceId?.trim()) return { ok: false, error: "missing_required_field" };
  const fetchFn = opts.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(`${RESEND_AUDIENCES_ENDPOINT}/${input.audienceId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        first_name: input.firstName,
        unsubscribed: input.unsubscribed ?? false,
      }),
    });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, contactId: json.id ?? null };
    }
    // A duplicate email in the audience is fine (the contact is present).
    if (res.status === 409 || res.status === 422) return { ok: true, contactId: null };
    return { ok: false, error: `http_${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type BroadcastResult = { ok: true; broadcastId: string } | { ok: false; error: string };

/**
 * Create a broadcast for an audience and SEND it (or schedule it). The two-step
 * Resend flow (POST /broadcasts then POST /broadcasts/{id}/send) is encapsulated
 * here so callers get one idempotent-friendly call. `html` should already carry
 * the {{{RESEND_UNSUBSCRIBE_URL}}} merge tag + CAN-SPAM footer (use
 * `wrapBroadcastFooter`). Soft-fail; never throws.
 */
export async function sendResendBroadcast(
  input: { audienceId: string; subject: string; html: string; name: string; from?: string; replyTo?: string; scheduledAt?: string },
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<BroadcastResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "missing_api_key" };
  if (!input.audienceId?.trim() || !input.subject?.trim() || !input.html?.trim()) {
    return { ok: false, error: "missing_required_field" };
  }
  const fetchFn = opts.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  try {
    const createRes = await fetchFn(RESEND_BROADCASTS_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        audience_id: input.audienceId,
        from: input.from ?? process.env.NEWSLETTER_FROM ?? DEFAULT_NEWSLETTER_FROM,
        reply_to: input.replyTo,
        subject: input.subject,
        name: input.name,
        html: input.html,
      }),
    });
    if (!createRes.ok) {
      return { ok: false, error: `create_http_${createRes.status}: ${(await safeText(createRes)).slice(0, 200)}` };
    }
    const created = (await createRes.json().catch(() => ({}))) as { id?: string };
    if (!created.id) return { ok: false, error: "no_broadcast_id" };

    const sendRes = await fetchFn(`${RESEND_BROADCASTS_ENDPOINT}/${created.id}/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(input.scheduledAt ? { scheduled_at: input.scheduledAt } : {}),
    });
    if (!sendRes.ok) {
      return { ok: false, error: `send_http_${sendRes.status}: ${(await safeText(sendRes)).slice(0, 200)}` };
    }
    return { ok: true, broadcastId: created.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Append the compliance footer (native one-click unsubscribe + CAN-SPAM
 *  mailing address) to a digest body for a Resend broadcast. The
 *  {{{RESEND_UNSUBSCRIBE_URL}}} merge tag is rendered per-recipient by Resend. */
export function wrapBroadcastFooter(bodyHtml: string): string {
  return (
    bodyHtml +
    `\n<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0" />` +
    `\n<p style="color:#888;font-size:12px;line-height:1.5">${CAN_SPAM_ADDRESS}.` +
    ` You are receiving this because you subscribed at foiltcg.com.` +
    ` <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>.</p>`
  );
}

/**
 * Build the email HTML. Four labeled sections per ADR-012:
 *   (a) WHY THIS TOPIC
 *   (b) NEWSLETTER PREVIEW (subject + preview text + full body)
 *   (c) HOW TO PUBLISH (numbered steps)
 *   (d) SOURCE BLOG POST (link + word counts)
 *
 * Exported for the file-writer to share the body string when it lands the
 * repo artifact — same content, slightly different framing.
 */
export function renderEmailHtml(input: NewsletterEmailInput): string {
  const safeSubject = escapeHtml(input.subject);
  const safePreview = escapeHtml(input.previewText);
  const safeRationale = escapeHtml(input.topicRationale);
  const safeBlogSlug = escapeHtml(input.blogSlug);
  const safeBlogUrl = escapeHtml(input.blogUrl);
  const generatedHuman = escapeHtml(input.generatedAt);

  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.55; color: #1a1a1a;">`,
    `<h1 style="font-size: 20px; margin: 0 0 8px;">Foil newsletter draft — manual paste required</h1>`,
    `<p style="color: #555; font-size: 13px; margin: 0 0 24px;">Beehiiv's Posts API is Enterprise-gated; copy the body below into Beehiiv's UI to schedule. Generated ${generatedHuman}.</p>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #FF6B5C;">a) Why this topic</h2>`,
    `<p>${safeRationale}</p>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #FF6B5C;">b) Newsletter preview</h2>`,
    `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">`,
    `<tr><td style="font-weight: 600; padding: 6px 8px; background: #f5f5f5; width: 130px;">Subject</td><td style="padding: 6px 8px; background: #f5f5f5;">${safeSubject}</td></tr>`,
    `<tr><td style="font-weight: 600; padding: 6px 8px;">Preview text</td><td style="padding: 6px 8px;">${safePreview}</td></tr>`,
    `<tr><td style="font-weight: 600; padding: 6px 8px; background: #f5f5f5;">Word count</td><td style="padding: 6px 8px; background: #f5f5f5;">${input.wordCount} (source blog: ${input.sourceWordCount})</td></tr>`,
    `</table>`,
    `<div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background: #fafafa; margin: 12px 0;">`,
    input.body,
    `</div>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #FF6B5C;">c) How to publish</h2>`,
    `<ol style="padding-left: 20px;">`,
    `<li>Open Beehiiv → <strong>Create New Post</strong>.</li>`,
    `<li>Paste the subject from section (b) into the Post title field.</li>`,
    `<li>Paste the preview text into the inbox preview field.</li>`,
    `<li>Paste the newsletter HTML body into the editor (use the source / code-view toggle if Beehiiv has one).</li>`,
    `<li>Pick a send time → <strong>Schedule</strong> (or Send Now).</li>`,
    `</ol>`,
    `<p style="color: #555; font-size: 13px;">A copy of this draft is also saved to <code>docs/newsletter-drafts/${safeBlogSlug}.md</code> in the repo — that's the permanent record if you lose this email.</p>`,

    `<h2 style="font-size: 16px; margin: 24px 0 8px; padding-top: 16px; border-top: 2px solid #FF6B5C;">d) Source blog post</h2>`,
    `<p>Slug: <code>${safeBlogSlug}</code><br/>URL: <a href="${safeBlogUrl}">${safeBlogUrl}</a><br/>Source word count: ${input.sourceWordCount} · Newsletter word count: ${input.wordCount}</p>`,

    `</body></html>`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
