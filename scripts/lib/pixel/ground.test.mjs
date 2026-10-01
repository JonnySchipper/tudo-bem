import { describe, expect, it } from 'vitest';
import { calcadaFills, pavePx, WAVES, WAVE, PAVE, spMosaic, spMapBitmap } from '../../../apps/client/assets-src/custom/calcada.mjs';
import { asfalto, busBay, grassPatch, dirtPatch, clover, gtuft } from '../../../apps/client/assets-src/custom/ground.mjs';
import { crosswalk, laneDash } from '../../../apps/client/assets-src/custom/street.mjs';
import { tijolo } from '../../../apps/client/assets-src/custom/floors.mjs';
import { buildSlabTiles } from './terrain-gen.mjs';
import { blank, setPx, hexPx } from './img.mjs';
import { maskAt } from '../../../apps/client/src/render/pixel/terrain.ts';
import { luma, hexToRgb, rgbToHex } from '../../../apps/client/src/render/pixel/palette.ts';

const alphaAt = (img, x, y) => img.data[(y * img.w + x) * 4 + 3];
const hexAt = (img, x, y) => rgbToHex(img.data[(y * img.w + x) * 4], img.data[(y * img.w + x) * 4 + 1], img.data[(y * img.w + x) * 4 + 2]);
const distinct = (img) => new Set(Array.from({ length: img.w * img.h }, (_, i) => hexAt(img, i % img.w, Math.floor(i / img.w))));

describe('V1 calcada: a calm two-tone wave', () => {
  const o = WAVES[WAVE];
  const { fills, phasesX, phasesY } = calcadaFills();

  it('is a bold large-scale wave: the pattern repeats every 4 tiles across and 2 down, as a whole number of 16 px tiles', () => {
    expect(o.px % 16).toBe(0);
    expect(o.py % 16).toBe(0);
    expect(phasesX).toBe(4);
    expect(phasesY).toBe(2);
    expect(fills).toHaveLength(8);
    for (const f of fills) { expect([f.w, f.h]).toEqual([16, 16]); for (let i = 3; i < f.data.length; i += 4) expect(f.data[i]).toBe(255); }
  });

  it('tiles seamlessly: the pattern is exactly periodic in x and y', () => {
    for (let k = 0; k < 400; k++) {
      const X = (k * 37) % o.px, Y = (k * 91) % o.py;
      expect(pavePx(o, X + o.px, Y)).toBe(pavePx(o, X, Y));
      // down the page the stone tones are free to differ, but the band (light or dark) must repeat exactly
      const dark = (h) => luma(...hexToRgb(h)) < 165;
      expect(dark(pavePx(o, X, Y + o.py))).toBe(dark(pavePx(o, X, Y)));
    }
  });

  it('has no per-pixel noise: only a handful of stone tones, and neighbouring pixels are the same or one step apart', () => {
    const all = new Set();
    for (const f of fills) for (const h of distinct(f)) all.add(h);
    expect(all.size).toBeLessThanOrEqual(10);
    // the largest luma step between horizontal neighbours is the band border (or a joint), never random speckle: count the "busy" pixels
    let jumps = 0, total = 0;
    for (let Y = 0; Y < o.py; Y++) for (let X = 0; X < o.px; X++) {
      const a = luma(...hexToRgb(pavePx(o, X, Y))), b = luma(...hexToRgb(pavePx(o, X + 1, Y)));
      total++;
      if (Math.abs(a - b) > 30) jumps++;
    }
    expect(jumps / total).toBeLessThan(0.06);
  });

  it('keeps the two tones about 45 luma apart (readable, calmer than the mosaic)', () => {
    const mean = (hs) => hs.reduce((n, h) => n + luma(...hexToRgb(h)), 0) / hs.length;
    const gap = mean(PAVE.light) - mean(PAVE.dark);
    expect(gap).toBeGreaterThan(35);
    expect(gap).toBeLessThan(65);
  });
});

