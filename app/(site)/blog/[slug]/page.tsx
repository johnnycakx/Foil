import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPost, getPostSlugs, isVendingPost } from "../posts-meta";
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
    // Selective indexing (ADR-063): live vending posts (pillar host /
    // service-areas) are indexable; the dormant deal-finder posts stay
    // noindexed (vending pivot, ADR-060) but still render in-tree.
    ...(isVendingPost(post) ? {} : { robots: { index: false, follow: false } }),
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

  const isVending = isVendingPost(post);
  // Related stays within the same class — a live vending post never surfaces a
  // dormant deal-finder post (ADR-063) and vice versa.
  const allPosts = getAllPosts();
  const related = allPosts
    .filter((p) => p.slug !== post.slug)
    .filter((p) => isVendingPost(p) === isVending)
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
              className="font-mono text-foil-slate"
            >
              {formatDate(post.date)}
            </time>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-foil-gold/10 px-2 py-0.5 text-[10px] font-medium text-foil-navy"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="font-display mt-4 text-4xl font-bold leading-tight tracking-[-0.02em] text-foil-navy sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-foil-slate">{post.description}</p>

          <div className="mt-10 prose max-w-none prose-headings:tracking-[-0.02em] prose-headings:font-display prose-headings:text-foil-navy prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:text-foil-navy/85 prose-a:text-foil-navy prose-a:underline prose-a:decoration-foil-gold prose-a:underline-offset-4 hover:prose-a:text-foil-coral prose-strong:text-foil-navy prose-li:text-foil-navy/85 prose-ol:text-foil-navy/85 prose-ul:text-foil-navy/85 prose-blockquote:border-l-foil-gold/60 prose-blockquote:text-foil-slate prose-blockquote:not-italic prose-code:rounded prose-code:bg-foil-navy/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foil-navy prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-foil-navy/10 prose-pre:bg-foil-navy prose-pre:text-foil-cream prose-hr:border-foil-navy/10 prose-table:text-sm prose-th:text-foil-navy prose-th:border-foil-navy/15 prose-td:border-foil-navy/10 prose-td:text-foil-slate prose-img:rounded-xl prose-img:border prose-img:border-foil-navy/15">
            <PostBody />
          </div>

          {/* Single source of truth for the FAQ — same array also feeds the
              FAQPage JSON-LD above. Posts can omit `faq` in frontmatter and
              this just no-renders. */}
          {post.faq && post.faq.length > 0 && <FAQ items={post.faq} />}

          {isVending ? (
            <section className="not-prose mt-14 rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8">
              <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
                Want a machine in your space?
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-foil-slate">
                We handle install, stocking, and support. You provide the space
                and earn a monthly revenue share. We will walk through the details
                on a quick call.
              </p>
              <Link
                href="/host"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foil-navy px-5 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
              >
                Host a machine
                <span aria-hidden>→</span>
              </Link>
            </section>
          ) : (
            // Dormant deal-finder post: keep the legacy newsletter capture
            // (noindexed, unlisted; not touched beyond exclusion, ADR-063).
            <EmailCapture source={`blog-${post.slug}`} variant="inline" />
          )}
        </article>

        {related.length > 0 && (
          <aside className="mt-16 border-t border-foil-navy/10 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
              Keep reading
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="block rounded-xl border border-foil-navy/10 bg-foil-cream p-4 shadow-sm shadow-foil-navy/5 transition hover:-translate-y-0.5 hover:border-foil-gold/40 hover:shadow-md hover:shadow-foil-navy/10"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wider text-foil-slate">
                      {formatDate(p.date)}
                    </p>
                    <p className="mt-1 font-semibold text-foil-navy">{p.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <footer className="mt-12 border-t border-foil-navy/10 pt-6">
          {isVending ? (
            <Link href="/faq" className="text-sm font-medium text-foil-navy underline-offset-4 hover:text-foil-coral hover:underline">
              Questions about hosting? Read the host FAQ
            </Link>
          ) : (
            <Link href="/pricing-methodology" className="text-sm font-medium text-foil-navy underline-offset-4 hover:text-foil-coral hover:underline">
              How Foil computes the buy signal
            </Link>
          )}
        </footer>
      </main>
    </>
  );
}
