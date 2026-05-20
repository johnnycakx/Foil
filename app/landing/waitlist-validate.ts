// Pure parse + validate for the waitlist form. Lives outside waitlist-action.ts
// because Next.js Server Actions ("use server" files) may only export async
// functions — exporting parseWaitlistForm from that file blows up the compiler.
// Kept exported so tests can exercise the full prop → row path without
// stubbing Supabase.

export type WaitlistInsertRow = {
  email: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  referrer: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTRIBUTION_LEN = 512;

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_ATTRIBUTION_LEN
    ? trimmed.slice(0, MAX_ATTRIBUTION_LEN)
    : trimmed;
}

export function parseWaitlistForm(
  formData: FormData,
):
  | { ok: true; row: WaitlistInsertRow }
  | { ok: false; message: string } {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Enter your email." };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "That email doesn't look right — try again?" };
  }

  return {
    ok: true,
    row: {
      email,
      source: strOrNull(formData.get("source")) ?? "landing",
      utm_source: strOrNull(formData.get("utm_source")),
      utm_medium: strOrNull(formData.get("utm_medium")),
      utm_campaign: strOrNull(formData.get("utm_campaign")),
      landing_page: strOrNull(formData.get("landing_page")),
      referrer: strOrNull(formData.get("referrer")),
    },
  };
}
