import { describe, expect, it } from 'vitest';
import { FEIRA_CROWD_STEP, FEIRA_END_STAMP, feiraCrowd, feiraEndTier, feiraMeterWindow } from './feiraStall.js';
import { PASTEL_FRY, PASTEL_FRY_COMBO, pastelDoneness } from './feiraPastel.js';
import { TAPIOCA_COOK, tapiocaFlip } from './feiraTapioca.js';

describe('feira stall meters', () => {
  it('puts the tapioca sweet spot exactly where a flip is perfect', () => {
    const { cookMs, earlyMs, lateMs } = TAPIOCA_COOK;
    const span = cookMs + lateMs + 800;
    const w = feiraMeterWindow(cookMs - earlyMs, cookMs + lateMs, span);
    expect(w.from).toBeGreaterThan(0);
    expect(w.to).toBeLessThan(1);
    const at = (f: number) => Math.round(f * span);
    expect(tapiocaFlip(at(w.from) - 1)).toBe('early');
    expect(tapiocaFlip(at(w.from))).toBe('perfect');
    expect(tapiocaFlip(at(w.to))).toBe('perfect');
    expect(tapiocaFlip(at(w.to) + 1)).toBe('late');
  });

  it('puts the pastel golden window on the fry bar, for simple and combo fillings', () => {
    for (const [fry, combo] of [[PASTEL_FRY, false], [PASTEL_FRY_COMBO, true]] as const) {
      const w = feiraMeterWindow(fry.goldenAt, fry.darkAt, fry.fireAt);
      const at = (f: number) => Math.round(f * fry.fireAt);
      expect(pastelDoneness(at(w.from), combo)).toBe('golden');
      expect(pastelDoneness(at(w.to) - 1, combo)).toBe('golden');
      expect(pastelDoneness(at(w.to), combo)).toBe('dark');
    }
  });

  it('clamps a window and never inverts it', () => {
    expect(feiraMeterWindow(-50, 2000, 1000)).toEqual({ from: 0, to: 1 });
    expect(feiraMeterWindow(800, 200, 1000)).toEqual({ from: 0.8, to: 0.8 });
    expect(feiraMeterWindow(1, 2, 0)).toEqual({ from: 0, to: 0 });
  });

  it('starts the freguesia meter in the middle and moves it one step per customer', () => {
    expect(feiraCrowd(0, 0)).toBe(0.5);
    expect(feiraCrowd(1, 0)).toBeCloseTo(0.5 + FEIRA_CROWD_STEP);
    expect(feiraCrowd(0, 1)).toBeCloseTo(0.5 - FEIRA_CROWD_STEP);
    expect(feiraCrowd(3, 3)).toBe(0.5);
    expect(feiraCrowd(40, 0)).toBe(1);
    expect(feiraCrowd(0, 40)).toBe(0);
  });
});

describe('feira end card', () => {
  it('reads as ground gained or lost from served vs. left', () => {
    expect(feiraEndTier({ served: 9, left: 1 })).toBe('lotada');
    expect(feiraEndTier({ served: 9, left: 3 })).toBe('ganhou');
    expect(feiraEndTier({ served: 4, left: 2 })).toBe('ganhou');
    expect(feiraEndTier({ served: 2, left: 2 })).toBe('empate');
    expect(feiraEndTier({ served: 0, left: 0 })).toBe('empate');
    expect(feiraEndTier({ served: 1, left: 4 })).toBe('perdeu');
  });

  it('has a Portuguese stamp with an English gloss for every tier, and never mentions money', () => {
    for (const s of Object.values(FEIRA_END_STAMP)) {
      for (const b of [s.stamp, s.line]) {
        expect(b.pt.length).toBeGreaterThan(3);
        expect(b.en.length).toBeGreaterThan(3);
        expect(`${b.pt} ${b.en}`).not.toMatch(/R\$|RV|reais|\$/);
      }
    }
  });
});
