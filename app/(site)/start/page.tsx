// /start — THE DESK (start-binder-delight, 2026-07-12).
//
// Was: a multi-add form (Task #20). Now: a place. A nine-pocket binder page
// open on a lamp-lit desk, where filling a pocket IS adding a watch. The
// interaction taste anchor is baothiento.com (walked live 2026-07-12) —
// principles borrowed (dormant-until-attention, autonomous four-beat life, the
// cursor as a real tool, demoted in-world inputs, quiet delight), never assets.
//
// Server shell: assembles the REAL deck (live market_movers + the committed
// sold snapshot, soft-failing) and the viewer's tier, then hands them to the
// client scene. Dynamic because the deck is live data and the tier is per-user.

import type { Metadata } from "next";
import { CARD_CATALOG } from "@/lib/cards/catalog";
import { BinderDesk } from "@/components/start/binder-desk";
import { SakuraAmbience } from "@/components/sakura-ambience";
import { getBinderDeck } from "@/lib/start/binder-data";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const TITLE = "Fill your binder — Foil";
const DESCRIPTION =
  "Fill a binder page with the cards you're chasing. Foil watches the market and emails you when one drops to your price.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/start" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: "/start",
    // Overriding openGraph suppresses the file-based app/opengraph-image.tsx,
    // so reference the dynamic OG explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default async function StartPage() {
  const cataloguedIds = CARD_CATALOG.map((e) => e.pokemonTcgId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in coherence (stranger-run defect): a signed-in collector never
  // retypes their address, and Pro is told the truth about its own cadence.
  const [deck, tier] = await Promise.all([
    getBinderDeck(),
    user ? getTier(supabase, user.id) : Promise.resolve("free" as const),
  ]);

  return (
    <main
      data-tone="night"
      className="relative mx-auto w-full max-w-3xl bg-foil-night px-5 py-8 text-foil-cream sm:px-8 sm:py-10"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[180px] overflow-hidden">
        <SakuraAmbience mode="header" />
      </div>

      {/* Hero discipline (cycle-3 A5): ONE value sentence. Tier mechanics
          live on the quiet Pro line under the binder, not up here. A8: the
          rhythm is tight enough that the pack sits above the fold on a phone
          and the binder's top edge shows at 1440×900. */}
      <header className="relative mb-5 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-accent">Your binder</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.02em] text-foil-cream sm:text-4xl">
          Fill a page with what you&apos;re chasing.
        </h1>
        <p className="mt-2 text-base text-foil-cream/70 sm:text-lg">
          Foil watches every card you sleeve and emails you when one drops to a price worth buying.
        </p>
      </header>

      <BinderDesk
        deck={deck}
        cataloguedIds={cataloguedIds}
        signedInEmail={user?.email ?? null}
        isPro={tier === "pro"}
      />

      {/* The scene is enhancement. With JavaScript off, the product still works:
          the catalog is browsable and every card page carries its own watch
          form (which is a plain server-action POST). */}
      <noscript>
        <div className="mt-8 rounded-xl border border-foil-cream/15 bg-foil-night-2 p-5 text-sm text-foil-cream/80">
          <p className="font-medium text-foil-cream">The binder needs JavaScript to open.</p>
          <p className="mt-1">
            You can still set a watch without it:{" "}
            <a href="/cards" className="underline underline-offset-4">
              browse the catalog
            </a>{" "}
            and use the watch form on any card page.
          </p>
        </div>
      </noscript>

      <p className="mt-8 text-center text-xs text-foil-cream/50">
        Privacy is in the{" "}
        <a href="/legal/privacy" className="underline underline-offset-4">
          policy
        </a>
        . Your email is used for the alerts and (optionally) the weekly digest. Never sold, shared, or used for AI
        training.
      </p>
    </main>
  );
}
