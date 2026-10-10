/**
 * The Praia's fish (PRAIA-PLAN.md 4.1): 14 species, the junk the beach also gives back, and the pool of each water. Pure data plus the
 * size word. Sale prices are server-side commerce (`sell`, RV); nothing here is ever shown as a number on the fishing stage.
 */
import type { WaterId } from './pesca.js';

export type FishId =
  | 'bagre'
  | 'sardinha'
  | 'baiacu'
  | 'tainha'
  | 'robalo'
  | 'corvina'
  | 'pargo'
  | 'garoupa'
  | 'dourado'
  | 'atum'
  | 'marlim'
  | 'tilapia'
  | 'tambaqui'
  | 'tucunare';
export type JunkId = 'chinelo' | 'lata' | 'alga' | 'garrafa';
export type Catchable = FishId | JunkId;
export type Rarity = 'comum' | 'incomum' | 'raro' | 'trofeu';
export type SizeWord = 'pequeno' | 'medio' | 'grande' | 'enorme';

export interface FishDef {
  id: FishId;
  pt: string;
  en: string;
  water: WaterId[];
  rarity: Rarity;
  /** Size range, cm. Sizes roll triangular inside it. */
  cm: [number, number];
  /** RV Jô pays for one (0: never kept, the baiacu goes back to the sea). */
  sell: number;
}

const ALL_SEA: WaterId[] = ['praia', 'remo', 'pesca', 'alto_mar', 'festa'];

/** needs_br: true (every name and gloss) */
export const FISH: Record<FishId, FishDef> = {
  bagre: { id: 'bagre', pt: 'bagre', en: 'sea catfish', water: ALL_SEA, rarity: 'comum', cm: [20, 45], sell: 1 },
  sardinha: { id: 'sardinha', pt: 'sardinha', en: 'sardine', water: ALL_SEA, rarity: 'comum', cm: [12, 25], sell: 1 },
  baiacu: { id: 'baiacu', pt: 'baiacu', en: 'pufferfish', water: ['praia', 'remo', 'alto_mar', 'festa'], rarity: 'comum', cm: [10, 20], sell: 0 },
  tainha: { id: 'tainha', pt: 'tainha', en: 'mullet', water: ['remo', 'pesca', 'alto_mar', 'festa'], rarity: 'comum', cm: [30, 60], sell: 3 },
  robalo: { id: 'robalo', pt: 'robalo', en: 'snook', water: ['remo', 'pesca', 'alto_mar', 'festa'], rarity: 'incomum', cm: [40, 95], sell: 4 },
  corvina: { id: 'corvina', pt: 'corvina', en: 'croaker', water: ['pesca', 'alto_mar', 'festa'], rarity: 'comum', cm: [30, 60], sell: 3 },
  pargo: { id: 'pargo', pt: 'pargo', en: 'red snapper', water: ['pesca', 'alto_mar', 'festa'], rarity: 'incomum', cm: [30, 65], sell: 5 },
  garoupa: { id: 'garoupa', pt: 'garoupa', en: 'grouper', water: ['pesca', 'alto_mar', 'festa'], rarity: 'raro', cm: [40, 110], sell: 6 },
  dourado: { id: 'dourado', pt: 'dourado-do-mar', en: 'mahi-mahi', water: ['alto_mar', 'festa'], rarity: 'incomum', cm: [60, 150], sell: 8 },
  atum: { id: 'atum', pt: 'atum', en: 'tuna', water: ['alto_mar', 'festa'], rarity: 'raro', cm: [80, 200], sell: 12 },
  marlim: { id: 'marlim', pt: 'marlim-azul', en: 'blue marlin', water: ['alto_mar', 'festa'], rarity: 'trofeu', cm: [200, 350], sell: 20 },
  tilapia: { id: 'tilapia', pt: 'tilápia', en: 'tilapia', water: ['lagoa'], rarity: 'comum', cm: [20, 40], sell: 2 },
  tambaqui: { id: 'tambaqui', pt: 'tambaqui', en: 'tambaqui', water: ['lagoa'], rarity: 'incomum', cm: [50, 100], sell: 6 },
  tucunare: { id: 'tucunare', pt: 'tucunaré', en: 'peacock bass', water: ['lagoa'], rarity: 'trofeu', cm: [30, 75], sell: 10 },
};
export const FISH_IDS = Object.keys(FISH) as FishId[];
export const isFishId = (v: unknown): v is FishId => typeof v === 'string' && Object.hasOwn(FISH, v);

