import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMS, propTiles } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { T } from './coords';
import { sceneryFor, MOSAIC_TILES } from './scenery';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;
const AREAS = ['rua', 'praca', 'feira'] as const;
const scOf = (id: (typeof AREAS)[number]) => sceneryFor(ROOMS[id], has)!;
const floorAtOf = (id: (typeof AREAS)[number]) => (x: number, y: number) => ROOMS[id].floor[y]?.[x];

describe('V1 ground scenery (split into areas)', () => {
  it('puts a São Paulo mosaic only on free paving, 4 x 3 tiles (the split areas have no bare 4 x 3 patch of paving, so there may be none)', () => {
    for (const id of AREAS) {
      const room = ROOMS[id];
      const at = floorAtOf(id);
      const m = scOf(id).decals.filter((d) => d.key === 'decals/sp_mosaic');
      expect(m.length).toBeLessThanOrEqual(2);
      const busy = new Set<string>();
      for (const p of room.props) for (const t of propTiles(p)) busy.add(`${t.x},${t.y}`);
      for (const d of m) {
        const x0 = d.x / T, y0 = d.y / T;
        expect(manifest.sprites['decals/sp_mosaic'].w).toBe(MOSAIC_TILES.w * T);
        expect(manifest.sprites['decals/sp_mosaic'].h).toBe(MOSAIC_TILES.h * T);
        for (let dy = 0; dy < MOSAIC_TILES.h; dy++) for (let dx = 0; dx < MOSAIC_TILES.w; dx++) {
          expect(at(x0 + dx, y0 + dy)).toBe('c');
          expect(busy.has(`${x0 + dx},${y0 + dy}`)).toBe(false);
        }
      }
    }
  });

  it('the lawn dressing (patches, dirt, clover, tufts) lies on grass only', () => {
    let light = 0;
    let dark = 0;
    for (const id of ['rua', 'praca'] as const) {
      const room = ROOMS[id];
      const at = floorAtOf(id);
      const sc = scOf(id);
      const dressing = sc.decals.filter((d) => /grass_|dirt_|clover|gtuft/.test(d.key));
      // the amount follows the lawn area: at least one piece per 14 grass tiles of the praça (the rua's strip is thin, it only has to be on grass)
      const grassTiles = room.floor.reduce((n, row) => n + [...row].filter((c) => c === 'g').length, 0);
      if (id === 'praca') expect(dressing.length).toBeGreaterThan(grassTiles / 14);
      for (const d of dressing) {
        const sd = manifest.sprites[d.key];
        const x0 = d.origin === 'tl' ? d.x : d.x - sd.ax, y0 = d.origin === 'tl' ? d.y : d.y - sd.ay;
        // the body of the sprite (its centre half) is on grass; a dithered rim may touch the curb
        const cx = x0 + sd.w / 2, cy = y0 + sd.h / 2;
        expect(at(Math.floor(cx / T), Math.floor(cy / T)), `${id}: ${d.key} at ${cx},${cy}`).toBe('g');
      }
      light += sc.decals.filter((d) => d.key.startsWith('decals/grass_light')).length;
      dark += sc.decals.filter((d) => d.key.startsWith('decals/grass_dark')).length;
    }
    // a few soft patches in the big lawns of the praça (the jittered grid decides the light / dark mix)
    expect(light + dark).toBeGreaterThanOrEqual(2);
    // no lawn dressing in the feira (setts) at all
    expect(scOf('feira').decals.filter((d) => /grass_|clover|gtuft/.test(d.key))).toEqual([]);
  });

  it('keeps the bus bay free of lane dashes, and the bay itself is on the asphalt (rua only)', () => {
    const at = floorAtOf('rua');
    const sc = scOf('rua');
    const bay = sc.decals.find((d) => d.key === 'decals/faixa_onibus')!;
    expect(bay).toBeTruthy();
    for (let x = bay.x / T; x < bay.x / T + 7; x++) for (let y = bay.y / T; y < bay.y / T + 2; y++) expect(at(x, y)).toBe('a');
    for (const d of sc.decals.filter((q) => q.key === 'decals/lane_dash')) {
      expect(!(d.y >= bay.y - 2 * T && d.y < bay.y && d.x >= bay.x - 14 && d.x < bay.x + 7 * T)).toBe(true);
    }
    // lane dashes, crosswalks and the bus bay belong to the street: the praça and the feira have none
    for (const id of ['praca', 'feira'] as const) expect(scOf(id).decals.filter((d) => /lane_dash|crosswalk|faixa_onibus/.test(d.key))).toEqual([]);
    expect(sc.decals.filter((d) => d.key === 'decals/crosswalk').length).toBeGreaterThanOrEqual(3);
  });

  it('has no grime on the asphalt (its fills carry the cracks and patches)', () => {
    for (const id of AREAS) {
      const at = floorAtOf(id);
      for (const d of scOf(id).decals.filter((q) => q.key.startsWith('decals/grime'))) expect(at(Math.floor(d.x / T), Math.floor(d.y / T))).toBe('c');
    }
  });

  it('the paving terrain is a 4 x 2 phase grid in the manifest', () => {
    const c = manifest.terrain.layers.c;
    expect([c.phases, c.phasesY]).toEqual([4, 2]);
    expect(c.tiles).toBe(16 * 8);
  });
});
