/**
 * The town around an open-air area (issue #123, DECISIONS "Outdoor framing"): what the camera shows past the walkable tiles, so a street on a
 * big desktop window reads as part of Vila Ipê instead of a small diorama on black. Pure data, no Phaser: the scene draws it, the tests check it.
 *
 * The four open-air areas sit on one town grid (`VILA_LAYOUT`, derived from their edge portals): around the rua you see the real east half
 * of the street and the top of the praça, around the praça the street above it and the feira beside it. Past the street barricades the street
 * goes on as generated blocks of terrace houses, lamps, trees and parked cars. Any tile still empty continues the nearest ground (the sidewalk,
 * the lawn), and above the street's north row stands the skyline strip with open sky above it.
 *
 * Nothing here is walkable: the surround lies outside the room's grid, so pathfinding and the server never see it, and its props carry no
 * action, label or seat, so nothing in it is clickable.
 */
import { DIARY_PLACEMENTS, ROOMS, type PropDef, type PropKind, type RoomDef, type RoomId } from '@tudobem/shared';
import { T, type Rect } from './coords';

/** Tiles of terrain drawn past each edge of an open-air map: more than any window shows around it (a 3840 x 2160 desktop at zoom 5 sees 15). */
export const SURROUND_TILES = 24;
/**
 * The least distance (tiles) past the map edges that props, dashes and neighbour dressing are built. A phone sees far less than that, so it
 * does not keep the sprites of a whole neighbouring area it cannot see (issue #123). A wider window asks for more with `surroundReachFor`, so
 * the cut where the props stop is always off screen (issue #154). Further out stays ground (the tilemap) and sky.
 */
export const SURROUND_PROP_REACH = 8;

/**
 * Prop reach (tiles) for a window: how far past the map edges the camera can show at this size, plus a tile for a house that is only partly in
 * view, rounded up to a multiple of 4 (so a resize drag does not rebuild the room every few pixels). Never under `SURROUND_PROP_REACH`, never
 * past the ground (`SURROUND_TILES`). `view` and `insets` are CSS px; `zoom` is CSS px per art px.
 *
 * The camera clamps to the map on an axis wider than the free region, so the surround only shows on an axis that fits: half of what is left over,
 * shifted by at most the larger HUD inset. The rows above the map (OUTDOOR_TOP_MARGIN) are sky and skyline, never cut.
 */
export function surroundReachFor(map: { cols: number; rows: number }, view: { w: number; h: number }, zoom: number, insets: { top: number; bottom: number; left: number; right: number }): number {
  const past = (size: number, tiles: number, a: number, b: number) => Math.max(0, (size / zoom - tiles * T) / 2 + Math.abs(a - b) / 2 / zoom);
  const tiles = Math.ceil(Math.max(past(view.w, map.cols, insets.left, insets.right), past(view.h, map.rows, insets.top, insets.bottom)) / T) + 1;
  return Math.min(SURROUND_TILES, Math.max(SURROUND_PROP_REACH, Math.ceil(tiles / 4) * 4));
}

/** Top-left tile of each open-air area on the town grid. The rua is the origin; see `vilaLayout.test` for the portal check. */
export const VILA_LAYOUT: Partial<Record<RoomId, { x: number; y: number }>> = (() => {
  const rua = ROOMS.rua;
  // rua_leste continues the street east; the praça hangs below the rua (its edge portals shift x by one); the feira is east of the praça, 3 rows lower
  return { rua: { x: 0, y: 0 }, rua_leste: { x: rua.cols, y: 0 }, praca: { x: 1, y: rua.rows }, feira: { x: 1 + ROOMS.praca.cols, y: rua.rows + 3 } };
})();

/** The rows of Rua dos Ipês on the town grid (the generated blocks repeat them past the barricades). */
const STREET_ROWS = ROOMS.rua.rows;
/** The street's ground, row by row: building row, north calçada, the asphalt, south calçada (row 12 holds the parking bays), the lawns. */
const STREET_PROFILE = 'cccccccc' + 'aaaa' + 'cc' + 'gg';
/** World tile x where the street ends to the west (the rua's barricade) and to the east (rua_leste's). */
const STREET_WEST = 0;
const STREET_EAST = ROOMS.rua.cols + ROOMS.rua_leste.cols;

