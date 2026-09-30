import { describe, expect, it } from 'vitest';
import { INTRO_PAN_MS, introPanAt } from './introPan';

describe('intro pan', () => {
  it('starts on Rua dos Ipês in front of the padaria', () => {
    const p = introPanAt(0);
    expect(p.x).toBeCloseTo(14.5 * 16, 5);
    expect(p.y).toBeCloseTo(9.5 * 16, 5);
  });

  it('stays inside the 56×40 map and loops', () => {
    for (let ms = 0; ms <= INTRO_PAN_MS; ms += 500) {
      const p = introPanAt(ms);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(56 * 16);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(40 * 16);
    }
    const a = introPanAt(0);
    const b = introPanAt(INTRO_PAN_MS);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.y).toBeCloseTo(a.y, 4);
  });

  it('reaches the fountain during the loop', () => {
    let best = Infinity;
    for (let ms = 0; ms < INTRO_PAN_MS; ms += 200) {
      const p = introPanAt(ms);
      best = Math.min(best, Math.hypot(p.x - 25.5 * 16, p.y - 22.5 * 16));
    }
    expect(best).toBeLessThan(8);
  });
});
