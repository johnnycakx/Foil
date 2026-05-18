"use client";

import { useActionState } from "react";
import { recordPositiveConfirmation, type ConfirmationState } from "./confirmation-action";

const INITIAL: ConfirmationState = { status: "idle" };

export function ConfirmRightButton({
  cardId,
  matchedImageUrl,
  cardName,
  cardSet,
  cardNumber,
}: {
  cardId: string;
  matchedImageUrl: string | null;
  cardName: string;
  cardSet: string;
  cardNumber: string;
}) {
  const [state, action, pending] = useActionState(recordPositiveConfirmation, INITIAL);

  if (state.status === "ok") {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400">
        Thanks — confirmed.
      </span>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="card_id" value={cardId} />
      <input type="hidden" name="matched_image_url" value={matchedImageUrl ?? ""} />
      <input type="hidden" name="card_name" value={cardName} />
      <input type="hidden" name="card_set" value={cardSet} />
      <input type="hidden" name="card_number" value={cardNumber} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
      >
        {pending ? "Saving…" : "Yes, this is right"}
      </button>
      {state.status === "error" && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.message}</span>
      )}
    </form>
  );
}
