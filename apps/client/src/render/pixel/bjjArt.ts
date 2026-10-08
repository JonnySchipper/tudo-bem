/**
 * The art contract of "Treino no tatame" (the pixel art lives in assets-src/custom/bjj*.mjs, apps/client/assets-src/README.md): the
 * manifest keys, frame counts, anchors and the palette-swap tables, so the game and the artists agree. Pure (no Phaser, no DOM).
 *
 *  - `bjj/pair_<pos>_<0..3>`, 4 idle "struggle" frames per position, 56x42, anchor bottom-centre (28, 42) on the mat centre.
 *  - `bjj/trans_<from>__<to>_<0..3>`: 4 frames, play once, every directed step between adjacent positions (both directions).
 *  - `bjj/finish_tap_<0..3>` (loop), `bjj/win_raise_<0..2>`, `bjj/fistbump_<0..3>`, `bjj/face_off_<0..1>`.
 *  - `bjj/ref_<signal>`: Professora Bia, 16x32, anchor (8, 32), on the standard `skin` / `hair` ramps.
 *  - `props/placar`: the mat scoreboard, 48x44, anchor (24, 42), blank digit cells (`PLACAR_CELLS`) filled by the DOM.
 *
 * Roles. In the art fighter A (white gi) is always the one on top and fighter B (blue gi) is under. THE GAME'S CONVENTION: the player
 * always wears the white gi (their own skin, hair and belt) and the partner always the blue gi with a black belt, whoever is on top.
 * When the partner is the dominant one the same frame is drawn with the colours swapped: the top fighter (art A) gets the partner's
 * skin and hair, the blue gi and the black belt; the fighter underneath (art B) gets the player's skin and hair, the white gi and the
 * player's belt. Gi and belt colours are exact baked colours, so the swap is one `swapKeys` pass over this table.
 */
import { buildRamp, mergeTables, rampMap, KEY_RAMPS } from './palette';
import type { BjjPositionId, Belt } from '@tudobem/shared';
import { BELT_COLORS } from '@tudobem/shared';

export const PAIR_POSITIONS: readonly BjjPositionId[] = ['de_pe', 'guarda_fechada', 'meia_guarda', 'cem_quilos', 'joelho', 'montada', 'costas'];
export const FRAMES = { pair: 4, trans: 4, finishTap: 4, winRaise: 3, fistbump: 4, faceOff: 2 } as const;
/** Pair frames: 56x42, anchor (28, 42). */
export const PAIR_SIZE = { w: 56, h: 42, ax: 28, ay: 42 } as const;
export const REF_SIZE = { w: 16, h: 32, ax: 8, ay: 32 } as const;
/** The hand A raises in `win_raise` is at about this point of the 56x42 frame. */
export const WIN_HAND = { x: 27, y: 12 } as const;

export const pairKey = (pos: BjjPositionId, i: number): string => `bjj/pair_${pos}_${i}`;
export const transKey = (from: BjjPositionId, to: BjjPositionId, i: number): string => `bjj/trans_${from}__${to}_${i}`;
export const finishTapKey = (i: number): string => `bjj/finish_tap_${i}`;
export const winRaiseKey = (i: number): string => `bjj/win_raise_${i}`;
export const fistbumpKey = (i: number): string => `bjj/fistbump_${i}`;
export const faceOffKey = (i: number): string => `bjj/face_off_${i}`;

export const REF_SIGNALS = ['combate', 'pontos2', 'pontos3', 'pontos4', 'vantagem', 'parar', 'vitoria'] as const;
export type RefArt = (typeof REF_SIGNALS)[number];
export const refKey = (s: RefArt): string => `bjj/ref_${s}`;

export const PLACAR_KEY = 'props/placar';
/** Blank digit cells of `props/placar` [x, y, w, h] in sprite px: the DOM draws the numbers there. */
export const PLACAR_CELLS = {
  clock: [14, 3, 20, 7],
  youPoints: [27, 13, 8, 8],
  youAdv: [37, 13, 8, 8],
  partnerPoints: [27, 23, 8, 8],
  partnerAdv: [37, 23, 8, 8],
} as const;

/** Every key the game may ask the manifest for (what the contract test checks against `public/pixel/manifest.json`). */
export function allArtKeys(): string[] {
  const keys: string[] = [PLACAR_KEY, ...REF_SIGNALS.map(refKey)];
  for (const p of PAIR_POSITIONS) for (let i = 0; i < FRAMES.pair; i++) keys.push(pairKey(p, i));
  for (const [a, b] of directedSteps()) for (let i = 0; i < FRAMES.trans; i++) keys.push(transKey(a, b, i));
  for (let i = 0; i < FRAMES.finishTap; i++) keys.push(finishTapKey(i));
  for (let i = 0; i < FRAMES.winRaise; i++) keys.push(winRaiseKey(i));
  for (let i = 0; i < FRAMES.fistbump; i++) keys.push(fistbumpKey(i));
  for (let i = 0; i < FRAMES.faceOff; i++) keys.push(faceOffKey(i));
  return keys;
}

