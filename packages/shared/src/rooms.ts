import type { Appearance, Bilingual, Dir, PlacedFurniture, RoomId, Tile } from './types.js';
import { furnitureById } from './catalog.js';
import { SCHEDULES, type ScheduleSlot } from './schedules.js';

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
  | 'hortifruti';

export type PropAction = 'shop_hats' | 'minigame' | 'kiosk' | 'parrot_perch' | 'catalog' | 'bjj_roll' | 'feira_stall' | 'street_snack' | 'checkers';

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
}

export type WallSide = 'left' | 'right';

export interface WallDecor {
  kind: 'fachada_padaria' | 'mural' | 'predio' | 'metro' | 'janela_rua' | 'prateleira_paes' | 'lousa' | 'relogio' | 'azulejos' | 'poster' | 'janela' | 'placa' | 'cobogo' | 'tv' | 'toldo' | 'foto';
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
export type NpcId = 'carlos' | 'nanda' | 'julia' | 'graca' | 'prof' | 'tia_lu' | 'ze' | 'chico' | 'rosa';

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

export type FloorKind = 'calcada' | 'grama' | 'tijolo' | 'xadrez' | 'ladrilho' | 'madeira' | 'asfalto' | 'tatame' | 'paralelepipedo';

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
};

// ---------------------------------------------------------------- Vila Ipê, split into three open-air areas ("Split into areas")
//
//  rua   Rua dos Ipês     40 x 16  rows 0-5 building row (doors on row 5) | 6-7 north calçada | 8-11 the street | 12-13 south calçada (bus stop)
//                                  | 14-15 the lawns and the brick path down to the praça (edge portals on row 15, x18-21)
//  praca Praça Central    32 x 24  the fountain plaza, coreto, playground, games tables, kiosk, Nanda's stall; north edge (row 0, x14-17) back to the rua,
//                                  east edge (col 31, y10-13) on to the feira
//  feira Feira Livre      32 x 20  a fenced lot of setts with a grid of stall slots (FEIRA_SLOTS: four taken, four free, room beyond); west edge (col 0, y7-10)
//
// Walk off an edge and you arrive at the matching edge of the next area (`PortalDef.edge`; the server moves you when a walk ends on the tile).

const RUA_COLS = 40;
const RUA_ROWS = 16;
const PRACA_COLS = 32;
const PRACA_ROWS = 24;
const FEIRA_COLS = 32;
const FEIRA_ROWS = 20;

/** Parking bays on the south curb of Rua dos Ipês: first and last tile x of each, all on row 12 (asphalt notches in the sidewalk). */
export const PARKING_BAYS_IPES: readonly [number, number][] = [[2, 6], [33, 37]];

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
    paint('t', 18, 12, 21, 15); // the brick path down to the praça
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

const P = (id: string, kind: PropKind, x: number, y: number, extra: Partial<PropDef> = {}): PropDef => ({ id, kind, x, y, blocks: true, ...extra });
/** A bench: 2 tiles wide, everybody sits facing south. */
const bench = (id: string, x: number, y: number): PropDef => P(id, 'banco', x, y, { w: 2, blocks: false, seat: 'SW' });
/** Scenery with its own sprite (`art`): w x h footprint, non-blocking unless `blocks` is set (it usually sits inside something that already blocks). */
const cen = (id: string, art: string, x: number, y: number, w = 1, h = 1, extra: Partial<PropDef> = {}): PropDef => P(id, 'cenario', x, y, { w, h, art, blocks: false, ...extra });
/** Vehicles parked along a street's south curb row: [sprite name under vehicles/, first tile x, tiles wide]. Blocking, one tile deep. */
const parked = (row: number, cars: [string, number, number][]): PropDef[] =>
  cars.map(([name, x, w], i) => P(`estac_${row}_${i}`, 'cenario', x, row, { w, h: 1, art: `vehicles/${name}` }));
