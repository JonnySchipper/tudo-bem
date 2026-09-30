import { describe, expect, it } from 'vitest';
import { FURNITURE, ROOMS, buildGrid, type PlacedFurniture } from '@tudobem/shared';
import { GHOST_BAD, GHOST_OK, TILE_BAD, TILE_OK, ghostFor } from './decorate';

const kitnet = ROOMS.kitnet;
const placed = (uid: string, itemId: string, x: number, y: number, rot: 0 | 1 = 0): PlacedFurniture => ({ uid, itemId, x, y, rot });
const hand = { itemId: 'cadeira_madeira', rot: 0 as const };

// a free floor tile: not reserved (door, arrival, cama, cozinha) and not walkable-blocked
const free = (() => {
  const g = buildGrid(kitnet, []);
  for (let y = 0; y < kitnet.rows; y++) for (let x = 0; x < kitnet.cols; x++) if (!g.reserved.has(`${x},${y}`)) return { x, y };
  throw new Error('no free tile');
})();

describe('decorate ghost (green when valid, red when invalid)', () => {
  it('a free tile gives a green ghost of the piece in hand, with its rotation', () => {
    const g = ghostFor(kitnet, [], free, { ...hand, rot: 1 }, null, false);
    expect(g).toMatchObject({ itemId: 'cadeira_madeira', rot: 1, x: free.x, y: free.y, ok: true, tint: GHOST_OK, tile: TILE_OK });
  });

  it('a reserved tile (the door, its arrival tile, the bed, the kitchen) is red', () => {
    for (const t of [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 6, y: 1 }, { x: 1, y: 0 }]) {
      const g = ghostFor(kitnet, [], t, hand, null, false);
      expect(g, JSON.stringify(t)).toMatchObject({ ok: false, tint: GHOST_BAD, tile: TILE_BAD });
    }
  });

  it('a tile with a piece on it, or outside the room, is red', () => {
    const on = ghostFor(kitnet, [placed('a', 'mesinha', free.x, free.y)], free, hand, null, false);
    expect(on?.ok).toBe(false);
    expect(ghostFor(kitnet, [], { x: -1, y: 3 }, hand, null, false)?.ok).toBe(false);
    expect(ghostFor(kitnet, [], { x: kitnet.cols, y: 3 }, hand, null, false)?.ok).toBe(false);
  });

  it('agrees with canPlaceFurniture on every tile of the room (the server runs the same check)', () => {
    const grid = buildGrid(kitnet, []);
    for (let y = 0; y < kitnet.rows; y++) for (let x = 0; x < kitnet.cols; x++) {
      expect(ghostFor(kitnet, [], { x, y }, hand, null, false)?.ok, `${x},${y}`).toBe(!grid.reserved.has(`${x},${y}`));
    }
  });

  it('nothing to draw without a pointer tile, without a piece in hand, or for an unknown item', () => {
    expect(ghostFor(kitnet, [], null, hand, null, false)).toBeNull();
    expect(ghostFor(kitnet, [], free, null, null, false)).toBeNull();
    expect(ghostFor(kitnet, [], free, { itemId: 'nao_existe', rot: 0 }, null, false)).toBeNull();
    expect(FURNITURE.length).toBeGreaterThan(0);
  });

  it('moving a selected piece: its own tile is ignored, other pieces block, and it is only shown in edit mode', () => {
    const f = [placed('a', 'poltrona_verde', 3, 3, 1), placed('b', 'planta', 4, 4)];
    expect(ghostFor(kitnet, f, { x: 3, y: 3 }, null, 'a', true)).toBeNull(); // pointer on its own tile
    const other = ghostFor(kitnet, f, { x: 5, y: 5 }, null, 'a', true);
    expect(other).toMatchObject({ itemId: 'poltrona_verde', rot: 1, ok: true });
    expect(ghostFor(kitnet, f, { x: 4, y: 4 }, null, 'a', true)?.ok).toBe(false);
    expect(ghostFor(kitnet, f, { x: 5, y: 5 }, null, 'a', false)).toBeNull(); // not in edit mode
    expect(ghostFor(kitnet, f, { x: 5, y: 5 }, null, 'zzz', true)).toBeNull(); // selection gone
  });

  it('the piece in hand wins over a selection', () => {
    const f = [placed('a', 'poltrona_verde', 3, 3)];
    expect(ghostFor(kitnet, f, { x: 5, y: 5 }, hand, 'a', true)?.itemId).toBe('cadeira_madeira');
  });
});
