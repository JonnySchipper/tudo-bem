import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FURNITURE, ROOMS } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { FLOOR_SUBSTITUTE, WALL_STYLE, allNorthDecor, decorArt, northWallKey, westWallKey } from './roomLayout';
import { furnitureArtKey, propArtKey, propSlices } from './props';

// The generated manifest (`pnpm pixel`) is committed, so the art coverage of every room can be checked without a browser.
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;

describe('art track 3 coverage (manifest vs rooms and catalog)', () => {
  it('every floor char of every room has terrain art (no calçada fallbacks)', () => {
    for (const r of Object.values(ROOMS)) for (const ch of new Set(r.floor.join(''))) expect(manifest.terrain.layers[ch] ?? manifest.terrain.layers[FLOOR_SUBSTITUTE[ch]], `${r.id} floor '${ch}'`).toBeTruthy();
    for (const ch of ['t', 'l', 'm', 'k', 'j']) expect(manifest.terrain.layers[ch]?.edge, ch).toBe('flush');
  });

  it('every room has its wall tiles, door art and every north decor sprite', () => {
    for (const r of Object.values(ROOMS)) {
      const s = WALL_STYLE[r.id];
      for (const part of ['l', 'm', 'r'] as const) expect(has(northWallKey(s, part)), `${r.id} north ${part}`).toBe(true);
      expect(has(westWallKey(s, false)) && has(westWallKey(s, true)), `${r.id} west`).toBe(true);
      for (const d of allNorthDecor(r)) {
        const art = decorArt(d);
        if (art) expect(has(art.key), `${r.id} ${d.kind} -> ${art.key}`).toBe(true);
      }
    }
    for (const k of ['doors/north', 'doors/west', 'props/doormat']) expect(has(k), k).toBe(true);
  });

  it('every prop of every room resolves to art (slices for the counter and the bleachers)', () => {
    for (const r of Object.values(ROOMS)) {
      for (const p of r.props) {
        const keys = propSlices(p)?.map((s) => s.key) ?? [propArtKey(p)];
        for (const k of keys) expect(k && has(k), `${r.id}/${p.id} (${p.kind}) -> ${k}`).toBe(true);
      }
    }
  });

  it('every catalog furniture item has both rotations, and the animated ones have frames', () => {
    for (const f of FURNITURE) for (const rot of [0, 1] as const) expect(has(furnitureArtKey(f.id, rot)), `${f.id} rot ${rot}`).toBe(true);
    for (const id of ['ventilador', 'gato']) expect(manifest.sprites[furnitureArtKey(id, 0)].anim?.frames.length, id).toBeGreaterThan(1);
    expect(manifest.sprites['props/trilho_pedidos'].anim?.frames.length).toBe(2);
    expect(manifest.sprites['props/estufa'].lit).toBe('props/estufa_lit');
  });

  it('interiors stay light: all art still fits one atlas under 8 MB total', () => {
    const a = manifest.atlases.outdoor;
    expect(a.w * a.h * 4).toBeLessThan(8 * 1024 * 1024);
  });
});
