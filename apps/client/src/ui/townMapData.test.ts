import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOM_IDS, ROOMS } from '@tudobem/shared';
import type { Manifest } from '../render/pixel/manifest';
import { aeroportoForMap, groundForMap, planTownMap } from './townMapArt';
import { AERO_MAP_ROWS, AREA_AT, MAP_COLS, MAP_H, MAP_ROWS, MAP_T, MAP_W, PRAIA_SOON, ROOM_ON_MAP, SOON_SPOTS, hereSpotId, mapSpots, PIN_ROOM, pinPlace, spotAnchor, tagPlace, tapResult, type Box, type MapArea } from './townMapData';

const root = path.resolve(__dirname, '../../public/pixel');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as Manifest;
const atlas = JSON.parse(fs.readFileSync(path.join(root, manifest.atlases.outdoor.data), 'utf8')) as { frames: Record<string, unknown> };

const overlaps = (a: Box, b: Box) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Each area's footprint on the map, in tiles. */
const AREA_ROWS: Record<MapArea, number> = { rua: ROOMS.rua.rows, rua_leste: ROOMS.rua_leste.rows, praca: ROOMS.praca.rows, feira: ROOMS.feira.rows, aeroporto: AERO_MAP_ROWS };
const areaBox = (a: MapArea): Box => [AREA_AT[a][0] * MAP_T, AREA_AT[a][1] * MAP_T, ROOMS[a].cols * MAP_T, AREA_ROWS[a] * MAP_T];