/** The one-rung steps of the ladder that exist as transition art, both directions. */
const STEPS: readonly (readonly [BjjPositionId, BjjPositionId])[] = [
  ['de_pe', 'guarda_fechada'],
  ['de_pe', 'meia_guarda'],
  ['guarda_fechada', 'cem_quilos'],
  ['meia_guarda', 'cem_quilos'],
  ['cem_quilos', 'joelho'],
  ['joelho', 'montada'],
  ['joelho', 'costas'],
];
export const directedSteps = (): (readonly [BjjPositionId, BjjPositionId])[] => STEPS.flatMap(([a, b]) => [[a, b] as const, [b, a] as const]);

/** The transition frames for a step, or null when there is no art for it (a step that does not exist on the ladder). */
export function transFrames(from: BjjPositionId, to: BjjPositionId): string[] | null {
  return directedSteps().some(([a, b]) => a === from && b === to) ? Array.from({ length: FRAMES.trans }, (_, i) => transKey(from, to, i)) : null;
}

/** The frame keys of a family that the manifest has, in order (a missing frame is skipped, so a half-delivered set still plays). */
export function presentFrames(has: (key: string) => boolean, keys: readonly string[]): string[] {
  return keys.filter(has);
}

export const pairFrames = (pos: BjjPositionId): string[] => Array.from({ length: FRAMES.pair }, (_, i) => pairKey(pos, i));

/** Who is on top while the ladder moves from one rung to another: the side of the rung with the bigger magnitude (standing: nobody). */
export function topSide(rungFrom: number, rungTo: number): 'you' | 'partner' | null {
  const r = Math.abs(rungTo) >= Math.abs(rungFrom) ? rungTo : rungFrom;
  return r > 0 ? 'you' : r < 0 ? 'partner' : null;
}

// ---------------------------------------------------------------- palette swaps

/** Exact colours baked into the pair frames (kept in step with assets-src/custom/bjj-rig.mjs by a test). */
export const GI_WHITE = ['#a9a18e', '#c9c1ae', '#e8e2d4', '#fbf7ee'] as const;
export const GI_BLUE = ['#284676', '#355c98', '#4a78b8', '#6f9ad8'] as const;
export const BELT_BLACK = ['#1c1c28', '#2c2c3e', '#464660'] as const;

export interface FighterColors {
  skin: string;
  hair: string;
}

export interface PairColors {
  you: FighterColors;
  partner: FighterColors;
  /** the player's belt (worn on the white gi) */
  belt: Belt;
  /** the partner's belt (worn on the blue gi); unset keeps the baked black belt */
  partnerBelt?: Belt;
  /** who is on top in this frame (null: standing or a neutral pose, A is the player) */
  top: 'you' | 'partner' | null;
}

const ramp = (name: 'skin' | 'hair' | 'skin2' | 'hair2' | 'belt', base: string): Map<number, number> => {
  const key = KEY_RAMPS[name];
  return rampMap(key, buildRamp(base, key.length as 3 | 4));
};

/**
 * The key-colour -> colour table for one pair frame. The player is drawn white (own skin, hair, belt), the partner blue with a black belt;
 * in a frame where the partner is the dominant one the two art slots (A top, B under) are exchanged.
 */
export function pairTable(c: PairColors): Map<number, number> {
  const youIsA = c.top !== 'partner';
  const partnerSkin = ramp(youIsA ? 'skin2' : 'skin', c.partner.skin);
  const partnerHair = ramp(youIsA ? 'hair2' : 'hair', c.partner.hair);
  const youSkin = ramp(youIsA ? 'skin' : 'skin2', c.you.skin);
  const youHair = ramp(youIsA ? 'hair' : 'hair2', c.you.hair);
  const tables = [youSkin, youHair, partnerSkin, partnerHair];
  const youBelt = buildRamp(BELT_COLORS[c.belt], 3);
  const theirBelt = c.partnerBelt && c.partnerBelt !== 'preta' ? buildRamp(BELT_COLORS[c.partnerBelt], 3) : [...BELT_BLACK];
  if (youIsA) {
    // art A is you: white gi stays, the belt key ramp becomes your belt; art B is the partner: blue gi stays, the black belt becomes theirs
    tables.push(rampMap(KEY_RAMPS.belt, youBelt));
    if (c.partnerBelt && c.partnerBelt !== 'preta') tables.push(rampMap(BELT_BLACK, theirBelt));
  } else {
    // art A is the partner: its white gi turns blue and its belt theirs; art B is you: the blue gi turns white and the black belt your belt
    tables.push(rampMap(GI_WHITE, GI_BLUE), rampMap(GI_BLUE, GI_WHITE), rampMap(KEY_RAMPS.belt, theirBelt), rampMap(BELT_BLACK, youBelt));
  }
  return mergeTables(...tables);
}

/** Bia's referee frames use the standard skin / hair ramps. */
export function refTable(bia: FighterColors): Map<number, number> {
  return mergeTables(ramp('skin', bia.skin), ramp('hair', bia.hair));
}

/** Stable signature of a colour set, for texture cache keys. */
export const colorsSig = (c: PairColors): string => `${c.you.skin}${c.you.hair}${c.partner.skin}${c.partner.hair}${c.belt}${c.partnerBelt ?? 'preta'}${c.top === 'partner' ? 'P' : 'Y'}`;
