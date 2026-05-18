import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./logout-action";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Foil</h1>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </header>
      <section className="mx-auto w-full max-w-md flex-1">
        <UploadForm />
      </section>
    </main>
  );
}
