// Builds the 16 dual-grid mask tiles of a terrain from its fill texture (HOWTO 5.6).
//
// The LimeZu terrain autotiles are "terrain painted over a base terrain" (opaque both sides), so they can't be
// layered per terrain the way the dual grid needs. Instead the import script derives the 16 mask tiles from the
// terrain's own fill tile: the shape is the union of the filled 8x8 quadrants (corner masks from terrain.ts),
// convex corners are chamfered, and edges get the LimeZu outline treatment (dark navy outline, lit top/left lip,
// a 3px shaded curb wall on the south side, a soft contact shadow cast down-right onto whatever is below).
import { blank, setPx, hexPx } from './img.mjs';
import { quadrantFilled, MASK_TL, MASK_TR, MASK_BL, MASK_BR } from '../../../apps/client/src/render/pixel/terrain.ts';

/**
 * Style colors: all from the LimeZu palette (character outline navy + the lavender greys).
 *
 * The edge of a slab is a raised stone curb (meio-fio), the same on every side of every paved area (street kerbs and the borders of the lawns):
 * an outline, then the stone's top (lit on the north / west, because the light comes from the upper left), then a groove that separates it from the
 * paving. On the south side the curb's vertical face is visible too (the camera looks down and forward): outline, two shaded rows of face, then the top.
 * A contact shadow falls down and to the right onto whatever lies below.
 */
export const SLAB_STYLE = {
  outlineDark: '#3a3a50',
  outline: '#46465e',
  wallShade: '#565972',
  wallLight: '#6c6e85',
  lipLight: '#d8d0e0',
  lipHi: '#ebe4f2',
  groove: '#a2a6be',
  faceMid: '#8b8bab',
  topShade: '#c6bdd5',
  shadow: [26, 16, 48],
  /** radius in px of the rounded corners (lawn corners and the slab's outer corners) */
  round: 5,
};

/** Is the pixel (x, y) of a tile with corner mask `mask` part of the slab? Out-of-tile pixels are clamped (the shape continues in the neighbour tile). */
function shape(mask, x, y, R = SLAB_STYLE.round) {
  const cx = Math.min(15, Math.max(0, x)), cy = Math.min(15, Math.max(0, y));
  const right = cx >= 8, bottom = cy >= 8;
  const own = bottom ? (right ? MASK_BR : MASK_BL) : right ? MASK_TR : MASK_TL;
  const horiz = bottom ? (right ? MASK_BL : MASK_BR) : right ? MASK_TL : MASK_TR; // the quadrant across the vertical tile axis
  const vert = bottom ? (right ? MASK_TR : MASK_TL) : right ? MASK_BR : MASK_BL; // the quadrant across the horizontal tile axis
  const diag = bottom ? (right ? MASK_TL : MASK_TR) : right ? MASK_BL : MASK_BR;
  // distance in px from the tile centre corner, measured into the quadrant: u along x, v along y (0 = next to the centre lines)
  const u = right ? cx - 8 : 7 - cx, v = bottom ? cy - 8 : 7 - cy;
  const corner = u < R && v < R && (R - u - 0.5) ** 2 + (R - v - 0.5) ** 2 > R * R; // outside the circle that rounds the corner
  if (mask & own) {
    // a convex corner of the slab (both neighbouring quadrants empty): cut it round
    if (!(mask & horiz) && !(mask & vert) && corner) return false;
    return true;
  }
  // an empty quadrant whose two neighbours and opposite are slab: a lawn corner, rounded by filling the corner back in
  return !!(mask & horiz) && !!(mask & vert) && !!(mask & diag) && corner;
}

/** Steps from (x, y) in direction (dx, dy) until an empty pixel; returns 1 when the neighbor is empty, up to max+1. */
function dist(mask, x, y, dx, dy, max = 7) {
  for (let s = 1; s <= max; s++) if (!shape(mask, x + dx * s, y + dy * s)) return s;
  return max + 1;
}

