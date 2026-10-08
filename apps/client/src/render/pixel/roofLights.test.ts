import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { roofLights } from './roofLights';
import { lightState } from './dayNight';
import { T } from './coords';

const aero = ROOMS.aeroporto;
const M = (h: number, m = 0) => h * 60 + m;

describe('roof lights (the airport terminal at night, issue #168)', () => {
  const lights = roofLights(aero);

  it('hangs a small grid of panels over the hall floor, under the roof and inside the map', () => {
    expect(lights.length).toBeGreaterThanOrEqual(6);
    // cheap on phones: a couple of street blocks' worth of lamps, no more
    expect(lights.length).toBeLessThanOrEqual(18);
    const roof = aero.roof!;
    for (const l of lights) {
      expect(l.y).toBeGreaterThan((roof.y0 + 1) * T);
      expect(l.y).toBeLessThan(roof.y1 * T);
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(aero.cols * T);
    }
  });

  it('is off at noon, on at 21:00, and comes on over dusk bank by bank', () => {
    expect(lights.every((l) => lightState(M(12), l.delay) === 0)).toBe(true);
    expect(lights.every((l) => lightState(M(21), l.delay) === 1)).toBe(true);
    // a few minutes after 18:00 the front bank is up and the back one is still dark
    const at = M(18, 6);
    const ys = [...new Set(lights.map((l) => l.y))].sort((a, b) => a - b);
    const bank = (y: number) => lights.filter((l) => l.y === y).map((l) => lightState(at, l.delay));
    expect(Math.min(...bank(ys[0]))).toBeGreaterThan(0.5);
    expect(Math.max(...bank(ys[ys.length - 1]))).toBe(0);
  });

  it('only the roofed map gets panels', () => {
    expect(roofLights(ROOMS.praca)).toEqual([]);
    expect(roofLights({ cols: 10 })).toEqual([]);
  });
});
