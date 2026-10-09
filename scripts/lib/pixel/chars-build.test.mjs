import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildChars, TOPS, BOTTOMS, HAIR_BASE } from '../../../apps/client/assets-src/custom/chars.mjs';
import { CANON_COLS, CANON_ROWS, FRAME_H, FRAME_W, ROW_FRAMES } from './chars.mjs';
import { OUTLINES, alphaAt, anchors, frames, hexAt } from './charedit.mjs';
import { KEY_RAMPS } from '../../../apps/client/src/render/pixel/palette.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = path.join(ROOT, 'apps/client/assets-src/limezu-modern-interiors/2_Characters/Character_Generator');

let out;
beforeAll(async () => {
  out = await buildChars({ base });
}, 60_000);

/** distinct opaque colors of a layer that are neither an outline nor in `allowed` */
function strays(img, allowed) {
  const ok = new Set([...OUTLINES, ...allowed]);
  const bad = new Set();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (alphaAt(img, x, y) && !ok.has(hexAt(img, x, y))) bad.add(hexAt(img, x, y));
  return [...bad];
}
const keys = (...ramps) => ramps.flatMap((r) => KEY_RAMPS[r]);

describe('character layer build (import)', () => {
  it('every layer is a canonical 8x18 sheet', () => {
    for (const [k, img] of Object.entries(out.layers)) {
      expect(img.w, k).toBe(CANON_COLS * FRAME_W);
      expect(img.h, k).toBe(CANON_ROWS * FRAME_H);
    }
  });

  it('outfits are fully key-colored (top / bottom / shoes; the blouse neckline shows skin) for all 15 combinations at all 3 body types', () => {
    for (const t of TOPS) for (const b of BOTTOMS) for (const sfx of ['', '__esguio', '__forte']) {
      const img = out.layers[`outfit_${t}_${b}${sfx}`];
      expect(img, `${t}/${b}${sfx}`).toBeTruthy();
      expect(strays(img, keys('top', 'bottom', 'shoes', ...(t === 'blusa' ? ['skin'] : []))), `${t}/${b}${sfx}`).toEqual([]);
    }
  });

  it('the 15 outfits are all different sheets', () => {
    const sig = new Set();
    for (const t of TOPS) for (const b of BOTTOMS) sig.add(Buffer.from(out.layers[`outfit_${t}_${b}`].data).toString('base64'));
    expect(sig.size).toBe(15);
  });

  it('every hair style is hair-keyed (plus the translucent glint), and the 9 styles are all different', () => {
    const sig = new Set();
    for (const style of Object.keys(HAIR_BASE)) {
      const img = out.layers[`hair_${style}`];
      expect(strays(img, [...keys('hair'), '#000000', '#fff6e6']), style).toEqual([]);
      sig.add(Buffer.from(img.data).toString('base64'));
    }
    expect(sig.size).toBe(Object.keys(HAIR_BASE).length);
  });

  it('all 12 catalog hats exist and only use hat / accent keys (plus outlines and the flower crown greens and yellows)', () => {
    const ids = ['bone_verde', 'chapeu_palha', 'gorro_listrado', 'viseira_azul', 'boina_vermelha', 'chapeu_sol', 'bucket_amarelo', 'capacete_bike', 'panama', 'coroa_flores', 'chapeu_chef', 'cartola'];
    for (const id of ids) {
      const img = out.layers['hat_' + id];
      expect(img, id).toBeTruthy();
      let n = 0;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (alphaAt(img, x, y)) n++;
      expect(n, `${id} has pixels`).toBeGreaterThan(200);
      expect(strays(img, [...keys('hat', 'accent'), '#3d8a4e', '#5cb85c', '#f2b22b', '#fff59a', '#000000', '#989ebe', '#8b8bab', '#565972', '#6c6e85', '#9d9dc3']), id).toEqual([]);
    }
  });

  it('a hat follows the head: its lowest-row anchor moves with the body bob and the bow', () => {
    const an = anchors(out.layers.body_medio);
    const hat = out.layers.hat_cartola;
    const topOf = (r, c) => {
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (alphaAt(hat, c * FRAME_W + x, r * FRAME_H + y)) return y;
      return -1;
    };
    for (const { r, c } of frames()) {
      const a = an.get(r * CANON_COLS + c);
      if (!a || r < 12) continue;
      if (r === 17) continue; // the phone row has no hat art gap to check
      const ref = an.get(0);
      expect(topOf(r, c) - a.top, `row ${r} col ${c}`).toBe(topOf(0, 0) - ref.top);
    }
  });

  it('body types are visibly different: esguio drops columns, forte adds them', () => {
    const count = (img) => {
      let n = 0;
      for (const { r, c } of frames()) for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (alphaAt(img, c * FRAME_W + x, r * FRAME_H + y)) n++;
      return n;
    };
    const m = count(out.layers.body_medio);
    expect(count(out.layers.body_medio__esguio)).toBeLessThan(m);
    expect(count(out.layers.body_medio__forte)).toBeGreaterThan(m);
  });

  it('emote gestures only touch the emote rows', () => {
    const g = out.layers.emote_gestures;
    for (const { r, c } of frames()) {
      if (r >= 12 && r <= 15) continue;
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) expect(alphaAt(g, c * FRAME_W + x, r * FRAME_H + y)).toBe(0);
    }
  });

  it('idle-pose props only touch the idle rows', () => {
    for (const k of ['pose_cafe', 'pose_bolsa', 'pose_bracos']) {
      const g = out.layers[k];
      for (const { r, c } of frames()) if (r > 3) for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) expect(alphaAt(g, c * FRAME_W + x, r * FRAME_H + y), `${k} row ${r}`).toBe(0);
    }
  });

  it('frame counts of the canonical rows are what the manifest documents', () => {
    expect(ROW_FRAMES[0]).toBe(6);
    expect(ROW_FRAMES[12]).toBe(6);
    expect(ROW_FRAMES[16]).toBe(8);
    expect(ROW_FRAMES[17]).toBe(6);
  });
});
