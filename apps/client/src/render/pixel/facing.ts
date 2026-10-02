import type { Dir } from '@tudobem/shared';

export type Facing = 'S' | 'W' | 'E' | 'N';

/**
 * Wire `Dir` is isometric-era naming. On the top-down grid:
 * SE = +x = East, SW = +y = South, NE = -y = North, NW = -x = West.
 */
export const FACING: Record<Dir, Facing> = { SE: 'E', SW: 'S', NE: 'N', NW: 'W' };

/** Row offset of each facing inside an animation block of the canonical character sheet. */
export const FACING_ROW: Record<Facing, number> = { S: 0, W: 1, E: 2, N: 3 };

/**
 * The facing for one walking step (dx, dy in tiles; each of -1, 0, 1 for grid paths). Decided from the step vector, never from
 * per-frame position deltas: comparing float deltas of an exact diagonal flipped the sprite between E/W and S/N every frame.
 * A diagonal step faces horizontally (E/W), like most top-down games; only a step with |dy| > |dx| faces N/S. A zero step keeps
 * `current`. For free-form vectors, `current` also gives hysteresis: a horizontal facing holds until |dy| beats |dx| by `bias`.
 */
export function facingForStep(dx: number, dy: number, current: Facing = 'S', bias = 0.25): Facing {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 1e-6 && ay < 1e-6) return current;
  const horizontal = current === 'E' || current === 'W' ? ay <= ax * (1 + bias) : ax >= ay;
  if (horizontal) return dx > 0 ? 'E' : dx < 0 ? 'W' : current === 'W' ? 'W' : 'E';
  return dy > 0 ? 'S' : 'N';
}

/**
 * The facing while walking from `tile` toward `steps[0]`, with the rest of the path after it. Decided once per path step (the inputs are
 * tiles, not frame positions), so it can never flicker, and smoothed over the next `lookahead` steps so a one-tile cardinal jog in a
 * mostly diagonal run (A* staircases around props) does not turn the sprite and back. Diagonals face E/W.
 */
export function facingAlongPath(tile: { x: number; y: number }, steps: readonly { x: number; y: number }[], current: Facing, lookahead = 2): Facing {
  if (!steps.length) return current;
  let dx = 0;
  let dy = 0;
  let prev = tile;
  for (const p of steps.slice(0, 1 + lookahead)) {
    dx += p.x - prev.x;
    dy += p.y - prev.y;
    prev = p;
  }
  // a window of 3 steps of (diagonal, cardinal jog, diagonal) is (2, 3): keep the horizontal facing until vertical clearly dominates
  return facingForStep(dx, dy, current, 0.5);
}
