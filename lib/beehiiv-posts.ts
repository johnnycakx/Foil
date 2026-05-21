// Server-side wrapper around Beehiiv's Posts API. Used by the autonomous
// content engine to land a draft companion newsletter alongside every blog
// publish. Drafts ONLY — see ADR-011 for the never-auto-send contract.
//
// Same CORS + key-handling rule as lib/beehiiv.ts: this module is the only
// place allowed to import @beehiiv/sdk's PostsClient. Server contexts only.
//
// Note on Beehiiv tier: posts.create is flagged "Enterprise / beta" in the
// SDK docstring. If our tier rejects the call (401/403) the wrapper returns
// {ok:false} and the content engine logs + soft-fails — the blog publish is
// unaffected.

import { BeehiivClient, Beehiiv } from "@beehiiv/sdk";

export type CreateDraftInput = {
  /** Internal newsletter title — also the email subject by default. */
  title: string;
  /** Subject-line override + preview text. We pack this into the post subtitle
   *  so it shows in Beehiiv's UI when John opens the draft to review. */
  subjectLine: string;
  /** Full newsletter body as raw HTML. Anchor tags + p/h2/strong only — no
   *  Beehiiv-specific blocks. Beehiiv's editor will render it correctly. */
  htmlBody: string;
  /** Source blog slug this draft was generated from. Stored on the draft so
   *  John can correlate at review time without scrolling the Beehiiv UI. */
  originalBlogSlug: string;
};

export type CreateDraftResult =
  | { ok: true; postId: string }
  | { ok: false };

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

export function __setPostsClientForTests(client: BeehiivClient | null): void {
  cachedClient = client;
}

export async function createDraftPost(input: CreateDraftInput): Promise<CreateDraftResult> {
  if (!input.title.trim() || !input.htmlBody.trim()) {
    return { ok: false };
  }

  const client = getClient();
  const publicationId = getPublicationId();

  const request: Beehiiv.PostsCreateRequest = {
    title: input.title,
    subtitle: input.subjectLine,
    body_content: input.htmlBody,
    status: "draft",
    content_tags: ["autonomous-newsletter", `blog-${input.originalBlogSlug}`],
  };

  try {
    const response = await client.posts.create(publicationId, request);
    // Beehiiv's PostsCreateResponse wraps the row under data.id.
    const postId = (response as { data?: { id?: string } }).data?.id;
    if (!postId) return { ok: false };
    return { ok: true, postId };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[beehiiv-posts] createDraftPost failed", err);
    return { ok: false };
  }
}
