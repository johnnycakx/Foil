"use server";

import { createClient } from "@/lib/supabase/server";

export type ConfirmationState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function recordPositiveConfirmation(
  _prev: ConfirmationState,
  formData: FormData,
): Promise<ConfirmationState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const pick = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  };

  const { error } = await supabase.from("match_confirmations").insert({
    user_id: user.id,
    card_id: pick("card_id"),
    matched_image_url: pick("matched_image_url"),
    card_name: pick("card_name"),
    card_set: pick("card_set"),
    card_number: pick("card_number"),
    user_confirmed: true,
  });
  if (error) {
    console.error(`[confirmation] insert failed: ${error.message}`);
    return { status: "error", message: "Couldn't save the confirmation." };
  }
  console.log(`[confirmation] user=${user.id} confirmed match for ${pick("card_id") ?? "?"}`);
  return { status: "ok" };
}
