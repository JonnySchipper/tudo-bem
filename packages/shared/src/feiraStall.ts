/**
 * Shared look-and-feel rules for the three Feira cart games (Tapioca, Pastel, Caldo de cana).
 *
 * Display only. The server scores the run (`judgeFeiraResult`); nothing here changes points, RV or
 * the daily paid runs. These helpers decide where the freguesia meter sits, where the sweet spot
 * sits on a cook meter, and which stamp the end card shows.
 *
 * needs_br: true (stamps and end-card lines).
 */
import type { Bilingual } from './types.js';

/** A window on a 0..1 bar, as fractions of its width. */
export interface FeiraMeterWindow {
  from: number;
  to: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The sweet spot `lo..hi` (ms) on a cook meter that runs `0..span` ms. */
export function feiraMeterWindow(lo: number, hi: number, span: number): FeiraMeterWindow {
  if (!(span > 0)) return { from: 0, to: 0 };
  const from = clamp01(lo / span);
  return { from, to: Math.max(from, clamp01(hi / span)) };
}

/** Each customer served pushes the freguesia meter this far right; each one who left pushes it as far left. */
export const FEIRA_CROWD_STEP = 0.08;

/**
 * Where the freguesia meter sits, 0..1. A run starts at the middle: ground gained to the right,
 * ground lost to the left. Served customers and customers who left (a miss) cancel out one for one.
 */
export function feiraCrowd(served: number, left: number): number {
  return clamp01(0.5 + (Math.max(0, served) - Math.max(0, left)) * FEIRA_CROWD_STEP);
}

export type FeiraEndTier = 'lotada' | 'ganhou' | 'empate' | 'perdeu';

/** The end card reads as ground gained or lost: served vs. customers who left. */
export function feiraEndTier(r: { served: number; left: number }): FeiraEndTier {
  const net = r.served - r.left;
  if (net >= 6 && r.left <= 1) return 'lotada';
  if (net > 0) return 'ganhou';
  if (net === 0) return 'empate';
  return 'perdeu';
}

export const FEIRA_END_STAMP: Record<FeiraEndTier, { stamp: Bilingual; line: Bilingual }> = {
  lotada: {
    stamp: { pt: 'Barraca lotada!', en: 'Packed stall!' },
    line: { pt: 'A freguesia voltou e trouxe os amigos.', en: 'Your regulars came back and brought friends.' },
  },
  ganhou: {
    stamp: { pt: 'Ganhou freguesia', en: 'You won customers' },
    line: { pt: 'Amanhã tem mais gente na fila.', en: 'More people in line tomorrow.' },
  },
  empate: {
    stamp: { pt: 'Freguesia na mesma', en: 'Same crowd as before' },
    line: { pt: 'Ninguém ganhou, ninguém perdeu.', en: 'Nobody won, nobody lost.' },
  },
  perdeu: {
    stamp: { pt: 'Perdeu freguesia', en: 'You lost customers' },
    line: { pt: 'Teve freguês que foi pra outra barraca.', en: 'Some customers went to another stall.' },
  },
};

/** The meter label over the freguesia bar. */
export const FEIRA_CROWD_LABEL: Bilingual = { pt: 'Freguesia', en: 'Your customers' };
