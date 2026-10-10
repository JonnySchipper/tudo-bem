import type { Appearance, Bilingual, Dir, PlacedFurniture, RoomId, Tile } from './types.js';
import { furnitureById } from './catalog.js';
import { SCHEDULES, type ScheduleSlot } from './schedules.js';
import { bundledObjects } from './roomLayoutFiles.js';

export type PropKind =
  | 'ipe'
  | 'banco'
  | 'poste'
  | 'banca'
  | 'barraca_chapeus'
  | 'quiosque'
  | 'poleiro'
  | 'canteiro'
  | 'lixeira'
  | 'bicicletario'
  | 'balcao'
  | 'vitrine'
  | 'banqueta'
  | 'mesa'
  | 'cadeira_padaria'
  | 'trilho_pedidos'
  | 'vaso'
  | 'cama'
  | 'cozinha'
  | 'caixa'
  | 'orelhao'
  | 'placa_rua'
  | 'estufa'
  | 'mesa_cafe'
  | 'jornais'
  | 'saco_lixo'
  | 'floreira'
  | 'tatame'
  | 'parede_faixas'
  | 'quadro_fila'
  | 'banco_espectador'
  | 'vestiario'
  | 'quadro_foto'
  // Vila Ipê (Phase 5): building fronts and roofs (`art` = manifest key), the fountain, fences, hedges/scenery (`art`), the bus stop
  | 'fachada'
  | 'cenario'
  | 'fonte'
  | 'cerca'
  | 'sebe'
  | 'ponto_onibus'
  // V2 composition: any tree with its own sprite (`art`), the purple and white ipês, shade trees, palms, sidewalk pit trees
  | 'arvore'
  // Feira livre (Phase 9): a market stall that is open or folded by the game clock (`art` = `feira/<name>` of the open variant), and
  // the Hortifrúti crate at the banca (`art`), which sells at every hour
  | 'feira'
  | 'hortifruti'
  // Pet Shop do Seu Dito (#234): the fish tank, the dog pen, the cat pen, the pet-food shelves, the grooming tub
  | 'aquario'
  | 'cercadinho'
  | 'gatil'
  | 'prateleira_racao'
  | 'banheira';

export type PropAction = 'shop_hats' | 'minigame' | 'kiosk' | 'parrot_perch' | 'catalog' | 'bjj_roll' | 'feira_stall' | 'street_snack' | 'checkers' | 'buy_gi' | 'escola' | 'academy_elevator' | 'academy_board' | 'padaria_door' | 'padaria_counter' | 'feira_cart' | 'feira_sign' | 'leaderboard' | 'petshop_counter' | 'petshop_pen';

export interface PropDef {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  blocks: boolean;
  seat?: Dir;
  action?: PropAction;
  /** Tile the avatar walks to before an action fires. */
  interact?: Tile;
  label?: Bilingual;
  /** Landmark scale (the Praça's hero ipê). */
  hero?: boolean;
  /** Pixel-view sprite key for kinds that come in many looks (`fachada`, `sebe`, `cerca`); the server ignores it. */
  art?: string;
  /** Feira stalls and the Hortifrúti crate: who serves here (`feira.ts` VENDORS). */
  vendor?: 'tia_lu' | 'ze' | 'chico' | 'rosa' | 'banca';
  /** A `cerca` with gaps is blocked only along its perimeter, except on these tiles (the gate). The inside stays walkable. */
  gaps?: Tile[];
  /** Pixel view: this prop is a light source at night (a warm pool at its foot, or the preset of its sprite key in `lightPresets.ts`). */
  lightAtNight?: boolean;
  /** Pixel view: the sprite is nudged this many px sideways inside its tile (two small objects on one tile). */
  ox?: number;
  /** Pixel view: nudge down in px. Design mode's free placement uses this; bundled layouts leave it unset. */
  oy?: number;
}

export type WallSide = 'left' | 'right';

export interface WallDecor {
  kind: 'fachada_padaria' | 'mural' | 'predio' | 'metro' | 'janela_rua' | 'prateleira_paes' | 'lousa' | 'relogio' | 'azulejos' | 'poster' | 'janela' | 'placa' | 'cobogo' | 'tv' | 'toldo' | 'foto' | 'quadro_racas';
  wall: WallSide;
  /** Start and end along the wall in tile units. */
  from: number;
  to: number;
  text?: string;
}

export interface PortalDef {
  id: string;
  x: number;
  y: number;
  /** Which interior wall the door is in (isometric-era data). Outdoor doors (Vila Ipê) leave it out: the door is part of a facade sprite. */
  wall?: WallSide;
  to: RoomId;
  /** Where you appear in the destination room. */
  arrive: Tile;
  arriveDir: Dir;
  label: Bilingual;
  /** Where the door art is, in tile units (may be fractional), for the guide arrow and the click box of an outdoor door. */
  doorAt?: { x: number; y: number };
  /** An edge portal (split areas): walk off the map edge. The server moves you when a walk ends on this tile; no door art, no click box. */
  edge?: boolean;
}

/**
 * NPCs that give recados and can be befriended before they have a room to stand in. Empty now: Dona Graça moved into the padaria with
 * the schedules, and Tia Lu into the feira (Phase 9). A future NPC can wait here until its room exists; the id stays valid the whole time.
 */
export const OFFSTAGE_NPCS: Partial<Record<NpcId, { name: string; role: Bilingual }>> = {};

/** The feira vendors (Phase 9): Tia Lu (fruit), Seu Zé (vegetables), Seu Chico (pastel and caldo de cana), Dona Rosa (flowers). */
export type NpcId = 'carlos' | 'nanda' | 'julia' | 'graca' | 'prof' | 'tia_lu' | 'ze' | 'chico' | 'rosa' | 'lucia' | 'celia' | 'agente' | 'comissaria' | 'dito';

export interface NpcDef {
  id: NpcId;
  name: string;
  role: Bilingual;
  /** Home room tile. With a `schedule` it is only the fallback (where the NPC stands if the schedule says nothing); the live position comes from `npcMotion`. */
  x: number;
  y: number;
  dir: Dir;
  /** Default spot to talk from; a schedule slot may name its own. */
  interact: Tile;
  /** Where the NPC is over the game day (`schedules.ts`). Without one the NPC stands at `x, y` at every hour and its tile blocks statically. */
  schedule?: ScheduleSlot[];
  appearance: Appearance;
  hat: string | null;
  /** Ambient lines, shown over the NPC's head now and then. */
  idleLines: Bilingual[];
}

