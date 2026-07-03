// Card metadata block — Server Component. Renders the reference-data
// layer (Type, Series, Artist, Release Year, Attacks, Weaknesses) below
// the buyer's-action layer on /cards/[slug]. Session 41 / ADR-030.
//
// Graceful degradation: when the SDK's soft-fail path returns a minimal
// record (no types, no attacks, etc.) or the bake snapshot's pre-Session-41
// entries are loaded, missing fields are simply skipped. The block
// never renders an empty row.

import { DetailSection } from "@/components/cards/detail-section";
import type { CardMetadata } from "@/lib/cards/sdk";

type Props = {
  card: CardMetadata;
};

function releaseYear(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const m = releaseDate.match(/^(\d{4})/);
  return m ? m[1] : null;
}

export function CardMetadataBlock({ card }: Props) {
  const year = releaseYear(card.releaseDate);

  // Build the simple key-value rows. Skip any that have nothing to show.
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (card.types.length > 0) {
    rows.push({ label: "Type", value: card.types.join(" / ") });
  }
  if (card.subtypes.length > 0) {
    rows.push({ label: "Subtype", value: card.subtypes.join(" · ") });
  }
  if (card.hp) {
    rows.push({ label: "HP", value: card.hp });
  }
  if (card.series) {
    rows.push({ label: "Series", value: card.series });
  }
  if (card.artist) {
    rows.push({ label: "Artist", value: card.artist });
  }
  if (year) {
    rows.push({ label: "Release year", value: year });
  }
  if (card.rarity) {
    rows.push({ label: "Rarity", value: card.rarity });
  }

  const hasAttacks = card.attacks.length > 0;
  const hasWeaknesses = card.weaknesses.length > 0;

  if (rows.length === 0 && !hasAttacks && !hasWeaknesses) {
    return null;
  }

  // Vault-first hierarchy: reference data is depth, collapsed by default.
  // Content still renders server-side inside the native <details> DOM.
  return (
    <DetailSection title="Card details" headingId="card-metadata-heading">
      {rows.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-foil-cream/8 pb-2 last:border-b-0">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-foil-cream/60">
                {row.label}
              </dt>
              <dd className="text-right text-sm font-medium text-foil-cream">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {hasAttacks && (
        <div className="mt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-foil-cream/60">
            Attacks
          </h3>
          <ul className="mt-3 space-y-3">
            {card.attacks.map((attack, i) => (
              <li
                key={`${attack.name}-${i}`}
                className="rounded-xl border border-foil-cream/10 bg-foil-night p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-foil-cream">{attack.name}</p>
                  {attack.damage ? (
                    <span className="font-mono text-sm tabular-nums text-foil-cream">
                      {attack.damage}
                    </span>
                  ) : null}
                </div>
                {attack.cost.length > 0 && (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-foil-cream/60">
                    Cost: {attack.cost.join(" · ")}
                  </p>
                )}
                {attack.text && (
                  <p className="mt-2 text-sm leading-relaxed text-foil-cream/70">{attack.text}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWeaknesses && (
        <div className="mt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-foil-cream/60">
            Weaknesses
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {card.weaknesses.map((w, i) => (
              <li
                key={`${w.type}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-foil-accent/40 bg-foil-accent/10 px-3 py-1 text-xs font-medium text-foil-cream"
              >
                <span>{w.type}</span>
                <span className="font-mono tabular-nums text-foil-cream/60">{w.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DetailSection>
  );
}