export interface Surround {
  /** tiles drawn past each edge */
  margin: number;
  /** the ground: `rows + 2 * margin` strings of `cols + 2 * margin` chars; char (i, j) is room tile (i - margin, j - margin) */
  floor: string[];
  /** visual-only props in room tile coords, all outside the room's grid */
  props: PropDef[];
  /** neighbouring areas drawn around this one: their ground dressing is shifted by (dx, dy) tiles */
  neighbours: { def: RoomDef; dx: number; dy: number }[];
  /** lane dashes of the generated street blocks (world px, top-left) */
  dashes: { x: number; y: number }[];
  /** world px y of the bottom of the skyline strip (the top of the building row); open sky above it */
  skyline: number;
  /** this map's x on the town grid (tiles), so repeating art (the skyline) lines up across the areas */
  townX: number;
  /** world px x range the skyline strip and the sky cover */
  skyX0: number;
  skyX1: number;
  /** world px rect the props and dressing are limited to (the map plus the prop reach) */
  reach: Rect;
}

/** Props of a neighbour that are drawn (scenery only: no action, label, seat or stall logic; the diary objects come and go per day, so not those). */
const SKIP_KINDS = new Set<PropKind>(['barraca_chapeus', 'trilho_pedidos', 'tatame']);
const DIARY_IDS = new Set(DIARY_PLACEMENTS.map((p) => p.id));

function visualCopy(p: PropDef, dx: number, dy: number, tag: string): PropDef {
  const { action: _a, label: _l, seat: _s, interact: _i, vendor: _v, ...rest } = p;
  return { ...rest, id: `viz_${tag}_${p.id}`, x: p.x + dx, y: p.y + dy, blocks: false };
}

/** The facades of the generated blocks, in order going away from a barricade: [art, tiles wide]. */
const HOUSES: [string, number][] = [
  ['casas/sobrado_salmao', 6],
  ['casas/terraco_amarelo', 6],
  ['casas/empena', 3],
  ['casas/sobrado_verde', 7],
  ['casas/terraco_verde', 6],
  ['casas/terraco_azul', 6],
  ['casas/empena', 3],
];
const PARKED: [string, number][] = [
  ['park_branco_r', 5],
  ['park_azul_r', 4],
  ['park_vinho_r', 4],
  ['park_bege_l', 5],
  ['park_cinza_l', 4],
];

/**
 * One generated block of street past a barricade, `len` tiles going away from world tile x `edge` (`dir` -1 west, +1 east). Returns its props
 * (world tiles) and the tiles of its parking bays (asphalt in the south calçada).
 */
function streetBlock(edge: number, dir: -1 | 1, len: number, tag: string): { props: PropDef[]; bays: Set<number> } {
  const props: PropDef[] = [];
  const bays = new Set<number>();
  // world x of the first tile of a w-wide thing that starts d tiles away from the barricade
  const at = (d: number, w: number) => (dir > 0 ? edge + d : edge - d - w);
  const P = (id: string, kind: PropKind, d: number, y: number, w: number, art: string, h = 1): void => {
    props.push({ id: `viz_${tag}_${id}`, kind, x: at(d, w), y, w, h, art, blocks: false });
  };
  // the building row: houses side by side, a different order on each side
  let d = 0;
  for (let i = dir > 0 ? 3 : 0; d < len; i++) {
    const [art, w] = HOUSES[i % HOUSES.length];
    P(`casa_${i}`, 'fachada', d, 0, w, art, 6);
    d += w;
  }
  // north calçada: old lamps and street trees on the curb (row 7), a planter by the doors (row 6)
  for (let k = 0; 3 + k * 8 < len; k++) {
    P(`lamp_n${k}`, 'poste', 3 + k * 8, 7, 1, 'props/lamp_old');
    P(`arv_n${k}`, 'arvore', 6 + k * 8, 7, 2, 'props/arvore_rua');
    P(`flor_n${k}`, 'sebe', 1 + k * 8, 6, 1, 'props/bush_flower');
  }
  // south calçada: parked cars in bays (row 12), utility poles and trees (row 13)
  for (let k = 0, d2 = 3; d2 < len; k++) {
    const [name, w] = PARKED[(k + (dir > 0 ? 2 : 0)) % PARKED.length];
    P(`car_${k}`, 'cenario', d2, 12, w, `vehicles/${name}`);
    for (let x = 0; x < w; x++) bays.add(at(d2, w) + x);
    d2 += w + 6;
  }
  for (let k = 0; 2 + k * 8 < len; k++) {
    P(`poste_${k}`, 'poste', 2 + k * 8, 13, 1, 'props/poste_fios');
    P(`arv_s${k}`, 'arvore', 6 + k * 8, 13, 2, 'props/arvore_rua');
  }
  // the lawns: a hedge along the far edge (row 15) and a few flowering bushes (row 14)
  for (let k = 0; k * 2 < len; k++) P(`sebe_${k}`, 'sebe', k * 2, 15, 2, 'props/hedge_wide');
  for (let k = 0; 4 + k * 7 < len; k++) P(`arbusto_${k}`, 'sebe', 4 + k * 7, 14, 1, 'props/bush_flower');
  return { props, bays };
}

