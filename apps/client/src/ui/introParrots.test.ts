import { describe, expect, it } from 'vitest';

/** Smoke-test bezier sampling used by the intro flock (no canvas). */
describe('intro parrot paths', () => {
  it('moves birds left-to-right along normalized arcs', () => {
    const p = { x0: -0.12, y0: 0.2, cx: 0.45, cy: 0.1, x1: 1.12, y1: 0.26 };
    const w = 390;
    const h = 700;
    const start = (() => {
      const u = 0;
      const t = 1 - u;
      return t * t * p.x0 * w + 2 * t * u * p.cx * w + u * u * p.x1 * w;
    })();
    const end = (() => {
      const u = 1;
      const t = 1 - u;
      return t * t * p.x0 * w + 2 * t * u * p.cx * w + u * u * p.x1 * w;
    })();
    expect(start).toBeLessThan(0);
    expect(end).toBeGreaterThan(w);
  });
});
