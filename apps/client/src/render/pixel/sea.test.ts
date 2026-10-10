import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { CRABS_MAX, FOAM_MAX, crabHomes, shoreTiles, sunPathAlpha, sunPathColumn } from './sea';

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
    // the lagoa is its own area now (fresh water, no foam): every wave breaks on the sea's shore row
    expect(shoreTiles(floor, Infinity).every((t) => t.y >= 19)).toBe(true);
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
    expect(sunPathColumn(ROOMS.praca.floor)).toBeNull();
  });

  it('the sun path on the water shows only at golden hour: in from 16:30, full at 17:30, gone by 18:30', () => {
    expect(sunPathAlpha(12 * 60)).toBe(0);
    expect(sunPathAlpha(16 * 60 + 30)).toBe(0);
    expect(sunPathAlpha(17 * 60)).toBeGreaterThan(0.3);
    expect(sunPathAlpha(17 * 60 + 30)).toBe(1);
    expect(sunPathAlpha(18 * 60)).toBeGreaterThan(0.3);
    expect(sunPathAlpha(18 * 60 + 30)).toBe(0);
    expect(sunPathAlpha(20 * 60)).toBe(0);
  });

  it('lies over the open sea west of the pier, from the shore down to the bottom edge', () => {
    const col = sunPathColumn(floor)!;
    expect(col).not.toBeNull();
    expect(col.x).toBeLessThan(28); // west of the pier
    expect(col.y1).toBe(floor.length - 1);
    for (let y = col.y0; y <= col.y1; y++) expect(floor[y][col.x]).toBe('o');
    expect(floor[col.y0 - 1][col.x]).toBe('s');
    // the party deck's ring of sea is too thin for a path
    expect(sunPathColumn(ROOMS.barco_festa.floor)).toBeNull();
  });
});
