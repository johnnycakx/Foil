// /eve — vanity shortcut to eve's seeded gift vault (eve-vault, ADR-100).
// The reply shows a clean top-level link; this MINTS the seeded-vault token
// at request time (the secret lives in env — nothing hardcoded, works across
// environments) and 302s to /w/<token> with the eve-send UTMs. TEMPORARY 302
// by design, same as /umbreon: never cache a permanent redirect into X.
//
// Soft-fall: if the token can't mint (secret missing), redirect to /start
// with the same attribution — a link in a live tweet must never 404.

// Relative + extensioned import (not "@/lib/...") so the proxy test can load
// this handler under node --experimental-strip-types, same as the lib files.
import { mintSeededVaultToken } from "../../lib/vault-token.ts";

export function GET(request: Request): Response {
  const token = mintSeededVaultToken("eve");
  const path = token
    ? `/w/${encodeURIComponent(token)}?utm_source=x&utm_medium=eve`
    : "/start?utm_source=x&utm_medium=eve&src=eve-vault";
  return Response.redirect(new URL(path, request.url), 302);
}
