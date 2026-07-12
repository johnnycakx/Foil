// Sanitize the post-auth redirect target (auth-hardening, 2026-07-12).
//
// The /auth/confirm route redirects wherever ?next= points after verifying a
// magic link. That param rides an emailed URL, so treat it as untrusted:
// same-origin PATHS only. Anything absolute, protocol-relative, or odd falls
// back to /account (the signed-in home).

export const DEFAULT_NEXT_PATH = "/account";

// A private base so the ONLY way the resolved URL keeps this origin is if
// `raw` is a genuine same-origin path. Protocol-relative or absolute inputs
// resolve to some other origin and get rejected.
const SENTINEL_ORIGIN = "https://foil-next-guard.invalid";

/**
 * True if the string carries any C0 control char or DEL.
 *
 * Load-bearing: the WHATWG URL parser SILENTLY STRIPS tab (0x09), LF (0x0A)
 * and CR (0x0D) before resolving, so "/<tab>/evil.com" sails past a naive
 * "//" or "\" prefix check and then collapses to protocol-relative — a real
 * bypass of this function's first draft (security-review F1, 2026-07-12).
 * Rejecting the whole class is cheaper than reasoning about each one.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Same-origin PATHS only. Resolve against a sentinel origin and demand the
 * origin survives, then hand back path+query+hash — no attacker host can ride
 * along even if the parser normalizes something unexpected.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH;
  if (hasControlChars(raw)) return DEFAULT_NEXT_PATH;
  const value = raw.trim();
  if (!value.startsWith("/")) return DEFAULT_NEXT_PATH;
  try {
    const resolved = new URL(value, SENTINEL_ORIGIN);
    if (resolved.origin !== SENTINEL_ORIGIN) return DEFAULT_NEXT_PATH;
    const out = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return out.startsWith("//") ? DEFAULT_NEXT_PATH : out;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}