export type FloorKind = 'calcada' | 'grama' | 'tijolo' | 'xadrez' | 'ladrilho' | 'madeira' | 'asfalto' | 'tatame' | 'paralelepipedo' | 'granilite';

export interface RoomDef {
  id: RoomId;
  name: string;
  gloss: string;
  cols: number;
  rows: number;
  /** Rows of chars; see FLOOR_CHARS. */
  floor: string[];
  wallHeight: number;
  wallColor: string;
  wallTrim: string;
  lighting: 'tarde' | 'manha' | 'dia';
  /** An open-air map (Vila Ipê): no wall band, the terrain runs to the map edge, buildings are props. */
  outdoor?: boolean;
  /**
   * Rows of an open-air map that are under a roof (the airport's terminal, glass front included): the sky and the clock still light them,
   * but no rain falls there.
   */
  roof?: { y0: number; y1: number };
  spawn: Tile;
  props: PropDef[];
  walls: WallDecor[];
  /**
   * The complete north-wall decor of the top-down pixel view, authored for it (all `wall: 'right'`, columns -1..cols-1 where -1 is the
   * corner above the west wall). When present the pixel view draws exactly this and ignores `walls` (the isometric view keeps using
   * `walls`, whose left-wall items cannot be seen edge-on from above). Without it the pixel view uses the room's own right-wall decor and
   * moves the left-wall decor to free stretches (client `relocatedWestDecor`).
   */
  pixelWalls?: WallDecor[];
  portals: PortalDef[];
  npcs: NpcDef[];
  /** Private rooms (kitnet) are instanced per owner. */
  private: boolean;
}

export const FLOOR_CHARS: Record<string, FloorKind> = {
  c: 'calcada',
  g: 'grama',
  t: 'tijolo',
  k: 'xadrez',
  l: 'ladrilho',
  m: 'madeira',
  a: 'asfalto',
  j: 'tatame',
  p: 'paralelepipedo',
  z: 'granilite',
};

// ---------------------------------------------------------------- Vila Ipê, split into three open-air areas ("Split into areas")
//
//  rua   Rua dos Ipês     21 x 16  the west half of the street (it was 40 x 16 before the street was split again): rows 0-5 building row (padaria, banca,
//                                  Edifício Ipê; doors on row 5) | 6-7 north calçada | 8-11 the street | 12-13 south calçada | 14-15 the lawns and the brick path down
//                                  to the praça (edge portals on row 15, x15-18); east edge (col 20, y6-14) on to rua_leste
//  rua_leste Rua dos Ipês (leste) 25 x 16  the east half (old x21-39, plus the pet shop's 6-tile front since #234): academia, escola and pet shop doors,
//                                  the bus stop, the parked taxi; west edge (col 0, y6-14) back to the rua
//  praca Praça Central    32 x 24  the fountain plaza, coreto, playground, games tables, kiosk, Nanda's stall; north edge (row 0, x14-17) back to the rua,
//                                  east edge (col 31, y10-13) on to the feira
//  feira Feira Livre      32 x 20  a fenced lot of setts with a grid of stall slots (FEIRA_SLOTS: four taken, four free, room beyond); west edge (col 0, y7-10)
//
// Walk off an edge and you arrive at the matching edge of the next area (`PortalDef.edge`; the server moves you when a walk ends on the tile).

/** The street was one 40-tile map; it is cut at x21, the seam between Edifício Ipê (x11-20) and the academia (x21-30): no facade, door, crosswalk or bay is split. */
const RUA_CUT = 21;
const RUA_COLS = RUA_CUT;
/** The east half grew by the pet shop's front (6 tiles) in #234; the street was one 40-tile map before that. */
const PETSHOP_FRONT_W = 6;
const RUA_LESTE_COLS = 40 - RUA_CUT + PETSHOP_FRONT_W; // 25
const RUA_ROWS = 16;
const PRACA_COLS = 32;
const PRACA_ROWS = 24;
const FEIRA_COLS = 32;
const AERO_COLS = 30;
const AERO_ROWS = 26;
const FEIRA_ROWS = 20;

/** Parking bays on the south curb of Rua dos Ipês: first and last tile x of each, all on row 12 (asphalt notches in the sidewalk). Per area (the east one is in rua_leste's own tiles). */
export const PARKING_BAYS_IPES: readonly [number, number][] = [[2, 6]];
export const PARKING_BAYS_IPES_LESTE: readonly [number, number][] = [[12, 16]];

type Painter = (ch: string, x0: number, y0: number, x1: number, y1: number) => void;
function floorGrid(cols: number, rows: number, base: string, paintAll: (paint: Painter) => void): string[] {
  const g: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => base));
  paintAll((ch, x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  });
  return g.map((r) => r.join(''));
}

function ruaFloor(): string[] {
  return floorGrid(RUA_COLS, RUA_ROWS, 'c', (paint) => {
    paint('a', 0, 8, RUA_COLS - 1, 11); // Rua dos Ipês
    for (const [x0, x1] of PARKING_BAYS_IPES) paint('a', x0, 12, x1, 12); // parking bays recessed into the south sidewalk
    paint('g', 0, 14, RUA_COLS - 1, 15); // the lawns below the street
    paint('t', 15, 12, 18, 15); // the brick path down to the praça
  });
}

function ruaLesteFloor(): string[] {
  return floorGrid(RUA_LESTE_COLS, RUA_ROWS, 'c', (paint) => {
    paint('a', 0, 8, RUA_LESTE_COLS - 1, 11);
    for (const [x0, x1] of PARKING_BAYS_IPES_LESTE) paint('a', x0, 12, x1, 12);
    paint('g', 0, 14, RUA_LESTE_COLS - 1, 15);
  });
}

function pracaFloor(): string[] {
  return floorGrid(PRACA_COLS, PRACA_ROWS, 'c', (paint) => {
    // four lawns around the brick cross
    paint('g', 2, 2, 11, 9);
    paint('g', 20, 2, 29, 9);
    paint('g', 2, 14, 11, 21);
    paint('g', 20, 14, 29, 21);
    paint('c', 12, 1, 13, 3); // the kiosk's pavement
    paint('c', 18, 1, 21, 3); // Nanda's pavement
    // brick: the N-S axis from the rua entrance, the E-W bar to the feira, the plaza round the fountain
    paint('t', 14, 0, 17, 7);
    paint('t', 15, 15, 16, 23);
    paint('t', 2, 11, 31, 12);
    paint('t', 20, 10, 31, 13);
    paint('t', 12, 8, 19, 14);
  });
}

function feiraFloor(): string[] {
  return floorGrid(FEIRA_COLS, FEIRA_ROWS, 'p', (paint) => {
    paint('t', 0, 7, 2, 10); // the brick threshold from the praça
  });
}

