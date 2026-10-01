// Calçada de petit-pavé: original pixel art for Vila Ipê, authored as code that emits pixel grids.
// Colors are ONLY LimeZu palette colors (exteriors Palette.png / character outline navy).
//
// V1 ground pass: the wave used to be 2x2 px stones with per-stone random tints and highlights, which buzzed at every zoom. It is now two calm tones in
// smooth flowing bands (the Copacabana wave), with the petit-pavé only suggested by a quiet 4 px stone grid in running bond (1 px joints, a few
// percent lighter or darker than the stone, no per-pixel noise). Light comes from the upper left: the joints sit on the lower right of each stone.
import { blank, setPx, hexPx } from '../../../../scripts/lib/pixel/img.mjs';

/** The mosaic keeps the bold black-and-white stone values (it is the one piece of the ground that should stand out). */
export const STONE = {
  light: ['#f0efde', '#ebe4f2', '#ebe4f2', '#f0efde', '#d8d0e0', '#eee1b7'],
  lightShade: '#c6bdd5',
  lightHi: '#f8f8f8',
  dark: ['#7d7f99', '#7d7f99', '#6c6e85', '#7d7f99'],
  darkShade: '#6c6e85',
  darkHi: '#8b8bab',
};

/**
 * The paving: the wave's two tones. `light` / `dark` are the stone faces (the first entry is the common one, the others are the rare one-step
 * variations), `*Joint` the 1 px joint, `edge` the single mid-tone pixel row that softens the band border. Contrast between the tones is about 60%
 * of the mosaic's, and the stone-to-stone variation is only 1 step (about 5 luma).
 */
export const PAVE = {
  light: ['#c6bdd5', '#cdc5db', '#bfb8cf'],
  lightJoint: '#b2aecb',
  dark: ['#8b8bab', '#8585a4', '#9191b0'],
  darkJoint: '#7d7f99',
  edge: '#a2a6be',
  // legacy keys (the contrast test of art1 reads the stone pools)
  lightShade: '#a2a6be', lightHi: '#d8d0e0', darkShade: '#6c6e85', darkHi: '#989ebe',
};

const TAU = Math.PI * 2;

/**
 * The wave variants. `px` x `py` is the pattern period in pixels (a whole number of tiles: phases px/16 x py/16), `amp` the wave amplitude in px,
 * `stone` the stone grid (0 = no joints), `quant`: 'pixel' = the band border is smooth at pixel level, 'stone' = every stone is one tone (stair-stepped border).
 */
export const WAVES = {
  A: { px: 64, py: 32, amp: 6.5, stone: 4, quant: 'pixel', edge: true },
  B: { px: 32, py: 16, amp: 4, stone: 4, quant: 'stone', edge: false },
  C: { px: 32, py: 16, amp: 4.5, stone: 0, quant: 'pixel', edge: true },
};
/** The one in use. */
export const WAVE = process.env.CALCADA_VARIANT && WAVES[process.env.CALCADA_VARIANT] ? process.env.CALCADA_VARIANT : 'A';

