import { describe, expect, it } from 'vitest';
import { blockSize, displaySize, floorAt, hash2, maskAt, maskCorners, quadrantFilled, tileIndex } from './terrain';

describe('maskAt (dual grid)', () => {
  // 3x3 floor with a single calçada tile in the middle.
  const floor = ['ggg', 'gcg', 'ggg'];

  it('is 0 far from the terrain and 15 fully inside', () => {
    const big = ['cccc', 'cccc', 'cccc', 'cccc'];
    expect(maskAt(big, 'c', 2, 2)).toBe(15);
    expect(maskAt(floor, 'a', 1, 1)).toBe(0);
  });

  it('a lone tile at (1,1) shows up as four corner masks around it', () => {
    // display tile (1,1): corners TL=(0,0) TR=(1,0) BL=(0,1) BR=(1,1) -> only BR is calçada
    expect(maskAt(floor, 'c', 1, 1)).toBe(1);
    // display (2,1): TL=(1,0) TR=(2,0) BL=(1,1) BR=(2,1) -> only BL
    expect(maskAt(floor, 'c', 2, 1)).toBe(2);
    // display (1,2): TL=(0,1) TR=(1,1) -> only TR
    expect(maskAt(floor, 'c', 1, 2)).toBe(4);
    // display (2,2): TL=(1,1) -> only TL
    expect(maskAt(floor, 'c', 2, 2)).toBe(8);
  });

  it('bit order is TL*8 + TR*4 + BL*2 + BR*1', () => {
    const f = ['cg', 'gc']; // TL and BR are calçada around display (1,1)
    expect(maskAt(f, 'c', 1, 1)).toBe(8 + 1);
    expect(maskCorners(9)).toEqual({ tl: true, tr: false, bl: false, br: true });
  });

  it('an edge between two terrains gives complementary masks', () => {
    const f = ['cg', 'cg'];
    const c = maskAt(f, 'c', 1, 1);
    const g = maskAt(f, 'g', 1, 1);
    expect(c).toBe(8 + 2);
    expect(g).toBe(4 + 1);
    expect(c | g).toBe(15);
    expect(c & g).toBe(0);
  });

  it('the map border extends the terrain outward (no seam at the border)', () => {
    const f = ['cc', 'cc'];
    for (let j = 0; j <= 2; j++) for (let i = 0; i <= 2; i++) expect(maskAt(f, 'c', i, j)).toBe(15);
  });

  it('an explicit `outside` char makes the border a real edge', () => {
    const f = ['cc', 'cc'];
    expect(maskAt(f, 'c', 0, 0, 'x')).toBe(1); // only BR = (0,0) is inside
    expect(maskAt(f, 'c', 2, 2, 'x')).toBe(8);
  });

  it('display grid is one larger than the floor in both directions', () => {
    expect(displaySize(['ccc', 'ccc'])).toEqual({ cols: 4, rows: 3 });
  });
});

describe('floorAt', () => {
  it('clamps to the nearest tile outside the map', () => {
    expect(floorAt(['ab', 'cd'], -5, -5)).toBe('a');
    expect(floorAt(['ab', 'cd'], 9, 9)).toBe('d');
    expect(floorAt(['ab', 'cd'], 9, 0)).toBe('b');
  });
});

describe('tileIndex', () => {
  it('returns -1 for mask 0 and first+mask otherwise', () => {
    expect(tileIndex(32, 0, 3, 3)).toBe(-1);
    expect(tileIndex(32, 7, 3, 3)).toBe(39);
  });
  it('picks stable fill variants by hash for mask 15', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) seen.add(tileIndex(0, 15, i, j, 4));
    expect([...seen].sort((a, b) => a - b)).toEqual([15, 16, 17, 18]);
    expect(tileIndex(0, 15, 5, 9, 4)).toBe(tileIndex(0, 15, 5, 9, 4));
  });
  it('block size is 16 masks plus the extra fill variants', () => {
    expect(blockSize(1)).toBe(16);
    expect(blockSize(4)).toBe(19);
  });
});

describe('hash2 / quadrants', () => {
  it('hash2 is deterministic and spreads', () => {
    expect(hash2(3, 4)).toBe(hash2(3, 4));
    expect(hash2(3, 4)).not.toBe(hash2(4, 3));
  });
  it('quadrantFilled maps pixels to the corner bits', () => {
    expect(quadrantFilled(8, 0, 0)).toBe(true);
    expect(quadrantFilled(8, 15, 0)).toBe(false);
    expect(quadrantFilled(1, 15, 15)).toBe(true);
    expect(quadrantFilled(2, 0, 15)).toBe(true);
    expect(quadrantFilled(4, 15, 0)).toBe(true);
  });
});
