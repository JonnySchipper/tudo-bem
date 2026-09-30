/**
 * Keyboard walking (HOWTO Phase 2 step 7). Pure helpers: which screen direction a key means, and which adjacent tile to step to
 * for the keys that are currently held. Top-down: screen right is +x, screen down is +y (D5).
 */

export type Arrow = 'up' | 'down' | 'left' | 'right';

const KEYS: Record<string, Arrow> = {
  w: 'up',
  W: 'up',
  ArrowUp: 'up',
  s: 'down',
  S: 'down',
  ArrowDown: 'down',
  a: 'left',
  A: 'left',
  ArrowLeft: 'left',
  d: 'right',
  D: 'right',
  ArrowRight: 'right',
};

/** WASD and the arrow keys; anything else is not a walking key. */
export const arrowForKey = (key: string): Arrow | null => KEYS[key] ?? null;

const VEC: Record<Arrow, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * The step (dx, dy in tiles) for the held arrows, in press order. Opposite arrows cancel each other; the two most recent arrows
 * on different axes give a diagonal (the server's A* walks diagonals). Returns null when nothing moves.
 */
export function stepForHeld(held: readonly Arrow[]): { dx: number; dy: number } | null {
  let dx = 0;
  let dy = 0;
  // the most recent press per axis wins, so pressing left while right is still held turns around at once
  let seenX = false;
  let seenY = false;
  for (let i = held.length - 1; i >= 0; i--) {
    const [vx, vy] = VEC[held[i]];
    if (vx !== 0 && !seenX) {
      dx = vx;
      seenX = true;
    } else if (vy !== 0 && !seenY) {
      dy = vy;
      seenY = true;
    }
  }
  return dx === 0 && dy === 0 ? null : { dx, dy };
}

/**
 * The tile to walk to: the adjacent tile in the step's direction, clamped to the room. When a diagonal is blocked (a wall corner, a
 * prop), slide along whichever axis is free instead. `walkable` says whether a tile can be stood on.
 */
export function stepTarget(
  from: { x: number; y: number },
  step: { dx: number; dy: number },
  walkable: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  const tries: [number, number][] = [[step.dx, step.dy]];
  if (step.dx !== 0 && step.dy !== 0) tries.push([step.dx, 0], [0, step.dy]);
  for (const [dx, dy] of tries) {
    const x = from.x + dx;
    const y = from.y + dy;
    if (walkable(x, y)) return { x, y };
  }
  return null;
}
