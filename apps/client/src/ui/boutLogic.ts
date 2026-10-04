/**
 * Pure bits of the bout UI (no DOM, no Phaser): how the server's messages turn into stage cues and into what the overlay shows.
 * Unit tested (boutLogic.test.ts).
 */
import { MOMENTUM_THRESHOLD, REF_LINES, RUNG_MAX, formatBoutClock, type Bilingual, type BoutServerMsg, type BoutSnapshot, type CrowdCue, type RefSignal } from '@tudobem/shared';
import type { StageCue } from '../render/pixel/boutFeed';

type Msg<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;

/** -1..1: how far the momentum bar is toward the next rung (1 = about to move your way, -1 = the partner's way). */
export const momentumFrac = (m: number): number => Math.max(-1, Math.min(1, m / MOMENTUM_THRESHOLD));

export interface LadderDot {
  rung: number;
  /** the current position */
  here: boolean;
  /** between the middle and here: the path just walked */
  filled: boolean;
}

/** The nine steps of the ladder, partner's end (-4) to yours (+4), marking where the bout is. */
export function ladderDots(rung: number): LadderDot[] {
  const r = Math.max(-RUNG_MAX, Math.min(RUNG_MAX, Math.trunc(rung)));
  return Array.from({ length: RUNG_MAX * 2 + 1 }, (_, i) => {
    const d = i - RUNG_MAX;
    return { rung: d, here: d === r, filled: r === 0 ? d === 0 : r > 0 ? d >= 0 && d <= r : d <= 0 && d >= r };
  });
}

/** The strip under the bar after an exchange. */
export function resultBanner(m: Pick<Msg<'resolve'>, 'yours'>): Bilingual {
  if (!m.yours.correct) return m.yours.timeout ? { pt: 'Tempo!', en: 'Time!' } : { pt: 'Errou!', en: 'Missed!' };
  return m.yours.fast ? { pt: 'Rápido!', en: 'Quick!' } : { pt: 'Certo!', en: 'Right!' };
}

const signalOf = (e: Msg<'resolve'>['events'][number]): RefSignal | null => (e.type === 'points' || e.type === 'advantage' ? e.signal : null);

/** The move that just resolved, from the fighter who played it. */
function moveLanded(m: Pick<Msg<'resolve'>, 'actor' | 'yours' | 'partner'>): boolean {
  return m.actor === 'partner' ? m.partner.correct : m.yours.correct;
}

/** Everything the stage should do for a resolved exchange, in the order it should happen. */
export function cuesForResolve(m: Msg<'resolve'>): StageCue[] {
  const out: StageCue[] = [];
  const t = m.events.find((e) => e.type === 'transition');
  if (t && t.type === 'transition') {
    out.push({ t: 'transition', from: t.from, to: t.to, rungFrom: t.rungFrom, rungTo: t.rungTo, gain: t.gain });
  } else if (!moveLanded(m)) out.push({ t: 'miss' });
  else if (m.yours.fast) out.push({ t: 'hit', strength: 1 });
  for (const e of m.events) {
    const s = signalOf(e);
    if (s) out.push({ t: 'ref', signal: s });
  }
  const crowd = crowdForResolve(m);
  if (crowd) out.push({ t: 'crowd', cue: crowd });
  if (m.st.streak >= 3 || m.st.exchange >= 8) out.push({ t: 'long' });
  return out;
}

export function crowdForResolve(m: Msg<'resolve'>): CrowdCue | null {
  const pts = m.events.find((e) => e.type === 'points');
  if (pts && pts.type === 'points') return pts.side === 'you' ? 'points_you' : 'points_partner';
  if (m.events.some((e) => e.type === 'advantage')) return 'advantage';
  if (Math.abs(m.st.momentum) >= MOMENTUM_THRESHOLD * 0.65) return 'near';
  if (!moveLanded(m)) return 'miss';
  return null;
}

/** The line Bia calls for the most important event of an exchange (points beat advantages), for the speech bubble and the voice. */
export function callOf(m: Pick<Msg<'resolve'>, 'events'>): Bilingual | null {
  const pts = m.events.filter((e) => e.type === 'points');
  if (pts.length) {
    const best = pts.reduce((a, b) => (a.type === 'points' && b.type === 'points' && b.pts > a.pts ? b : a));
    return best.type === 'points' ? best.line : null;
  }
  const adv = m.events.find((e) => e.type === 'advantage');
  return adv && adv.type === 'advantage' ? adv.line : null;
}

export function cuesForFinishEnd(m: Msg<'finish_end'>, prev: BoutSnapshot | null): StageCue[] {
  const out: StageCue[] = [];
  if (m.kind === 'finalizacao' && m.success) out.push({ t: 'finish', winner: 'you' });
  else if (m.kind === 'finalizacao') {
    // the partner escapes back to guard: a cut to the new position, no art for that step
    if (prev && prev.position !== m.st.position) out.push({ t: 'transition', from: prev.position, to: m.st.position, rungFrom: prev.rung, rungTo: m.st.rung, gain: null });
    out.push({ t: 'escaped' });
  } else if (m.success) {
    if (prev && prev.position !== m.st.position) out.push({ t: 'transition', from: prev.position, to: m.st.position, rungFrom: prev.rung, rungTo: m.st.rung, gain: null });
    out.push({ t: 'escaped' });
  } else out.push({ t: 'finish', winner: 'partner' });
  if (m.signal) out.push({ t: 'ref', signal: m.signal });
  out.push({ t: 'crowd', cue: m.kind === 'finalizacao' ? (m.success ? 'finish_you' : 'miss') : m.success ? 'escape' : 'tap' });
  return out;
}

export function cuesForEnd(m: Msg<'end'>): StageCue[] {
  if (m.winner === 'none') return [];
  const out: StageCue[] = [{ t: 'end', winner: m.winner, reason: m.reason }];
  if (m.signal) out.push({ t: 'ref', signal: m.signal });
  out.push({ t: 'crowd', cue: m.reason === 'finalizacao' ? 'tap' : 'end' });
  return out;
}

/** The text of the pip icon of an intent: how risky it is. */
export const RISK_LABEL: Record<1 | 2 | 3, Bilingual> = {
  1: { pt: 'Seguro', en: 'Safe' },
  2: { pt: 'Firme', en: 'Steady' },
  3: { pt: 'Ousado', en: 'Bold' },
};

/** The scoreboard clock the overlay shows: the snapshot's value running down at `rate` while time passes. */
export function clockAt(snapClockMs: number, sinceMs: number, rate: number, running: boolean): string {
  return formatBoutClock(running ? snapClockMs - Math.max(0, sinceMs) * rate : snapClockMs);
}

export const COMBATE: Bilingual = REF_LINES.combate;
