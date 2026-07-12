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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/account");

  const params = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        {params.error === "invalid_link" && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
          >
            That sign-in link didn&apos;t work. It may have expired or already been used. Send
            yourself a fresh one below.
          </div>
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in to Foil</h1>
          <p className="text-sm text-zinc-600">
            Enter your email and Foil sends you a sign-in link. No password.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