const hash = (a, b, s = 0) => {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Position inside the band period at (X, Y): 0 .. py, dark below py/2. Periodic in X with `px` (the wavelength) and in Y with `py`. */
function bandPos(o, X, Y) {
  const wave = o.amp * Math.sin((TAU * X) / o.px);
  return (((Y + wave) % o.py) + o.py) % o.py;
}

/** Colour of the paving at pattern pixel (X, Y). */
export function pavePx(o, X, Y) {
  const s = o.stone;
  let sx = X, sy = Y, lx = 0, ly = 0, cx = 0, cy = 0, joint = false;
  if (s) {
    cy = Math.floor(Y / s);
    const off = (cy % 2) * (s / 2);
    const xs = (X - off + o.px) % o.px;
    cx = Math.floor(xs / s);
    lx = xs % s;
    ly = Y % s;
    joint = lx === s - 1 || ly === s - 1;
    // sample the band at the stone centre when every stone is one tone
    if (o.quant === 'stone') { sx = cx * s + off + s / 2; sy = cy * s + s / 2; }
  }
  const t = bandPos(o, sx, sy);
  const half = o.py / 2;
  const dark = t < half;
  const pool = dark ? PAVE.dark : PAVE.light;
  const r = hash(cx, cy, dark ? 7 : 3);
  let hex = pool[r < 0.62 ? 0 : r < 0.81 ? 1 : 2];
  if (o.stone === 0) {
    // no joints: a 4 px block mottling instead, one step only
    const br = hash(X >> 2, Y >> 2, dark ? 9 : 5);
    hex = pool[br < 0.7 ? 0 : br < 0.85 ? 1 : 2];
  }
  if (o.edge && o.quant === 'pixel') {
    const d = Math.min(t, Math.abs(t - half), o.py - t); // distance to the nearest band border, in px of y
    if (d < 0.75) hex = PAVE.edge;
  }
  if (joint) hex = dark ? PAVE.darkJoint : PAVE.lightJoint;
  return hex;
}

/** All fill tiles of the paving, row-major over (phasesX x phasesY) 16x16 images. */
export function calcadaFills(variant = WAVE) {
  const o = WAVES[variant];
  const phasesX = o.px / 16, phasesY = o.py / 16;
  const fills = [];
  for (let b = 0; b < phasesY; b++) {
    for (let a = 0; a < phasesX; a++) {
      const img = blank(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(img, x, y, hexPx(pavePx(o, a * 16 + x, b * 16 + y)));
      fills.push(img);
    }
  }
  return { fills, phasesX, phasesY };
}

/**
 * São Paulo state outline in (lon, lat), simplified, clockwise from the north-west tip: the Paraná river on the west, the Rio Grande and the Minas
 * border on the north and east, the Mantiqueira and the Rio de Janeiro corner, the coast from Ubatuba to Cananéia, then the Paraná border back
 * through the Ribeira valley and along the Paranapanema.
 */
const SP_POLY = [
  [-50.35, -19.98], [-49.75, -19.82], [-49.15, -20.05], [-48.55, -20.15], [-48.05, -20.15], [-47.75, -20.04], [-47.35, -20.15],
  [-47.1, -20.5], [-46.85, -20.75], [-46.45, -20.85], [-46.4, -21.4], [-46.55, -21.95], [-46.4, -22.35], [-46.05, -22.4],
  [-45.65, -22.65], [-45.3, -22.5], [-44.75, -22.45], [-44.3, -22.65], [-44.15, -22.85], [-44.2, -23.2], [-44.7, -23.35],
  [-45.1, -23.45], [-45.4, -23.75], [-45.9, -23.8], [-46.15, -23.9], [-46.4, -24.05], [-46.9, -24.3], [-47.4, -24.65],
  [-47.85, -24.95], [-48.1, -25.3], [-48.4, -24.9], [-48.6, -24.55], [-48.85, -24.35], [-49.35, -24.2], [-49.45, -23.85],
  [-49.55, -23.4], [-49.85, -23.1], [-50.2, -22.95], [-50.7, -22.75], [-51.3, -22.7], [-51.9, -22.6], [-52.4, -22.5],
  [-53.05, -22.6], [-52.8, -22.2], [-52.2, -21.85], [-51.7, -21.0], [-51.45, -20.7], [-51.1, -20.35], [-50.7, -20.2],
];

function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The state bitmap inside a w x h decal (with a `margin` all round). Super-sampled 3x3 so the coast is not stair-stepped by the pixel centres. */
export function spMapBitmap(w = 64, h = 48, margin = 6) {
  const lons = SP_POLY.map((p) => p[0]), lats = SP_POLY.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const spanLon = maxLon - minLon, spanLat = maxLat - minLat;
  const aspect = (spanLon * 0.92) / spanLat; // 1 deg lon ~ 0.92 deg lat here
  const innerW = w - margin * 2, innerH = h - margin * 2;
  let mw = innerW, mh = innerW / aspect;
  if (mh > innerH) { mh = innerH; mw = innerH * aspect; }
  const ox = (w - mw) / 2, oy = (h - mh) / 2;
  const bits = [];
  for (let y = 0; y < h; y++) {
    bits.push([]);
    for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const fx = x + (sx + 0.5) / 3, fy = y + (sy + 0.5) / 3;
        const lon = minLon + ((fx - ox) / mw) * spanLon;
        const lat = maxLat - ((fy - oy) / mh) * spanLat;
        if (fx >= ox && fx < ox + mw && fy >= oy && fy < oy + mh && inPoly(SP_POLY, lon, lat)) hit++;
      }
      bits[y].push(hit); // coverage 0..9 of the 3 x 3 samples
    }
  }
  const cx = Math.round(ox + ((-46.63 - minLon) / spanLon) * mw - 0.5); // São Paulo city
  const cy = Math.round(oy + ((maxLat + 23.55) / spanLat) * mh - 0.5);
  return { bits, cx, cy };
}