describe('V1 slab edges: the meio-fio', () => {
  const fill = blank(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(fill, x, y, hexPx('#9a9ab0'));
  const tiles = buildSlabTiles([fill]);

  it('a lawn corner is rounded: the empty quadrant loses its sharp corner (mask 7, grass bottom-right)', () => {
    const t = tiles[0b1110]; // TL TR BL filled, BR empty
    expect(alphaAt(t, 8, 8)).toBe(255); // the corner pixel became curb
    expect(alphaAt(t, 12, 12)).toBeLessThan(255); // grass further in stays open
  });

  it('every edge has the stone curb: an outline, a lit top and a groove', () => {
    const t = tiles[0b1100]; // the top half is paving: the grass lies to the south
    const col = [7, 6, 5, 4, 3, 2].map((y) => hexAt(t, 4, y)); // from the edge inwards
    expect(col[0]).toBe('#3a3a50'); // outline
    expect(new Set(col).size).toBeGreaterThanOrEqual(5); // outline, two face rows, the top, the groove
    const north = tiles[0b0011]; // paving below, empty above: the curb top is lit
    expect(hexAt(north, 4, 8)).toBe('#46465e');
    expect(hexAt(north, 4, 9)).toBe('#ebe4f2');
  });

  it('adjacent tiles still agree on which pixels are solid along their shared edge (rounded corners stay inside the tile)', () => {
    const floor = ['gggggggg', 'gccccccg', 'gccggccg', 'gccggccg', 'gccccccg', 'ggggcggg', 'gggggggg'];
    const cols = floor[0].length + 1, rows = floor.length + 1;
    const solid = (i, j, x, y) => alphaAt(tiles[maskAt(floor, 'c', i, j)], x, y) === 255;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols - 1; i++) for (let y = 0; y < 16; y++) expect(solid(i, j, 15, y)).toBe(solid(i + 1, j, 0, y));
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols; i++) for (let x = 0; x < 16; x++) expect(solid(i, j, x, 15)).toBe(solid(i, j + 1, x, 0));
  });
});

describe('V1 São Paulo mosaic', () => {
  it('is 64x48 (4x3 tiles), opaque, framed, with the capital marked in orange', () => {
    const m = spMosaic();
    expect([m.w, m.h]).toEqual([64, 48]);
    for (let i = 3; i < m.data.length; i += 4) expect(m.data[i]).toBe(255);
    const { cx, cy } = spMapBitmap(64, 48, 5);
    expect(hexAt(m, cx, cy)).toBe('#ed931e');
    // the frame is the light stone, the field the dark one
    expect(luma(...hexToRgb(hexAt(m, 32, 1)))).toBeGreaterThan(190);
    expect(luma(...hexToRgb(hexAt(m, 6, 40)))).toBeLessThan(110);
  });

  it('the state fills about half of the field: a recognisable silhouette, not a speck', () => {
    const { bits } = spMapBitmap(64, 48, 5);
    let n = 0;
    for (const row of bits) for (const v of row) if (v >= 5) n++;
    expect(n / (64 * 48)).toBeGreaterThan(0.25);
    expect(n / (64 * 48)).toBeLessThan(0.7);
  });
});

describe('V1 streets and grass art', () => {
  it('asphalt: 7 plain variants repeated for weight, plus 2 cracked, 1 patch, 1 oil: specials are about one tile in ten', () => {
    const v = asfalto();
    expect(v.length).toBe(39);
    const keys = new Set(v.map((t) => Buffer.from(t.data).toString('base64')));
    expect(keys.size).toBe(11);
    for (const t of v) for (let i = 3; i < t.data.length; i += 4) expect(t.data[i]).toBe(255);
  });

  it('the zebra crossing is 4 px bars on a 8 px pitch (bar = gap) and the lane dash is yellow', () => {
    const c = crosswalk(32, 64);
    const rows = Array.from({ length: 64 }, (_, y) => alphaAt(c, 16, y));
    expect(rows.slice(0, 10)).toEqual([0, 0, 255, 255, 255, 255, 0, 0, 0, 0]);
    expect(laneDash(12).w).toBe(12);
  });

  it('the bus bay has no lettering: a yellow outline only', () => {
    const b = busBay(112, 32);
    const inner = [];
    for (let y = 8; y < 24; y++) for (let x = 6; x < 106; x++) if (alphaAt(b, x, y)) inner.push(1);
    expect(inner.length).toBeLessThan(40); // just the hatch ticks near the bottom edge
    expect(alphaAt(b, 50, 3)).toBe(255);
  });

  it('grass patches are dithered (some pixels clear), the dirt patch is flat and the tufts and clover are small', () => {
    const g = grassPatch(112, 64, 101, 'light');
    let on = 0;
    for (let i = 3; i < g.data.length; i += 4) if (g.data[i]) on++;
    expect(on).toBeGreaterThan(112 * 64 * 0.2);
    expect(on).toBeLessThan(112 * 64 * 0.75);
    expect(distinct(dirtPatch(34, 14, 301)).size).toBeLessThanOrEqual(5);
    expect([clover(0).w, clover(0).h]).toEqual([7, 6]);
    expect(gtuft(2).w).toBe(5);
  });

  it('the brick is a dusty clay: low saturation, with mortar of more than one grey', () => {
    const [t] = tijolo();
    const cols = distinct(t);
    expect(cols.size).toBeGreaterThan(8);
    let satMax = 0;
    for (const h of cols) { const [r, g, b] = hexToRgb(h); satMax = Math.max(satMax, (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b)); }
    expect(satMax).toBeLessThan(0.45);
  });
});
