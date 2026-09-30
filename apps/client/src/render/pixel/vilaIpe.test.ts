import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOMS, propTiles, type PropDef, type RoomDef } from '@tudobem/shared';
import type { Manifest, SpriteDef } from './manifest';
import { T, type Rect } from './coords';
import { fencePieces, propAnchor, propArtKey, propDepth, propSlices, spriteRect } from './props';
import { outdoorDoorRect, portalHitRect, roomBounds } from './roomLayout';
import { sceneryFor } from './scenery';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/pixel/manifest.json'), 'utf8')) as Manifest;
const has = (k: string) => k in manifest.sprites;
const vila = ROOMS.praca;

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
    if (d.key.includes('grime')) continue;
    const sd = manifest.sprites[d.key];
    mark(d.origin === 'tl' ? { x0: d.x, y0: d.y, x1: d.x + sd.w, y1: d.y + sd.h } : spriteRect(d.x, d.y, sd));
  }
  return set;
}

describe('Vila Ipê art coverage', () => {
  it('every prop resolves to a sprite of the manifest (fences by their pieces)', () => {
    for (const p of vila.props) {
      const keys = p.kind === 'cerca' ? fencePieces(p).map((f) => f.key) : (propSlices(p)?.map((s) => s.key) ?? [propArtKey(p)]);
      expect(keys.length, p.id).toBeGreaterThan(0);
      for (const k of keys) expect(k && has(k), `${p.id} (${p.kind}) -> ${k}`).toBe(true);
    }
  });

  it('the building fronts and roofs are as wide and as tall as their footprints', () => {
    for (const p of vila.props.filter((q) => q.kind === 'fachada')) {
      const d = manifest.sprites[p.art!];
      expect(d.w, `${p.id} width`).toBe((p.w ?? 1) * T);
      // the body is `h` rows tall; a rooftop that pokes above it (the Edifício) is cropped by the map top
      expect(d.ay + 1 >= (p.h ?? 1) * T, `${p.id} body height`).toBe(true);
    }
  });

  it('every decal and wire key of the scenery exists', () => {
    const sc = sceneryFor(vila, () => true)!;
    expect(sc.decals.length).toBeGreaterThan(100);
    for (const d of sc.decals) expect(has(d.key), d.key).toBe(true);
    for (const w of sc.wires) for (const k of w.keys) expect(has(k), k).toBe(true);
    expect(sc.wires.length).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(sceneryFor(vila, has))).toBe(JSON.stringify(sceneryFor(vila, has)));
  });

  it('the interiors have no outdoor scenery', () => {
    for (const id of ['padaria', 'kitnet', 'academia'] as const) expect(sceneryFor(ROOMS[id], has)).toBeNull();
  });

  it('the camera bounds of the open-air map are the map itself', () => {
    expect(roomBounds(vila, 999)).toEqual({ x0: 0, y0: 0, x1: 56 * T, y1: 40 * T });
  });

  it('an outdoor door has a click box around its door art, at least a tile', () => {
    for (const p of vila.portals) {
      const r = portalHitRect(p);
      expect(r).toEqual(outdoorDoorRect(p));
      expect(r.x1 - r.x0).toBeGreaterThanOrEqual(T);
      expect(r.y1).toBe((p.y + 1) * T);
      const cx = ((p.doorAt?.x ?? p.x) + 0.5) * T;
      expect(r.x0 <= cx && cx <= r.x1).toBe(true);
    }
  });

  it('a building front sorts behind a walker on its door tile but in front of the sidewalk behind it', () => {
    const padaria = vila.props.find((p) => p.id === 'padaria')!;
    const a = propAnchor(padaria);
    const feetOnDoor = (5 + 1) * T - 3;
    expect(propDepth(padaria, a.wy)).toBeLessThan(feetOnDoor);
  });

  it('has no empty 4x4 patch of tiles anywhere outdoors: something to look at in every window', () => {
    const tiles = detailTiles(vila);
    const empty: string[] = [];
    for (let y = 0; y + 4 <= vila.rows; y++) {
      for (let x = 0; x + 4 <= vila.cols; x++) {
        let any = false;
        for (let dy = 0; dy < 4 && !any; dy++) for (let dx = 0; dx < 4 && !any; dx++) if (tiles.has(`${x + dx},${y + dy}`)) any = true;
        if (!any) empty.push(`${x},${y}`);
      }
    }
    expect(empty, `empty 4x4 windows at (x,y): ${empty.join(' ')}`).toEqual([]);
  });

  it('counts its props (the plan: 8+ benches, 6 ipês, hero, kiosk, stall, perch, fountain)', () => {
    const n = (kind: string) => vila.props.filter((p) => p.kind === kind).length;
    expect(n('banco')).toBeGreaterThanOrEqual(8);
    expect(n('ipe')).toBeGreaterThanOrEqual(6);
    expect(vila.props.filter((p) => p.hero)).toHaveLength(1);
    for (const kind of ['quiosque', 'barraca_chapeus', 'poleiro', 'fonte', 'ponto_onibus', 'banca', 'orelhao', 'placa_rua']) expect(n(kind), kind).toBe(1);
    expect(propTiles(vila.props.find((p) => p.kind === 'fonte')!)).toHaveLength(12);
  });
});
