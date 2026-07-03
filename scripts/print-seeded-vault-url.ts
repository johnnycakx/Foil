// Print a seeded vault's URL (eve-vault, ADR-100). Founder utility for the
// live claim test: mint the DEMO vault link, claim it with a test email on
// your phone, verify the welcome email + rows, then clean up — before the
// real link ever goes out.
//
//   node --env-file=.env.local --experimental-strip-types scripts/print-seeded-vault-url.ts demo
//   node --env-file=.env.local --experimental-strip-types scripts/print-seeded-vault-url.ts eve --base https://foiltcg.com

import { buildSeededVaultUrl } from "../lib/vault-token.ts";
import { getSeededVault, SEEDED_VAULTS } from "../lib/vault-seeds.ts";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--")) ?? "demo";
const baseIdx = args.indexOf("--base");
const baseUrl = baseIdx >= 0 ? args[baseIdx + 1] : "https://foiltcg.com";

const vault = getSeededVault(id);
if (!vault) {
  console.error(`Unknown seeded vault "${id}". Known: ${Object.keys(SEEDED_VAULTS).join(", ")}`);
  process.exit(1);
}
const url = buildSeededVaultUrl(vault.id, { baseUrl });
if (!url) {
  console.error("Could not mint (UNSUBSCRIBE_TOKEN_SECRET missing — pass --env-file=.env.local).");
  process.exit(1);
}
console.log(url);
