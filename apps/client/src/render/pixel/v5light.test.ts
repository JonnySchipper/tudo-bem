import { describe, expect, it } from 'vitest';
import { aoForOverhead, aoForSprite, aoForTerrain } from './ao';
import { buildRim } from './silhouette';
import { rimLook, shadowLook } from './shadows';
import { causticAt, isWaterPixel, sparklePixels, waterMask } from './waterMath';
import { GENERIC_PRESET, LIGHT_PRESETS, presetFor, stringLights } from './lightPresets';
import { sunScreenX } from './dayNight';
import { sunGlow } from './lighting';

describe('ao plan', () => {
  const def = { w: 80, h: 106, ax: 40, ay: 104, footprint: [5, 1] as [number, number] };
  it('a building gets a band along its whole base', () => {
    const s = aoForSprite('buildings/shop_padaria', def, 100, 50);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].kind).toBe('rect');
    expect(s[0].w).toBeGreaterThan(70);
  });
  it('a prop gets a foot ellipse, flat art and vehicles get none', () => {
    const e = aoForSprite('props/bench_small', { w: 26, h: 22, ax: 13, ay: 20, footprint: [2, 1] }, 40, 40);
    expect(e[0].kind).toBe('ellipse');
    expect(aoForSprite('decals/crosswalk', def, 0, 0)).toEqual([]);
    expect(aoForSprite('vehicles/car_red_r', def, 0, 0)).toEqual([]);
  });
  it('a canopy shades an ellipse under it, a tarp the stall footprint', () => {
    const c = aoForOverhead('props/ipe_large_canopy', { w: 44, h: 31, ax: 22, ay: 51 }, 100, 100, [2, 2]);
    expect(c[0].kind).toBe('ellipse');
    expect(c[0].w).toBeCloseTo(22);
    const t = aoForOverhead('feira/frutas_tarp', { w: 56, h: 24, ax: 28, ay: 58 }, 100, 100, [3, 2]);
    expect(t[0].kind).toBe('rect');
  });
  it('terrain strips sit on the lower surface beside paving', () => {
    const floor = ['gc', 'gc'];
    const s = aoForTerrain(floor);
    expect(s.length).toBe(2);
    for (const q of s) {
      expect(q.side).toBe('e');
      expect(q.x1).toBeLessThanOrEqual(16);
    }
    expect(aoForTerrain(['gg', 'gg'])).toEqual([]);
  });
});

describe('rim mask', () => {
  const img = (rows: string[]) => {
    const h = rows.length, w = rows[0].length;
    const data = new Uint8ClampedArray(w * h * 4);
    rows.forEach((r, y) => [...r].forEach((c, x) => (data[(y * w + x) * 4 + 3] = c === '#' ? 255 : 0)));
    return { w, h, data };
  };
  const a = (m: { w: number; data: Uint8ClampedArray | Uint8Array }, x: number, y: number) => m.data[(y * m.w + x) * 4 + 3];
  it('lights the edge facing the sun only', () => {
    const src = img(['.....', '.###.', '.###.', '.###.', '.###.', '.###.', '.....']);
    const l = buildRim(src, 'l');
    const r = buildRim(src, 'r');
    expect(a(l, 1, 4)).toBe(255);
    expect(a(l, 3, 4)).toBe(0);
    expect(a(r, 3, 4)).toBe(255);
    expect(a(r, 1, 4)).toBe(0);
    expect(a(l, 2, 1)).toBeGreaterThan(100); // the top edge catches light from either side
  });
  it('is strong at a low sun, gone at noon and under chuva, and flips side by time', () => {
    expect(rimLook(shadowLook(17.5, 1)).alpha).toBeGreaterThan(0.5);
    expect(rimLook(shadowLook(12.25, 1)).alpha).toBeLessThan(0.02);
    expect(rimLook(shadowLook(17.5, 0)).alpha).toBe(0);
    expect(rimLook(shadowLook(17.5, 1)).side).toBe('l');
    expect(rimLook(shadowLook(7, 1)).side).toBe('r');
  });
});

describe('water', () => {
  it('finds blue/teal pixels only', () => {
    expect(isWaterPixel(40, 160, 200, 255)).toBe(true);
    expect(isWaterPixel(180, 150, 120, 255)).toBe(false);
    expect(isWaterPixel(40, 160, 200, 0)).toBe(false);
  });
  it('caustics are 0..1, change by frame, and have bright and dark spots', () => {
    let lit = 0, dark = 0, diff = 0;
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) {
        const v = causticAt(x, y, 0);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        if (v > 0.5) lit++;
        if (v === 0) dark++;
        if (Math.abs(v - causticAt(x, y, 2)) > 0.1) diff++;
      }
    expect(lit).toBeGreaterThan(10);
    expect(dark).toBeGreaterThan(50);
    expect(diff).toBeGreaterThan(20);
  });
  it('sparkles are deterministic water pixels', () => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) data.set([40, 160, 210, 255], i * 4);
    const m = waterMask(data, 8, 8);
    expect(m.px.length).toBe(64);
    expect(sparklePixels(m, 5, 3)).toEqual(sparklePixels(m, 5, 3));
    expect(sparklePixels({ w: 1, h: 1, px: [] }, 5, 1)).toEqual([]);
  });
});

describe('light presets and sun glow', () => {
  it('the fountain has teal underwater lights and water; the flag gives the generic pool', () => {
    expect(LIGHT_PRESETS['props/fountain'].water).toBe(true);
    expect(presetFor('props/fountain', false)).toBe(LIGHT_PRESETS['props/fountain']);
    expect(presetFor('props/new_thing', true)).toBe(GENERIC_PRESET);
    expect(presetFor('props/new_thing', false)).toBeNull();
    expect(presetFor(null, undefined)).toBeNull();
  });
  it('string lights span the width and sag in the middle', () => {
    const s = stringLights(64, -40, 7);
    expect(s).toHaveLength(7);
    expect(s[0].x).toBe(-32);
    expect(s[6].x).toBe(32);
    expect(s[3].y).toBeGreaterThan(s[0].y);
  });
  it('the sun glow sits on the side of the sun and has a dawn peak', () => {
    expect(sunScreenX(shadowLook(17.5).bearing)).toBeLessThan(0.3);
    expect(sunScreenX(shadowLook(7).bearing)).toBeGreaterThan(0.7);
    expect(sunGlow(6.75)).toBeGreaterThan(0.6);
    expect(sunGlow(12)).toBe(0);
  });
});
