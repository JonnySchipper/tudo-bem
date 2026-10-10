import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PET_ANIMS, PET_H, PET_W, petStrips } from '../../../apps/client/assets-src/custom/pets.mjs';
import { PET_STRIPS } from '../../../apps/client/assets-src/custom/petshapes.mjs';
import { PET_KEY_RAMPS } from '../../../apps/client/src/render/pixel/palette.ts';
import { petStripKeys } from '../../../packages/shared/src/petBreeds.ts';
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

  it('ships a dog and a cat strip with walk, front idle, sit and lie', () => {
    const frames = Math.max(...Object.values(PET_ANIMS).flat()) + 1;
    expect(frames).toBe(20);
    expect(PET_ANIMS.lieE).toEqual([17, 17]);
    expect(PET_ANIMS.lieS).toEqual([18, 18]);
    expect(PET_ANIMS.lieN).toEqual([19, 19]);
    for (const key of ['chars/pet_dog', 'chars/pet_cat']) {
      const { img, meta } = by[key];
      expect(meta.anims).toEqual(PET_ANIMS);
      expect(meta.frames).toBe(frames);
      expect(meta.frameW).toBe(PET_W);
      expect(img.h).toBe(PET_H);
      expect(img.w).toBe(PET_W * frames);
      expect(img.h).toBeGreaterThan(16);
    }
  });

  it('a lie-down sits lower than a sit, and it is not a copy of the sit frame', () => {
    const slice = (img, f) => {
      const frame = { w: PET_W, h: PET_H, data: new Uint8Array(PET_W * PET_H * 4) };
      for (let y = 0; y < PET_H; y++) {
        const src = (y * img.w + f * PET_W) * 4;
        frame.data.set(img.data.subarray(src, src + PET_W * 4), y * PET_W * 4);
      }
      return frame;
    };
    const centroidY = (frame) => {
      let s = 0;
      let n = 0;
      for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
        if (frame.data[(y * frame.w + x) * 4 + 3] === 0) continue;
        s += y;
        n++;
      }
      return s / n;
    };
    for (const key of ['chars/pet_dog', 'chars/pet_cat']) {
      const img = by[key].img;
      for (const [lie, sit] of [[17, 14], [18, 15], [19, 16]]) {
        const a = slice(img, lie);
        const b = slice(img, sit);
        let differ = 0;
        for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differ++;
        expect(differ, `${key} lie ${lie} vs sit ${sit}`).toBeGreaterThan(20);
        expect(centroidY(a), `${key} lie ${lie} is lower`).toBeGreaterThan(centroidY(b));
      }
    }
  });

  it('each frame is one animal with a solid navy outline (the head is not a floating piece)', () => {
    const frames = Math.max(...Object.values(PET_ANIMS).flat()) + 1;
    for (const key of ['chars/pet_dog', 'chars/pet_cat']) {
      const img = by[key].img;
      for (let f = 0; f < frames; f++) {
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

describe('pet shop breed strips (shape × pattern × key colour)', async () => {
  const parts = await petStrips();
  const keyed = parts.filter((p) => p.meta.keyed);
  const keys = new Set(Object.values(PET_KEY_RAMPS).flat());
  const FIXED = new Set(['#3a3a50', '#2a2233', '#46465e', '#ffffff', '#f4b4c4', '#e07070', '#d56868']);
  const hexAt = (img, i) => '#' + [0, 1, 2].map((c) => img.data[i + c].toString(16).padStart(2, '0')).join('');
  const frameOf = (img, f) => {
    const frame = { w: PET_W, h: PET_H, data: new Uint8Array(PET_W * PET_H * 4) };
    for (let y = 0; y < PET_H; y++) frame.data.set(img.data.subarray((y * img.w + f * PET_W) * 4, (y * img.w + f * PET_W + PET_W) * 4), y * PET_W * 4);
    return frame;
  };

  it('bakes exactly the strips the catalog uses, every key in the manifest', () => {
    expect(keyed.map((p) => p.key).sort()).toEqual(petStripKeys().sort());
    expect(keyed.length).toBe(PET_STRIPS.length);
    const manifest = JSON.parse(fs.readFileSync(new URL('../../../apps/client/public/pixel/manifest.json', import.meta.url), 'utf8'));
    for (const k of petStripKeys()) expect(manifest.images[k] ?? manifest.chars[k], k).toBeTruthy();
  });

  it('paints only key colours and the fixed eyes, nose, inner ears and outline', () => {
    for (const p of keyed) {
      expect([p.img.w, p.img.h]).toEqual([PET_W * 20, PET_H]);
      for (let i = 0; i < p.img.data.length; i += 4) {
        if (!p.img.data[i + 3]) continue;
        expect(p.img.data[i + 3], p.key).toBe(255);
        const hex = hexAt(p.img, i);
        expect(keys.has(hex) || FIXED.has(hex), `${p.key} ${hex}`).toBe(true);
      }
    }
  });

  it('a marked pattern paints coat2 and a solid one never does; every strip has the collar', () => {
    for (const p of keyed) {
      const used = new Set();
      for (let i = 0; i < p.img.data.length; i += 4) if (p.img.data[i + 3]) used.add(hexAt(p.img, i));
      const has2 = PET_KEY_RAMPS.coat2.some((k) => used.has(k));
      if (p.key.endsWith('_solido')) expect(has2, p.key).toBe(false);
      else expect(has2, p.key).toBe(true);
      expect(PET_KEY_RAMPS.collar.some((k) => used.has(k)), p.key).toBe(true);
    }
  });

  it('every frame is one animal with a navy outline', () => {
    for (const p of keyed) {
      for (let f = 0; f < 20; f++) {
        const frame = frameOf(p.img, f);
        expect(components(frame), `${p.key} frame ${f}`).toBe(1);
        expect(edgeIsNavy(frame), `${p.key} frame ${f} outline`).toBe(true);
      }
    }
  });

  it('the shapes differ: a salsicha is lower than a grande, a peludo dog is not a medio', () => {
    const height = (key) => {
      const img = frameOf(parts.find((p) => p.key === key).img, 0);
      for (let y = 0; y < PET_H; y++) for (let x = 0; x < PET_W; x++) if (img.data[(y * PET_W + x) * 4 + 3]) return PET_H - y;
      return 0;
    };
    expect(height('chars/pet_dog_salsicha_sela')).toBeLessThan(height('chars/pet_dog_grande_solido'));
    const a = parts.find((p) => p.key === 'chars/pet_dog_medio_peito').img, b = parts.find((p) => p.key === 'chars/pet_dog_peludo_solido').img;
    let alphaDiff = 0;
    for (let i = 3; i < a.data.length; i += 4) if (!!a.data[i] !== !!b.data[i]) alphaDiff++;
    expect(alphaDiff).toBeGreaterThan(200);
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

  it('keeps a dark outline all the way round, so the edge reads on a sunny street and at night', () => {
    const lum = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    // the classic outline is the warm ink (#573c2c); every skin pixel there must stay as dark
    const ink = [0x57, 0x3c, 0x2c];
    for (const skin of skins) {
      for (let i = 0; i < classic.data.length; i += 4) {
        if (!classic.data[i + 3] || classic.data[i] !== ink[0] || classic.data[i + 1] !== ink[1] || classic.data[i + 2] !== ink[2]) continue;
        expect(lum(skin.img.data, i), skin.key).toBeLessThan(0.3);
      }
    }
  });

  it('never repaints the paper under the words', () => {
    const cx = Math.floor(classic.w / 2);
    const cy = 10;
    const i = (cy * classic.w + cx) * 4;
    for (const skin of skins) expect([...skin.img.data.slice(i, i + 4)]).toEqual([...classic.data.slice(i, i + 4)]);
  });
});
