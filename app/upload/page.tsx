import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { FREE_DAILY_SCAN_LIMIT } from "@/lib/stripe";
import { signOut } from "./logout-action";
import { UploadForm } from "./upload-form";
import { Paywall } from "./paywall";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ent = await getEntitlements(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Foil</h1>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Account
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
        {ent.tier === "free" && (
          <p className="text-xs text-zinc-500">
            Free tier · {ent.scansToday}/{FREE_DAILY_SCAN_LIMIT} scans used today
          </p>
        )}
        {ent.rateLimited ? <Paywall /> : <UploadForm tier={ent.tier} />}
      </section>
    </main>
  );
}
