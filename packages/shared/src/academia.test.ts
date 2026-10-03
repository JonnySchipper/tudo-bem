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
  it('a fresh profile is a white belt with no stripes', () => {
    expect(normalizeBjj()).toEqual({ belt: 'branca', stripes: 0, wins: 0 });
    expect(normalizeBjj(null)).toEqual({ belt: 'branca', stripes: 0, wins: 0 });
  });

  it('one win per stripe, four stripes on the white belt earn the blue belt', () => {
    expect(progressForWins(0)).toEqual({ belt: 'branca', stripes: 0 });
    expect(progressForWins(1)).toEqual({ belt: 'branca', stripes: 1 });
    expect(progressForWins(3)).toEqual({ belt: 'branca', stripes: 3 });
    expect(BLUE_BELT_WINS).toBe(4);
    expect(progressForWins(4)).toEqual({ belt: 'azul', stripes: 0 });
    expect(progressForWins(5)).toEqual({ belt: 'azul', stripes: 1 });
    expect(progressForWins(999)).toEqual({ belt: 'azul', stripes: 4 });
  });

  it('old saves (white belt, stripes only) and odd ones come back coherent', () => {
    // the old rule: stripes = floor(wins / 3), capped at 4, never a belt
    expect(normalizeBjj({ belt: 'branca', stripes: 4, wins: 4 })).toMatchObject({ belt: 'azul', stripes: 0, wins: 4 });
    expect(normalizeBjj({ belt: 'branca', stripes: 2, wins: 2 })).toEqual({ belt: 'branca', stripes: 2, wins: 2 });
    // four stripes with no matching wins still read as a blue belt
    expect(normalizeBjj({ stripes: 4, wins: 0 })).toMatchObject({ belt: 'azul', stripes: 0 });
    expect(normalizeBjj({ stripes: -3, wins: -9 } as never)).toEqual({ belt: 'branca', stripes: 0, wins: 0 });
    expect(normalizeBjj({ stripes: 'x', wins: 'y', belt: 'preta' } as never)).toEqual({ belt: 'branca', stripes: 0, wins: 0 });
    // a stored blue belt is kept
    expect(normalizeBjj({ belt: 'azul', stripes: 2, wins: 18 })).toMatchObject({ belt: 'azul', stripes: 4, wins: 18 });
  });

  it('recording a win reports stripe and belt changes', () => {
    let p = normalizeBjj();
    const seen: string[] = [];
    for (let i = 0; i < 16; i++) {
      const w = recordWin(p);
      p = w.progress;
      if (w.stripeUp) seen.push(`stripe@${p.wins}`);
      if (w.beltUp) seen.push(`belt@${p.wins}`);
    }
    expect(seen).toEqual(['stripe@1', 'stripe@2', 'stripe@3', 'belt@4', 'stripe@5', 'stripe@6', 'stripe@7', 'stripe@8']);
    expect(p).toMatchObject({ belt: 'azul', stripes: 4, wins: 16 });
  });

  it('the level (timers, partner unlocks) follows belt and stripes: 0 to 8', () => {
    expect(bjjLevel()).toBe(0);
    expect(bjjLevel({ belt: 'branca', stripes: 3, wins: 3 })).toBe(3);
    expect(bjjLevel({ belt: 'azul', stripes: 0, wins: 4 })).toBe(4);
    expect(bjjLevel({ belt: 'azul', stripes: 4, wins: 40 })).toBe(8);
  });

  it('a belt is only ever earned: there is no way to buy one (no price, no shop field)', () => {
    const p = normalizeBjj({ belt: 'azul', stripes: 0, wins: 0 } as never);
    // wins decide; nothing in the profile carries a price
    expect(Object.keys(p).sort()).toEqual(['belt', 'stripes', 'wins']);
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
    expect(open(3)).toEqual(['mateus', 'felipe', 'helena', 'daniel']);
    expect(open(9)).toHaveLength(5);
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
