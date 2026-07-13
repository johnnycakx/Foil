// The /api/start wire contract — ONE definition, shared by the route that
// parses it and the tests that pin it (start-binder-delight, 2026-07-12).
//
// WHY THIS EXISTS: the binder rewrite shipped a client that posted only
// { pokemon_tcg_id, target_price_cents } while the route still required
// name/set_name/set_id/number. Every submit would have 400'd — and the test
// NAMED "posts the wire shape the route parses" never actually parsed it, so
// it passed anyway. A schema you can't execute in a test is not a contract.
// Now the test runs the real parser over the real payload.

import { z } from "zod";

export const cardSchema = z.object({
  pokemon_tcg_id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  set_name: z.string().min(1).max(120),
  set_id: z.string().min(1).max(40),
  number: z.string().min(1).max(20),
  target_price_cents: z.number().int().min(1).max(10_000_000).nullable().optional(),
});

export const startSchema = z.object({
  email: z.string().email().max(254),
  opt_in_newsletter: z.boolean().optional().default(true),
  cards: z.array(cardSchema).min(1).max(50),
  /** Inbound source tag (?src= / utm_source alias) — persisted on every
   *  watchlists row. Untrusted; sanitized to [a-z0-9-] before writing. */
  src: z.string().max(200).optional(),
  /** Landing-URL UTM params for the subscriber record (ADR-084). Untrusted;
   *  recordSubscriber sanitizes. */
  utm: z
    .object({
      source: z.string().max(200).nullable().optional(),
      medium: z.string().max(200).nullable().optional(),
      campaign: z.string().max(200).nullable().optional(),
    })
    .optional(),
  /** Honeypot — humans never fill this (ADR-090). */
  website: z.string().max(200).optional(),
});

export type StartPayload = z.infer<typeof startSchema>;
