// RFC 8058 / RFC 2369 one-click unsubscribe endpoint.
//
// Two HTTP verbs handled, both gate-skipped (PUBLIC_ROUTES).
//
//   GET  /api/unsubscribe?token=<HMAC-token>
//       Visible-link path. User clicks the link in the email body, lands
//       on a confirmation page rendered as HTML. Token is HMAC-verified;
//       on success we attempt to mark the email inactive on Beehiiv. Even
//       if the Beehiiv call fails (free-tier limit, network), the user
//       sees a success page — the email IS the receipt; retrying works.
//
//   POST /api/unsubscribe?token=<HMAC-token>  (List-Unsubscribe-Post)
//       The RFC 8058 one-click path. Mail clients (Gmail, Yahoo) POST
//       with body "List-Unsubscribe=One-Click" when the user clicks the
//       inbox-level unsubscribe button. We MUST respond 200 quickly with
//       no body interpretation needed by the client. Same verify + Beehiiv
//       update logic as GET.
//
// Both verbs accept the same HMAC token format from lib/unsubscribe-token.
// See ADR-027 + Task #18 / Session 37.

import { NextResponse } from "next/server";
import { syncUnsubscribe } from "@/lib/newsletter/unsubscribe-sync";
import { pauseWatchlistAlerts } from "@/lib/wishlist/pause";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getToken(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

async function processUnsubscribe(
  token: string | null,
): Promise<{ status: number; emailMasked: string | null; tokenOk: boolean }> {
  if (!token) {
    return { status: 400, emailMasked: null, tokenOk: false };
  }
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return { status: 400, emailMasked: null, tokenOk: false };
  }
  // This link arrives in BOTH email types (newsletter + wishlist alerts), and
  // Gmail's inbox-level one-click gives no way to pick — so honoring it means
  // stopping EVERYTHING for the verified address (start-funnel-integrity,
  // ADR-090; before this, the alert cron kept sending forever):
  //   - syncUnsubscribe: newsletter opt-out in Supabase (the send path's
  //     source of truth) + Beehiiv — replaces the old Beehiiv-only call;
  //   - pauseWatchlistAlerts: alerts_paused_at on every watchlists row, which
  //     the alert cron's scan excludes.
  // Both legs are idempotent + never throw. Even on internal failure we render
  // success — the user's intent is clear, and a retry works.
  await Promise.all([
    syncUnsubscribe(verified.email),
    pauseWatchlistAlerts(verified.email),
  ]);
  return { status: 200, emailMasked: maskEmail(verified.email), tokenOk: true };
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(opts: { ok: boolean; emailMasked: string | null }): string {
  const safeEmail = opts.emailMasked ? escapeHtml(opts.emailMasked) : "";
  const heading = opts.ok
    ? "You&rsquo;ve been unsubscribed."
    : "Unsubscribe link is invalid or expired.";
  const body = opts.ok
    ? `<p>The email address <code>${safeEmail}</code> won&rsquo;t receive any more email from Foil — the newsletter and every card price alert are both stopped.</p>
       <p>Changed your mind about the newsletter? Rejoin any time at <a href="/newsletter">foiltcg.com/newsletter</a>.</p>`
    : `<p>This unsubscribe link doesn&rsquo;t look valid. If you arrived here from a Foil email and want to stop receiving it, email <a href="mailto:john.c.craig24@gmail.com">john.c.craig24@gmail.com</a> and we&rsquo;ll remove you by hand within 24 hours.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${opts.ok ? "Unsubscribed — Foil" : "Unsubscribe — Foil"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #0B1428; color: #fff; margin: 0;
           min-height: 100vh; display: flex; align-items: center; justify-content: center;
           padding: 24px; line-height: 1.55; }
    .card { max-width: 560px; background: #101D38; border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 16px; }
    p { margin: 0 0 12px; color: #d4d4d8; font-size: 15px; }
    a { color: #FFC7BA; text-decoration: underline; text-underline-offset: 3px; }
    code { background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;
           font-family: SFMono-Regular, Menlo, monospace; font-size: 13px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${heading}</h1>
    ${body}
  </main>
</body>
</html>`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const token = getToken(request);
  const result = await processUnsubscribe(token);
  return new NextResponse(renderHtml({ ok: result.tokenOk, emailMasked: result.emailMasked }), {
    status: result.status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  // One-click POST per RFC 8058. The mail client sends a body of
  // "List-Unsubscribe=One-Click"; we don't read it. We just need to
  // respond 200 quickly when the token is valid.
  const token = getToken(request);
  const result = await processUnsubscribe(token);
  return new NextResponse(null, { status: result.status });
}
