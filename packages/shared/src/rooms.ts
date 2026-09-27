import type { Appearance, Bilingual, Dir, PlacedFurniture, RoomId, Tile } from './types.js';
import { furnitureById } from './catalog.js';

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
  | 'quadro_foto';

export type PropAction = 'shop_hats' | 'minigame' | 'kiosk' | 'parrot_perch' | 'catalog' | 'bjj_roll';

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
  wall: WallSide;
  to: RoomId;
  /** Where you appear in the destination room. */
  arrive: Tile;
  arriveDir: Dir;
  label: Bilingual;
}

export type NpcId = 'carlos' | 'nanda' | 'julia';

export interface NpcDef {
  id: NpcId;
  name: string;
  role: Bilingual;
  x: number;
  y: number;
  dir: Dir;
  interact: Tile;
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
  spawn: Tile;
  props: PropDef[];
  walls: WallDecor[];
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

const praca: RoomDef = {
  id: 'praca',
  name: 'Praça Central',
  gloss: 'Central Square',
  cols: 14,
  rows: 12,
  floor: [
    'cccctttccccccc',
    'cccctttccccccc',
    'ccccttcccccccc',
    'cccccttccccccc',
    'cccgggttcccccc',
    'ccggggggcccccc',
    'ccggggggcccccc',
    'cccgggggcccccc',
    'ccccgggccccccc',
    'cccccccccccccg',
    'gggccccccccggg',
    'gggcccccccgggg',
  ],
  wallHeight: 150,
  wallColor: '#d8cbb6',
  wallTrim: '#9c8b74',
  lighting: 'tarde',
  spawn: { x: 7, y: 9 },
  props: [
    // Hero ipê sits left of centre so its canopy never hides the Missão do dia kiosk or Júlia.
    { id: 'ipe_centro', kind: 'ipe', x: 4, y: 7, blocks: true, hero: true },
    { id: 'ipe_canto', kind: 'ipe', x: 1, y: 10, blocks: true },
    { id: 'ipe_esquina', kind: 'ipe', x: 12, y: 10, blocks: true },
    { id: 'canteiro', kind: 'canteiro', x: 4, y: 5, blocks: true },
    { id: 'banco_1', kind: 'banco', x: 7, y: 5, blocks: false, seat: 'SW' },
    { id: 'banco_2', kind: 'banco', x: 7, y: 7, blocks: false, seat: 'SW' },
    { id: 'banco_3', kind: 'banco', x: 4, y: 8, blocks: false, seat: 'SE' },
    { id: 'banco_4', kind: 'banco', x: 9, y: 11, blocks: false, seat: 'NE' },
    { id: 'banco_5', kind: 'banco', x: 10, y: 4, blocks: false, seat: 'SW' },
    { id: 'banco_6', kind: 'banco', x: 5, y: 10, blocks: false, seat: 'NE' },
    { id: 'poste_1', kind: 'poste', x: 8, y: 3, blocks: true },
    { id: 'poste_2', kind: 'poste', x: 3, y: 9, blocks: true },
    { id: 'lixeira', kind: 'lixeira', x: 9, y: 3, blocks: true },
    { id: 'banca', kind: 'banca', x: 12, y: 2, w: 1, h: 2, blocks: true, label: { pt: 'Banca de jornal', en: 'Newsstand' } },
    {
      id: 'barraca',
      kind: 'barraca_chapeus',
      x: 11,
      y: 6,
      w: 2,
      h: 1,
      blocks: true,
      action: 'shop_hats',
      interact: { x: 11, y: 7 },
      label: { pt: 'Chapéus da Nanda', en: 'Nanda’s Hats' },
    },
    {
      id: 'quiosque',
      kind: 'quiosque',
      x: 2,
      y: 2,
      blocks: true,
      action: 'kiosk',
      interact: { x: 3, y: 3 },
      label: { pt: 'Quiosque de missões', en: 'Quest kiosk' },
    },
    {
      id: 'poleiro',
      kind: 'poleiro',
      x: 10,
      y: 9,
      blocks: true,
      action: 'parrot_perch',
      interact: { x: 9, y: 9 },
      label: { pt: 'Poleiro do papagaio', en: 'Parrot perch' },
    },
    { id: 'bici', kind: 'bicicletario', x: 1, y: 7, blocks: true },
    { id: 'orelhao', kind: 'orelhao', x: 13, y: 4, blocks: true, label: { pt: 'Orelhão', en: 'Public phone booth (“big ear”)' } },
    { id: 'placa', kind: 'placa_rua', x: 0, y: 8, blocks: true, label: { pt: 'Rua dos Ipês', en: 'Ipê Street (street sign)' } },
    // Midground life (polish v2). All off the CPU lanes, doors, arrival and interact tiles.
    { id: 'mesa_cafe', kind: 'mesa_cafe', x: 7, y: 1, blocks: true, label: { pt: 'Mesinha da padaria', en: 'Bakery sidewalk table' } },
    { id: 'jornais', kind: 'jornais', x: 11, y: 2, blocks: true, label: { pt: 'Pilha de jornais', en: 'Newspaper stack' } },
    { id: 'saco_lixo', kind: 'saco_lixo', x: 9, y: 2, blocks: true },
    { id: 'floreira_1', kind: 'floreira', x: 8, y: 0, blocks: true },
    { id: 'floreira_2', kind: 'floreira', x: 13, y: 0, blocks: true },
    { id: 'floreira_3', kind: 'floreira', x: 0, y: 6, blocks: true },
  ],
  walls: [
    { kind: 'predio', wall: 'right', from: 0, to: 3 },
    { kind: 'fachada_padaria', wall: 'right', from: 3, to: 7, text: 'PADARIA DO SEU CARLOS' },
    { kind: 'mural', wall: 'right', from: 7, to: 14, text: 'SAMPA' },
    { kind: 'predio', wall: 'left', from: 0, to: 2 },
    { kind: 'predio', wall: 'left', from: 2, to: 6, text: 'EDIFÍCIO IPÊ' },
    { kind: 'mural', wall: 'left', from: 6, to: 9, text: 'TUDO BEM?' },
    { kind: 'metro', wall: 'left', from: 9, to: 12, text: 'METRÔ' },
  ],
  portals: [
    {
      id: 'praca_padaria',
      x: 5,
      y: 0,
      wall: 'right',
      to: 'padaria',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      label: { pt: 'Padaria do Seu Carlos', en: 'Seu Carlos’s bakery' },
    },
    {
      id: 'praca_kitnet',
      x: 0,
      y: 4,
      wall: 'left',
      to: 'kitnet',
      arrive: { x: 1, y: 5 },
      arriveDir: 'SE',
      label: { pt: 'Edifício Ipê — Minha kitnet', en: 'Ipê Building — my studio apartment' },
    },
    {
      id: 'praca_academia',
      x: 10,
      y: 0,
      wall: 'right',
      to: 'academia',
      arrive: { x: 1, y: 6 },
      arriveDir: 'SE',
      label: { pt: 'Academia do Bairro', en: 'Neighborhood Academy' },
    },
  ],
  npcs: [
    {
      id: 'nanda',
      name: 'Nanda',
      role: { pt: 'Loja de chapéus', en: 'Hat stall' },
      x: 12,
      y: 5,
      dir: 'SW',
      interact: { x: 11, y: 7 },
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
      // Mid-praça, far enough forward that her nameplate and idle bubbles never cover the kiosk sign.
      x: 8,
      y: 4,
      dir: 'SW',
      interact: { x: 8, y: 5 },
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
  portals: [
    {
      id: 'padaria_praca',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'praca',
      arrive: { x: 5, y: 1 },
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
      appearance: { body: 'forte', skin: 3, hair: 'curto', hairColor: 5, top: 'camisa', topColor: 3, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'maduro', extra: 'bigode', idle: 'solto' },
      hat: 'chapeu_chef',
      idleLines: [
        { pt: 'Pão quentinho saindo!', en: 'Warm bread coming out!' },
        { pt: 'Bom dia! Vai um cafezinho?', en: 'Good morning! How about a little coffee?' },
        { pt: 'Chega mais, pode pedir!', en: 'Come on over, go ahead and order!' },
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
      arrive: { x: 1, y: 4 },
      arriveDir: 'SE',
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
    { id: 'banco_esp', kind: 'banco_espectador', x: 9, y: 6, blocks: false, seat: 'SW', label: { pt: 'Banco dos espectadores', en: 'Spectator bench' } },
    { id: 'banco_esp_2', kind: 'banco_espectador', x: 7, y: 7, blocks: false, seat: 'SE', label: { pt: 'Banco', en: 'Bench' } },
    { id: 'vestiario', kind: 'vestiario', x: 0, y: 7, blocks: true, label: { pt: 'Vestiário · alongamento', en: 'Changing / stretch corner' } },
  ],
  walls: [
    { kind: 'placa', wall: 'right', from: 0, to: 4, text: 'ACADEMIA DO BAIRRO' },
    { kind: 'janela', wall: 'left', from: 3, to: 5 },
    { kind: 'poster', wall: 'left', from: 6, to: 8, text: 'OSS · RESPEITO' },
    { kind: 'mural', wall: 'right', from: 5, to: 9, text: 'TREINO · COMUNIDADE' },
  ],
  portals: [
    {
      id: 'academia_praca',
      x: 0,
      y: 6,
      wall: 'left',
      to: 'praca',
      arrive: { x: 10, y: 1 },
      arriveDir: 'SW',
      label: { pt: 'SAÍDA · Praça', en: 'Exit to the square' },
    },
  ],
  npcs: [],
  private: false,
};

export const ROOMS: Record<RoomId, RoomDef> = { praca, padaria, kitnet, academia };
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
      if (p.blocks) blocked.add(key(t.x, t.y));
    }
    if (p.seat) seats.set(key(p.x, p.y), p.seat);
  }
  for (const n of room.npcs) {
    blocked.add(key(n.x, n.y));
    reserved.add(key(n.x, n.y));
  }
  for (const portal of room.portals) {
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
