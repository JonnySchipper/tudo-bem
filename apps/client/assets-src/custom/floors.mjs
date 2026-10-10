// Interior / paver floors (art track 3). Each function returns the fill tiles of one terrain: an array of fully opaque 16x16 images,
// laid out as phases (row-major, `phasesX` wide). `scripts/lib/pixel/terrain-gen.mjs` (buildFlushTiles) cuts the 16 dual-grid mask tiles
// out of every phase, so a pattern has to tile seamlessly at 16 px (and at 32 px where it has 2x2 phases).
//
//   t  tijolo        brick pavers in running bond (outdoor), 1 phase, authored (LimeZu red-brick palette)
//   l  ladrilho      Brazilian hydraulic cement tile: cream + terracotta, diamond + corner motif, 2x2 phases (alternating inversion), authored
//   m  madeira/taco  herringbone parquet: the LimeZu chevron floor (Room_Builder_Floors 144,160) recolored to warm woods
//   k  xadrez        black-and-white checker (8 px squares), authored
//   j  tatame        blue / green foam puzzle mats with seams (32 px mats, 2x2 phases), authored
//   z  granilite     the airport terminal: big polished terrazzo slabs (32 px, 2x2 phases), pale grey with stone chips, authored
import { blank, clone, crop } from '../../../../scripts/lib/pixel/img.mjs';
import { C, K, put, fillRect, h2 } from './paint.mjs';
import { recolorRamp } from './kit.mjs';
import { mat, MAT_BLUE } from './gym3.mjs';
import { agua, deque } from './praia.mjs';

const tile = () => blank(16, 16);

/**
 * Phase 4a: the ladrilho, the taco parquet and the tatame checker were loud at 4x. `calm` pulls every pixel of a floor's fill tiles toward the
 * mean colour of the whole set (all phases together, so alternating phases stay consistent): `gain` 0.62 cuts the luma standard deviation by
 * about 38%. The patterns keep their drawing, only the contrast between their tones drops; `lift` raises the mean (the parquet was dark).
 * Fully opaque fills only.
 */
export function calm(fills, gain, lift = 0) {
  let n = 0;
  const sum = [0, 0, 0];
  for (const t of fills) for (let i = 0; i < t.data.length; i += 4) { for (let c = 0; c < 3; c++) sum[c] += t.data[i + c]; n++; }
  const mean = sum.map((s) => s / n);
  return fills.map((t) => {
    const out = { w: t.w, h: t.h, data: new Uint8Array(t.data) };
    for (let i = 0; i < out.data.length; i += 4) for (let c = 0; c < 3; c++) out.data[i + c] = Math.max(0, Math.min(255, Math.round(mean[c] + lift + (t.data[i + c] - mean[c]) * gain)));
    return out;
  });
}

/** Contrast gain per calmed floor (1 = the art track 3 original). */
export const CALM = { ladrilho: 0.62, taco: 0.62, tatame: 0.62 };

// ------------------------------------------------------------------ t: tijolo
/**
 * V1 pass: the brick paths were saturated terracotta and shouted over the paving. Now a dusty clay: six close shades (about 25% saturation, one step
 * apart), a lit top row per brick, a few worn pixels, and a mortar of three greys that varies from joint to joint instead of one flat line.
 */
const BRICK = ['#b9826c', '#b07a66', '#bd8770', '#a9735f', '#b58069', '#b27c68'];
const BRICK_HI = ['#cb9a82', '#c4917a', '#d0a088'];
const BRICK_WORN = '#c9a08c';
const MORTAR = ['#8f807c', '#9a8b86', '#867773'];

