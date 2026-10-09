/**
 * The runtime palette swap of the bjj/* pair sprites, slot by slot: each art slot (A, B) is painted as one person (skin, hair and hair
 * style, beard, gi colour, belt). Pure, no relative imports besides palette.ts and bjjKeys.ts, so the asset scripts can load it too.
 */
import { HAIR_KEYS } from './bjjKeys';
import { KEY_RAMPS, buildRamp, hexToRgb, pack, rgbToHex } from './palette';

/** Exact gi colours baked into the pair frames (kept in step with assets-src/custom/bjj-rig.mjs by a test). */
export const GI_WHITE = ['#a9a18e', '#c9c1ae', '#e8e2d4', '#fbf7ee'] as const;
export const GI_BLUE = ['#284676', '#355c98', '#4a78b8', '#6f9ad8'] as const;
export const BELT_BLACK = ['#1c1c28', '#2c2c3e', '#464660'] as const;
export const OUTLINE = '#3a3a50';

/** What one art slot wears in a frame. */
export interface SlotLook {
  skin: string;
  hair: string;
  /** the avatar's hair style (`HairStyle`): curly and long hair get the volume, `coque` the bun, `raspado` a stubble tone */
  style?: string;
  beard?: boolean;
  /** the gi ramp, deep -> light (4) */
  gi: readonly string[];
  /** the belt ramp, deep -> light (3) */
  belt: readonly string[];
}

export interface PairSwap {
  /** key colour -> colour (packed RGB) */
  table: Map<number, number>;
  /** key colours that turn transparent (a hair piece this fighter does not wear) */
  clear: Set<number>;
}

const SLOT = {
  A: { skin: KEY_RAMPS.skin, hair: KEY_RAMPS.hair, gi: GI_WHITE, belt: KEY_RAMPS.belt },
  B: { skin: KEY_RAMPS.skin2, hair: KEY_RAMPS.hair2, gi: GI_BLUE, belt: BELT_BLACK },
} as const;

const VOLUME = new Set(['cacheado', 'black', 'ondulado', 'longo', 'trancas']);
export type HairPiece = 'vol' | 'bun' | null;
export const hairPieceOf = (style: string | undefined): HairPiece => (style === 'coque' ? 'bun' : style && VOLUME.has(style) ? 'vol' : null);

const pk = (hex: string): number => pack(...hexToRgb(hex));

function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** The swap of one slot. */
export function slotSwap(slot: 'A' | 'B', look: SlotLook): PairSwap {
  const table = new Map<number, number>();
  const clear = new Set<number>();
  const keys = SLOT[slot];
  const set = (from: readonly string[], to: readonly string[]) => from.forEach((k, i) => table.set(pk(k), pk(to[i] ?? to[to.length - 1]!)));
  const skin = buildRamp(look.skin, 4);
  // a shaved head is a stubble shadow over the scalp, not a cap of hair colour
  const hair = buildRamp(look.style === 'raspado' ? mix(look.skin, look.hair, 0.55) : look.hair, 4);
  set(keys.skin, skin);
  set(keys.hair, hair);
  set(keys.gi, look.gi);
  set(keys.belt, look.belt);
  const ex = HAIR_KEYS[slot];
  const piece = hairPieceOf(look.style);
  if (piece === 'vol') {
    set(ex.vol, hair.slice(1));
    table.set(pk(ex.volOl), pk(OUTLINE));
    table.set(pk(ex.volSeam), pk(hair[0]!));
  } else {
    for (const k of [...ex.vol, ex.volOl]) clear.add(pk(k));
    table.set(pk(ex.volSeam), pk(OUTLINE));
  }
  if (piece === 'bun') {
    set(ex.bun, hair.slice(1));
    table.set(pk(ex.bunOl), pk(OUTLINE));
  } else for (const k of [...ex.bun, ex.bunOl]) clear.add(pk(k));
  // the beard keys sit over skin ranks 1..3: hair when worn, the same skin rank when not
  ex.beard.forEach((k, i) => table.set(pk(k), pk(look.beard ? hair[i]! : skin[i + 1]!)));
  return { table, clear };
}

export function mergeSwaps(...s: PairSwap[]): PairSwap {
  const table = new Map<number, number>();
  const clear = new Set<number>();
  for (const x of s) {
    for (const [k, v] of x.table) table.set(k, v);
    for (const k of x.clear) clear.add(k);
  }
  return { table, clear };
}

/** Applies a swap to an RGBA buffer in place (cleared keys get alpha 0). Returns the number of pixels touched. */
export function applySwap(data: Uint8ClampedArray | Uint8Array, s: PairSwap): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = pack(data[i]!, data[i + 1]!, data[i + 2]!);
    if (s.clear.has(key)) {
      data[i + 3] = 0;
      n++;
      continue;
    }
    const to = s.table.get(key);
    if (to === undefined) continue;
    data[i] = (to >> 16) & 255;
    data[i + 1] = (to >> 8) & 255;
    data[i + 2] = to & 255;
    n++;
  }
  return n;
}
