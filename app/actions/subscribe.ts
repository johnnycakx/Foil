"use server";

import { subscribeEmail } from "@/lib/beehiiv";

export type SubscribeActionResult =
  | { ok: true }
  | { ok: false; error: string };

const GENERIC_ERROR = "Could not subscribe. Try again.";

export async function subscribeAction(formData: FormData): Promise<SubscribeActionResult> {
  const email = String(formData.get("email") ?? "");
  const source = String(formData.get("source") ?? "unknown");

  const result = await subscribeEmail({ email, source });
  if (!result.ok) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}