/**
 * The airport, top to bottom: the runway (rows 0-1), a strip of grass, the apron with the plane at the gate (rows 3-7: seen through the
 * glass, nobody walks there), the terminal's glass front (row 8), the terminal floor (rows 9-20), a low glass front with the exit doors
 * (row 21), the sidewalk (row 22) and the road where the bus to the Vila waits (row 23).
 */
function aeroFloor(): string[] {
  return floorGrid(AERO_COLS, AERO_ROWS, 'z', (paint) => {
    paint('g', 0, 0, AERO_COLS - 1, 1);
    paint('a', 0, 2, AERO_COLS - 1, 3);
    paint('g', 0, 4, AERO_COLS - 1, 4);
    paint('a', 0, 5, AERO_COLS - 1, 9);
    paint('c', 0, 24, AERO_COLS - 1, 24);
    paint('a', 0, 25, AERO_COLS - 1, 25);
  });
}

/**
 * The feira's stall grid: stalls are 3x2 on a 6-tile pitch, two rows (north y3, south y11) with the aisle between. A slot with a `vendor`
 * is built in `layouts/feira.json`; a free one shows a "vaga livre" sign. To grow the feira, fill a free slot or add columns/rows to the
 * grid (the lot has free paving to the east and south) and give the new stall a vendor in `feira.ts` + `schedules.ts`.
 */
export const FEIRA_SLOTS: { id: string; x: number; y: number; vendor: 'tia_lu' | 'ze' | 'chico' | 'rosa' | null }[] = [
  { id: 'a1', x: 6, y: 3, vendor: 'tia_lu' },
  { id: 'a2', x: 12, y: 3, vendor: 'ze' },
  { id: 'a3', x: 18, y: 3, vendor: null },
  { id: 'a4', x: 24, y: 3, vendor: null },
  { id: 'b1', x: 6, y: 11, vendor: 'chico' },
  { id: 'b2', x: 12, y: 11, vendor: 'rosa' },
  { id: 'b3', x: 18, y: 11, vendor: null },
  { id: 'b4', x: 24, y: 11, vendor: null },
];

/** Edge portals along one edge: one per tile, each arriving at the matching tile of the neighbour (`map` turns this tile into the arrival tile). */
function edgePortals(id: string, to: RoomId, tiles: Tile[], map: (t: Tile) => Tile, arriveDir: Dir, label: Bilingual): PortalDef[] {
  return tiles.map((t, i) => ({ id: `${id}_${i}`, x: t.x, y: t.y, to, arrive: map(t), arriveDir, label, edge: true }));
}
const span = (n: number, from: number): number[] => Array.from({ length: n }, (_, i) => from + i);

// ---------------------------------------------------------------- rua (west half)
/** The seam between the two halves of the street: edge portals on every row of the sidewalks and the street (rows 6-13); a bush closes the one-tile lawn strip (row 14). */
const RUA_SEAM_ROWS = span(8, 6);
const RUA_LESTE_LABEL: Bilingual = { pt: 'Rua dos Ipês (leste)', en: 'Ipê Street (east)' }; // needs_br: true

const rua: RoomDef = {
  id: 'rua',
  name: 'Rua dos Ipês',
  gloss: 'Ipê Street',
  cols: RUA_COLS,
  rows: RUA_ROWS,
  outdoor: true,
  floor: ruaFloor(),
  wallHeight: 0,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 16, y: 13 },
  props: bundledObjects('rua'),
  walls: [],
  portals: [
    {
      id: 'praca_padaria',
      x: 4,
      y: 5,
      to: 'padaria',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 3.5, y: 5 },
      label: { pt: 'Padaria do Seu Carlos', en: 'Seu Carlos’s bakery' },
    },
    {
      id: 'praca_kitnet',
      x: 12,
      y: 5,
      to: 'kitnet',
      arrive: { x: 1, y: 5 },
      arriveDir: 'SE',
      doorAt: { x: 12, y: 5 },
      label: { pt: 'Edifício Ipê — Minha kitnet', en: 'Ipê Building — my studio apartment' },
    },
    ...edgePortals('rua_praca', 'praca', span(4, 15).map((x) => ({ x, y: 15 })), (t) => ({ x: t.x - 1, y: 1 }), 'SE', { pt: 'Praça Central', en: 'Central Square' }),
    ...edgePortals('rua_leste', 'rua_leste', RUA_SEAM_ROWS.map((y) => ({ x: RUA_COLS - 1, y })), (t) => ({ x: 1, y: t.y }), 'SE', RUA_LESTE_LABEL),
  ],
  npcs: [],
  private: false,
};

// ---------------------------------------------------------------- rua_leste (east half)
const ruaLeste: RoomDef = {
  id: 'rua_leste',
  name: 'Rua dos Ipês (leste)', // needs_br: true
  gloss: 'Ipê Street (east)',
  cols: RUA_LESTE_COLS,
  rows: RUA_ROWS,
  outdoor: true,
  floor: ruaLesteFloor(),
  wallHeight: 0,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 8, y: 7 },
  props: bundledObjects('rua_leste'),
  walls: [],
  portals: [
    {
      id: 'praca_academia',
      x: 5,
      y: 5,
      to: 'academia',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 4.5, y: 5 },
      label: { pt: 'Academia do Bairro', en: 'Neighborhood Academy' },
    },
    {
      id: 'rua_escola',
      x: 12,
      y: 5,
      to: 'escola',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 12, y: 5 },
      label: { pt: 'Escola da Praça', en: 'Square school' },
    },
    {
      id: 'rua_petshop',
      x: 19,
      y: 5,
      to: 'petshop',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 19, y: 5 },
      label: { pt: 'Pet Shop do Seu Dito', en: 'Seu Dito’s pet shop' }, // needs_br: true
    },
    // the airport bus (line 875) stops here too: the little sign next to the shelter
    { id: 'rua_aeroporto', x: 9, y: 12, to: 'aeroporto', arrive: { x: 20, y: 24 }, arriveDir: 'NW', doorAt: { x: 9, y: 12 }, label: { pt: 'Ônibus para o Aeroporto', en: 'Bus to the Airport' } },
    ...edgePortals('leste_rua', 'rua', RUA_SEAM_ROWS.map((y) => ({ x: 0, y })), (t) => ({ x: RUA_COLS - 2, y: t.y }), 'SW', { pt: 'Rua dos Ipês', en: 'Ipê Street' }),
  ],
  npcs: [],
  private: false,
};

