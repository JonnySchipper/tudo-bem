/**
 * The held-snack beats, as pure functions of time (the scene only places sprites): eating and drinking raise the item to the mouth for three
 * bites or sips, and Jogar fora throws it in an arc, into a lixeira when one is in reach (the same 2-tile reach the server uses for
 * "Lixo no lixo!") or onto the ground a step ahead.
 */
import { carryOf } from '@tudobem/shared';

export type CarryMove = 'eat' | 'drink' | 'toss' | 'swap';

/**
 * What a change of the held item looks like. `intent` is what this client last asked for (only known for your own avatar): finger food
 * leaves nothing either way, so eating a coxinha and throwing it away are the same change on the wire. Other players' finger food is eaten.
 */
export function carryMove(prev: string | null | undefined, next: string | null | undefined, intent: 'consume' | 'toss' | null = null): CarryMove {
  const was = carryOf(prev);
  if (!was) return 'swap';
  const now = carryOf(next);
  if (was.kind !== 'trash' && was.leaves && now?.id === was.leaves) return was.kind === 'food' ? 'eat' : 'drink';
  if (now) return 'swap';
  if (was.kind === 'food' && !was.leaves) return intent === 'toss' ? 'toss' : 'eat';
  return 'toss';
}

export const CARRY_BEAT_MS = 900;
/** Hand to mouth, then the bites, then the empty comes back down. */
const RAISE = 200;
const BITES_END = 700;
const BITES = 3;

/** When each bite or sip lands, in ms from the start of the beat (the sounds are scheduled on these). */
export const BITE_MS: readonly number[] = Array.from({ length: BITES }, (_, i) => RAISE + (i * (BITES_END - RAISE)) / BITES);

export interface BeatPose {
  /** 0 = in the hand, 1 = at the mouth. */
  lift: number;
  /** Scale of the full item (a bite takes a piece; a sip barely changes it). */
  scale: number;
  /** Tilt in degrees toward the face (drinks tip up). */
  angle: number;
  /** Avatar nod in art px (down on each bite / sip). */
  nod: number;
  /** Index of the bite that starts in this frame window (crumbs), else -1. */
  bite: number;
  /** The full item is gone (the empty, if any, is on its way back to the hand). */
  finished: boolean;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Pose at `ms` into the beat. `prevMs` (the last frame) finds the bite that starts between the two frames. */
export function beatPose(kind: 'eat' | 'drink', ms: number, prevMs = ms): BeatPose {
  if (ms >= BITES_END) {
    const back = clamp01((ms - BITES_END) / (CARRY_BEAT_MS - BITES_END));
    return { lift: 1 - easeOut(back), scale: 1, angle: 0, nod: 0, bite: -1, finished: true };
  }
  if (ms < RAISE) {
    const k = easeOut(clamp01(ms / RAISE));
    return { lift: k, scale: 1, angle: kind === 'drink' ? -30 * k : 0, nod: 0, bite: -1, finished: false };
  }
  const span = (BITES_END - RAISE) / BITES;
  const i = Math.min(BITES - 1, Math.floor((ms - RAISE) / span));
  const local = (ms - RAISE - i * span) / span;
  const prevI = prevMs < RAISE ? -1 : Math.min(BITES - 1, Math.floor((prevMs - RAISE) / span));
  const chew = Math.sin(local * Math.PI);
  if (kind === 'eat') {
    // each bite takes a piece: 1 -> 0.82 -> 0.64, with a squash on the bite itself
    const left = 1 - 0.18 * (i + (local > 0.5 ? 1 : 0));
    return { lift: 1, scale: left * (1 - 0.12 * chew), angle: 0, nod: chew > 0.5 ? 1 : 0, bite: i !== prevI ? i : -1, finished: false };
  }
  return { lift: 1, scale: 1, angle: -30 - 12 * chew, nod: chew > 0.6 ? 1 : 0, bite: i !== prevI ? i : -1, finished: false };
}

export interface BinSpot {
  x: number;
  y: number;
}

/** The lixeira the toss goes into: the nearest within `reach` tiles (Chebyshev, like the server), or -1. */
export function binInReach(tile: { x: number; y: number }, bins: readonly BinSpot[], reach = 2): number {
  let best = -1;
  let bestD = Infinity;
  bins.forEach((b, i) => {
    const cheb = Math.max(Math.abs(tile.x - b.x), Math.abs(tile.y - b.y));
    if (cheb > reach) return;
    const d = Math.hypot(tile.x - b.x, tile.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** A throw from `a` to `b` peaking `h` px above the straight line, at `t` in [0, 1]. */
export function arcPoint(a: { x: number; y: number }, b: { x: number; y: number }, h: number, t: number): { x: number; y: number } {
  const k = clamp01(t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - h * Math.sin(k * Math.PI) };
}

/** Where a toss with no lixeira in reach lands: a step ahead of the feet, the way the avatar faces. */
export function groundSpot(feet: { x: number; y: number }, facing: 'S' | 'N' | 'E' | 'W', step: number): { x: number; y: number } {
  if (facing === 'E') return { x: feet.x + step, y: feet.y - 2 };
  if (facing === 'W') return { x: feet.x - step, y: feet.y - 2 };
  if (facing === 'N') return { x: feet.x + step * 0.4, y: feet.y - step * 0.7 };
  return { x: feet.x + step * 0.5, y: feet.y + step * 0.6 };
}
