import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIARY_PLACEMENTS, ROOMS, propTiles, type PropDef, type RoomDef } from '@tudobem/shared';
import type { Manifest, SpriteDef } from './manifest';
import { T, type Rect } from './coords';
import { fencePieces, propAnchor, propArtKey, propDepth, propSlices, spriteRect } from './props';
import { outdoorDoorRect, portalHitRect, roomBounds } from './roomLayout';
import { sceneryFor } from './scenery';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;
const AREAS = ['rua', 'praca', 'feira'] as const;
const rua = ROOMS.rua;
const praca = ROOMS.praca;
const allProps = AREAS.flatMap((id) => ROOMS[id].props);
const diaryIds = new Set(DIARY_PLACEMENTS.map((p) => p.id));

/** World rects of everything a prop draws: its sprite, the overhead part (canopy, awning) and, for a fence, every piece. */
function propRects(p: PropDef): Rect[] {
  const out: Rect[] = [];
  const a = propAnchor(p);
  const add = (key: string | null, wx: number, wy: number) => {
    const d: SpriteDef | undefined = key ? manifest.sprites[key] : undefined;
    if (d) out.push(spriteRect(Math.round(wx), Math.round(wy), d));
  };
  if (p.kind === 'cerca') {
    for (const f of fencePieces(p)) add(f.key, (f.x + (f.w ?? 1) / 2) * T, (f.y + 1) * T);
    return out;
  }
  const slices = propSlices(p);
  if (slices) for (const s of slices) add(s.key, (s.x + 0.5) * T, (s.y + 1) * T);
  else {
    const key = propArtKey(p);
    add(key, a.wx, a.wy);
    const d = key ? manifest.sprites[key] : undefined;
    if (d && typeof d.overhead === 'string') add(d.overhead, a.wx, a.wy);
  }
  return out;
}

/** Tiles touched by something you can see: props, building fronts, fences, and the decals that are more than a stain (grime does not count). */
function detailTiles(room: RoomDef): Set<string> {
  const set = new Set<string>();
  const mark = (r: Rect) => {
    for (let y = Math.floor(r.y0 / T); y <= Math.floor((r.y1 - 1) / T); y++) for (let x = Math.floor(r.x0 / T); x <= Math.floor((r.x1 - 1) / T); x++) set.add(`${x},${y}`);
  };
  for (const p of room.props) for (const r of propRects(p)) mark(r);
  const sc = sceneryFor(room, has);
  for (const d of sc?.decals ?? []) {
    if (/grime|grass_|dirt_|gtuft|clover/.test(d.key)) continue; // stains and lawn dressing do not count as detail
    const sd = manifest.sprites[d.key];
    mark(d.origin === 'tl' ? { x0: d.x, y0: d.y, x1: d.x + sd.w, y1: d.y + sd.h } : spriteRect(d.x, d.y, sd));
  }
  return set;
}

