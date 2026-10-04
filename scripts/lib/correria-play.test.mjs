import { describe, expect, it } from 'vitest';
import { POUR_HOLD, nextPourHold, pourTargetMs } from './correria-play.mjs';

const start = () => ({ hold: POUR_HOLD.start, spills: 0 });

describe('Correria pour hold', () => {
  it('starts inside the server window (70%–108%), not at the old 0.50 head start', () => {
    const ms = pourTargetMs(1800, POUR_HOLD.start);
    expect(ms).toBeGreaterThanOrEqual(Math.round(1800 * 0.7));
    expect(ms).toBeLessThanOrEqual(Math.round(1800 * 1.08));
    expect(pourTargetMs(1800, 0.5)).toBe(Math.round(1800 * POUR_HOLD.lo));
  });

  it('a landed cup does not move the hold', () => {
    const next = nextPourHold({ hold: 0.86, spills: 2 }, 'ok');
    expect(next).toEqual({ hold: 0.86, spills: 0 });
  });

  it('one short then one spill stays inside the window (the 0.57 thrash)', () => {
    // Post-merge main (run 37225531207) logged short → 0.75, spill → 0.57. 0.57 is under 70%.
    let s = start();
    s = nextPourHold(s, 'short');
    expect(s.hold).toBe(0.91);
    s = nextPourHold(s, 'spill');
    expect(s.hold).toBeGreaterThanOrEqual(POUR_HOLD.safe);
    expect(s.hold).toBeLessThanOrEqual(POUR_HOLD.hi);
    expect(pourTargetMs(1800, s.hold)).toBeGreaterThanOrEqual(Math.round(1800 * 0.7));
  });

  it('the first spill cannot leave the zero-lag window', () => {
    const s = nextPourHold(start(), 'spill');
    expect(s.hold).toBe(0.81);
    expect(s.spills).toBe(1);
    expect(s.hold).toBeGreaterThanOrEqual(POUR_HOLD.safe);
  });

  it('a late runner may step down only after a second spill, and not past the floor', () => {
    let s = start();
    const seen = [];
    for (let i = 0; i < 8; i++) {
      s = nextPourHold(s, 'spill');
      seen.push(s.hold);
    }
    expect(seen[0]).toBeGreaterThanOrEqual(POUR_HOLD.safe);
    expect(s.hold).toBe(POUR_HOLD.lo);
    expect(Math.min(...seen)).toBe(POUR_HOLD.lo);
  });

  it('shorts climb back from the floor and stop at the cap', () => {
    let s = { hold: POUR_HOLD.lo, spills: 3 };
    for (let i = 0; i < 20; i++) s = nextPourHold(s, 'short');
    expect(s.hold).toBe(POUR_HOLD.hi);
    expect(s.spills).toBe(0);
  });

  it('a miss lengthens the same way a short does', () => {
    expect(nextPourHold(start(), 'miss').hold).toBe(nextPourHold(start(), 'short').hold);
  });
});
