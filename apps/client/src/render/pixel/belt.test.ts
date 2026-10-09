import { describe, expect, it } from 'vitest';
import { BELT_COLORS, DEFAULT_APPEARANCE } from '@tudobem/shared';
import { composeRgba } from './charcompose';
import { GI_BELT_BASE, lookForAppearance, lookKey } from './looks';
import { KEY_RAMPS, buildRamp, hexToRgb, luma } from './palette';

const px = (hex: string): number[] => [...hexToRgb(hex), 255];

describe('the belt worn in the academia', () => {
  const gi = (l: ReturnType<typeof lookForAppearance>) => l.layers.find((x) => x.key.startsWith('npc_gi'));

  it('the gi layer takes the jacket colour, the skin and the belt ramp of the belt asked for; no belt is Bia\'s black one', () => {
    const plain = lookForAppearance(DEFAULT_APPEARANCE, { gi: true });
    const white = lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'branca' });
    const blue = lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'azul' });
    expect(gi(plain)?.ramps?.belt).toBe(GI_BELT_BASE.preta);
    expect(gi(white)?.ramps?.belt).toBe(GI_BELT_BASE.branca);
    expect(gi(blue)?.ramps?.belt).toBe(BELT_COLORS.azul);
    expect(gi(blue)?.ramps?.top).toBe(lookForAppearance(DEFAULT_APPEARANCE).layers.find((l) => l.key.startsWith('outfit_'))?.ramps?.top);
    expect(gi(blue)?.ramps?.skin).toBeDefined();
    // a belt without the gi pieces is nothing
    expect(lookForAppearance(DEFAULT_APPEARANCE, { belt: 'azul' }).layers.some((l) => l.key.startsWith('npc_gi'))).toBe(false);
  });

  it('the academy stamp is its own layer over the gi, only when asked for', () => {
    const stamped = lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'azul', stamp: 'estrela' });
    const keys = stamped.layers.map((l) => l.key);
    expect(keys.indexOf('gi_patch')).toBe(keys.indexOf('npc_gi') + 1);
    expect(stamped.layers.find((l) => l.key === 'gi_patch')?.ramps?.accent).toMatch(/^#/);
    expect(lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'azul' }).layers.some((l) => l.key === 'gi_patch')).toBe(false);
    expect(lookForAppearance({ ...DEFAULT_APPEARANCE, body: 'forte' }, { gi: true, stamp: 'sol' }).layers.some((l) => l.key === 'gi_patch__forte')).toBe(true);
  });

  it('the sheet cache tells the belts apart (one texture per belt colour)', () => {
    const k = (belt?: 'branca' | 'azul') => lookKey(lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt }));
    expect(new Set([k(), k('branca'), k('azul')]).size).toBe(3);
    expect(k('azul')).toBe(k('azul'));
  });

  it('the belt ramp recolours the three belt keys (knot shade, band, knot light) and leaves everything else alone', () => {
    const [dark, band, light] = KEY_RAMPS.belt;
    const layer = new Uint8ClampedArray([...px(dark), ...px(band), ...px(light), ...px('#46465e'), 0, 0, 0, 0]);
    const out = composeRgba(layer.length, [{ data: layer, ramps: { belt: BELT_COLORS.azul } }]);
    const ramp = buildRamp(BELT_COLORS.azul, 3);
    expect(Array.from(out.slice(0, 4))).toEqual(px(ramp[0]));
    expect(Array.from(out.slice(4, 8))).toEqual(px(ramp[1]));
    expect(Array.from(out.slice(8, 12))).toEqual(px(ramp[2]));
    expect(Array.from(out.slice(12, 16))).toEqual(px('#46465e'));
    expect(out[19]).toBe(0);
    // the source layer is never modified
    expect(Array.from(layer.slice(0, 4))).toEqual(px(dark));
  });

  it('every belt reads as its colour, and the white belt reads on a white gi', () => {
    const lum = (hex: string) => luma(...hexToRgb(hex));
    const band = (belt: keyof typeof GI_BELT_BASE) => buildRamp(GI_BELT_BASE[belt], 3)[1];
    expect(lum(band('branca'))).toBeGreaterThan(200);
    expect(lum(band('preta'))).toBeLessThan(60);
    const [r, , b] = hexToRgb(band('azul'));
    expect(b).toBeGreaterThan(r + 60);
    // the white belt band is not the white gi's own colour, and its knot shade is clearly darker than both
    expect(band('branca')).not.toBe('#eee6d9');
    expect(lum(buildRamp(GI_BELT_BASE.branca, 3)[0])).toBeLessThan(lum('#eee6d9') - 30);
  });
});
