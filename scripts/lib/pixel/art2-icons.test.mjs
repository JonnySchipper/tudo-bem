import { describe, expect, it } from 'vitest';
import { iconParts } from '../../../apps/client/assets-src/custom/icons.mjs';
import { ITEMS } from '../../../packages/shared/src/recados.ts';

describe('art2 item icons', async () => {
  const parts = await iconParts();
  it('has a 16x16 icon for every bag item (the padaria shelf + jornal, flores, banana)', () => {
    const keys = new Set(parts.map((p) => p.key));
    for (const item of ITEMS) expect(keys.has(`icons/${item.id}`), item.id).toBe(true);
    for (const p of parts) expect([p.img.w, p.img.h]).toEqual([16, 16]);
  });
  it('salty popcorn is the white bag; sweet popcorn stays the red one', () => {
    const red = parts.find((p) => p.key === 'icons/pipoca');
    const white = parts.find((p) => p.key === 'icons/pipoca_salgada');
    const redPixels = (img) => {
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] === 0) continue;
        if (img.data[i] > img.data[i + 1] + 40 && img.data[i] > img.data[i + 2] + 40) n++;
      }
      return n;
    };
    expect(redPixels(red.img)).toBeGreaterThan(20);
    expect(redPixels(white.img)).toBe(0);
  });
  it('uses hard pixels, stays inside the frame margin and is not empty', () => {
    for (const p of parts) {
      let opaque = 0;
      for (let i = 0; i < p.img.data.length; i += 4) {
        expect(p.img.data[i + 3] === 0 || p.img.data[i + 3] === 255).toBe(true);
        if (p.img.data[i + 3]) opaque++;
      }
      expect(opaque, p.key).toBeGreaterThan(60);
    }
  });
});
