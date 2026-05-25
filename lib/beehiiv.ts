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
};

export type SubscribeResult =
  | { ok: true; status: "subscribed" | "pending" }
  | { ok: false };

// Single shape both for inline form input and the test harness — zod gives us
// trim/lowercase + email validation in one shot.
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().min(1).max(128),
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

  const { email, source } = parsed.data;
  const client = getClient();
  const publicationId = getPublicationId();

  const request: Beehiiv.SubscriptionRequest = {
    email,
    reactivate_existing: true,
    send_welcome_email: false,
    utm_source: "foil-blog",
    utm_medium: "email-capture",
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
 * Mark a subscriber inactive on Beehiiv. Soft-fail — returns ok:false on
 * any API failure path so the calling route handler can still render a
 * "you've been unsubscribed" confirmation to the user (the email IS the
 * receipt; even if Beehiiv was down, retrying the link works).
 *
 * The unsubscribe endpoint is publicly addressable (any holder of a
 * valid HMAC token can hit it on behalf of the embedded email), so the
 * lookup-then-update path lives behind the route handler's HMAC verify.
 *
 * `not_found` is treated as a success — if the email isn't on the list,
 * the user IS effectively unsubscribed.
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

  // Look up subscription by email. The SDK's list method supports an
  // email filter. If the email isn't on the list at all, treat as success.
  try {
    const listResponse = (await (
      client.subscriptions as unknown as {
        list: (
          pubId: string,
          req: { email?: string; limit?: number },
        ) => Promise<{
          data?: Array<{ id?: string; status?: string; email?: string }>;
        }>;
      }
    ).list(publicationId, { email: normalized, limit: 1 })) ?? {};
    const rows = listResponse.data ?? [];
    const match = rows.find((r) => r.email?.toLowerCase() === normalized);
    if (!match || !match.id) {
      return { ok: true, status: "not_found" };
    }
    if (match.status === "inactive" || match.status === "unsubscribed") {
      return { ok: true, status: "already_inactive" };
    }

    // Update the subscription status to inactive.
    await (
      client.subscriptions as unknown as {
        update: (
          pubId: string,
          subId: string,
          req: { subscription_status?: string; status?: string },
        ) => Promise<unknown>;
      }
    ).update(publicationId, match.id, { subscription_status: "inactive" });

    return { ok: true, status: "unsubscribed" };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[beehiiv] unsubscribeEmail failed", err);
    return { ok: false };
  }
}