describe('Vila Ipê art coverage (rua, praça, feira)', () => {
  it('every prop resolves to a sprite of the manifest (fences by their pieces)', () => {
    for (const p of allProps) {
      const keys = p.kind === 'cerca' ? fencePieces(p).map((f) => f.key) : (propSlices(p)?.map((s) => s.key) ?? [propArtKey(p)]);
      expect(keys.length, p.id).toBeGreaterThan(0);
      for (const k of keys) expect(k && has(k), `${p.id} (${p.kind}) -> ${k}`).toBe(true);
    }
  });

  it('the building fronts and roofs are as wide and as tall as their footprints', () => {
    for (const p of allProps.filter((q) => q.kind === 'fachada')) {
      const d = manifest.sprites[p.art!];
      expect(d.w, `${p.id} width`).toBe((p.w ?? 1) * T);
      // the body is `h` rows tall; a rooftop that pokes above it (the Edifício) is cropped by the map top
      expect(d.ay + 1 >= (p.h ?? 1) * T, `${p.id} body height`).toBe(true);
    }
  });

  it('every decal and wire key of the scenery exists', () => {
    let decals = 0;
    for (const id of AREAS) {
      const sc = sceneryFor(ROOMS[id], () => true)!;
      decals += sc.decals.length;
      for (const d of sc.decals) expect(has(d.key), d.key).toBe(true);
      for (const w of sc.wires) for (const k of w.keys) expect(has(k), k).toBe(true);
    }
    expect(decals).toBeGreaterThan(100);
    // the utility poles and their wires are along the rua
    expect(sceneryFor(rua, () => true)!.wires.length).toBeGreaterThanOrEqual(2);
    expect(sceneryFor(praca, () => true)!.wires).toEqual([]);
  });

  it('is deterministic', () => {
    for (const id of AREAS) expect(JSON.stringify(sceneryFor(ROOMS[id], has))).toBe(JSON.stringify(sceneryFor(ROOMS[id], has)));
  });

  it('the interiors have no outdoor scenery', () => {
    for (const id of ['padaria', 'kitnet', 'academia'] as const) expect(sceneryFor(ROOMS[id], has)).toBeNull();
  });

  it('the camera bounds of the open-air map are the map plus its 2 tile sky margin', () => {
    expect(roomBounds(rua, 999)).toEqual({ x0: 0, y0: -2 * T, x1: 40 * T, y1: 16 * T });
    expect(roomBounds(praca, 999)).toEqual({ x0: 0, y0: -2 * T, x1: 32 * T, y1: 24 * T });
    expect(roomBounds(ROOMS.feira, 999)).toEqual({ x0: 0, y0: -2 * T, x1: 32 * T, y1: 20 * T });
  });

  it('an outdoor door has a click box around its door art, at least a tile', () => {
    for (const p of rua.portals.filter((q) => !q.edge)) {
      const r = portalHitRect(p);
      expect(r).toEqual(outdoorDoorRect(p));
      expect(r.x1 - r.x0).toBeGreaterThanOrEqual(T);
      expect(r.y1).toBe((p.y + 1) * T);
      const cx = ((p.doorAt?.x ?? p.x) + 0.5) * T;
      expect(r.x0 <= cx && cx <= r.x1).toBe(true);
    }
  });

  it('a building front sorts behind a walker on its door tile but in front of the sidewalk behind it', () => {
    const padaria = rua.props.find((p) => p.id === 'padaria')!;
    const a = propAnchor(padaria);
    const feetOnDoor = (5 + 1) * T - 3;
    expect(propDepth(padaria, a.wy)).toBeLessThan(feetOnDoor);
  });

  it('has no empty 4x4 patch of tiles in the rua, 5x5 in the calmer praça, 6x6 in the feira (whose free paving is room to grow)', () => {
    for (const [id, win] of [['rua', 4], ['praca', 5], ['feira', 6]] as const) {
      const room = ROOMS[id];
      const tiles = detailTiles(room);
      const empty: string[] = [];
      for (let y = 0; y + win <= room.rows; y++) {
        for (let x = 0; x + win <= room.cols; x++) {
          let any = false;
          for (let dy = 0; dy < win && !any; dy++) for (let dx = 0; dx < win && !any; dx++) if (tiles.has(`${x + dx},${y + dy}`)) any = true;
          if (!any) empty.push(`${x},${y}`);
        }
      }
      expect(empty, `${id}: empty ${win}x${win} windows at (x,y): ${empty.join(' ')}`).toEqual([]);
    }
  });

  it('counts its props: the praça keeps its focal points, the rua its street furniture, the feira its stalls (about a third fewer props than the old single map)', () => {
    const n = (kind: string) => allProps.filter((p) => p.kind === kind).length;
    const inPraca = (kind: string) => praca.props.filter((p) => p.kind === kind).length;
    expect(inPraca('banco')).toBeGreaterThanOrEqual(5);
    expect(inPraca('ipe')).toBeGreaterThanOrEqual(2); // the yellow ipês; the purple / white ones, shade trees and palms are 'arvore'
    expect(inPraca('ipe') + inPraca('arvore')).toBeGreaterThanOrEqual(8);
    expect(allProps.filter((p) => p.hero)).toHaveLength(1);
    expect(praca.props.some((p) => p.hero)).toBe(true);
    for (const kind of ['quiosque', 'barraca_chapeus', 'poleiro', 'fonte', 'ponto_onibus', 'banca', 'orelhao']) expect(n(kind), kind).toBe(1);
    expect(propTiles(praca.props.find((p) => p.kind === 'fonte')!)).toHaveLength(12);
    expect(praca.props.some((p) => p.kind === 'quiosque')).toBe(true);
    expect(rua.props.some((p) => p.kind === 'ponto_onibus')).toBe(true);
    expect(ROOMS.feira.props.filter((p) => p.kind === 'feira')).toHaveLength(4);
    // the old map had 222 props in one room (58 inside the praça block, 0.117 per tile): the praça now has about 0.07 per tile, calmer, and the three areas together have fewer
    // (the language diary's small objects and signs are scenery on the ground, counted apart)
    expect(allProps.filter((p) => !diaryIds.has(p.id)).length).toBeLessThanOrEqual(222);
    const decor = praca.props.filter((p) => !p.id.startsWith('sebe_') && !p.id.startsWith('cerca_') && !diaryIds.has(p.id)).length;
    expect(decor / (praca.cols * praca.rows)).toBeLessThanOrEqual(0.117 * 0.7);
  });
});
