// Pure helpers for the Vercel deploys webhook proxy. Lives outside the
// app/api/.../route.ts file so node:test can load it without pulling in
// next/server (which only resolves inside the Next.js bundler).
//
// The route handler imports from here; tests import from here directly.
// No Next.js types or runtime references in this file.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { DiscordEmbed } from "./notifications/discord.ts";

export type VercelDeploymentEvent = {
  type: string;
  createdAt?: number;
  payload?: {
    deployment?: {
      id?: string;
      url?: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
      };
    };
    target?: string;
    project?: { name?: string };
    user?: { username?: string };
  };
};

export const HANDLED_EVENTS = new Set([
  "deployment.succeeded",
  "deployment.error",
  "deployment.canceled",
]);

const COLOR_GREEN = 0x4ade80;
const COLOR_RED = 0xef4444;
const COLOR_YELLOW = 0xfbbf24;

/**
 * Vercel signs with HMAC-SHA1 over the raw body. Returns true on match,
 * false on mismatch or any decode error. Uses timingSafeEqual to defeat
 * timing attacks.
 */
export function verifySignature(rawBody: string, headerValue: string, secret: string): boolean {
  try {
    const expected = createHmac("sha1", secret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(headerValue, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Map a Vercel deployment event → Discord embed. Pure function; safe to unit
 * test in isolation.
 */
export function buildEmbed(event: VercelDeploymentEvent): DiscordEmbed {
  const deployment = event.payload?.deployment;
  const target = event.payload?.target ?? "preview";
  const projectName = event.payload?.project?.name ?? "foil";
  const deployUrl = deployment?.url ? `https://${deployment.url}` : undefined;
  const commitSha = deployment?.meta?.githubCommitSha?.slice(0, 7);
  const branch = deployment?.meta?.githubCommitRef;
  const commitMessage = deployment?.meta?.githubCommitMessage?.split("\n")[0]?.slice(0, 120);
  const author = deployment?.meta?.githubCommitAuthorName;

  const color =
    event.type === "deployment.succeeded"
      ? COLOR_GREEN
      : event.type === "deployment.error"
        ? COLOR_RED
        : COLOR_YELLOW;
  const verb =
    event.type === "deployment.succeeded"
      ? "succeeded"
      : event.type === "deployment.error"
        ? "failed"
        : "canceled";
  const emoji =
    event.type === "deployment.succeeded" ? "✅" : event.type === "deployment.error" ? "❌" : "⚠️";

  const fields: NonNullable<DiscordEmbed["fields"]> = [
    { name: "Project", value: projectName, inline: true },
    { name: "Environment", value: target, inline: true },
  ];
  if (branch) fields.push({ name: "Branch", value: branch, inline: true });
  if (commitSha)
    fields.push({
      name: "Commit",
      value: deployUrl ? `[\`${commitSha}\`](${deployUrl})` : `\`${commitSha}\``,
      inline: true,
    });
  if (author) fields.push({ name: "Author", value: author, inline: true });
  if (commitMessage) fields.push({ name: "Message", value: commitMessage, inline: false });

  return {
    title: `${emoji} Deploy ${verb}`,
    url: deployUrl,
    color,
    timestamp: event.createdAt
      ? new Date(event.createdAt).toISOString()
      : new Date().toISOString(),
    fields,
  };
}