describe('the Mapa: one picture of Vila Ipê', () => {
  it('places every room of the shared room list (or routes it through the place it is inside)', () => {
    for (const id of ROOM_IDS) {
      const on = ROOM_ON_MAP[id];
      expect(on, id).toBeTruthy();
      if ('via' in on) expect(ROOM_ON_MAP[on.via], `${id} via ${on.via}`).toHaveProperty('hit');
    }
    const rooms = mapSpots().filter((s) => s.room);
    expect(rooms.map((s) => s.id).sort()).toEqual(['academia', 'aeroporto', 'escola', 'feira', 'kitnet', 'padaria', 'praca', 'praia', 'rua', 'rua_leste']);
    // each place travels to its own room and is labelled with that room's own name and gloss
    for (const s of rooms) {
      expect(s.room).toBe(s.id);
      expect(s.pt).toBe(ROOMS[s.room!].name);
      expect(s.en).toBe(ROOMS[s.room!].gloss);
    }
  });

  it('lays the areas out the way they join in the game, side by side and never on top of each other', () => {
    const areas = Object.keys(AREA_AT) as MapArea[];
    for (const a of areas) {
      const [x, y, w, h] = areaBox(a);
      expect(x >= 0 && y >= 0 && x + w <= MAP_W && y + h <= MAP_H, a).toBe(true);
    }
    for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) expect(overlaps(areaBox(areas[i]!), areaBox(areas[j]!)), `${areas[i]} / ${areas[j]}`).toBe(false);
    // the rua's brick path down (edge portals x15-18) meets the praça's entrance (x14-17) ...
    const down = ROOMS.rua.portals.filter((p) => p.edge && p.to === 'praca').map((p) => AREA_AT.rua[0] + p.x);
    const up = ROOMS.praca.portals.filter((p) => p.edge && p.to === 'rua').map((p) => AREA_AT.praca[0] + p.x);
    expect(down).toEqual(up);
    expect(AREA_AT.praca[1]).toBe(AREA_AT.rua[1] + ROOMS.rua.rows);
    // ... the praça's east path meets the feira's gate, and the rua leste goes on where the rua ends
    const east = ROOMS.praca.portals.filter((p) => p.edge && p.to === 'feira').map((p) => AREA_AT.praca[1] + p.y);
    const gate = ROOMS.feira.portals.filter((p) => p.edge && p.to === 'praca').map((p) => AREA_AT.feira[1] + p.y);
    expect(east).toEqual(gate);
    expect(AREA_AT.feira[0]).toBe(AREA_AT.praca[0] + ROOMS.praca.cols);
    expect(AREA_AT.rua_leste).toEqual([AREA_AT.rua[0] + ROOMS.rua.cols, AREA_AT.rua[1]]);
  });

  it('keeps every place on the map, inside its own area, and no two places overlapping', () => {
    const spots = mapSpots();
    for (const s of spots) {
      for (const [x, y, w, h] of s.hit) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(MAP_W);
        expect(y + h).toBeLessThanOrEqual(MAP_H);
      }
    }
    // the shops and homes sit on the street they open onto
    for (const [id, area] of [['padaria', 'rua'], ['kitnet', 'rua'], ['rua', 'rua'], ['academia', 'rua_leste'], ['escola', 'rua_leste'], ['rua_leste', 'rua_leste'], ['praca', 'praca'], ['feira', 'feira'], ['aeroporto', 'aeroporto']] as const) {
      const [ax, ay, aw, ah] = areaBox(area);
      for (const [x, y, w, h] of (ROOM_ON_MAP[id] as { hit: Box[] }).hit) expect(x >= ax && y >= ay && x + w <= ax + aw && y + h <= ay + ah, `${id} in ${area}`).toBe(true);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        for (const a of spots[i]!.hit) for (const b of spots[j]!.hit) expect(overlaps(a, b), `${spots[i]!.id} / ${spots[j]!.id}`).toBe(false);
  });

  it('puts each building on the map over its own front on the street', () => {
    const front = (area: 'rua' | 'rua_leste', art: string) => {
      const p = ROOMS[area].props.find((q) => q.kind === 'fachada' && q.art === art)!;
      return [(AREA_AT[area][0] + p.x) * MAP_T, (AREA_AT[area][1] + p.y) * MAP_T, (p.w ?? 1) * MAP_T, (p.h ?? 1) * MAP_T];
    };
    expect((ROOM_ON_MAP.padaria as { hit: Box[] }).hit[0]).toEqual(front('rua', 'facades/padaria'));
    expect((ROOM_ON_MAP.kitnet as { hit: Box[] }).hit[0]).toEqual(front('rua', 'facades/edificio_ipe'));
    expect((ROOM_ON_MAP.academia as { hit: Box[] }).hit[0]).toEqual(front('rua_leste', 'facades/academia'));
    expect((ROOM_ON_MAP.escola as { hit: Box[] }).hit[0]).toEqual(front('rua_leste', 'casas/terraco_azul'));
  });

  it('draws the Fazenda as coming soon: no travel, a bilingual teaser', () => {
    expect(SOON_SPOTS.map((s) => [s.id, s.pt, s.en])).toEqual([['fazenda', 'Fazenda', 'Farm']]);
    for (const s of SOON_SPOTS) {
      expect(s.room).toBeNull();
      expect(s.soon?.pt.length).toBeGreaterThan(10);
      expect(s.soon?.en.length).toBeGreaterThan(10);
      expect(tapResult(s, { touch: false, selected: null, here: 'rua' })).toBe('teaser');
      expect(tapResult(s, { touch: true, selected: s.id, here: 'rua' })).toBe('teaser');
    }
  });

  it('travels to the Praia, in the corner it waited in, and shows the teaser again while the admin has it closed', () => {
    const open = mapSpots().find((s) => s.id === 'praia')!;
    expect(open.room).toBe('praia');
    expect([open.pt, open.en]).toEqual(['Praia', 'Beach']);
    expect(open.hit[0]).toEqual(PRAIA_SOON.hit[0]);
    expect(tapResult(open, { touch: false, selected: null, here: 'rua' })).toBe('travel');
    expect(hereSpotId('praia')).toBe('praia');
    expect(hereSpotId('barco_festa')).toBe('praia');
    const closed = mapSpots({ praiaOpen: false }).find((s) => s.id === 'praia')!;
    expect(closed.room).toBeNull();
    expect(closed.soon?.pt).toContain('praia');
    expect(tapResult(closed, { touch: false, selected: null, here: 'rua' })).toBe('teaser');
    expect(mapSpots({ praiaOpen: true }).find((s) => s.id === 'praia')!.room).toBe('praia');
  });

  it('gives a phone big tap targets (the map fills the sheet\'s height on a 390×844 phone and pans sideways)', () => {
    const phoneScale = (844 - 150) / MAP_H;
    for (const s of mapSpots()) {
      const [, , w, h] = s.hit[0]!;
      expect(Math.min(w, h) * phoneScale, s.id).toBeGreaterThanOrEqual(44);
    }
  });

  it('marks "você está aqui" on your place, and on the Academia from a player academy floor', () => {
    expect(hereSpotId('praca')).toBe('praca');
    expect(hereSpotId('kitnet')).toBe('kitnet');
    expect(hereSpotId('andar')).toBe('academia');
    expect(hereSpotId('desembarque')).toBe('aeroporto');
    expect(hereSpotId(null)).toBeNull();
    const a = spotAnchor(ROOM_ON_MAP.padaria as { hit: Box[] });
    expect(a).toEqual({ x: 64, y: 48, top: 0 });
  });

  it('keeps name tags and the "você está aqui" pin on the map at its edges', () => {
    expect(tagPlace(ROOM_ON_MAP.padaria as { hit: Box[] })).toEqual({ x: 8, y: 48, align: 'start' });
    expect(tagPlace(ROOM_ON_MAP.praca as { hit: Box[] }).align).toBe('center');
    for (const s of SOON_SPOTS) expect(tagPlace(s)).toMatchObject({ x: MAP_W - 8, align: 'end' });
    for (const s of mapSpots().filter((q) => q.room)) {
      const p = pinPlace(s);
      expect(p.y, s.id).toBeGreaterThanOrEqual(PIN_ROOM.above);
      expect(p.x >= PIN_ROOM.side && p.x <= MAP_W - PIN_ROOM.side, s.id).toBe(true);
      // the pin still points into the place
      const [x, y, w, h] = s.hit[0]!;
      expect(p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h, s.id).toBe(true);
    }
  });

  it('travels on a click, lifts first on a touch, and just closes where you already are', () => {
    const feira = { id: 'feira' as const, room: 'feira' as const };
    expect(tapResult(feira, { touch: false, selected: null, here: 'rua' })).toBe('travel');
    expect(tapResult(feira, { touch: true, selected: null, here: 'rua' })).toBe('select');
    expect(tapResult(feira, { touch: true, selected: 'praca', here: 'rua' })).toBe('select');
    expect(tapResult(feira, { touch: true, selected: 'feira', here: 'rua' })).toBe('travel');
    expect(tapResult(feira, { touch: false, selected: null, here: 'feira' })).toBe('stay');
  });
});

