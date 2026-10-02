/**
 * The art contract of "Correria no Balcão" (the counter game behind the padaria counter) and where each piece stands.
 * Pure data (no Phaser, no DOM): the stage draws from it and the art branch drew to it (assets-src/custom, `balcao-sheet.mjs`).
 *
 * Every key is its own manifest sprite, anchor bottom-centre, sizes as listed. Until a key exists the stage draws a magenta box
 * (`artMissing`, HOWTO 5.10).
 *
 *   balcao/item_<itemId>            28x28, anchor (14, 26), one per shelf item id in `meveum.ts`
 *   balcao/tray 64x16 (32, 14) · tray_full 64x34 (32, 32) · bag 24x30 (12, 28) · plate 28x12 (14, 10)
 *   balcao/chapa_<idle|sizzle_0..2|burnt>  40x36 (20, 35)
 *   balcao/coffee_<idle|pour_0..3>         34x42 (17, 41)
 *   balcao/register 26x24 (13, 23) · bell_<0..1> 22x16 (11, 14) · tipjar_<0..3> 20x24 (10, 23, the fill states)
 *   balcao/patience_<0..4>          14x14 (7, 14), 4 = full ... 0 = out, the meter over a customer's head
 *   fx/steam_<0..3>                 14x24 (7, 23)
 *
 * Positions are room pixels (the padaria is 160 x 144; one tile is 16) of each piece's anchor. The work board is a flat wooden plate the
 * stage draws over the counter area (it hides the room's own counter props while a shift runs), so every piece reads on the same surface.
 */
import { MG_ITEMS } from '@tudobem/shared';

export interface Spot {
  x: number;
  y: number;
}

export const itemKey = (id: string): string => `balcao/item_${id}`;
export const ART = {
  tray: 'balcao/tray',
  trayFull: 'balcao/tray_full',
  bag: 'balcao/bag',
  plate: 'balcao/plate',
  register: 'balcao/register',
} as const;
export const chapaKey = (f: 'idle' | 'sizzle_0' | 'sizzle_1' | 'sizzle_2' | 'burnt'): string => `balcao/chapa_${f}`;
export const coffeeKey = (f: 'idle' | 0 | 1 | 2 | 3): string => (f === 'idle' ? 'balcao/coffee_idle' : `balcao/coffee_pour_${f}`);
export const bellKey = (i: 0 | 1): string => `balcao/bell_${i}`;
export const tipjarKey = (i: 0 | 1 | 2 | 3): string => `balcao/tipjar_${i}`;
export const patienceKey = (i: 0 | 1 | 2 | 3 | 4): string => `balcao/patience_${i}`;
export const steamKey = (i: number): string => `fx/steam_${((i % 4) + 4) % 4}`;

/** Contracted sprite sizes (w, h, anchor x, anchor y) by key family, for the contract test. */
export const ART_SIZES: Record<string, [number, number, number, number]> = {
  item: [28, 28, 14, 26],
  tray: [64, 16, 32, 14],
  tray_full: [64, 34, 32, 32],
  bag: [24, 30, 12, 28],
  plate: [28, 12, 14, 10],
  chapa: [40, 36, 20, 35],
  coffee: [34, 42, 17, 41],
  register: [26, 24, 13, 23],
  bell: [22, 16, 11, 14],
  tipjar: [20, 24, 10, 23],
  patience: [14, 14, 7, 14],
  steam: [14, 24, 7, 23],
};

/** Every key the game may ask the manifest for. */
export function allArtKeys(): string[] {
  const keys: string[] = [ART.tray, ART.trayFull, ART.bag, ART.plate, ART.register];
  for (const i of MG_ITEMS) keys.push(itemKey(i.id));
  for (const f of ['idle', 'sizzle_0', 'sizzle_1', 'sizzle_2', 'burnt'] as const) keys.push(chapaKey(f));
  for (const f of ['idle', 0, 1, 2, 3] as const) keys.push(coffeeKey(f));
  for (const i of [0, 1] as const) keys.push(bellKey(i));
  for (const i of [0, 1, 2, 3] as const) keys.push(tipjarKey(i));
  for (const i of [0, 1, 2, 3, 4] as const) keys.push(patienceKey(i));
  for (let i = 0; i < 4; i++) keys.push(steamKey(i));
  return keys;
}