/** The stone colour of a slab pixel `r` px from an edge it faces (r = 1 is the outermost pixel), or null for the paving fill. */
function curbPixel(face, r, x, y, st) {
  if (face === 'S') {
    const joint = x === 0; // curb stones are 16 px long: a joint at every tile start
    const rows = [st.outlineDark, st.wallLight, st.faceMid, st.lipHi, st.lipLight, st.groove];
    const hex = rows[r - 1];
    if (!hex) return null;
    return joint && r >= 4 && r <= 5 ? st.groove : hex;
  }
  const joint = x === 0 && (face === 'N');
  const top = face === 'E' ? [st.outline, st.lipLight, st.topShade, st.groove] : [st.outline, st.lipHi, st.lipLight, st.groove];
  const hex = top[r - 1];
  if (!hex) return null;
  return joint && (r === 2 || r === 3) ? st.groove : hex;
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
            let hex = null;
            if (mask !== 15) {
              const d = { S: dist(mask, x, y, 0, 1), E: dist(mask, x, y, 1, 0), N: dist(mask, x, y, 0, -1), W: dist(mask, x, y, -1, 0) };
              // the nearest empty pixel decides which side of the curb this is (ties: south, east, north, west)
              let face = null, best = 99;
              for (const f of ['S', 'E', 'N', 'W']) if (d[f] < best) { best = d[f]; face = f; }
              // a pixel that only touches empty space diagonally (the arc of a rounded corner) still belongs to the outline
              if (best > 1) {
                const diagS = !shape(mask, x + 1, y + 1) || !shape(mask, x - 1, y + 1);
                const diagN = !shape(mask, x + 1, y - 1) || !shape(mask, x - 1, y - 1);
                if (diagS) { face = 'S'; best = 1; } else if (diagN) { face = 'N'; best = 1; }
              }
              if (best <= 6) hex = curbPixel(face, best, x, y, style);
            }
            if (hex) setPx(t, x, y, hexPx(hex));
            else { t.data[i] = fill.data[i]; t.data[i + 1] = fill.data[i + 1]; t.data[i + 2] = fill.data[i + 2]; t.data[i + 3] = 255; }
          } else if (mask !== 0 && mask !== 15) {
            // contact shadow on the empty side, cast down-right
            const sh = shape(mask, x, y - 1) ? 92 : shape(mask, x, y - 2) ? 58 : shape(mask, x - 1, y) ? 48 : 0;
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

/** The sea's edge: foam, a paler water lip, and the wet band it leaves on whatever it meets. */
export const SHORE_STYLE = { foam: '#f2faf6', foam2: '#d2efe6', lip: '#6cc5b8', wet: [110, 84, 46] };
/** Foam thickness (px) along an edge, by the pixel's position along it: a slow wobble that repeats every tile, so neighbours meet. */
const SHORE_WOBBLE = [1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1];

/**
 * `shore` terrains (the Praia's sea and lagoa): cut along the 8x8 quadrants like `flush` (so no hole opens where the water meets the pier's
 * deck or a boat), every water pixel opaque. Where the water ends inside the tile: a 1-2 px foam line, a softer foam pixel and a paler lip;
 * on the empty side a semi-transparent wet band (dark on the sand; the deck, drawn over it, hides it). Mask 15 is the untouched fill.
 */
export function buildShoreTiles(fills, style = SHORE_STYLE) {
  const tiles = [];
  const inShape = (mask, x, y) => quadrantFilled(mask, Math.min(15, Math.max(0, x)), Math.min(15, Math.max(0, y)));
  const STEPS = [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E']];
  for (const fill of fills) {
    for (let mask = 0; mask < 16; mask++) {
      const t = blank(16, 16);
      if (mask !== 0) {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const i = (y * 16 + x) * 4;
            if (quadrantFilled(mask, x, y)) {
              let d = 99, face = 'N';
              if (mask !== 15) {
                for (const [dx, dy, f] of STEPS) for (let s = 1; s <= 4; s++) if (!inShape(mask, x + dx * s, y + dy * s)) { if (s < d) { d = s; face = f; } break; }
                if (d > 1 && [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => !inShape(mask, x + dx, y + dy))) d = 1;
              }
              const w = face === 'N' || face === 'S' ? SHORE_WOBBLE[x] : SHORE_WOBBLE[y];
              const hex = d <= w ? style.foam : d === w + 1 ? style.foam2 : d === w + 2 ? style.lip : null;
              if (hex) setPx(t, x, y, hexPx(hex));
              else { t.data[i] = fill.data[i]; t.data[i + 1] = fill.data[i + 1]; t.data[i + 2] = fill.data[i + 2]; t.data[i + 3] = 255; }
            } else {
              let d = 99;
              for (const [dx, dy] of STEPS) for (let s = 1; s <= 3; s++) if (inShape(mask, x + dx * s, y + dy * s)) { d = Math.min(d, s); break; }
              const a = d === 1 ? 76 : d === 2 ? 44 : d === 3 ? 20 : 0;
              if (a) setPx(t, x, y, [style.wet[0], style.wet[1], style.wet[2], a]);
            }
          }
        }
      }
      tiles.push(t);
    }
  }
  return tiles;
}

/**
 * `flush` terrains (art track 3: interior floors, brick pavers): the tile is the fill cut along the 8x8 quadrants of the mask, no chamfer,
 * no curb, no shadow, so two flush terrains that meet (or a flush terrain and the slab under it) join exactly on the world tile edge.
 * `rim` (a hex) paints a 1 px line on every pixel of the shape that has an empty neighbour, so a floor has a crisp edge at the room border
 * (where `outside: 'x'` makes the neighbour empty) and mats have an edge against the wood. Mask 15 is the untouched fill.
 * @param {import('./img.mjs').Img[]} fills one fully opaque 16x16 fill tile per phase
 * @returns {import('./img.mjs').Img[]} 16 * fills.length tiles, index = phase * 16 + mask
 */
export function buildFlushTiles(fills, { rim = null } = {}) {
  const tiles = [];
  const inShape = (mask, x, y) => quadrantFilled(mask, Math.min(15, Math.max(0, x)), Math.min(15, Math.max(0, y)));
  for (const fill of fills) {
    for (let mask = 0; mask < 16; mask++) {
      const t = blank(16, 16);
      if (mask !== 0) {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            if (!quadrantFilled(mask, x, y)) continue;
            const i = (y * 16 + x) * 4;
            // an out-of-tile neighbour is assumed to continue the shape (it belongs to the same world tile), so only in-tile gaps make a rim
            const edge = rim && mask !== 15 && (!inShape(mask, x - 1, y) || !inShape(mask, x + 1, y) || !inShape(mask, x, y - 1) || !inShape(mask, x, y + 1));
            if (edge) setPx(t, x, y, hexPx(rim));
            else { t.data[i] = fill.data[i]; t.data[i + 1] = fill.data[i + 1]; t.data[i + 2] = fill.data[i + 2]; t.data[i + 3] = 255; }
          }
        }
      }
      tiles.push(t);
    }
  }
  return tiles;
}
