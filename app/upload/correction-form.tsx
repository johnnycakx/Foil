"use client";

import { useActionState, useState } from "react";
import { submitCorrection, type CorrectionState } from "./correction-action";

const INITIAL: CorrectionState = { status: "idle" };

export function CorrectionLink({
  originalName,
  originalSet,
  originalCardNumber,
  startOpen = false,
}: {
  originalName: string;
  originalSet: string;
  originalCardNumber: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState(submitCorrection, INITIAL);

  if (state.status === "ok") {
    return (
      <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        Thanks — we&apos;ll use this to improve identification.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-700 hover:decoration-zinc-500 dark:decoration-zinc-700 dark:hover:text-zinc-300 dark:hover:decoration-zinc-500"
      >
        Was this wrong?
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
    >
      <input type="hidden" name="original_name" value={originalName} />
      <input type="hidden" name="original_set" value={originalSet} />
      <input type="hidden" name="original_card_number" value={originalCardNumber} />
      <p className="text-zinc-600 dark:text-zinc-400">
        Tell us what the card actually is. Leave fields blank if they were right.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">Correct set</span>
          <input
            name="corrected_set"
            placeholder={originalSet}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">Correct card #</span>
          <input
            name="corrected_card_number"
            placeholder={originalCardNumber}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-zinc-500">Correct name (optional)</span>
          <input
            name="corrected_name"
            placeholder={originalName}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        </label>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Submit correction"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        {state.status === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400">{state.message}</span>
        )}
      </div>
    </form>
  );
}
