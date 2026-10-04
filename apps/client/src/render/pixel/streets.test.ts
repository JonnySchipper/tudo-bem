/**
 * Wave 3: the two streets read as streets. Parked cars stand inside their bays with gaps, never in front of the bus bay, a crosswalk, a hydrant or a
 * door; tree pits, lamps, utility poles and the bus shelter stand on the sidewalk (never in the parking lane) and never touch a parked car;
 * the moving lanes' sprites end above the parked cars' sprites. Rects are the sprites' real extents from the manifest (what is drawn), not footprints.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { floorAt, ROOMS, type PropDef } from '@tudobem/shared';
import type { Manifest, SpriteDef } from './manifest';
import { T, type Rect } from './coords';
import { inflate, propAnchor, propArtKey, spriteRect } from './props';
import { sceneryFor } from './scenery';
import { AMBIENT } from './ambientData';
import { BUS, VEHICLE_TYPES } from './ambientSim';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;

const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const union = (rs: Rect[]): Rect => ({ x0: Math.min(...rs.map((r) => r.x0)), y0: Math.min(...rs.map((r) => r.y0)), x1: Math.max(...rs.map((r) => r.x1)), y1: Math.max(...rs.map((r) => r.y1)) });

/** What a prop draws standing: its sprite, plus (with `overhead`) the canopy that hangs above it. */
function drawn(p: PropDef, withOverhead: boolean): Rect {
  const a = propAnchor(p);
  const key = propArtKey(p);
  const d = key ? manifest.sprites[key] : undefined;
  expect(d, `${p.id} sprite`).toBeTruthy();
  const rs = [spriteRect(Math.round(a.wx), Math.round(a.wy), d as SpriteDef)];
  if (withOverhead && d && typeof d.overhead === 'string') {
    const o = manifest.sprites[d.overhead];
    if (o) rs.push(spriteRect(Math.round(a.wx), Math.round(a.wy), o));
  }
  return union(rs);
}

