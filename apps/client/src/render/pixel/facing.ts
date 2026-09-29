import type { Dir } from '@tudobem/shared';

export type Facing = 'S' | 'W' | 'E' | 'N';

/**
 * Wire Dir is isometric-era naming. On the top-down grid:
 * SE = +x = East, SW = +y = South, NE = −y = North, NW = −x = West.
 */
export const FACING: Record<Dir, Facing> = { SE: 'E', SW: 'S', NE: 'N', NW: 'W' };

/** Row order inside a canonical character sheet (HOWTO §5.2). */
export const FACING_ROW: Record<Facing, number> = { S: 0, W: 1, E: 2, N: 3 };