// ---------------------------------------------------------------- praca
const praca: RoomDef = {
  id: 'praca',
  name: 'Praça Central',
  gloss: 'Central Square',
  cols: PRACA_COLS,
  rows: PRACA_ROWS,
  outdoor: true,
  floor: pracaFloor(),
  wallHeight: 0,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 16, y: 16 },
  props: bundledObjects('praca'),
  walls: [],
  portals: [
    ...edgePortals('praca_rua', 'rua', span(4, 14).map((x) => ({ x, y: 0 })), (t) => ({ x: t.x + 1, y: 14 }), 'NW', { pt: 'Rua dos Ipês', en: 'Ipê Street' }),
    ...edgePortals('praca_feira', 'feira', span(4, 10).map((y) => ({ x: 31, y })), (t) => ({ x: 1, y: t.y - 3 }), 'SE', { pt: 'Feira Livre', en: 'Street Market' }),
  ],
  npcs: [
    {
      id: 'nanda',
      name: 'Nanda',
      role: { pt: 'Loja de chapéus', en: 'Hat stall' },
      x: 20,
      y: 1,
      dir: 'SW',
      interact: { x: 19, y: 3 },
      schedule: SCHEDULES.nanda,
      appearance: { body: 'esguio', skin: 5, hair: 'trancas', hairColor: 0, top: 'camisa', topColor: 1, bottom: 'calca', bottomColor: 2, shoes: 2, face: 'doce', extra: 'brincos', idle: 'cintura' },
      hat: 'chapeu_palha',
      idleLines: [
        { pt: 'Esse boné verde fica legal!', en: 'That green cap looks great!' },
        { pt: 'Hoje tem boné verde de graça!', en: 'Free green caps today!' },
        // needs_br: true (language diary catalog line)
        { pt: 'Hoje o sol tá forte.', en: 'The sun is strong today.' },
      ],
    },
    {
      id: 'julia',
      name: 'Júlia',
      role: { pt: 'Guia da praça', en: 'Square guide' },
      // near the plaza, on the path to the fountain, far enough from the kiosk that her plate and bubbles never cover its sign
      x: 13,
      y: 9,
      dir: 'SW',
      interact: { x: 13, y: 10 },
      schedule: SCHEDULES.julia,
      appearance: { body: 'medio', skin: 2, hair: 'ondulado', hairColor: 2, top: 'blusa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 2, face: 'suave', extra: 'brincos', idle: 'solto' },
      hat: null,
      idleLines: [
        { pt: 'Oi! Precisa de ajuda? Fala comigo!', en: 'Hi! Need help? Talk to me!' },
        { pt: 'A padaria do Seu Carlos é ali!', en: 'Seu Carlos’s bakery is over there!' },
        // needs_br: true (language diary catalog lines)
        { pt: 'O vizinho senta aqui de manhã.', en: 'The neighbor sits here in the morning.' },
        { pt: 'Bora dar um passeio?', en: 'Shall we go for a stroll?' },
      ],
    },
  ],
  private: false,
};

// ---------------------------------------------------------------- feira
const feira: RoomDef = {
  id: 'feira',
  name: 'Feira Livre',
  gloss: 'Street Market',
  cols: FEIRA_COLS,
  rows: FEIRA_ROWS,
  outdoor: true,
  floor: feiraFloor(),
  wallHeight: 0,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 3, y: 8 },
  props: bundledObjects('feira'),
  walls: [],
  portals: [...edgePortals('feira_praca', 'praca', span(4, 7).map((y) => ({ x: 0, y })), (t) => ({ x: 30, y: t.y + 3 }), 'SW', { pt: 'Praça Central', en: 'Central Square' })],
  npcs: [
    // ---- the feira vendors (Phase 9). needs_br: true (names and every call). Each stands in front of their stall 06:00-13:00 (`schedules.ts`).
    {
      id: 'tia_lu',
      name: 'Tia Lu',
      role: { pt: 'Frutas da feira', en: 'Fruit at the feira' },
      x: 7,
      y: 5,
      dir: 'SW',
      interact: { x: 7, y: 6 },
      schedule: SCHEDULES.tia_lu,
      appearance: { body: 'medio', skin: 4, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 0, bottom: 'saia', bottomColor: 3, shoes: 3, face: 'doce', extra: 'brincos', idle: 'cintura' },
      hat: null,
      idleLines: [
        { pt: 'Olha a banana! Três por cinco!', en: 'Get your bananas! Three for five!' },
        { pt: 'Laranja doce, freguesa!', en: 'Sweet oranges, ma’am!' },
        { pt: 'Maçã fresquinha, leva uma!', en: 'Fresh apples, take one!' },
      ],
    },
    {
      id: 'ze',
      name: 'Seu Zé',
      role: { pt: 'Verduras da feira', en: 'Vegetables at the feira' },
      x: 13,
      y: 5,
      dir: 'SW',
      interact: { x: 13, y: 6 },
      schedule: SCHEDULES.ze,
      appearance: { body: 'forte', skin: 3, hair: 'raspado', hairColor: 5, top: 'camisa', topColor: 11, bottom: 'calca', bottomColor: 10, shoes: 2, face: 'maduro', extra: 'bigode', idle: 'bracos' },
      hat: null,
      idleLines: [
        { pt: 'Olha o tomate! Bem vermelhinho!', en: 'Get your tomatoes! Nice and red!' },
        { pt: 'Alface fresca, freguesa!', en: 'Fresh lettuce, ma’am!' },
      ],
    },
    {
      id: 'chico',
      name: 'Seu Chico',
      role: { pt: 'Pastel e caldo de cana', en: 'Pastel and sugarcane juice' },
      x: 7,
      y: 13,
      dir: 'SW',
      interact: { x: 7, y: 14 },
      schedule: SCHEDULES.chico,
      appearance: { body: 'medio', skin: 5, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 1, face: 'marcante', extra: 'barba', idle: 'solto' },
      hat: null,
      idleLines: [
        { pt: 'Pastel quentinho!', en: 'Nice hot pastel!' },
        { pt: 'Caldo de cana geladinho!', en: 'Ice-cold sugarcane juice!' },
      ],
    },
    {
      id: 'rosa',
      name: 'Dona Rosa',
      role: { pt: 'Flores da feira', en: 'Flowers at the feira' },
      x: 13,
      y: 13,
      dir: 'SW',
      interact: { x: 13, y: 14 },
      schedule: SCHEDULES.rosa,
      appearance: { body: 'esguio', skin: 2, hair: 'ondulado', hairColor: 3, top: 'blusa', topColor: 9, bottom: 'saia', bottomColor: 7, shoes: 0, face: 'suave', extra: 'brincos', idle: 'solto' },
      hat: null,
      idleLines: [
        { pt: 'Flores, freguesa!', en: 'Flowers, ma’am!' },
        { pt: 'Flor bonita pra casa, leva!', en: 'Pretty flowers for your home, take some!' },
      ],
    },
  ],
  private: false,
};

