/**
 * Terrain: ASCII floor rows to dual-grid autotile indices (HOWTO §5.6).
 *
 * Pure functions, no imports (the import script loads this file directly with Node's type stripping).
 *
 * Dual grid: each terrain is drawn as its own tile layer, offset by half a tile. The display tile at (i, j)
 * looks at the four world tiles around its center: TL = (i-1, j-1), TR = (i, j-1), BL = (i-1, j), BR = (i, j).
 * mask = TL*8 + TR*4 + BL*2 + BR*1. Mask 0 draws nothing, mask 15 is the full tile.
 * The display grid is (cols + 1) x (rows + 1) tiles for a floor of cols x rows world tiles.
 */

export const TILE = 16;

/** Draw order, low to high (HOWTO §5.6). Characters not listed here are drawn as their own layer on top. */
export const TERRAIN_PRIORITY = ['a', 'p', 'c', 't', 'd', 'g', 'l', 'm', 'k', 'j', 'z'] as const;

export const MASK_TL = 8;
export const MASK_TR = 4;
export const MASK_BL = 2;
export const MASK_BR = 1;

export type Floor = readonly string[];

/**
 * The terrain char at world tile (x, y). Outside the map the nearest tile is used (the terrain
 * continues off-screen), so the map border never shows a seam. Pass `outside` to force a char instead.
 */
export function floorAt(floor: Floor, x: number, y: number, outside?: string): string {
  const rows = floor.length;
  if (rows === 0) return outside ?? ' ';
  const inside = y >= 0 && y < rows && x >= 0 && x < floor[y].length;
  if (!inside && outside !== undefined) return outside;
  const cy = Math.min(rows - 1, Math.max(0, y));
  const row = floor[cy];
  return row[Math.min(row.length - 1, Math.max(0, x))] ?? ' ';
}

/** The 4-bit corner mask of display tile (i, j) for terrain `ch`. */
export function maskAt(floor: Floor, ch: string, i: number, j: number, outside?: string): number {
  const is = (x: number, y: number) => (floorAt(floor, x, y, outside) === ch ? 1 : 0);
  return is(i - 1, j - 1) * MASK_TL + is(i, j - 1) * MASK_TR + is(i - 1, j) * MASK_BL + is(i, j) * MASK_BR;
}

/** Display-grid size for a floor. */
export function displaySize(floor: Floor): { cols: number; rows: number } {
  return { cols: (floor[0]?.length ?? 0) + 1, rows: floor.length + 1 };
}

/** Deterministic 32-bit hash of two integers, 0 .. 2^32-1. */
export function hash2(i: number, j: number, seed = 0): number {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Tile index inside a terrain's tileset block: `first + mask`. For mask 15 with `variants > 1`, a hash of the
 * display cell picks one of the variants stored at `first + 16 + (v - 1)` (variant 0 is the mask-15 tile itself).
 * Returns -1 for mask 0 (draw nothing).
 */
export function tileIndex(first: number, mask: number, i: number, j: number, variants = 1): number {
  if (mask === 0) return -1;
  if (mask === 15 && variants > 1) {
    const v = hash2(i, j) % variants;
    return v === 0 ? first + 15 : first + 16 + (v - 1);
  }
  return first + mask;
}

/** Number of tiles a terrain block occupies in the tileset (16 masks + extra fill variants). */
export const blockSize = (variants = 1): number => 16 + Math.max(0, variants - 1);

/** Which of the four corner tiles of a mask are "this terrain", as a readable string, for debugging and tests. */
export function maskCorners(mask: number): { tl: boolean; tr: boolean; bl: boolean; br: boolean } {
  return { tl: (mask & MASK_TL) !== 0, tr: (mask & MASK_TR) !== 0, bl: (mask & MASK_BL) !== 0, br: (mask & MASK_BR) !== 0 };
}

/**
 * Tile index for a terrain that has `phases` horizontal fill phases (for example the calçada wave has a 32 px wavelength
 * over 16 px tiles, so it uses two alternating tiles per mask): first + (i mod phases) * 16 + mask. -1 for mask 0.
 */
export function phasedIndex(first: number, mask: number, i: number, phases = 1): number {
  if (mask === 0) return -1;
  return first + (((i % phases) + phases) % phases) * 16 + mask;
}

/**
 * Same with a 2D phase grid (`phasesX` x `phasesY` fills, row-major, for example the ladrilho's alternating colourways or the tatame's
 * 32 px mats): first + ((j mod phasesY) * phasesX + (i mod phasesX)) * 16 + mask. -1 for mask 0.
 */
export function phasedIndex2(first: number, mask: number, i: number, j: number, phasesX = 1, phasesY = 1): number {
  if (mask === 0) return -1;
  const px = ((i % phasesX) + phasesX) % phasesX;
  const py = ((j % phasesY) + phasesY) % phasesY;
  return first + (py * phasesX + px) * 16 + mask;
}

/**
 * The 8x8 quadrant ownership of a mask: which of the four quadrants of the 16x16 display tile are filled.
 * Quadrant TL belongs to world tile (i-1, j-1) and covers pixels x 0..7, y 0..7 of the display tile.
 */
export function quadrantFilled(mask: number, px: number, py: number): boolean {
  const right = px >= TILE / 2;
  const bottom = py >= TILE / 2;
  const bit = bottom ? (right ? MASK_BR : MASK_BL) : right ? MASK_TR : MASK_TL;
  return (mask & bit) !== 0;
}