/** The mata round the Lagoa: what grows past its west, east and south edges (the north is the Serra do Mar backdrop). */
const MATA: [art: string, kind: PropKind][] = [
  ['props/jeriva', 'arvore'],
  ['lagoa/moita', 'sebe'],
  ['props/ipe_roxo_medium', 'arvore'],
  ['lagoa/moita_b', 'sebe'],
  ['props/jeriva_b', 'arvore'],
  ['props/ipe_branco_medium', 'arvore'],
  ['lagoa/moita', 'sebe'],
  ['props/ipe_medium', 'arvore'],
];

/** A cheap 0..1 hash of two integers (the mata's jitter). */
function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Trees and thickets on a 3-tile lattice (jittered by a tile, the species by hash) past the west, east and south edges of a map, out to
 * `reach` tiles: scenery only, outside the grid.
 */
export function mataRing(cols: number, rows: number, reach: number): PropDef[] {
  const out: PropDef[] = [];
  for (let y = 0; y < rows + reach; y += 3)
    for (let x = -reach; x < cols + reach; x += 3) {
      const jx = x + Math.floor(hash2(x, y) * 2);
      const jy = y + Math.floor(hash2(y, x) * 2);
      const inside = jx >= -1 && jx <= cols && jy <= rows;
      if (inside || jx < -reach || jx >= cols + reach || jy >= rows + reach) continue;
      const [art, kind] = MATA[Math.floor(hash2(jx * 7, jy * 13) * MATA.length)];
      out.push({ id: `viz_mata_${jx}_${jy}`, kind, x: jx, y: jy, w: art.startsWith('lagoa/moita') ? 2 : 1, art, blocks: false });
    }
  return out;
}

