import { describe, expect, it } from 'vitest';
import { ROOMS, type PropDef, type RoomId } from '@tudobem/shared';
import { T } from './coords';
import { SURROUND_TILES, VILA_LAYOUT, surroundFor, surroundRect } from './surround';

const OUTDOOR: RoomId[] = ['rua', 'rua_leste', 'praca', 'feira', 'aeroporto'];
const INTERIOR: RoomId[] = ['padaria', 'kitnet', 'academia', 'escola', 'andar'];

/** Room-tile column of the surround floor (the margin is the border around the map). */
const cell = (floor: string[], x: number, y: number): string => floor[y + SURROUND_TILES][x + SURROUND_TILES];

const footprintOutside = (p: PropDef, cols: number, rows: number): boolean => {
  const w = p.w ?? 1;
  const h = p.h ?? 1;
  return p.x >= cols || p.y >= rows || p.x + w <= 0 || p.y + h <= 0;
};

describe('surroundFor', () => {
  it('open-air areas get a surround and interiors do not', () => {
    for (const id of OUTDOOR) expect(surroundFor(ROOMS[id]), id).not.toBeNull();
    for (const id of INTERIOR) expect(surroundFor(ROOMS[id]), id).toBeNull();
    for (const id of Object.keys(ROOMS) as RoomId[]) {
      expect(surroundFor(ROOMS[id]) !== null, id).toBe(ROOMS[id].outdoor === true);
    }
  });

  it('is deterministic', () => {
    for (const id of OUTDOOR) expect(surroundFor(ROOMS[id]), id).toEqual(surroundFor(ROOMS[id]));
  });

  it('places each neighbour from the town grid, and keeps this map\'s own floor in the middle', () => {
    for (const id of ['rua', 'rua_leste', 'praca', 'feira'] as const) {
      const def = ROOMS[id];
      const s = surroundFor(def)!;
      const home = VILA_LAYOUT[id]!;
      expect(s.margin).toBe(SURROUND_TILES);
      expect(s.floor).toHaveLength(def.rows + 2 * SURROUND_TILES);
      for (const row of s.floor) expect(row).toHaveLength(def.cols + 2 * SURROUND_TILES);
      for (let y = 0; y < def.rows; y++) {
        for (let x = 0; x < def.cols; x++) expect(cell(s.floor, x, y), `${id} ${x},${y}`).toBe(def.floor[y][x]);
      }
      const placed = Object.fromEntries(s.neighbours.map((n) => [n.def.id, { dx: n.dx, dy: n.dy }]));
      for (const [nid, at] of Object.entries(VILA_LAYOUT)) {
        if (nid === id) continue;
        const dx = at.x - home.x;
        const dy = at.y - home.y;
        expect(placed[nid], `${id} -> ${nid}`).toEqual({ dx, dy });
        const n = ROOMS[nid as RoomId];
        // a tile of the neighbour that falls inside the margin is that neighbour's own ground
        // (the rua's origin is more than SURROUND_TILES west of the feira, so the sample has to be one that is actually drawn)
        let sample: { x: number; y: number } | null = null;
        for (let y = 0; y < n.rows && !sample; y++) {
          for (let x = 0; x < n.cols; x++) {
            const rx = x + dx;
            const ry = y + dy;
            if (rx > -SURROUND_TILES && ry > -SURROUND_TILES && rx < def.cols + SURROUND_TILES && ry < def.rows + SURROUND_TILES) {
              sample = { x, y };
              break;
            }
          }
        }
        expect(sample, `${id} draws some of ${nid}`).not.toBeNull();
        expect(cell(s.floor, sample!.x + dx, sample!.y + dy), `${id} sees ${nid}`).toBe(n.floor[sample!.y][sample!.x]);
      }
      expect(s.neighbours.some((n) => n.def.id === id)).toBe(false);
    }
  });

  it('continues the street with generated blocks past the barricades', () => {
    const rua = surroundFor(ROOMS.rua)!;
    const leste = surroundFor(ROOMS.rua_leste)!;
    // the street's ground, one tile past the map: building row, asphalt, lawn (the same row on both sides)
    for (const [s, x] of [[rua, -1], [leste, ROOMS.rua_leste.cols]] as const) {
      expect(cell(s.floor, x, 0)).toBe('c');
      expect(cell(s.floor, x, 8)).toBe('a');
      expect(cell(s.floor, x, 11)).toBe('a');
      expect(cell(s.floor, x, 14)).toBe('g');
      expect(cell(s.floor, x, 15)).toBe('g');
    }
    // houses, lamps and parked cars stand on that ground, off the walkable map
    expect(rua.props.some((p) => p.x < 0 && p.kind === 'fachada')).toBe(true);
    expect(leste.props.some((p) => p.x >= ROOMS.rua_leste.cols && p.kind === 'fachada')).toBe(true);
    expect(rua.dashes.length).toBeGreaterThan(0);
    expect(leste.dashes.length).toBeGreaterThan(0);
    // the praça sees the south of that street just above it (the building row is further than the prop reach)
    const praca = surroundFor(ROOMS.praca)!;
    expect(praca.props.some((p) => p.y < 0)).toBe(true);
    expect(cell(praca.floor, 0, -1)).toBe('g'); // the street's south lawn, just above the praça
  });

  it('nothing in the surround is walkable or clickable', () => {
    for (const id of OUTDOOR) {
      const def = ROOMS[id];
      const s = surroundFor(def)!;
      for (const p of s.props) {
        expect(p.blocks, p.id).toBe(false);
        expect(p.action, p.id).toBeUndefined();
        expect(p.label, p.id).toBeUndefined();
        expect(p.seat, p.id).toBeUndefined();
        expect(p.interact, p.id).toBeUndefined();
        expect(p.vendor, p.id).toBeUndefined();
        expect(footprintOutside(p, def.cols, def.rows), p.id).toBe(true);
      }
      for (const d of s.dashes) {
        const inside = d.x >= 0 && d.y >= 0 && d.x < def.cols * T && d.y < def.rows * T;
        expect(inside, `${id} dash ${d.x},${d.y}`).toBe(false);
      }
    }
  });

  it('the airport (outdoor, off the town grid) still gets ground past its edges, and no neighbours', () => {
    const def = ROOMS.aeroporto;
    const s = surroundFor(def)!;
    expect(s.neighbours).toEqual([]);
    expect(s.props).toEqual([]);
    expect(s.dashes).toEqual([]);
    expect(s.floor).toHaveLength(def.rows + 2 * SURROUND_TILES);
    expect(cell(s.floor, 0, 0)).toBe(def.floor[0][0]);
    // past the west edge the nearest ground carries on, so the cell is filled
    expect(cell(s.floor, -1, 0)).toBe(def.floor[0][0]);
    const r = surroundRect(def);
    expect(r).toEqual({ x0: -SURROUND_TILES * T, y0: -SURROUND_TILES * T, x1: (def.cols + SURROUND_TILES) * T, y1: (def.rows + SURROUND_TILES) * T });
  });
});
