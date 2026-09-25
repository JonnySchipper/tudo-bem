import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FURNITURE, HATS, MG_ITEMS, ROOMS, propTiles } from '@tudobem/shared';
import { furnitureKey, propKey, type ArtManifest } from './sprites';

const artDir = path.resolve(__dirname, '../../public/art');
const manifest = JSON.parse(fs.readFileSync(path.join(artDir, 'manifest.json'), 'utf8')) as ArtManifest;

function expectSprite(key: string) {
  const meta = manifest.sprites[key];
  expect(meta, `${key} missing from manifest — run pnpm art`).toBeTruthy();
  expect(fs.existsSync(path.join(artDir, meta.file)), `${meta.file} missing`).toBe(true);
  expect(meta.w).toBeGreaterThan(0);
  expect(meta.h).toBeGreaterThan(0);
}

describe('baked art manifest', () => {
  it('covers every static room prop the renderer asks for', () => {
    for (const room of Object.values(ROOMS))
      for (const p of room.props)
        propTiles(p).forEach((_, i) => {
          if (i > 0 && p.kind !== 'balcao') return;
          const key = propKey(p, i);
          if (key) expectSprite(key);
        });
  });

  it('covers static furniture in both rotations, hats and food icons', () => {
    for (const f of FURNITURE)
      for (const rot of [0, 1] as const) {
        const key = furnitureKey(f.id, rot);
        if (key) expectSprite(key);
      }
    for (const h of HATS) expectSprite(`hats/${h.id}`);
    for (const i of MG_ITEMS) expectSprite(`food/${i.id}`);
  });

  it('ships the generated UI chrome as SVG files', () => {
    for (const f of ['coin_rv', 'logo_mark', 'pattern_azulejo', 'pattern_calcada', 'icon_map']) expect(fs.existsSync(path.join(artDir, 'ui', `${f}.svg`))).toBe(true);
  });
});
