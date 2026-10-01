import { describe, expect, it } from 'vitest';
import { ShelfPacker, blurPasses, buildSilhouette, type RgbaImage } from './silhouette';
import { SIL_PAD } from './shadows';

/** An image whose opaque pixels are given by rows of '#' (and '.' for empty). */
function img(rows: string[]): RgbaImage {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((c, x) => (data[(y * w + x) * 4 + 3] = c === '#' ? 255 : 0)));
  return { w, h, data };
}
const alphaAt = (s: { w: number; data: Uint8ClampedArray | Uint8Array }, x: number, y: number) => s.data[(y * s.w + x) * 4 + 3];

describe('silhouette', () => {
  it('is white with alpha only', () => {
    const s = buildSilhouette(img(['###', '###']), 1, 2, { blur: 0 });
    for (let i = 0; i < s.w * s.h; i++) {
      expect(s.data[i * 4]).toBe(255);
      expect(s.data[i * 4 + 2]).toBe(255);
    }
  });
  it('pads by SIL_PAD and puts the foot at the bottom of the kept rows', () => {
    const s = buildSilhouette(img(['.#.', '###', '###', '###']), 1, 3, { blur: 0 });
    // 3 rows above the foot, a 4th row below it is dropped
    expect(s.w).toBe(3 + 2 * SIL_PAD);
    expect(s.h).toBe(3 + 2 * SIL_PAD);
    expect(s.ax).toBe(1 + SIL_PAD);
    expect(s.ay).toBe(3 + SIL_PAD);
  });
  it('drops the rows below the foot', () => {
    const s = buildSilhouette(img(['###', '###', '###']), 1, 1, { blur: 0 });
    expect(s.h).toBe(1 + 2 * SIL_PAD);
    expect(alphaAt(s, SIL_PAD + 1, SIL_PAD)).toBeGreaterThan(0);
    expect(alphaAt(s, SIL_PAD + 1, SIL_PAD + 1)).toBe(0);
  });
  it('keeps the shape without blur and spreads it with blur', () => {
    const src = img(['#####', '#####', '#####', '#####', '#####', '#####']);
    const hard = buildSilhouette(src, 2, 6, { blur: 0, tip: 1 });
    expect(alphaAt(hard, SIL_PAD, SIL_PAD)).toBe(255);
    expect(alphaAt(hard, SIL_PAD - 1, SIL_PAD)).toBe(0);
    const soft = buildSilhouette(src, 2, 6, { blur: 1, tip: 1 });
    expect(alphaAt(soft, SIL_PAD - 1, SIL_PAD + 2)).toBeGreaterThan(0);
    expect(alphaAt(soft, SIL_PAD, SIL_PAD + 2)).toBeLessThan(255);
    expect(alphaAt(soft, SIL_PAD + 2, SIL_PAD + 3)).toBeGreaterThan(200);
  });
  it('is darker at the foot than at the tip', () => {
    const src = img(['###', '###', '###', '###', '###', '###', '###', '###']);
    const s = buildSilhouette(src, 1, 8, { blur: 0, tip: 0.5 });
    expect(alphaAt(s, SIL_PAD + 1, SIL_PAD + 7)).toBeGreaterThan(alphaAt(s, SIL_PAD + 1, SIL_PAD));
    expect(alphaAt(s, SIL_PAD + 1, SIL_PAD)).toBeLessThan(150);
  });
  it('an empty sprite gives an empty silhouette', () => {
    const s = buildSilhouette(img(['...', '...']), 1, 2, { blur: 1 });
    expect(s.data.every((v, i) => i % 4 !== 3 || v === 0)).toBe(true);
  });
  it('blur passes grow with the radius', () => {
    expect(blurPasses(0)).toBe(0);
    expect(blurPasses(0.9)).toBe(1);
    expect(blurPasses(1.6)).toBe(2);
  });
});

describe('ShelfPacker', () => {
  it('packs rows left to right, then down, with a gutter', () => {
    const p = new ShelfPacker(20, 20);
    expect(p.alloc(8, 5)).toEqual({ x: 0, y: 0 });
    expect(p.alloc(8, 3)).toEqual({ x: 9, y: 0 });
    // no room for 8 more on the first shelf: next shelf starts below the tallest (5) plus the gutter
    expect(p.alloc(8, 4)).toEqual({ x: 0, y: 6 });
  });
  it('returns null when full or too wide, and reset starts over', () => {
    const p = new ShelfPacker(10, 10);
    expect(p.alloc(11, 2)).toBeNull();
    expect(p.alloc(9, 9)).toEqual({ x: 0, y: 0 });
    expect(p.alloc(9, 2)).toBeNull();
    p.reset();
    expect(p.alloc(9, 2)).toEqual({ x: 0, y: 0 });
  });
});
