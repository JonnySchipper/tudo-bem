import { describe, expect, it } from 'vitest';
import { MOMENTUM_THRESHOLD, REF_LINES, type BoutServerMsg, type BoutSnapshot } from '@tudobem/shared';
import { callOf, clockAt, crowdForResolve, cuesForEnd, cuesForFinishEnd, cuesForResolve, ladderDots, momentumFrac, resultBanner, moveHint, oddsTone, coachTip } from './boutLogic';

type Resolve = Extract<BoutServerMsg, { phase: 'resolve' }>;
type FinishEnd = Extract<BoutServerMsg, { phase: 'finish_end' }>;
type End = Extract<BoutServerMsg, { phase: 'end' }>;

const snap = (over: Partial<BoutSnapshot> = {}): BoutSnapshot => ({ rung: 0, momentum: 0, points: { you: 0, partner: 0 }, adv: { you: 0, partner: 0 }, pegada: 0, pegadaB: 0, clockMs: 300_000, exchange: 1, position: 'de_pe', ahead: null, streak: 0, ...over });
const resolve = (over: Partial<Resolve> = {}): Resolve => ({ t: 'bout', v: 1, phase: 'resolve', seq: 1, st: snap(), intent: 'puxar', yours: { correct: true, speed: 0.4, fast: false, timeout: false }, partner: { intent: 'empurrar', correct: false }, delta: 3, events: [], holdMs: 1300, ...over });

