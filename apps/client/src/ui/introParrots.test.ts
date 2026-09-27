import { describe, expect, it } from 'vitest';
import { ARARA_SCHEMES, PAPAGAIO_SCHEMES, spawnCinematicFlock, type FlockBird } from './introParrots';

describe('intro parrot flock locks', () => {
  it('spawns 6–12 mixed-species birds in one pass', () => {
    const birds: FlockBird[] = [];
    spawnCinematicFlock(birds, 10);
    expect(birds.length).toBeGreaterThanOrEqual(6);
    expect(birds.length).toBeLessThanOrEqual(12);
    const species = new Set(birds.map((b) => b.species));
    expect(species.has('arara')).toBe(true);
    expect(species.has('papagaio')).toBe(true);
    const layers = new Set(birds.map((b) => b.layer));
    expect(layers.size).toBeGreaterThanOrEqual(2);
  });

  it('uses SP palette without neon cyan/magenta accents', () => {
    const hex = [...ARARA_SCHEMES, ...PAPAGAIO_SCHEMES].flatMap((s) =>
      [s.body, s.wing, s.tail, s.beak, s.cheek].filter((c): c is string => Boolean(c)),
    );
    const banned = ['00ffff', 'ff00ff', '7a4fb0', '00ff', 'ff00ff'];
    for (const h of hex) {
      expect(banned.some((b) => h.toLowerCase().replace('#', '').includes(b))).toBe(false);
    }
  });

  it('keeps sky paths in upper band (above card zone)', () => {
    const path = { x0: -0.14, y0: 0.1, cx: 0.48, cy: 0.05, x1: 1.14, y1: 0.16 };
    for (const t of [0, 0.5, 1]) {
      const u = 1 - t;
      const y = u * u * path.y0 + 2 * u * t * path.cy + t * t * path.y1;
      expect(y).toBeLessThan(0.35);
    }
  });
});
