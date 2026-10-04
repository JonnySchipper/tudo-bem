import { describe, expect, it } from 'vitest';
import { buildGrid, FEIRA_SLOTS, floorAt, FLOOR_CHARS, isWalkable, key, propTiles, ROOMS, seatTiles, type RoomDef, type RoomGrid, type Tile } from './rooms.js';
import { SCHEDULES } from './schedules.js';
import { findPath } from './path.js';


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

const AREAS = ['rua', 'praca', 'feira'] as const;
const SIZES = { rua: [40, 16], praca: [32, 24], feira: [32, 20] } as const;
const edgeKey = (p: { x: number; y: number }) => key(p.x, p.y);

describe('Vila Ipê split into three open-air areas (rua, praca, feira)', () => {
  it('has the three areas at their sizes, all outdoor, praca the spawn room (id kept)', () => {
    for (const id of AREAS) {
      const r = ROOMS[id];
      expect(r.id).toBe(id);
      expect(r.outdoor).toBe(true);
      expect([r.cols, r.rows]).toEqual(SIZES[id]);
      expect(r.floor).toHaveLength(r.rows);
      for (const row of r.floor) expect(row).toHaveLength(r.cols);
      for (const ch of r.floor.join('')) expect(FLOOR_CHARS[ch], `${id}: floor char ${ch}`).toBeDefined();
    }
    expect(ROOMS.praca.name).toBe('Praça Central');
    expect(ROOMS.rua.name).toBe('Rua dos Ipês');
    expect(ROOMS.feira.name).toBe('Feira Livre');
  });

  it('has the zones of the plan: the street, sidewalks, the lawns, the brick, the setts', () => {
    const rua = ROOMS.rua;
    expect(floorAt(rua, 10, 9)).toBe('asfalto');
    expect(floorAt(rua, 20, 7)).toBe('calcada');
    expect(floorAt(rua, 30, 12)).toBe('calcada');
    expect(floorAt(rua, 5, 14)).toBe('grama');
    expect(floorAt(rua, 19, 14)).toBe('tijolo'); // the brick path down to the praça
    const praca = ROOMS.praca;
    expect(floorAt(praca, 5, 5)).toBe('grama');
    expect(floorAt(praca, 22, 11)).toBe('tijolo');
    expect(floorAt(praca, 15, 20)).toBe('tijolo');
    const feira = ROOMS.feira;
    expect(floorAt(feira, 20, 9)).toBe('paralelepipedo');
    expect(floorAt(feira, 1, 8)).toBe('tijolo');
    // traffic only on the rua: no asphalt anywhere else
    for (const id of ['praca', 'feira'] as const) expect(ROOMS[id].floor.join('')).not.toContain('a');
  });

  it('keeps props inside the map and off each other (blocking props never overlap, but the newsstand in front of its wall)', () => {
    for (const id of AREAS) {
      const room = ROOMS[id];
      const owner = new Map<string, string>();
      for (const p of room.props) {
        for (const t of propTiles(p)) {
          expect(t.x >= 0 && t.y >= 0 && t.x < room.cols && t.y < room.rows, `${id}: ${p.id} in bounds`).toBe(true);
          if (!p.blocks) continue;
          // a fence with a gate blocks only along its perimeter: the lot inside is open ground (the stalls stand in it)
          if (p.gaps && t.x !== p.x && t.y !== p.y && t.x !== p.x + (p.w ?? 1) - 1 && t.y !== p.y + (p.h ?? 1) - 1) continue;
          const k = key(t.x, t.y);
          const other = owner.get(k);
          if (other) expect([p.id, other].sort().join('+'), `${id}: overlap at ${k}`).toBe('banca+empena');
          owner.set(k, p.id);
        }
      }
      for (const n of room.npcs) expect(owner.has(key(n.x, n.y)), `${id}: ${n.id} stands on a prop`).toBe(false);
      for (const t of npcSpots(room)) expect(owner.has(key(t.tile.x, t.tile.y)), `${id}: ${t.npc} (slot ${t.slot}) stands on a prop`).toBe(false);
      for (const p of room.props) if (['fachada', 'cerca', 'sebe'].includes(p.kind)) expect(p.art, p.id).toBeTruthy();
    }
  });

  it('has each rua door on row 5 inside its facade, walkable, with the sidewalk tile in front as the arrive tile', () => {
    const rua = ROOMS.rua;
    const grid = buildGrid(rua);
    const doors = rua.portals.filter((p) => !p.edge);
    expect(doors.map((p) => p.to).sort()).toEqual(['academia', 'escola', 'kitnet', 'padaria']);
    for (const p of doors) {
      expect(p.wall, p.id).toBeUndefined();
      expect(p.y).toBe(5);
      const facade = rua.props.find((f) => f.kind === 'fachada' && f.x <= p.x && p.x < f.x + (f.w ?? 1) && f.y <= p.y && p.y < f.y + (f.h ?? 1));
      expect(facade, `${p.id} sits inside a facade`).toBeDefined();
      expect(isWalkable(grid, p.x, p.y), `${p.id} door tile`).toBe(true);
      // the interior's exit brings you back to the sidewalk tile right in front of the door
      const back = ROOMS[p.to].portals.find((q) => q.to === 'rua');
      expect(back?.arrive, `${p.to} exit`).toEqual({ x: p.x, y: 6 });
      expect(isWalkable(grid, p.x, 6)).toBe(true);
      expect(['calcada', 'tijolo']).toContain(floorAt(rua, p.x, 6));
    }
  });

  it('reaches every door, NPC, interact tile and seat of each area from its spawn with findPath', () => {
    for (const id of AREAS) {
      const room = ROOMS[id];
      const grid = buildGrid(room);
      expect(isWalkable(grid, room.spawn.x, room.spawn.y), `${id} spawn`).toBe(true);
      for (const t of targets(room)) {
        // the tile south of an edge portal may be off the map or a hedge
        if (t.what.startsWith('sidewalk in front of') && room.portals.find((p) => `sidewalk in front of ${p.id}` === t.what)?.edge) continue;
        expect(isWalkable(grid, t.tile.x, t.tile.y), `${id}: ${t.what} is walkable`).toBe(true);
        expect(findPath(grid, room.spawn, t.tile), `${id}: path spawn -> ${t.what}`).not.toBeNull();
      }
    }
  });

  it('keeps a clear lane at least 2 tiles wide from spawn to every door, edge, NPC and interact tile', () => {
    for (const id of AREAS) {
      const room = ROOMS[id];
      const grid = buildGrid(room);
      const lane = reachableWide(grid, room.spawn);
      const wide = wideTiles(grid);
      expect(wide.has(key(room.spawn.x, room.spawn.y)), `${id} spawn is wide`).toBe(true);
      expect(lane.has(key(room.spawn.x, room.spawn.y))).toBe(true);
      for (const t of targets(room)) {
        if (t.what.startsWith('seat') || t.what.startsWith('sidewalk in front of')) continue; // a bench seat is a single tile by nature
        const near = [...lane].some((k) => {
          const [x, y] = k.split(',').map(Number);
          return cheb({ x, y }, t.tile) <= 1;
        });
        expect(near, `${id}: ${t.what} touches the wide lane`).toBe(true);
      }
    }
  });

  it('never opens onto void: every border tile is blocked, except the edge portals that lead to the next area', () => {
    for (const id of AREAS) {
      const room = ROOMS[id];
      const grid = buildGrid(room);
      const edge = new Set(room.portals.filter((p) => p.edge).map(edgeKey));
      const border: Tile[] = [];
      for (let x = 0; x < room.cols; x++) for (const y of [0, room.rows - 1]) border.push({ x, y });
      for (let y = 0; y < room.rows; y++) for (const x of [0, room.cols - 1]) border.push({ x, y });
      for (const t of border) expect(isWalkable(grid, t.x, t.y) && !edge.has(edgeKey(t)), `${id}: open border tile ${t.x},${t.y}`).toBe(false);
    }
  });

  it('connects rua - praca - feira with edge portals that arrive at the matching edge, both ways, on walkable tiles', () => {
    const links = [['rua', 'praca'], ['praca', 'feira']] as const;
    for (const [a, b] of links) {
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const ps = ROOMS[from].portals.filter((p) => p.edge && p.to === to);
        expect(ps.length, `${from} -> ${to}`).toBeGreaterThanOrEqual(4);
        const gTo = buildGrid(ROOMS[to]);
        for (const p of ps) {
          expect(p.wall).toBeUndefined();
          expect(isWalkable(buildGrid(ROOMS[from]), p.x, p.y), `${p.id} tile`).toBe(true);
          expect(isWalkable(gTo, p.arrive.x, p.arrive.y), `${p.id} arrive tile`).toBe(true);
          // the arrival tile is never itself an edge portal (no ping-pong), and the way back leads home
          expect(ROOMS[to].portals.some((q) => q.edge && q.x === p.arrive.x && q.y === p.arrive.y)).toBe(false);
          expect(findPath(gTo, p.arrive, ROOMS[to].portals.find((q) => q.edge && q.to === from)!), `${p.id} back`).not.toBeNull();
        }
      }
    }
    // the feira has only the west gate; the rua is not connected to the feira directly
    expect(ROOMS.feira.portals.every((p) => p.to === 'praca')).toBe(true);
    expect(ROOMS.rua.portals.some((p) => p.to === 'feira')).toBe(false);
  });

  it('praca is the spawn: from it every area and every interior is reachable', () => {
    const seen = new Set<string>(['praca']);
    const queue = ['praca'] as (keyof typeof ROOMS)[];
    while (queue.length) for (const p of ROOMS[queue.shift()!].portals) if (!seen.has(p.to)) (seen.add(p.to), queue.push(p.to));
    expect([...seen].sort()).toEqual(['academia', 'escola', 'feira', 'kitnet', 'padaria', 'praca', 'rua']);
  });
});

