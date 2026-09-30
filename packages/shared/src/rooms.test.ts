import { describe, expect, it } from 'vitest';
import { buildGrid, floorAt, FLOOR_CHARS, isWalkable, key, propTiles, ROOMS, seatTiles, type RoomDef, type RoomGrid, type Tile } from './rooms.js';
import { SCHEDULES } from './schedules.js';
import { findPath } from './path.js';

const praca = ROOMS.praca;

/** Every tile that belongs to some fully walkable 2x2 block: a corridor that is at least two tiles wide. */
function wideTiles(g: RoomGrid): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < g.rows - 1; y++)
    for (let x = 0; x < g.cols - 1; x++)
      if (isWalkable(g, x, y) && isWalkable(g, x + 1, y) && isWalkable(g, x, y + 1) && isWalkable(g, x + 1, y + 1)) {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.add(key(x + dx, y + dy));
      }
  return out;
}

/** BFS over wide tiles (8-way, no corner cutting through blocked tiles). */
function reachableWide(g: RoomGrid, from: Tile): Set<string> {
  const wide = wideTiles(g);
  const seen = new Set<string>();
  const q: Tile[] = [];
  const start = [...wide].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => Math.max(Math.abs(a[0] - from.x), Math.abs(a[1] - from.y)) - Math.max(Math.abs(b[0] - from.x), Math.abs(b[1] - from.y)))[0];
  q.push({ x: start[0], y: start[1] });
  seen.add(key(start[0], start[1]));
  while (q.length) {
    const c = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = key(c.x + dx, c.y + dy);
      if (wide.has(n) && !seen.has(n)) {
        seen.add(n);
        q.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  }
  return seen;
}

const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Every spot where an NPC of this room can be talked to: each schedule slot's interact tile, or the fixed NPC's own. */
function npcSpots(room: RoomDef): { npc: string; slot: string; tile: Tile; interact: Tile }[] {
  const out: { npc: string; slot: string; tile: Tile; interact: Tile }[] = [];
  for (const slots of Object.values(SCHEDULES)) {
    for (const s of slots!) if (s.room === room.id && s.activity !== 'em_casa') out.push({ npc: s.npc, slot: `${s.from}`, tile: s.tile, interact: s.interact! });
  }
  for (const n of room.npcs) if (!n.schedule) out.push({ npc: n.id, slot: 'fixed', tile: { x: n.x, y: n.y }, interact: n.interact });
  return out;
}

/** Every place a player has to be able to walk to in Vila Ipê: doors, arrive tiles, NPC and prop interact tiles, seats. */
function targets(room: RoomDef): { what: string; tile: Tile }[] {
  const out: { what: string; tile: Tile }[] = [];
  for (const p of room.portals) {
    out.push({ what: `door ${p.id}`, tile: { x: p.x, y: p.y } });
    out.push({ what: `sidewalk in front of ${p.id}`, tile: { x: p.x, y: p.y + 1 } });
  }
  for (const t of npcSpots(room)) out.push({ what: `interact ${t.npc} ${t.slot}`, tile: t.interact });
  for (const p of room.props) if (p.interact) out.push({ what: `interact ${p.id}`, tile: p.interact });
  for (const s of seatTiles(room)) out.push({ what: `seat ${s.prop.id}@${s.x},${s.y}`, tile: { x: s.x, y: s.y } });
  return out;
}

