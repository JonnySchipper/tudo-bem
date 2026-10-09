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
 *   balcao/juicer_<idle|roll|cut|press|pour|peel|ready>  40x42 (20, 41), the espremedor through one orange (`juicerStep`); ready = glass at the line
 *   balcao/juice_glass_<0..9> · juice_glass_spill  14x12 (7, 11), the glass under its spout, 7 rows = the line
 *   balcao/orange_<p|m|g>           7x7 (3, 6) · 9x9 (4, 8) · 11x11 (5, 10), the next orange in the hopper
 *   balcao/laranjas                 28x28 (14, 26), the crate of oranges in suco's shelf cell (a tap feeds the machine)
 *
 * Positions are room pixels (the padaria is 160 x 144; one tile is 16) of each piece's anchor. The work board is a flat wooden plate the
 * stage draws over the counter area (it hides the room's own counter props while a shift runs), so every piece reads on the same surface.
 */
import { MG_ITEMS, type JuicerStep, type OrangeSize } from '@tudobem/shared';

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
/** The machine's frames: the steps of its cycle, and `ready` (idle with the green lamp lit: the glass is at the line). */
export type JuicerFrame = JuicerStep | 'ready';
export const juicerKey = (s: JuicerFrame): string => `balcao/juicer_${s}`;
/** Glass rows: 7 is the line, 9 is to the rim. */
export const JUICE_GLASS_LEVELS = 10;
export const JUICE_LINE_ROWS = 7;
export const juiceGlassKey = (k: number | 'spill'): string => `balcao/juice_glass_${k === 'spill' ? 'spill' : Math.max(0, Math.min(JUICE_GLASS_LEVELS - 1, Math.round(k)))}`;
/** Glass rows for a fill (1 = the line). */
export const juiceRows = (fill: number): number => Math.max(0, Math.min(JUICE_GLASS_LEVELS - 1, Math.round(Math.max(0, fill) * JUICE_LINE_ROWS)));
export const orangeKey = (s: OrangeSize): string => `balcao/orange_${s}`;
export const CRATE_KEY = 'balcao/laranjas';
const JUICER_FRAMES: readonly JuicerFrame[] = ['idle', 'roll', 'cut', 'press', 'pour', 'peel', 'ready'];
const ORANGE_SIZE: Record<OrangeSize, [number, number, number, number]> = { p: [7, 7, 3, 6], m: [9, 9, 4, 8], g: [11, 11, 5, 10] };

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
  juicer: [40, 42, 20, 41],
  juice: [14, 12, 7, 11],
  laranjas: [28, 28, 14, 26],
};

/** Every key the game may ask the manifest for. */
export function allArtKeys(): string[] {
  const keys: string[] = [ART.tray, ART.trayFull, ART.bag, ART.plate, ART.register, CRATE_KEY];
  for (const s of JUICER_FRAMES) keys.push(juicerKey(s));
  for (let k = 0; k < JUICE_GLASS_LEVELS; k++) keys.push(juiceGlassKey(k));
  keys.push(juiceGlassKey('spill'));
  for (const s of ['p', 'm', 'g'] as const) keys.push(orangeKey(s));
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
  if (key === CRATE_KEY) return ART_SIZES.laranjas!;
  const orange = /^balcao\/orange_([pmg])$/.exec(key)?.[1] as OrangeSize | undefined;
  if (orange) return ORANGE_SIZE[orange];
  const fam = /^(?:balcao|fx)\/([a-z]+)_/.exec(key)?.[1];
  return fam ? (ART_SIZES[fam] ?? null) : null;
}

// ---------------------------------------------------------------- where things stand (room px, anchor bottom-centre)
//
// A clean grid on the wooden board (it reaches up over the north wall, so the room's 160 x 144 becomes 160 x ~182 of counter):
//   left block   four columns x three rows of shelf items (drawn at ITEM_SCALE, label under each, 32 px between rows)
//   right column the juicer on top (the board rises there), the coffee machine, the chapa (the cups, the raw bread and the crate of
//                oranges are the shelf cells next to them)
//   pack row     tray, bag, plate (y 92)
//   service row  register, tip jar, bell (y 120)
//   floor        the queue on the right (their name tags and meters sit above the pack row, which stays left of x 98)
// Nothing overlaps (the test checks every rectangle) and every label has a 12 px band under its sprite.

/** The wooden work board the pieces stand on: [x0, y0, x1, y1]. It reaches higher on the right for the juicer over the coffee machine. */
export const BOARD = { x0: 3, y0: -66, x1: 157, y1: 129 } as const;
/** Left of this x the board stops at `BOARD_SHELF_TOP` (the room's wall shows there); only the station column rises to `BOARD.y0`. */
export const BOARD_TOWER_X = 115;
export const BOARD_SHELF_TOP = -38;

/** Shelf items are drawn smaller than the 28 px art so twelve fit in a clean grid with their names. */
export const ITEM_SCALE = 0.72;