export function tijolo() {
  const t = tile();
  const pick = (a, x, y, s) => a[Math.floor(h2(x, y, s) * a.length) % a.length];
  // mortar first: every pixel that no brick will cover gets one of three greys
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, pick(MORTAR, x, y, 21));
  // 4 rows of 8x4 bricks (7 px + 1 px mortar, 3 px + 1 px mortar), every other row offset by 4 px: period 16 x 16
  for (let row = 0; row < 4; row++) {
    const off = (row % 2) * 4;
    for (let k = -1; k < 3; k++) {
      const x0 = k * 8 + off;
      const y0 = row * 4;
      const bi = Math.floor(h2(k + 5, row + 3, 7) * BRICK.length);
      const col = BRICK[bi];
      const hi = BRICK_HI[bi % BRICK_HI.length];
      for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) {
        const px = (x0 + x + 16) % 16;
        let c = y === 0 ? (x < 6 ? hi : col) : col;
        if (y > 0 && h2(px + 3, y0 + y + 11, 13) < 0.06) c = BRICK_WORN; // a worn spot
        put(t, px, y0 + y, c);
      }
    }
  }
  return [t];
}

// ------------------------------------------------------------------ l: ladrilho hidraulico
const LAD = { cream: '#f2e6ce', creamHi: '#f8eed8', grout: '#dccdae', terra: '#d58f62', terraLo: '#bd7550', terraHi: '#e5a67c' };

/** One 16x16 cell of the cement tile: 1 px grout on the right and bottom, terracotta diamond ring + centre bead + corner triangles. */
function ladrilhoCell(inverted) {
  const bg = inverted ? LAD.terra : LAD.cream;
  const fg = inverted ? LAD.cream : LAD.terra;
  const fgLo = inverted ? LAD.grout : LAD.terraLo;
  const t = tile();
  fillRect(t, 0, 0, 16, 16, bg);
  // cell interior is 15x15 (x, y 0..14); centre at (7, 7); grout line at x = 15 and y = 15
  const cx = 7, cy = 7;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    const corner = Math.min(x + y, 14 - x + y, x + 14 - y, 28 - x - y);
    if (d === 6) put(t, x, y, fg); // thin diamond ring
    else if (d <= 1) put(t, x, y, fg); // centre bead
    else if (corner <= 2) put(t, x, y, fg); // corner triangles (meet the neighbours' triangles to make a second diamond)
  }
  put(t, cx, cy, bg); // dot in the bead
  // shade: darker terracotta on the lower-right of the ring, lighter on the upper-left
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const p = t.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 3);
    const isFg = inverted ? p[0] === 0xf0 && p[1] === 0xe2 : p[0] === 0xc8 && p[1] === 0x68;
    if (!isFg) continue;
    if (x - cx + (y - cy) > 4) put(t, x, y, fgLo);
    else if (x - cx + (y - cy) < -4 && !inverted) put(t, x, y, LAD.terraHi);
  }
  for (let i = 0; i < 16; i++) { put(t, 15, i, LAD.grout); put(t, i, 15, LAD.grout); }
  return t;
}

export function ladrilho() {
  return calm([ladrilhoCell(false)], CALM.ladrilho); // one calm colourway; the pattern reads through the diamond lattice the neighbouring corners make
}

// ------------------------------------------------------------------ m: madeira / taco (herringbone parquet)
const TACO_RAMP = ['#5a3a26', '#7a4a2c', '#8f5a34', '#a9764f', '#c08a56', '#d29d64', '#e0b27c'];

export function taco(pack) {
  const src = crop(pack, 144, 160, 16, 16);
  return calm([recolorRamp(src, TACO_RAMP, [])], CALM.taco, 12);
}

// ------------------------------------------------------------------ k: xadrez
export function xadrez() {
  const t = tile();
  const lo = '#4a4a62', hi = '#ece6da', hiShade = '#d8d0c2', loHi = '#5c5c78';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dark = ((x >> 3) + (y >> 3)) % 2 === 1;
    put(t, x, y, dark ? lo : hi);
  }
  // bevel: light top-left rows on dark squares, faint shade on the bottom-right of light ones
  for (let s = 0; s < 4; s++) {
    const sx = (s & 1) * 8, sy = (s >> 1) * 8;
    const dark = (((sx >> 3) + (sy >> 3)) % 2) === 1;
    for (let i = 0; i < 8; i++) {
      put(t, sx + i, sy, dark ? loHi : '#f6f2e8');
      put(t, sx, sy + i, dark ? loHi : '#f6f2e8');
      put(t, sx + i, sy + 7, dark ? '#3e3e54' : hiShade);
      put(t, sx + 7, sy + i, dark ? '#3e3e54' : hiShade);
    }
  }
  return [t];
}

