import { describe, expect, it } from 'vitest';
import { buildGrid, ROOMS, isWalkable, key } from './rooms.js';
import { findPath } from './path.js';

/** BFS over wide tiles (same rule as rooms.test.ts). */
function wideTiles(g: ReturnType<typeof buildGrid>) {
  const out = new Set<string>();
  for (let y = 0; y < g.rows - 1; y++)
    for (let x = 0; x < g.cols - 1; x++)
      if (isWalkable(g, x, y) && isWalkable(g, x + 1, y) && isWalkable(g, x, y + 1) && isWalkable(g, x + 1, y + 1)) {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.add(key(x + dx, y + dy));
      }
  return out;
}

function reachableWide(g: ReturnType<typeof buildGrid>, from: { x: number; y: number }) {
  const wide = wideTiles(g);
  const seen = new Set<string>();
  const q = [from];
  seen.add(key(from.x, from.y));
  while (q.length) {
    const c = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = key(c.x + dx, c.y + dy);
      if (wide.has(n) && !seen.has(n)) {
        seen.add(n);
        q.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  }
  return seen;
}

describe('padaria Correria hotspot', () => {
  it('the vitrine (where the "Jogar: Padaria" sign points) starts the game, and its interact tile is on the customer floor', () => {
    const room = ROOMS.padaria;
    const grid = buildGrid(room);
    const vitrine = room.props.find((p) => p.id === 'vitrine');
    expect(vitrine?.action).toBe('minigame');
    // the play spot is the display case only: the order rail beside it is scenery
    expect(room.props.filter((p) => p.action === 'minigame').map((p) => p.id)).toEqual(['vitrine']);
    expect(vitrine?.interact).toEqual({ x: 6, y: 4 });
    const tile = vitrine!.interact!;
    expect(tile.x).toBe(vitrine!.x);
    expect(tile.y).toBeGreaterThanOrEqual(4);
    expect(isWalkable(grid, tile.x, tile.y), 'interact tile walkable').toBe(true);
    expect(findPath(grid, room.spawn, tile), 'spawn -> vitrine').not.toBeNull();
    expect(findPath(grid, { x: 0, y: 6 }, tile), 'door -> vitrine').not.toBeNull();
    const withBaker = buildGrid(room);
    withBaker.blocked.add(key(3, 1));
    expect(findPath(withBaker, room.spawn, tile), 'spawn -> vitrine with baker on counter').not.toBeNull();
    const lane = reachableWide(grid, room.spawn);
    expect(lane.has(key(tile.x, tile.y)), 'vitrine touches wide lane from spawn').toBe(true);
  });
});

describe('padaria door cofre on the street', () => {
  it('rua interact tile is walkable from spawn', () => {
    const room = ROOMS.rua;
    const grid = buildGrid(room);
    const cofre = room.props.find((p) => p.id === 'padaria_porta_fundar');
    expect(cofre?.interact).toEqual({ x: 4, y: 6 });
    expect(findPath(grid, room.spawn, cofre!.interact!), 'spawn -> cofre').not.toBeNull();
  });
});
