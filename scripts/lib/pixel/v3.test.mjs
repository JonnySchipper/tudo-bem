import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fundos } from '../../../apps/client/assets-src/custom/fundos.mjs';
import { tatame as floorTatame } from '../../../apps/client/assets-src/custom/floors.mjs';

// Visual pass V3: rear facades of the south row, the framed interiors, the EVA-mat academia.
const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../apps/client/public/pixel/manifest.json'), 'utf8'));
const rooms = fs.readFileSync(path.resolve(import.meta.dirname, '../../../packages/shared/src/rooms.ts'), 'utf8');

const hashOf = (img) => {
  let h = 0;
  for (let i = 0; i < img.data.length; i++) h = (Math.imul(h, 31) + img.data[i]) >>> 0;
  return h;
};

describe('fundos (south row, rear facades)', () => {
  it('nine different facades with a lit overlay each, 4 tiles tall, 6 or 7 wide', async () => {
    const parts = await fundos();
    const bodies = parts.filter((p) => !p.key.endsWith('_lit'));
    expect(bodies).toHaveLength(9);
    for (const p of bodies) {
      expect(p.img.h).toBe(64);
      expect([96, 112]).toContain(p.img.w);
    }
    expect(new Set(bodies.map((p) => hashOf(p.img))).size).toBe(9);
  });

  it('are in the manifest (the art is kept; the south row left the map when Vila Ipê was split into areas, so rooms.ts no longer places them)', () => {
    for (let i = 1; i <= 9; i++) expect(manifest.sprites[`fundos/f${i}`], `f${i}`).toBeTruthy();
    expect(rooms).not.toContain("front('telhado_1'");
  });
});

describe('interior shell', () => {
  it('has east and south walls and the night sidewalk for every interior style', () => {
    for (const s of ['padaria', 'kitnet', 'academia']) {
      for (const k of [`walls/east_${s}`, `walls/east_${s}_b`, `walls/south_${s}_w`, `walls/south_${s}_m`, `walls/south_${s}_e`]) expect(manifest.sprites[k], k).toBeTruthy();
    }
    expect(manifest.sprites['walls/exterior']).toBeTruthy();
  });

  it('the academia floor is one material (all mats) and the tatame floor tiles are 16 opaque tiles', () => {
    const academia = rooms.slice(rooms.indexOf('const academia: RoomDef'));
    const block = academia.slice(academia.indexOf('floor: ['), academia.indexOf('wallHeight'));
    expect(block.replace(/[^a-z]/g, '').replace(/floor/, '')).toMatch(/^j+$/);
    const tiles = floorTatame();
    expect(tiles).toHaveLength(16);
    for (const t of tiles) for (let i = 3; i < t.data.length; i += 4) expect(t.data[i]).toBe(255);
  });
});
