import { describe, expect, it } from 'vitest';
import { buildGrid, FEIRA_SLOTS, floorAt, FLOOR_CHARS, isWalkable, key, propTiles, ROOMS, seatTiles, type RoomDef, type RoomGrid, type Tile } from './rooms.js';
import { SCHEDULES } from './schedules.js';
import { findPath, pathDuration } from './path.js';


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

const AREAS = ['rua', 'rua_leste', 'praca', 'feira'] as const;
const SIZES = { rua: [21, 16], rua_leste: [19, 16], praca: [32, 24], feira: [32, 20] } as const;
const edgeKey = (p: { x: number; y: number }) => key(p.x, p.y);

describe('Vila Ipê split into four open-air areas (rua, rua_leste, praca, feira)', () => {
  it('has the four areas at their sizes, all outdoor, praca the spawn room (id kept)', () => {
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
    expect(ROOMS.rua_leste.name).toBe('Rua dos Ipês (leste)');
    expect(ROOMS.rua_leste.gloss).toBe('Ipê Street (east)');
    expect(ROOMS.rua.cols + ROOMS.rua_leste.cols).toBe(40); // the old street, cut in two
    expect(ROOMS.feira.name).toBe('Feira de Rua');
  });

  it('has the zones of the plan: the street, sidewalks, the lawns, the brick, the setts', () => {
    const rua = ROOMS.rua;
    expect(floorAt(rua, 10, 9)).toBe('asfalto');
    expect(floorAt(rua, 20, 7)).toBe('calcada');
    expect(floorAt(ROOMS.rua_leste, 11, 12)).toBe('calcada');
    expect(floorAt(ROOMS.rua_leste, 10, 9)).toBe('asfalto');
    expect(floorAt(rua, 5, 14)).toBe('grama');
    expect(floorAt(rua, 17, 14)).toBe('tijolo'); // the brick path down to the praça
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
    const doors = ROOMS.rua.portals.filter((p) => !p.edge);
    expect(doors.map((p) => p.to).sort()).toEqual(['kitnet', 'padaria']);
    for (const p of [...doors, ...ROOMS.rua_leste.portals.filter((q) => !q.edge && q.to !== 'aeroporto' && q.to !== 'praia')]) {
      const rua = ROOMS[p.to === 'academia' || p.to === 'escola' ? 'rua_leste' : 'rua'];
      const grid = buildGrid(rua);
      expect(p.wall, p.id).toBeUndefined();
      expect(p.y).toBe(5);
      const facade = rua.props.find((f) => f.kind === 'fachada' && f.x <= p.x && p.x < f.x + (f.w ?? 1) && f.y <= p.y && p.y < f.y + (f.h ?? 1));
      expect(facade, `${p.id} sits inside a facade`).toBeDefined();
      expect(isWalkable(grid, p.x, p.y), `${p.id} door tile`).toBe(true);
      // the interior's exit brings you back to the sidewalk tile right in front of the door
      const back = ROOMS[p.to].portals.find((q) => q.to === rua.id);
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
    const links = [['rua', 'rua_leste'], ['rua', 'praca'], ['praca', 'feira']] as const;
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
    expect([...seen].sort()).toEqual(['academia', 'aeroporto', 'escola', 'feira', 'kitnet', 'padaria', 'praca', 'praia', 'rua', 'rua_leste']);
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
    // the game cart and its board share the open paving, with their own art, close enough that the board is not a second walk
    const cart = feira.props.find((p) => p.id === 'carrinho_jogos')!;
    const sign = feira.props.find((p) => p.id === 'placa_jogos')!;
    expect(cart.art).toBe('props/carrinho_feira');
    expect(sign.art).toBe('props/placa_feira');
    expect(isWalkable(grid, cart.interact!.x, cart.interact!.y)).toBe(true);
    expect(isWalkable(grid, sign.interact!.x, sign.interact!.y)).toBe(true);
    const near = Math.max(Math.abs(sign.interact!.x - (cart.x + 1)), Math.abs(sign.interact!.y - cart.y));
    expect(near).toBeLessThanOrEqual(3);
    const gate = { x: 1, y: 8 };
    const toSign = findPath(grid, gate, sign.interact!);
    expect(toSign).not.toBeNull();
    expect(pathDuration(gate, toSign!)).toBeLessThan(5_500);

    // plenty of open paving beyond the grid (south band) for the next row
    let open = 0;
    for (let y = 15; y < feira.rows - 1; y++) for (let x = 1; x < feira.cols - 1; x++) if (isWalkable(grid, x, y)) open++;
    expect(open).toBeGreaterThan(60);
  });
});

describe('interiors keep their old rooms', () => {
  it('padaria, kitnet and academia still exist and exit onto the half of the street their door is on', () => {
    for (const [id, half] of [['padaria', 'rua'], ['kitnet', 'rua'], ['academia', 'rua_leste']] as const) {
      expect(ROOMS[id].portals.some((p) => p.to === half)).toBe(true);
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
    expect(escola.portals.find((p) => p.to === 'rua_leste')?.arrive).toEqual({ x: 12, y: 6 });
  });
});

describe('the street is two areas (rua west, rua_leste east)', () => {
  const reach = (from: keyof typeof ROOMS) => {
    const seen = new Set<string>([from]);
    const queue = [from];
    while (queue.length) for (const p of ROOMS[queue.shift()!].portals) if (!seen.has(p.to)) (seen.add(p.to), queue.push(p.to as keyof typeof ROOMS));
    return seen;
  };

  it('reaches each half from the other and from the praça, and the praça from each half', () => {
    for (const a of ['rua', 'rua_leste', 'praca'] as const) for (const b of ['rua', 'rua_leste', 'praca'] as const) expect(reach(a).has(b), `${a} -> ${b}`).toBe(true);
    // the rua_leste is only joined to the rua (not to the praça directly)
    expect(ROOMS.rua_leste.portals.filter((p) => p.edge).every((p) => p.to === 'rua')).toBe(true);
    expect(ROOMS.rua_leste.portals.filter((p) => !p.edge).map((p) => p.to).sort()).toEqual(['academia', 'aeroporto', 'escola', 'praia']);
    expect(ROOMS.rua.portals.filter((p) => !p.edge).map((p) => p.to).sort()).toEqual(['kitnet', 'padaria']);
  });

  it('walks you across the seam on a walkable path, on every walkable seam row, and back', () => {
    const w = ROOMS.rua;
    const e = ROOMS.rua_leste;
    const gw = buildGrid(w);
    const ge = buildGrid(e);
    // the open tiles of the last column of one half are exactly the first column of the other, row for row
    const openRows = (g: ReturnType<typeof buildGrid>, x: number, rows: number) => Array.from({ length: rows }, (_, y) => y).filter((y) => isWalkable(g, x, y));
    expect(openRows(gw, w.cols - 1, w.rows)).toEqual(openRows(ge, 0, e.rows));
    const seamW = w.portals.filter((p) => p.edge && p.to === 'rua_leste').map((p) => p.y).sort((a, b) => a - b);
    const seamE = e.portals.filter((p) => p.edge && p.to === 'rua').map((p) => p.y).sort((a, b) => a - b);
    expect(seamW).toEqual(openRows(gw, w.cols - 1, w.rows));
    expect(seamE).toEqual(seamW);
    for (const p of w.portals.filter((q) => q.edge && q.to === 'rua_leste')) expect(findPath(ge, p.arrive, e.portals.find((q) => q.to === 'rua' && q.y === p.y)!)).not.toBeNull();
    // a lane of the street runs through the seam (rows 8-11 are open on both sides)
    for (const y of [8, 9, 10, 11]) expect(seamW).toContain(y);
    // west spawn to the far east end of the street and the bus stop
    expect(findPath(gw, w.spawn, w.portals.find((q) => q.to === 'rua_leste')!)).not.toBeNull();
    expect(findPath(ge, { x: 1, y: 6 }, { x: 7, y: 13 })).not.toBeNull();
  });

  it('has every interior door return to the half it was entered from, on the sidewalk tile in front of the door', () => {
    for (const half of ['rua', 'rua_leste'] as const) {
      const room = ROOMS[half];
      // (the airport and beach buses are not doors: they have their own tests)
      for (const door of room.portals.filter((p) => !p.edge && p.to !== 'aeroporto' && p.to !== 'praia')) {
        const inside = ROOMS[door.to];
        const exits = inside.portals.filter((p) => p.to === half || p.to === (half === 'rua' ? 'rua_leste' : 'rua'));
        expect(exits, `${door.to}`).toHaveLength(1);
        expect(exits[0].to, `${door.to} exits onto ${half}`).toBe(half);
        expect(exits[0].arrive).toEqual({ x: door.x, y: 6 });
        // and the door leads in, to a walkable arrival tile that is not the exit
        expect(isWalkable(buildGrid(inside), door.arrive.x, door.arrive.y)).toBe(true);
      }
    }
  });

  it('keeps the facades, doors and parking bays whole: no prop crosses the cut, and the two halves tile the old 40 columns', () => {
    for (const id of ['rua', 'rua_leste'] as const) {
      const room = ROOMS[id];
      for (const p of room.props) for (const t of propTiles(p)) expect(t.x >= 0 && t.x < room.cols, `${id}: ${p.id}`).toBe(true);
    }
    // the cut is the seam between the Edifício Ipê (ends at x20) and the academia (starts at x21 = rua_leste x0)
    const edificio = ROOMS.rua.props.find((p) => p.id === 'edificio')!;
    expect(edificio.x + (edificio.w ?? 1)).toBe(ROOMS.rua.cols);
    expect(ROOMS.rua_leste.props.find((p) => p.id === 'academia')!.x).toBe(0);
    expect(ROOMS.rua.cols + ROOMS.rua_leste.cols).toBe(40);
  });
});

describe('the Praia (PRAIA-PLAN.md 1.3) and the party boat (5.1)', () => {
  const praia = ROOMS.praia;
  const grid = buildGrid(praia);

  it('is outdoor, 40 x 28, every floor char known, spawning at the bus stop', () => {
    expect([praia.cols, praia.rows]).toEqual([40, 28]);
    expect(praia.outdoor).toBe(true);
    expect(praia.private).toBe(false);
    expect(praia.floor).toHaveLength(praia.rows);
    for (const row of praia.floor) expect(row).toHaveLength(praia.cols);
    for (const ch of praia.floor.join('') + ROOMS.barco_festa.floor.join('')) expect(FLOOR_CHARS[ch], `floor char ${ch}`).toBeDefined();
    expect(praia.spawn).toEqual({ x: 3, y: 4 });
    expect(isWalkable(grid, 3, 4)).toBe(true);
  });

  it('water is never walkable, sand and deck are', () => {
    expect(floorAt(praia, 10, 10)).toBe('areia');
    expect(floorAt(praia, 10, 22)).toBe('agua');
    expect(floorAt(praia, 28, 20)).toBe('deque');
    for (let y = 0; y < praia.rows; y++) for (let x = 0; x < praia.cols; x++) if (praia.floor[y][x] === 'o') expect(isWalkable(grid, x, y), `water ${x},${y}`).toBe(false);
    expect(isWalkable(grid, 10, 12)).toBe(true);
    for (let y = 12; y <= 25; y++) expect(isWalkable(grid, 28, y) && isWalkable(grid, 29, y), `pier row ${y}`).toBe(true);
  });

  it('never opens onto void: every border tile is blocked (water, the mureta, the fence and the costão)', () => {
    for (const room of [praia, ROOMS.barco_festa]) {
      const g = buildGrid(room);
      const edge = new Set(room.portals.filter((p) => p.edge).map(edgeKey));
      for (let x = 0; x < room.cols; x++) for (const y of [0, room.rows - 1]) expect(isWalkable(g, x, y) && !edge.has(edgeKey({ x, y })), `${room.id}: open border ${x},${y}`).toBe(false);
      for (let y = 0; y < room.rows; y++) for (const x of [0, room.cols - 1]) expect(isWalkable(g, x, y) && !edge.has(edgeKey({ x, y })), `${room.id}: open border ${x},${y}`).toBe(false);
    }
  });

  it('reaches every door, NPC, interact tile and seat from the bus stop, on a lane at least 2 tiles wide', () => {
    const lane = reachableWide(grid, praia.spawn);
    for (const t of targets(praia)) {
      if (t.what.startsWith('sidewalk in front of')) continue;
      expect(isWalkable(grid, t.tile.x, t.tile.y), `${t.what} is walkable`).toBe(true);
      expect(findPath(grid, praia.spawn, t.tile), `path to ${t.what}`).not.toBeNull();
      if (t.what.startsWith('seat')) continue;
      expect([...lane].some((k) => cheb({ x: Number(k.split(',')[0]), y: Number(k.split(',')[1]) }, t.tile) <= 1), `${t.what} touches the wide lane`).toBe(true);
    }
  });

  it('leaves no empty 4 x 4 of sand: every such square has a prop, a decal or the water in it (the HOWTO beauty checklist)', () => {
    const dressed = new Set<string>();
    for (const p of praia.props) for (const t of propTiles(p)) dressed.add(`${t.x},${t.y}`);
    for (const n of praia.npcs) dressed.add(`${n.x},${n.y}`);
    const bare: string[] = [];
    for (let y = 0; y + 4 <= praia.rows; y++) for (let x = 0; x + 4 <= praia.cols; x++) {
      let empty = true;
      for (let dy = 0; dy < 4 && empty; dy++) for (let dx = 0; dx < 4; dx++) {
        if (praia.floor[y + dy][x + dx] !== 's' || dressed.has(`${x + dx},${y + dy}`)) {
          empty = false;
          break;
        }
      }
      if (empty) bare.push(`${x},${y}`);
    }
    expect(bare, 'empty 4 x 4 squares of sand at (top-left)').toEqual([]);
  });

  it('closes the lagoa: a ring of sand round its water, a spot on its south bank', () => {
    const water: Tile[] = [];
    for (let y = 8; y <= 12; y++) for (let x = 1; x <= 6; x++) if (praia.floor[y][x] === 'o') water.push({ x, y });
    expect(water.length).toBeGreaterThanOrEqual(9);
    for (const w of water) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ch = praia.floor[w.y + dy][w.x + dx];
      expect(ch === 'o' || ch === 's', `lagoa edge ${w.x + dx},${w.y + dy}`).toBe(true);
    }
    const spot = praia.props.find((p) => p.kind === 'pesca_spot' && p.water === 'lagoa')!;
    expect(spot).toBeDefined();
    expect(water.some((w) => cheb(w, spot) === 1)).toBe(true);
  });

  it('every fishing spot looks onto its own water, and the boats sit on their decks', () => {
    const spots = [...praia.props, ...ROOMS.barco_festa.props].filter((p) => p.kind === 'pesca_spot');
    expect(new Set(spots.map((p) => p.water))).toEqual(new Set(['praia', 'lagoa', 'remo', 'pesca', 'alto_mar', 'festa']));
    for (const p of spots) {
      expect(p.action, p.id).toBe('pesca');
      expect(p.blocks, p.id).toBe(false);
      expect(p.interact, p.id).toBeDefined();
    }
    for (const id of ['barco_remo', 'barco_pesca', 'barco_alto_mar']) {
      const b = praia.props.find((p) => p.id === id)!;
      for (const t of propTiles(b)) expect(floorAt(praia, t.x, t.y), `${id} deck`).toBe('deque');
    }
  });

  it('runs the 875 both ways between the rua leste and the beach', () => {
    const out = ROOMS.rua_leste.portals.find((p) => p.to === 'praia')!;
    const back = praia.portals.find((p) => p.to === 'rua_leste')!;
    expect(out.id).toBe('rua_praia');
    expect(out.arrive).toEqual(praia.spawn);
    const gl = buildGrid(ROOMS.rua_leste);
    expect(isWalkable(gl, out.x, out.y)).toBe(true);
    expect(isWalkable(gl, back.arrive.x, back.arrive.y)).toBe(true);
    expect(findPath(gl, back.arrive, out)).not.toBeNull();
    expect(findPath(grid, praia.spawn, back)).not.toBeNull();
  });

  it('the party deck: all planks inside a ring of sea, the gangway an edge portal back to the pier', () => {
    const deck = ROOMS.barco_festa;
    const g = buildGrid(deck);
    expect([deck.cols, deck.rows]).toEqual([16, 10]);
    expect(deck.npcs).toHaveLength(0);
    const gangway = deck.portals.find((p) => p.to === 'praia')!;
    expect(gangway.edge).toBe(true);
    expect(isWalkable(g, gangway.x, gangway.y)).toBe(true);
    expect(isWalkable(grid, gangway.arrive.x, gangway.arrive.y)).toBe(true);
    expect(floorAt(praia, gangway.arrive.x, gangway.arrive.y)).toBe('deque');
    for (const p of deck.props.filter((q) => q.interact)) expect(findPath(g, deck.spawn, p.interact!), p.id).not.toBeNull();
    expect(findPath(g, deck.spawn, gangway)).not.toBeNull();
  });
});

describe('the airport (where a new arrival starts)', () => {
  const room = ROOMS.aeroporto;
  const grid = buildGrid(room);

  it('walks from the gate to everything the tutorial points at, and out to the bus', () => {
    expect(isWalkable(grid, room.spawn.x, room.spawn.y)).toBe(true);
    const goals: [string, { x: number; y: number }][] = [
      ...room.npcs.map((n): [string, { x: number; y: number }] => [n.id, n.interact]),
      ...room.props.filter((p) => p.interact).map((p): [string, { x: number; y: number }] => [p.id, p.interact!]),
      ...seatTiles(room).map((t): [string, { x: number; y: number }] => [`seat ${t.prop.id}`, t]),
      ...room.portals.map((p): [string, { x: number; y: number }] => [p.id, p]),
    ];
    for (const [id, t] of goals) {
      expect(isWalkable(grid, t.x, t.y), `${id} at ${t.x},${t.y}`).toBe(true);
      expect(findPath(grid, room.spawn, t), `${id} reachable`).not.toBeNull();
    }
  });

  it('keeps the apron behind the glass: no tile north of the glass front can be reached', () => {
    for (let y = 0; y <= 10; y++) for (let x = 0; x < room.cols; x++) if (isWalkable(grid, x, y)) expect(findPath(grid, room.spawn, { x, y }), `${x},${y}`).toBeNull();
  });

  it('runs the bus both ways between the airport and the stop on Rua dos Ipês (leste)', () => {
    const out = room.portals.find((p) => p.to === 'rua_leste')!;
    const back = ROOMS.rua_leste.portals.find((p) => p.to === 'aeroporto')!;
    expect(isWalkable(buildGrid(ROOMS.rua_leste), out.arrive.x, out.arrive.y)).toBe(true);
    expect(isWalkable(grid, back.arrive.x, back.arrive.y)).toBe(true);
    expect(findPath(grid, back.arrive, out)).not.toBeNull();
    expect(findPath(buildGrid(ROOMS.rua_leste), out.arrive, back)).not.toBeNull();
  });
});
