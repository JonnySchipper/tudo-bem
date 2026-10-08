/**
 * Tapioca — the relaxing Feira cart game.
 *
 * Customers arrive with a filling order (queijo, coco, chocolate, goiabada). The player juggles
 * pans on a griddle: spread goma, flip in the window, add the filling, roll, serve. A mistimed
 * flip is a soft fail (score only), never a game over. Orders are a pure function of the run seed,
 * so the server knows exactly what was ordered.
 *
 * needs_br: true (every customer line).
 */
import type { Bilingual } from './types.js';
import { mulberry32 } from './meveum.js';
import {
  FEIRA_GAME_MAX_SCORE,
  FEIRA_GAME_MODULES,
  type FeiraCustomerOrder,
  type FeiraGameModule,
  type FeiraOrderOutcome,
  type FeiraQuality,
} from './feiraGames.js';

export const TAPIOCA_FILLINGS = ['queijo', 'coco', 'chocolate', 'goiabada'] as const;
export type TapiocaFilling = (typeof TAPIOCA_FILLINGS)[number];

export const TAPIOCA_FILLING_LABEL: Record<TapiocaFilling, Bilingual> = {
  queijo: { pt: 'queijo', en: 'cheese' },
  coco: { pt: 'coco', en: 'coconut' },
  chocolate: { pt: 'chocolate', en: 'chocolate' },
  goiabada: { pt: 'goiabada', en: 'guava paste' },
};

/** A run is about 90 seconds. Customers stop arriving a little before the end so the last one can be served. */
export const TAPIOCA_DURATION_MS = 90_000;
/** First customer walks up almost immediately. */
const FIRST_AT = 1_200;
/** Gap between arrivals. Tightens once the second and third pans unlock. */
const GAP_MS = 7_400;
/** How many customers a full run deals. */
export const TAPIOCA_CUSTOMERS = 11;

export const TAPIOCA_PATIENCE_MS = 22_000;

/** Pan cook window. Flip inside `[cookMs - early, cookMs + late]`. */
export const TAPIOCA_COOK = { cookMs: 2800, earlyMs: 700, lateMs: 900 } as const;

/** Second pan unlocks after this many serves; third after this many. */
export const TAPIOCA_PAN_UNLOCK = [0, 3, 6] as const;

export interface TapiocaOrder extends FeiraCustomerOrder {
  filling: TapiocaFilling;
  line: Bilingual;
}

const WHO: { id: string; name: string }[] = [
  { id: 'nanda', name: 'Nanda' },
  { id: 'julia', name: 'Júlia' },
  { id: 'tia_lu', name: 'Tia Lu' },
  { id: 'rosa', name: 'Dona Rosa' },
  { id: 'chico', name: 'Seu Chico' },
  { id: 'ze', name: 'Seu Zé' },
  { id: 'graca', name: 'Dona Graça' },
  { id: 'lucia', name: 'Dona Lúcia' },
];

function lineFor(filling: TapiocaFilling, polite: boolean): Bilingual {
  const f = TAPIOCA_FILLING_LABEL[filling];
  if (polite) {
    return {
      pt: `Uma tapioca de ${f.pt}, por favor.`,
      en: `A ${f.en} tapioca, please.`,
    };
  }
  return {
    pt: `Me vê uma tapioca de ${f.pt}?`,
    en: `A ${f.en} tapioca, please?`,
  };
}

/** Every order a seed deals, in arrival order. Pure. */
export function tapiocaOrders(seed: number): TapiocaOrder[] {
  const rng = mulberry32(seed >>> 0);
  const out: TapiocaOrder[] = [];
  let at = FIRST_AT;
  const used = new Set<string>();
  for (let i = 0; i < TAPIOCA_CUSTOMERS; i++) {
    const filling = TAPIOCA_FILLINGS[Math.floor(rng() * TAPIOCA_FILLINGS.length)]!;
    let who = WHO[Math.floor(rng() * WHO.length)]!;
    // avoid the same face twice in a row when we can
    if (used.has(who.id) && WHO.length > 1) {
      who = WHO.find((w) => !used.has(w.id)) ?? who;
    }
    used.clear();
    used.add(who.id);
    const polite = rng() < 0.65;
    out.push({
      at,
      patienceMs: TAPIOCA_PATIENCE_MS - (i > 7 ? 3_000 : 0),
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

/** Orders whose arrival is at or before `elapsedMs`. */
export function tapiocaOrdersBy(seed: number, elapsedMs: number): TapiocaOrder[] {
  return tapiocaOrders(seed).filter((o) => o.at <= elapsedMs);
}

/**
 * Points per order, before the hard cap.
 * perfect 48, ok 32, soft 16 (a torn or stuck flip that was still served), miss 0 (left, or wrong filling).
 * A small combo bonus for back-to-back perfects, capped so the run cannot exceed FEIRA_GAME_MAX_SCORE.
 */
const POINTS: Record<FeiraQuality, number> = { perfect: 48, ok: 32, soft: 16, miss: 0 };

export function scoreTapioca(seed: number, outcomes: readonly FeiraOrderOutcome[], elapsedMs: number): {
  score: number;
  served: number;
  perfect: number;
  left: number;
} {
  const possible = tapiocaOrdersBy(seed, elapsedMs);
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
  // customers who never arrived are not "left"
  return { score: Math.max(0, Math.min(FEIRA_GAME_MAX_SCORE, score)), served, perfect, left };
}

export const tapiocaModule: FeiraGameModule = {
  id: 'tapioca',
  durationMs: TAPIOCA_DURATION_MS,
  ordersBy: tapiocaOrdersBy,
  allOrders: tapiocaOrders,
  score: scoreTapioca,
};

FEIRA_GAME_MODULES.tapioca = tapiocaModule;

/** How many pans are unlocked after `served` successful serves (1, then 2, then 3). */
export function tapiocaPans(served: number): 1 | 2 | 3 {
  if (served >= TAPIOCA_PAN_UNLOCK[2]) return 3;
  if (served >= TAPIOCA_PAN_UNLOCK[1]) return 2;
  return 1;
}

export type FlipVerdict = 'early' | 'perfect' | 'late';

/** Judge a flip. `ageMs` is how long the goma has been on the pan. */
export function tapiocaFlip(ageMs: number): FlipVerdict {
  const { cookMs, earlyMs, lateMs } = TAPIOCA_COOK;
  if (ageMs < cookMs - earlyMs) return 'early';
  if (ageMs > cookMs + lateMs) return 'late';
  return 'perfect';
}

/** Client-side quality for one served tapioca. Wrong filling is always a miss. A bad flip caps the order at soft. */
export function tapiocaServeQuality(flip: FlipVerdict, fillingOk: boolean, patienceLeft: number): FeiraQuality {
  if (!fillingOk) return 'miss';
  if (patienceLeft <= 0) return 'miss';
  if (flip !== 'perfect') return 'soft';
  return patienceLeft > 0.45 ? 'perfect' : 'ok';
}

export const TAPIOCA_POP: Record<'perfect' | 'soft' | 'miss', Bilingual> = {
  perfect: { pt: 'Perfeito!', en: 'Perfect!' },
  soft: { pt: 'Quase!', en: 'Close!' },
  miss: { pt: 'Ih…', en: 'Oh…' },
};

/** Mild annoyance when the filling is wrong. needs_br: true */
export const TAPIOCA_WRONG: Bilingual = {
  pt: 'Hmm, não era esse recheio.',
  en: 'Hmm, that was not the filling.',
};

export const TAPIOCA_THANKS: Bilingual = {
  pt: 'Obrigado! Tá uma delícia.',
  en: 'Thanks! This is delicious.',
};
