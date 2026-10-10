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
  FEIRA_REGULARS,
  feiraFreshFace,
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

/** A run is two minutes. Customers stop arriving a little before the end so the last one can be served. */
export const TAPIOCA_DURATION_MS = 120_000;
/** First customer walks up almost immediately. */
const FIRST_AT = 1_200;
/** Gap between arrivals. Tightens once the second and third pans unlock. */
const GAP_MS = 9_800;
/** How many customers a full run deals. */
export const TAPIOCA_CUSTOMERS = 11;

/** Long enough to start the other pans while one cooks. */
export const TAPIOCA_PATIENCE_MS = 45_000;

/** Pan cook window. Flip inside `[cookMs - early, cookMs + late]`. Slow on purpose: juggle the other pans while one sets. */
export const TAPIOCA_COOK = { cookMs: 7000, earlyMs: 1500, lateMs: 2200 } as const;

/** Second pan unlocks after this many serves; third after this many. */
export const TAPIOCA_PAN_UNLOCK = [0, 3, 6] as const;

export interface TapiocaOrder extends FeiraCustomerOrder {
  filling: TapiocaFilling;
  line: Bilingual;
}

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
  const recent: string[] = [];
  for (let i = 0; i < TAPIOCA_CUSTOMERS; i++) {
    const filling = TAPIOCA_FILLINGS[Math.floor(rng() * TAPIOCA_FILLINGS.length)]!;
    // nobody stands at the counter twice among three in a row
    const who = feiraFreshFace(FEIRA_REGULARS[Math.floor(rng() * FEIRA_REGULARS.length)]!, recent);
    const polite = rng() < 0.65;
    out.push({
      at,
      patienceMs: TAPIOCA_PATIENCE_MS - (i > 7 ? 5_000 : 0),
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

/**
 * Spreading the goma: the player holds the sieve over the pan and the disc fills. `coverage` is how much of the
 * pan's ring got covered (1 = edge to edge). Too little leaves holes, too much runs over the rim.
 * Holding fills it at `fillPerSec`, so about 0.9 s lands an even disc.
 */
export const TAPIOCA_SPREAD = { evenFrom: 0.8, evenTo: 1.12, fillPerSec: 1.1, max: 1.4 } as const;

export type SpreadVerdict = 'thin' | 'even' | 'thick';

/** Judge a spread from its coverage (0..`TAPIOCA_SPREAD.max`). */
export function tapiocaSpread(coverage: number): SpreadVerdict {
  if (coverage < TAPIOCA_SPREAD.evenFrom) return 'thin';
  if (coverage > TAPIOCA_SPREAD.evenTo) return 'thick';
  return 'even';
}

/**
 * Client-side quality for one served tapioca. Wrong filling is always a miss. A bad flip or an uneven spread
 * (holes, or goma over the rim) caps the order at soft.
 */
export function tapiocaServeQuality(flip: FlipVerdict, fillingOk: boolean, patienceLeft: number, spread: SpreadVerdict = 'even'): FeiraQuality {
  if (!fillingOk) return 'miss';
  if (patienceLeft <= 0) return 'miss';
  if (flip !== 'perfect' || spread !== 'even') return 'soft';
  return patienceLeft > 0.45 ? 'perfect' : 'ok';
}

export const TAPIOCA_POP: Record<'perfect' | 'soft' | 'miss', Bilingual> = {
  perfect: { pt: 'Perfeito!', en: 'Perfect!' },
  soft: { pt: 'Quase!', en: 'Close!' },
  miss: { pt: 'Ih…', en: 'Oh…' },
};

/** Pops for the spread and the fold. needs_br: true */
export const TAPIOCA_SPREAD_POP: Record<SpreadVerdict, Bilingual> = {
  thin: { pt: 'Ficou com buraco.', en: 'It has holes.' },
  even: { pt: 'Bem espalhada!', en: 'Nicely spread!' },
  thick: { pt: 'Passou da borda.', en: 'It ran over the edge.' },
};

export const TAPIOCA_FLIP_POP: Record<FlipVerdict, Bilingual> = {
  early: { pt: 'Rasgou! Cedo demais.', en: 'It tore! Too early.' },
  perfect: { pt: 'Virou no ponto!', en: 'Flipped right on time!' },
  late: { pt: 'Grudou! Passou do ponto.', en: 'It stuck! Too late.' },
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
