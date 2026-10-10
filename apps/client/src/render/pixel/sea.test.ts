import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { CRABS_MAX, FOAM_MAX, crabHomes, shoreTiles } from './sea';

describe('the Praia sea (foam and crabs)', () => {
  const floor = ROOMS.praia.floor;

  it('foam rolls on water tiles right under the sand, within the budget', () => {
    const tiles = shoreTiles(floor);
    expect(tiles.length).toBeGreaterThan(20);
    expect(tiles.length).toBeLessThanOrEqual(FOAM_MAX);
    for (const t of tiles) {
      expect(floor[t.y][t.x]).toBe('o');
      expect(floor[t.y - 1][t.x]).toBe('s');
    }
    // the lagoa's north bank has its own little shore too
    expect(shoreTiles(floor, Infinity).some((t) => t.y < 12)).toBe(true);
  });

  it('crabs live on the long shore row, on sand, at most three', () => {
    const homes = crabHomes(floor);
    expect(homes).toHaveLength(CRABS_MAX);
    for (const h of homes) {
      expect(floor[h.y][h.x]).toBe('s');
      expect(floor[h.y + 1][h.x]).toBe('o');
    }
    expect(new Set(homes.map((h) => h.x)).size).toBe(CRABS_MAX);
  });

  it('rooms without sea have no foam', () => {
    expect(shoreTiles(ROOMS.praca.floor)).toEqual([]);
    expect(crabHomes(ROOMS.praca.floor)).toEqual([]);
  });
});
