/**
 * Caldo de cana — the multitasking Feira cart game.
 *
 * Customers ask for a sugarcane juice with a flavor and either gelo or puro. The player feeds cane,
 * holds the flywheel to press it, lets go when the cup reaches its line (short or over the rim is a soft
 * fail), squeezes the flavor, adds ice when asked, and serves before the customer leaves. Several orders
 * wait at once. A mistake annoys the customer and costs points; it never ends the run.
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
  FEIRA_REGULARS,
  feiraFreshFace,
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

/**
 * The press. Hold the flywheel and the cane goes through the rollers: juice runs from the spout while you hold.
 * One cane gives `canePerCup` cups' worth. The cup has a line (level 1): let go anywhere from `lineFrom` up to
 * `overAt` for a clean pour. Short of `lineFrom` is "faltou"; past `overAt` it runs over the rim and spills.
 */
export const CALDO_CRANK = {
  /** Cup fill per second of cranking (1 = the line). About 1.4 s from empty to the line. */
  fillPerSec: 0.72,
  /** How much juice one cane holds, in cups (1 = one cup to the line). */
  canePerCup: 1.6,
  lineFrom: 0.86,
  overAt: 1.08,
  /** The cup holds this much (the drawing's brim). */
  max: 1.3,
} as const;

export type CaldoFill = 'short' | 'line' | 'over';

/** Judge a cup by how far it was filled (1 = the line). */
export function caldoFill(level: number): CaldoFill {
  if (level < CALDO_CRANK.lineFrom) return 'short';
  if (level > CALDO_CRANK.overAt) return 'over';
  return 'line';
}

export interface CaldoOrder extends FeiraCustomerOrder {
  flavor: CaldoFlavor;
  ice: CaldoIce;
  line: Bilingual;
}

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

/** The flavours of a player's 1st Caldo run (`PrivateProfile.feiraRuns.caldo` is 0): three bottles, not seven. */
export const CALDO_FIRST_FLAVORS = ['limao', 'abacaxi', 'maracuja'] as const satisfies readonly CaldoFlavor[];

/** The bottles on the counter and the flavours asked for, by runs already played. `runs` undefined is the full game. */
export function caldoFlavors(runs?: number): readonly CaldoFlavor[] {
  return runs !== undefined && Number.isFinite(runs) && runs < 1 ? CALDO_FIRST_FLAVORS : CALDO_FLAVORS;
}

/**
 * Every order a seed deals, in arrival order. Pure. `runs` (see `caldoFlavors`) only narrows the flavours: arrival
 * times and patience come from the seed alone, so the server scores the same run without it.
 */
export function caldoOrders(seed: number, runs?: number): CaldoOrder[] {
  const flavors = caldoFlavors(runs);
  const rng = mulberry32(seed >>> 0);
  const out: CaldoOrder[] = [];
  let at = FIRST_AT;
  const recent: string[] = [];
  for (let i = 0; i < CALDO_CUSTOMERS; i++) {
    const flavor = flavors[Math.floor(rng() * flavors.length)]!;
    const ice: CaldoIce = rng() < 0.62 ? 'gelo' : 'puro';
    const who = feiraFreshFace(FEIRA_REGULARS[Math.floor(rng() * FEIRA_REGULARS.length)]!, recent);
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
  /** Served short of the line (the cup is not full). */
  short?: boolean;
}): FeiraQuality {
  if (opts.patienceLeft <= 0 || !opts.flavorOk) return 'miss';
  if (!opts.iceOk || opts.spilled || opts.short) return 'soft';
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
  pt: 'Transbordou o copo!',
  en: 'The cup ran over!',
};

export const CALDO_SHORT: Bilingual = {
  pt: 'Faltou caldo no copo.',
  en: 'The cup is not full.',
};

export const CALDO_LINE: Bilingual = {
  pt: 'Na linha!',
  en: 'Right on the line!',
};

export const CALDO_NO_CANE: Bilingual = {
  pt: 'Põe mais cana!',
  en: 'Put in more cane!',
};

export const CALDO_NO_CUP: Bilingual = {
  pt: 'Sem copo! Caiu no balcão.',
  en: 'No cup! It went on the counter.',
};

export const CALDO_THANKS: Bilingual = {
  pt: 'Obrigado! Tá geladinho.',
  en: 'Thanks! Nice and cold.',
};