const padaria: RoomDef = {
  id: 'padaria',
  name: 'Padaria do Seu Carlos',
  gloss: 'Seu Carlos’s Bakery',
  cols: 10,
  rows: 9,
  floor: ['llllllllll', 'llllllllll', 'llllllllll', 'llllllllll', 'llllllllll', 'llllllllll', 'llllllllll', 'llllllllll', 'llllllllll'],
  wallHeight: 140,
  wallColor: '#F5E6D3',
  wallTrim: '#C45C26',
  lighting: 'manha',
  spawn: { x: 1, y: 6 },
  props: bundledObjects('padaria'),
  walls: [
    { kind: 'azulejos', wall: 'left', from: 0, to: 9 },
    { kind: 'azulejos', wall: 'right', from: 0, to: 10 },
    { kind: 'janela', wall: 'left', from: 2, to: 4 },
    { kind: 'prateleira_paes', wall: 'right', from: 1, to: 7, text: 'PADARIA DO SEU CARLOS · DESDE 1978' },
    { kind: 'toldo', wall: 'right', from: 1, to: 6 },
    { kind: 'lousa', wall: 'right', from: 7, to: 10, text: 'CARDÁPIO' },
    { kind: 'relogio', wall: 'left', from: 7, to: 8 },
    { kind: 'tv', wall: 'left', from: 0, to: 2 },
  ],
  // Top-down layout (10 columns + the corner): TV | 4 tiles of bread shelves under the toldo | street window | clock | blackboard.
  pixelWalls: [
    { kind: 'azulejos', wall: 'right', from: 0, to: 10 },
    { kind: 'tv', wall: 'right', from: -1, to: 1 },
    { kind: 'prateleira_paes', wall: 'right', from: 1, to: 5, text: 'PADARIA DO SEU CARLOS · DESDE 1978' },
    { kind: 'toldo', wall: 'right', from: 1, to: 5 },
    { kind: 'janela', wall: 'right', from: 5, to: 7 },
    { kind: 'relogio', wall: 'right', from: 7, to: 8 },
    { kind: 'lousa', wall: 'right', from: 8, to: 10, text: 'CARDÁPIO' },
  ],
  portals: [
    {
      id: 'padaria_praca',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'rua',
      arrive: { x: 4, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'Voltar para a rua', en: 'Back to the street' },
    },
  ],
  npcs: [
    {
      id: 'carlos',
      name: 'Seu Carlos',
      role: { pt: 'Padeiro', en: 'Baker' },
      x: 3,
      y: 1,
      dir: 'SE',
      interact: { x: 3, y: 3 },
      schedule: SCHEDULES.carlos,
      appearance: { body: 'forte', skin: 3, hair: 'curto', hairColor: 5, top: 'camisa', topColor: 3, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'bigode', idle: 'solto' },
      hat: 'chapeu_chef',
      idleLines: [
        { pt: 'Pão quentinho saindo!', en: 'Warm bread coming out!' },
        { pt: 'Bom dia! Vai um cafezinho?', en: 'Good morning! How about a little coffee?' },
        { pt: 'Chega mais, pode pedir!', en: 'Come on over, go ahead and order!' },
      ],
    },
    {
      // Night shift: the same counter spot, and the same authored scene, Me vê um and Conversa subjects as Seu Carlos (D12)
      id: 'graca',
      name: 'Dona Graça',
      role: { pt: 'Padeira do turno da noite', en: 'Night-shift baker' },
      x: 3,
      y: 1,
      dir: 'SE',
      interact: { x: 3, y: 3 },
      schedule: SCHEDULES.graca,
      appearance: { body: 'medio', skin: 6, hair: 'coque', hairColor: 5, top: 'blusa', topColor: 7, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'oculos', idle: 'bracos' },
      hat: null,
      // needs_br: true (new lines, Dona Graça's voice: warm, a joker, night shift)
      idleLines: [
        { pt: 'De noite o pão sai quentinho!', en: 'Warm bread at night!' },
        { pt: 'Boa noite! Bora de cafezinho?', en: 'Good evening! How about a little coffee?' },
        { pt: 'Ih, a noite é longa. Chega mais!', en: 'Oh, the night is long. Come on over!' },
      ],
    },
  ],
  private: false,
};

const kitnet: RoomDef = {
  id: 'kitnet',
  name: 'Kitnet',
  gloss: 'Studio apartment',
  cols: 8,
  rows: 8,
  floor: ['mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm'],
  wallHeight: 130,
  wallColor: '#F5E6D3',
  wallTrim: '#8B5E3C',
  lighting: 'dia',
  spawn: { x: 1, y: 5 },
  props: bundledObjects('kitnet'),
  walls: [
    { kind: 'janela_rua', wall: 'right', from: 3, to: 6 },
    { kind: 'poster', wall: 'left', from: 1, to: 3, text: 'SP' },
    { kind: 'cobogo', wall: 'left', from: 6, to: 8 },
    { kind: 'cobogo', wall: 'right', from: 0, to: 1 },
    { kind: 'foto', wall: 'right', from: 6, to: 8 },
  ],
  portals: [
    {
      id: 'kitnet_praca',
      x: 0,
      y: 5,
      wall: 'left',
      to: 'rua',
      arrive: { x: 12, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'Descer para a rua', en: 'Go down to the street' },
    },
  ],
  npcs: [],
  private: true,
};