// ------------------------------------------------------------------ j: tatame
// V3: interlocking EVA puzzle mats, 32 x 32 px (2 x 2 tiles) in two close blues, with a jigsaw tab on every seam. 4 x 4 tile phases = 2 x 2 mats.
export function tatame() {
  const sheet = blank(64, 64);
  for (let my = 0; my < 2; my++) for (let mx = 0; mx < 2; mx++) mat(sheet, mx * 32, my * 32, 32, 32, MAT_BLUE[(mx + my) % 2]);
  const out = [];
  for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) out.push(crop(sheet, px * 16, py * 16, 16, 16));
  return calm(out, 0.8);
}

// ------------------------------------------------------------------ z: granilite (the airport terminal)
// Polished terrazzo in 32 px slabs: a pale lavender-grey base, a lighter sheen band across the top-left of each slab, sparse chips in three
// stone tones (never two touching), and a 1 px joint that is lit on its upper-left edge and shaded on the lower-right.
const GRAN = { base: '#e3e0ea', baseLo: '#d9d5e2', sheen: '#eeebf3', joint: '#b9b4c8', jointLo: '#a7a2b8', chips: ['#c9c3d4', '#b8b1c6', '#f6f4f8', '#cfc6b6'] };

export function granilite() {
  const sheet = blank(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const sx = x % 32, sy = y % 32;
    // a soft diagonal sheen on the upper-left of each slab, the lower-right a shade darker
    const d = sx + sy;
    put(sheet, x, y, d < 18 ? GRAN.sheen : d > 46 ? GRAN.baseLo : GRAN.base);
  }
  // stone chips: sparse, deterministic, never on a joint, never two side by side
  const taken = new Set();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (x % 32 === 31 || y % 32 === 31 || x % 32 === 0 || y % 32 === 0) continue;
    if (h2(x, y, 41) > 0.05) continue;
    if (taken.has(`${x - 1},${y}`) || taken.has(`${x},${y - 1}`) || taken.has(`${x - 1},${y - 1}`) || taken.has(`${x + 1},${y - 1}`)) continue;
    taken.add(`${x},${y}`);
    put(sheet, x, y, GRAN.chips[Math.floor(h2(x, y, 43) * GRAN.chips.length) % GRAN.chips.length]);
  }
  // joints: the slab's last column and row; the first column and row of the next slab catch the light
  for (let i = 0; i < 64; i++) {
    for (const j of [31, 63]) {
      put(sheet, j, i, GRAN.joint);
      put(sheet, i, j, GRAN.joint);
    }
    for (const j of [0, 32]) {
      put(sheet, j, i, i % 32 === 31 ? GRAN.joint : '#f2f0f6');
      put(sheet, i, j, i % 32 === 31 ? GRAN.joint : '#f2f0f6');
    }
    for (const j of [30, 62]) {
      if (i % 32 !== 31 && i % 32 !== 0) put(sheet, j, i, GRAN.baseLo);
      if (i % 32 !== 31 && i % 32 !== 0) put(sheet, i, j, GRAN.baseLo);
    }
  }
  for (const j of [31, 63]) for (const k of [31, 63]) put(sheet, j, k, GRAN.jointLo);
  const out = [];
  for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) out.push(crop(sheet, px * 16, py * 16, 16, 16));
  return out;
}

export const FLOORS = {
  tijolo: { fn: tijolo, phasesX: 1, phasesY: 1 },
  ladrilho: { fn: ladrilho, phasesX: 1, phasesY: 1 },
  taco: { fn: taco, phasesX: 1, phasesY: 1, needsPack: true },
  xadrez: { fn: xadrez, phasesX: 1, phasesY: 1 },
  tatame: { fn: tatame, phasesX: 4, phasesY: 4 },
  granilite: { fn: granilite, phasesX: 4, phasesY: 4 },
  // the Praia (custom/praia.mjs): the sea (a `shore` terrain: foam where it meets anything) and the pier's planks
  agua: { fn: agua, phasesX: 2, phasesY: 2 },
  deque: { fn: deque, phasesX: 2, phasesY: 1 },
};

export { C, clone };