describe('Vila Ipê (room id praca)', () => {
  it('is 56 x 40 tiles with the neighborhood name', () => {
    expect(praca.id).toBe('praca');
    expect(praca.name).toBe('Vila Ipê');
    expect(praca.gloss).toBe('Ipê Village');
    expect(praca.outdoor).toBe(true);
    expect(praca.cols).toBe(56);
    expect(praca.rows).toBe(40);
    expect(praca.floor).toHaveLength(40);
    for (const row of praca.floor) expect(row).toHaveLength(56);
    for (const ch of praca.floor.join('')) expect(FLOOR_CHARS[ch], `floor char ${ch}`).toBeDefined();
  });

  it('has the zones of the plan: streets, sidewalks, the praça, the lot', () => {
    expect(floorAt(praca, 30, 9)).toBe('asfalto');
    expect(floorAt(praca, 30, 33)).toBe('asfalto');
    expect(floorAt(praca, 30, 7)).toBe('calcada');
    expect(floorAt(praca, 30, 12)).toBe('calcada');
    expect(floorAt(praca, 25, 15)).toBe('tijolo');
    expect(floorAt(praca, 52, 15)).toBe('grama');
    expect(floorAt(praca, 45, 21)).toBe('calcada'); // the feira's aisle from the gate
  });

  it('keeps props inside the map and off each other (blocking props never overlap, but the newsstand in front of its wall)', () => {
    const owner = new Map<string, string>();
    for (const p of praca.props) {
      for (const t of propTiles(p)) {
        expect(t.x >= 0 && t.y >= 0 && t.x < praca.cols && t.y < praca.rows, `${p.id} in bounds`).toBe(true);
        if (!p.blocks) continue;
        // a fence with a gate blocks only along its perimeter: the lot inside is open ground (the stalls stand in it)
        if (p.gaps && t.x !== p.x && t.y !== p.y && t.x !== p.x + (p.w ?? 1) - 1 && t.y !== p.y + (p.h ?? 1) - 1) continue;
        const k = key(t.x, t.y);
        const other = owner.get(k);
        if (other) expect([p.id, other].sort().join('+'), `overlap at ${k}`).toBe('banca+empena');
        owner.set(k, p.id);
      }
    }
    for (const n of praca.npcs) expect(owner.has(key(n.x, n.y)), `${n.id} stands on a prop`).toBe(false);
    for (const t of npcSpots(praca)) expect(owner.has(key(t.tile.x, t.tile.y)), `${t.npc} (slot ${t.slot}) stands on a prop`).toBe(false);
  });

  it('every prop that needs art says which sprite (fachada, cerca, sebe)', () => {
    for (const p of praca.props) if (['fachada', 'cerca', 'sebe'].includes(p.kind)) expect(p.art, p.id).toBeTruthy();
  });

  it('has each door on row 5 inside its facade, walkable, with the sidewalk tile in front as the arrive tile', () => {
    const grid = buildGrid(praca);
    for (const p of praca.portals) {
      expect(p.wall, p.id).toBeUndefined();
      expect(p.y).toBe(5);
      const facade = praca.props.find((f) => f.kind === 'fachada' && f.x <= p.x && p.x < f.x + (f.w ?? 1) && f.y <= p.y && p.y < f.y + (f.h ?? 1));
      expect(facade, `${p.id} sits inside a facade`).toBeDefined();
      expect(isWalkable(grid, p.x, p.y), `${p.id} door tile`).toBe(true);
      // the interior's exit brings you back to the sidewalk tile right in front of the door
      const back = ROOMS[p.to].portals.find((q) => q.to === 'praca');
      expect(back?.arrive, `${p.to} exit`).toEqual({ x: p.x, y: 6 });
      expect(isWalkable(grid, p.x, 6)).toBe(true);
      expect(['calcada', 'tijolo']).toContain(floorAt(praca, p.x, 6));
    }
  });

  it('reaches every door, NPC, interact tile and seat from spawn with findPath', () => {
    const grid = buildGrid(praca);
    expect(isWalkable(grid, praca.spawn.x, praca.spawn.y)).toBe(true);
    for (const t of targets(praca)) {
      expect(isWalkable(grid, t.tile.x, t.tile.y), `${t.what} is walkable`).toBe(true);
      expect(findPath(grid, praca.spawn, t.tile), `path spawn -> ${t.what}`).not.toBeNull();
    }
  });

  it('keeps a clear lane at least 2 tiles wide from spawn to every door, NPC and interact tile', () => {
    const grid = buildGrid(praca);
    const lane = reachableWide(grid, praca.spawn);
    const wide = wideTiles(grid);
    expect(wide.has(key(praca.spawn.x, praca.spawn.y))).toBe(true);
    expect(lane.has(key(praca.spawn.x, praca.spawn.y))).toBe(true);
    for (const t of targets(praca)) {
      if (t.what.startsWith('seat')) continue; // a bench seat is a single tile by nature
      const near = [...lane].some((k) => {
        const [x, y] = k.split(',').map(Number);
        return cheb({ x, y }, t.tile) <= 1;
      });
      expect(near, `${t.what} touches the wide lane`).toBe(true);
    }
  });

  it('reaches the doors from each other and back out of the interiors', () => {
    const grid = buildGrid(praca);
    const doors = praca.portals.map((p) => ({ x: p.x, y: p.y + 1 }));
    for (const a of doors) for (const b of doors) expect(findPath(grid, a, b), `${key(a.x, a.y)} -> ${key(b.x, b.y)}`).not.toBeNull();
  });

  it('never opens onto void: every tile on the map border is blocked (buildings, barricades, hedges, fences)', () => {
    const grid = buildGrid(praca);
    for (let x = 0; x < praca.cols; x++) for (const y of [0, praca.rows - 1]) expect(isWalkable(grid, x, y), `top/bottom edge ${x},${y}`).toBe(false);
    for (let y = 0; y < praca.rows; y++) for (const x of [0, praca.cols - 1]) expect(isWalkable(grid, x, y), `west/east edge ${x},${y}`).toBe(false);
  });
});

describe('interiors keep their old rooms', () => {
  it('padaria, kitnet and academia still exist with their exit portals', () => {
    for (const id of ['padaria', 'kitnet', 'academia'] as const) {
      expect(ROOMS[id].portals.some((p) => p.to === 'praca')).toBe(true);
      expect(ROOMS[id].outdoor).toBeUndefined();
    }
  });
});
