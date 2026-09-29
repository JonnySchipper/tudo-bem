import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ladrilho, tatame, calm } from '../../../apps/client/assets-src/custom/floors.mjs';
import { wallDecor, doorPart } from '../../../apps/client/assets-src/custom/walls.mjs';
import { lightPatch } from '../../../apps/client/assets-src/custom/fx.mjs';

// Phase 4a art: calmer floors, the west door, resized wall decor, the window light patch.
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function lumaSd(imgs) {
  const l = [];
  for (const t of imgs) for (let i = 0; i < t.data.length; i += 4) if (t.data[i + 3] > 0) l.push(luma(t.data[i], t.data[i + 1], t.data[i + 2]));
  const mean = l.reduce((a, b) => a + b, 0) / l.length;
  return Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
}

// luma standard deviation of the fills before Phase 4a (art track 3), measured from the committed PNGs at that commit
const BASELINE = { ladrilho: 30.2, taco: 45.2, tatame: 20.3 };

describe('calmer floors (35-40% less contrast, still recognisable)', () => {
  it('ladrilho and tatame luma contrast is 35-40% below the art track 3 fills', () => {
    const lad = lumaSd(ladrilho());
    const tat = lumaSd(tatame());
    expect(lad / BASELINE.ladrilho).toBeGreaterThan(0.58);
    expect(lad / BASELINE.ladrilho).toBeLessThan(0.67);
    expect(tat / BASELINE.tatame).toBeGreaterThan(0.58);
    expect(tat / BASELINE.tatame).toBeLessThan(0.67);
  });

  it('the taco parquet (read from the generated fill) is calmer by the same amount and a little lighter', async () => {
    const f = path.resolve(__dirname, '../../../apps/client/assets-src/custom/png/floor_taco_fill.png');
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const sd = lumaSd([{ data, w: info.width, h: info.height }]);
    expect(sd / BASELINE.taco).toBeGreaterThan(0.58);
    expect(sd / BASELINE.taco).toBeLessThan(0.67);
  });

  it('the patterns are still there: neighbouring tones differ, and fills stay opaque', () => {
    for (const t of [...ladrilho(), ...tatame()]) {
      const seen = new Set();
      for (let i = 0; i < t.data.length; i += 4) {
        expect(t.data[i + 3]).toBe(255);
        seen.add(`${t.data[i]},${t.data[i + 1]},${t.data[i + 2]}`);
      }
      expect(seen.size).toBeGreaterThanOrEqual(3);
    }
    expect(lumaSd(ladrilho())).toBeGreaterThan(10);
    expect(lumaSd(tatame())).toBeGreaterThan(8);
  });

  it('calm() with gain 1 changes nothing and keeps the mean colour', () => {
    const a = ladrilho();
    const same = calm(a, 1);
    expect(Buffer.from(same[0].data).equals(Buffer.from(a[0].data))).toBe(true);
  });
});

describe('wall decor resized for the Phase 4a layout', () => {
  const size = (kind) => {
    const [p] = wallDecor({}, { kind });
    return [p.img.w, p.img.h];
  };
  it('shelves and awning are 4 tiles, the blackboard 2, the METRO sign 2 (slim)', () => {
    expect(size('prateleira')[0]).toBe(64);
    expect(size('toldo')[0]).toBe(64);
    expect(size('lousa')[0]).toBe(32);
    expect(size('metro')).toEqual([32, 14]);
  });
});

describe('west door', () => {
  const [{ img, anchor }] = doorPart({}, { kind: 'west' });
  const px = (x, y) => [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)];
  const isColor = (p, hex) => p[0] === parseInt(hex.slice(1, 3), 16) && p[1] === parseInt(hex.slice(3, 5), 16) && p[2] === parseInt(hex.slice(5, 7), 16);

  it('fills exactly one wall-strip cell, opaque, anchored like the strip', () => {
    expect([img.w, img.h, anchor]).toEqual([16, 16, [16, 16]]);
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
  });

  it('is a closed door in a frame: brass handle, glass window with a glint, wood leaf, navy frame outline', () => {
    let glass = 0, brass = 0, glint = 0, navy = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = px(x, y);
      if (isColor(p, '#a9d2f0')) glass++;
      if (isColor(p, '#f2c230')) brass++;
      if (isColor(p, '#ffffff') && x >= 6) glint++;
      if (isColor(p, '#3a3a50') || (p[0] < 60 && p[1] < 60 && p[2] < 90)) navy++;
    }
    expect(glass).toBeGreaterThanOrEqual(4);
    expect(brass).toBeGreaterThanOrEqual(1);
    expect(glint).toBeGreaterThanOrEqual(1);
    expect(navy).toBeGreaterThan(30);
  });

  it('has no diagonal open leaf: the leaf rows are the same wood colour left to right', () => {
    // a diagonal slab would put its edge on a different column on every row; a closed leaf keeps its lit left edge on one column
    const edge = new Set();
    for (let y = 4; y < 13; y++) edge.add(px(8, y).join(','));
    expect(edge.size).toBe(1);
    // and the row above the handle is wood across the whole leaf width
    const wood = new Set();
    for (let x = 9; x < 13; x++) wood.add(px(x, 9).join(','));
    expect(wood.size).toBeLessThanOrEqual(2);
  });
});

describe('window light patch', () => {
  it('is a warm, translucent, slanted parallelogram with unlit mullions', () => {
    const p = lightPatch(32, 2);
    expect([p.w, p.h]).toEqual([48, 40]);
    let lit = 0;
    for (let i = 0; i < p.data.length; i += 4) {
      if (p.data[i + 3] === 0) continue;
      lit++;
      expect(p.data[i]).toBeGreaterThan(p.data[i + 2]); // warm: red above blue
      expect(p.data[i + 3]).toBeLessThan(120); // translucent
    }
    expect(lit).toBeGreaterThan(400);
    // the top row starts at the window's left edge, the bottom rows lean right (light from the upper left)
    const first = (y) => { for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3] > 0) return x; return -1; };
    expect(first(1)).toBeLessThanOrEqual(1);
    expect(first(30)).toBeGreaterThan(8);
    // the vertical mullion leaves a dark gap through the middle of the top rows
    const x0 = Math.round((4 * 16) / 40); // the row's left edge
    expect(p.data[(4 * p.w + x0 + 15) * 4 + 3]).toBe(0);
    expect(p.data[(4 * p.w + x0 + 16) * 4 + 3]).toBe(0);
    expect(p.data[(4 * p.w + x0 + 8) * 4 + 3]).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(Buffer.from(lightPatch(48, 3).data).equals(Buffer.from(lightPatch(48, 3).data))).toBe(true);
  });
});

void fs;