describe('bout UI logic', () => {
  it('the momentum bar shows progress to the next rung, -1..1', () => {
    expect(momentumFrac(0)).toBe(0);
    expect(momentumFrac(MOMENTUM_THRESHOLD / 2)).toBeCloseTo(0.5);
    expect(momentumFrac(-MOMENTUM_THRESHOLD)).toBe(-1);
    expect(momentumFrac(999)).toBe(1);
  });

  it('the ladder has nine steps with the current one marked', () => {
    const d = ladderDots(2);
    expect(d).toHaveLength(9);
    expect(d.filter((x) => x.here).map((x) => x.rung)).toEqual([2]);
    expect(d.filter((x) => x.filled).map((x) => x.rung)).toEqual([0, 1, 2]);
    expect(ladderDots(-3).filter((x) => x.filled).map((x) => x.rung)).toEqual([-3, -2, -1, 0]);
    expect(ladderDots(0).filter((x) => x.filled).map((x) => x.rung)).toEqual([0]);
    expect(ladderDots(99).find((x) => x.here)?.rung).toBe(4);
  });

  it('the result strip: quick, right, missed, out of time', () => {
    expect(resultBanner({ yours: { correct: true, speed: 1, fast: true, timeout: false } }).pt).toBe('Rápido!');
    expect(resultBanner({ yours: { correct: true, speed: 0.1, fast: false, timeout: false } }).pt).toBe('Certo!');
    expect(resultBanner({ yours: { correct: false, speed: 0, fast: false, timeout: false } }).pt).toBe('Errou!');
    expect(resultBanner({ yours: { correct: false, speed: 0, fast: false, timeout: true } }).pt).toBe('Tempo!');
  });

  it("a scramble becomes a transition cue, Bia's call and a crowd cue, in that order", () => {
    const m = resolve({
      st: snap({ rung: 1, position: 'guarda_fechada', ahead: 'you', streak: 1 }),
      events: [
        { type: 'transition', from: 'de_pe', to: 'guarda_fechada', rungFrom: 0, rungTo: 1, gain: 'you' },
        { type: 'points', side: 'you', pts: 2, signal: 'pontos2', line: REF_LINES.pontos2 },
      ],
    });
    const cues = cuesForResolve(m);
    expect(cues.map((c) => c.t)).toEqual(['transition', 'ref', 'crowd']);
    expect(cues[1]).toEqual({ t: 'ref', signal: 'pontos2' });
    expect(cues[2]).toEqual({ t: 'crowd', cue: 'points_you' });
    expect(callOf(m)).toEqual(REF_LINES.pontos2);
  });

  it('the louder call wins when two points land at once, and an advantage is called when nothing else is', () => {
    const m = resolve({
      events: [
        { type: 'points', side: 'you', pts: 2, signal: 'pontos2', line: REF_LINES.pontos2 },
        { type: 'points', side: 'you', pts: 4, signal: 'pontos4', line: REF_LINES.pontos4 },
      ],
    });
    expect(callOf(m)?.pt).toBe('Quatro pontos!');
    expect(callOf(resolve({ events: [{ type: 'advantage', side: 'you', signal: 'vantagem', line: REF_LINES.vantagem }] }))?.pt).toBe('Vantagem!');
    expect(callOf(resolve())).toBeNull();
    expect(crowdForResolve(resolve({ events: [{ type: 'advantage', side: 'you', signal: 'vantagem', line: REF_LINES.vantagem }] }))).toBe('advantage');
  });

  it('a miss and a quick right answer each have their own small cue; a near thing makes the crowd gasp', () => {
    expect(cuesForResolve(resolve({ yours: { correct: false, speed: 0, fast: false, timeout: false } }))[0]).toEqual({ t: 'miss' });
    expect(cuesForResolve(resolve({ yours: { correct: true, speed: 1, fast: true, timeout: false } }))[0]).toEqual({ t: 'hit', strength: 1 });
    expect(crowdForResolve(resolve({ st: snap({ momentum: MOMENTUM_THRESHOLD * 0.8 }) }))).toBe('near');
    expect(crowdForResolve(resolve({ yours: { correct: false, speed: 0, fast: false, timeout: true } }))).toBe('miss');
    expect(crowdForResolve(resolve())).toBeNull();
    expect(cuesForResolve(resolve({ st: snap({ streak: 4 }) })).some((c) => c.t === 'long')).toBe(true);
  });

  it("finalização results: the tap, the escape back to guard, the partner's tap", () => {
    const fe = (over: Partial<FinishEnd>): FinishEnd => ({ t: 'bout', v: 1, phase: 'finish_end', kind: 'finalizacao', success: true, st: snap({ rung: 1, position: 'guarda_fechada', ahead: 'you' }), line: REF_LINES.parar, signal: 'parar', holdMs: 1800, ...over });
    const prev = snap({ rung: 4, position: 'montada', ahead: 'you' });
    expect(cuesForFinishEnd(fe({}), prev).map((c) => c.t)).toEqual(['finish', 'ref', 'crowd']);
    const failed = cuesForFinishEnd(fe({ success: false, signal: null }), prev);
    expect(failed[0]).toMatchObject({ t: 'transition', from: 'montada', to: 'guarda_fechada', gain: null });
    expect(failed.some((c) => c.t === 'escaped')).toBe(true);
    expect(cuesForFinishEnd(fe({ kind: 'escape', success: false }), prev)[0]).toEqual({ t: 'finish', winner: 'partner' });
    expect(cuesForFinishEnd(fe({ kind: 'escape', success: true, signal: null }), snap({ rung: -4, position: 'costas', ahead: 'partner' })).some((c) => c.t === 'escaped')).toBe(true);
  });

  it('the end: a win raises a hand and Bia calls the victory; a quit shows nothing', () => {
    const end = (over: Partial<End>): End => ({ t: 'bout', v: 1, phase: 'end', winner: 'you', reason: 'pontos', st: snap(), rv: 12, bjj: { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie'] }, belt: 'branca', stripeUp: true, beltUp: false, bond: 3, line: { pt: 'Vitória nos pontos!', en: 'x' }, thanks: { pt: 'Obrigado pela partida.', en: 'x' }, signal: 'vitoria', ...over });
    expect(cuesForEnd(end({})).map((c) => c.t)).toEqual(['end', 'ref', 'crowd']);
    expect(cuesForEnd(end({ winner: 'none', reason: 'quit', signal: null }))).toEqual([]);
  });

  it('the scoreboard clock runs 2x while an exchange is on and holds otherwise', () => {
    expect(clockAt(300_000, 5_000, 2, true)).toBe('4:50');
    expect(clockAt(300_000, 5_000, 2, false)).toBe('5:00');
    expect(clockAt(10_000, 99_000, 2, true)).toBe('0:00');
  });
});

describe('move picker hints and the end-card tip (polish)', () => {
  const NAMES = /guarda|montada|costas|cem quilos|joelho na|finaliza|submission|closed guard|side control|\bmount\b/i;

  it('says what a move does without naming a position', () => {
    expect(moveHint('collar_tie', undefined).pt).toBe('+10% nas quedas');
    expect(moveHint('double_leg', { points: 2, to: 'cem_quilos', toAhead: 'you', submission: false, riskBottom: false }).pt).toBe('+2 · você por cima');
    const arm = moveHint('armbar', { points: 0, to: 'montada', toAhead: 'you', submission: true, riskBottom: true });
    expect(arm.pt).toBe('Vale a vitória!');
    expect(arm.risk?.pt).toBe('Se errar: você por baixo');
    expect(moveHint('hold', undefined).pt).toBe('Passa a vez');
    const all = ['collar_tie', 'posture', 'sprawl', 'frame', 'hold'].map((id) => moveHint(id, undefined)).concat([arm]);
    expect(all.flatMap((x) => [x.pt, x.en, x.risk?.pt ?? '', x.risk?.en ?? '']).join(' ')).not.toMatch(NAMES);
  });

  it('reads the odds as good, fair or a long shot', () => {
    expect([oddsTone(70), oddsTone(45), oddsTone(18), oddsTone(undefined)]).toEqual(['good', 'fair', 'long', 'good']);
  });

  it('Bia gives one tip that fits the result and the moves you have', () => {
    expect(coachTip({ winner: 'none', reason: 'quit', you: 0, them: 0, unlocked: [] })).toBeNull();
    expect(coachTip({ winner: 'draw', reason: 'empate', you: 0, them: 0, unlocked: ['double_leg'] })?.pt).toContain('Queda');
    expect(coachTip({ winner: 'partner', reason: 'finalizacao', you: 0, them: 0, unlocked: ['frame'] })?.pt).toContain('Recuperar');
    const tips = (['you', 'partner', 'draw'] as const).flatMap((w) =>
      ['pontos', 'finalizacao', 'empate'].map((r) => coachTip({ winner: w, reason: r, you: 2, them: 1, unlocked: ['armbar', 'frame', 'double_leg'] })),
    );
    expect(tips.flatMap((t) => [t?.pt ?? '', t?.en ?? '']).join(' ')).not.toMatch(NAMES);
  });
});
