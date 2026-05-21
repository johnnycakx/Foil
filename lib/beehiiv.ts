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
