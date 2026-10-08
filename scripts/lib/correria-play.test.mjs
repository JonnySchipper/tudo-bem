import { describe, expect, it } from 'vitest';
import { POUR_HOLD, nextPourHold, pourTargetMs } from './correria-play.mjs';

const start = () => ({ hold: POUR_HOLD.start, spills: 0 });

describe('Correria tap-to-stop pour', () => {
  it('waits between the start tap and the stop tap where a late page timer and an on-time one both land', () => {
    // Server window is 70%–108%. Run 37232979457: a 0.74 wait landed at fill 1.09 (~0.35 late).
    // 0.70 + that lateness is 1.05, and 0.70 itself is still a legal cup. Not a pointer hold.
    const ms = pourTargetMs(1800, POUR_HOLD.start);
    expect(POUR_HOLD.start).toBe(0.7);
    expect(POUR_HOLD.start + 0.35).toBeLessThan(1.08);
    expect(ms).toBe(Math.round(1800 * 0.7));
    expect(pourTargetMs(1800, 0.5)).toBe(Math.round(1800 * POUR_HOLD.lo));
  });

  it('a landed cup does not move the hold', () => {
    const next = nextPourHold({ hold: 0.74, spills: 2 }, 'ok');
    expect(next).toEqual({ hold: 0.74, spills: 0 });
  });

  it('a measured spill drops toward the aim and stays a legal cup', () => {
    // 0.86 was above the cap; the same fill from the starting hold must not stay at 0.78,
    // which is what spilled again (0.78 + 0.32 = 1.10).
    const spilled = nextPourHold(start(), 'spill', 1.11);
    expect(spilled.hold).toBe(POUR_HOLD.lo);
    expect(spilled.hold).toBeGreaterThanOrEqual(0.7);
    expect(spilled.spills).toBe(1);
    expect(pourTargetMs(1800, spilled.hold)).toBeGreaterThanOrEqual(Math.round(1800 * 0.7));
  });

  it('one short then one spill cannot walk under 70% (the 0.57 thrash)', () => {
    let s = start();
    s = nextPourHold(s, 'short', 0.62);
    expect(s.hold).toBeLessThanOrEqual(POUR_HOLD.hi);
    expect(s.hold).toBeGreaterThan(POUR_HOLD.start);
    s = nextPourHold(s, 'spill', 1.11);
    expect(s.hold).toBeGreaterThanOrEqual(POUR_HOLD.lo);
    expect(s.hold).toBeLessThanOrEqual(POUR_HOLD.hi);
  });

  it('repeated spills stop at the floor', () => {
    let s = start();
    for (let i = 0; i < 8; i++) s = nextPourHold(s, 'spill');
    expect(s.hold).toBe(POUR_HOLD.lo);
    expect(s.spills).toBe(8);
  });

  it('shorts climb from the floor and stop at the cap', () => {
    let s = { hold: POUR_HOLD.lo, spills: 3 };
    for (let i = 0; i < 20; i++) s = nextPourHold(s, 'short');
    expect(s.hold).toBe(POUR_HOLD.hi);
    expect(s.spills).toBe(0);
  });

  it('a miss lengthens the same way a short does', () => {
    expect(nextPourHold(start(), 'miss').hold).toBe(nextPourHold(start(), 'short').hold);
  });
});