describe('the feira has room to grow', () => {
  it('marks free stall slots on the grid next to the four built stalls', () => {
    expect(FEIRA_SLOTS.filter((s) => s.vendor)).toHaveLength(4);
    const free = FEIRA_SLOTS.filter((s) => !s.vendor);
    expect(free.length).toBeGreaterThanOrEqual(4);
    const feira = ROOMS.feira;
    const grid = buildGrid(feira);
    for (const s of FEIRA_SLOTS) {
      // every slot's 3x2 footprint is inside the lot; free ones are walkable (nothing built yet) and signed
      for (const t of propTiles({ x: s.x, y: s.y, w: 3, h: 2 })) expect(t.x < feira.cols - 1 && t.y < feira.rows - 1, `${s.id} in the lot`).toBe(true);
      if (!s.vendor) {
        for (const t of propTiles({ x: s.x, y: s.y, w: 3, h: 2 })) expect(isWalkable(grid, t.x, t.y), `${s.id} ${t.x},${t.y} free`).toBe(true);
        expect(feira.props.some((p) => p.id === `vaga_${s.id}`), `${s.id} sign`).toBe(true);
      } else expect(feira.props.some((p) => p.kind === 'feira' && p.vendor === s.vendor && p.x === s.x && p.y === s.y)).toBe(true);
    }
    // plenty of open paving beyond the grid (south band) for the next row
    let open = 0;
    for (let y = 15; y < feira.rows - 1; y++) for (let x = 1; x < feira.cols - 1; x++) if (isWalkable(grid, x, y)) open++;
    expect(open).toBeGreaterThan(60);
  });
});

describe('interiors keep their old rooms', () => {
  it('padaria, kitnet and academia still exist and exit onto the rua', () => {
    for (const id of ['padaria', 'kitnet', 'academia'] as const) {
      expect(ROOMS[id].portals.some((p) => p.to === 'rua')).toBe(true);
      expect(ROOMS[id].outdoor).toBeUndefined();
    }
  });

  it('the escola door on the rua reaches the desk and Dona Lúcia', () => {
    const escola = ROOMS.escola;
    const grid = buildGrid(escola);
    expect(escola.outdoor).toBeUndefined();
    expect(isWalkable(grid, escola.spawn.x, escola.spawn.y)).toBe(true);
    const desk = escola.props.find((p) => p.action === 'escola');
    expect(desk?.interact).toBeTruthy();
    expect(findPath(grid, escola.spawn, desk!.interact!)).not.toBeNull();
    const lucia = escola.npcs.find((n) => n.id === 'lucia');
    expect(findPath(grid, escola.spawn, lucia!.interact)).not.toBeNull();
    expect(escola.portals.find((p) => p.to === 'rua')?.arrive).toEqual({ x: 33, y: 6 });
  });
});