/** What else comes up on the line (the beach's "a bit funny" side). Never in the log, never sold. needs_br: true */
export const JUNK: Record<JunkId, { pt: string; en: string }> = {
  chinelo: { pt: 'um chinelo', en: 'a flip-flop' },
  lata: { pt: 'uma lata', en: 'a can' },
  alga: { pt: 'uma alga', en: 'some seaweed' },
  garrafa: { pt: 'uma garrafa com mensagem', en: 'a message in a bottle' },
};
export const isJunkId = (v: unknown): v is JunkId => typeof v === 'string' && Object.hasOwn(JUNK, v);

/**
 * Base weights per water (before weather, hour and cast distance). The beach is about half junk and puffers on purpose: free, simple,
 * a bit funny. Every fish is reachable on the deep-sea boat; the three freshwater fish only in the lagoa. The bottle is the party boat's own.
 */
export const POOLS: Record<WaterId, { c: Catchable; w: number }[]> = {
  praia: [
    { c: 'bagre', w: 26 }, { c: 'sardinha', w: 20 }, { c: 'baiacu', w: 18 },
    { c: 'chinelo', w: 13 }, { c: 'lata', w: 11 }, { c: 'alga', w: 12 },
  ],
  lagoa: [{ c: 'tilapia', w: 60 }, { c: 'tambaqui', w: 28 }, { c: 'tucunare', w: 12 }, { c: 'alga', w: 10 }],
  remo: [
    { c: 'bagre', w: 22 }, { c: 'sardinha', w: 18 }, { c: 'baiacu', w: 10 }, { c: 'tainha', w: 24 }, { c: 'robalo', w: 16 },
    { c: 'chinelo', w: 5 }, { c: 'alga', w: 5 },
  ],
  pesca: [
    { c: 'bagre', w: 12 }, { c: 'sardinha', w: 12 }, { c: 'tainha', w: 16 }, { c: 'robalo', w: 12 },
    { c: 'corvina', w: 20 }, { c: 'pargo', w: 14 }, { c: 'garoupa', w: 8 }, { c: 'alga', w: 4 },
  ],
  alto_mar: [
    { c: 'bagre', w: 4 }, { c: 'sardinha', w: 5 }, { c: 'baiacu', w: 3 }, { c: 'tainha', w: 6 }, { c: 'robalo', w: 6 },
    { c: 'corvina', w: 8 }, { c: 'pargo', w: 9 }, { c: 'garoupa', w: 10 }, { c: 'dourado', w: 22 }, { c: 'atum', w: 14 }, { c: 'marlim', w: 6 },
    // the lagoa's fish never reach the sea: "every fish" on the big boat means every sea fish
  ],
  festa: [
    { c: 'bagre', w: 6 }, { c: 'sardinha', w: 8 }, { c: 'baiacu', w: 4 }, { c: 'tainha', w: 8 }, { c: 'robalo', w: 8 },
    { c: 'corvina', w: 10 }, { c: 'pargo', w: 9 }, { c: 'garoupa', w: 8 }, { c: 'dourado', w: 16 }, { c: 'atum', w: 10 }, { c: 'marlim', w: 4 },
    { c: 'garrafa', w: 6 },
  ],
};

/** pequeno / médio / grande / enorme: the quarter of the range the size falls in. */
export function sizeWord(def: FishDef, cm: number): SizeWord {
  const t = (cm - def.cm[0]) / Math.max(1, def.cm[1] - def.cm[0]);
  return t < 0.3 ? 'pequeno' : t < 0.65 ? 'medio' : t < 0.9 ? 'grande' : 'enorme';
}
/** A trophy is the top tenth of the range. */
export const isTrophy = (def: FishDef, cm: number): boolean => cm >= def.cm[0] + 0.9 * (def.cm[1] - def.cm[0]);

/** The size words as the card shows them. needs_br: true */
export const SIZE_WORDS: Record<SizeWord, { pt: string; en: string }> = {
  pequeno: { pt: 'pequeno', en: 'small' },
  medio: { pt: 'médio', en: 'medium' },
  grande: { pt: 'grande', en: 'big' },
  enorme: { pt: 'enorme', en: 'huge' },
};
