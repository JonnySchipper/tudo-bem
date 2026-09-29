export type MoveMode = 'iso' | 'topdown';

export interface Step {
  dx: number;
  dy: number;
}

/**
 * One-tile step for a keyboard code or key.
 * Top-down: screen right is +x (Dir SE / facing E), screen down is +y (Dir SW / facing S).
 * Iso: the same keys follow the diamond (right = +x/−y, down = +x/+y).
 */
const TOPDOWN: Record<string, Step> = {
  ArrowRight: { dx: 1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  KeyA: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  ArrowDown: { dx: 0, dy: 1 },
  KeyS: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  ArrowUp: { dx: 0, dy: -1 },
  KeyW: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
};

const ISO: Record<string, Step> = {
  ArrowRight: { dx: 1, dy: -1 },
  KeyD: { dx: 1, dy: -1 },
  d: { dx: 1, dy: -1 },
  D: { dx: 1, dy: -1 },
  ArrowLeft: { dx: -1, dy: 1 },
  KeyA: { dx: -1, dy: 1 },
  a: { dx: -1, dy: 1 },
  A: { dx: -1, dy: 1 },
  ArrowDown: { dx: 1, dy: 1 },
  KeyS: { dx: 1, dy: 1 },
  s: { dx: 1, dy: 1 },
  S: { dx: 1, dy: 1 },
  ArrowUp: { dx: -1, dy: -1 },
  KeyW: { dx: -1, dy: -1 },
  w: { dx: -1, dy: -1 },
  W: { dx: -1, dy: -1 },
};

export function keyStep(key: string, mode: MoveMode): Step | null {
  const table = mode === 'topdown' ? TOPDOWN : ISO;
  return table[key] ?? null;
}