// the street is two areas (rua west, rua_leste east, with the bus stop): every check runs on each half
for (const id of ['rua', 'rua_leste'] as const) describe(`Wave 3: streets (${id})`, () => {
  const vila = ROOMS[id];
  const amb = AMBIENT[id];
  const parked = vila.props.filter((p) => p.id.startsWith('estac_'));
  const trees = vila.props.filter((p) => p.kind === 'arvore');
  const lamps = vila.props.filter((p) => p.kind === 'poste');
  const shelters = vila.props.filter((p) => p.kind === 'ponto_onibus'); // only the east half has the bus stop
  const hydrants = vila.props.filter((p) => (p.art ?? '').includes('hidrante'));
  const decals = sceneryFor(vila, has)!.decals;
  const decalRect = (key: string): Rect[] =>
    decals.filter((d) => d.key === key).map((d) => ({ x0: d.x, y0: d.y, x1: d.x + manifest.sprites[key].w, y1: d.y + manifest.sprites[key].h }));
  const tileRect = (x: number, y: number): Rect => ({ x0: x * T, y0: y * T, x1: (x + 1) * T, y1: (y + 1) * T });

  /** The bus standing at the stop: its sprite on the eastbound lane of Rua dos Ipês. */
  function busRect(): Rect {
    const ipes = amb.streets.find((s) => s.id === amb.bus!.street)!;
    const lane = ipes.lanes.find((l) => l.dir === 'e')!;
    return spriteRect(Math.round(amb.bus!.stopX), lane.y, manifest.sprites[BUS.e]);
  }

  it('has parked cars in the bays of the rua', () => {
    expect(parked.filter((p) => p.y === 12).length).toBeGreaterThanOrEqual(1); // one bay on each half
    expect(parked.every((p) => p.y === 12)).toBe(true); // split areas: only the rua has a street (the south row, Rua Jacarandá, is gone)
  });

  it('parks every car fully inside a parking bay (asphalt), with a gap to the next car', () => {
    const rows = new Map<number, Rect[]>();
    for (const p of parked) {
      for (let dx = 0; dx < (p.w ?? 1); dx++) expect(floorAt(vila, p.x + dx, p.y), `${p.id} bay tile ${p.x + dx}`).toBe('asfalto');
      const r = drawn(p, false);
      // the sprite may overhang its footprint by a few pixels (a Fusca is narrower than 4 tiles' worth), never by a tile
      expect(r.x0).toBeGreaterThanOrEqual(p.x * T - 8);
      expect(r.x1).toBeLessThanOrEqual((p.x + (p.w ?? 1)) * T + 8);
      rows.set(p.y, [...(rows.get(p.y) ?? []), r]);
    }
    for (const [row, list] of rows) {
      list.sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < list.length; i++) expect(list[i].x0 - list[i - 1].x1, `gap between parked cars in row ${row}`).toBeGreaterThanOrEqual(8);
    }
    // the recessed bays of Rua dos Ipês: the tiles to each side of a bay are sidewalk, so nothing parks in the traffic lane
    for (const p of parked.filter((q) => q.y === 12)) {
      expect(floorAt(vila, p.x - 1, 12)).toBe('calcada');
      expect(floorAt(vila, p.x + (p.w ?? 1), 12)).toBe('calcada');
    }
  });

  it('keeps every parked car clear of trees (canopy included), lamps, poles, the shelter, hydrants, crosswalks, doors and the bus bay', () => {
    const things: [string, Rect][] = [];
    for (const t of trees) things.push([t.id, drawn(t, true)]);
    for (const l of lamps) things.push([l.id, drawn(l, false)]);
    for (const sh of shelters) things.push([sh.id, drawn(sh, false)]);
    for (const h of hydrants) things.push([h.id, drawn(h, false)]);
    for (const [i, r] of decalRect('decals/crosswalk').entries()) things.push([`crosswalk ${i}`, r]);
    for (const [i, r] of decalRect('decals/faixa_onibus').entries()) things.push([`bus bay ${i}`, r]);
    if (amb.bus) things.push(['the bus at the stop', busRect()]);
    for (const p of vila.portals) things.push([`door ${p.id}`, tileRect(Math.floor(p.doorAt?.x ?? p.x), p.y)]);
    expect(things.length).toBeGreaterThan(10);
    for (const car of parked) {
      const c = inflate(drawn(car, false), 4);
      for (const [name, r] of things) expect(overlap(c, r), `${car.id} overlaps ${name}`).toBe(false);
    }
  });

  it('puts tree pits and lamps on the sidewalk, never on the asphalt of a street or its parking bays', () => {
    for (const p of [...trees, ...lamps, ...shelters]) {
      for (let dx = 0; dx < (p.w ?? 1); dx++) for (let dy = 0; dy < (p.h ?? 1); dy++) expect(floorAt(vila, p.x + dx, p.y + dy), `${p.id} at ${p.x + dx},${p.y + dy}`).not.toBe('asfalto');
    }
    // and none stands in a parked car's columns on the rows between the lane and the curb
    for (const car of parked) {
      const c = drawn(car, false);
      for (const p of [...trees, ...lamps]) {
        const base = drawn(p, false);
        expect(base.x1 <= c.x0 || base.x0 >= c.x1 || base.y1 <= c.y0 || base.y0 >= c.y1, `${p.id} in the parking lane of ${car.id}`).toBe(true);
      }
    }
  });

  it('keeps the shelter, tree pits and poles of a sidewalk from touching each other', () => {
    const along = [...trees, ...lamps, ...shelters].filter((p) => (p.y >= 12 && p.y <= 13) || (p.y >= 30 && p.y <= 31) || (p.y >= 6 && p.y <= 7));
    const bases = along.map((p) => [p.id, drawn(p, false)] as const);
    for (let i = 0; i < bases.length; i++) for (let j = i + 1; j < bases.length; j++) {
      expect(overlap(bases[i][1], bases[j][1]), `${bases[i][0]} touches ${bases[j][0]}`).toBe(false);
    }
  });

  it('keeps the traffic lanes above the parked cars: no moving sprite reaches a parked sprite, and moving vehicles sort behind them', () => {
    for (const street of amb.streets) {
      const own = parked.filter((p) => p.y >= parseInt(street.id === 'ipes' ? '8' : '32', 10) && p.y <= (street.id === 'ipes' ? 12 : 36));
      expect(own.length, street.id).toBeGreaterThan(0);
      const top = Math.min(...own.map((p) => drawn(p, false).y0));
      const feetOfParked = Math.min(...own.map((p) => propAnchor(p).wy));
      for (const lane of street.lanes) {
        const sprites = VEHICLE_TYPES.map((v) => manifest.sprites[v[lane.dir]]);
        if (street.id === amb.bus?.street && lane.dir === 'e') sprites.push(manifest.sprites[BUS.e]);
        for (const sd of sprites) {
          const r = spriteRect(0, lane.y, sd);
          expect(r.y1, `${street.id} lane y ${lane.y}: a ${sd.frame} ends at ${r.y1}, parked sprites start at ${top}`).toBeLessThanOrEqual(top);
        }
        expect(lane.y, 'drawn behind (sorted by feet)').toBeLessThan(feetOfParked);
      }
    }
    // the dashes of each street never lie under a parked car's sprite
    for (const d of decals.filter((q) => q.key === 'decals/lane_dash')) {
      const r: Rect = { x0: d.x, y0: d.y, x1: d.x + manifest.sprites['decals/lane_dash'].w, y1: d.y + manifest.sprites['decals/lane_dash'].h };
      for (const p of parked.filter((q) => q.y === 12)) expect(overlap(r, drawn(p, false)), `dash at ${d.x},${d.y} under ${p.id}`).toBe(false);
    }
  });

  it('stands the bus on the painted bay with the shelter on the sidewalk behind it', () => {
    if (!amb.bus) return expect(shelters).toHaveLength(0); // the west half has no bus stop
    const shelter = shelters[0];
    const bus = busRect();
    const [bay] = decalRect('decals/faixa_onibus');
    expect(bay.x0).toBeLessThanOrEqual(bus.x0 + 1);
    expect(bay.x1).toBeGreaterThanOrEqual(bus.x1 - 1);
    // the bay is painted where the bus's wheels are
    const ipes = amb.streets.find((s) => s.id === amb.bus!.street)!;
    const feet = ipes.lanes.find((l) => l.dir === 'e')!.y;
    expect(bay.y0).toBeLessThanOrEqual(feet - 8);
    expect(bay.y1).toBeGreaterThanOrEqual(feet + 8);
    // the shelter is in front of (south of) the bus and its roof meets the bus only in the bus sprite's bottom padding (the wheels' shadow)
    const s = drawn(shelter, false);
    expect(s.y1).toBeGreaterThan(bus.y1);
    expect(bus.y1 - s.y0).toBeLessThanOrEqual(4);
    expect(s.x0).toBeGreaterThanOrEqual(bus.x0);
    expect(s.x1).toBeLessThanOrEqual(bus.x1);
    expect(floorAt(vila, shelter.x, shelter.y)).toBe('calcada');
    // no car is parked along the bay's curb
    for (const car of parked.filter((p) => p.y === 12)) {
      const c = drawn(car, false);
      expect(c.x1 <= bay.x0 - T || c.x0 >= bay.x1 + T, `${car.id} next to the bus bay`).toBe(true);
    }
  });
});