/** The expected [w, h, ax, ay] of a key. */
export function sizeOfKey(key: string): [number, number, number, number] | null {
  if (key.startsWith('balcao/item_')) return ART_SIZES.item!;
  if (key === ART.trayFull) return ART_SIZES.tray_full!;
  if (key === ART.tray) return ART_SIZES.tray!;
  if (key === ART.bag) return ART_SIZES.bag!;
  if (key === ART.plate) return ART_SIZES.plate!;
  if (key === ART.register) return ART_SIZES.register!;
  const fam = /^(?:balcao|fx)\/([a-z]+)_/.exec(key)?.[1];
  return fam ? (ART_SIZES[fam] ?? null) : null;
}

// ---------------------------------------------------------------- where things stand (room px, anchor bottom-centre)

/** The wooden work board the pieces stand on: [x0, y0, x1, y1]. */
export const BOARD = { x0: 4, y0: 2, x1: 156, y1: 124 } as const;

const COLS = [18, 41, 64, 87, 110];
const ROWS = [28, 56, 84];
export const ITEM_SPOTS: Record<string, Spot> = {
  // vitrine and estufa
  pao: { x: COLS[0]!, y: ROWS[0]! },
  bolo: { x: COLS[1]!, y: ROWS[0]! },
  pao_de_queijo: { x: COLS[2]!, y: ROWS[0]! },
  pastel: { x: COLS[3]!, y: ROWS[0]! },
  coxinha: { x: COLS[4]!, y: ROWS[0]! },
  // geladeira, then the two cups next to the coffee machine
  suco_de_laranja: { x: COLS[0]!, y: ROWS[1]! },
  agua: { x: COLS[1]!, y: ROWS[1]! },
  guarana: { x: COLS[2]!, y: ROWS[1]! },
  cafe: { x: COLS[3]!, y: ROWS[1]! },
  cafe_com_leite: { x: COLS[4]!, y: ROWS[1]! },
  // raw bread next to the chapa
  pao_na_chapa: { x: COLS[3]!, y: ROWS[2]! },
  misto_quente: { x: COLS[4]!, y: ROWS[2]! },
};
export const COFFEE_SPOT: Spot = { x: 140, y: 56 };
export const CHAPA_SPOT: Spot = { x: 140, y: 92 };
/** Where a piece on the grill sits (item sprites at CHAPA_ITEM_SCALE), by slot. */
export const CHAPA_SLOTS: Spot[] = [
  { x: 131, y: 84 },
  { x: 149, y: 84 },
];
export const CHAPA_ITEM_SCALE = 0.62;
export const REGISTER_SPOT: Spot = { x: 17, y: 88 };
export const TIPJAR_SPOT: Spot = { x: 43, y: 88 };
export const BELL_SPOT: Spot = { x: 66, y: 86 };
export const TRAY_SPOT: Spot = { x: 38, y: 118 };
export const BAG_SPOT: Spot = { x: 92, y: 118 };
export const PLATE_SPOT: Spot = { x: 122, y: 116 };
/** The cup under the spout while one is chosen / pouring. */
export const SPOUT: Spot = { x: 140, y: 50 };

/** Customer feet: the front one first, then the queue (room px). They come in through the door on the left. */
export const QUEUE_SPOTS: Spot[] = [
  { x: 104, y: 140 },
  { x: 132, y: 138 },
  { x: 76, y: 138 },
];
export const DOOR_SPOT: Spot = { x: -14, y: 138 };

/** The counter's focus for the camera (room px): the middle of the work board and the queue. */
export const FOCUS: Spot = { x: 80, y: 74 };

/** Miniature item size on the tray (item sprites are drawn at this scale there). */
export const TRAY_ITEM_SCALE = 0.55;
/** Slots on the tray for the miniatures, relative to TRAY_SPOT (x offsets, one row; a second row above when more than 5). */
export function traySlot(i: number): Spot {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return { x: TRAY_SPOT.x - 24 + col * 12, y: TRAY_SPOT.y - 5 - row * 9 };
}
