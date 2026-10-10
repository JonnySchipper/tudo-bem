import { describe, expect, it } from 'vitest';
import { edgeMark } from './glintCompass';

const view = { w: 1000, h: 600 };
const ins = { top: 60, bottom: 100, left: 0, right: 0 };

describe('the arrow to a star off screen', () => {
  it('is not drawn while the star is on screen', () => {
    expect(edgeMark({ x: 500, y: 300 }, view, ins)).toBeNull();
    expect(edgeMark({ x: 990, y: 70 }, view, ins)).toBeNull();
  });

  it('sits on the edge toward the star, below the HUD and above the chat', () => {
    const right = edgeMark({ x: 1600, y: 280 }, view, ins)!;
    expect(right.x).toBeCloseTo(1000 - 26);
    expect(right.angle).toBeCloseTo(0, 1);
    const up = edgeMark({ x: 500, y: -400 }, view, ins)!;
    expect(up.y).toBeCloseTo(60 + 26);
    expect(up.x).toBeCloseTo(500);
    const down = edgeMark({ x: 500, y: 2000 }, view, ins)!;
    expect(down.y).toBeCloseTo(600 - 100 - 26);
  });

  it('stays inside the play area for a far corner', () => {
    const m = edgeMark({ x: -3000, y: 3000 }, view, ins)!;
    expect(m.x).toBeGreaterThanOrEqual(26 - 1e-9);
    expect(m.y).toBeLessThanOrEqual(600 - 100 - 26 + 1e-9);
  });
});
