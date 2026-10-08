/**
 * Pure bits of the bout UI (no DOM, no Phaser): how the server's messages turn into stage cues and into what the overlay shows.
 * Unit tested (boutLogic.test.ts).
 */
import { MOMENTUM_THRESHOLD, REF_LINES, RUNG_MAX, formatBoutClock, type Bilingual, type BoutIntentOut, type BoutServerMsg, type BoutSnapshot, type CrowdCue, type Nameplate, type RefSignal } from '@tudobem/shared';
import type { StageCue } from '../render/pixel/boutFeed';
import { glossOn } from './correriaLogic';

type Msg<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;

/**
 * Verde (the beginner plate; Phase 0's only plate) locks English glosses on, the same rule as Correria's Verde level
 * (`glossOn` at level 0). Later plates keep today's mat overlay: glosses stay behind `bout-noen` until the EN switch.
 */
export function matGlossLocked(nameplate: Nameplate | null | undefined): boolean {
  if (nameplate && nameplate !== 'verde') return false;
  return glossOn(0, false);
}

/** Root classes for the overlay. `bout-noen` hides every `.en` line. */
export function matRootClass(nameplate: Nameplate | null | undefined): string {
  return `bout-root bout-grip${matGlossLocked(nameplate) ? '' : ' bout-noen'}`;
}

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

// ---------------------------------------------------------------- the move picker (the #49 lock: no position names, only who ends on top)

export type OddsTone = 'good' | 'fair' | 'long';

/** How the percent reads at a glance: 60%+ is a good bet, under 35% a long shot. */
export const oddsTone = (percent: number | undefined): OddsTone => (percent == null || percent >= 60 ? 'good' : percent >= 35 ? 'fair' : 'long');

/**
 * One line under a move: what it does if it lands. needs_br: true (every line).
 * Grips add to the takedowns, defenses say what they undo, scoring moves say the points and who ends on top, a finish says it wins.
 */
export function moveHint(id: string, effect: NonNullable<BoutIntentOut['effect']> | undefined): { pt: string; en: string; risk?: Bilingual } {
  if (id === 'hold') return { pt: 'Passa a vez', en: 'Pass the turn' };
  if (id === 'collar_tie' || id === 'sleeve_grip') return { pt: '+10% nas quedas', en: '+10% on takedowns' };
  if (id === 'posture') return { pt: 'Solta as pegadas', en: 'Breaks the grips' };
  if (id === 'sprawl') return { pt: 'Zera as pegadas', en: 'Resets the grips' };
  if (id === 'frame' || id === 'escape_back') return { pt: 'Sai de baixo', en: 'Gets out from under' };
  if (!effect) return { pt: '', en: '' };
  const risk = effect.riskBottom ? { pt: 'Se errar: você por baixo', en: 'Miss: you end on the bottom' } : undefined;
  if (effect.submission) return { pt: 'Vale a vitória!', en: 'Wins the match!', risk };
  const top = effect.toAhead === 'you';
  if (effect.points > 0) return { pt: `+${effect.points} · você por cima`, en: `+${effect.points} · you on top` };
  return top ? { pt: 'Você por cima (já pontuou)', en: 'You on top (already scored)' } : { pt: '', en: '' };
}

/**
 * Professora Bia's one tip on the end card: the next thing to try, from how the match went and the moves the player has. needs_br: true.
 * Never names a position (the #49 lock); it talks about moves and who is on top.
 */
export function coachTip(o: { winner: 'you' | 'partner' | 'draw' | 'none'; reason: string; you: number; them: number; unlocked: readonly string[] }): Bilingual | null {
  const has = (id: string) => o.unlocked.includes(id);
  if (o.winner === 'none') return null;
  if (o.winner === 'you' && o.reason === 'finalizacao') return { pt: 'Que final! Agora tente vencer o próximo nos pontos também.', en: 'What a finish! Next time try to win on points too.' };
  if (o.winner === 'partner' && o.reason === 'finalizacao')
    return has('frame')
      ? { pt: 'Quando estiver por baixo, use Recuperar antes que ele tente o final.', en: 'When you are on the bottom, use Recuperar before they go for the finish.' }
      : { pt: 'Por baixo, tente o Gancho: virar o jogo vale pontos e tira você do aperto.', en: 'On the bottom, try Gancho: a sweep scores and gets you out of trouble.' };
  if (o.you === 0 && o.them === 0)
    return has('double_leg')
      ? { pt: 'Pegue a gola e depois vá de Queda: cada pegada deixa a Queda mais forte.', en: 'Take the collar, then go for Queda: each grip makes the takedown stronger.' }
      : { pt: 'Arrisque um golpe que vale pontos. Segurar não pontua.', en: 'Try a move that scores. Holding never does.' };
  if (o.winner === 'partner') return { pt: 'Por baixo, tente o Gancho. Por cima, Passar vale três pontos.', en: 'On the bottom, try Gancho. On top, Passar is worth three points.' };
  if (o.winner === 'draw') return { pt: 'Empate! Quando estiver na frente no fim, Segurar mantém a vitória.', en: 'A draw! When you are ahead near the end, Hold keeps the win.' };
  return has('armbar')
    ? { pt: 'Boa! Por cima e na frente, o Braço pode acabar a luta mais cedo.', en: 'Nice! On top and ahead, Braço can end the match early.' }
    : { pt: 'Boa! Continue somando pontos por cima.', en: 'Nice! Keep scoring from on top.' };
}
