import { describe, expect, it } from 'vitest';
import { CLOTH_COLORS, HAIR_COLORS, SHOE_COLORS, SKIN_TONES } from '@tudobem/shared';
import { KEY_RAMPS, buildRamp, hexToRgb, keyMapForShades, luma, mergeTables, pack, rampMap, rgbToHex, swapKeys } from './palette';

const lumaOf = (hex: string) => luma(...hexToRgb(hex));

describe('buildRamp', () => {
  const bases = [...SKIN_TONES, ...HAIR_COLORS, ...CLOTH_COLORS, ...SHOE_COLORS, '#000000', '#ffffff', '#808080'];

  it('has strictly increasing luminance for every catalog color (4-ramp)', () => {
    for (const base of bases) {
      const ramp = buildRamp(base, 4);
      expect(ramp).toHaveLength(4);
      for (let i = 1; i < ramp.length; i++) expect(lumaOf(ramp[i])).toBeGreaterThan(lumaOf(ramp[i - 1]));
    }
  });

  it('has strictly increasing luminance for the 3-ramp (shoes)', () => {
    for (const base of bases) {
      const ramp = buildRamp(base, 3);
      expect(ramp).toHaveLength(3);
      for (let i = 1; i < ramp.length; i++) expect(lumaOf(ramp[i])).toBeGreaterThan(lumaOf(ramp[i - 1]));
    }
  });

  it('keeps the base color at rank 2 of the 4-ramp (within rounding)', () => {
    const [r, g, b] = hexToRgb(buildRamp('#c68a5f')[2]);
    const [br, bg, bb] = hexToRgb('#c68a5f');
    expect(Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)).toBeLessThanOrEqual(6);
  });

  it('shifts shadows toward purple/cool and highlights toward yellow/warm (hue)', () => {
    // A red-orange base: the shadow hue goes lower than red (toward magenta), the highlight goes higher (toward yellow).
    const hue = (hex: string) => {
      const [r, g, b] = hexToRgb(hex);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
      return h < 0 ? h + 360 : h;
    };
    const ramp = buildRamp('#c9582c');
    const hs = ramp.map(hue);
    // wrap-safe compare around red/orange
    const norm = (h: number) => (h > 180 ? h - 360 : h);
    expect(norm(hs[0])).toBeLessThan(norm(hs[2]));
    expect(norm(hs[3])).toBeGreaterThan(norm(hs[2]));
  });
});

describe('swapKeys', () => {
  it('replaces exact key colors on a tiny 2x2 image and leaves the rest alone', () => {
    const [k0, k1] = KEY_RAMPS.hair;
    const px = (hex: string, a = 255) => [...hexToRgb(hex), a];
    // (0,0)=key0  (1,0)=key1  (0,1)=non-key opaque  (1,1)=key0 but fully transparent
    const data = new Uint8ClampedArray([...px(k0), ...px(k1), ...px('#123456'), ...px(k0, 0)]);
    const target = ['#111111', '#222222', '#333333', '#444444'];
    const n = swapKeys(data, rampMap(KEY_RAMPS.hair, target));
    expect(n).toBe(2);
    expect(rgbToHex(data[0], data[1], data[2])).toBe('#111111');
    expect(rgbToHex(data[4], data[5], data[6])).toBe('#222222');
    expect(rgbToHex(data[8], data[9], data[10])).toBe('#123456');
    expect(rgbToHex(data[12], data[13], data[14])).toBe(k0); // transparent pixel untouched
    expect([data[3], data[7], data[11], data[15]]).toEqual([255, 255, 255, 0]); // alpha untouched
  });

  it('replaces by rank: darkest key -> darkest target', () => {
    const ramp = buildRamp('#9a5f30');
    const data = new Uint8ClampedArray(KEY_RAMPS.hair.flatMap((k) => [...hexToRgb(k), 255]));
    swapKeys(data, rampMap(KEY_RAMPS.hair, ramp));
    const out = [0, 1, 2, 3].map((i) => rgbToHex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
    expect(out).toEqual(ramp);
  });

  it('rejects mismatched ramp lengths', () => {
    expect(() => rampMap(KEY_RAMPS.hair, ['#000000'])).toThrow();
  });

  it('merges tables so several groups swap in one pass', () => {
    const merged = mergeTables(rampMap(KEY_RAMPS.hair, buildRamp('#3a241a')), rampMap(KEY_RAMPS.top, buildRamp('#c9582c')));
    expect(merged.size).toBe(8);
    expect(merged.has(pack(...hexToRgb(KEY_RAMPS.hair[0])))).toBe(true);
    expect(merged.has(pack(...hexToRgb(KEY_RAMPS.top[3])))).toBe(true);
  });
});

describe('keyMapForShades', () => {
  it('maps 3 shades to key ranks 1..3 by luminance regardless of input order', () => {
    const m = keyMapForShades(['#cc9659', '#ab6736', '#b37b3f'], 'hair');
    const to = (hex: string) => m.get(pack(...hexToRgb(hex)));
    expect(to('#ab6736')).toBe(pack(...hexToRgb(KEY_RAMPS.hair[1])));
    expect(to('#b37b3f')).toBe(pack(...hexToRgb(KEY_RAMPS.hair[2])));
    expect(to('#cc9659')).toBe(pack(...hexToRgb(KEY_RAMPS.hair[3])));
  });

  it('maps 2 shades to base + highlight', () => {
    const m = keyMapForShades(['#f5aa14', '#ed931e'], 'top');
    expect(m.get(pack(...hexToRgb('#ed931e')))).toBe(pack(...hexToRgb(KEY_RAMPS.top[2])));
    expect(m.get(pack(...hexToRgb('#f5aa14')))).toBe(pack(...hexToRgb(KEY_RAMPS.top[3])));
  });
});
