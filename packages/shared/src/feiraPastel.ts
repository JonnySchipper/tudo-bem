/**
 * Pastel — the made-to-order Feira cart game.
 *
 * Grab dough, add the filling (two taps for a combo), crimp it with a fork, drop it in the oil.
 * Several pastels fry at once. Pull each one while it is golden. Leave it and it goes dark, then
 * black, then a charcoal block, then it catches fire. Burnt is a soft fail (score only), never
 * a game over. Orders are a pure function of the run seed, so the server knows what was ordered.
 *
 * needs_br: true (every customer line and the pops).
 */
import type { Bilingual } from './types.js';
import { mulberry32 } from './meveum.js';
import {
  FEIRA_GAME_MAX_SCORE,
  FEIRA_GAME_MODULES,
  FEIRA_REGULARS,
  feiraFreshFace,
  type FeiraCustomerOrder,
  type FeiraGameModule,
  type FeiraOrderOutcome,
  type FeiraQuality,
} from './feiraGames.js';

/** Bowl the player taps. Combo recipes use two of these. */
export const PASTEL_PARTS = [
  'carne',
  'queijo',
  'pizza',
  'calabresa',
  'palmito',
  'frango',
  'camarao',
  'catupiry',
  'goiabada',
  'banana',
  'canela',
] as const;
export type PastelPart = (typeof PASTEL_PARTS)[number];

export const PASTEL_PART_LABEL: Record<PastelPart, Bilingual> = {
  carne: { pt: 'carne', en: 'beef' },
  queijo: { pt: 'queijo', en: 'cheese' },
  pizza: { pt: 'pizza', en: 'pizza' },
  calabresa: { pt: 'calabresa', en: 'calabresa sausage' },
  palmito: { pt: 'palmito', en: 'hearts of palm' },
  frango: { pt: 'frango', en: 'chicken' },
  camarao: { pt: 'camarão', en: 'shrimp' },
  catupiry: { pt: 'catupiry', en: 'catupiry' },
  goiabada: { pt: 'goiabada', en: 'guava paste' },
  banana: { pt: 'banana', en: 'banana' },
  canela: { pt: 'canela', en: 'cinnamon' },
};

/** One-word fillings. These are the only orders in the first half of a run. */
export const PASTEL_SIMPLE = ['carne', 'queijo', 'pizza', 'calabresa', 'palmito'] as const;
/** Two-part fillings. They show up later and fry on a shorter golden window. */
export const PASTEL_COMBO = ['frango_catupiry', 'camarao_catupiry', 'romeu_julieta', 'banana_canela'] as const;
export const PASTEL_FILLINGS = [...PASTEL_SIMPLE, ...PASTEL_COMBO] as const;
export type PastelSimple = (typeof PASTEL_SIMPLE)[number];
export type PastelCombo = (typeof PASTEL_COMBO)[number];
export type PastelFilling = (typeof PASTEL_FILLINGS)[number];

export interface PastelRecipe {
  parts: readonly PastelPart[];
  label: Bilingual;
  combo: boolean;
}

export const PASTEL_RECIPE: Record<PastelFilling, PastelRecipe> = {
  carne: { parts: ['carne'], combo: false, label: { pt: 'carne', en: 'beef' } },
  queijo: { parts: ['queijo'], combo: false, label: { pt: 'queijo', en: 'cheese' } },
  pizza: { parts: ['pizza'], combo: false, label: { pt: 'pizza', en: 'pizza' } },
  calabresa: { parts: ['calabresa'], combo: false, label: { pt: 'calabresa', en: 'calabresa sausage' } },
  palmito: { parts: ['palmito'], combo: false, label: { pt: 'palmito', en: 'hearts of palm' } },
  frango_catupiry: {
    parts: ['frango', 'catupiry'],
    combo: true,
    label: { pt: 'frango com catupiry', en: 'chicken with catupiry' },
  },
  camarao_catupiry: {
    parts: ['camarao', 'catupiry'],
    combo: true,
    label: { pt: 'camarão com catupiry', en: 'shrimp with catupiry' },
  },
  romeu_julieta: {
    parts: ['queijo', 'goiabada'],
    combo: true,
    label: { pt: 'Romeu e Julieta', en: 'cheese and guava' },
  },
  banana_canela: {
    parts: ['banana', 'canela'],
    combo: true,
    label: { pt: 'banana com canela', en: 'banana with cinnamon' },
  },
};

