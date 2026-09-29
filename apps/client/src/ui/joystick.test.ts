import { describe, expect, it } from 'vitest';
import { joystickStep } from './joystick';

// joystick.ts imports the DOM helpers lazily inside functions only; the pure step math needs no document.
describe('joystickStep', () => {
  it('iso: screen right walks +x/-y, screen up walks -x/-y (unchanged)', () => {
    const r = joystickStep(1, 0, 'iso');
    expect(r.vx).toBeGreaterThan(0);
    expect(r.vy).toBeLessThan(0);
    const u = joystickStep(0, -1, 'iso');
    expect(u.vx).toBeLessThan(0);
    expect(u.vy).toBeLessThan(0);
  });

  it('topdown: screen right is +x, down is +y, left is -x, up is -y', () => {
    expect(joystickStep(1, 0, 'topdown')).toEqual({ vx: 3, vy: 0 });
    expect(joystickStep(0, 1, 'topdown')).toEqual({ vx: 0, vy: 3 });
    expect(joystickStep(-1, 0, 'topdown')).toEqual({ vx: -3, vy: 0 });
    expect(joystickStep(0, -1, 'topdown')).toEqual({ vx: 0, vy: -3 });
  });

  it('topdown diagonals walk diagonally, and a push is never a zero step', () => {
    const d = joystickStep(0.7, 0.7, 'topdown');
    expect(d.vx).toBeGreaterThan(0);
    expect(d.vy).toBeGreaterThan(0);
    const tiny = joystickStep(0.01, 0, 'topdown');
    expect(Math.abs(tiny.vx) + Math.abs(tiny.vy)).toBeGreaterThan(0);
  });
});
