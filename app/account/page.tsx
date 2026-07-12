import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { createCheckoutSession, openCustomerPortal } from "@/app/upload/billing-actions";
import { signOut } from "@/app/upload/logout-action";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ent = await getEntitlements(supabase, user.id);
  const isPro = ent.tier === "pro";

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Account</h1>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/deals"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Today&apos;s deals
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto w-full max-w-md flex-1 flex flex-col gap-4">
        {params.checkout === "success" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Subscription started — welcome to Foil Pro. It may take a moment for Stripe to confirm; refresh if your tier still shows Free.
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current tier</p>
          <p className="mt-1 text-3xl font-semibold">{isPro ? "Pro" : "Free"}</p>
          {isPro ? (
            <p className="mt-2 text-sm text-zinc-500">
              Daily deal drop + personal price watches
              {ent.periodEnd
                ? ` · next charge ${new Date(ent.periodEnd).toLocaleDateString("en-US", { dateStyle: "medium" })}`
                : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              3 watches, checked once a day · the weekly digest
            </p>
          )}

          {isPro ? (
            <form action={openCustomerPortal} className="mt-5">
              <button
                type="submit"
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Manage subscription
              </button>
            </form>
          ) : (
            <form action={createCheckoutSession} className="mt-5">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">$6</span>
                <span className="text-sm text-zinc-500">/ month</span>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Upgrade to Pro
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">What Pro includes</p>
          <ul className="mt-3 space-y-1.5">
            <li>· The daily deal drop: Foil scans the singles market every day and sends only the buys worth it</li>
            <li>· Unlimited price watches on the cards you&apos;re chasing, checked every hour</li>
            <li>· Foil doesn&apos;t guess prices. It reads real sales.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