/** The four stools around a game table at (x, y): each sitter faces the table (a west stool faces east, and so on). */
const stools = (id: string, x: number, y: number): PropDef[] => [
  cen(`${id}_o`, 'props/banquinho', x - 1, y, 1, 1, { seat: 'SE' }),
  cen(`${id}_l`, 'props/banquinho', x + 1, y, 1, 1, { seat: 'NW' }),
  cen(`${id}_n`, 'props/banquinho', x, y - 1, 1, 1, { seat: 'SW' }),
  cen(`${id}_s`, 'props/banquinho', x, y + 1, 1, 1, { seat: 'NE' }),
];
/** A building front: `w` x `h` footprint, bottom-centre anchored (x, y is the top-left tile). */
const front = (id: string, art: string, x: number, y: number, w: number, h: number, label?: Bilingual): PropDef => P(id, 'fachada', x, y, { w, h, art, label });
/** A line of 2-wide hedges along a row from x0 to x1 (exclusive end, even count), the map edge of a lawn or a sidewalk. */
const hedgeRow = (id: string, y: number, x0: number, x1: number): PropDef[] => {
  const out: PropDef[] = [];
  for (let x = x0; x < x1; x += 2) out.push(P(`${id}_${x}`, 'sebe', x, y, { w: 2, art: 'props/hedge_wide' }));
  return out;
};

/** A feira stall: 3x2, blocks, `art` names the open variant (`feira/<name>`); you click it or stand at `interact`, the vendor (an NPC) stands behind it. */
const feiraStall = (id: string, vendor: 'tia_lu' | 'ze' | 'chico' | 'rosa', name: string, x: number, y: number, label: Bilingual): PropDef =>
  P(id, 'feira', x, y, { w: 3, h: 2, art: `feira/${name}`, action: 'feira_stall', vendor, interact: { x: x + 1, y: y + 3 }, label });

