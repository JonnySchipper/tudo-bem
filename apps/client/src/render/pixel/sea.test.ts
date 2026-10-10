import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { CRABS_MAX, FOAM_MAX, crabHomes, lagoas, paintSeaShade, seaShore, shoreTiles, sunPathAlpha, sunPathColumn, swashReach } from './sea';

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

describe('the Praia sea shading (the visual pass)', () => {
  const floor = ROOMS.praia.floor;

  it('finds the shoreline on every column, the pier taking its neighbours’ row', () => {
    const shore = seaShore(floor);
    expect(shore).toHaveLength(floor[0].length);
    for (let x = 0; x < shore.length; x++) {
      expect(shore[x]).toBeGreaterThan(0);
      expect(floor[shore[x]][x] === 'o' || floor[shore[x]][x] === 'b').toBe(true);
    }
    // the pier's planks run down into the sea, yet its columns share the beach's shoreline
    expect(shore[28]).toBe(shore[20]);
    expect(seaShore(ROOMS.praca.floor).every((y) => y === -1)).toBe(true);
  });

  it('tells a pocket of water in the sand from the sea (the Praia has none now: the Lagoa is its own area)', () => {
    const pond = ['ssssss', 'soosss', 'soosss', 'ssssss', 'oooooo'];
    expect(lagoas(pond)).toEqual([{ x0: 1, y0: 1, x1: 2, y1: 2 }]);
    expect(lagoas(floor)).toEqual([]);
    expect(lagoas(ROOMS.barco_festa.floor)).toEqual([]);
  });

  it('paints the shading once: clear shallows by the sand, darker toward the horizon, wet sand above the water', () => {
    const shade = paintSeaShade(floor, 2)!;
    expect(shade).not.toBeNull();
    expect(shade.data.length).toBe(shade.w * shade.h * 4);
    const at = (wx: number, wy: number) => {
      const i = ((wy - shade.y) * shade.w + (wx - shade.x)) * 4;
      return [...shade.data.slice(i, i + 4)];
    };
    const shoreY = seaShore(floor)[10] * 16;
    const shallow = at(10 * 16 + 4, shoreY + 6);
    const deep = at(10 * 16 + 4, (floor.length - 1) * 16);
    expect(shallow[3]).toBeGreaterThan(0);
    expect(shallow[1]).toBeGreaterThan(deep[1]); // the shallows are paler
    expect(deep[3]).toBeGreaterThan(0);
    expect(at(10 * 16 + 4, shoreY - 2)[3]).toBeGreaterThan(0); // wet sand
    expect(at(10 * 16 + 4, shoreY - 14)[3]).toBe(0); // dry sand past the wet band is left alone
    expect(paintSeaShade(ROOMS.praca.floor)).toBeNull();
  });

  it('runs the swash up and back: never below the waterline, never past a hand’s width, never all in step', () => {
    let max = 0;
    const reach = new Set<number>();
    for (let t = 0; t < 13; t += 0.25) {
      for (let x = 0; x < 640; x += 16) {
        const r = swashReach(x, t);
        expect(r).toBeGreaterThanOrEqual(0);
        max = Math.max(max, r);
      }
      reach.add(Math.round(swashReach(0, t)));
    }
    expect(max).toBeLessThanOrEqual(10);
    expect(reach.has(0)).toBe(true);
    expect(Math.max(...reach)).toBeGreaterThan(3);
    expect(new Set([0, 160, 320, 480].map((x) => Math.round(swashReach(x, 2))))).not.toEqual(new Set([Math.round(swashReach(0, 2))]));
  });
});
