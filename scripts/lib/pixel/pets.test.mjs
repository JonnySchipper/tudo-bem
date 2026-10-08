import { describe, expect, it } from 'vitest';
import { PET_ANIMS, PET_H, PET_W, petStrips } from '../../../apps/client/assets-src/custom/pets.mjs';
import { bubble, bubbleSkins } from '../../../apps/client/assets-src/custom/ui.mjs';

function opaque(img, x, y) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return false;
  return img.data[(y * img.w + x) * 4 + 3] > 0;
}

function components(img) {
  const seen = new Uint8Array(img.w * img.h);
  let n = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = y * img.w + x;
    if (seen[i] || !opaque(img, x, y)) continue;
    n++;
    const q = [[x, y]];
    seen[i] = 1;
    while (q.length) {
      const [cx, cy] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const j = ny * img.w + nx;
        if (!opaque(img, nx, ny) || seen[j]) continue;
        seen[j] = 1;
        q.push([nx, ny]);
      }
    }
  }
  return n;
}

/** A frame's outside edge should be the pack navy, not a coat colour meeting empty space. */
function edgeIsNavy(img) {
  const navy = [0x3a, 0x3a, 0x50];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!opaque(img, x, y)) continue;
    const touchesEmpty = !opaque(img, x - 1, y) || !opaque(img, x + 1, y) || !opaque(img, x, y - 1) || !opaque(img, x, y + 1);
    if (!touchesEmpty) continue;
    const i = (y * img.w + x) * 4;
    if (img.data[i] !== navy[0] || img.data[i + 1] !== navy[1] || img.data[i + 2] !== navy[2]) return false;
  }
  return true;
}

describe('subscriber pets', async () => {
  const parts = await petStrips();
  const by = Object.fromEntries(parts.map((p) => [p.key, p]));

  it('ships a dog and a cat strip with walk, front idle and sit', () => {
    for (const key of ['chars/pet_dog', 'chars/pet_cat']) {
      const { img, meta } = by[key];
      expect(meta.anims).toEqual(PET_ANIMS);
      expect(meta.frameW).toBe(PET_W);
      expect(img.h).toBe(PET_H);
      expect(img.w).toBe(PET_W * 17);
      expect(img.h).toBeGreaterThan(16);
    }
  });

  it('each frame is one animal with a solid navy outline (the head is not a floating piece)', () => {
    for (const key of ['chars/pet_dog', 'chars/pet_cat']) {
      const img = by[key].img;
      for (let f = 0; f < 17; f++) {
        const frame = { w: PET_W, h: PET_H, data: new Uint8Array(PET_W * PET_H * 4) };
        for (let y = 0; y < PET_H; y++) {
          const src = (y * img.w + f * PET_W) * 4;
          frame.data.set(img.data.subarray(src, src + PET_W * 4), y * PET_W * 4);
        }
        expect(components(frame), `${key} frame ${f}`).toBe(1);
        expect(edgeIsNavy(frame), `${key} frame ${f} outline`).toBe(true);
      }
    }
  });
});

describe('subscriber bubble skins', async () => {
  const classic = bubble();
  const skins = await bubbleSkins();

  it('keeps the classic tail and 9-slice, and only recolors the trim', () => {
    expect(skins.map((s) => s.key).sort()).toEqual(['ui/bubble_festa', 'ui/bubble_mar', 'ui/bubble_mata', 'ui/bubble_sol']);
    for (const skin of skins) {
      expect(skin.meta.slice).toEqual({ top: 7, right: 7, bottom: 13, left: 16 });
      expect(skin.img.w).toBe(classic.w);
      expect(skin.img.h).toBe(classic.h);
      let differ = 0;
      for (let i = 0; i < classic.data.length; i += 4) {
        expect(skin.img.data[i + 3]).toBe(classic.data[i + 3]);
        const same = skin.img.data[i] === classic.data[i] && skin.img.data[i + 1] === classic.data[i + 1] && skin.img.data[i + 2] === classic.data[i + 2];
        if (!same) differ++;
      }
      expect(differ).toBeGreaterThan(20);
    }
  });
});
