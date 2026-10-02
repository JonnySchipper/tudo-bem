import { describe, expect, it } from 'vitest';
import { applyShear, castPreset, casterShear, rampAlpha, shadowLength, shadowLook, shadowRows, shadowStrength, shearTransform, sunAt, MAX_LENGTH, MIN_LENGTH } from './shadows';

describe('sun by time', () => {
  it('is down at night and up in the day', () => {
    expect(sunAt(2).u).toBeNull();
    expect(sunAt(23).u).toBeNull();
    expect(sunAt(12).u).not.toBeNull();
    expect(sunAt(12).elevation).toBeGreaterThan(55);
    expect(sunAt(3).elevation).toBe(0);
  });
  it('shadows fall west in the morning, south at noon, east in the afternoon', () => {
    expect(sunAt(7).bearing).toBeLessThan(-40);
    expect(Math.abs(sunAt(12.25).bearing)).toBeLessThan(4);
    expect(sunAt(17.5).bearing).toBeGreaterThan(40);
  });
  it('is symmetric around the middle of the day', () => {
    const noon = (5.9 + 18.6) / 2;
    expect(sunAt(noon - 3).elevation).toBeCloseTo(sunAt(noon + 3).elevation, 6);
    expect(sunAt(noon - 3).bearing).toBeCloseTo(-sunAt(noon + 3).bearing, 6);
  });
  it('wraps the hour', () => {
    expect(sunAt(36).elevation).toBeCloseTo(sunAt(12).elevation, 9);
    expect(sunAt(-12).elevation).toBeCloseTo(sunAt(12).elevation, 9);
  });
});

describe('shadow length', () => {
  it('is short at noon, long at 07:00 and 17:30, and never out of range', () => {
    const noon = shadowLook(12.25).length;
    const morning = shadowLook(7).length;
    const evening = shadowLook(17.5).length;
    expect(noon).toBeLessThan(0.4);
    expect(morning).toBeGreaterThan(0.9);
    expect(evening).toBeGreaterThan(0.9);
    for (let h = 0; h < 24; h += 0.1) {
      const l = shadowLook(h).length;
      expect(l).toBeGreaterThanOrEqual(MIN_LENGTH - 1e-9);
      expect(l).toBeLessThanOrEqual(MAX_LENGTH + 1e-9);
    }
  });
  it('grows monotonically as the sun drops', () => {
    let prev = 0;
    for (let e = 70; e > 0; e -= 2) {
      const l = shadowLength(e);
      expect(l).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = l;
    }
  });
});

describe('shadow direction and shear', () => {
  it('points left in the morning, right in the evening, always a little down', () => {
    const am = shadowLook(7);
    const pm = shadowLook(17.5);
    expect(am.lx).toBeLessThan(-0.4);
    expect(pm.lx).toBeGreaterThan(0.4);
    expect(am.ly).toBeGreaterThan(0.2);
    expect(pm.ly).toBeGreaterThan(0.2);
    expect(Math.abs(shadowLook(12.25).lx)).toBeLessThan(0.05);
    expect(shadowLook(12.25).ly).toBeGreaterThan(0.2);
  });
  it('lx, ly have the look length', () => {
    const s = shadowLook(9.5);
    expect(Math.hypot(s.lx, s.ly)).toBeCloseTo(s.length, 9);
  });
  it('the container/child decomposition reproduces the shear', () => {
    for (const [lx, ly] of [[0, 0.3], [-0.95, 0.64], [0.9, 0.5], [1.2, 0.45], [-0.2, 0.26]] as [number, number][]) {
      const t = shearTransform(lx, ly);
      for (const [u, v] of [[0, 0], [5, 0], [0, -10], [-7, -30], [12, -50]] as [number, number][]) {
        const [x, y] = applyShear(t, u, v);
        expect(x).toBeCloseTo(u - v * lx, 6);
        expect(y).toBeCloseTo(-v * ly, 6);
      }
    }
  });
  it('a point at height z lands z * (lx, ly) from its foot', () => {
    const s = shadowLook(8);
    const t = shearTransform(s.lx, s.ly);
    const [x, y] = applyShear(t, 0, -40);
    expect(x).toBeCloseTo(40 * s.lx, 6);
    expect(y).toBeCloseTo(40 * s.ly, 6);
  });
});

