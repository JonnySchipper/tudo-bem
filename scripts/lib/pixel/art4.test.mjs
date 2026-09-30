import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { telhados, preview } from '../../../apps/client/assets-src/custom/telhados.mjs';
import { skyline } from '../../../apps/client/assets-src/custom/backdrop.mjs';
import { portraitParts } from '../../../apps/client/assets-src/custom/portraits.mjs';

// Art track 4: the rebuilt rooftops, the sky backdrop and Professora Bia's portraits.
const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../apps/client/public/pixel/manifest.json'), 'utf8'));

const hashOf = (img) => {
  let h = 0;
  for (let i = 0; i < img.data.length; i++) h = (Math.imul(h, 31) + img.data[i]) >>> 0;
  return h;
};

describe('rooftops across Rua Jacarandá', () => {
  it('nine different roofs, 4 tiles tall, 6 or 7 wide, no two alike', async () => {
    const parts = await telhados();
    expect(parts).toHaveLength(9);
    for (const p of parts) {
      expect(p.img.h).toBe(64);
      expect([96, 112]).toContain(p.img.w);
    }
    expect(new Set(parts.map((p) => hashOf(p.img))).size).toBe(9);
    expect((await preview()).length).toBe(9);
  });

  it('are in the manifest at the widths rooms.ts lays them out with', () => {
    for (let i = 1; i <= 9; i++) expect(manifest.sprites[`telhados/r${i}`], `r${i}`).toBeTruthy();
    expect(manifest.sprites['telhados/terraco_a']).toBeUndefined();
  });
});

describe('sky backdrop', () => {
  it('four 224 x 32 chunks that are fully opaque (the margin above the north row has no holes) and differ', async () => {
    const parts = await skyline();
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect([p.img.w, p.img.h]).toEqual([224, 32]);
      for (let i = 3; i < p.img.data.length; i += 4) expect(p.img.data[i]).toBe(255);
    }
    expect(new Set(parts.map((p) => hashOf(p.img))).size).toBe(4);
  });
});

describe('Professora Bia portraits', () => {
  it('four 64 x 64 expressions that differ from each other', async () => {
    const parts = (await portraitParts()).filter((p) => p.key.startsWith('portraits/prof_'));
    expect(parts.map((p) => p.key).sort()).toEqual(['portraits/prof_feliz', 'portraits/prof_neutro', 'portraits/prof_pensativo', 'portraits/prof_surpreso']);
    for (const p of parts) expect([p.img.w, p.img.h]).toEqual([64, 64]);
    expect(new Set(parts.map((p) => hashOf(p.img))).size).toBe(4);
    for (const e of ['neutro', 'feliz', 'surpreso', 'pensativo']) expect(manifest.images[`portraits/prof_${e}`]).toBeTruthy();
  });

  it('the gi layer is in the character manifest for all three body types', () => {
    for (const k of ['npc_gi', 'npc_gi__esguio', 'npc_gi__forte']) expect(manifest.chars[k], k).toBeTruthy();
  });
});
