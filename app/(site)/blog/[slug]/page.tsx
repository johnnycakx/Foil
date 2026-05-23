import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPost, getPostSlugs } from "../posts-meta";
import {
  articleSchema,
  faqPageSchema,
  schemaGraph,
  serializeJsonLd,
} from "@/lib/seo/schema-helpers";
import { FAQ } from "@/mdx-components";
import { EmailCapture } from "@/components/email-capture";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FMT.format(d);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const urlPath = `/blog/${post.slug}`;
  return {
    title: `${post.title} | Foil`,
    description: post.description,
    alternates: { canonical: urlPath },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      siteName: "Foil",
      url: urlPath,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      creator: "@foilcards",
    },
  };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  let PostBody: React.ComponentType;
  try {
    const mod = await import(`../posts/${slug}.mdx`);
    PostBody = mod.default;
  } catch {
    notFound();
  }

  const allPosts = getAllPosts();
  const related = allPosts
    .filter((p) => p.slug !== post.slug)
    .filter(
      (p) =>
        (post.pillar && p.pillar === post.pillar) ||
        p.tags.some((t) => post.tags.includes(t)),
    )
    .slice(0, 3);

  const base = siteUrl();
  const urlPath = `/blog/${post.slug}`;
  // Article + (optional) FAQPage under one @graph wrapper. Every post gets
  // Article; posts that ship an `faq` frontmatter array also get FAQPage.
  // Both are filtered by schemaGraph() so an empty FAQ list cleanly drops out.
  const jsonLd = schemaGraph(
    articleSchema({ frontmatter: post, urlPath, siteUrl: base }),
    post.faq && post.faq.length ? faqPageSchema(post.faq) : null,
  );

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />

        <article>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs uppercase tracking-wider">
            <time
              dateTime={post.date}
              className="font-mono text-zinc-500"
            >
              {formatDate(post.date)}
            </time>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-zinc-300">{post.description}</p>

          <div className="mt-10 prose prose-invert max-w-none prose-headings:tracking-tight prose-headings:text-white prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-zinc-300 prose-a:text-[#FF6B5C] prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-li:text-zinc-300 prose-ol:text-zinc-300 prose-ul:text-zinc-300 prose-blockquote:border-l-[#FF6B5C]/40 prose-blockquote:text-zinc-300 prose-blockquote:not-italic prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#FFC7BA] prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#101D38] prose-pre:text-zinc-200 prose-hr:border-white/10 prose-table:text-sm prose-th:text-white prose-th:border-white/15 prose-td:border-white/10 prose-td:text-zinc-300 prose-img:rounded-xl prose-img:border prose-img:border-white/10">
            <PostBody />
          </div>

          {/* Single source of truth for the FAQ — same array also feeds the
              FAQPage JSON-LD above. Posts can omit `faq` in frontmatter and
              this just no-renders. */}
          {post.faq && post.faq.length > 0 && <FAQ items={post.faq} />}

          <EmailCapture source={`blog-${post.slug}`} variant="inline" />
        </article>

        {related.length > 0 && (
          <aside className="mt-16 border-t border-white/5 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Keep reading
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="block rounded-xl border border-white/5 bg-[#101D38] p-4 transition hover:border-[#FF6B5C]/30"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      {formatDate(p.date)}
                    </p>
                    <p className="mt-1 font-semibold text-white">{p.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>
    </>
  );
}