const MOS = {
  frameHi: '#ebe4f2', frame: '#d8d0e0', frameShade: '#a2a6be', frameJoint: '#bcb7cd', gap: '#46465e',
  field: ['#666881', '#666881', '#5f627b'], fieldJoint: '#555770',
  state: ['#f0efde', '#ebe4f2', '#ebe4f2'], stateJoint: '#cfc8dc', stateEdge: '#9a9ab5',
};

/**
 * Ground decal (default 64x48 = 4x3 tiles): the state of São Paulo in light stones on a dark field, inside a stone frame, with the capital marked.
 * The field and the state share the 4 px petit-pavé grid of the paving (running bond, 1 px joints) so the decal belongs to the street.
 */
export function spMosaic(W = 64, H = 48) {
  const img = blank(W, H);
  const FR = 3; // frame thickness
  const { bits, cx, cy } = spMapBitmap(W, H, FR + 2);
  const s = 4;
  const cover = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? bits[y][x] : 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inFrame = x < FR || y < FR || x >= W - FR || y >= H - FR;
      const row = Math.floor(y / s), off = (row % 2) * (s / 2);
      const xs = x - off + W;
      const col = Math.floor(xs / s), lx = xs % s, ly = y % s;
      const joint = lx === s - 1 || ly === s - 1;
      const r = hash(col, row, 11);
      let hex;
      if (inFrame) {
        // frame: three rows of light stones; the outermost px is the shade, the innermost px the dark gap against the field
        const dEdge = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (dEdge === 0) hex = MOS.frameShade;
        else if (dEdge === FR - 1) hex = MOS.gap;
        else hex = joint ? MOS.frameJoint : dEdge === 1 && (x < W / 2 && y < H / 2) ? MOS.frameHi : MOS.frame;
      } else if (cover(x, y) >= 6) {
        hex = joint ? MOS.stateJoint : MOS.state[r < 0.6 ? 0 : r < 0.8 ? 1 : 2];
      } else if (cover(x, y) >= 3) {
        hex = joint ? '#8b8bab' : MOS.stateEdge; // the coast: a half-covered stone is a mid grey, so the outline stays smooth at any zoom
      } else {
        hex = joint ? MOS.fieldJoint : MOS.field[r < 0.6 ? 0 : r < 0.8 ? 1 : 2];
      }
      setPx(img, x, y, hexPx(hex));
    }
  }
  // the capital: a small red-orange stone with a lit corner, ringed in dark so it reads on the white
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && !(Math.abs(dx) === 2 && Math.abs(dy) === 2)) setPx(img, cx + dx, cy + dy, hexPx('#3a3a50'));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setPx(img, cx + dx, cy + dy, hexPx(dx === -1 && dy === -1 ? '#f2b22b' : dx === 1 && dy === 1 ? '#cb2a2a' : '#ed931e'));
  return img;
}

