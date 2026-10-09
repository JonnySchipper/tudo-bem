import { describe, expect, it } from 'vitest';
import { highlightEdges, outlineSheet, outlineShade, shadeEdges } from './charfx';

const G = { frameW: 8, frameH: 8, cols: 1, rows: 1 };
const NAVY: [number, number, number] = [0x3a, 0x3a, 0x50];
const px = (d: Uint8ClampedArray, x: number, y: number) => {
  const i = (y * 8 + x) * 4;
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
};
const put = (d: Uint8ClampedArray, x: number, y: number, c: [number, number, number]) => {
  const i = (y * 8 + x) * 4;
  d[i] = c[0];
  d[i + 1] = c[1];
  d[i + 2] = c[2];
  d[i + 3] = 255;
};
const luma = (p: { r: number; g: number; b: number }) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

/** a 4x4 navy-outlined square (the pack's own outline) around a 2x2 skin-colored fill, at (2,2) */
function figure(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) put(d, x, y, y > 2 && y < 5 && x > 2 && x < 5 ? [0xe0, 0xa0, 0x80] : NAVY);
  return d;
}

describe('outlineSheet (selective outer outline)', () => {
  it('re-tints the outer navy ring with a dark shade of the part it surrounds, darker than the part and not black', () => {
    const d = figure();
    outlineSheet(d, G);
    const edge = px(d, 2, 3);
    expect(edge.a).toBe(255);
    expect(luma(edge)).toBeLessThan(luma(px(d, 3, 3)) * 0.6);
    expect(edge.r + edge.g + edge.b).toBeGreaterThan(0);
    // the tint follows the part: a warm skin gives a warm outline (red above blue), unlike the pack's cool navy
    expect(edge.r).toBeGreaterThan(NAVY[0] - 30);
    expect(px(d, 3, 3).r).toBe(0xe0); // the fill is untouched
  });

  it('closes a silhouette that has no outline, one pixel on the 4-neighbourhood only', () => {
    const d = new Uint8ClampedArray(8 * 8 * 4);
    put(d, 4, 4, [200, 60, 60]);
    outlineSheet(d, G);
    for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]]) expect(px(d, x, y).a, `${x},${y}`).toBe(255);
    expect(px(d, 3, 3).a).toBe(0);
    expect(px(d, 5, 5).a).toBe(0);
  });

  it('never writes outside the frame', () => {
    const d = new Uint8ClampedArray(8 * 8 * 4);
    put(d, 0, 0, [200, 60, 60]);
    outlineSheet(d, G);
    expect(px(d, 1, 0).a).toBe(255);
    expect(px(d, 0, 1).a).toBe(255);
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) opaque++;
    expect(opaque).toBe(3); // the dot and its two in-frame neighbours
  });

  it('keeps the navy of the lines inside the figure', () => {
    const d = figure();
    put(d, 3, 3, NAVY); // an inner line, surrounded by fill
    put(d, 4, 3, [0xe0, 0xa0, 0x80]);
    outlineSheet(d, G);
    const inner = px(d, 3, 3);
    expect([inner.r, inner.g, inner.b]).toEqual(NAVY);
  });

  it('a white part does not give a mid-grey outline', () => {
    const [r, g, b] = outlineShade(250, 250, 250);
    expect(Math.max(r, g, b)).toBeLessThan(110);
  });
});

describe('highlightEdges (top-left light)', () => {
  it('lifts the pixels just inside the top and left outline, not the bottom or right', () => {
    const d = figure();
    // widen the fill so there is a top row, a left column and an interior
    for (let y = 3; y < 5; y++) for (let x = 3; x < 5; x++) put(d, x, y, [100, 100, 100]);
    highlightEdges(d, G);
    expect(px(d, 3, 3).r).toBeGreaterThan(100); // top-left corner of the fill
    expect(px(d, 4, 3).r).toBeGreaterThan(100); // top edge
    expect(px(d, 3, 4).r).toBeGreaterThan(100); // left edge
    expect(px(d, 4, 4).r).toBe(100); // bottom-right of the fill
    expect(px(d, 2, 2).r).toBe(NAVY[0]); // the outline itself
  });
});

describe('shadeEdges (bottom-right shade)', () => {
  /** a 5x5 navy ring around a 3x3 grey fill at (2..4, 2..4) */
  function block(): Uint8ClampedArray {
    const d = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) put(d, x, y, y > 1 && y < 5 && x > 1 && x < 5 ? [100, 100, 100] : NAVY);
    return d;
  }

  it('darkens and cools the pixels just inside the bottom and right outline, and leaves the lit top-left edge alone', () => {
    const d = block();
    shadeEdges(d, G);
    expect(px(d, 4, 4).r).toBeLessThan(100); // bottom-right corner of the fill
    expect(px(d, 3, 4).r).toBeLessThan(100); // bottom edge
    expect(px(d, 2, 4).r).toBeLessThan(100); // the underside stays in shade on the lit left side too
    expect(px(d, 4, 3).r).toBeLessThan(100); // right edge
    expect(px(d, 2, 2).r).toBe(100); // top-left of the fill: the light's side
    expect(px(d, 4, 2).r).toBe(100); // the top edge wins over the right edge
    expect(px(d, 3, 3).r).toBe(100); // the interior
    const corner = px(d, 4, 4);
    expect(corner.b).toBeGreaterThan(corner.r); // cooled, not just darker
    expect(px(d, 1, 1).r).toBe(NAVY[0]); // the outline itself
  });

  it('with the highlight, a part gets a lit side and a shaded side', () => {
    const d = block();
    highlightEdges(d, G);
    shadeEdges(d, G);
    expect(luma(px(d, 2, 2))).toBeGreaterThan(luma(px(d, 4, 4)) + 20);
  });
});
