"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "./waitlist-action";

const INITIAL: WaitlistState = { status: "idle" };

export function WaitlistForm({
  source = "hero",
  variant = "hero",
}: {
  source?: string;
  variant?: "hero" | "compact";
}) {
  const [state, action, pending] = useActionState(joinWaitlist, INITIAL);

  if (state.status === "ok") {
    return (
      <div
        className={`rounded-2xl border border-[#FF6B5C]/40 bg-[#FF6B5C]/10 p-4 text-sm text-[#FFE2DA] ${
          variant === "hero" ? "" : "max-w-md"
        }`}
        aria-live="polite"
      >
        <p className="font-medium">You&apos;re on the list.</p>
        <p className="mt-1 text-[#FFC7BA]">
          We&apos;ll email <span className="font-medium text-white">{state.email}</span> when you get early access. Watch your inbox.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className={`flex flex-col gap-2 ${variant === "hero" ? "sm:flex-row" : ""}`}
      noValidate
    >
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`email-${source}`} className="sr-only">
        Email address
      </label>
      <input
        id={`email-${source}`}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@gmail.com"
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-zinc-400 outline-none transition focus:border-[#FF6B5C] focus:bg-white/10"
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? `email-${source}-error` : undefined}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[#FF6B5C] px-5 py-3 text-base font-semibold text-[#0B1428] transition hover:bg-[#FF8775] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Get early access"}
      </button>
      {state.status === "error" && (
        <p
          id={`email-${source}-error`}
          role="alert"
          className={`text-sm text-[#FFB6A8] ${variant === "hero" ? "sm:basis-full" : ""}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
