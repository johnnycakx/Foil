// JSON-LD builders for Foil blog posts. Pure functions, no Next.js or
// filesystem imports — so they're testable in isolation and re-usable from
// both server components and scripts.
//
// Schemas implemented:
//   - Article (every blog post)
//   - FAQPage (any post that ships an FAQ section)
// Both are composed under an @graph wrapper so a single <script> tag covers
// both, matching what Google's structured-data validator expects.

export type ArticleFrontmatterLike = {
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags?: readonly string[];
};

export type FaqEntry = { question: string; answer: string };

export type ArticleSchemaInput = {
  frontmatter: ArticleFrontmatterLike;
  urlPath: string;
  siteUrl: string;
};

const ORG = { "@type": "Organization", name: "Foil" } as const;

/**
 * schema.org/Article. The Google-recommended fields: headline, description,
 * datePublished, dateModified, author, publisher, mainEntityOfPage. We also
 * carry `keywords` (the tag list) because it's free and the validator
 * accepts it.
 */
export function articleSchema(input: ArticleSchemaInput) {
  const { frontmatter, urlPath, siteUrl } = input;
  const canonical = `${stripTrailingSlash(siteUrl)}${urlPath}`;
  return {
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    dateModified: frontmatter.updated ?? frontmatter.date,
    author: ORG,
    publisher: { ...ORG, url: stripTrailingSlash(siteUrl) },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    ...(frontmatter.tags && frontmatter.tags.length > 0
      ? { keywords: frontmatter.tags.join(", ") }
      : {}),
  } as const;
}

/**
 * schema.org/FAQPage. Each entry becomes a Question with an acceptedAnswer.
 * Returns null when the FAQ list is empty so callers can spread-skip it
 * cleanly: `[articleSchema(...), faqPageSchema(...)].filter(Boolean)`.
 */
export function faqPageSchema(faqs: readonly FaqEntry[]) {
  if (!faqs.length) return null;
  return {
    "@type": "FAQPage",
    inLanguage: "en-US",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  } as const;
}

/**
 * Wraps a list of schema objects in an @graph envelope. Use the JSON
 * returned here as the body of a <script type="application/ld+json"> tag.
 */
export function schemaGraph(...nodes: ReadonlyArray<object | null | undefined>) {
  const present = nodes.filter((n): n is object => n != null);
  return {
    "@context": "https://schema.org",
    "@graph": present,
  };
}

/**
 * Serialize for inline <script>. Replaces `<` with its unicode escape so a
 * malicious string in a frontmatter description can't break out into HTML.
 * Mirrors the pattern in Next's own JSON-LD docs.
 */
export function serializeJsonLd(jsonLd: unknown): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}

export type BreadcrumbSchemaItem = {
  /** Display name on this rung. */
  name: string;
  /** Full URL of this rung's page (Google requires absolute URLs). */
  url: string;
};

/**
 * schema.org/BreadcrumbList. Each item is an absolute URL + display
 * name. Position is 1-indexed per spec. Session 41 / ADR-030.
 *
 * Pass the *visual* breadcrumb's item list (same array the
 * `<Breadcrumb>` component renders) so visual + schema can't drift.
 */
export function breadcrumbListSchema(items: readonly BreadcrumbSchemaItem[]) {
  if (!items.length) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  } as const;
}

export type LocalBusinessInput = {
  /** Business name (the brand). */
  name: string;
  /** Absolute site URL (used as @id + url). */
  url: string;
  /** One-line description for the listing. */
  description: string;
  /** Cities served — emitted as areaServed City nodes. Drives local intent. */
  areaServed: readonly string[];
  /** Base region, e.g. "CA". Service-Area Business: region is known even
   *  when the exact base city is not yet confirmed. */
  addressRegion?: string;
  /** Base country, e.g. "US". */
  addressCountry?: string;
  /** Base city. Omitted while it's an unconfirmed [PLACEHOLDER] — a
   *  Service-Area Business hides the street address but Google still wants a
   *  base locality for verification; we leave it out rather than invent one. */
  addressLocality?: string;
  /** Public contact phone — omitted until John confirms a real number. */
  telephone?: string;
  /** Profile/storefront links (GBP, TCGplayer) once available. */
  sameAs?: readonly string[];
};

/**
 * schema.org/LocalBusiness for a Service-Area Business (doc 04 §3). For an SAB
 * we OMIT streetAddress and lean on `areaServed` to connect the brand to local
 * intent ("pokemon vending machine near me" / "[city] ..."). Every field is
 * only emitted when it's a confirmed fact — no invented address, phone, or
 * geo. This schema is also a strong AEO signal in 2026 for "best [service]
 * near me" answers.
 */
export function localBusinessSchema(input: LocalBusinessInput) {
  const base = stripTrailingSlash(input.url);
  const address: Record<string, string> = { "@type": "PostalAddress" };
  if (input.addressLocality) address.addressLocality = input.addressLocality;
  if (input.addressRegion) address.addressRegion = input.addressRegion;
  if (input.addressCountry) address.addressCountry = input.addressCountry;

  return {
    "@type": "LocalBusiness",
    "@id": `${base}/#localbusiness`,
    name: input.name,
    url: base,
    description: input.description,
    areaServed: input.areaServed.map((city) => ({ "@type": "City", name: city })),
    ...(Object.keys(address).length > 1 ? { address } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.sameAs && input.sameAs.length > 0 ? { sameAs: [...input.sameAs] } : {}),
  } as const;
}

export type ServiceSchemaInput = {
  /** Service name, e.g. "Pokémon card vending machine placement". */
  name: string;
  description: string;
  /** Provider brand name. */
  providerName: string;
  /** Absolute site URL. */
  url: string;
  /** Cities served. */
  areaServed: readonly string[];
};

/**
 * schema.org/Service describing the host-placement offering, tied to the
 * provider LocalBusiness. Reinforces the "what we do + where" signal on the
 * homepage and city pages.
 */
export function serviceSchema(input: ServiceSchemaInput) {
  const base = stripTrailingSlash(input.url);
  return {
    "@type": "Service",
    serviceType: input.name,
    name: input.name,
    description: input.description,
    provider: { "@type": "LocalBusiness", name: input.providerName, "@id": `${base}/#localbusiness` },
    areaServed: input.areaServed.map((city) => ({ "@type": "City", name: city })),
  } as const;
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}
