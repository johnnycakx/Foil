// /legal/ebay-api-compliance — public, reviewer-facing mirror of
// docs/EBAY-COMPLIANCE.md. The URL that gets pasted into eBay's
// Application Growth Check supporting-evidence field. See Session 33
// SESSION-LOG entry + the drift-detection test at
// lib/__tests__/legal-ebay-api-compliance.test.ts.
//
// Content comes from lib/legal/ebay-compliance-content.ts so the drift
// test (which can't render Next Server Components under node:test) can
// share the same source.

import type { Metadata } from "next";
import {
  ARCHITECTURE_PARAGRAPHS,
  CONTACT_FOOTER,
  PAGE_INTRO,
  PAGE_TITLE,
  REQUIREMENTS,
} from "@/lib/legal/ebay-compliance-content";

const PDF_PATH = "/compliance/foil-ebay-api-compliance.pdf";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description:
    "Foil's compliance with eBay's 2025 License Agreement, Buy APIs program terms, Marketplace Account Deletion compliance, and EPN agreement.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com"}/legal/ebay-api-compliance`,
    types: {
      "application/pdf": PDF_PATH,
    },
  },
  robots: { index: true, follow: true },
};

export default function EbayApiCompliancePage() {
  const lastUpdated = "2026-05-24";
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          Compliance
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          eBay API Compliance
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated {lastUpdated}</p>
        <p className="mt-3">
          <a
            href={PDF_PATH}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#FFC7BA] underline-offset-4 hover:underline"
            download
          >
            Download as PDF <span aria-hidden="true">→</span>
          </a>
        </p>
      </header>

      <section className="mt-8 leading-relaxed text-zinc-300">
        <p>{PAGE_INTRO}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Architecture
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-zinc-300">
          {ARCHITECTURE_PARAGRAPHS.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Requirements
        </h2>
        <ol className="mt-4 space-y-6">
          {REQUIREMENTS.map((req, i) => (
            <li
              key={req.title}
              className="rounded-2xl border border-white/5 bg-[#101D38] p-5 sm:p-6"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#FFC7BA]">
                Requirement {i + 1}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-snug text-white">
                {req.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{req.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 border-t border-white/5 pt-8 text-sm text-zinc-500">
        <p>{CONTACT_FOOTER}</p>
      </section>
    </main>
  );
}