/** The filling those parts make, or null when they are not a recipe (order does not matter). */
export function pastelFromParts(parts: readonly string[]): PastelFilling | null {
  const key = [...parts].sort().join('+');
  for (const id of PASTEL_FILLINGS) {
    if ([...PASTEL_RECIPE[id].parts].sort().join('+') === key) return id;
  }
  return null;
}

/** A run is about 90 seconds. Customers stop arriving a little before the end so the last one can be served. */
export const PASTEL_DURATION_MS = 90_000;
const FIRST_AT = 1_200;
const GAP_MS = 7_200;
export const PASTEL_CUSTOMERS = 11;
export const PASTEL_PATIENCE_MS = 24_000;
/** Combo fillings start at this customer index (0-based) and only on the odd indexes after that. */
export const PASTEL_COMBO_FROM = 5;

export interface PastelOrder extends FeiraCustomerOrder {
  filling: PastelFilling;
  line: Bilingual;
}

function lineFor(filling: PastelFilling, polite: boolean): Bilingual {
  const name = PASTEL_RECIPE[filling].label;
  if (polite) {
    return {
      pt: `Um pastel de ${name.pt}, por favor.`,
      en: `A ${name.en} pastel, please.`,
    };
  }
  return {
    pt: `Me vê um pastel de ${name.pt}?`,
    en: `A ${name.en} pastel, please?`,
  };
}

/** True when this arrival index is a two-part order. */
export function pastelComboTurn(index: number): boolean {
  return index >= PASTEL_COMBO_FROM && index % 2 === 1;
}

/** Every order a seed deals, in arrival order. Pure. */
export function pastelOrders(seed: number): PastelOrder[] {
  const rng = mulberry32(seed >>> 0);
  const out: PastelOrder[] = [];
  let at = FIRST_AT;
  const recent: string[] = [];
  for (let i = 0; i < PASTEL_CUSTOMERS; i++) {
    const pool = pastelComboTurn(i) ? PASTEL_COMBO : PASTEL_SIMPLE;
    const filling = pool[Math.floor(rng() * pool.length)]!;
    const who = feiraFreshFace(FEIRA_REGULARS[Math.floor(rng() * FEIRA_REGULARS.length)]!, recent);
    const polite = rng() < 0.65;
    out.push({
      at,
      patienceMs: PASTEL_PATIENCE_MS - (i > 7 ? 3_000 : 0),
      who: who.id,
      name: who.name,
      filling,
      line: lineFor(filling, polite),
    });
    const rush = i >= 6 ? 0.82 : i >= 3 ? 0.92 : 1;
    at += Math.round(GAP_MS * rush * (0.9 + rng() * 0.2));
  }
  return out;
}

export function pastelOrdersBy(seed: number, elapsedMs: number): PastelOrder[] {
  return pastelOrders(seed).filter((o) => o.at <= elapsedMs);
}

const POINTS: Record<FeiraQuality, number> = { perfect: 48, ok: 32, soft: 16, miss: 0 };

export function scorePastel(
  seed: number,
  outcomes: readonly FeiraOrderOutcome[],
  elapsedMs: number,
): { score: number; served: number; perfect: number; left: number } {
  const possible = pastelOrdersBy(seed, elapsedMs);
  let score = 0;
  let served = 0;
  let perfect = 0;
  let left = 0;
  let combo = 0;
  const byIndex = new Map<number, FeiraOrderOutcome>();
  for (const o of outcomes) if (!byIndex.has(o.i)) byIndex.set(o.i, o);
  for (let i = 0; i < possible.length; i++) {
    const o = byIndex.get(i);
    if (!o || o.quality === 'miss') {
      left += 1;
      combo = 0;
      continue;
    }
    served += 1;
    if (o.quality === 'perfect') {
      perfect += 1;
      combo += 1;
      score += POINTS.perfect + Math.min(12, (combo - 1) * 4);
    } else {
      combo = 0;
      score += POINTS[o.quality];
    }
  }
  return { score: Math.max(0, Math.min(FEIRA_GAME_MAX_SCORE, score)), served, perfect, left };
}

