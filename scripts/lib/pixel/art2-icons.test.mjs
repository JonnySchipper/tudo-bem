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
