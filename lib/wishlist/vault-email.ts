// Vault-link transactional email (watchlist-web-app, ADR-093). Two senders:
//   - the first-watch welcome (/api/start + the card-page action fire it when
//     an email's FIRST watch is created);
//   - the /w recovery form ("lost your link?").
// Same thin text-forward shape as the alert email (ADR-079 Primary-safe: no
// images, no buttons, one link + the unsubscribe footer). Soft-fail: a send
// failure never blocks the watch write or discloses anything to the caller.

import { buildVaultUrl } from "../vault-token.ts";
import { buildUnsubscribeUrl } from "../unsubscribe-token.ts";
import { sendTransactionalEmail } from "../notifications/resend.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function vaultEmailSubject(kind: "welcome" | "recovery"): string {
  return kind === "welcome" ? "Your Foil vault is open" : "Your Foil vault link";
}

export function vaultEmailBody(input: {
  kind: "welcome" | "recovery";
  vaultUrl: string;
  unsubscribeUrl: string | null;
}): string {
  const safeUrl = escapeHtml(input.vaultUrl);
  const intro =
    input.kind === "welcome"
      ? `<p style="font-size: 16px; margin: 0 0 8px;"><strong>Your vault is open.</strong></p>
<p style="font-size: 14px; color: #445; margin: 0 0 16px;">Every card you track lives on one page — see live prices, tune targets, pause or add cards any time. Keep this link; it's yours.</p>`
      : `<p style="font-size: 16px; margin: 0 0 8px;"><strong>Here's your vault link.</strong></p>
<p style="font-size: 14px; color: #445; margin: 0 0 16px;">This is the private link to the cards you're watching on Foil.</p>`;
  const footer = input.unsubscribeUrl
    ? `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin-top: 8px;">Don't want any email from Foil? <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #99a; text-decoration: underline;">Unsubscribe in one click</a>.</p>`
    : "";
  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a2333; background: #ffffff;">`,
    intro,
    `<p style="font-size: 15px; margin: 0 0 24px;"><a href="${safeUrl}" style="color: #0F1E3A; text-decoration: underline; text-underline-offset: 3px; font-weight: 600;">Open your vault →</a></p>`,
    `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin: 0;">Anyone with this link can view and edit your vault — treat it like a private calendar link.</p>`,
    footer,
    `</body></html>`,
  ].join("\n");
}

/** Send the vault link to an address. Never throws; returns whether the send
 *  was attempted+accepted (callers ignore it except for logging). */
export async function sendVaultLinkEmail(
  email: string,
  kind: "welcome" | "recovery",
): Promise<boolean> {
  try {
    const vaultUrl = buildVaultUrl(email);
    if (!vaultUrl) return false; // token secret missing — soft-fail, no broken links
    const res = await sendTransactionalEmail({
      to: email,
      subject: vaultEmailSubject(kind),
      html: vaultEmailBody({ kind, vaultUrl, unsubscribeUrl: buildUnsubscribeUrl(email) }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[vault-email] send threw: ${(err as Error).message}`);
    return false;
  }
}
