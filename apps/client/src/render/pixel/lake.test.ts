import { describe, expect, it } from 'vitest';
import { ROOMS, buildGrid, isWalkable } from '@tudobem/shared';
import { LAKE_LIFE, bankTiles, duckAt, fireflyBlink, lakeLifeFits, openWater } from './lake';
import { mataRing } from './surround';

describe('the Lagoa’s life', () => {
  const lagoa = ROOMS.lagoa;
  const life = LAKE_LIFE.lagoa!;

  it('puts every creature where it belongs: ducks and egrets on the water, capybaras on the bank', () => {
    expect(lakeLifeFits(lagoa.floor, life)).toEqual([]);
    // the capybaras' bank is ground a player can walk on too (they graze where you can meet them)
    const grid = buildGrid(lagoa);
    for (const c of life.capivaras) expect(isWalkable(grid, c.x, c.y) || lagoa.props.some((p) => p.x === c.x && p.y === c.y), `${c.x},${c.y}`).toBe(true);
  });

  it('has open water for the fish to rise in, and banks for the fireflies', () => {
    const open = openWater(lagoa.floor);
    expect(open.length).toBeGreaterThan(80);
    for (const w of open) expect(lagoa.floor[w.y][w.x]).toBe('w');
    const banks = bankTiles(lagoa.floor);
    expect(banks.length).toBeGreaterThan(40);
    for (const b of banks) expect(lagoa.floor[b.y][b.x]).not.toBe('w');
    // a room without a lake has neither
    expect(openWater(ROOMS.praia.floor)).toEqual([]);
  });

  it('the ducks paddle one lap in 90 s, in a line, turning round at the ends', () => {
    const a = duckAt(life.ducks, 0, 0);
    const b = duckAt(life.ducks, 0, 90);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
    expect(duckAt(life.ducks, 1, 10)).not.toEqual(duckAt(life.ducks, 0, 10));
    const dirs = new Set(Array.from({ length: 12 }, (_, k) => duckAt(life.ducks, 0, k * 7.5).dir));
    expect(dirs).toEqual(new Set([1, -1]));
  });

  it('a firefly blinks briefly and is dark most of its beat', () => {
    let lit = 0;
    for (let k = 0; k < 1000; k++) {
      const b = fireflyBlink(k * 0.01, 3);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      if (b > 0) lit++;
    }
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(400);
  });

  it('the mata grows only outside the map, past its west, east and south edges', () => {
    const ring = mataRing(lagoa.cols, lagoa.rows, 8);
    expect(ring.length).toBeGreaterThan(30);
    for (const p of ring) {
      const outside = p.x + (p.w ?? 1) <= 0 || p.x >= lagoa.cols || p.y >= lagoa.rows;
      expect(outside, `${p.id}`).toBe(true);
      expect(p.blocks).toBe(false);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });
});
