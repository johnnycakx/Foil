"use server";

// /machines restock-alert signup (vending Phase V-1).
//
// Writes a machine_restock_alerts row (the durable, location-anchorable
// record the V-2 send path will walk) and then soft-fail subscribes the email
// to Beehiiv with the machines source tag. Pre-placement rows carry
// location_key null = "the first machine near me"; the optional city free-text
// maps that demand to real geography for placement decisions.
//
// The DB row is the primary write: a Beehiiv outage can never lose a signup.
// Duplicate signups are idempotent (unique index on email + location + scope;
// a 23505 conflict is reported as success because the user IS on the list).

import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";
import { validateRestockSignup } from "@/lib/vending/validate";

export type RestockAlertFormState = {
  status: "idle" | "success" | "error";
  error?: string;
};

export async function createRestockAlert(
  _prev: RestockAlertFormState,
  formData: FormData,
): Promise<RestockAlertFormState> {
  // Honeypot: real users never see or fill the "website" field. A filled
  // honeypot returns success without writing, so bots get no signal.
  if (String(formData.get("website") ?? "").length > 0) {
    return { status: "success" };
  }

  const parsed = validateRestockSignup({
    email: formData.get("email"),
    city: formData.get("city"),
  });
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    console.warn("[restock-alert] supabaseAdmin() unavailable");
    return { status: "error", error: "unavailable" };
  }

  const { error } = await admin.from("machine_restock_alerts").insert({
    email: parsed.value.email,
    location_key: null,
    product_scope: "any",
    city: parsed.value.city,
  });
  // 23505 = unique violation: this email is already on the pre-placement
  // list, which is the outcome the user asked for.
  if (error && error.code !== "23505") {
    console.warn("[restock-alert] insert failed:", error.message);
    return { status: "error", error: "save_failed" };
  }

  // Beehiiv subscribe with the machines source tag. Soft-fail per ADR-010:
  // the DB row above is the durable record; the newsletter tag is best-effort.
  try {
    const sub = await subscribeEmail({ email: parsed.value.email, source: "machines-waitlist" });
    if (!sub.ok) console.warn("[restock-alert] beehiiv subscribe returned ok:false");
  } catch (err) {
    console.warn("[restock-alert] beehiiv subscribe threw:", (err as Error).message);
  }

  return { status: "success" };
}
