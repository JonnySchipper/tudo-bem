import { describe, expect, it } from 'vitest';
import { blank, setPx, hexPx, extrude, crop, isolate } from './img.mjs';
import { buildSlabTiles } from './terrain-gen.mjs';
import { toCanonicalSheet, keyLayer, CANON_ANIMS, CANON_COLS, CANON_ROWS, FRAME_W, FRAME_H, FACINGS, SRC_BLOCK } from './chars.mjs';
import { packAtlas } from './pack.mjs';
import { castShadow } from './shadow.mjs';
import { splitTree, swayFrames } from './tree.mjs';
import { KEY_RAMPS, hexToRgb } from '../../../apps/client/src/render/pixel/palette.ts';
import { maskAt } from '../../../apps/client/src/render/pixel/terrain.ts';

const alphaAt = (img, x, y) => img.data[(y * img.w + x) * 4 + 3];
const rgbAt = (img, x, y) => [img.data[(y * img.w + x) * 4], img.data[(y * img.w + x) * 4 + 1], img.data[(y * img.w + x) * 4 + 2]];

function solid(hex, size = 16) {
  const img = blank(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setPx(img, x, y, hexPx(hex));
  return img;
}

describe('buildSlabTiles (16 dual-grid mask tiles)', () => {
  const tiles = buildSlabTiles([solid('#ebe4f2')]);

  it('emits 16 tiles per phase, mask 0 empty, mask 15 the untouched fill', () => {
    expect(tiles).toHaveLength(16);
    expect(tiles[0].data.every((v) => v === 0)).toBe(true);
    const full = tiles[15];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      expect(alphaAt(full, x, y)).toBe(255);
      expect(rgbAt(full, x, y)).toEqual(hexToRgb('#ebe4f2'));
    }
  });

  it('is two-phase aware: index = phase * 16 + mask', () => {
    const two = buildSlabTiles([solid('#111111'), solid('#eeeeee')]);
    expect(two).toHaveLength(32);
    expect(rgbAt(two[15], 4, 4)).toEqual(hexToRgb('#111111'));
    expect(rgbAt(two[16 + 15], 4, 4)).toEqual(hexToRgb('#eeeeee'));
  });

  it('a lone quadrant (TL, mask 8) fills the top-left and leaves the bottom-right clear of opaque pixels', () => {
    const t = tiles[8];
    expect(alphaAt(t, 0, 0)).toBe(255);
    expect(alphaAt(t, 3, 3)).toBe(255);
    expect(alphaAt(t, 15, 15)).toBeLessThan(255);
    // opaque region stays inside the TL quadrant
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (alphaAt(t, x, y) === 255) expect(x < 8 && y < 8).toBe(true);
  });

  it('adjacent display tiles agree on which pixels are solid along their shared edge (no seams)', () => {
    const floor = [
      'gggggggg',
      'gccccccg',
      'gccggccg',
      'gccggccg',
      'gccccccg',
      'ggggcggg',
      'gggggggg',
    ];
    const cols = floor[0].length + 1, rows = floor.length + 1;
    const solidAt = (i, j, x, y) => {
      const m = maskAt(floor, 'c', i, j);
      return alphaAt(tiles[m], x, y) === 255;
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols - 1; i++) for (let y = 0; y < 16; y++) {
      expect(solidAt(i, j, 15, y)).toBe(solidAt(i + 1, j, 0, y));
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols; i++) for (let x = 0; x < 16; x++) {
      expect(solidAt(i, j, x, 15)).toBe(solidAt(i, j + 1, x, 0));
    }
  });
});

describe('toCanonicalSheet (LimeZu layer -> canonical 8x17 sheet)', () => {
  // Source frame (row r, col c) is stamped with a marker pixel encoding r and c.
  const src = blank(896, 224);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 56; c++) setPx(src, c * 16 + 8, r * 32 + 20, [r * 10, c, 200, 255]);
  const out = toCanonicalSheet(src);
  const marker = (row, col) => rgbAt(out, col * FRAME_W + 8, row * FRAME_H + 20);

  it('has the documented size', () => {
    expect(out.w).toBe(CANON_COLS * FRAME_W);
    expect(out.h).toBe(CANON_ROWS * FRAME_H);
    expect(CANON_COLS).toBe(8);
    expect(CANON_ROWS).toBe(17);
  });

  it('remaps idle and walk facings: source block order E,N,W,S -> canonical rows S,W,E,N', () => {
    expect(FACINGS).toEqual(['S', 'W', 'E', 'N']);
    FACINGS.forEach((f, fi) => {
      for (let k = 0; k < 6; k++) {
        expect(marker(CANON_ANIMS.idle.rows[fi], k)).toEqual([10, SRC_BLOCK[f] * 6 + k, 200]);
        expect(marker(CANON_ANIMS.walk.rows[fi], k)).toEqual([20, SRC_BLOCK[f] * 6 + k, 200]);
      }
    });
    // spot checks against the LimeZu order: S is the 4th block (cols 18-23), E the 1st (0-5)
    expect(marker(0, 0)).toEqual([10, 18, 200]);
    expect(marker(2, 0)).toEqual([10, 0, 200]);
  });

  it('sit W/E come from the side-view sit row, S/N from the lowered idle frame', () => {
    expect(marker(CANON_ANIMS.sit.rows[1], 0)).toEqual([40, 6, 200]); // W = source sit col 6
    expect(marker(CANON_ANIMS.sit.rows[2], 0)).toEqual([40, 0, 200]); // E = source sit col 0
    // S/N: idle frame shifted down, so the marker (y=20) lands at y=24
    const lowered = rgbAt(out, 8, CANON_ANIMS.sit.rows[0] * FRAME_H + 24);
    expect(lowered).toEqual([10, 18, 200]);
  });

  it('emote rows reuse idle S until art exists', () => {
    for (const name of ['oi', 'dancar', 'rir', 'valeu', 'desculpa']) {
      const a = CANON_ANIMS[name];
      for (let k = 0; k < a.frames; k++) expect(marker(a.row, k)).toEqual([10, 18 + k, 200]);
    }
  });
});

