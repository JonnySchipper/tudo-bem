import { describe, expect, it } from 'vitest';
import type { Dir } from '@tudobem/shared';
import { FACING, FACING_ROW, type Facing } from './facing.js';

describe('pixel facing (D5)', () => {
  it('maps the isometric-era wire Dir onto top-down facings', () => {
    expect(FACING.SE).toBe('E'); // +x
    expect(FACING.SW).toBe('S'); // +y
    expect(FACING.NE).toBe('N'); // -y
    expect(FACING.NW).toBe('W'); // -x
  });

  it('covers every Dir with a distinct facing', () => {
    const dirs: Dir[] = ['SE', 'SW', 'NE', 'NW'];
    expect(Object.keys(FACING).sort()).toEqual([...dirs].sort());
    expect(new Set(dirs.map((d) => FACING[d])).size).toBe(4);
  });

  it('uses the canonical sheet row order S, W, E, N', () => {
    expect(FACING_ROW).toEqual({ S: 0, W: 1, E: 2, N: 3 });
    const facings: Facing[] = ['S', 'W', 'E', 'N'];
    expect(facings.map((f) => FACING_ROW[f])).toEqual([0, 1, 2, 3]);
  });
});
