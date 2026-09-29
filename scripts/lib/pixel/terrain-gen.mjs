// Builds the 16 dual-grid mask tiles of a terrain from its fill texture (HOWTO 5.6).
//
// The LimeZu terrain autotiles are "terrain painted over a base terrain" (opaque both sides), so they can't be
// layered per terrain the way the dual grid needs. Instead the import script derives the 16 mask tiles from the
// terrain's own fill tile: the shape is the union of the filled 8x8 quadrants (corner masks from terrain.ts),
// convex corners are chamfered, and edges get the LimeZu outline treatment (dark navy outline, lit top/left lip,
// a 3px shaded curb wall on the south side, a soft contact shadow cast down-right onto whatever is below).
import { blank, setPx, hexPx } from './img.mjs';
import { quadrantFilled, MASK_TL, MASK_TR, MASK_BL, MASK_BR } from '../../../apps/client/src/render/pixel/terrain.ts';

/** Style colors: all from the LimeZu palette (character outline navy + the lavender greys). */
export const SLAB_STYLE = {
  outlineDark: '#3a3a50',
  outline: '#46465e',
  wallShade: '#565972',
  wallLight: '#6c6e85',
  lipLight: '#d8d0e0',
  lipHi: '#ebe4f2',
  shadow: [26, 16, 48],
};

/** Shape test for mask at pixel (x, y); coordinates outside 0..15 are clamped (exact, see comment in terrain-gen). */
function shape(mask, x, y) {
  const cx = Math.min(15, Math.max(0, x)), cy = Math.min(15, Math.max(0, y));
  if (!quadrantFilled(mask, cx, cy)) return false;
  // chamfer convex corners at the tile center: a quadrant is convex when both edge-adjacent quadrants are empty
  const inTL = cx < 8 && cy < 8, inTR = cx >= 8 && cy < 8, inBL = cx < 8 && cy >= 8, inBR = cx >= 8 && cy >= 8;
  if (inTL && !(mask & MASK_TR) && !(mask & MASK_BL) && 7 - cx + (7 - cy) <= 1) return false;
  if (inTR && !(mask & MASK_TL) && !(mask & MASK_BR) && cx - 8 + (7 - cy) <= 1) return false;
  if (inBL && !(mask & MASK_TL) && !(mask & MASK_BR) && 7 - cx + (cy - 8) <= 1) return false;
  if (inBR && !(mask & MASK_TR) && !(mask & MASK_BL) && cx - 8 + (cy - 8) <= 1) return false;
  return true;
}

/** Steps from (x, y) in direction (dx, dy) until an empty pixel; returns 1 when the neighbor is empty, up to max+1. */
function dist(mask, x, y, dx, dy, max = 5) {
  for (let s = 1; s <= max; s++) if (!shape(mask, x + dx * s, y + dy * s)) return s;
  return max + 1;
}

/**
 * @param {import('./img.mjs').Img[]} fills one fully opaque 16x16 fill tile per phase
 * @returns {import('./img.mjs').Img[]} 16 * fills.length tiles, index = phase * 16 + mask
 */
export function buildSlabTiles(fills, style = SLAB_STYLE) {
  const tiles = [];
  for (const fill of fills) {
    for (let mask = 0; mask < 16; mask++) {
      const t = blank(16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          if (shape(mask, x, y)) {
            const dS = dist(mask, x, y, 0, 1);
            const dE = dist(mask, x, y, 1, 0);
            const dN = dist(mask, x, y, 0, -1);
            const dW = dist(mask, x, y, -1, 0);
            let hex = null;
            if (mask !== 15) {
              if (dS === 1) hex = style.outlineDark;
              else if (dS === 2) hex = style.outline;
              else if (dS === 3) hex = style.wallShade;
              else if (dS === 4) hex = style.lipLight;
              else if (dE === 1) hex = style.outlineDark;
              else if (dE === 2) hex = style.wallShade;
              else if (dN === 1) hex = style.outline;
              else if (dN === 2) hex = style.lipHi;
              else if (dW === 1) hex = style.outline;
              else if (dW === 2) hex = style.lipLight;
            }
            if (hex) setPx(t, x, y, hexPx(hex));
            else { t.data[i] = fill.data[i]; t.data[i + 1] = fill.data[i + 1]; t.data[i + 2] = fill.data[i + 2]; t.data[i + 3] = 255; }
          } else if (mask !== 0 && mask !== 15) {
            // contact shadow on the empty side, cast down-right
            const below = dist(mask, x, y, 0, -1, 3); // filled pixel above within 2
            const left = dist(mask, x, y, -1, 0, 2);
            const sh = shape(mask, x, y - 1) ? 92 : shape(mask, x, y - 2) ? 58 : shape(mask, x - 1, y) ? 48 : 0;
            void below; void left;
            if (sh) setPx(t, x, y, [style.shadow[0], style.shadow[1], style.shadow[2], sh]);
          }
        }
      }
      tiles.push(t);
    }
  }
  return tiles;
}

/** Full-fill only tiles (base terrains like grass and asphalt): 16 mask slots, all the same fill, so tileIndex math stays uniform. */
export function buildFlatTiles(fills, extraVariants = []) {
  const tiles = [];
  for (const fill of fills) for (let mask = 0; mask < 16; mask++) tiles.push(mask === 0 ? blank(16, 16) : fill);
  return tiles.concat(extraVariants);
}
