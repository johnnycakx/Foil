"use client";

// Login form (auth-hardening, 2026-07-12): errors are ALWAYS visible (the
// smoke test's rate-limit 503 rendered as silence), the sent state is a
// distinct confirmation block, and the palette is explicit-light — the site
// forces a cream background with NO dark-mode override (ADR-029), so the old
// `dark:` zinc variants flipped with the OS theme and produced near-white
// ink on cream (the invisible-input evidence).

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div aria-live="polite" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
        <p className="font-medium text-emerald-800">Sign-in link sent. Check your email.</p>
        <p className="mt-1 text-sm text-emerald-700">
          Foil sent a sign-in link to {state.message}. It expires shortly and works once. Nothing
          in your inbox after a minute? Check spam, then try again.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="email" className="text-sm font-medium text-zinc-700">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.message ?? "Something went wrong sending the email. Try again."}
        </p>
      )}
    </form>
  );
}
