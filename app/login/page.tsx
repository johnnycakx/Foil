import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

// Gated utility page — zero SEO value. It's public (in PUBLIC_ROUTES) so the
// magic-link flow works, which means Google crawls it; noindex tells Google to
// stop evaluating it (it was sitting in "crawled – currently not indexed").
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/upload");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Foil</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email and we&apos;ll send you a magic link.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
