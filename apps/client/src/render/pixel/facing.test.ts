import { describe, expect, it } from 'vitest';
import { CANON_FACING_ROW } from './charsheet';
import { FACING, FACING_ROW } from './facing';

describe('facing', () => {
  it('maps wire Dir onto the top-down compass', () => {
    expect(FACING.SE).toBe('E');
    expect(FACING.SW).toBe('S');
    expect(FACING.NE).toBe('N');
    expect(FACING.NW).toBe('W');
  });

  it('lays facings out as sheet rows S W E N', () => {
    expect(FACING_ROW).toEqual({ S: 0, W: 1, E: 2, N: 3 });
  });

  it('matches the style-frame sheet rows already baked into charsheet', () => {
    expect(CANON_FACING_ROW).toEqual(FACING_ROW);
  });
});
