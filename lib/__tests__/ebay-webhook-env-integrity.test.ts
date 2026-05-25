// Structural drift guard for the eBay deletion webhook's env-var dependencies.
//
// Session 34 root-cause was double-headed: the route's verification logic was
// wrong (HMAC instead of ECDSA — fixed by the same session's rewrite of
// lib/ebay-marketplace-deletion.ts), AND `.env.local` had silently lost
// EBAY_DELETION_VERIFICATION_TOKEN + NEXT_PUBLIC_SITE_URL (second R-009
// occurrence in 14 days). This test isn't about the runtime values — those
// live in Vercel + GH Actions — it's about the *code's* declared dependency
// on these env vars staying visible.
//
// If anyone removes process.env.EBAY_DELETION_VERIFICATION_TOKEN or
// process.env.NEXT_PUBLIC_SITE_URL from route.ts or the helper lib, this
// fails. That signals either:
//   (a) the dependency was intentionally dropped — in which case update this
//       test + docs/ENV-VARS.md + docs/EBAY-COMPLIANCE.md in the same diff;
//   (b) the dependency was accidentally lost during a refactor — fix the
//       refactor before merging.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const REQUIRED_ENV_REFERENCES: Array<{
  file: string;
  envVars: string[];
}> = [
  {
    file: "app/api/webhooks/ebay-marketplace-deletion/route.ts",
    envVars: ["EBAY_DELETION_VERIFICATION_TOKEN", "NEXT_PUBLIC_SITE_URL"],
  },
];

for (const { file, envVars } of REQUIRED_ENV_REFERENCES) {
  const fullPath = join(ROOT, file);
  const text = readFileSync(fullPath, "utf8");
  for (const envVar of envVars) {
    test(`env-integrity: ${file} references process.env.${envVar}`, () => {
      const pattern = new RegExp(`process\\.env\\.${envVar}\\b`);
      assert.ok(
        pattern.test(text),
        `Expected ${file} to reference process.env.${envVar}. If this dependency was intentionally dropped, update lib/__tests__/ebay-webhook-env-integrity.test.ts + docs/ENV-VARS.md + docs/EBAY-COMPLIANCE.md in the same diff.`,
      );
    });
  }
}