const COLS = [17, 44, 71, 98];
const ROWS = [-10, 22, 54];
export const ITEM_SPOTS: Record<string, Spot> = {
  // vitrine and estufa
  pao: { x: COLS[0]!, y: ROWS[0]! },
  bolo: { x: COLS[1]!, y: ROWS[0]! },
  pao_de_queijo: { x: COLS[2]!, y: ROWS[0]! },
  pastel: { x: COLS[3]!, y: ROWS[0]! },
  // estufa and geladeira
  coxinha: { x: COLS[0]!, y: ROWS[1]! },
  suco_de_laranja: { x: COLS[1]!, y: ROWS[1]! },
  agua: { x: COLS[2]!, y: ROWS[1]! },
  guarana: { x: COLS[3]!, y: ROWS[1]! },
  // the raw bread for the chapa and the two cups for the machine
  pao_na_chapa: { x: COLS[0]!, y: ROWS[2]! },
  misto_quente: { x: COLS[1]!, y: ROWS[2]! },
  cafe: { x: COLS[2]!, y: ROWS[2]! },
  cafe_com_leite: { x: COLS[3]!, y: ROWS[2]! },
};
export const COFFEE_SPOT: Spot = { x: 136, y: 28 };
/** The espremedor stands at the top of the station column, over the coffee machine (its label band ends where the machine starts). */
export const JUICER_SPOT: Spot = { x: 136, y: -24 };
/** The glass on the juicer's drip tray, right under the spout (anchor bottom-centre of the 14x12 glass). */
export const JUICE_GLASS_SPOT: Spot = { x: JUICER_SPOT.x, y: JUICER_SPOT.y - 2 };
/** The spout tip (the stream runs from here down to the juice). */
export const JUICE_SPOUT: Spot = { x: JUICER_SPOT.x, y: JUICER_SPOT.y - 14 };
/** The next orange, waiting on the feeder cradle right of the hopper dome. */
export const HOPPER_NEXT: Spot = { x: JUICER_SPOT.x + 11, y: JUICER_SPOT.y - 31 };
/** Where the peels drop into the bin (bagaço), for the little tumble. */
export const PEEL_BIN: Spot = { x: JUICER_SPOT.x - 14, y: JUICER_SPOT.y - 12 };
/** The middle of the chamber window (the press splashes from here). */
export const JUICE_CHAMBER: Spot = { x: JUICER_SPOT.x, y: JUICER_SPOT.y - 20 };
/** The sight gauge right of the window (room px of its inside, top-left; `GAUGE` in juicer.mjs). It shows up to `max` of the line. */
export const JUICE_GAUGE = { x: JUICER_SPOT.x - 20 + 33, y: JUICER_SPOT.y - 41 + 18, w: 2, h: 18, max: 1.3 } as const;
export const CHAPA_SPOT: Spot = { x: 136, y: 75 };
/** Where a piece on the grill sits (item sprites at CHAPA_ITEM_SCALE), by slot. */
export const CHAPA_SLOTS: Spot[] = [
  { x: 128, y: 65 },
  { x: 144, y: 65 },
];
export const CHAPA_ITEM_SCALE = 0.6;
export const TRAY_SPOT: Spot = { x: 36, y: 94 };
export const BAG_SPOT: Spot = { x: 84, y: 96 };
export const PLATE_SPOT: Spot = { x: 132, y: 86 };
export const REGISTER_SPOT: Spot = { x: 16, y: 122 };
export const TIPJAR_SPOT: Spot = { x: 44, y: 122 };
export const BELL_SPOT: Spot = { x: 74, y: 122 };
/** The cup under the spout while one is chosen / pouring. */
export const SPOUT: Spot = { x: 136, y: 20 };
/** Where the baker's cheer bubble floats: over the coffee machine, the corner nearest the real baker's side of the counter. */
export const BAKER_SPOT: Spot = { x: 100, y: -32 };

/** Customer feet: the front one first, then the queue (room px). They come in through the door on the left. */
export const QUEUE_SPOTS: Spot[] = [
  { x: 104, y: 142 },
  { x: 126, y: 142 },
  { x: 148, y: 142 },
];
export const DOOR_SPOT: Spot = { x: -14, y: 142 };

/** The counter's focus for the camera (room px): the middle of the board and the queue. */
export const FOCUS: Spot = { x: 80, y: 40 };
/** World px the camera must show: the juicer tower (it starts at BOARD.y0), the board and the queue. Taller than the old shelf so the hopper stays under the HUD. */
export const NEED = { w: 162, h: 216 } as const;

/** Miniature item size on the tray (item sprites are drawn at this scale there). */
export const TRAY_ITEM_SCALE = 0.5;
/** Slots on the tray for the miniatures, relative to TRAY_SPOT (x offsets, one row; a second row above when more than 5). */
export function traySlot(i: number): Spot {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return { x: TRAY_SPOT.x - 24 + col * 12, y: TRAY_SPOT.y - 5 - row * 8 };
}