describe('keyLayer', () => {
  it('replaces source shades by luminance rank with the exact key colors', () => {
    const img = blank(4, 1);
    setPx(img, 0, 0, hexPx('#cc9659'));
    setPx(img, 1, 0, hexPx('#ab6736'));
    setPx(img, 2, 0, hexPx('#b37b3f'));
    setPx(img, 3, 0, hexPx('#3a3a50')); // outline: untouched
    const keyed = keyLayer(img, { hair: ['#ab6736', '#b37b3f', '#cc9659'] });
    expect(rgbAt(keyed, 0, 0)).toEqual(hexToRgb(KEY_RAMPS.hair[3]));
    expect(rgbAt(keyed, 1, 0)).toEqual(hexToRgb(KEY_RAMPS.hair[1]));
    expect(rgbAt(keyed, 2, 0)).toEqual(hexToRgb(KEY_RAMPS.hair[2]));
    expect(rgbAt(keyed, 3, 0)).toEqual(hexToRgb('#3a3a50'));
  });
});

describe('packAtlas', () => {
  const items = [
    { name: 'a', img: solid('#ff0000', 10) },
    { name: 'b', img: solid('#00ff00', 20) },
    { name: 'c', img: solid('#0000ff', 7) },
  ];
  const { atlas, json } = packAtlas(items, { maxWidth: 64 });

  it('places every frame without overlap, extruding one pixel of edge color around it', () => {
    const rects = Object.values(json.frames).map((f) => f.frame);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlap = a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
      expect(overlap).toBe(false);
    }
    const f = json.frames.a.frame;
    expect(rgbAt(atlas, f.x - 1, f.y - 1)).toEqual([255, 0, 0]); // extruded corner
    expect(rgbAt(atlas, f.x + f.w, f.y + 3)).toEqual([255, 0, 0]);
    expect(rgbAt(atlas, f.x + 2, f.y + 2)).toEqual([255, 0, 0]);
  });

  it('extrude() copies edge pixels', () => {
    const e = extrude(solid('#123456', 2), 1);
    expect(e.w).toBe(4);
    expect(rgbAt(e, 0, 0)).toEqual(hexToRgb('#123456'));
  });
});

describe('sprite helpers', () => {
  it('splitTree cuts canopy above and trunk below', () => {
    const img = solid('#00ff00', 8);
    const { canopy, trunk } = splitTree(img, 5);
    expect(canopy.h).toBe(5);
    expect(trunk.h).toBe(3);
  });

  it('swayFrames returns 3 frames padded by 1px and leans only the top', () => {
    const c = solid('#00ff00', 8);
    const [rest, right, left] = swayFrames(c, 1);
    expect(rest.w).toBe(10);
    // top row: at rest x 1..8 opaque; right-lean shifts by +1, left-lean by -1; bottom row never moves
    expect(alphaAt(rest, 0, 0)).toBe(0);
    expect(alphaAt(right, 9, 0)).toBe(255);
    expect(alphaAt(left, 0, 0)).toBe(255);
    for (const f of [rest, right, left]) expect([alphaAt(f, 0, 7), alphaAt(f, 1, 7), alphaAt(f, 8, 7), alphaAt(f, 9, 7)]).toEqual([0, 255, 255, 0]);
  });

  it('castShadow projects the silhouette down-right and starts at the base line', () => {
    const pole = blank(3, 20);
    for (let y = 0; y < 20; y++) setPx(pole, 1, y, hexPx('#ffffff'));
    const { img, ax, ay } = castShadow(pole, 19, 1, 0.5, 0.25);
    expect(ay).toBe(1);
    expect(ax).toBe(1);
    // the shadow reaches further right the higher the object is, and never above the base line
    let maxX = 0;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (alphaAt(img, x, y) > 0) { maxX = Math.max(maxX, x); expect(y).toBeGreaterThanOrEqual(1); }
    expect(maxX).toBeGreaterThan(6);
  });

  it('isolate keeps one connected component', () => {
    const img = blank(10, 4);
    for (let x = 0; x < 3; x++) setPx(img, x, 1, hexPx('#ffffff'));
    for (let x = 6; x < 9; x++) setPx(img, x, 1, hexPx('#ff0000'));
    const only = isolate(img, 1, 1, 1);
    expect(alphaAt(only, 1, 1)).toBe(255);
    expect(alphaAt(only, 7, 1)).toBe(0);
    expect(crop(only, 0, 0, 3, 3).w).toBe(3);
  });
});