/** The surround of an open-air area, or null for an interior. `reach` (tiles) is how far past the edges props are built (`surroundReachFor`). */
export function surroundFor(def: RoomDef, propReach = SURROUND_PROP_REACH): Surround | null {
  if (!def.outdoor) return null;
  const M = SURROUND_TILES;
  const R = Math.min(M, Math.max(0, propReach));
  const home = VILA_LAYOUT[def.id];
  const ox = home?.x ?? 0;
  const oy = home?.y ?? 0;
  const reach: Rect = { x0: -R * T, y0: -R * T, x1: (def.cols + R) * T, y1: (def.rows + R) * T };
  const inReach = (p: PropDef) => {
    const w = p.w ?? 1;
    const h = p.h ?? 1;
    return p.x + w > -R && p.x < def.cols + R && p.y + h > -R && p.y < def.rows + R;
  };

  // every area on the town grid, in this room's tile coords
  const areas: { def: RoomDef; dx: number; dy: number }[] = [];
  if (home) for (const [id, at] of Object.entries(VILA_LAYOUT)) areas.push({ def: ROOMS[id as RoomId], dx: at.x - ox, dy: at.y - oy });
  else areas.push({ def, dx: 0, dy: 0 });
  const cellOf = (x: number, y: number): string | undefined => {
    for (const a of areas) {
      const ch = a.def.floor[y - a.dy]?.[x - a.dx];
      if (ch !== undefined) return ch;
    }
    return undefined;
  };

  // the generated blocks past both barricades (only on the town grid)
  const props: PropDef[] = [];
  const dashes: { x: number; y: number }[] = [];
  const bays = new Set<number>();
  const streetY0 = -oy;
  if (home) {
    const len = M + Math.max(ROOMS.rua.cols, ROOMS.rua_leste.cols) + 2;
    for (const [edge, dir, tag] of [
      [STREET_WEST, -1, 'w'],
      [STREET_EAST, 1, 'e'],
    ] as const) {
      const b = streetBlock(edge, dir, len, `blk${tag}`);
      for (const x of b.bays) bays.add(x - ox);
      for (const p of b.props) {
        const q = { ...p, x: p.x - ox, y: p.y - oy };
        if (inReach(q)) props.push(q);
      }
      // lane dashes down the middle, every 32 px like the street's own
      const x0 = dir > 0 ? edge * T : (edge - len) * T;
      for (let x = x0 + 4; x < x0 + len * T - 10; x += 32) {
        const rx = x - ox * T;
        if (rx > reach.x0 && rx < reach.x1) dashes.push({ x: rx, y: (streetY0 + 8) * T + 26 });
      }
    }
  }
  const blockCell = (x: number, y: number): string | undefined => {
    const wx = x + ox;
    const wy = y - streetY0;
    if (!home || wy < 0 || wy >= STREET_ROWS || (wx >= STREET_WEST && wx < STREET_EAST)) return undefined;
    return wy === 12 && bays.has(x) ? 'a' : STREET_PROFILE[wy];
  };

  // the ground: areas and blocks first, then each row continues its nearest tile sideways, then empty rows copy the nearest row
  const W = def.cols + 2 * M;
  const H = def.rows + 2 * M;
  const grid: (string | undefined)[][] = [];
  for (let j = 0; j < H; j++) {
    const row: (string | undefined)[] = [];
    for (let i = 0; i < W; i++) row.push(cellOf(i - M, j - M) ?? blockCell(i - M, j - M));
    grid.push(row);
  }
  for (const row of grid) {
    // the tile to the west carries on east, then whatever is still empty at the west end takes the first tile of the row
    for (let i = 1; i < W; i++) row[i] ??= row[i - 1];
    for (let i = W - 2; i >= 0; i--) row[i] ??= row[i + 1];
  }
  const filled = (j: number) => grid[j][0] !== undefined;
  for (let j = 0; j < H; j++) {
    if (filled(j)) continue;
    let k = 1;
    while (k < H && !(j - k >= 0 && filled(j - k)) && !(j + k < H && filled(j + k))) k++;
    const src = j - k >= 0 && filled(j - k) ? j - k : j + k;
    grid[j] = [...grid[src]];
  }
  const floor = grid.map((r) => r.map((c) => c ?? 'c').join(''));

  // the Lagoa sits in the mata: trees all round past its edges
  if (def.id === 'lagoa') props.push(...mataRing(def.cols, def.rows, R));

  // the neighbours' own props and dressing, as scenery
  const neighbours = areas.filter((a) => a.def.id !== def.id);
  for (const n of neighbours) {
    for (const p of n.def.props) {
      if (SKIP_KINDS.has(p.kind) || DIARY_IDS.has(p.id)) continue;
      const q = visualCopy(p, n.dx, n.dy, n.def.id);
      if (inReach(q)) props.push(q);
    }
  }

  // the skyline stands on the street's north edge (the top of the building row), across everything the camera can show
  return { margin: M, floor, props, neighbours, dashes, skyline: streetY0 * T, townX: ox, skyX0: -M * T, skyX1: (def.cols + M) * T, reach };
}

/** World rect the surround's ground covers. */
export function surroundRect(def: { cols: number; rows: number }): Rect {
  const M = SURROUND_TILES;
  return { x0: -M * T, y0: -M * T, x1: (def.cols + M) * T, y1: (def.rows + M) * T };
}