export const pastelModule: FeiraGameModule = {
  id: 'pastel',
  durationMs: PASTEL_DURATION_MS,
  ordersBy: pastelOrdersBy,
  allOrders: pastelOrders,
  score: scorePastel,
};

FEIRA_GAME_MODULES.pastel = pastelModule;

/** Two fryer slots from the start (several pastels at once); a third after 4 serves. */
export function pastelSlots(served: number): 1 | 2 | 3 {
  if (served >= 4) return 3;
  return 2;
}

/**
 * How long each stage lasts in the oil. Combo fillings use a shorter golden window.
 * Forgotten pastel: golden → dark → black → a black block → on fire.
 */
export const PASTEL_FRY = {
  goldenAt: 2_400,
  darkAt: 4_200,
  blackAt: 5_600,
  blockAt: 7_000,
  fireAt: 8_400,
} as const;

export const PASTEL_FRY_COMBO = {
  goldenAt: 2_000,
  darkAt: 3_200,
  blackAt: 4_400,
  blockAt: 5_600,
  fireAt: 6_800,
} as const;

export type PastelDoneness = 'raw' | 'golden' | 'dark' | 'black' | 'block' | 'fire';

export function pastelFry(combo: boolean): {
  goldenAt: number;
  darkAt: number;
  blackAt: number;
  blockAt: number;
  fireAt: number;
} {
  return combo ? PASTEL_FRY_COMBO : PASTEL_FRY;
}

/** `ageMs` is how long this pastel has been in the oil. */
export function pastelDoneness(ageMs: number, combo = false): PastelDoneness {
  const fry = pastelFry(combo);
  if (ageMs >= fry.fireAt) return 'fire';
  if (ageMs >= fry.blockAt) return 'block';
  if (ageMs >= fry.blackAt) return 'black';
  if (ageMs >= fry.darkAt) return 'dark';
  if (ageMs >= fry.goldenAt) return 'golden';
  return 'raw';
}

/**
 * Client-side quality for one served pastel.
 * Wrong filling or a customer who already left is a miss.
 * Golden is perfect (or ok when their patience is low).
 * Raw, dark, black, the charcoal block and a fire you put out are a soft fail — the run keeps going.
 */
export function pastelServeQuality(doneness: PastelDoneness, fillingOk: boolean, patienceLeft: number): FeiraQuality {
  if (!fillingOk || patienceLeft <= 0) return 'miss';
  if (doneness === 'golden') return patienceLeft > 0.45 ? 'perfect' : 'ok';
  return 'soft';
}

export const PASTEL_POP: Record<'perfect' | 'ok' | 'soft' | 'raw' | 'miss' | 'fire' | 'out' | 'wrong' | 'need' | 'rack' | 'trash' | 'dough', Bilingual> = {
  perfect: { pt: 'Dourado!', en: 'Golden!' },
  ok: { pt: 'No ponto.', en: 'Just right.' },
  soft: { pt: 'Queimou…', en: 'Burnt…' },
  raw: { pt: 'Ainda cru.', en: 'Still raw.' },
  miss: { pt: 'Ih…', en: 'Oh…' },
  fire: { pt: 'Pegou fogo!', en: 'It caught fire!' },
  out: { pt: 'Ufa, apagou!', en: 'Phew, it is out!' },
  wrong: { pt: 'Hmm, não era esse recheio.', en: 'Hmm, that was not the filling.' },
  need: { pt: 'Fecha com o garfo primeiro.', en: 'Crimp it with the fork first.' },
  rack: { pt: 'O escorredor está cheio.', en: 'The draining rack is full.' },
  trash: { pt: 'Pro lixo.', en: 'Into the bin.' },
  dough: { pt: 'Pega a massa primeiro.', en: 'Take the dough first.' },
};

/** How many pulled pastéis fit on the draining rack beside the fryer. */
export const PASTEL_RACK = 3;

/** What the customer mutters when a pastel is on fire. needs_br: true */
export const PASTEL_SHEEPISH: Bilingual = {
  pt: 'Eita…',
  en: 'Oh dear…',
};

