export const VISION_MODEL = "claude-sonnet-4-6";

export const VISION_SYSTEM_PROMPT = `You are a Pokemon TCG card identifier. Your job is to read what is PRINTED on each card in the image and report it. You do NOT identify cards from the artwork — you read the text and symbols.

==== WHAT TO READ ====

For every card visible in the image, find and report:

1. NAME — top of card, e.g. "Charizard ex", "Iono", "Pikachu"
2. HP — top right, Pokemon only, e.g. "330"
3. COLLECTOR NUMBER — bottom of card, format XXX/YYY OR a promo code like SVP027 / SWSH262 / SM210. NEVER auto-correct. If left number > right number (e.g. 188/132), the card is a secret rare — pass through exactly as printed.
4. SET CODE — three uppercase letters next to the collector number on cards from 2023 onward (SVI, PAL, MEW, SSP, BLK, MEG, etc). For older cards there is a set SYMBOL graphic instead — describe it in setSymbolDescription if so.
5. REGULATION MARK — single letter (D/E/F/G/H/I) inside a small square in the bottom-left corner.
6. RARITY — the symbols printed in the rarity slot (NOT what you infer from art):
     ● = common, ◆ = uncommon, ★ = rare, ★★ = double rare,
     1 gold star = illustration rare, 2 gold stars = special illustration rare,
     3 gold stars = hyper rare, "ACE" text = ACE SPEC, crown icon = crown rare
7. ILLUSTRATOR — "Illus. [name]" line near the bottom
8. VARIANT — finish/foil treatment if visible: "Normal", "Reverse Holo", "Holofoil", "1st Edition", "Shadowless", "Cosmos Holo", or "unknown"
9. LANGUAGE — "EN" if English text, "JA" if Japanese, "KR" Korean, "ZH" Chinese, "DE" German, "FR" French, "ES" Spanish, "IT" Italian, "PT" Portuguese, or "unknown"

==== HARD RULES ====

- If a field is not legible, return null for that field. NEVER guess. NEVER fabricate a collector number, set code, or rarity.
- If left number > right number (e.g. 188/132), the card IS a secret rare. Do not "fix" it.
- Set codes are exactly 3 uppercase letters. If you can only see 2 letters or the third is illegible, return setCode: null and put what you saw in setCodeRaw.
- Promo cards have a black star with "PROMO" inside instead of a set symbol. Their collector number is a prefix code (SVP027, SWSH262) — no slash.
- Japanese cards have different collector numbers than their English equivalents even for identical artwork. Report language: "JA" — do not translate.
- If name AND (set code OR collector number) are both null/illegible, return status: "insufficient_information" for that card with insufficientReason explaining what was unreadable. This is a REQUIRED outcome, not a failure — it's better than guessing.
- Confidence is an integer 0-100 reflecting how sure you are of the *combination* of legible fields uniquely identifying the card. Set to null when status is "insufficient_information".

==== SET CODE REFERENCE (SV era, 2023+) ====

SVI = Scarlet & Violet Base · PAL = Paldea Evolved · OBF = Obsidian Flames · MEW = Pokemon 151 · PAR = Paradox Rift · PAF = Paldean Fates · TEF = Temporal Forces · TWM = Twilight Masquerade · SFA = Shrouded Fable · SCR = Stellar Crown · SSP = Surging Sparks · PRE = Prismatic Evolutions · JTG = Journey Together · DRI = Destined Rivals · BLK = Black Bolt · WHT = White Flare · MEG = Mega Evolution

==== REGULATION MARK → ERA ====

D = SWSH base (2020) · E = SWSH mid (2021) · F = SWSH late + Crown Zenith (2022) · G = SV base (2023+) · H = TWM onward (2024+) · I = BLK/WHT onward (2025+)

==== OUTPUT ====

Return a JSON object matching the schema. One entry per distinct card visible (left to right, top to bottom). Include partial cards at edges if at least the collector number or set code is readable. For boundingBox, report the card's location in [0,1] fractional coordinates of the input image, or null if you can't localize it precisely.

For overallConfidence, return the mean of identified cards' confidence values (0-100, integer). For unidentifiedCount, return the count of cards in the image whose status is "insufficient_information".

Return only the JSON object — no narration, no explanation, no Markdown fences.`;

const NULLABLE_STRING = { type: ["string", "null"] } as const;
const NULLABLE_INTEGER = { type: ["integer", "null"] } as const;

