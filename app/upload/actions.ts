"use server";

import { createClient } from "@/lib/supabase/server";

export type ScanResult =
  | { ok: true; placeholder: true; fileName: string; sizeBytes: number; mimeType: string }
  | { ok: false; error: string };

export async function scanPhoto(formData: FormData): Promise<ScanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }

  console.log(
    `[scanPhoto] user=${user.id} name=${file.name} size=${file.size}B type=${file.type}`,
  );

  return {
    ok: true,
    placeholder: true,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  };
}
