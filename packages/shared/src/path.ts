import type { Dir, Tile } from './types.js';
import { NPC_STEP_MS, STEP_MS } from './constants.js';
import { inBounds, isWalkable, key, type RoomGrid } from './rooms.js';

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** A* over the room grid, 8-directional without corner cutting. Returns tiles after `from`, ending at `to`. */
export function findPath(grid: RoomGrid, from: Tile, to: Tile, maxNodes = 4000): Tile[] | null {
  if (!inBounds(grid, to.x, to.y) || !isWalkable(grid, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open: { x: number; y: number; f: number }[] = [{ x: from.x, y: from.y, f: h(from.x, from.y) }];
  const g = new Map<string, number>([[key(from.x, from.y), 0]]);
  const came = new Map<string, string>();
  const closed = new Set<string>();
  let expanded = 0;
  while (open.length && expanded++ < maxNodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === to.x && cur.y === to.y) {
      const out: Tile[] = [];
      let k: string | undefined = ck;
      while (k && k !== key(from.x, from.y)) {
        const [x, y] = k.split(',').map(Number);
        out.unshift({ x, y });
        k = came.get(k);
      }
      return out;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isWalkable(grid, cur.x + dx, cur.y) || !isWalkable(grid, cur.x, cur.y + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const cost = (g.get(ck) ?? 0) + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, f: cost + h(nx, ny) });
      }
    }
  }
  return null;
}

export function dirBetween(a: Tile, b: Tile, fallback: Dir = 'SE'): Dir {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return fallback;
  // Screen: sx ~ dx - dy, sy ~ dx + dy
  const sx = dx - dy;
  const sy = dx + dy;
  const front = sy > 0 || (sy === 0 && fallback.startsWith('S'));
  const right = sx > 0 || (sx === 0 && (fallback === 'SE' || fallback === 'NE'));
  if (front) return right ? 'SE' : 'SW';
  return right ? 'NE' : 'NW';
}

export type StepMsFn = (a: Tile, b: Tile) => number;

export function stepMs(a: Tile, b: Tile): number {
  return a.x !== b.x && a.y !== b.y ? STEP_MS * Math.SQRT2 : STEP_MS;
}

export function npcStepMs(a: Tile, b: Tile): number {
  return a.x !== b.x && a.y !== b.y ? NPC_STEP_MS * Math.SQRT2 : NPC_STEP_MS;
}

export function pathDuration(from: Tile, path: Tile[], step: StepMsFn = stepMs): number {
  let t = 0;
  let prev = from;
  for (const p of path) {
    t += step(prev, p);
    prev = p;
  }
  return t;
}

export interface PathPos {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  /** Last whole tile reached. */
  tile: Tile;
  /** The tile this step heads to (only while moving): `next - tile` is the step vector, constant for the whole step. */
  next?: Tile;
}

/** Interpolated position along a path `elapsed` ms after it began. */
export function positionAlong(from: Tile, path: Tile[], elapsed: number, startDir: Dir, step: StepMsFn = stepMs): PathPos {
  let prev = from;
  let t = elapsed;
  let dir = startDir;
  for (const p of path) {
    const d = step(prev, p);
    dir = dirBetween(prev, p, dir);
    if (t < d) {
      const f = Math.max(0, t / d);
      return { x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f, dir, moving: true, tile: prev, next: p };
    }
    t -= d;
    prev = p;
  }
  return { x: prev.x, y: prev.y, dir, moving: false, tile: prev };
}
