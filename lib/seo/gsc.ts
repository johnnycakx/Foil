// Google Search Console API client (gsc-api-integration Phase 2, ADR-109).
//
// SERVER/SCRIPT ONLY. Authenticates as a service account via google-auth-library
// (JWT) and reads the SA key FROM ENV ONLY (`GSC_SA_KEY_JSON`, base64 of the SA
// JSON — see docs/ENV-VARS.md). The key is never logged and never written to
// disk by this module. Do NOT import this from a Client Component: it pulls in
// node crypto through google-auth-library.
//
// Why this exists: the seo-crawl-hygiene goal had to INFER GSC's "56 vs 2,079"
// indexed count from the sitemap because there were no creds. This client pulls
// the real numbers live so indexing questions are answered with data, not a
// guess.
//
// Endpoints (Search Console API):
//   - Webmasters v3: sites.list, sitemaps.list, searchanalytics.query
//     https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics
//   - URL Inspection v1: urlInspection.index.inspect
//     https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
// Quotas: URL Inspection is 2,000/day + 600/min per property — inspectUrls()
// paces requests and caps the batch so a report run can't blow the daily quota.

import { existsSync, readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const WEBMASTERS = "https://www.googleapis.com/webmasters/v3";
const URLINSPECT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export const DEFAULT_SITE_URL = "sc-domain:foiltcg.com";

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

/**
 * Resolve the service-account credential from `GSC_SA_KEY_JSON`. Accepts, in
 * order: raw JSON (starts with "{"), a filesystem path to a JSON key, or
 * base64-encoded JSON (the canonical form in .env.local). Never logs the value.
 */
export function loadServiceAccount(env: string | undefined = process.env.GSC_SA_KEY_JSON): ServiceAccount {
  if (!env || !env.trim()) {
    throw new Error("GSC_SA_KEY_JSON is not set. Store the base64-encoded service-account JSON in .env.local (see docs/ENV-VARS.md).");
  }
  const val = env.trim();
  let json: string;
  if (val.startsWith("{")) {
    json = val;
  } else if (existsSync(val)) {
    json = readFileSync(val, "utf8");
  } else {
    json = Buffer.from(val, "base64").toString("utf8");
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(json) as ServiceAccount;
  } catch {
    throw new Error("GSC_SA_KEY_JSON did not decode to valid JSON (expected raw JSON, a path, or base64).");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GSC_SA_KEY_JSON is missing client_email/private_key — not a service-account key.");
  }
  return sa;
}

// ---- Response shapes (only the fields we consume) ------------------------

export type SiteEntry = { siteUrl: string; permissionLevel: string };

export type SitemapEntry = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  warnings?: string;
  errors?: string;
  contents?: { type: string; submitted?: string; indexed?: string }[];
};

export type IndexStatusResult = {
  verdict?: string; // PASS | PARTIAL | FAIL | NEUTRAL | VERDICT_UNSPECIFIED
  coverageState?: string; // e.g. "Submitted and indexed", "Crawled - currently not indexed"
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  referringUrls?: string[];
  crawledAs?: string;
};

export type UrlInspectionResult = {
  inspectionResult?: {
    indexStatusResult?: IndexStatusResult;
    inspectionResultLink?: string;
  };
};

export type SearchAnalyticsRow = {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** A concise, report-friendly view of a single URL's index status. */
export type UrlIndexSummary = {
  url: string;
  verdict: string;
  coverageState: string;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  robotsTxtState: string | null;
  error?: string;
};

export class GscClient {
  private readonly jwt: JWT;
  readonly siteUrl: string;

  constructor(opts: { siteUrl?: string; sa?: ServiceAccount } = {}) {
    const sa = opts.sa ?? loadServiceAccount();
    this.siteUrl = opts.siteUrl ?? DEFAULT_SITE_URL;
    this.jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: SCOPES });
  }

  private get encSite(): string {
    return encodeURIComponent(this.siteUrl);
  }

  private async req<T>(url: string, method: "GET" | "POST", data?: unknown): Promise<T> {
    const res = await this.jwt.request<T>({ url, method, data });
    return res.data;
  }

  /** All properties this service account can read. Use to confirm access. */
  async listSites(): Promise<SiteEntry[]> {
    const data = await this.req<{ siteEntry?: SiteEntry[] }>(`${WEBMASTERS}/sites`, "GET");
    return data.siteEntry ?? [];
  }

  /** True iff the SA has (any) access to this.siteUrl. */
  async hasAccess(): Promise<boolean> {
    const sites = await this.listSites();
    return sites.some((s) => s.siteUrl === this.siteUrl);
  }

  async listSitemaps(): Promise<SitemapEntry[]> {
    const data = await this.req<{ sitemap?: SitemapEntry[] }>(
      `${WEBMASTERS}/sites/${this.encSite}/sitemaps`,
      "GET",
    );
    return data.sitemap ?? [];
  }

  async searchAnalytics(body: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
    startRow?: number;
  }): Promise<SearchAnalyticsRow[]> {
    const data = await this.req<{ rows?: SearchAnalyticsRow[] }>(
      `${WEBMASTERS}/sites/${this.encSite}/searchAnalytics/query`,
      "POST",
      { rowLimit: 1000, ...body },
    );
    return data.rows ?? [];
  }

  async inspectUrl(inspectionUrl: string): Promise<IndexStatusResult> {
    const data = await this.req<UrlInspectionResult>(URLINSPECT, "POST", {
      inspectionUrl,
      siteUrl: this.siteUrl,
      languageCode: "en-US",
    });
    return data.inspectionResult?.indexStatusResult ?? {};
  }

  /**
   * Inspect many URLs, paced to respect the 600/min quota and capped to protect
   * the 2,000/day quota. Failures are captured per-URL (never throw the batch).
   */
  async inspectUrls(
    urls: string[],
    opts: { delayMs?: number; max?: number; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<UrlIndexSummary[]> {
    const delayMs = opts.delayMs ?? 150; // ~400/min, comfortably under 600/min
    const max = Math.min(urls.length, opts.max ?? 1500); // stay under the 2,000/day ceiling
    const out: UrlIndexSummary[] = [];
    for (let i = 0; i < max; i++) {
      const url = urls[i];
      try {
        const r = await this.inspectUrl(url);
        out.push({
          url,
          verdict: r.verdict ?? "UNKNOWN",
          coverageState: r.coverageState ?? "UNKNOWN",
          lastCrawlTime: r.lastCrawlTime ?? null,
          googleCanonical: r.googleCanonical ?? null,
          robotsTxtState: r.robotsTxtState ?? null,
        });
      } catch (e) {
        out.push({
          url,
          verdict: "ERROR",
          coverageState: "ERROR",
          lastCrawlTime: null,
          googleCanonical: null,
          robotsTxtState: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      opts.onProgress?.(i + 1, max);
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return out;
  }
}
