import { describe, expect, it } from 'vitest';
import { portraitParts, EXPRESSIONS, NPCS, scale3x } from '../../../apps/client/assets-src/custom/portraits.mjs';
import { charLayers, npcSheet, sheetFrame } from '../../../apps/client/assets-src/custom/lookkit.mjs';

const diff = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  return n;
};

describe('art2 portraits', async () => {
  const parts = await portraitParts();
  const by = Object.fromEntries(parts.map((p) => [p.key, p.img]));

  it('has 4 expressions for each NPC, all 64x64', () => {
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

  it('every portrait sits in the same frame', () => {
    const ring = (img) => {
      const out = [];
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (x < 2 || y < 2 || x > 61 || y > 61) out.push(img.data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4).join(','));
      return out.join(';');
    };
    const first = ring(parts[0].img);
    for (const p of parts) expect(ring(p.img), p.key).toBe(first);
  });

  it('keeps a small palette (indexed-PNG sized)', () => {
    for (const p of parts) {
      const colours = new Set();
      for (let i = 0; i < p.img.data.length; i += 4) colours.add(`${p.img.data[i]},${p.img.data[i + 1]},${p.img.data[i + 2]},${p.img.data[i + 3]}`);
      expect(colours.size, p.key).toBeLessThanOrEqual(96);
    }
  });

  it('says where the face is (the small cards crop to it), inside the bust', () => {
    for (const p of parts) {
      const [x, y] = p.meta?.face ?? [];
      expect(x, p.key).toBeGreaterThanOrEqual(24);
      expect(x, p.key).toBeLessThanOrEqual(40);
      expect(y, p.key).toBeGreaterThanOrEqual(24);
      expect(y, p.key).toBeLessThanOrEqual(54);
    }
  });

  it('Scale3x copies source pixels only (no blended colours) at exactly 3x', () => {
    const src = { w: 3, h: 3, data: new Uint8Array(36) };
    const pal = [[58, 58, 80, 255], [240, 236, 246, 255], [0, 0, 0, 0]];
    [0, 1, 2, 1, 0, 1, 2, 1, 0].forEach((c, i) => src.data.set(pal[c], i * 4));
    const { img } = scale3x(src);
    expect([img.w, img.h]).toEqual([9, 9]);
    const allowed = new Set(pal.map((p) => p.join(',')));
    for (let i = 0; i < img.data.length; i += 4) expect(allowed.has([...img.data.slice(i, i + 4)].join(','))).toBe(true);
  });

  it('a portrait is a close-up of the sprite: the head of the world sprite is drawn in the same colours', async () => {
    const layers = await charLayers();
    for (const npc of NPCS) {
      const f = sheetFrame(await npcSheet(npc, layers), 0, 0);
      const spriteHead = new Set();
      for (let y = 0; y < 20; y++) for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (f.data[i + 3] === 255) spriteHead.add(`${f.data[i]},${f.data[i + 1]},${f.data[i + 2]}`);
      }
      const img = by[`portraits/${npc}_neutro`];
      const portrait = new Set();
      for (let i = 0; i < img.data.length; i += 4) portrait.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`);
      const shared = [...spriteHead].filter((c) => portrait.has(c)).length;
      // hat, hair, skin and outline colours carry over; only the face marks (eyes, brows) are redrawn
      expect(shared / spriteHead.size, npc).toBeGreaterThan(0.6);
    }
  });

  it('feira vendor portraits are not Carlos or Graça stand-ins', () => {
    for (const e of EXPRESSIONS) {
      expect(diff(by[`portraits/ze_${e}`], by[`portraits/carlos_${e}`]), `ze vs carlos ${e}`).toBeGreaterThan(120);
      expect(diff(by[`portraits/chico_${e}`], by[`portraits/carlos_${e}`]), `chico vs carlos ${e}`).toBeGreaterThan(120);
      expect(diff(by[`portraits/rosa_${e}`], by[`portraits/graca_${e}`]), `rosa vs graca ${e}`).toBeGreaterThan(120);
    }
  });
});
