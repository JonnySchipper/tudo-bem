/**
 * Tutorial guide arrows (HOWTO §5.9): where the bouncing arrow goes for a target point. Pure: no DOM, no Phaser.
 *
 * `x, y` is the point the arrow TIP should touch, in CSS px relative to the canvas (a little above the target tile). When that point is
 * inside the free part of the screen the arrow simply hangs there pointing down. When it is off-screen (or under the HUD) the arrow is
 * pinned to the nearest screen edge of the free region and turns toward the target: down, up, left or right.
 */

export type GuideDir = 'down' | 'up' | 'left' | 'right';

export interface GuideInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PinnedGuide {
  /** where the arrow tip goes (CSS px) */
  x: number;
  y: number;
  /** true when the target is outside the free region and the arrow was pinned to an edge */
  off: boolean;
  dir: GuideDir;
}

/**
 * `view` is the canvas size in CSS px, `insets` the HUD space to keep clear, `pad` the space the arrow itself needs on each side
 * (its half-width when it sits at a left or right edge, its height at the top or bottom edge, so it never pokes out of the screen).
 */
export function pinGuide(target: { x: number; y: number }, view: { w: number; h: number }, insets: GuideInsets, pad: number): PinnedGuide {
  const x0 = insets.left + pad;
  const x1 = Math.max(x0, view.w - insets.right - pad);
  const y0 = insets.top + pad;
  const y1 = Math.max(y0, view.h - insets.bottom - pad);
  const x = Math.min(x1, Math.max(x0, target.x));
  const y = Math.min(y1, Math.max(y0, target.y));
  if (x === target.x && y === target.y) return { x, y, off: false, dir: 'down' };
  const dx = target.x - x;
  const dy = target.y - y;
  const dir: GuideDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  return { x, y, off: true, dir };
}

/** Rotation (degrees, always a multiple of 90 so pixel art stays crisp) that turns the down-pointing arrow toward `dir`. */
export const GUIDE_ROTATION: Record<GuideDir, number> = { down: 0, left: 90, up: 180, right: 270 };
