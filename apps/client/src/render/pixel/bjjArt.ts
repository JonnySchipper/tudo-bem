/**
 * The art contract of "Treino no tatame" (the pixel art lives in assets-src/custom/bjj*.mjs, apps/client/assets-src/README.md): the
 * manifest keys, frame counts, anchors and the palette-swap tables, so the game and the artists agree. Pure (no Phaser, no DOM).
 *
 *  - `bjj/pair_<pos>_<0..3>`, 4 idle "struggle" frames per position, 56x42, anchor bottom-centre (28, 42) on the mat centre.
 *  - `bjj/trans_<from>__<to>_<0..3>`: 4 frames, play once, every directed step between adjacent positions (both directions).
 *  - `bjj/finish_tap_<0..3>` (loop), `bjj/win_raise_<0..2>`, `bjj/fistbump_<0..3>`, `bjj/face_off_<0..1>`.
 *  - `bjj/ref_<signal>`: Professora Bia, 16x32, anchor (8, 32), on the standard `skin` / `hair` ramps.
 *  - `props/placar`: the mat scoreboard, 30x34, anchor (15, 33), blank digit cells (`PLACAR_CELLS`) filled by the DOM.
 *
 *  - the match atlas (`bjj`, lazy): `bjj/stand_<you><partner>_<0..3>` (the standing loop with the grips held) and the move clips
 *    `bjj/mv_<move>__<from>_<h|m>_<0..7>` (bjjClips.ts), trimmed frames with their own anchors.
 *
 * Roles. In the idle art slot A (white gi keys) is the one on top and slot B (blue gi keys) is under; in a move clip slot A is the one
 * who moves. THE GAME'S CONVENTION: the player always wears the white gi with their own belt, the partner their own gi colour
 * (PARTNER_GI); each wears their own skin, hair, hair style and beard (bjjSwap.ts). The swap paints whichever person is in each slot.
 */
import { buildRamp, mergeTables, rampMap, KEY_RAMPS } from './palette';
import type { BjjPositionId, Belt } from '@tudobem/shared';
import { BELT_COLORS } from '@tudobem/shared';
import { CLIPS, CLIP_FRAMES, STAND_FRAMES, STAND_GRIPS, clipKey, standKey } from './bjjClips';
import { BELT_BLACK as BELT_BLACK_RAMP, GI_BLUE as GI_BLUE_RAMP, GI_WHITE as GI_WHITE_RAMP, mergeSwaps, slotSwap, type PairSwap, type SlotLook } from './bjjSwap';

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

export const REF_SIGNALS = ['combate', 'pontos2', 'pontos3', 'pontos4', 'vantagem', 'parar', 'vitoria', 'espera'] as const;
export type RefArt = (typeof REF_SIGNALS)[number];
export const refKey = (s: RefArt): string => `bjj/ref_${s}`;

export const PLACAR_KEY = 'props/placar';
/** Blank digit cells of `props/placar` [x, y, w, h] in sprite px: the DOM draws the numbers there. */
export const PLACAR_CELLS = {
  clock: [5, 3, 20, 7],
  youPoints: [11, 13, 7, 7],
  youAdv: [21, 13, 7, 7],
  partnerPoints: [11, 22, 7, 7],
  partnerAdv: [21, 22, 7, 7],
} as const;
/** props/placar: 30 x 34, anchor (15, 33). */
export const PLACAR_SIZE = { w: 30, h: 34, ax: 15, ay: 33 } as const;

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

/** The keys of the match atlas (`bjj`, loaded when a match starts): the standing grip loops and every move clip. */
export function matchArtKeys(): string[] {
  const keys: string[] = [];
  for (const a of STAND_GRIPS) for (const b of STAND_GRIPS) for (let i = 0; i < STAND_FRAMES; i++) keys.push(standKey(a, b, i));
  for (const c of CLIPS) for (const hit of [true, false]) for (let i = 0; i < CLIP_FRAMES; i++) keys.push(clipKey(c.move, c.from, hit, i));
  return keys;
}
export const MATCH_ATLAS = 'bjj';

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

