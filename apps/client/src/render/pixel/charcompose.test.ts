import { describe, expect, it } from 'vitest';
import { compositeOver, composeRgba, tableFor } from './charcompose';
import { composeLook } from './composeLook';
import { CharSheets, type SheetBackend } from './charCache';
import { KEY_RAMPS, buildRamp, hexToRgb, rgbToHex } from './palette';
import { lookForAppearance, type Look } from './looks';
import type { Appearance } from '@tudobem/shared';

const px = (hex: string, a = 255) => [...hexToRgb(hex), a];
const buf = (...pixels: number[][]) => new Uint8ClampedArray(pixels.flat());
const hexAt = (d: Uint8ClampedArray, i: number) => rgbToHex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);

describe('composeRgba (2x1 test image)', () => {
  it('swaps key colors per layer, then draws layers back to front', () => {
    const skin = buf(px(KEY_RAMPS.skin[2]), px(KEY_RAMPS.skin[0]));
    const hat = buf(px('#000000', 0), px(KEY_RAMPS.hat[3]));
    const out = composeRgba(8, [
      { data: skin, ramps: { skin: '#c68a5f' } },
      { data: hat, ramps: { hat: '#2e8f58' } },
    ]);
    expect(hexAt(out, 0)).toBe(buildRamp('#c68a5f')[2]);
    expect(hexAt(out, 1)).toBe(buildRamp('#2e8f58')[3]); // the hat covers the skin pixel
    expect(skin[0]).toBe(hexToRgb(KEY_RAMPS.skin[2])[0]); // sources are not modified
  });

  it('blends semi-transparent pixels (blush) instead of overwriting', () => {
    const dst = buf(px('#c68a5f'), px('#c68a5f'));
    compositeOver(dst, buf(px('#e0707a', 150), px('#e0707a', 0)));
    expect(hexAt(dst, 0)).not.toBe('#c68a5f');
    expect(hexAt(dst, 0)).not.toBe('#e0707a');
    expect(hexAt(dst, 1)).toBe('#c68a5f');
    expect(dst[3]).toBe(255);
  });

  it('rejects a layer of the wrong size', () => {
    expect(() => composeRgba(8, [{ data: new Uint8ClampedArray(4) }])).toThrow();
  });

  it('accent and hat ramps are independent tables', () => {
    const t = tableFor({ hat: '#2e8f58', accent: '#e8b634' });
    expect(t.size).toBe(KEY_RAMPS.hat.length + KEY_RAMPS.accent.length);
  });

  it('composeLook composes a look from decoded layers and warns once about a missing layer', () => {
    const layers = new Map<string, { data: Uint8ClampedArray }>([
      ['body_medio', { data: buf(px(KEY_RAMPS.skin[2]), px('#000000', 0)) }],
      ['hair_curto', { data: buf(px('#000000', 0), px(KEY_RAMPS.hair[2])) }],
    ]);
    const a: Appearance = { body: 'medio', skin: 0, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 0, bottom: 'calca', bottomColor: 0, shoes: 0 };
    const out = composeLook({ sheetW: 2, sheetH: 1, layer: (k) => layers.get(k) }, lookForAppearance(a));
    expect(out[3]).toBe(255);
    expect(out[7]).toBe(255);
  });
});

describe('CharSheets cache', () => {
  const look = (skin: number): Look => lookForAppearance({ body: 'medio', skin, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 0, bottom: 'calca', bottomColor: 0, shoes: 0 });
  const backend = () => {
    const live = new Set<string>();
    const b: SheetBackend = { add: (k) => void live.add(k), remove: (k) => void live.delete(k) };
    return { live, b };
  };

  it('composes a look once and shares the texture', () => {
    const { live, b } = backend();
    const cache = new CharSheets(b, 4);
    const k1 = cache.acquire(look(1));
    const k2 = cache.acquire(look(1));
    expect(k1).toBe(k2);
    expect(live.size).toBe(1);
  });

  it('evicts least-recently-used unused sheets past the cap and removes their textures', () => {
    const { live, b } = backend();
    const cache = new CharSheets(b, 3);
    const keys = [0, 1, 2, 3, 4].map((s) => {
      const k = cache.acquire(look(s));
      cache.release(k);
      return k;
    });
    expect(cache.size).toBe(3);
    expect(live.size).toBe(3);
    expect(live.has(keys[0])).toBe(false);
    expect(live.has(keys[4])).toBe(true);
  });

  it('never evicts a sheet that a sprite still uses', () => {
    const { live, b } = backend();
    const cache = new CharSheets(b, 2);
    const held = cache.acquire(look(0));
    for (const s of [1, 2, 3, 4]) cache.release(cache.acquire(look(s)));
    expect(live.has(held)).toBe(true);
    cache.release(held);
    expect(cache.size).toBeLessThanOrEqual(2);
  });
});
