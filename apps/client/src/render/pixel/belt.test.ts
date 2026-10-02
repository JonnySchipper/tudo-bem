import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@tudobem/shared';
import { composeRgba, exactTable } from './charcompose';
import { GI_BELT_MAP, lookForAppearance, lookKey } from './looks';
import { hexToRgb } from './palette';

const px = (hex: string): number[] => [...hexToRgb(hex), 255];

describe('the belt worn in the academia', () => {
  it('adds the gi layer with the belt colours only when a belt is asked for; Bia (no belt) keeps hers', () => {
    const plain = lookForAppearance(DEFAULT_APPEARANCE, { gi: true });
    const white = lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'branca' });
    const blue = lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt: 'azul' });
    const gi = (l: typeof plain) => l.layers.find((x) => x.key.startsWith('npc_gi'));
    expect(gi(plain)?.map).toBeUndefined();
    expect(gi(white)?.map).toEqual(GI_BELT_MAP.branca);
    expect(gi(blue)?.map).toEqual(GI_BELT_MAP.azul);
    // a belt without the gi pieces is nothing
    expect(lookForAppearance(DEFAULT_APPEARANCE, { belt: 'azul' }).layers.some((l) => l.key.startsWith('npc_gi'))).toBe(false);
  });

  it('the sheet cache tells the belts apart (one texture per belt colour)', () => {
    const k = (belt?: 'branca' | 'azul') => lookKey(lookForAppearance(DEFAULT_APPEARANCE, { gi: true, belt }));
    expect(new Set([k(), k('branca'), k('azul')]).size).toBe(3);
    expect(k('azul')).toBe(k('azul'));
  });

  it('an exact swap recolours the gi belt pixels and leaves everything else alone', () => {
    // two belt pixels (band, shade), a lapel pixel and a transparent one
    const layer = new Uint8ClampedArray([...px('#3a3a50'), ...px('#1f1f2e'), ...px('#d8d0e0'), 0, 0, 0, 0]);
    const out = composeRgba(layer.length, [{ data: layer, map: GI_BELT_MAP.azul }]);
    expect(Array.from(out.slice(0, 4))).toEqual(px(GI_BELT_MAP.azul['#3a3a50']!));
    expect(Array.from(out.slice(4, 8))).toEqual(px(GI_BELT_MAP.azul['#1f1f2e']!));
    expect(Array.from(out.slice(8, 12))).toEqual(px('#d8d0e0'));
    expect(out[15]).toBe(0);
    // the source layer is never modified
    expect(Array.from(layer.slice(0, 4))).toEqual(px('#3a3a50'));
    expect(exactTable({}).size).toBe(0);
  });

  it('the white belt reads white and the blue belt reads blue', () => {
    const lum = (hex: string) => hexToRgb(hex).reduce((a, b) => a + b, 0);
    expect(lum(GI_BELT_MAP.branca['#3a3a50']!)).toBeGreaterThan(600);
    const [r, , b] = hexToRgb(GI_BELT_MAP.azul['#3a3a50']!);
    expect(b).toBeGreaterThan(r + 60);
  });
});