describe('the Mapa picture (drawn from the game\'s own areas)', () => {
  const plan = planTownMap(manifest);

  it('is one MAP_W × MAP_H picture at one canvas pixel per game pixel, using only terrain tiles and frames that exist', () => {
    expect([plan.width, plan.height]).toEqual([MAP_W, MAP_H]);
    expect(plan.ops.filter((o) => o.kind === 'tile').length).toBeGreaterThan(MAP_COLS * MAP_ROWS);
    for (const o of plan.ops) {
      if (o.kind === 'tile') expect(o.idx).toBeLessThan(manifest.terrain.count);
      else expect(atlas.frames[o.frame], o.frame).toBeDefined();
    }
  });

  it('draws the real buildings and landmarks of every place', () => {
    const frames = new Set(plan.ops.flatMap((o) => (o.kind === 'sprite' ? [o.frame] : [])));
    for (const key of ['facades/padaria', 'facades/edificio_ipe', 'facades/academia', 'casas/terraco_azul', 'props/fountain', 'props/coreto', 'props/ponto_onibus', 'aero/aviao', 'aero/torre', 'aero/vidraca_letreiro', 'vehicles/onibus_w', 'props/carrinho_coco', 'praia/quiosque_coco', 'praia/barco_remo'])
      expect(frames.has(manifest.sprites[key]?.frame ?? key), key).toBe(true);
    expect([...frames].some((f) => f.startsWith('feira/frutas')), 'feira stalls').toBe(true);
  });

  it('shortens the Aeroporto to its runway, terminal front and curb, and keeps the ground a lawn with the bus road', () => {
    const aero = aeroportoForMap();
    expect(aero.rows).toBe(AERO_MAP_ROWS);
    expect(aero.floor).toHaveLength(AERO_MAP_ROWS);
    for (const p of aero.props) expect(p.y + (p.h ?? 1), p.id).toBeLessThanOrEqual(AERO_MAP_ROWS);
    expect(aero.props.some((p) => p.art === 'aero/aviao')).toBe(true);
    expect(aero.props.some((p) => p.art === 'aero/porta_auto')).toBe(true);
    const ground = groundForMap();
    expect(ground.floor).toHaveLength(MAP_ROWS);
    for (const row of ground.floor) expect(row).toHaveLength(MAP_COLS);
    // the road leaves the rua leste's east end and reaches the airport's curb lane
    expect(ground.floor[8]![AREA_AT.rua_leste[0] + ROOMS.rua_leste.cols]).toBe('a');
    expect(ground.floor[AERO_MAP_ROWS - 1]![MAP_COLS - 1]).toBe('a');
  });
});
