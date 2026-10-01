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

export type PropAction = 'shop_hats' | 'minigame' | 'kiosk' | 'parrot_perch' | 'catalog' | 'bjj_roll' | 'feira_stall';

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

export type FloorKind = 'calcada' | 'grama' | 'tijolo' | 'xadrez' | 'ladrilho' | 'madeira' | 'asfalto' | 'tatame';

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
};

// ---------------------------------------------------------------- Vila Ipê (room id `praca`), Phase 5
//
//  56 x 40 tiles. Rows: 0-5 north building row (facades face south, doors on row 5) | 6-7 north calçada | 8-11 Rua dos Ipês |
//  12-13 south calçada (bus stop, wires) | 14-29 Praça Central x10-40 (west houses x0-9, fenced feira lot x41-55) |
//  30-31 calçada | 32-35 Rua Jacarandá | 36-39 decorative roofs (blocked). Streets end in walls at the map edge.

const VI_COLS = 56;
const VI_ROWS = 40;

/** The floor of Vila Ipê, painted rectangle by rectangle (later paints win). Chars: see FLOOR_CHARS. */
function vilaIpeFloor(): string[] {
  const g: string[][] = Array.from({ length: VI_ROWS }, () => Array.from({ length: VI_COLS }, () => 'c'));
  const paint = (ch: string, x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  };
  paint('a', 0, 8, 55, 11); // Rua dos Ipês
  paint('a', 0, 32, 55, 35); // Rua Jacarandá
  // Praça lawns: four quadrants around the brick cross
  paint('g', 11, 15, 19, 20);
  paint('g', 31, 15, 39, 20);
  paint('g', 11, 23, 19, 28);
  paint('g', 31, 23, 39, 28);
  // west houses' gardens and the vira-lata corner
  paint('g', 0, 14, 9, 23);
  paint('g', 1, 26, 4, 29);
  paint('c', 8, 14, 9, 29); // the footpath between the gardens and the praça
  // east lot: the feira livre. V2: it is a closed street now, so the ground is asphalt inside the fence (a ring of grass under the fence line
  // itself) and the gate stands on the brick bar of the praça
  paint('g', 41, 14, 55, 29);
  paint('a', 41, 14, 55, 29);
  paint('t', 41, 21, 41, 22);
  // brick cross into the fountain (inlaid in the calçada): the N-S axis runs across both sidewalks, the E-W bar through the fountain
  paint('t', 24, 6, 25, 7);
  paint('t', 24, 12, 25, 29);
  paint('t', 10, 21, 40, 22);
  paint('t', 21, 18, 28, 24);
  return g.map((r) => r.join(''));
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
/** What closes the map at its west and east edges (no open void): a barricade across each street, a hedge across each sidewalk, a fence along the west lawns. */
function vilaIpeEdges(): PropDef[] {
  const out: PropDef[] = [];
  for (const [side, x] of [['o', 0], ['l', 54]] as const) {
    for (const y of [8, 32]) out.push(P(`barreira_${side}_${y}`, 'cerca', x, y, { w: 2, h: 4, art: 'cerca_rua' }));
    for (const y of [6, 7, 12, 13, 30, 31]) out.push(P(`sebe_${side}_${y}`, 'sebe', x, y, { w: 2, art: 'props/hedge_wide' }));
  }
  out.push(P('cerca_borda_1', 'cerca', 0, 14, { w: 1, h: 6, art: 'cerca_jardim' }));
  out.push(P('cerca_borda_2', 'cerca', 0, 24, { w: 1, h: 6, art: 'cerca_jardim' }));
  return out;
}

/** A building front: `w` x `h` footprint, bottom-centre anchored (x, y is the top-left tile). */
const front = (id: string, art: string, x: number, y: number, w: number, h: number, label?: Bilingual): PropDef => P(id, 'fachada', x, y, { w, h, art, label });

/** A feira stall: 3x2, blocks, `art` names the open variant (`feira/<name>`); you click it or stand at `interact`, the vendor (an NPC) stands behind it. */
const feiraStall = (id: string, vendor: 'tia_lu' | 'ze' | 'chico' | 'rosa', name: string, x: number, y: number, label: Bilingual): PropDef =>
  P(id, 'feira', x, y, { w: 3, h: 2, art: `feira/${name}`, action: 'feira_stall', vendor, interact: { x: x + 1, y: y + 3 }, label });

const vilaIpe: RoomDef = {
  id: 'praca',
  name: 'Vila Ipê',
  gloss: 'Ipê Village',
  cols: VI_COLS,
  rows: VI_ROWS,
  outdoor: true,
  floor: vilaIpeFloor(),
  wallHeight: 0,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 25, y: 27 },
  props: [
    // ---- north building row (y 0-5): the door tile of each facade is a portal on row 5, the rest of the front blocks
    front('casa_1', 'casas/sobrado_salmao', 0, 0, 6, 6),
    front('casa_2', 'casas/terraco_amarelo', 6, 0, 6, 6),
    front('padaria', 'facades/padaria', 12, 0, 8, 6, { pt: 'Padaria do Seu Carlos', en: 'Seu Carlos’s bakery' }),
    front('empena', 'casas/empena', 20, 0, 3, 6),
    front('edificio', 'facades/edificio_ipe', 23, 0, 10, 6, { pt: 'Edifício Ipê Nº 42', en: 'Ipê Building No. 42' }),
    front('academia', 'facades/academia', 33, 0, 10, 6, { pt: 'Academia do Bairro', en: 'Neighborhood Academy' }),
    front('casa_3', 'casas/terraco_azul', 43, 0, 6, 6),
    front('casa_4', 'casas/sobrado_verde', 49, 0, 7, 6),
    P('banca', 'banca', 20, 4, { w: 3, h: 2, label: { pt: 'Banca de jornal', en: 'Newsstand' } }),
    P('jornais', 'jornais', 19, 6, { label: { pt: 'Pilha de jornais', en: 'Newspaper stack' } }),
    // ---- north calçada (y 6-7): lamps on the curb, pots by the doors, the corner sign, bins, phone
    P('lampada_n1', 'poste', 3, 7, { art: 'props/lamp_old' }),
    P('lampada_n2', 'poste', 9, 7, { art: 'props/lamp_old' }),
    P('lampada_n3', 'poste', 21, 7, { art: 'props/lamp_old' }),
    P('lampada_n4', 'poste', 29, 7, { art: 'props/lamp_old' }),
    P('lampada_n5', 'poste', 35, 7, { art: 'props/lamp_old' }),
    P('lampada_n6', 'poste', 41, 7, { art: 'props/lamp_old' }),
    P('lampada_n7', 'poste', 47, 7, { art: 'props/lamp_old' }),
    P('lampada_n8', 'poste', 53, 7, { art: 'props/lamp_old' }),
    P('orelhao', 'orelhao', 12, 6, { label: { pt: 'Orelhão', en: 'Public phone booth (“big ear”)' } }),
    P('placa', 'placa_rua', 22, 7, { label: { pt: 'Rua dos Ipês', en: 'Ipê Street (street sign)' } }),
    P('lixeira_n1', 'lixeira', 13, 6),
    P('lixeira_n2', 'lixeira', 32, 6),
    P('lixeira_n3', 'lixeira', 45, 6),
    P('saco_lixo', 'saco_lixo', 31, 6),
    P('floreira_n1', 'floreira', 14, 6),
    P('floreira_n2', 'floreira', 18, 6),
    P('floreira_n3', 'floreira', 36, 6),
    P('floreira_n4', 'floreira', 40, 6),
    P('vaso_n1', 'vaso', 26, 6),
    P('vaso_n2', 'vaso', 2, 6),
    P('vaso_n3', 'vaso', 8, 6),
    P('mesa_cafe', 'mesa_cafe', 10, 6, { label: { pt: 'Mesinha da padaria', en: 'Bakery sidewalk table' } }),
    P('bici', 'bicicletario', 6, 7),
    // ---- south calçada (y 12-13): the bus stop, utility poles for the wires, lamps
    P('ponto', 'ponto_onibus', 30, 12, { w: 3, label: { pt: 'Ponto de ônibus', en: 'Bus stop' } }),
    P('poste_1', 'poste', 2, 13),
    P('poste_2', 'poste', 10, 13),
    P('poste_3', 'poste', 18, 13),
    P('poste_4', 'poste', 26, 13),
    P('poste_5', 'poste', 34, 13),
    P('poste_6', 'poste', 42, 13),
    P('poste_7', 'poste', 50, 13),
    P('lixeira_s1', 'lixeira', 21, 12),
    P('lixeira_s2', 'lixeira', 39, 12),
    // ---- Praça Central
    P('fonte', 'fonte', 23, 20, { w: 4, h: 3, label: { pt: 'Fonte da praça', en: 'Square fountain' } }),
    // trees (V2): the yellow ipê stays the hero; a purple and a white ipê, a figueira-sized shade tree, a sibipiruna, jerivá palms
    P('ipe_centro', 'ipe', 12, 16, { w: 2, h: 2, hero: true }),
    P('ipe_2', 'arvore', 18, 16, { art: 'props/ipe_roxo_medium' }),
    P('ipe_3', 'arvore', 38, 16, { art: 'props/ipe_roxo_medium_b' }),
    P('ipe_4', 'arvore', 19, 27, { art: 'props/oiti' }),
    P('ipe_5', 'ipe', 19, 23, { art: 'props/ipe_amarelo_medium_b' }),
    P('ipe_6', 'arvore', 39, 27, { w: 2, h: 2, art: 'props/ipe_branco_large' }),
    P('sibipiruna', 'arvore', 35, 23, { art: 'props/sibipiruna' }),
    P('jeriva_1', 'arvore', 19, 19, { art: 'props/jeriva' }),
    P('jeriva_2', 'arvore', 31, 16, { art: 'props/jeriva_b' }),
    P('jeriva_3', 'arvore', 11, 23, { art: 'props/jeriva_b' }),
    bench('banco_1', 20, 17),
    bench('banco_2', 28, 17),
    bench('banco_3', 20, 25),
    bench('banco_4', 28, 25),
    bench('banco_5', 14, 20),
    bench('banco_6', 31, 19),
    bench('banco_7', 15, 29),
    bench('banco_8', 33, 29),
    // the coreto (bandstand): the praça's hero landmark in the north-east lawn, its steps toward the brick bar
    cen('coreto', 'props/coreto', 33, 18, 5, 3, { blocks: true, label: { pt: 'Coreto da praça', en: 'Bandstand (coreto)' } }),
    cen('canteiro_coreto_1', 'props/canteiro_redondo', 31, 17, 2, 2, { blocks: true }),
    cen('canteiro_coreto_2', 'props/canteiro_redondo', 38, 18, 2, 2, { blocks: true }),
    // the bust of the founder, in a round flower bed (north-west lawn)
    cen('busto', 'props/canteiro_busto', 16, 18, 2, 2, { blocks: true, label: { pt: 'Busto da fundadora', en: 'Bust of the founder' } }),
    // domino and chess tables with their stools (seniors sit here): south-east lawn
    cen('mesa_domino_1', 'props/mesa_domino', 33, 26, 1, 1, { blocks: true }),
    cen('mesa_xadrez_1', 'props/mesa_xadrez', 37, 26, 1, 1, { blocks: true }),
    ...stools('banquinho_a', 33, 26),
    ...stools('banquinho_b', 37, 26),
    // pipoqueiro and the coconut-water cart
    cen('pipoqueiro', 'props/pipoqueiro', 29, 28, 3, 1, { blocks: true, label: { pt: 'Pipoqueiro', en: 'Popcorn cart' } }),
    cen('carrinho_coco', 'props/carrinho_coco', 28, 14, 3, 1, { blocks: true, label: { pt: 'Carrinho de água de coco', en: 'Coconut-water cart' } }),
    // the playground: sand pit with a swing, a slide, a seesaw and monkey bars; a bench watches from the south
    cen('pg_balanco', 'props/pg_balanco', 12, 25, 2, 1, { blocks: true }),
    cen('pg_escorregador', 'props/pg_escorregador', 14, 25, 3, 1, { blocks: true }),
    cen('pg_gangorra', 'props/pg_gangorra', 12, 27, 2, 1, { blocks: true }),
    cen('pg_trepa', 'props/pg_trepa', 14, 27, 3, 1, { blocks: true }),
    P('canteiro_1', 'canteiro', 11, 14, { w: 2 }),
    P('canteiro_2', 'canteiro', 38, 14, { w: 2 }),
    P('canteiro_3', 'canteiro', 11, 29, { w: 2 }),
    P('canteiro_4', 'canteiro', 38, 29, { w: 2 }),
    P('lampada_p1', 'poste', 22, 16, { art: 'props/lamp_old' }),
    P('lampada_p2', 'poste', 27, 16, { art: 'props/lamp_old' }),
    P('lampada_p3', 'poste', 22, 26, { art: 'props/lamp_old' }),
    P('lampada_p4', 'poste', 27, 26, { art: 'props/lamp_old' }),
    P('sebe_1', 'sebe', 11, 21, { w: 2, art: 'props/hedge_wide' }),
    P('sebe_2', 'sebe', 17, 21, { w: 2, art: 'props/hedge_wide' }),
    P('sebe_3', 'sebe', 31, 21, { w: 2, art: 'props/hedge_wide' }),
    P('sebe_4', 'sebe', 37, 21, { w: 2, art: 'props/hedge_wide' }),
    P('arbusto_1', 'sebe', 15, 15, { art: 'props/bush_flower' }),
    P('arbusto_2', 'sebe', 33, 15, { art: 'props/bush_flower' }),
    P('arbusto_3', 'sebe', 10, 24, { art: 'props/bush_flower' }),
    P('arbusto_4', 'sebe', 39, 24, { art: 'props/bush_flower' }),
    {
      id: 'quiosque',
      kind: 'quiosque',
      x: 20,
      y: 14,
      blocks: true,
      action: 'kiosk',
      interact: { x: 21, y: 14 },
      label: { pt: 'Quiosque de missões', en: 'Quest kiosk' },
    },
    {
      id: 'barraca',
      kind: 'barraca_chapeus',
      x: 34,
      y: 14,
      w: 2,
      h: 1,
      blocks: true,
      action: 'shop_hats',
      interact: { x: 34, y: 15 },
      label: { pt: 'Chapéus da Nanda', en: 'Nanda’s Hats' },
    },
    {
      id: 'poleiro',
      kind: 'poleiro',
      x: 30,
      y: 24,
      blocks: true,
      action: 'parrot_perch',
      interact: { x: 29, y: 24 },
      label: { pt: 'Poleiro do papagaio', en: 'Parrot perch' },
    },
    // ---- west: a house with its fenced garden, and the vira-lata corner
    front('casa_oeste', 'casas/terraco_verde', 2, 14, 6, 6),
    P('cerca_oeste', 'cerca', 0, 20, { w: 9, h: 4, art: 'cerca_jardim' }),
    cen('jardim_1', 'props/flor_rosa', 1, 21, 2, 1),
    cen('jardim_2', 'props/flor_vermelha', 2, 22, 2, 1),
    cen('jardim_3', 'props/pot_teal', 3, 21),
    cen('jardim_bici', 'props/bicicletario', 4, 22),
    cen('edicula', 'props/edicula', 6, 21, 3, 2),
    cen('manga', 'props/manga', 1, 17, 1, 1, { blocks: true }),
    P('flor_o1', 'sebe', 8, 14, { w: 2, art: 'props/flor_mista' }),
    P('ipe_oeste', 'ipe', 3, 27),
    P('ipe_oeste_2', 'ipe', 8, 24),
    cen('vira_lata', 'critters/vira_lata_sleep_e', 5, 26, 1, 1, { blocks: true, label: { pt: 'Vira-lata caramelo', en: 'Caramel stray dog (vira-lata)' } }),
    P('hidrante', 'sebe', 6, 28, { art: 'props/hidrante' }),
    P('caixa_correio', 'sebe', 8, 28, { art: 'props/caixa_correio' }),
    P('lixeira_o', 'lixeira', 7, 26),
    P('flor_o2', 'sebe', 1, 28, { w: 2, art: 'props/flor_rosa' }),
    bench('banco_oeste', 1, 25),
    // V2: a clipped dog (topiary) in the dog corner, a clipped bear on the north-west lawn, a topiary pot by the Edifício's door
    cen('topiaria_cao', 'props/topiaria_cao', 1, 26, 2, 1, { blocks: true }),
    cen('topiaria_urso', 'props/topiaria_urso', 11, 19, 1, 1, { blocks: true }),
    cen('revisteiro', 'props/revisteiro', 23, 7, 1, 1, { blocks: true, label: { pt: 'Revisteiro da banca', en: 'Newsstand magazine rack' } }),
    cen('bici_2', 'props/bicicletario', 36, 29, 1, 1, { blocks: true }),
    cen('bici_3', 'props/bicicletario', 45, 7, 1, 1, { blocks: true }),
    cen('vaso_topiaria_1', 'props/vaso_topiaria_a', 23, 6, 1, 1, { blocks: true }),
    // ---- east: the feira livre lot (x41-55, y14-29), fenced, with a gate on the brick bar (x41, y21-22). Open 06:00-13:00 (`feira.ts`);
    // outside those hours the stalls show folded. V2: a closed street (asphalt) with two rows of stalls facing south. The vendor stands in
    // FRONT of the stall (x + 1, y + 2), facing the aisle, and customers talk to them from the next tile (x + 1, y + 3).
    P('cerca_leste', 'cerca', 41, 14, { w: 15, h: 16, art: 'cerca_feira', gaps: [{ x: 41, y: 21 }, { x: 41, y: 22 }] }),
    cen('feira_livre', 'props/feira_livre', 44, 15, 5, 1, { label: { pt: 'Feira livre', en: 'Street market' } }),
    feiraStall('feira_tia_lu', 'tia_lu', 'frutas', 44, 17, { pt: 'Frutas da Tia Lu', en: 'Tia Lu’s fruit stall' }),
    feiraStall('feira_ze', 'ze', 'verduras', 50, 17, { pt: 'Verduras do Seu Zé', en: 'Seu Zé’s vegetable stall' }),
    feiraStall('feira_chico', 'chico', 'pastel', 44, 24, { pt: 'Pastel e caldo de cana do Seu Chico', en: 'Seu Chico’s pastel and sugarcane juice' }),
    feiraStall('feira_rosa', 'rosa', 'flores', 50, 24, { pt: 'Flores da Dona Rosa', en: 'Dona Rosa’s flowers' }),
    // crates, sacks, scales and two carts around the stalls (blocking, never on a vendor's or a customer's tile)
    cen('caixote_1', 'feira/cx_banana', 42, 18, 1, 1, { blocks: true }),
    cen('caixote_2', 'feira/cx_tomate', 43, 18, 1, 1, { blocks: true }),
    cen('caixote_3', 'feira/cx_melancia', 53, 18, 1, 1, { blocks: true }),
    cen('caixote_4', 'feira/cx_repolho', 54, 18, 1, 1, { blocks: true }),
    cen('caixote_5', 'feira/cx_repolho', 42, 25, 1, 1, { blocks: true }),
    cen('caixote_6', 'feira/cx_tomate', 53, 25, 1, 1, { blocks: true }),
    cen('caixote_7', 'feira/cx_banana', 54, 25, 1, 1, { blocks: true }),
    cen('carrinho_feira_1', 'feira/carrinho_a', 47, 18, 3, 1, { blocks: true }),
    cen('carrinho_feira_2', 'feira/carrinho_b', 52, 23, 3, 1, { blocks: true }),
    cen('caixote_8', 'feira/cx_melancia', 49, 25, 1, 1, { blocks: true }),
    cen('sacos_1', 'feira/sacos', 53, 19, 1, 1, { blocks: true }),
    cen('sacos_2', 'feira/sacos', 54, 26, 1, 1, { blocks: true }),
    cen('balanca_1', 'feira/balanca', 46, 19, 1, 1, { blocks: true }),
    cen('balanca_2', 'feira/balanca', 52, 19, 1, 1, { blocks: true }),
    cen('balanca_3', 'feira/balanca', 46, 26, 1, 1, { blocks: true }),
    cen('balanca_4', 'feira/balanca', 52, 26, 1, 1, { blocks: true }),
    cen('lousa_tia_lu', 'feira/preco_lousa', 43, 19),
    cen('lousa_ze', 'feira/preco_lousa', 49, 19),
    cen('lousa_chico', 'feira/preco_lousa', 43, 26),
    cen('lousa_rosa', 'feira/preco_lousa', 49, 26),
    // festa-junina bunting over the aisle (overhead, thin: people stay visible)
    cen('bandeirinhas_1', 'props/bandeirinhas_b', 42, 21, 6, 1),
    cen('bandeirinhas_2', 'props/bandeirinhas_b', 48, 21, 6, 1),
    cen('bandeirinhas_3', 'props/bandeirinhas_a', 46, 23, 4, 1),
    P('ipe_lote_1', 'arvore', 53, 28, { w: 2, art: 'props/arvore_rua' }),
    P('ipe_lote_2', 'arvore', 42, 15, { w: 2, art: 'props/arvore_rua' }),
    cen('flor_lote', 'props/flor_mista_b', 46, 28, 3, 1),
    // ---- the Hortifrúti corner at the banca: Tia Lu's crates, open at every hour (D12)
    P('hortifruti', 'hortifruti', 18, 7, { art: 'feira/caixotes', action: 'feira_stall', vendor: 'banca', interact: { x: 19, y: 7 }, label: { pt: 'Hortifrúti da banca', en: 'Greengrocer at the newsstand' } }),
    cen('hortifruti_2', 'feira/caixotes', 17, 7, 1, 1, { blocks: true }),
    cen('hortifruti_preco', 'feira/preco_lousa', 17, 6),
    // ---- V2: pit trees along both streets (a stone pit, canopy over the curb), set clear of the doors and crosswalks
    P('arv_n1', 'arvore', 7, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_n2', 'arvore', 27, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_n3', 'arvore', 43, 7, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s1', 'arvore', 7, 12, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s2', 'arvore', 18, 12, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s3', 'arvore', 36, 12, { w: 2, art: 'props/arvore_rua' }),
    P('arv_s4', 'arvore', 48, 12, { w: 2, art: 'props/arvore_rua' }),
    P('arv_j1', 'arvore', 5, 31, { w: 2, art: 'props/arvore_rua' }),
    P('arv_j2', 'arvore', 22, 31, { w: 2, art: 'props/arvore_rua' }),
    P('arv_j3', 'arvore', 35, 31, { w: 2, art: 'props/arvore_rua' }),
    P('arv_j4', 'arvore', 45, 31, { w: 2, art: 'props/arvore_rua' }),
    // ---- V2: parked vehicles at the south curb of each street (they block their curb tiles only: never a crosswalk, a sidewalk or a lane).
    // The traffic lanes sit above them (see ambientData.ts); the bus stops east of the bus stop sign, so that curb stays free there.
    ...parked(11, [['park_verde_r', 2, 5], ['park_vinho_r', 8, 4], ['park_azul_r', 18, 4], ['park_bege_l', 27, 5], ['park_fusca_e', 43, 3], ['park_taxi_r', 47, 5]]),
    ...parked(35, [['park_taxi_r', 3, 5], ['park_moto_e', 9, 2], ['park_turquesa_l', 16, 4], ['park_branco_r', 28, 5], ['park_kombi_e', 33, 4], ['park_vermelho_l', 43, 5], ['park_moto_e', 50, 2]]),
    // ---- the map edges: streets end in barricades, sidewalks in hedges, the west lawns and the lot behind fences
    ...vilaIpeEdges(),
    // ---- south: the roofs across Rua Jacarandá (blocked)
    front('telhado_1', 'telhados/r1', 0, 36, 6, 4),
    front('telhado_2', 'telhados/r2', 6, 36, 6, 4),
    front('telhado_3', 'telhados/r3', 12, 36, 6, 4),
    front('telhado_4', 'telhados/r4', 18, 36, 7, 4),
    front('telhado_5', 'telhados/r5', 25, 36, 6, 4),
    front('telhado_6', 'telhados/r6', 31, 36, 6, 4),
    front('telhado_7', 'telhados/r7', 37, 36, 6, 4),
    front('telhado_8', 'telhados/r8', 43, 36, 6, 4),
    front('telhado_9', 'telhados/r9', 49, 36, 7, 4),
    // ---- more life along the sidewalks and the praça
    P('flor_s1', 'sebe', 13, 12, { w: 2, art: 'props/flor_vermelha' }),
    P('flor_s2', 'sebe', 44, 12, { w: 3, art: 'props/flor_mista' }),
    P('hidrante_s', 'sebe', 5, 12, { art: 'props/hidrante_amarelo' }),
    P('parquimetro', 'sebe', 28, 12, { art: 'props/parquimetro' }),
    P('flor_p1', 'sebe', 21, 28, { w: 3, art: 'props/flor_mista' }),
    P('flor_p2', 'sebe', 26, 29, { w: 3, art: 'props/flor_branca_l' }),
    P('lampada_s1', 'poste', 8, 30, { art: 'props/lamp_old' }),
    P('lampada_s2', 'poste', 17, 30, { art: 'props/lamp_old' }),
    P('lampada_s3', 'poste', 33, 30, { art: 'props/lamp_old' }),
    P('lampada_s4', 'poste', 42, 30, { art: 'props/lamp_old' }),
    P('lixeira_s3', 'lixeira', 20, 30),
    P('flor_s3', 'sebe', 3, 30, { w: 2, art: 'props/flor_rosa' }),
    P('flor_s4', 'sebe', 50, 30, { w: 2, art: 'props/flor_branca' }),
    P('hidrante_s2', 'sebe', 37, 31, { art: 'props/hidrante' }),
    P('flor_s5', 'sebe', 27, 31, { w: 2, art: 'props/flor_branca' }),
  ],
  walls: [],
  portals: [
    {
      id: 'praca_padaria',
      x: 16,
      y: 5,
      to: 'padaria',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 15.5, y: 5 },
      label: { pt: 'Padaria do Seu Carlos', en: 'Seu Carlos’s bakery' },
    },
    {
      id: 'praca_kitnet',
      x: 24,
      y: 5,
      to: 'kitnet',
      arrive: { x: 1, y: 5 },
      arriveDir: 'SE',
      doorAt: { x: 24, y: 5 },
      label: { pt: 'Edifício Ipê — Minha kitnet', en: 'Ipê Building — my studio apartment' },
    },
    {
      id: 'praca_academia',
      x: 38,
      y: 5,
      to: 'academia',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      doorAt: { x: 37.5, y: 5 },
      label: { pt: 'Academia do Bairro', en: 'Neighborhood Academy' },
    },
  ],
  npcs: [
    {
      id: 'nanda',
      name: 'Nanda',
      role: { pt: 'Loja de chapéus', en: 'Hat stall' },
      x: 35,
      y: 13,
      dir: 'SW',
      interact: { x: 34, y: 15 },
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
      // near the kiosk, on the path to the fountain, far enough from it that her plate and bubbles never cover the kiosk sign
      x: 22,
      y: 19,
      dir: 'SW',
      interact: { x: 22, y: 20 },
      schedule: SCHEDULES.julia,
      appearance: { body: 'medio', skin: 2, hair: 'ondulado', hairColor: 2, top: 'blusa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 2, face: 'suave', extra: 'brincos', idle: 'solto' },
      hat: null,
      idleLines: [
        { pt: 'Oi! Precisa de ajuda? Fala comigo!', en: 'Hi! Need help? Talk to me!' },
        { pt: 'A padaria do Seu Carlos é ali!', en: 'Seu Carlos’s bakery is over there!' },
      ],
    },
    // ---- the feira vendors (Phase 9). needs_br: true (names and every call). Each stands behind their stall 06:00-13:00 (`schedules.ts`).
    {
      id: 'tia_lu',
      name: 'Tia Lu',
      role: { pt: 'Frutas da feira', en: 'Fruit at the feira' },
      x: 45,
      y: 19,
      dir: 'SW',
      interact: { x: 45, y: 20 },
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
      x: 51,
      y: 19,
      dir: 'SW',
      interact: { x: 51, y: 20 },
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
      x: 45,
      y: 26,
      dir: 'SW',
      interact: { x: 45, y: 27 },
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
      x: 51,
      y: 26,
      dir: 'SW',
      interact: { x: 51, y: 27 },
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
      to: 'praca',
      arrive: { x: 16, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'Voltar para a praça', en: 'Back to the square' },
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
      to: 'praca',
      arrive: { x: 24, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'Descer para a praça', en: 'Go down to the square' },
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
    'mmmmmmmmmmm',
    'mmmmmmmmmmm',
    'mmmmmmmmmmm',
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
  ],
  walls: [
    { kind: 'placa', wall: 'right', from: 0, to: 4, text: 'ACADEMIA DO BAIRRO' },
    { kind: 'janela', wall: 'left', from: 3, to: 5 },
    { kind: 'poster', wall: 'left', from: 6, to: 8, text: 'OSS · RESPEITO' },
    { kind: 'mural', wall: 'right', from: 5, to: 9, text: 'TREINO · COMUNIDADE' },
  ],
  // Top-down layout (11 columns + the corner): OSS poster | sign | window | mural.
  pixelWalls: [
    { kind: 'poster', wall: 'right', from: -1, to: 1, text: 'OSS · RESPEITO' },
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
      to: 'praca',
      arrive: { x: 38, y: 6 },
      arriveDir: 'SW',
      label: { pt: 'SAÍDA · Praça', en: 'Exit to the square' },
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
        { pt: 'Oss! Bora treinar?', en: 'Oss! Ready to train?' },
        { pt: 'Respeito primeiro, depois o tatame.', en: 'Respect first, then the mat.' },
        { pt: 'Água é vida. Bebe bastante!', en: 'Water is life. Drink plenty!' },
      ],
    },
  ],
  private: false,
};

export const ROOMS: Record<RoomId, RoomDef> = { praca: vilaIpe, padaria, kitnet, academia };
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
