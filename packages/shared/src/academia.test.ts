import { describe, expect, it } from 'vitest';
import {
  BOUT_BOND_DAILY_CAP,
  BLUE_BELT_WINS,
  BELT_LADDER,
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
  winsToBelt,
  nextStripe,
} from './index.js';

describe('belts, stripes and the profile', () => {
  it('a fresh profile is a white belt with one move on each gag track, and no stripes', () => {
    const starters = ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'];
    expect(normalizeBjj()).toEqual({ belt: 'branca', stripes: 0, wins: 0, unlocked: starters, lossStreak: 0 });
    expect(normalizeBjj(null)).toEqual({ belt: 'branca', stripes: 0, wins: 0, unlocked: starters, lossStreak: 0 });
    // the loss streak is kept, defaults to 0 and is never negative or fractional
    expect(normalizeBjj({ wins: 3, lossStreak: 2 }).lossStreak).toBe(2);
    expect(normalizeBjj({ wins: 3, lossStreak: -4 }).lossStreak).toBe(0);
    expect(normalizeBjj({ wins: 3, lossStreak: 2.7 }).lossStreak).toBe(2);
    expect(normalizeBjj({ wins: 3, lossStreak: 'x' as never }).lossStreak).toBe(0);
    expect(normalizeBjj({ belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie'] }).unlocked).toEqual(starters);
  });

  it('wins, not a single win, move stripes and then the next belt', () => {
    expect(BELT_LADDER.map((b) => b.per)).toEqual([5, 10, 20, 40, 80]);
    expect(progressForWins(0)).toEqual({ belt: 'branca', stripes: 0 });
    expect(progressForWins(4)).toEqual({ belt: 'branca', stripes: 0 });
    expect(progressForWins(5)).toEqual({ belt: 'branca', stripes: 1 });
    expect(progressForWins(15)).toEqual({ belt: 'branca', stripes: 3 });
    expect(BLUE_BELT_WINS).toBe(20);
    expect(winsToBelt('azul')).toBe(20);
    expect(winsToBelt('roxa')).toBe(60);
    expect(winsToBelt('marrom')).toBe(140);
    expect(winsToBelt('preta')).toBe(300);
    expect(progressForWins(20)).toEqual({ belt: 'azul', stripes: 0 });
    expect(progressForWins(30)).toEqual({ belt: 'azul', stripes: 1 });
    expect(progressForWins(60)).toEqual({ belt: 'roxa', stripes: 0 });
    expect(progressForWins(139)).toEqual({ belt: 'roxa', stripes: 3 });
    expect(progressForWins(140)).toEqual({ belt: 'marrom', stripes: 0 });
    expect(progressForWins(299)).toEqual({ belt: 'marrom', stripes: 3 });
    expect(progressForWins(300)).toEqual({ belt: 'preta', stripes: 0 });
    expect(progressForWins(300 + 80)).toEqual({ belt: 'preta', stripes: 1 });
    expect(progressForWins(300 + 320)).toEqual({ belt: 'preta', stripes: 4 });
    expect(progressForWins(9999).belt).toBe('preta');
  });

  it('old saves follow the win count, and odd ones come back coherent', () => {
    expect(normalizeBjj({ belt: 'branca', stripes: 4, wins: 4 })).toMatchObject({ belt: 'branca', stripes: 0, wins: 4 });
    expect(normalizeBjj({ belt: 'branca', stripes: 2, wins: 2 })).toMatchObject({ belt: 'branca', stripes: 0, wins: 2 });
    expect(normalizeBjj({ stripes: 4, wins: 0 })).toMatchObject({ belt: 'branca', stripes: 0, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'] });
    expect(normalizeBjj({ stripes: -3, wins: -9 } as never)).toMatchObject({ belt: 'branca', stripes: 0, wins: 0 });
    expect(normalizeBjj({ stripes: 'x', wins: 'y', belt: 'preta' } as never)).toMatchObject({ belt: 'branca', stripes: 0, wins: 0 });
    // 18 wins is still white, three stripes (blue is 20)
    expect(normalizeBjj({ belt: 'azul', stripes: 2, wins: 18 })).toMatchObject({ belt: 'branca', stripes: 3, wins: 18 });
  });

  it('a save from the old ladder wears whatever these wins are now', () => {
    // 15 wins was blue when white took 15. It is three white stripes on this ladder.
    expect(normalizeBjj({ belt: 'azul', stripes: 0, wins: 15 })).toMatchObject({ belt: 'branca', stripes: 3, wins: 15 });
    // 105 wins was brown. Purple starts at 60 and a stripe is 20, so this is purple with two stripes.
    expect(normalizeBjj({ belt: 'marrom', stripes: 0, wins: 105 })).toMatchObject({ belt: 'roxa', stripes: 2, wins: 105 });
    // 225 wins was black. Brown starts at 140 and a stripe is 40, so this is brown with two stripes.
    expect(normalizeBjj({ belt: 'preta', stripes: 0, wins: 225 })).toMatchObject({ belt: 'marrom', stripes: 2, wins: 225 });
  });

  it('the move at four stripes arrives with the next belt', () => {
    const before = normalizeBjj({ wins: 19, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'armbar', 'sleeve_grip', 'body_lock'] });
    expect(before.unlocked).not.toContain('sprawl');
    const promoted = recordWin(before);
    expect(promoted.beltUp).toBe(true);
    expect(promoted.move).toBe('scissor_sweep');
    expect(promoted.progress.unlocked).toContain('sprawl');
    expect(promoted.progress.pendingDrill).toBe('scissor_sweep');
    const purple = normalizeBjj({ wins: 60, unlocked: ['collar_tie'] });
    expect(purple.belt).toBe('roxa');
    expect(purple.unlocked).toEqual(expect.arrayContaining(['sprawl', 'americana']));
  });

  it('a save that already passed a new stripe keeps that move, and one sitting on it still drills', () => {
    const passed = normalizeBjj({
      wins: 15,
      unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'body_lock', 'sprawl'],
    });
    expect(passed.unlocked).toContain('knee_on_belly');
    expect(passed.pendingDrill).toBeUndefined();
    const sitting = normalizeBjj({
      wins: 10,
      unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip'],
    });
    expect(sitting).toMatchObject({ belt: 'branca', stripes: 2 });
    expect(sitting.unlocked).not.toContain('knee_on_belly');
    expect(sitting.pendingDrill).toBe('knee_on_belly');
  });

  it('recording a win reports stripe and belt changes', () => {
    let p = normalizeBjj();
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const w = recordWin(p);
      p = w.progress;
      if (w.stripeUp) seen.push(`stripe@${p.wins}`);
      if (w.beltUp) seen.push(`belt@${p.wins}`);
    }
    expect(seen).toEqual(['stripe@5', 'stripe@10', 'stripe@15', 'belt@20']);
    expect(p).toMatchObject({ belt: 'azul', stripes: 0, wins: 20 });
  });

  it('the level follows belt and stripes', () => {
    expect(bjjLevel()).toBe(0);
    expect(bjjLevel({ belt: 'branca', stripes: 3, wins: 15 })).toBe(3);
    expect(bjjLevel({ belt: 'azul', stripes: 0, wins: 20 })).toBe(4);
    expect(bjjLevel({ belt: 'roxa', stripes: 0, wins: 60 })).toBe(8);
  });

  it('a belt is only ever earned: there is no way to buy one (no price, no shop field)', () => {
    const p = normalizeBjj({ belt: 'azul', stripes: 0, wins: 0 } as never);
    // lossStreak is the comfort windows' count (losses in a row), not a purchase
    expect(Object.keys(p).sort()).toEqual(['belt', 'lossStreak', 'stripes', 'unlocked', 'wins']);
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
    expect(open(4)).toEqual(['mateus']);
    expect(open(5)).toEqual(['mateus', 'felipe']);
    expect(open(15)).toEqual(['mateus', 'felipe', 'helena', 'daniel']);
    expect(open(20)).toHaveLength(5);
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

describe('nextStripe', () => {
  it('counts wins into the stripe and wins to go along the ladder', () => {
    expect(nextStripe(0)).toEqual({ into: 0, per: 5, left: 5 });
    expect(nextStripe(3)).toEqual({ into: 3, per: 5, left: 2 });
    // blue starts at 20 wins and pays every 10
    expect(nextStripe(20)).toEqual({ into: 0, per: 10, left: 10 });
    expect(nextStripe(305)).toEqual({ into: 5, per: 80, left: 75 });
  });
});