const academia: RoomDef = {
  id: 'academia',
  name: 'Academia do Bairro',
  gloss: 'Neighborhood Academy',
  cols: 11,
  rows: 9,
  floor: [
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
    'jjjjjjjjjjj',
  ],
  wallHeight: 148,
  wallColor: '#F5E6D3',
  wallTrim: '#8B5E3C',
  lighting: 'manha',
  spawn: { x: 1, y: 7 },
  props: bundledObjects('academia'),
  walls: [
    { kind: 'placa', wall: 'right', from: 0, to: 4, text: 'ACADEMIA DO BAIRRO' },
    { kind: 'janela', wall: 'left', from: 3, to: 5 },
    { kind: 'poster', wall: 'left', from: 6, to: 8, text: 'RESPEITO · TREINO · AMIZADE' },
    { kind: 'mural', wall: 'right', from: 5, to: 9, text: 'TREINO · COMUNIDADE' },
  ],
  // Top-down layout (11 columns + the corner): RESPEITO poster | sign | window | mural.
  pixelWalls: [
    { kind: 'poster', wall: 'right', from: -1, to: 1, text: 'RESPEITO · TREINO · AMIZADE' },
    { kind: 'placa', wall: 'right', from: 1, to: 5, text: 'ACADEMIA DO BAIRRO' },
    { kind: 'janela', wall: 'right', from: 5, to: 7 },
    { kind: 'mural', wall: 'right', from: 7, to: 11, text: 'TREINO · COMUNIDADE' },
  ],
  portals: [
    {
      id: 'academia_praca',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'rua_leste',
      arrive: { x: 5, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'SAÍDA · Rua', en: 'Exit to the street' },
    },
  ],
  npcs: [
    {
      // The BJJ teacher: stands by the tatame at every hour (no schedule), so her tile blocks statically and D12 holds for the academia
      id: 'prof',
      name: 'Professora Bia',
      role: { pt: 'Professora de jiu-jitsu', en: 'Jiu-jitsu teacher' },
      x: 8,
      y: 4,
      dir: 'NW',
      interact: { x: 8, y: 5 },
      appearance: { body: 'forte', skin: 4, hair: 'coque', hairColor: 0, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 4, shoes: 0, face: 'marcante', extra: 'nenhum', idle: 'bracos' },
      hat: null,
      // needs_br: true (new lines)
      idleLines: [
        { pt: 'Bora treinar?', en: 'Ready to train?' },
        { pt: 'Respeito primeiro, depois o tatame.', en: 'Respect first, then the mat.' },
        { pt: 'Água é vida. Bebe bastante!', en: 'Water is life. Drink plenty!' },
        // needs_br: true (language diary catalog lines)
        { pt: 'Cumprimente com um sorriso.', en: 'Greet with a smile.' },
        { pt: 'O parceiro te espera no tatame.', en: 'Your partner is waiting on the mat.' },
        { pt: 'Isso é disciplina.', en: 'That is discipline.' },
      ],
    },
  ],
  private: false,
};

/**
 * Empty player-academy floor. One instance per academy (`andar@<id>`), reached from the elevator
 * in Academia do Bairro. No street door, no professor, no roll queue. Guests may sit and watch.
 * needs_br: true (the room name and the exit label)
 */
const andar: RoomDef = {
  id: 'andar',
  name: 'Andar',
  gloss: 'Academy floor',
  cols: 9,
  rows: 7,
  floor: ['jjjjjjjjj', 'jjjjjjjjj', 'jjjjjjjjj', 'jjjjjjjjj', 'jjjjjjjjj', 'jjjjjjjjj', 'jjjjjjjjj'],
  wallHeight: 148,
  wallColor: '#F5E6D3',
  wallTrim: '#8B5E3C',
  lighting: 'manha',
  spawn: { x: 1, y: 5 },
  props: bundledObjects('andar'),
  // No public-academy placa: that sprite is painted "ACADEMIA DO BAIRRO". The crest and the floor bar name this room.
  walls: [{ kind: 'janela', wall: 'right', from: 5, to: 8 }],
  pixelWalls: [{ kind: 'janela', wall: 'right', from: 5, to: 8 }],
  portals: [
    {
      id: 'andar_academia',
      x: 0,
      y: 5,
      wall: 'left',
      to: 'academia',
      arrive: { x: 5, y: 7 },
      arriveDir: 'SE',
      label: { pt: 'Elevador · Academia do Bairro', en: 'Elevator · Neighborhood Academy' },
    },
  ],
  npcs: [],
  private: false,
};

const escola: RoomDef = {
  id: 'escola',
  name: 'Escola da Praça',
  gloss: 'Square school',
  cols: 10,
  rows: 8,
  floor: ['mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm', 'mmmmmmmmmm'],
  wallHeight: 140,
  wallColor: '#F5E6D3',
  wallTrim: '#8B5E3C',
  lighting: 'manha',
  spawn: { x: 1, y: 6 },
  props: bundledObjects('escola'),
  walls: [
    { kind: 'lousa', wall: 'right', from: 1, to: 3, text: 'AULA' },
    { kind: 'janela', wall: 'right', from: 4, to: 6 },
    { kind: 'poster', wall: 'right', from: 7, to: 9, text: 'ESCOLA' },
  ],
  pixelWalls: [
    { kind: 'lousa', wall: 'right', from: 1, to: 3, text: 'AULA' },
    { kind: 'janela', wall: 'right', from: 4, to: 6 },
    { kind: 'poster', wall: 'right', from: 7, to: 9, text: 'ESCOLA' },
  ],
  portals: [
    {
      id: 'escola_rua',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'rua_leste',
      arrive: { x: 12, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'SAÍDA · Rua', en: 'Exit to the street' },
    },
  ],
  npcs: [
    {
      id: 'lucia',
      name: 'Dona Lúcia',
      role: { pt: 'Professora da escola', en: 'School teacher' },
      x: 6,
      y: 2,
      dir: 'SW',
      interact: { x: 6, y: 3 },
      appearance: { body: 'medio', skin: 3, hair: 'coque', hairColor: 4, top: 'blusa', topColor: 0, bottom: 'saia', bottomColor: 2, shoes: 2, face: 'maduro', extra: 'oculos', idle: 'bracos' },
      hat: null,
      // needs_br: true
      idleLines: [
        { pt: 'Vamos praticar uma palavra?', en: 'Shall we practice a word?' },
        { pt: 'A aula é curtinha.', en: 'The class is a short one.' },
        // needs_br: true (language diary catalog lines)
        { pt: 'Como é o seu nome?', en: 'What is your name?' },
        { pt: 'A lição de hoje é curtinha.', en: 'Today’s lesson is a short one.' },
      ],
    },
  ],
  private: false,
};

// ---------------------------------------------------------------- petshop
/**
 * Pet Shop do Seu Dito (#234, `docs/PET-STORE-PLAN.md`): the counter and Seu Dito in the north-west corner, the dog pen (cercadinho) and
 * the cat pen (gatil) along the north wall, the grooming corner (banho e tosa) east, the food shelves west, beds and bowls south. The
 * animals in the pens are drawn by the client from the day's litter (`penLitter`), not props. Needs_br: every Portuguese string here.
 */
