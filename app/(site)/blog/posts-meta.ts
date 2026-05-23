import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type PostFrontmatter = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  pillar?: string;
  /** Optional primary keyword (filled by the content engine; absent on
   *  hand-written posts where the title doubles as the keyword). */
  primaryKeyword?: string;
  /** Optional FAQ block — when present, the [slug] route emits FAQPage
   *  JSON-LD in addition to the Article schema. */
  faq?: { question: string; answer: string }[];
};

// Posts live under the (site) route group — the parens-wrapped folder is
// part of the actual filesystem path even though it's elided from the URL.
const POSTS_DIR = path.join(process.cwd(), "app", "(site)", "blog", "posts");

function isPostFile(name: string): boolean {
  return name.endsWith(".mdx") && !name.startsWith("_");
}

function readFrontmatter(file: string): PostFrontmatter {
  const slug = file.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
  const { data } = matter(raw);

  const title = typeof data.title === "string" ? data.title : slug;
  const description =
    typeof data.description === "string" ? data.description : "";
  const date = typeof data.date === "string" ? data.date : "1970-01-01";
  const updated = typeof data.updated === "string" ? data.updated : undefined;
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((t): t is string => typeof t === "string")
    : [];
  const pillar = typeof data.pillar === "string" ? data.pillar : undefined;
  const primaryKeyword =
    typeof data.primaryKeyword === "string" ? data.primaryKeyword : undefined;
  const faq = Array.isArray(data.faq)
    ? data.faq
        .map((entry: unknown) => {
          if (!entry || typeof entry !== "object") return null;
          const e = entry as Record<string, unknown>;
          const q = typeof e.question === "string" ? e.question : null;
          const a = typeof e.answer === "string" ? e.answer : null;
          return q && a ? { question: q, answer: a } : null;
        })
        .filter((e): e is { question: string; answer: string } => e !== null)
    : undefined;

  return { slug, title, description, date, updated, tags, pillar, primaryKeyword, faq };
}

export function getAllPosts(): PostFrontmatter[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter(isPostFile)
    .map(readFrontmatter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter(isPostFile).map((f) => f.replace(/\.mdx$/, ""));
}

export function getPost(slug: string): PostFrontmatter | null {
  const file = `${slug}.mdx`;
  if (!fs.existsSync(path.join(POSTS_DIR, file))) return null;
  return readFrontmatter(file);
}