export { GI_WHITE, GI_BLUE, BELT_BLACK } from './bjjSwap';

export interface FighterColors {
  skin: string;
  hair: string;
  /** the avatar's hair style: curly and long hair get their volume, a bun its knot, a shaved head a stubble tone */
  style?: string;
  beard?: boolean;
}

export interface PairColors {
  you: FighterColors;
  partner: FighterColors;
  /** the player's belt (worn on the white gi) */
  belt: Belt;
  /** the partner's belt; unset keeps the baked black belt */
  partnerBelt?: Belt;
  /** the partner's gi ramp (deep -> light, 4); unset keeps the baked blue gi */
  partnerGi?: readonly string[];
  /** who is in art slot A in this frame (null: standing or a neutral pose, A is the player) */
  top: 'you' | 'partner' | null;
}

/**
 * Every sparring partner wears their own gi, so they never read as the same person in another colour: Mateus blue, Felipe grey,
 * Helena navy, Daniel black, Rafael wine. The player always wears white. Deep -> light.
 */
export const PARTNER_GI: Record<string, readonly string[]> = {
  mateus: GI_BLUE_RAMP,
  felipe: ['#5c6170', '#7a8090', '#9aa0ae', '#bcc2cc'],
  helena: ['#1c2440', '#28345c', '#36477a', '#4c6198'],
  daniel: ['#17171f', '#24242f', '#343442', '#4a4a5c'],
  rafael: ['#4a1620', '#66202c', '#86303c', '#a44a54'],
};
export const partnerGi = (id: string | null | undefined): readonly string[] => (id && PARTNER_GI[id]) || GI_BLUE_RAMP;

const look = (f: FighterColors, gi: readonly string[], belt: readonly string[]): SlotLook => ({ skin: f.skin, hair: f.hair, style: f.style, beard: f.beard, gi, belt });

/**
 * The swap for one pair frame: art slot A is the player unless `top` is the partner, slot B the other. The player wears white with their
 * own belt, the partner their gi colour and belt; each wears their own skin, hair, hair style and beard. Hair pieces a fighter does
 * not wear are cleared (transparent).
 */
export function pairSwap(c: PairColors): PairSwap {
  const youIsA = c.top !== 'partner';
  const youBelt = buildRamp(BELT_COLORS[c.belt], 3);
  const theirBelt = c.partnerBelt && c.partnerBelt !== 'preta' ? buildRamp(BELT_COLORS[c.partnerBelt], 3) : [...BELT_BLACK_RAMP];
  const you = look(c.you, GI_WHITE_RAMP, youBelt);
  const them = look(c.partner, c.partnerGi ?? GI_BLUE_RAMP, theirBelt);
  return mergeSwaps(slotSwap('A', youIsA ? you : them), slotSwap('B', youIsA ? them : you));
}

/** The colour table of {@link pairSwap} (the cleared hair pieces aside). */
export const pairTable = (c: PairColors): Map<number, number> => pairSwap(c).table;

const ramp = (name: 'skin' | 'hair', base: string): Map<number, number> => {
  const key = KEY_RAMPS[name];
  return rampMap(key, buildRamp(base, key.length as 3 | 4));
};

/** Bia's referee frames use the standard skin / hair ramps. */
export function refTable(bia: FighterColors): Map<number, number> {
  return mergeTables(ramp('skin', bia.skin), ramp('hair', bia.hair));
}

const fighterSig = (f: FighterColors): string => `${f.skin}${f.hair}${f.style ?? ''}${f.beard ? 'b' : ''}`;
/** Stable signature of a colour set, for texture cache keys. */
export const colorsSig = (c: PairColors): string =>
  `${fighterSig(c.you)}|${fighterSig(c.partner)}|${c.belt}${c.partnerBelt ?? 'preta'}|${(c.partnerGi ?? GI_BLUE_RAMP)[2]}|${c.top === 'partner' ? 'P' : 'Y'}`;