describe('weather and night', () => {
  it('no shadow at night', () => {
    for (const h of [0, 2, 4, 19.2, 22, 23.5]) expect(shadowLook(h, 1).alpha).toBe(0);
  });
  it('full under a clear sky, none under chuva, nearly none under nublado', () => {
    expect(shadowLook(12, 1).alpha).toBeGreaterThan(0.7); // modest at noon
    expect(shadowLook(12, 1).alpha).toBeLessThan(0.8);
    expect(shadowLook(12, 0).alpha).toBe(0);
    expect(shadowLook(12, 0.28).alpha).toBeLessThan(0.3);
    expect(shadowLook(12, 0.12).alpha).toBe(0);
    expect(shadowStrength(60, 0.28)).toBeLessThan(shadowStrength(60, 0.6));
  });
  it('is pale at the very beginning and end of the day', () => {
    expect(shadowLook(6.0, 1).alpha).toBeLessThan(0.3);
    expect(shadowLook(18.55, 1).alpha).toBeLessThan(0.3);
    expect(shadowLook(7.5, 1).alpha).toBeGreaterThan(0.9);
  });
  it('the tint is cooler and bluer at noon than it is red-heavy; it is a valid colour', () => {
    for (const h of [6.5, 9, 12, 15, 17.5]) {
      const t = shadowLook(h).tint;
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(0xffffff);
      expect(t & 255).toBeGreaterThan((t >> 16) & 255); // blue above red
    }
  });
});

describe('noon vs golden hour', () => {
  const sat = (t: number) => {
    const r = (t >> 16) & 255, g = (t >> 8) & 255, b = t & 255;
    return (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
  };
  it('11:00-13:00: short, neutral cool grey, modest opacity', () => {
    for (const h of [11, 11.5, 12, 12.5, 13]) {
      const l = shadowLook(h);
      expect(l.length).toBeLessThan(0.34);
      expect(sat(l.tint)).toBeLessThan(0.15);
      expect(l.alpha).toBeLessThan(0.8);
    }
  });
  it('golden hour and dawn stay long and violet', () => {
    for (const h of [6.6, 17.7]) {
      const l = shadowLook(h);
      expect(l.length).toBeGreaterThan(0.9);
      expect(sat(l.tint)).toBeGreaterThan(0.25);
      expect(l.alpha).toBeGreaterThan(0.8);
    }
  });
});

describe('what casts', () => {
  it('flat art does not cast, props and buildings do', () => {
    expect(castPreset('decals/crosswalk').cast).toBe(false);
    expect(castPreset('fx/shadow_16').cast).toBe(false);
    expect(castPreset('props/fios_4').cast).toBe(false);
    expect(castPreset('telhados/r1').cast).toBe(false);
    expect(castPreset('x/y', { decal: true }).cast).toBe(false);
    expect(castPreset('props/ipe_large').cast).toBe(true);
    expect(castPreset('facades/padaria').cast).toBe(true);
    expect(castPreset('props/some_new_prop_nobody_listed').cast).toBe(true);
  });
  it('buildings are capped, vehicles are short', () => {
    expect(castPreset('casas/sobrado_verde').capPx).toBeLessThan(castPreset('props/ipe_large').capPx);
    expect(castPreset('vehicles/car_red_r').hScale).toBeLessThan(1);
  });
  it('caps a tall shadow along its own direction', () => {
    const look = { lx: -0.95, ly: 0.64 };
    const tall = casterShear(look, { hScale: 1, capPx: 66 }, 104);
    expect(Math.hypot(tall.lx, tall.ly) * 104).toBeCloseTo(66, 6);
    expect(tall.lx / tall.ly).toBeCloseTo(look.lx / look.ly, 9);
    const small = casterShear(look, { hScale: 1, capPx: 66 }, 20);
    expect(small).toEqual(look);
    const low = casterShear(look, { hScale: 0.5, capPx: 66 }, 20);
    expect(low.lx).toBeCloseTo(look.lx / 2, 9);
  });
  it('keeps only the rows at or above the foot', () => {
    expect(shadowRows(22, 20)).toBe(20);
    expect(shadowRows(16, 16)).toBe(16);
    expect(shadowRows(10, 40)).toBe(10);
    expect(shadowRows(10, -3)).toBe(0);
  });
  it('is darkest at the foot and softens toward the tip', () => {
    expect(rampAlpha(0, 40)).toBe(1);
    expect(rampAlpha(40, 40)).toBeCloseTo(0.55, 9);
    expect(rampAlpha(20, 40)).toBeLessThan(1);
    expect(rampAlpha(20, 40)).toBeGreaterThan(0.55);
  });
});
