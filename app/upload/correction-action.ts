"use server";

import { createClient } from "@/lib/supabase/server";

export type CorrectionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export async function submitCorrection(
  _prev: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not signed in." };

  const pick = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  };

  const correctedSet = pick("corrected_set");
  const correctedNumber = pick("corrected_card_number");
  const correctedName = pick("corrected_name");
  if (!correctedSet && !correctedNumber && !correctedName) {
    return { status: "error", message: "Fill in at least one corrected field." };
  }

  const { error } = await supabase.from("corrections").insert({
    user_id: user.id,
    original_name: pick("original_name"),
    original_set: pick("original_set"),
    original_card_number: pick("original_card_number"),
    corrected_name: correctedName,
    corrected_set: correctedSet,
    corrected_card_number: correctedNumber,
    notes: pick("notes"),
  });

  if (error) {
    console.error(`[correction] insert failed: ${error.message}`);
    return { status: "error", message: "Couldn't save the correction. Try again?" };
  }
  console.log(`[correction] user=${user.id} logged correction`);
  return { status: "ok" };
}