/**
 * The feira's stall grid: stalls are 3x2 on a 6-tile pitch, two rows (north y3, south y11) with the aisle between. A slot with a `vendor` is
 * built (`feiraStall` below); a free one shows a "vaga livre" sign. To grow the feira, fill a free slot or add columns/rows to the grid
 * (the lot has free paving to the east and south) and give the new stall a vendor in `feira.ts` + `schedules.ts`.
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

// ---------------------------------------------------------------- rua
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
  spawn: { x: 20, y: 13 },
  props: [
    // ---- the building row (y 0-5): the door tile of each facade is a portal on row 5, the rest of the front blocks
    front('padaria', 'facades/padaria', 0, 0, 8, 6, { pt: 'Padaria do Seu Carlos', en: 'Seu Carlos’s bakery' }),
    front('empena', 'casas/empena', 8, 0, 3, 6),
    front('edificio', 'facades/edificio_ipe', 11, 0, 10, 6, { pt: 'Edifício Ipê Nº 42', en: 'Ipê Building No. 42' }),
    front('academia', 'facades/academia', 21, 0, 10, 6, { pt: 'Academia do Bairro', en: 'Neighborhood Academy' }),
    front('casa_3', 'casas/terraco_azul', 31, 0, 6, 6),
    front('empena_2', 'casas/empena', 37, 0, 3, 6),
    P('banca', 'banca', 8, 4, { w: 3, h: 2, label: { pt: 'Banca de jornal', en: 'Newsstand' } }),
    P('jornais', 'jornais', 7, 6, { label: { pt: 'Pilha de jornais', en: 'Newspaper stack' } }),
    // ---- north calçada (y 6-7): lamps on the curb, pots by the doors, bins, phone
    P('lampada_n1', 'poste', 2, 7, { art: 'props/lamp_old' }),
    P('lampada_n2', 'poste', 10, 7, { art: 'props/lamp_old' }),
    P('lampada_n3', 'poste', 18, 7, { art: 'props/lamp_old' }),
    P('lampada_n4', 'poste', 29, 7, { art: 'props/lamp_old' }),
    P('lampada_n5', 'poste', 34, 7, { art: 'props/lamp_old' }),
    P('orelhao', 'orelhao', 14, 6, { label: { pt: 'Orelhão', en: 'Public phone booth (“big ear”)' } }),
    P('placa', 'placa_rua', 22, 7, { label: { pt: 'Rua dos Ipês', en: 'Ipê Street (street sign)' } }),
    P('lixeira_n1', 'lixeira', 10, 6),
    P('lixeira_n2', 'lixeira', 30, 6),
    P('saco_lixo', 'saco_lixo', 31, 6),
    P('floreira_n1', 'floreira', 3, 6),
    P('floreira_n2', 'floreira', 16, 6),
    P('floreira_n3', 'floreira', 24, 6),
    P('floreira_n4', 'floreira', 28, 6),
    P('vaso_n1', 'vaso', 18, 6),
    P('mesa_cafe', 'mesa_cafe', 2, 6, { label: { pt: 'Mesinha da padaria', en: 'Bakery sidewalk table' } }),
    P('bici', 'bicicletario', 17, 7),
    cen('revisteiro', 'props/revisteiro', 11, 7, 1, 1, { blocks: true, label: { pt: 'Revisteiro da banca', en: 'Newsstand magazine rack' } }),
    cen('vaso_topiaria_1', 'props/vaso_topiaria_a', 11, 6, 1, 1, { blocks: true }),
    cen('bici_3', 'props/bicicletario', 33, 7, 1, 1, { blocks: true }),
    // ---- the Hortifrúti corner at the banca: Tia Lu's crates, open at every hour (D12)
    P('hortifruti', 'hortifruti', 7, 7, { art: 'feira/caixotes', action: 'feira_stall', vendor: 'banca', interact: { x: 8, y: 7 }, label: { pt: 'Hortifrúti da banca', en: 'Greengrocer at the newsstand' } }),
    cen('hortifruti_2', 'feira/caixotes', 6, 7, 1, 1, { blocks: true }),
    cen('hortifruti_preco', 'feira/preco_lousa', 6, 6),
    // ---- south calçada (y 12-13): the bus stop, utility poles for the wires, lamps
    P('ponto', 'ponto_onibus', 27, 12, { w: 3, label: { pt: 'Ponto de ônibus', en: 'Bus stop' } }),
    P('poste_2', 'poste', 9, 13),
    P('poste_3', 'poste', 17, 13),
    P('poste_4', 'poste', 25, 13),
    P('lixeira_s1', 'lixeira', 23, 13),
    P('lixeira_s2', 'lixeira', 26, 12),
    // pit trees along both sidewalks, clear of the doors and crosswalks
    P('arv_n1', 'arvore', 15, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_n2', 'arvore', 31, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_n3', 'arvore', 36, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s2', 'arvore', 14, 12, { w: 2, art: 'props/arvore_rua' }),
    // parked vehicles in the bays (they block their curb tiles only; the traffic lanes sit above them, see ambientData.ts)
    ...parked(12, [['park_verde_r', 2, 5], ['park_taxi_r', 33, 5]]),
    P('hidrante_s', 'sebe', 15, 13, { art: 'props/hidrante_amarelo' }),
    P('parquimetro', 'sebe', 16, 12, { art: 'props/parquimetro' }),
    P('flor_s1', 'sebe', 31, 13, { w: 2, art: 'props/flor_vermelha' }),
    P('flor_s2', 'sebe', 36, 13, { w: 2, art: 'props/flor_mista' }),
    // ---- the lawns and the way down to the praça: hedges on both sides of the brick path (the path itself is the edge portal band)
    ...hedgeRow('sebe_s', 15, 0, 18),
    ...hedgeRow('sebe_s', 15, 22, 40),
    P('lampada_s2', 'poste', 22, 13, { art: 'props/lamp_old' }),
    P('arv_s5', 'arvore', 11, 14, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s6', 'arvore', 26, 14, { w: 2, art: 'props/arvore_rua' }),
    P('arbusto_s1', 'sebe', 9, 14, { art: 'props/bush_flower' }),
    P('arbusto_s2', 'sebe', 32, 14, { art: 'props/bush_flower' }),
    // ---- the map edges: barricades across the street, hedges across the sidewalks and the lawns
    ...([['o', 0], ['l', 38]] as const).flatMap(([side, x]) => [
      P(`barreira_${side}_8`, 'cerca', x, 8, { w: 2, h: 4, art: 'cerca_rua' }),
      ...[6, 7, 12, 13, 14].map((y) => P(`sebe_${side}_${y}`, 'sebe', x, y, { w: 2, art: 'props/hedge_wide' })),
    ]),
  ],
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
    {
      id: 'praca_academia',
      x: 26,
      y: 5,
      to: 'academia',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 25.5, y: 5 },
      label: { pt: 'Academia do Bairro', en: 'Neighborhood Academy' },
    },
    ...edgePortals('rua_praca', 'praca', span(4, 18).map((x) => ({ x, y: 15 })), (t) => ({ x: t.x - 4, y: 1 }), 'SE', { pt: 'Praça Central', en: 'Central Square' }),
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
  props: [
    P('fonte', 'fonte', 14, 10, { w: 4, h: 3, label: { pt: 'Fonte da praça', en: 'Square fountain' } }),
    // trees: the yellow ipê stays the hero; purple and white ipês, a shade tree, a sibipiruna, jerivá palms
    P('ipe_centro', 'ipe', 4, 3, { w: 2, h: 2, hero: true }),
    P('ipe_2', 'arvore', 9, 3, { art: 'props/ipe_roxo_medium' }),
    P('ipe_3', 'arvore', 27, 3, { art: 'props/ipe_roxo_medium_b' }),
    P('ipe_4', 'arvore', 22, 9, { art: 'props/oiti' }),
    P('ipe_5', 'ipe', 10, 16, { art: 'props/ipe_amarelo_medium_b' }),
    P('ipe_6', 'arvore', 28, 19, { w: 2, h: 2, art: 'props/ipe_branco_large' }),
    P('sibipiruna', 'arvore', 28, 14, { art: 'props/sibipiruna' }),
    P('jeriva_1', 'arvore', 2, 10, { art: 'props/jeriva' }),
    P('jeriva_2', 'arvore', 2, 13, { art: 'props/jeriva_b' }),
    bench('banco_1', 11, 6),
    bench('banco_2', 24, 20),
    bench('banco_3', 12, 17),
    bench('banco_4', 18, 17),
    bench('banco_5', 5, 20),
    // the coreto (bandstand): the praça's hero landmark in the north-east lawn
    cen('coreto', 'props/coreto', 23, 4, 5, 3, { blocks: true, label: { pt: 'Coreto da praça', en: 'Bandstand (coreto)' } }),
    cen('canteiro_coreto_1', 'props/canteiro_redondo', 21, 5, 2, 2, { blocks: true }),
    cen('canteiro_coreto_2', 'props/canteiro_redondo', 28, 5, 2, 2, { blocks: true }),
    // the bust of the founder, in a round flower bed (north-west lawn)
    cen('busto', 'props/canteiro_busto', 7, 5, 2, 2, { blocks: true, label: { pt: 'Busto da fundadora', en: 'Bust of the founder' } }),
    // domino and chess tables with their stools (seniors sit here): south-east lawn
    cen('mesa_domino_1', 'props/mesa_domino', 22, 17, 1, 1, { blocks: true }),
    cen('mesa_xadrez_1', 'props/mesa_xadrez', 26, 17, 1, 1, {
      blocks: true,
      action: 'checkers',
      interact: { x: 25, y: 17 },
      label: { pt: 'Damas', en: 'Checkers' },
    }),
    ...stools('banquinho_a', 22, 17),
    ...stools('banquinho_b', 26, 17),
    // pipoqueiro and the coconut-water cart
    cen('pipoqueiro', 'props/pipoqueiro', 18, 21, 3, 1, {
      blocks: true,
      action: 'street_snack',
      interact: { x: 19, y: 20 },
      label: { pt: 'Pipoqueiro', en: 'Popcorn cart' },
    }),
    cen('carrinho_coco', 'props/carrinho_coco', 24, 9, 3, 1, {
      blocks: true,
      action: 'street_snack',
      interact: { x: 24, y: 10 },
      label: { pt: 'Carrinho de água de coco', en: 'Coconut-water cart' },
    }),
    // the playground: sand pit with a swing, a slide, a seesaw and monkey bars; a bench watches from the south
    cen('pg_balanco', 'props/pg_balanco', 4, 16, 2, 1, { blocks: true }),
    cen('pg_escorregador', 'props/pg_escorregador', 6, 16, 3, 1, { blocks: true }),
    cen('pg_gangorra', 'props/pg_gangorra', 4, 18, 2, 1, { blocks: true }),
    cen('pg_trepa', 'props/pg_trepa', 6, 18, 3, 1, { blocks: true }),
    P('canteiro_1', 'canteiro', 12, 15, { w: 2 }),
    P('canteiro_2', 'canteiro', 18, 15, { w: 2 }),
    P('lampada_p1', 'poste', 11, 8, { art: 'props/lamp_old' }),
    P('lampada_p2', 'poste', 20, 8, { art: 'props/lamp_old' }),
    P('lampada_p3', 'poste', 11, 14, { art: 'props/lamp_old' }),
    P('lampada_p4', 'poste', 20, 14, { art: 'props/lamp_old' }),
    P('arbusto_1', 'sebe', 11, 3, { art: 'props/bush_flower' }),
    P('arbusto_2', 'sebe', 20, 7, { art: 'props/bush_flower' }),
    P('arbusto_3', 'sebe', 3, 8, { art: 'props/bush_flower' }),
    cen('topiaria_urso', 'props/topiaria_urso', 9, 8, 1, 1, { blocks: true }),
    // the kiosk and the stalls near the rua entrance
    {
      id: 'quiosque',
      kind: 'quiosque',
      x: 12,
      y: 2,
      blocks: true,
      action: 'kiosk',
      interact: { x: 13, y: 2 },
      label: { pt: 'Quiosque de missões', en: 'Quest kiosk' },
    },
    {
      id: 'barraca',
      kind: 'barraca_chapeus',
      x: 19,
      y: 2,
      w: 2,
      h: 1,
      blocks: true,
      action: 'shop_hats',
      interact: { x: 19, y: 3 },
      label: { pt: 'Chapéus da Nanda', en: 'Nanda’s Hats' },
    },
    {
      id: 'poleiro',
      kind: 'poleiro',
      x: 22,
      y: 14,
      blocks: true,
      action: 'parrot_perch',
      interact: { x: 21, y: 14 },
      label: { pt: 'Poleiro do papagaio', en: 'Parrot perch' },
    },
    // the vira-lata corner (south-west)
    cen('vira_lata', 'critters/vira_lata_sleep_e', 3, 21, 1, 1, { blocks: true, label: { pt: 'Vira-lata caramelo', en: 'Caramel stray dog (vira-lata)' } }),
    cen('topiaria_cao', 'props/topiaria_cao', 1, 21, 2, 1, { blocks: true }),
    P('lixeira_p1', 'lixeira', 19, 6),
    P('lixeira_p2', 'lixeira', 13, 19),
    P('flor_p1', 'sebe', 21, 22, { w: 3, art: 'props/flor_mista' }),
    P('flor_p2', 'sebe', 11, 22, { w: 3, art: 'props/flor_branca_l' }),
    // ---- the map edges: hedges across the north (the rua entrance stays open) and the south, fences along the west and the east (the feira gate stays open)
    ...hedgeRow('sebe_n', 0, 0, 14),
    ...hedgeRow('sebe_n', 0, 18, 32),
    ...hedgeRow('sebe_s', 23, 0, 32),
    P('cerca_oeste', 'cerca', 0, 1, { w: 1, h: PRACA_ROWS - 2, art: 'cerca_jardim' }),
    P('cerca_leste_n', 'cerca', 31, 1, { w: 1, h: 9, art: 'cerca_jardim' }),
    P('cerca_leste_s', 'cerca', 31, 14, { w: 1, h: 9, art: 'cerca_jardim' }),
  ],
  walls: [],
  portals: [
    ...edgePortals('praca_rua', 'rua', span(4, 14).map((x) => ({ x, y: 0 })), (t) => ({ x: t.x + 4, y: 14 }), 'NW', { pt: 'Rua dos Ipês', en: 'Ipê Street' }),
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
  props: [
    // the lot is fenced; the gate is the brick threshold on the west edge. Open 06:00-13:00 (`feira.ts`); outside those hours the stalls show folded.
    // The vendor stands in FRONT of the stall (x + 1, y + 2), facing the aisle; customers talk to them from the next tile (x + 1, y + 3).
    P('cerca_feira', 'cerca', 0, 0, { w: FEIRA_COLS, h: FEIRA_ROWS, art: 'cerca_feira', gaps: span(4, 7).map((y) => ({ x: 0, y })) }),
    cen('feira_livre', 'props/feira_livre', 6, 1, 5, 1, { label: { pt: 'Feira livre', en: 'Street market' } }),
    feiraStall('feira_tia_lu', 'tia_lu', 'frutas', 6, 3, { pt: 'Frutas da Tia Lu', en: 'Tia Lu’s fruit stall' }),
    feiraStall('feira_ze', 'ze', 'verduras', 12, 3, { pt: 'Verduras do Seu Zé', en: 'Seu Zé’s vegetable stall' }),
    feiraStall('feira_chico', 'chico', 'pastel', 6, 11, { pt: 'Pastel e caldo de cana do Seu Chico', en: 'Seu Chico’s pastel and sugarcane juice' }),
    feiraStall('feira_rosa', 'rosa', 'flores', 12, 11, { pt: 'Flores da Dona Rosa', en: 'Dona Rosa’s flowers' }),
    // crates, a sack, scales and two carts around the stalls (blocking, never on a vendor's or a customer's tile)
    cen('caixote_1', 'feira/cx_banana', 4, 4, 1, 1, { blocks: true }),
    cen('caixote_2', 'feira/cx_tomate', 5, 4, 1, 1, { blocks: true }),
    cen('caixote_3', 'feira/cx_melancia', 15, 4, 1, 1, { blocks: true }),
    cen('caixote_4', 'feira/cx_repolho', 16, 4, 1, 1, { blocks: true }),
    cen('caixote_5', 'feira/cx_repolho', 4, 12, 1, 1, { blocks: true }),
    cen('caixote_6', 'feira/cx_tomate', 15, 12, 1, 1, { blocks: true }),
    cen('carrinho_feira_1', 'feira/carrinho_a', 9, 4, 3, 1, { blocks: true }),
    cen('carrinho_feira_2', 'feira/carrinho_b', 9, 12, 3, 1, { blocks: true }),
    cen('sacos_1', 'feira/sacos', 15, 5, 1, 1, { blocks: true }),
    cen('balanca_1', 'feira/balanca', 8, 5, 1, 1, { blocks: true }),
    cen('balanca_2', 'feira/balanca', 14, 5, 1, 1, { blocks: true }),
    cen('balanca_3', 'feira/balanca', 8, 13, 1, 1, { blocks: true }),
    cen('balanca_4', 'feira/balanca', 14, 13, 1, 1, { blocks: true }),
    cen('lousa_tia_lu', 'feira/preco_lousa', 5, 5),
    cen('lousa_ze', 'feira/preco_lousa', 11, 5),
    cen('lousa_chico', 'feira/preco_lousa', 5, 13),
    cen('lousa_rosa', 'feira/preco_lousa', 11, 13),
    // festa-junina bunting over the aisle (overhead, thin: people stay visible)
    cen('bandeirinhas_1', 'props/bandeirinhas_b', 4, 8, 6, 1),
    cen('bandeirinhas_2', 'props/bandeirinhas_b', 10, 8, 6, 1),
    // free stall slots (FEIRA_SLOTS): a price board with a "vaga livre" label marks each spot where the next stall will go
    ...FEIRA_SLOTS.filter((s) => !s.vendor).map((s) => cen(`vaga_${s.id}`, 'feira/preco_placa', s.x + 1, s.y + 2, 1, 1, { label: { pt: 'Vaga livre para uma nova barraca', en: 'Free spot for a new stall' } })),
    P('lampada_f1', 'poste', 2, 6, { art: 'props/lamp_old' }),
    P('lampada_f2', 'poste', 2, 11, { art: 'props/lamp_old' }),
    P('lampada_f3', 'poste', 21, 9, { art: 'props/lamp_old' }),
    P('ipe_lote_1', 'arvore', 28, 2, { w: 2, art: 'props/arvore_rua' }),
    P('ipe_lote_2', 'arvore', 28, 16, { w: 2, art: 'props/arvore_rua' }),
    cen('flor_lote', 'props/flor_mista_b', 20, 17, 3, 1),
    bench('banco_feira', 4, 16),
  ],
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
  props: [
    { id: 'caixa', kind: 'caixa', x: 0, y: 2, blocks: true, label: { pt: 'Caixa', en: 'Cash register' } },
    { id: 'balcao', kind: 'balcao', x: 1, y: 2, w: 5, h: 1, blocks: true },
    { id: 'vitrine', kind: 'vitrine', x: 6, y: 2, blocks: true },
    { id: 'estufa', kind: 'estufa', x: 7, y: 2, blocks: true, label: { pt: 'Estufa de salgados', en: 'Warm snack display' } },
    {
      id: 'trilho',
      kind: 'trilho_pedidos',
      x: 8,
      y: 2,
      blocks: true,
      action: 'minigame',
      interact: { x: 8, y: 3 },
      label: { pt: 'Me vê um…', en: 'Tray game: “I’ll take a…”' },
    },
    { id: 'vaso_canto', kind: 'vaso', x: 9, y: 2, blocks: true },
    { id: 'banqueta_1', kind: 'banqueta', x: 1, y: 3, blocks: false, seat: 'NE' },
    { id: 'banqueta_2', kind: 'banqueta', x: 5, y: 3, blocks: false, seat: 'NE' },
    { id: 'banqueta_3', kind: 'banqueta', x: 6, y: 3, blocks: false, seat: 'NE' },
    { id: 'mesa_1', kind: 'mesa', x: 3, y: 6, blocks: true },
    { id: 'cadeira_1', kind: 'cadeira_padaria', x: 2, y: 6, blocks: false, seat: 'SE' },
    { id: 'cadeira_2', kind: 'cadeira_padaria', x: 3, y: 7, blocks: false, seat: 'NE' },
    { id: 'mesa_2', kind: 'mesa', x: 7, y: 6, blocks: true },
    { id: 'cadeira_3', kind: 'cadeira_padaria', x: 6, y: 6, blocks: false, seat: 'SE' },
    { id: 'cadeira_4', kind: 'cadeira_padaria', x: 7, y: 7, blocks: false, seat: 'NE' },
    { id: 'vaso', kind: 'vaso', x: 9, y: 8, blocks: true },
  ],
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
  props: [
    { id: 'cama', kind: 'cama', x: 6, y: 1, w: 2, h: 2, blocks: true },
    { id: 'cozinha', kind: 'cozinha', x: 1, y: 0, w: 2, h: 1, blocks: true },
  ],
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
  props: [
    { id: 'tatame', kind: 'tatame', x: 2, y: 1, w: 6, h: 4, blocks: false, label: { pt: 'Tatame aberto', en: 'Open mat' } },
    {
      id: 'fila',
      kind: 'quadro_fila',
      x: 9,
      y: 1,
      blocks: true,
      action: 'bjj_roll',
      interact: { x: 9, y: 2 },
      label: { pt: 'Fila do tatame', en: 'Open-mat queue' },
    },
    { id: 'faixas', kind: 'parede_faixas', x: 0, y: 1, h: 2, blocks: true, label: { pt: 'Parede de faixas', en: 'Belt wall' } },
    { id: 'quadro', kind: 'quadro_foto', x: 10, y: 4, blocks: true, label: { pt: 'Academia do Bairro', en: 'Academy photo' } },
    // One continuous arquibancada along the back edge of the mat: spectators face the tatame and the camera.
    { id: 'arquibancada', kind: 'banco_espectador', x: 1, y: 0, w: 4, blocks: false, seat: 'SW', label: { pt: 'Arquibancada', en: 'Bleachers' } },
    { id: 'vestiario', kind: 'vestiario', x: 0, y: 7, blocks: true, label: { pt: 'Vestiário · alongamento', en: 'Changing / stretch corner' } },
    // V3 dressing (decoration only, nothing blocks or seats): a bench along the south wall and a water cooler in the corner
    { id: 'banco_gym', kind: 'cenario', x: 5, y: 8, w: 2, h: 1, art: 'props/banco_gym', blocks: false },
    { id: 'bebedouro', kind: 'cenario', x: 10, y: 8, art: 'props/bebedouro', blocks: false },
    // Mat dressing for the roll (decoration only): the scoreboard at the mat's east edge and a flag at each mat corner
    { id: 'placar', kind: 'cenario', x: 8, y: 3, w: 2, h: 1, art: 'props/placar', blocks: false },
    { id: 'bandeira_no', kind: 'cenario', x: 1, y: 1, art: 'props/bandeira_br', blocks: false },
    { id: 'bandeira_ne', kind: 'cenario', x: 8, y: 1, art: 'props/bandeira_sp', blocks: false },
    // (the south-west flag stands inside the mat's span, clear of the exit so the "← Rua" guide label never sits on it)
    { id: 'bandeira_so', kind: 'cenario', x: 3, y: 5, art: 'props/bandeira_sp', blocks: false },
    { id: 'bandeira_se', kind: 'cenario', x: 8, y: 5, art: 'props/bandeira_br', blocks: false },
  ],
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
      to: 'rua',
      arrive: { x: 26, y: 6 },
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
      ],
    },
  ],
  private: false,
};

export const ROOMS: Record<RoomId, RoomDef> = { praca, rua, feira, padaria, kitnet, academia };
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
