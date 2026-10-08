/**
 * Re-path glide (issue #154). A new `move` while walking (a retap, a press-and-hold steer) makes the server start the new path from the tile
 * nearest the avatar, so the path's first point can be up to half a tile (diagonally ~0.7) from where the sprite is drawn. Instead of popping
 * there, the view keeps that gap as an offset and eases it to nothing over SLIDE_MS. Pure, no Phaser.
 */
import { T } from './coords';

export const SLIDE_MS = 140;
/** Gaps bigger than this are not a re-path of the same walk (a teleport, a portal arrival): those snap. */
export const SLIDE_MAX_PX = 1.5 * T;

export interface Slide {
  dx: number;
  dy: number;
  t0: number;
}

/** The slide for a new path whose start (feet, world px) is `to`, for a sprite drawn at (wx, wy). Null when there is nothing to glide. */
export function repathSlide(drawn: { wx: number; wy: number }, to: { wx: number; wy: number }, now: number): Slide | null {
  const dx = drawn.wx - to.wx;
  const dy = drawn.wy - to.wy;
  const d = Math.hypot(dx, dy);
  if (d < 0.5 || d > SLIDE_MAX_PX) return null;
  return { dx, dy, t0: now };
}

/** The offset still to add `now` (ease-out), or null once the glide is over. */
export function slideOffset(s: Slide | null, now: number): { dx: number; dy: number } | null {
  if (!s) return null;
  const k = (now - s.t0) / SLIDE_MS;
  if (k >= 1) return null;
  const left = Math.pow(1 - Math.max(0, k), 2);
  return { dx: s.dx * left, dy: s.dy * left };
}
