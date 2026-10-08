/**
 * Caldo de cana — the multitasking Feira cart game.
 *
 * Customers ask for a sugarcane juice with a flavor and either gelo or puro. The player loads cane,
 * turns the press, catches the juice in a cup (a miss spills), pumps the flavor, adds ice when asked,
 * and serves before the customer leaves. Several orders wait at once. Neglecting the press overflows
 * it. A mistake annoys the customer and costs points; it never ends the run.
 *
 * Orders are a pure function of the run seed, so the server scores the same list the player saw.
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

export const CALDO_FLAVORS = ['limao', 'abacaxi', 'maracuja', 'gengibre', 'hortela', 'laranja', 'abacaxi_hortela'] as const;
export type CaldoFlavor = (typeof CALDO_FLAVORS)[number];

export const CALDO_ICE = ['gelo', 'puro'] as const;
export type CaldoIce = (typeof CALDO_ICE)[number];

export const CALDO_FLAVOR_LABEL: Record<CaldoFlavor, Bilingual> = {
  limao: { pt: 'limão', en: 'lime' },
  abacaxi: { pt: 'abacaxi', en: 'pineapple' },
  maracuja: { pt: 'maracujá', en: 'passion fruit' },
  gengibre: { pt: 'gengibre', en: 'ginger' },
  hortela: { pt: 'hortelã', en: 'mint' },
  laranja: { pt: 'laranja', en: 'orange' },
  abacaxi_hortela: { pt: 'abacaxi e hortelã', en: 'pineapple and mint' },
};

/** A run is about 90 seconds. Arrivals stop early enough that the last customer can still be served. */
export const CALDO_DURATION_MS = 90_000;
const FIRST_AT = 800;
/** Tight gaps so two or three orders are on the counter together. */
const GAP_MS = 4_200;
export const CALDO_CUSTOMERS = 12;
export const CALDO_PATIENCE_MS = 24_000;

/** One crank fills a cup if it is under the spout. Juice left in the press drains; a second crank with a full press overflows. */
export const CALDO_PRESS = {
  crankJuice: 62,
  cupFull: 48,
  drainPerSec: 22,
  overflow: 100,
} as const;

export interface CaldoOrder extends FeiraCustomerOrder {
  flavor: CaldoFlavor;
  ice: CaldoIce;
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

function lineFor(flavor: CaldoFlavor, ice: CaldoIce, polite: boolean): Bilingual {
  const f = CALDO_FLAVOR_LABEL[flavor];
  const icePt = ice === 'gelo' ? 'com gelo' : 'puro';
  const iceEn = ice === 'gelo' ? 'with ice' : 'no ice';
  if (polite) {
    return {
      pt: `Um caldo de cana com ${f.pt}, ${icePt}, por favor.`,
      en: `A sugarcane juice with ${f.en}, ${iceEn}, please.`,
    };
  }
  return {
    pt: `Me vê um caldo de cana com ${f.pt}, ${icePt}?`,
    en: `A sugarcane juice with ${f.en}, ${iceEn}?`,
  };
}

/** Every order a seed deals, in arrival order. Pure. */
export function caldoOrders(seed: number): CaldoOrder[] {
  const rng = mulberry32(seed >>> 0);
  const out: CaldoOrder[] = [];
  let at = FIRST_AT;
  const used = new Set<string>();
  for (let i = 0; i < CALDO_CUSTOMERS; i++) {
    const flavor = CALDO_FLAVORS[Math.floor(rng() * CALDO_FLAVORS.length)]!;
    const ice: CaldoIce = rng() < 0.62 ? 'gelo' : 'puro';
    let who = WHO[Math.floor(rng() * WHO.length)]!;
    if (used.has(who.id) && WHO.length > 1) who = WHO.find((w) => !used.has(w.id)) ?? who;
    used.clear();
    used.add(who.id);
    const polite = rng() < 0.7;
    out.push({
      at,
      patienceMs: CALDO_PATIENCE_MS - (i > 8 ? 4_000 : 0),
      who: who.id,
      name: who.name,
      flavor,
      ice,
      line: lineFor(flavor, ice, polite),
    });
    const rush = i >= 6 ? 0.86 : 1;
    at += Math.round(GAP_MS * rush * (0.9 + rng() * 0.22));
  }
  return out;
}

export function caldoOrdersBy(seed: number, elapsedMs: number): CaldoOrder[] {
  return caldoOrders(seed).filter((o) => o.at <= elapsedMs);
}

const POINTS: Record<FeiraQuality, number> = { perfect: 48, ok: 32, soft: 16, miss: 0 };

export function scoreCaldo(seed: number, outcomes: readonly FeiraOrderOutcome[], elapsedMs: number): {
  score: number;
  served: number;
  perfect: number;
  left: number;
} {
  const possible = caldoOrdersBy(seed, elapsedMs);
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

export const caldoModule: FeiraGameModule = {
  id: 'caldo',
  durationMs: CALDO_DURATION_MS,
  ordersBy: caldoOrdersBy,
  allOrders: caldoOrders,
  score: scoreCaldo,
};

FEIRA_GAME_MODULES.caldo = caldoModule;

/**
 * Client-side quality for one served cup.
 * Wrong flavor is a miss (the customer is annoyed, the run continues). Wrong ice or a spill on that cup is soft.
 * A correct cup served with time left is perfect; a late correct cup is ok.
 */
export function caldoServeQuality(opts: {
  flavorOk: boolean;
  iceOk: boolean;
  spilled: boolean;
  patienceLeft: number;
}): FeiraQuality {
  if (opts.patienceLeft <= 0 || !opts.flavorOk) return 'miss';
  if (!opts.iceOk || opts.spilled) return 'soft';
  return opts.patienceLeft > 0.45 ? 'perfect' : 'ok';
}

export const CALDO_POP: Record<'perfect' | 'soft' | 'miss', Bilingual> = {
  perfect: { pt: 'Perfeito!', en: 'Perfect!' },
  soft: { pt: 'Quase!', en: 'Close!' },
  miss: { pt: 'Ih…', en: 'Oh…' },
};

/** needs_br: true */
export const CALDO_WRONG_FLAVOR: Bilingual = {
  pt: 'Hmm, não era esse sabor.',
  en: 'Hmm, that was not the flavor.',
};

export const CALDO_WRONG_ICE: Bilingual = {
  pt: 'O gelo não estava certo.',
  en: 'The ice was not right.',
};

export const CALDO_SPILL: Bilingual = {
  pt: 'Derramou!',
  en: 'It spilled!',
};

export const CALDO_OVERFLOW: Bilingual = {
  pt: 'A moenda transbordou!',
  en: 'The press overflowed!',
};

export const CALDO_THANKS: Bilingual = {
  pt: 'Obrigado! Tá geladinho.',
  en: 'Thanks! Nice and cold.',
};
