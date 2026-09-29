import { describe, expect, it } from 'vitest';
import { feira } from '../../../apps/client/assets-src/custom/feira.mjs';

describe('art2 feira stalls', async () => {
  const parts = await feira();
  const byKey = Object.fromEntries(parts.map((p) => [p.key, p]));
  it('has four stalls, each open + closed, with an overhead tarp part and 3x2 footprint', () => {
    for (const k of ['frutas', 'verduras', 'pastel', 'flores']) {
      for (const v of [k, `${k}_fechada`]) {
        expect(byKey[`feira/${v}`].meta.footprint).toEqual([3, 2]);
        expect(byKey[`feira/${v}`].img.w).toBe(48);
      }
      expect(byKey[`feira/${k}`].meta.overhead).toBe(`feira/${k}_tarp`);
      expect(byKey[`feira/${k}_fechada`].meta.overhead).toBe(`feira/${k}_roll`);
      expect(byKey[`feira/${k}_tarp`].meta.overhead).toBe(true);
    }
  });
  it('has crates (1x1) and blank price tags', () => {
    expect(byKey['feira/caixotes'].meta.footprint).toEqual([1, 1]);
    expect(Object.keys(byKey).filter((k) => k.startsWith('feira/preco_'))).toHaveLength(3);
  });
  it('is crisp: no half-transparent pixels', () => {
    for (const p of parts) for (let i = 3; i < p.img.data.length; i += 4) expect(p.img.data[i] === 0 || p.img.data[i] === 255).toBe(true);
  });
});
