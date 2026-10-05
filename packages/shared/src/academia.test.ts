import { describe, expect, it } from 'vitest';
import {
  BOUT_BOND_DAILY_CAP,
  BLUE_BELT_WINS,
  PARTNERS,
  ROLL_RV_DRAW,
  ROLL_RV_FINISH,
  ROLL_RV_LOSS,
  ROLL_RV_WIN,
  bjjLevel,
  boutBond,
  boutRv,
  normalizeBjj,
  partnerById,
  partnerUnlocked,
  progressForWins,
  recordWin,
} from './index.js';

describe('belts, stripes and the profile', () => {
  it('a fresh profile is a white belt with one move on each gag track, and no stripes', () => {
    const starters = ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'armbar'];
    expect(normalizeBjj()).toEqual({ belt: 'branca', stripes: 0, wins: 0, unlocked: starters });
    expect(normalizeBjj(null)).toEqual({ belt: 'branca', stripes: 0, wins: 0, unlocked: starters });
    expect(normalizeBjj({ belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie'] }).unlocked).toEqual(starters);
  });

  it('wins, not a single win, move stripes and then the next belt', () => {
    expect(progressForWins(0)).toEqual({ belt: 'branca', stripes: 0 });
    expect(progressForWins(2)).toEqual({ belt: 'branca', stripes: 0 });
    expect(progressForWins(3)).toEqual({ belt: 'branca', stripes: 1 });
    expect(progressForWins(12)).toEqual({ belt: 'branca', stripes: 4 });
    expect(BLUE_BELT_WINS).toBe(15);
    expect(progressForWins(15)).toEqual({ belt: 'azul', stripes: 0 });
    expect(progressForWins(21)).toEqual({ belt: 'azul', stripes: 1 });
    expect(progressForWins(45)).toEqual({ belt: 'roxa', stripes: 0 });
    expect(progressForWins(105)).toEqual({ belt: 'marrom', stripes: 0 });
    expect(progressForWins(225)).toEqual({ belt: 'preta', stripes: 0 });
    expect(progressForWins(225 + 48)).toEqual({ belt: 'preta', stripes: 1 });
    expect(progressForWins(9999).belt).toBe('preta');
  });

  it('old saves follow the win count, and odd ones come back coherent', () => {
    expect(normalizeBjj({ belt: 'branca', stripes: 4, wins: 4 })).toMatchObject({ belt: 'branca', stripes: 1, wins: 4 });
    expect(normalizeBjj({ belt: 'branca', stripes: 2, wins: 2 })).toMatchObject({ belt: 'branca', stripes: 0, wins: 2 });
    expect(normalizeBjj({ stripes: 4, wins: 0 })).toMatchObject({ belt: 'branca', stripes: 0, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'armbar'] });
    expect(normalizeBjj({ stripes: -3, wins: -9 } as never)).toMatchObject({ belt: 'branca', stripes: 0, wins: 0 });
    expect(normalizeBjj({ stripes: 'x', wins: 'y', belt: 'preta' } as never)).toMatchObject({ belt: 'branca', stripes: 0, wins: 0 });
    // 18 wins is a blue belt with no stripe yet (white takes 15)
    expect(normalizeBjj({ belt: 'azul', stripes: 2, wins: 18 })).toMatchObject({ belt: 'azul', stripes: 0, wins: 18 });
  });

  it('recording a win reports stripe and belt changes', () => {
    let p = normalizeBjj();
    const seen: string[] = [];
    for (let i = 0; i < 15; i++) {
      const w = recordWin(p);
      p = w.progress;
      if (w.stripeUp) seen.push(`stripe@${p.wins}`);
      if (w.beltUp) seen.push(`belt@${p.wins}`);
    }
    expect(seen).toEqual(['stripe@3', 'stripe@6', 'stripe@9', 'stripe@12', 'belt@15']);
    expect(p).toMatchObject({ belt: 'azul', stripes: 0, wins: 15 });
  });

  it('the level follows belt and stripes', () => {
    expect(bjjLevel()).toBe(0);
    expect(bjjLevel({ belt: 'branca', stripes: 3, wins: 9 })).toBe(3);
    expect(bjjLevel({ belt: 'azul', stripes: 0, wins: 15 })).toBe(4);
    expect(bjjLevel({ belt: 'azul', stripes: 4, wins: 39 })).toBe(8);
  });

  it('a belt is only ever earned: there is no way to buy one (no price, no shop field)', () => {
    const p = normalizeBjj({ belt: 'azul', stripes: 0, wins: 0 } as never);
    expect(Object.keys(p).sort()).toEqual(['belt', 'stripes', 'unlocked', 'wins']);
    expect(JSON.stringify(PARTNERS)).not.toMatch(/price|preço|coins|cost/i);
  });
});

describe('partners', () => {
  it('five partners with the five styles, a one-line bio each, a first name from the allowlist', () => {
    expect(PARTNERS).toHaveLength(5);
    expect(new Set(PARTNERS.map((p) => p.id)).size).toBe(5);
    const styles = PARTNERS.map((p) => p.style.en);
    expect(styles).toEqual(['Balanced', 'Fast but sloppy', 'Slow and precise', 'Defensive', 'Aggressive']);
    for (const p of PARTNERS) {
      expect(p.bio.pt.length).toBeGreaterThan(10);
      expect(p.bio.pt).not.toContain('\n');
      for (const k of ['accuracy', 'speed', 'aggression', 'defense'] as const) {
        expect(p[k]).toBeGreaterThan(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('each style is what it says', () => {
    const by = (id: string) => partnerById(id)!;
    expect(by('felipe').speed).toBeGreaterThan(by('mateus').speed);
    expect(by('felipe').accuracy).toBeLessThan(by('mateus').accuracy);
    expect(by('helena').accuracy).toBeGreaterThan(by('mateus').accuracy);
    expect(by('helena').speed).toBeLessThan(by('mateus').speed);
    expect(by('rafael').aggression).toBeGreaterThan(0.8);
    expect(by('daniel').defense).toBeGreaterThan(0.8);
    expect(by('daniel').aggression).toBeLessThan(by('mateus').aggression);
  });

  it('partners unlock with the level; the first is always open', () => {
    expect(PARTNERS.map((p) => p.unlockLevel)).toEqual([0, 1, 2, 3, 4]);
    const open = (wins: number) => PARTNERS.filter((p) => partnerUnlocked(p, normalizeBjj({ wins }))).map((p) => p.id);
    expect(open(0)).toEqual(['mateus']);
    expect(open(3)).toEqual(['mateus', 'felipe']);
    expect(open(9)).toEqual(['mateus', 'felipe', 'helena', 'daniel']);
    expect(open(12)).toHaveLength(5);
    expect(partnerById('nobody')).toBeUndefined();
  });
});

describe('rewards', () => {
  it('RV: a finalização pays most, a loss still pays a little', () => {
    expect(boutRv('you', 'finalizacao')).toBe(ROLL_RV_FINISH);
    expect(boutRv('you', 'pontos')).toBe(ROLL_RV_WIN);
    expect(boutRv('you', 'vantagens')).toBe(ROLL_RV_WIN);
    expect(boutRv('draw', 'empate')).toBe(ROLL_RV_DRAW);
    expect(boutRv('partner', 'pontos')).toBe(ROLL_RV_LOSS);
    expect(ROLL_RV_FINISH).toBeGreaterThan(ROLL_RV_WIN);
    expect(ROLL_RV_WIN).toBeGreaterThan(ROLL_RV_DRAW);
    expect(ROLL_RV_DRAW).toBeGreaterThan(ROLL_RV_LOSS);
  });

  it('bond with Bia has a daily cap that resets with the day', () => {
    let p = normalizeBjj();
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const b = boutBond('you', p, 'd1');
      p = b.next;
      total += b.gain;
    }
    expect(total).toBe(BOUT_BOND_DAILY_CAP);
    expect(boutBond('you', p, 'd1').gain).toBe(0);
    expect(boutBond('you', p, 'd2').gain).toBeGreaterThan(0);
    expect(boutBond('partner', normalizeBjj(), 'd1').gain).toBeLessThan(boutBond('you', normalizeBjj(), 'd1').gain);
  });
});
