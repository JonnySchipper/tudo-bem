/**
 * The Feira cart games' shared view-model: the freguesia (crowd) meter, how urgent an order looks,
 * the sweet-spot window on a cook bar, and the win / hold / lose beat on the end card.
 *
 * Pure, so it is tested without a DOM. Nothing here scores a run: the server still recomputes the
 * score from per-order outcomes. The crowd meter is only how a serve or a walk-out reads on screen.
 *
 * needs_br: true (END_BEAT, CROWD_LABEL, EXIT_LINE).
 */
import type { Bilingual, FeiraQuality } from '@tudobem/shared';

/** What happened to one customer: a served quality, or they waited out their patience. */
export type FeiraExit = FeiraQuality | 'left';

/** The crowd meter runs -CROWD_MAX..CROWD_MAX. A run starts in the middle. */
export const CROWD_MAX = 6;

/** A perfect serve brings people over; a wrong order or a walk-out sends them to the next stall. */
export const CROWD_STEP: Record<FeiraExit, number> = { perfect: 2, ok: 1, soft: 0, miss: -1, left: -2 };

/** Heads drawn on the meter. */
export const CROWD_HEADS = 10;

export function crowdAfter(ground: number, exit: FeiraExit): number {
  return Math.max(-CROWD_MAX, Math.min(CROWD_MAX, ground + CROWD_STEP[exit]));
}

/** How many of the CROWD_HEADS are standing at the stall. Half at the start. */
export function crowdHeads(ground: number): number {
  const frac = (Math.max(-CROWD_MAX, Math.min(CROWD_MAX, ground)) + CROWD_MAX) / (2 * CROWD_MAX);
  return Math.round(frac * CROWD_HEADS);
}

export type Urgency = 'calm' | 'hurry' | 'late';

/** Patience left (1 → 0) as a ticket colour. `late` matches where the portrait turns pensativo. */
export function urgency(patienceLeft: number): Urgency {
  if (patienceLeft >= 0.5) return 'calm';
  if (patienceLeft >= 0.28) return 'hurry';
  return 'late';
}

/** The sweet spot on a cook bar that fills from 0 to `span` ms, as CSS percentages. */
export function meterZone(fromMs: number, toMs: number, spanMs: number): { left: number; width: number } {
  const s = Math.max(1, spanMs);
  const a = Math.max(0, Math.min(100, (fromMs / s) * 100));
  const b = Math.max(a, Math.min(100, (toMs / s) * 100));
  return { left: Math.round(a * 10) / 10, width: Math.round((b - a) * 10) / 10 };
}

/** The floater over a customer as they go. */
export const EXIT_LINE: Record<FeiraExit, Bilingual> = {
  perfect: { pt: 'Perfeito!', en: 'Perfect!' },
  ok: { pt: 'Valeu!', en: 'Thanks!' },
  soft: { pt: 'Hmm, tá bom.', en: 'Hmm, it’ll do.' },
  miss: { pt: 'Não foi isso…', en: 'Not what I asked…' },
  left: { pt: 'Foi embora!', en: 'They left!' },
};

export const CROWD_LABEL: Bilingual = { pt: 'Freguesia', en: 'Customers' };

export type EndTier = 'win' | 'hold' | 'lose';

/**
 * The end card's beat, from what the server sent back. More served than lost, and a real score,
 * is ground gained. Losing more than you served is ground lost. Anything else held the spot.
 */
export function endTier(end: { score: number; served: number; left: number }): EndTier {
  if (end.served <= 0) return 'lose';
  if (end.served < end.left) return 'lose';
  if (end.served >= end.left + 2 && end.score >= 150) return 'win';
  return 'hold';
}

export const END_BEAT: Record<EndTier, { stamp: Bilingual; line: Bilingual }> = {
  win: {
    stamp: { pt: 'Barraca cheia!', en: 'Packed stall!' },
    line: { pt: 'A freguesia veio toda pra cá.', en: 'The whole crowd came to your stall.' },
  },
  hold: {
    stamp: { pt: 'Segurou o ponto', en: 'Held your spot' },
    line: { pt: 'A barraca aguentou firme.', en: 'Your stall held steady.' },
  },
  lose: {
    stamp: { pt: 'Freguesia fugiu', en: 'Customers walked' },
    line: { pt: 'O pessoal foi pra outra barraca.', en: 'People went to another stall.' },
  },
};

/** The client's running guess for one serve. The server's number on the end card is the real one. */
export function pointsFor(q: FeiraQuality): number {
  return q === 'perfect' ? 48 : q === 'ok' ? 32 : q === 'soft' ? 16 : 0;
}
