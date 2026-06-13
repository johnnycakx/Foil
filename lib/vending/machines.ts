// Machine-location data module (Phase V-1, STRATEGY-VENDING-2026-06-12 §7).
//
// DELIBERATE CHOICE: locations live in code, not a DB table, until a real
// machine exists. With zero placements there is nothing operational to store,
// no write path to secure, and no reason to pay a migration + RLS surface for
// an empty list. When machine #1 lands (Phase V-2), the first entry is added
// here and /machines/[location] pages render from it; promotion to a table
// happens only if locations ever need non-deploy-time updates (stock status
// has its own path in V-2 regardless). See the vending-surface ADR.
//
// TRUST FIREWALL (strategy §4 rule 2 — absolute): nothing in lib/vending may
// import from lib/listing, lib/buy-signal, or lib/affiliate, and nothing in
// those modules may import from lib/vending. Machine inventory must remain
// structurally invisible to listing selection, rankings, and signals. The
// vending-surfaces test pins this in both directions.

export type MachineStatus = "live" | "installing" | "announced";

export type MachineLocation = {
  /** URL segment for the V-2 /machines/[location] page. */
  slug: string;
  /** Public display name, e.g. "Foil Machine at Example Cards". */
  name: string;
  /** The host venue's public name. */
  venueName: string;
  /** Street address lines, NAP-exact (must match the GBP listing verbatim in V-2). */
  addressLines: string[];
  city: string;
  region: string;
  /** Hours the machine is publicly reachable (GBP rule: actual access hours). */
  hours: string;
  status: MachineStatus;
};

/** Live + announced machine locations. EMPTY until machine #1 is placed —
 *  the /machines hub renders its honest pre-placement state when this is
 *  empty, and per-location cards once entries exist. */
export const MACHINE_LOCATIONS: readonly MachineLocation[] = [];

/** Metro/region the first machines are headed to. null until John commits a
 *  region publicly; the hub copy stays region-neutral while null (no invented
 *  geography, Gate 13). */
export const UPCOMING_REGION: string | null = null;
