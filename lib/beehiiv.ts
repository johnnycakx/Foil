// Server-side Beehiiv wrapper. CORS blocks browser → api.beehiiv.com, so
// every call MUST originate here — never from a Client Component. The API key
// stays in process.env on the server.
//
// See ADR-010 (Beehiiv for newsletter list management) for the why.

import { BeehiivClient, Beehiiv } from "@beehiiv/sdk";
import { z } from "zod";

export type SubscribeInput = {
  email: string;
  source: string;
  /** Beehiiv-side utm_medium. Default "email-capture" (every site capture).
   *  The seeded-vault claim path passes "vault-claim" — the flag the welcome
   *  automation's trigger condition keys on to SUPPRESS the generic welcome
   *  (claimants already get the vault email; two welcomes is the bug —
   *  welcome-email-overhaul). Changing this string breaks the live Beehiiv
   *  trigger condition; it's pinned in lib/__tests__/beehiiv.test.ts. */
  utmMedium?: "email-capture" | "vault-claim";
};

export type SubscribeResult =
  | { ok: true; status: "subscribed" | "pending" }
  | { ok: false };

// Single shape both for inline form input and the test harness — zod gives us
// trim/lowercase + email validation in one shot.
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().min(1).max(128),
  utmMedium: z.enum(["email-capture", "vault-claim"]).default("email-capture"),
});

let cachedClient: BeehiivClient | null = null;

function getClient(): BeehiivClient {
  if (cachedClient) return cachedClient;
  const token = process.env.BEEHIIV_API_KEY;
  if (!token) throw new Error("BEEHIIV_API_KEY is not set");
  cachedClient = new BeehiivClient({ token });
  return cachedClient;
}

function getPublicationId(): string {
  const id = process.env.BEEHIIV_PUBLICATION_ID;
  if (!id) throw new Error("BEEHIIV_PUBLICATION_ID is not set");
  return id;
}

// Allow tests to inject a stub client without touching env vars.
export function __setClientForTests(client: BeehiivClient | null): void {
  cachedClient = client;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 400;

export async function subscribeEmail(input: SubscribeInput): Promise<SubscribeResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const { email, source, utmMedium } = parsed.data;
  const client = getClient();
  const publicationId = getPublicationId();

  const request: Beehiiv.SubscriptionRequest = {
    email,
    reactivate_existing: true,
    send_welcome_email: false,
    utm_source: "foil-blog",
    utm_medium: utmMedium,
    utm_campaign: source,
    referring_site: "foiltcg.com",
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      const response = await client.subscriptions.create(publicationId, request);
      const status = response.data?.status;
      // Beehiiv returns the existing row unchanged when reactivate_existing is
      // true and the email is already on the list — same shape as a fresh
      // create. Either way the email is on the list, which is the only outcome
      // the caller needs.
      return {
        ok: true,
        status: status === "pending" ? "pending" : "subscribed",
      };
    } catch (err) {
      lastError = err;
      if (err instanceof Beehiiv.TooManyRequestsError && attempt < MAX_RATE_LIMIT_RETRIES) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  // Generic failure — never leak Beehiiv error text to the caller. The reason
  // a subscribe failed is interesting for ops, not for the user.
  if (lastError) {
    // eslint-disable-next-line no-console
    console.error("[beehiiv] subscribeEmail failed", lastError);
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// Unsubscribe — RFC 8058 one-click + visible link in every email.
// ---------------------------------------------------------------------------

export type UnsubscribeResult =
  | { ok: true; status: "unsubscribed" | "already_inactive" | "not_found" }
  | { ok: false };

/**
 * Mark a subscriber inactive on Beehiiv via the SDK's `updateByEmail`
 * (`PUT /publications/{pub}/subscriptions/by_email/{email}` with
 * `{ unsubscribe: true }`) — one call that targets the subscription by email
 * and lands it at status `inactive`. Verified live 2026-06-29 (active → inactive).
 *
 * History ([ADR-083](../docs/DECISIONS.md), amends ADR-082): the prior
 * implementation called `client.subscriptions.list(...)` then `.update(...)`
 * through `as unknown as {...}` casts — but NEITHER method exists on the SDK
 * (the real surface is `index` + `updateByEmail`/`put`/`patch`). The cast hid
 * that from the typechecker, so at runtime the first call threw on the missing
 * method and the Beehiiv leg **silently failed**: a Resend-unsubscribed contact
 * was left `active` in Beehiiv (the bug ADR-082's live test caught). The fix
 * uses the typed SDK method, so a future SDK signature change fails the build.
 *
 * Soft-fail — returns ok:false on any real failure so the caller (the Resend
 * unsubscribe-sync) can log + continue. A 404 (`NotFoundError`) means the email
 * isn't a subscriber → treated as success (they're effectively unsubscribed),
 * never a failure.
 */
export async function unsubscribeEmail(email: string): Promise<UnsubscribeResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false };

  let client: BeehiivClient;
  let publicationId: string;
  try {
    client = getClient();
    publicationId = getPublicationId();
  } catch {
    return { ok: false };
  }

  try {
    // PUT with unsubscribe:true is idempotent — a re-unsubscribe of an already
    // inactive row is a no-op that still resolves with status "inactive".
    await client.subscriptions.updateByEmail(publicationId, normalized, { unsubscribe: true });
    return { ok: true, status: "unsubscribed" };
  } catch (err) {
    if (err instanceof Beehiiv.NotFoundError) {
      return { ok: true, status: "not_found" };
    }
    // eslint-disable-next-line no-console
    console.error("[beehiiv] unsubscribeEmail failed", err);
    return { ok: false };
  }
}
