// /w — vault link recovery (ADR-093). Enter your email; if a vault exists
// for it, the link is re-sent. The response is UNIFORM either way — this
// page never discloses whether an email is known (account-enumeration
// posture, same as the unsubscribe machinery).

import type { Metadata } from "next";
import { vaultRecoverLink } from "@/app/actions/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Find your vault",
  robots: { index: false, follow: false },
};

export default async function VaultRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  async function recover(formData: FormData): Promise<void> {
    "use server";
    await vaultRecoverLink(formData);
    const { redirect } = await import("next/navigation");
    redirect("/w?sent=1");
  }

  return (
    // design-loop-round2 §4: the vault surfaces live in the night register.
    <main data-tone="night" className="mx-auto w-full max-w-xl flex-1 bg-foil-night px-5 pt-14 pb-20 text-foil-cream sm:px-8">
      <p className="text-xs font-medium uppercase tracking-widest text-foil-accent">Your vault</p>
      <h1 className="font-display mt-1 text-4xl font-bold tracking-[-0.02em] text-foil-cream sm:text-5xl">
        Find your vault link
      </h1>
      <p className="mt-4 text-base text-foil-cream/70 sm:text-lg">
        Your vault is the private page with every card you&apos;re watching. The link lives in
        your welcome email and at the bottom of every price alert — or we can send it again.
      </p>

      {sent ? (
        <section className="mt-8 rounded-2xl border border-foil-accent/40 bg-foil-accent/10 p-6">
          <p className="text-base text-foil-cream">
            If that email has a vault, the link is on its way. Check your inbox (and the
            promotions tab, just in case).
          </p>
        </section>
      ) : (
        <form action={recover} className="mt-8 flex flex-col gap-3 sm:flex-row">
          {/* Honeypot — off-screen, never announced/tabbable (ADR-090 pattern). */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@gmail.com"
            className="flex-1 rounded-xl border border-foil-cream/15 bg-foil-night-2 px-4 py-3 text-base text-foil-cream placeholder:text-foil-cream/40 outline-none transition focus:border-foil-accent focus:ring-2 focus:ring-foil-accent/30"
          />
          <button
            type="submit"
            className="rounded-xl bg-foil-cream px-6 py-3 text-base font-semibold text-foil-navy shadow-[0_10px_30px_-12px_rgba(4,9,18,0.8)] transition hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60"
          >
            Send my link
          </button>
        </form>
      )}

      <p className="mt-6 text-base text-foil-cream/70">
        Nothing tracked yet? <a href="/start" className="font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-accent hover:decoration-foil-accent">Start your vault</a> — search a card you&apos;re hunting.
      </p>
    </main>
  );
}
