import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _admin: SupabaseClient<Database> | null = null;

export function supabaseAdmin(): SupabaseClient<Database> {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    }
    _admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
