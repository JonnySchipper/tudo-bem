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
  rollBow,
  rollChromeLabel,
  rollDecisaoLine,
  rollFistBump,
  rollPuzzleBank,
  rollScrambleLine,
  rollTapLine,
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
    const bannedIds = [
      'cloze_valeu',
      'cloze_oss',
      'reorder_oss',
      'reorder_prof',
      'cloze_obrigado',
      'reorder_treinar',
    ];
    const bjjQuizTokens = /\b(oss|rola|professor|treinar|tatame|kimono)\b/i;
    for (const p of bank) {
      expect(p.kind === 'cloze' || p.kind === 'choice' || p.kind === 'reorder').toBe(true);
      expect(p.id).not.toMatch(/^tech_/);
      expect(bannedIds).not.toContain(p.id);
      const promptPt = p.prompt.pt;
      expect(promptPt).not.toMatch(bjjQuizTokens);
      if (p.options) {
        for (const o of p.options) {
          expect(o.pt).not.toMatch(/^Oss$/i);
        }
      }
      if (p.words) {
        for (const w of p.words) {
          expect(w).not.toMatch(bjjQuizTokens);
        }
      }
    }
    const ids = new Set(bank.map((p) => p.id));
    expect(ids.has('cloze_bom_dia')).toBe(true);
    expect(ids.has('cloze_me_ve')).toBe(true);
    expect(ids.has('cloze_feira')).toBe(true);
    expect(ids.has('lex_pao_chapa')).toBe(true);
    expect(ids.has('reorder_obrigado_pao')).toBe(true);
    expect(ids.has('reorder_tudo_bem')).toBe(true);
  });

  it('roll chrome lines avoid Oss/rola and technique trivia', () => {
    const chromePt = [
      rollBow().pt,
      rollFistBump().pt,
      rollTapLine('player').pt,
      rollTapLine('cpu').pt,
      rollScrambleLine('player').pt,
      rollScrambleLine('cpu').pt,
      rollScrambleLine('none').pt,
      rollDecisaoLine('cpu').pt,
      rollDecisaoLine('player').pt,
      rollDecisaoLine('draw').pt,
      ...[0, 1, 2, 3, 4].map((i) => rollChromeLabel(i, 0).pt),
    ].join(' ');
    expect(chromePt).not.toMatch(/\boss\b|\brola\b|rolar|fist bump|finaliza|guarda|kimura|triângulo|mata-leão|guilhotina|montada|joelho na barriga|cem quilos/i);
    expect(rollChromeLabel(0, 0).pt).toBe('Vantagem');
    expect(rollChromeLabel(2, 1).pt).toBe('Quase lá');
    expect(rollChromeLabel(0, ROLL_FINISH_INDEX).pt).toBe('Final');
    expect(rollTapLine('player').pt).toBe('Boa! Você chegou no final.');
    expect(rollScrambleLine('player').pt).toBe('Você avançou!');
    expect(rollDecisaoLine('draw').pt).toBe('Empate na decisão. Valeu!');
  });

  it('keeps pose ids for the mat while chrome stays a neutral step', () => {
    const atFinish = displayPosition(0, ROLL_FINISH_INDEX);
    expect(atFinish.position).toBe('costas');
    expect(atFinish.label.pt).toBe('Costas');
    expect(rollChromeLabel(0, ROLL_FINISH_INDEX)).toEqual({ pt: 'Final', en: 'Finish' });
    expect(atFinish.submissionHint).toEqual({ pt: 'Final', en: 'Finish' });
  });
});
