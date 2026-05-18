import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/upload");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">Foil</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Snap a Pokémon card, get the value in seconds.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-zinc-900 px-5 py-3 text-base font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
