# PokeTrace UUID bake — unmatched / ambiguous cards

_Last bake: 2026-05-29T22:46:42.875Z_

- `base1-1` (Alakazam / Base) — AMBIGUOUS: 2 duplicate variantKey(s) collapsed by saleCount; kept [holofoil, shadowless-holofoil]
- `base1-4` (Charizard / Base) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [holofoil, shadowless-holofoil]
- `base1-8` (Machamp / Base) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [holofoil]
- `base1-15` (Venusaur / Base) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [holofoil, shadowless-holofoil]
- `gym1-1` (Blaine's Moltres / Gym Heroes) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym1-9` (Misty's Seadra / Gym Heroes) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym1-11` (Rocket's Hitmonchan / Gym Heroes) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym2-1` (Blaine's Arcanine / Gym Challenge) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym2-4` (Erika's Venusaur / Gym Challenge) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym2-14` (Rocket's Mewtwo / Gym Challenge) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]
- `gym2-15` (Rocket's Zapdos / Gym Challenge) — AMBIGUOUS: 1 duplicate variantKey(s) collapsed by saleCount; kept [unlimited-holofoil, holofoil]

---

**207/207 catalog cards matched.** No true misses remain — every entry above is an AMBIGUOUS-but-matched case (two PokeTrace UUIDs derived the same variantKey; the higher-saleCount one was kept).

_Resolved Session 49.2 via market=EU fallback:_ `base6-16` (Legendary Collection Muk → `eu_274781_holo`) and `cel25-11` (Celebrations Mew #11 → `eu_576756`) were not vendor gaps after all — PokeTrace's catalog is market-partitioned and these printings are EU-only (cardmarket-priced). The search ladder now falls back US → EU → no-market, and both are pinned in `lib/cards/poketrace-overrides.json`.