const DITO: NpcDef = {
  id: 'dito',
  name: 'Seu Dito',
  role: { pt: 'Dono do pet shop', en: 'Pet shop owner' },
  x: 1,
  y: 1,
  dir: 'SW',
  interact: { x: 2, y: 3 },
  appearance: { body: 'forte', skin: 6, hair: 'raspado', hairColor: 4, top: 'camisa', topColor: 3, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'barba', idle: 'bracos' },
  hat: null,
  // each one is a diary line anchor (`dito.idle0..3`)
  idleLines: [
    { pt: 'Hoje chegou um filhote novo!', en: 'A new puppy arrived today!' },
    { pt: 'Carinho atrás da orelha, eles adoram.', en: 'A scratch behind the ear, they love it.' },
    { pt: 'Senta! Isso. Bom menino.', en: 'Sit! That’s it. Good boy.' },
    { pt: 'Vira-lata é o cachorro mais fiel que existe.', en: 'A mutt is the most loyal dog there is.' },
  ],
};

const PETSHOP_WALLS: WallDecor[] = [
  { kind: 'poster', wall: 'right', from: -1, to: 1, text: 'ADOÇÃO' },
  { kind: 'quadro_racas', wall: 'right', from: 1, to: 5 },
  { kind: 'placa', wall: 'right', from: 5, to: 8, text: 'VETERINÁRIO' },
  { kind: 'placa', wall: 'right', from: 9, to: 12, text: 'BANHO E TOSA' },
];

const petshop: RoomDef = {
  id: 'petshop',
  name: 'Pet Shop do Seu Dito', // needs_br: true
  gloss: 'Seu Dito’s pet shop',
  cols: 12,
  rows: 9,
  floor: Array.from({ length: 9 }, () => 'l'.repeat(12)),
  wallHeight: 140,
  wallColor: '#F5E6D3',
  wallTrim: '#8B5E3C',
  lighting: 'manha',
  spawn: { x: 1, y: 6 },
  props: bundledObjects('petshop'),
  walls: PETSHOP_WALLS,
  pixelWalls: PETSHOP_WALLS,
  portals: [
    {
      id: 'petshop_rua',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'rua_leste',
      arrive: { x: 19, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'SAÍDA · Rua', en: 'Exit to the street' },
    },
  ],
  npcs: [DITO],
  private: false,
};

// ---------------------------------------------------------------- aeroporto
/**
 * Where every new arrival starts: the plane has just come in to gate 3. A walk-through tutorial runs north to south (client
 * `airportTutorial.ts`): out of the gate, read a sign, Célia at the information desk hands over the camera and the cartela, a first photo
 * (of the plane through the glass: shots here cost no film), the passport check with the agent, a seat, a wave, a pão de queijo, and the
 * bus to the Vila. Anyone can come back by the bus from the stop on Rua dos Ipês (leste). The fourteen camera words and the reading words
 * of the diary's Chegada area are the things in here (`hall_*`). Needs_br: every Portuguese string in this room.
 */
const AERO_VILA: Bilingual = { pt: 'Ônibus 875 · Vila Ipê', en: 'Bus 875 · to Vila Ipê' };

const aeroporto: RoomDef = {
  id: 'aeroporto',
  name: 'Aeroporto',
  gloss: 'Airport',
  cols: AERO_COLS,
  rows: AERO_ROWS,
  outdoor: true,
  roof: { y0: 10, y1: 23 },
  floor: aeroFloor(),
  wallHeight: 0,
  wallColor: '#d8d4e4',
  wallTrim: '#8b8bab',
  lighting: 'dia',
  spawn: { x: 11, y: 11 },
  props: bundledObjects('aeroporto'),
  walls: [],
  portals: [{ id: 'aero_vila', x: 19, y: 24, to: 'rua_leste', arrive: { x: 9, y: 13 }, arriveDir: 'SW', doorAt: { x: 18.5, y: 25 }, label: AERO_VILA }],
  npcs: [
    {
      id: 'celia',
      name: 'Célia',
      role: { pt: 'Informações do aeroporto', en: 'Airport information desk' },
      x: 22,
      y: 11,
      dir: 'SW',
      interact: { x: 22, y: 13 },
      appearance: { body: 'medio', skin: 4, hair: 'coque', hairColor: 0, top: 'camisa', topColor: 5, bottom: 'saia', bottomColor: 10, shoes: 0, face: 'doce', extra: 'brincos', idle: 'bracos' },
      hat: null,
      idleLines: [
        { pt: 'Bem-vindo ao Brasil!', en: 'Welcome to Brazil!' },
        { pt: 'Precisa de ajuda? É só perguntar.', en: 'Need help? Just ask.' },
      ],
    },
    {
      id: 'agente',
      name: 'Agente Paulo',
      role: { pt: 'Polícia Federal · passaportes', en: 'Federal Police · passports' },
      x: 12,
      y: 15,
      dir: 'SW',
      interact: { x: 12, y: 17 },
      appearance: { body: 'forte', skin: 3, hair: 'raspado', hairColor: 0, top: 'camisa', topColor: 10, bottom: 'calca', bottomColor: 10, shoes: 2, face: 'marcante', extra: 'nenhum', idle: 'bracos' },
      hat: null,
      idleLines: [
        { pt: 'Próximo, por favor!', en: 'Next, please!' },
        { pt: 'Passaporte, por favor.', en: 'Passport, please.' },
      ],
    },
  ],
  private: false,
};

// ---------------------------------------------------------------- desembarque
/**
 * The first room every new account enters: the small arrivals hall at the end of the jet bridge, before the airport. It is quiet on
 * purpose (a few seats, the plane through the glass, a baggage belt, a water cooler, one flight attendant) so the guided tutorial
 * (client `desembarqueTutorial.ts`) can teach one thing at a time. The automatic doors at the bottom lead into the airport at gate 3.
 * Needs_br: every Portuguese string in this room.
 */
const DESEMB_COLS = 14;
const DESEMB_ROWS = 15;
/** The exit to the airport: the tutorial's last step points here. */
export const DESEMBARQUE_EXIT = 'desemb_aero';
/** The comissária: the first person a new arrival talks to, and the first word of the diary. */
export const DESEMBARQUE_HOST: NpcId = 'comissaria';

function desembFloor(): string[] {
  return floorGrid(DESEMB_COLS, DESEMB_ROWS, 'z', (paint) => {
    paint('g', 0, 0, DESEMB_COLS - 1, 1);
    paint('a', 0, 2, DESEMB_COLS - 1, 6);
  });
}

