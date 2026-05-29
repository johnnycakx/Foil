import test from "node:test";
import assert from "node:assert/strict";
import {
  bareNumber,
  denomNumber,
  slugifyName,
  deriveVariant,
  matchCatalogCard,
  type PtCardLite,
} from "../poketrace/variant.ts";

function card(p: Partial<PtCardLite> & Pick<PtCardLite, "id" | "cardNumber">): PtCardLite {
  return {
    name: "X",
    set: { slug: "x", name: "X" },
    variant: "Holofoil",
    rarity: "Holo Rare",
    ...p,
  } as PtCardLite;
}

test("bareNumber / denomNumber normalize NNN/MMM", () => {
  assert.equal(bareNumber("004/102"), "4");
  assert.equal(bareNumber("215"), "215");
  assert.equal(bareNumber(null), null);
  assert.equal(denomNumber("004/102"), "102");
  assert.equal(denomNumber("215"), null);
});

test("slugifyName handles & and punctuation", () => {
  assert.equal(slugifyName("Base Set (Shadowless)"), "base-set-shadowless");
  assert.equal(slugifyName("Scarlet & Violet"), "scarlet-and-violet");
});

test("deriveVariant: plain Holofoil → holofoil", () => {
  const v = deriveVariant(card({ id: "a", cardNumber: "004/102", set: { slug: "base-set", name: "Base Set" }, variant: "Holofoil" }));
  assert.equal(v.variantKey, "holofoil");
  assert.equal(v.isShadowless, false);
  assert.equal(v.isHolo, true);
  assert.equal(v.variantLabel, "Holofoil");
});

test("deriveVariant: shadowless slug wins over Unlimited variant token", () => {
  const v = deriveVariant(
    card({ id: "b", cardNumber: "004/102", set: { slug: "base-set-shadowless", name: "Base Set (Shadowless)" }, variant: "Unlimited_Holofoil" }),
  );
  assert.equal(v.variantKey, "shadowless-holofoil");
  assert.equal(v.isShadowless, true);
  assert.equal(v.variantLabel, "Shadowless Holofoil");
});

test("deriveVariant: Reverse_Holofoil + Unlimited + Non-holo", () => {
  assert.equal(deriveVariant(card({ id: "c", cardNumber: "1", variant: "Reverse_Holofoil" })).variantKey, "reverse-holofoil");
  assert.equal(
    deriveVariant(card({ id: "d", cardNumber: "1", set: { slug: "gym-heroes", name: "Gym Heroes" }, variant: "Unlimited_Holofoil" })).variantKey,
    "unlimited-holofoil",
  );
  assert.equal(deriveVariant(card({ id: "e", cardNumber: "1", variant: "Normal", rarity: "Common" })).variantKey, "non-holo");
});

test("matchCatalogCard: vintage total disambiguates reprint + groups shadowless", () => {
  const candidates = [
    card({ id: "base", cardNumber: "004/102", set: { slug: "base-set", name: "Base Set" }, variant: "Holofoil" }),
    card({ id: "shad", cardNumber: "004/102", set: { slug: "base-set-shadowless", name: "Base Set (Shadowless)" }, variant: "Unlimited_Holofoil" }),
    card({ id: "bs2", cardNumber: "004/130", set: { slug: "base-set-2", name: "Base Set 2" }, variant: "Holofoil" }),
  ];
  const r = matchCatalogCard({ name: "Charizard", setName: "Base", setTotal: 102, number: "4" }, candidates);
  assert.equal(r.status, "matched");
  const keys = r.variants.map((v) => v.variantKey).sort();
  assert.deepEqual(keys, ["holofoil", "shadowless-holofoil"]);
  assert.ok(!r.variants.some((v) => v.poketraceId === "bs2"), "Base Set 2 (total 130) must be excluded");
});

test("matchCatalogCard: modern alt-art matched via slug suffix when denom diverges", () => {
  const candidates = [
    card({ id: "alt", cardNumber: "215/203", set: { slug: "swsh07-evolving-skies", name: "Evolving Skies" }, variant: "Holofoil" }),
    card({ id: "secret214", cardNumber: "214/203", set: { slug: "swsh07-evolving-skies", name: "Evolving Skies" }, variant: "Holofoil" }),
  ];
  // SDK total (237) diverges from PokeTrace denom (203); numerator 215 + slug suffix carries it.
  const r = matchCatalogCard({ name: "Umbreon VMAX", setName: "Evolving Skies", setTotal: 237, number: "215" }, candidates);
  assert.equal(r.status, "matched");
  assert.equal(r.variants.length, 1);
  assert.equal(r.variants[0].poketraceId, "alt");
});

test("matchCatalogCard: miss when no numerator match", () => {
  const r = matchCatalogCard(
    { name: "X", setName: "Base", setTotal: 102, number: "4" },
    [card({ id: "z", cardNumber: "005/102", set: { slug: "base-set", name: "Base Set" } })],
  );
  assert.equal(r.status, "miss");
  assert.equal(r.variants.length, 0);
  assert.match(r.note, /no candidate matched/);
});

test("matchCatalogCard: duplicate variantKey collapses → ambiguous", () => {
  const candidates = [
    card({ id: "h1", cardNumber: "004/102", set: { slug: "base-set", name: "Base Set" }, variant: "Holofoil" }),
    card({ id: "h2", cardNumber: "004/102", set: { slug: "base-set", name: "Base Set" }, variant: "Holofoil" }),
  ];
  const r = matchCatalogCard({ name: "Charizard", setName: "Base", setTotal: 102, number: "4" }, candidates);
  assert.equal(r.status, "ambiguous");
  assert.equal(r.variants.length, 1);
});
