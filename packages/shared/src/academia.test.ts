import { describe, expect, it } from 'vitest';
import {
  ROLL_FINISH_INDEX,
  ROLL_MAX_DUELS,
  checkRollAnswer,
  cpuGetsIt,
  decisaoWinner,
  displayPosition,
  makeRollPuzzle,
  normalizeBjj,
  resolveDuel,
  rollPuzzleBank,
  stripesForWins,
  toPuzzleView,
} from './index.js';
import { mulberry32 } from './meveum.js';

describe('academia roll', () => {
  it('normalizes belt progress and stripes never exceed four', () => {
    expect(normalizeBjj()).toEqual({ belt: 'branca', stripes: 0, wins: 0 });
    expect(stripesForWins(9)).toBe(3);
    expect(stripesForWins(12)).toBe(4);
  });

  it('never promotes past faixa branca in v0 (stripes only)', () => {
    expect(normalizeBjj({ belt: 'azul' as 'branca', stripes: 2, wins: 5 })).toEqual({ belt: 'branca', stripes: 2, wins: 5 });
  });

  it('resolves duels: first correct advances; ties do not', () => {
    expect(resolveDuel(true, false, 0, 0)).toMatchObject({ advance: 'player', playerIdx: 1, submission: null });
    expect(resolveDuel(false, true, 2, 2)).toMatchObject({ advance: 'cpu', cpuIdx: 3, submission: null });
    expect(resolveDuel(true, true, 1, 1)).toMatchObject({ advance: 'none', playerIdx: 1, cpuIdx: 1 });
    expect(resolveDuel(false, false, 1, 1)).toMatchObject({ advance: 'none' });
    expect(resolveDuel(true, false, ROLL_FINISH_INDEX, 0)).toMatchObject({ submission: 'player', playerIdx: ROLL_FINISH_INDEX });
  });

  it('checks puzzle answers across kinds', () => {
    const rng = mulberry32(99);
    const used = new Set<string>();
    const p = makeRollPuzzle(rng, used);
    const view = toPuzzleView(rng, p);
    expect(view.id).toBe(p.id);
    if (p.kind === 'reorder' && p.correctOrder) {
      expect(checkRollAnswer(p, { kind: 'reorder', order: p.correctOrder })).toBe(true);
      expect(checkRollAnswer(p, { kind: 'reorder', order: [...p.correctOrder].reverse() })).toBe(false);
    } else {
      expect(checkRollAnswer(p, { kind: 'choice', index: p.correct })).toBe(true);
      expect(checkRollAnswer(p, { kind: 'choice', index: (p.correct + 1) % 4 })).toBe(false);
    }
  });

  it('decides winner by position index at cap', () => {
    expect(decisaoWinner(3, 1)).toBe('player');
    expect(decisaoWinner(1, 3)).toBe('cpu');
    expect(decisaoWinner(2, 2)).toBe('draw');
  });

  it('CPU accuracy is below fifty percent on average', () => {
    const rng = mulberry32(7);
    let wins = 0;
    for (let i = 0; i < 500; i++) if (cpuGetsIt(rng)) wins++;
    expect(wins / 500).toBeLessThan(0.5);
  });

  it('respects max duel cap constant', () => {
    expect(ROLL_MAX_DUELS).toBe(10);
  });

  it('puzzle bank is Portuguese A1 only — no technique trivia', () => {
    const bank = rollPuzzleBank();
    expect(bank.length).toBeGreaterThanOrEqual(20);
    for (const p of bank) {
      expect(p.kind === 'cloze' || p.kind === 'reorder').toBe(true);
      expect(p.id).not.toMatch(/^tech_/);
    }
    const ids = new Set(bank.map((p) => p.id));
    expect(ids.has('cloze_obrigado')).toBe(true);
    expect(ids.has('cloze_feira')).toBe(true);
    expect(ids.has('reorder_treinar')).toBe(true);
  });

  it('shows Mata-leão HUD accent on Costas (rear naked choke, not Guilhotina)', () => {
    const atFinish = displayPosition(0, ROLL_FINISH_INDEX);
    expect(atFinish.position).toBe('costas');
    expect(atFinish.label.pt).toBe('Costas');
    expect(atFinish.submissionHint).toEqual({ pt: 'Mata-leão', en: 'Rear naked choke' });
  });
});
