/**
 * A player's own padaria is its own place, not a copy of Seu Carlos's: other walls and floor, its own small layout, and almost nothing in
 * it at first. It grows with the size the owner buys (Balcão → Padaria → Restaurante): a bigger room, more counter, then tables. The room
 * keeps the `padaria` id (the counter game, the house counter and the door rules key on it); the server builds the instance from this and
 * the client draws the same def, so walking and drawing agree.
 *
 * At every size the vitrine is the play spot (Correria) and the balcão sells the house menu to visitors. There is no pot by the door: the
 * owner's upgrades are in the owner menu (a button on screen).
 */
import type { PadariaSize } from './playerPadaria.js';
import type { PropDef, RoomDef, WallDecor } from './rooms.js';

/** Tiles of each size: the Balcão is a little coffee corner, the Padaria the size of Seu Carlos's, the Restaurante bigger. */
export const PADARIA_CASA_DIMS: Record<PadariaSize, { cols: number; rows: number }> = {
  1: { cols: 8, rows: 7 },
  2: { cols: 10, rows: 9 },
  3: { cols: 12, rows: 10 },
};

const FLOOR: Record<PadariaSize, string> = { 1: 'z', 2: 'k', 3: 'm' };

const play = (x: number): PropDef => ({ id: 'vitrine', kind: 'vitrine', x, y: 2, blocks: true, action: 'minigame', interact: { x, y: 4 }, label: { pt: 'Correria no Balcão', en: 'Counter Rush' } });
const counter = (w: number): PropDef => ({ id: 'balcao', kind: 'balcao', x: 1, y: 2, w, h: 1, blocks: true, action: 'padaria_counter', interact: { x: 2, y: 3 }, label: { pt: 'Balcão', en: 'Counter' } });
const table = (n: number, x: number, y: number): PropDef[] => [
  { id: `mesa_${n}`, kind: 'mesa', x, y, blocks: true },
  { id: `cadeira_${n}a`, kind: 'cadeira_padaria', x: x - 1, y, blocks: false, seat: 'SE' },
  { id: `cadeira_${n}b`, kind: 'cadeira_padaria', x, y: y + 1, blocks: false, seat: 'NE' },
];

function props(size: PadariaSize): PropDef[] {
  if (size === 1)
    // a coffee corner: a short counter, the display case (play) and the till, nothing else yet
    return [counter(3), play(4), { id: 'caixa', kind: 'caixa', x: 5, y: 2, blocks: true, label: { pt: 'Caixa', en: 'Cash register' } }];
  if (size === 2)
    return [
      { id: 'caixa', kind: 'caixa', x: 0, y: 2, blocks: true, label: { pt: 'Caixa', en: 'Cash register' } },
      counter(4),
      play(5),
      { id: 'estufa', kind: 'estufa', x: 6, y: 2, blocks: true, label: { pt: 'Estufa de salgados', en: 'Warm snack display' } },
      { id: 'banqueta_1', kind: 'banqueta', x: 1, y: 3, blocks: false, seat: 'NE' },
      ...table(1, 6, 6),
      { id: 'vaso', kind: 'vaso', x: 9, y: 8, blocks: true },
    ];
  return [
    { id: 'caixa', kind: 'caixa', x: 0, y: 2, blocks: true, label: { pt: 'Caixa', en: 'Cash register' } },
    counter(5),
    play(6),
    { id: 'estufa', kind: 'estufa', x: 7, y: 2, blocks: true, label: { pt: 'Estufa de salgados', en: 'Warm snack display' } },
    { id: 'banqueta_1', kind: 'banqueta', x: 1, y: 3, blocks: false, seat: 'NE' },
    { id: 'banqueta_2', kind: 'banqueta', x: 3, y: 3, blocks: false, seat: 'NE' },
    ...table(1, 4, 6),
    ...table(2, 8, 6),
    ...table(3, 6, 8),
    { id: 'vaso', kind: 'vaso', x: 11, y: 2, blocks: true },
    { id: 'vaso_2', kind: 'vaso', x: 11, y: 9, blocks: true },
  ];
}

function walls(size: PadariaSize): WallDecor[] {
  const out: WallDecor[] = [
    { kind: 'janela', wall: 'right', from: 1, to: 3 },
    { kind: 'lousa', wall: 'right', from: 4, to: 6, text: 'CARDÁPIO' },
  ];
  if (size >= 2) out.push({ kind: 'relogio', wall: 'right', from: 7, to: 8 }, { kind: 'foto', wall: 'right', from: 8, to: 10 });
  if (size >= 3) out.push({ kind: 'janela', wall: 'right', from: 10, to: 12 });
  return out;
}

const cache = new Map<PadariaSize, RoomDef>();

/** The room of a player-owned padaria of this size (one shared object per size, so the scene does not rebuild every frame). */
export function padariaCasaRoom(size: PadariaSize): RoomDef {
  const hit = cache.get(size);
  if (hit) return hit;
  const { cols, rows } = PADARIA_CASA_DIMS[size];
  // the door is on the same row at every size (a few steps from the counter, like Seu Carlos's)
  const door = 5;
  const def: RoomDef = {
    id: 'padaria',
    name: 'Padaria',
    gloss: 'Bakery',
    cols,
    rows,
    floor: Array.from({ length: rows }, () => FLOOR[size].repeat(cols)),
    wallHeight: 130,
    wallColor: '#EAF2E6',
    wallTrim: '#2E7D5B',
    lighting: 'dia',
    spawn: { x: 1, y: door },
    props: props(size),
    walls: walls(size),
    pixelWalls: walls(size),
    portals: [{ id: 'padaria_praca', x: 0, y: door, wall: 'left', to: 'rua', arrive: { x: 4, y: 6 }, arriveDir: 'SW', label: { pt: 'Voltar para a rua', en: 'Back to the street' } }],
    npcs: [],
    private: false,
    wallStyle: 'kitnet',
    noHotspots: true,
  };
  cache.set(size, def);
  return def;
}
