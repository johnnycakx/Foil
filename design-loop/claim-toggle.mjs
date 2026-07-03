// eve-vault screenshot helper: insert/delete a demo claim row directly (no
// funnel side effects — no watchlist rows, no emails). Usage: node claim-toggle.mjs set|clear
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const mode = process.argv[2];
if (mode === "set") {
  const { error } = await admin.from("seeded_vault_claims").insert({ vault_slug: "demo", claimed_email: "evetest@example.com" });
  console.log(error ? `err: ${error.message}` : "demo claim set");
} else {
  const { error } = await admin.from("seeded_vault_claims").delete().eq("vault_slug", "demo").eq("claimed_email", "evetest@example.com");
  console.log(error ? `err: ${error.message}` : "demo claim cleared");
}
