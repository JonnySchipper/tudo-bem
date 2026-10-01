import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMS, propTiles } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { T } from './coords';
import { sceneryFor, MOSAIC_TILES } from './scenery';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;
const vila = ROOMS.praca;
const sc = sceneryFor(vila, has)!;
const at = (x: number, y: number) => vila.floor[y]?.[x];

describe('V1 ground scenery', () => {
  it('has only two São Paulo mosaics, each on free paving, 4 x 3 tiles', () => {
    const m = sc.decals.filter((d) => d.key === 'decals/sp_mosaic');
    expect(m.length).toBeGreaterThanOrEqual(1);
    expect(m.length).toBeLessThanOrEqual(2);
    const busy = new Set<string>();
    for (const p of vila.props) for (const t of propTiles(p)) busy.add(`${t.x},${t.y}`);
    for (const d of m) {
      const x0 = d.x / T, y0 = d.y / T;
      expect(manifest.sprites['decals/sp_mosaic'].w).toBe(MOSAIC_TILES.w * T);
      expect(manifest.sprites['decals/sp_mosaic'].h).toBe(MOSAIC_TILES.h * T);
      for (let dy = 0; dy < MOSAIC_TILES.h; dy++) for (let dx = 0; dx < MOSAIC_TILES.w; dx++) {
        expect(at(x0 + dx, y0 + dy)).toBe('c');
        expect(busy.has(`${x0 + dx},${y0 + dy}`)).toBe(false);
      }
    }
  });

  it('the lawn dressing (patches, dirt, clover, tufts) lies on grass only', () => {
    const dressing = sc.decals.filter((d) => /grass_|dirt_|clover|gtuft/.test(d.key));
    // the amount follows the lawn area (V2 turned the feira lot to asphalt and filled the lawns with props): at least one piece per 14 grass tiles
    const grassTiles = vila.floor.reduce((n, row) => n + [...row].filter((c) => c === 'g').length, 0);
    expect(dressing.length).toBeGreaterThan(grassTiles / 14);
    for (const d of dressing) {
      const sd = manifest.sprites[d.key];
      const x0 = d.origin === 'tl' ? d.x : d.x - sd.ax, y0 = d.origin === 'tl' ? d.y : d.y - sd.ay;
      // the body of the sprite (its centre half) is on grass; a dithered rim may touch the curb
      const cx = x0 + sd.w / 2, cy = y0 + sd.h / 2;
      expect(at(Math.floor(cx / T), Math.floor(cy / T)), `${d.key} at ${cx},${cy}`).toBe('g');
    }
    // two or three soft patches in the big lawns: at least 2 light and 2 dark in the whole map
    expect(sc.decals.filter((d) => d.key.startsWith('decals/grass_light')).length).toBeGreaterThanOrEqual(2);
    expect(sc.decals.filter((d) => d.key.startsWith('decals/grass_dark')).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the bus bay free of lane dashes, and the bay itself is on the asphalt', () => {
    const bay = sc.decals.find((d) => d.key === 'decals/faixa_onibus')!;
    expect(bay).toBeTruthy();
    for (let x = bay.x / T; x < bay.x / T + 7; x++) for (let y = bay.y / T; y < bay.y / T + 2; y++) expect(at(x, y)).toBe('a');
    for (const d of sc.decals.filter((q) => q.key === 'decals/lane_dash')) {
      expect(!(d.y >= bay.y - 2 * T && d.y < bay.y && d.x >= bay.x - 14 && d.x < bay.x + 7 * T)).toBe(true);
    }
  });

  it('has no grime on the asphalt (its fills carry the cracks and patches)', () => {
    for (const d of sc.decals.filter((q) => q.key.startsWith('decals/grime'))) expect(at(Math.floor(d.x / T), Math.floor(d.y / T))).toBe('c');
  });

  it('the paving terrain is a 4 x 2 phase grid in the manifest', () => {
    const c = manifest.terrain.layers.c;
    expect([c.phases, c.phasesY]).toEqual([4, 2]);
    expect(c.tiles).toBe(16 * 8);
  });
});