const desembarque: RoomDef = {
  id: 'desembarque',
  name: 'Desembarque',
  gloss: 'Arrivals',
  cols: DESEMB_COLS,
  rows: DESEMB_ROWS,
  outdoor: true,
  roof: { y0: 7, y1: 14 },
  floor: desembFloor(),
  wallHeight: 0,
  wallColor: '#d8d4e4',
  wallTrim: '#8b8bab',
  lighting: 'dia',
  spawn: { x: 11, y: 8 },
  props: bundledObjects('desembarque'),
  walls: [],
  portals: [
    {
      id: DESEMBARQUE_EXIT,
      x: 6,
      y: 14,
      to: 'aeroporto',
      arrive: { x: 11, y: 11 },
      arriveDir: 'SW',
      doorAt: { x: 6.5, y: 14 },
      label: { pt: 'Siga para o aeroporto', en: 'On to the airport' },
    },
  ],
  npcs: [
    {
      id: 'comissaria',
      name: 'Comissária Lia',
      role: { pt: 'Comissária de bordo', en: 'Flight attendant' },
      x: 6,
      y: 10,
      dir: 'SW',
      interact: { x: 6, y: 11 },
      appearance: { body: 'medio', skin: 2, hair: 'coque', hairColor: 2, top: 'camisa', topColor: 7, bottom: 'saia', bottomColor: 10, shoes: 1, face: 'doce', extra: 'brincos', idle: 'bracos' },
      hat: null,
      // the first line is the first word of every new diary (the diary's Chegada area: "bem-vindo")
      idleLines: [
        { pt: 'Bem-vindo ao Brasil!', en: 'Welcome to Brazil!' },
        { pt: 'A porta do aeroporto é ali embaixo.', en: 'The door to the airport is down there.' },
      ],
    },
  ],
  private: false,
};

export const ROOMS: Record<RoomId, RoomDef> = { praca, rua, rua_leste: ruaLeste, feira, padaria, kitnet, academia, escola, andar, aeroporto, desembarque, petshop };
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];

export const isRoomId = (v: unknown): v is RoomId => typeof v === 'string' && v in ROOMS;

export function floorAt(room: RoomDef, x: number, y: number): FloorKind {
  const ch = room.floor[y]?.[x] ?? 'c';
  return FLOOR_CHARS[ch] ?? 'calcada';
}

export function propTiles(p: { x: number; y: number; w?: number; h?: number }): Tile[] {
  const out: Tile[] = [];
  for (let dx = 0; dx < (p.w ?? 1); dx++) for (let dy = 0; dy < (p.h ?? 1); dy++) out.push({ x: p.x + dx, y: p.y + dy });
  return out;
}

/** Every sit spot in the room. A seated prop wider than one tile (the Academia arquibancada) seats one per tile. */
export function seatTiles(room: RoomDef): (Tile & { dir: Dir; prop: PropDef })[] {
  return room.props.flatMap((p) => (p.seat ? propTiles(p).map((t) => ({ ...t, dir: p.seat!, prop: p })) : []));
}

/** Open-mat footprint (the tatame prop). Players and the roll queue may stand here; ambiance may not. */
export function openMatTiles(room: RoomDef): Tile[] {
  return room.props.filter((p) => p.kind === 'tatame').flatMap((p) => propTiles(p));
}

export interface RoomGrid {
  cols: number;
  rows: number;
  blocked: Set<string>;
  seats: Map<string, Dir>;
  /** Tiles reserved (door, fixed props) where furniture cannot be placed. */
  reserved: Set<string>;
}

export const key = (x: number, y: number) => `${x},${y}`;

/** Facing for a sitter on a rotated furniture seat. rot 0 faces SE, rot 1 faces SW. */
export const furnitureSeatDir = (rot: 0 | 1): Dir => (rot === 0 ? 'SE' : 'SW');

export function buildGrid(room: RoomDef, furniture: PlacedFurniture[] = []): RoomGrid {
  const blocked = new Set<string>();
  const seats = new Map<string, Dir>();
  const reserved = new Set<string>();
  for (const p of room.props) {
    for (const t of propTiles(p)) {
      reserved.add(key(t.x, t.y));
      if (!p.blocks) continue;
      // a fence with a gate: only its perimeter blocks, minus the gap tiles
      if (p.gaps) {
        const onEdge = t.x === p.x || t.y === p.y || t.x === p.x + (p.w ?? 1) - 1 || t.y === p.y + (p.h ?? 1) - 1;
        if (!onEdge || p.gaps.some((g) => g.x === t.x && g.y === t.y)) continue;
      }
      blocked.add(key(t.x, t.y));
    }
  }
  for (const s of seatTiles(room)) seats.set(key(s.x, s.y), s.dir);
  // where you arrive from the street or a door stays free of furniture
  reserved.add(key(room.spawn.x, room.spawn.y));
  // An NPC with a schedule moves, so its tile is not blocked here: the server blocks its CURRENT tile (World.grid). Fixed NPCs still block.
  for (const n of room.npcs) {
    if (!n.schedule) blocked.add(key(n.x, n.y));
    reserved.add(key(n.x, n.y));
  }
  for (const portal of room.portals) {
    // an outdoor door sits inside its facade's footprint: the door tile stays walkable
    blocked.delete(key(portal.x, portal.y));
    reserved.add(key(portal.x, portal.y));
    reserved.add(key(portal.arrive.x, portal.arrive.y));
  }
  for (const f of furniture) {
    const def = furnitureById(f.itemId);
    if (!def) continue;
    if (def.seat) seats.set(key(f.x, f.y), furnitureSeatDir(f.rot));
    else if (!def.walkable) blocked.add(key(f.x, f.y));
  }
  return { cols: room.cols, rows: room.rows, blocked, seats, reserved };
}

export function inBounds(g: { cols: number; rows: number }, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < g.cols && y < g.rows;
}

export function isWalkable(g: RoomGrid, x: number, y: number): boolean {
  return inBounds(g, x, y) && !g.blocked.has(key(x, y));
}

export function canPlaceFurniture(room: RoomDef, furniture: PlacedFurniture[], x: number, y: number, ignoreUid?: string): boolean {
  if (!inBounds(room, x, y)) return false;
  const grid = buildGrid(room, []);
  if (grid.reserved.has(key(x, y))) return false;
  return !furniture.some((f) => f.uid !== ignoreUid && f.x === x && f.y === y);
}

/** Every NPC definition in the world, home room first (an NPC's `x, y` and appearance live in its home room's `npcs`). */
export const ALL_NPCS: NpcDef[] = Object.values(ROOMS).flatMap((r) => r.npcs);
export const npcDefById = (id: string): NpcDef | undefined => ALL_NPCS.find((n) => n.id === id);
/** The room an NPC belongs to when no schedule says otherwise. */
export const npcHomeRoom = (id: string): RoomId | undefined => ROOM_IDS.find((r) => ROOMS[r].npcs.some((n) => n.id === id));
