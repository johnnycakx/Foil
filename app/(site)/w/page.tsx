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
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-14 pb-20 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">Your vault</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
        Find your vault link
      </h1>
      <p className="mt-3 text-sm text-foil-slate">
        Your vault is the private page with every card you&apos;re watching. The link lives in
        your welcome email and at the bottom of every price alert — or we can send it again.
      </p>

      {sent ? (
        <section className="mt-8 rounded-2xl border border-foil-gold/40 bg-foil-gold/5 p-6">
          <p className="text-sm text-foil-navy">
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
            className="flex-1 rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
          />
          <button
            type="submit"
            className="rounded-xl bg-foil-navy px-6 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition hover:bg-foil-coral"
          >
            Send my link
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-foil-slate">
        Nothing tracked yet? <a href="/start" className="font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold">Start your vault</a> — search a card you&apos;re hunting.
      </p>
    </main>
  );
}
