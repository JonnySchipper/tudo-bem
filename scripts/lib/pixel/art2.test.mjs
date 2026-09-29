import { describe, expect, it } from 'vitest';
import { portraitParts, EXPRESSIONS, NPCS } from '../../../apps/client/assets-src/custom/portraits.mjs';

const diff = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  return n;
};

describe('art2 portraits', async () => {
  const parts = await portraitParts();
  const by = Object.fromEntries(parts.map((p) => [p.key, p.img]));

  it('has 4 expressions for each of the 5 NPCs, all 64x64', () => {
    expect(parts).toHaveLength(NPCS.length * EXPRESSIONS.length);
    for (const npc of NPCS) for (const e of EXPRESSIONS) {
      const img = by[`portraits/${npc}_${e}`];
      expect(img, `${npc}_${e}`).toBeTruthy();
      expect([img.w, img.h]).toEqual([64, 64]);
    }
  });

  it('uses hard pixels only (no half-transparent pixels)', () => {
    for (const p of parts) for (let i = 3; i < p.img.data.length; i += 4) expect(p.img.data[i] === 0 || p.img.data[i] === 255).toBe(true);
  });

  it('expressions of one NPC are clearly different (eyes, brows, mouth change at least 30 px)', () => {
    for (const npc of NPCS) for (let i = 0; i < EXPRESSIONS.length; i++) for (let j = i + 1; j < EXPRESSIONS.length; j++) {
      expect(diff(by[`portraits/${npc}_${EXPRESSIONS[i]}`], by[`portraits/${npc}_${EXPRESSIONS[j]}`]), `${npc} ${EXPRESSIONS[i]} vs ${EXPRESSIONS[j]}`).toBeGreaterThan(30);
    }
  });

  it('is deterministic', async () => {
    const again = await portraitParts();
    expect(again.every((p, i) => diff(p.img, parts[i].img) === 0)).toBe(true);
  });
});