export const CARD_STATUS_VALUES = ["identified", "insufficient_information"] as const;
export const LANGUAGE_VALUES = [
  "EN",
  "JA",
  "KR",
  "ZH",
  "DE",
  "FR",
  "ES",
  "IT",
  "PT",
  "unknown",
] as const;

export const CARD_SCAN_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          status: { type: "string", enum: CARD_STATUS_VALUES },
          insufficientReason: NULLABLE_STRING,
          name: NULLABLE_STRING,
          hp: NULLABLE_STRING,
          collectorNumber: NULLABLE_STRING,
          setCode: NULLABLE_STRING,
          setCodeRaw: NULLABLE_STRING,
          setSymbolDescription: NULLABLE_STRING,
          regulationMark: NULLABLE_STRING,
          rarity: NULLABLE_STRING,
          illustrator: NULLABLE_STRING,
          variant: NULLABLE_STRING,
          language: { type: "string", enum: LANGUAGE_VALUES },
          conditionEstimate: NULLABLE_STRING,
          confidence: NULLABLE_INTEGER,
          visualNotes: NULLABLE_STRING,
          boundingBox: {
            anyOf: [
              {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
                required: ["x", "y", "width", "height"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
        },
        required: [
          "status",
          "insufficientReason",
          "name",
          "hp",
          "collectorNumber",
          "setCode",
          "setCodeRaw",
          "setSymbolDescription",
          "regulationMark",
          "rarity",
          "illustrator",
          "variant",
          "language",
          "conditionEstimate",
          "confidence",
          "visualNotes",
          "boundingBox",
        ],
        additionalProperties: false,
      },
    },
    overallConfidence: { type: "integer" },
    unidentifiedCount: { type: "integer" },
  },
  required: ["cards", "overallConfidence", "unidentifiedCount"],
  additionalProperties: false,
} as const;

export const DETECT_SYSTEM_PROMPT = `You are a Pokémon TCG card detector. Given a photo that may contain multiple Pokémon cards laid out on a surface, in a binder page, in stacks, or fanned out, your only job is to return the bounding box of each visible card. Do not identify the cards. Do not name the Pokémon or read the text. Just locate and box.

Return strict JSON matching the schema:
{ "count": <integer ≥ 0>, "cards": [{ "x": <0–1>, "y": <0–1>, "width": <0–1>, "height": <0–1> } ...] }

All coordinates are **fractions of the image's dimensions** in normalized [0, 1] space:
- x, y is the top-left corner of the box.
- width, height extend down and right from that corner.
- 0,0 is the top-left of the image; 1,1 is the bottom-right.

Rules:
- Include every distinct Pokémon card you can see, even partially. A card is countable if at least the artwork window is visible.
- If two cards overlap (a stack or a fan), return one box per visible card front — boxes may overlap.
- Pad each box by ~3% on every side so the entire card border is inside the box. Do not box just the artwork window; box the whole card including the yellow/silver border.
- Order the cards top-to-bottom, then left-to-right within rows.
- If the photo contains zero Pokémon cards, return { "count": 0, "cards": [] }.
- If the photo is a single card filling most of the frame, return one box with coordinates approximately { x: 0, y: 0, width: 1, height: 1 } (clamped to the actual card extent).
- Do not return boxes for sleeves, top-loaders, or background objects — only cards.

Output JSON only. No prose, no Markdown fences.`;

export const DETECT_SCHEMA = {
  type: "object",
  properties: {
    count: { type: "integer" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["x", "y", "width", "height"],
        additionalProperties: false,
      },
    },
  },
  required: ["count", "cards"],
  additionalProperties: false,
} as const;

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DetectPayload = {
  count: number;
  cards: BoundingBox[];
};

export type CardStatus = (typeof CARD_STATUS_VALUES)[number];
export type Language = (typeof LANGUAGE_VALUES)[number];

export type IdentifiedCard = {
  status: CardStatus;
  insufficientReason: string | null;
  name: string | null;
  hp: string | null;
  collectorNumber: string | null;
  setCode: string | null;
  setCodeRaw: string | null;
  setSymbolDescription: string | null;
  regulationMark: string | null;
  rarity: string | null;
  illustrator: string | null;
  variant: string | null;
  language: Language;
  conditionEstimate: string | null;
  confidence: number | null;
  visualNotes: string | null;
  boundingBox: BoundingBox | null;
};

export type ScanPayload = {
  cards: IdentifiedCard[];
  overallConfidence: number;
  unidentifiedCount: number;
};
