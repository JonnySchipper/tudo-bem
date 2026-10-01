// Vila Ipê set dressing (Phase 5): the row of sobrados and terraços along the north street, the roofs across Rua Jacarandá, the party wall
// behind the banca, the bus stop and the "EM BREVE" banner over the fenced feira lot.
//
// Houses are kit-bashed from the LimeZu "Generic Buildings" brown townhouses (Modern Exteriors, sheet 4): the pack's own windows, doors,
// cornices and rooftop terraces (AC units, satellite dishes) cut to the 6-tile height of the street facades. The pack draws every house in
// one dark taupe + beige colourway, so the wall and trim ramps are swapped for paulista pastels (salmon, mustard, sky, sage, lilac).
// The bus stop, the banner and the mural on the party wall are authored here in the pack palette (navy outline, light from the upper left).
import { blank, clone, crop, paste, swap, stretchCols, rect, hline, vline, dot, box, C, K, outlineAround, px, setPx, hexPx } from './kit.mjs';
import { flipH, hexToRgb, luma } from '../../../../scripts/lib/pixel/img.mjs';
import { findGlass } from './shop.mjs';
import { litOverlay, stackRows } from './facades.mjs';
import { drawText5, width5 } from './font5.mjs';
import { text3, text3Width } from './draw.mjs';

const GENERIC = 'ext:ME_Theme_Sorter_16x16/4_Generic_Buildings_16x16.png';

/** The pack's wall and trim colours of the brown townhouses (measured on the sheet), each list sorted dark -> light at run time. */
const WALL_SRC = ['#5e4d52', '#67575c', '#6b5052', '#6c5d62', '#716467', '#7c6e6f'];
const TRIM_SRC = ['#916662', '#9c786b', '#b18a74', '#b99e86', '#c3ac90', '#d0be9c'];
const DOOR_SRC = ['#a85f46', '#b5754d', '#c18452', '#c78c59'];

const byLuma = (list) => [...list].sort((a, b) => luma(...hexToRgb(a)) - luma(...hexToRgb(b)));

/** Colourways: wall ramp (6, dark -> light), trim ramp (6) and door ramp (4). */
export const COLORWAYS = {
  salmao: {
    wall: ['#a9534b', '#b45c52', '#bd665a', '#c6715f', '#cf7d66', '#d88a6d'],
    trim: ['#c9b48f', '#d3c09b', '#dccaa6', '#e6d5b3', '#efe0c0', '#f7ecd0'],
    door: ['#2a575b', '#2e7177', '#367f82', '#49928f'],
  },
  amarelo: {
    wall: ['#c99a2c', '#d3a536', '#dcaf40', '#e5ba4c', '#edc55a', '#f4d06a'],
    trim: ['#b7a98e', '#c3b598', '#cfc1a3', '#dccfb2', '#e8dcc1', '#f3e9d0'],
    door: ['#8f2b2d', '#a82b2d', '#cb2a2a', '#d93232'],
  },
  azul: {
    wall: ['#5d7fae', '#678ab8', '#7195c1', '#7d9fca', '#8aaad2', '#98b6da'],
    trim: ['#b6bccf', '#c3c9da', '#d0d5e3', '#dde1ec', '#e9ecf4', '#f6f7fb'],
    door: ['#a85f46', '#b5754d', '#c18452', '#c78c59'],
  },
  verde: {
    wall: ['#4f7f6a', '#588a73', '#62957d', '#6ea088', '#7bab94', '#89b6a0'],
    trim: ['#c1b28f', '#cdbf9c', '#d8cba9', '#e3d7b7', '#eee3c5', '#f7eed6'],
    door: ['#a85f46', '#b5754d', '#c18452', '#c78c59'],
  },
  lilas: {
    wall: ['#8a6fa4', '#957aae', '#a086b8', '#ab92c1', '#b79eca', '#c4abd3'],
    trim: ['#c9b48f', '#d3c09b', '#dccaa6', '#e6d5b3', '#efe0c0', '#f7ecd0'],
    door: ['#2a575b', '#2e7177', '#367f82', '#49928f'],
  },
};

function dress(img, cw) {
  const table = {};
  byLuma(WALL_SRC).forEach((c, i) => (table[c] = cw.wall[i]));
  byLuma(TRIM_SRC).forEach((c, i) => (table[c] = cw.trim[i]));
  byLuma(DOOR_SRC).forEach((c, i) => (table[c] = cw.door[i]));
  return swap(img, table);
}

const CAST = { kx: 0.3, ky: 0.16, rgba: [26, 16, 48, 84] };

/** The three pack townhouses: 2 floors + terrace (A), 1 floor + terrace (B), 4 floors + terrace (T). Coordinates measured on sheet 4. */
async function sources(ctx) {
  const sheet = await ctx.load(GENERIC);
  return {
    A: crop(sheet, 368, 403, 96, 155),
    B: crop(sheet, 368, 574, 96, 113),
    T: crop(sheet, 240, 409, 112, 278),
  };
}

/** House fronts (6 rows tall): the bottom of the pack house, or B with 17 flat rows cut out of its roof terrace. */
function houseFront(src, kind) {
  if (kind === 'A') return crop(src.A, 0, 155 - 96, 96, 96); // cornice + 2 floors
  if (kind === 'B') return stackRows(src.B, [[0, 40], [57, 113]]); // terrace (AC unit kept) + ground floor
  return crop(src.T, 0, 278 - 96, 112, 96); // ground floor with the door + one floor + cornice
}

/**
 * Roofs across Rua Jacarandá (4 rows tall): the flat terrace of the pack's one-floor townhouse (the AC unit stays, the satellite dishes of the
 * taller ones would be cut by the crop), 96 px wide or stretched to 112 for the 7-tile slots, optionally mirrored. Only the rim takes the
 * colourway; the deck floor and its cracks keep the pack's taupe.
 */
function roof(src, tiles, mirror, cw) {
  let base = crop(src.B, 0, 0, 96, 64);
  if (tiles === 7) base = stretchCols(base, 40, 56, 112);
  if (mirror) base = flipH(base);
  const out = dress(base, cw);
  const ix = 7, iy = 9, iw = base.w - 14, ih = base.h - 21;
  paste(out, crop(base, ix, iy, iw, ih), ix, iy);
  return out;
}

const HOUSES = [
  ['casas/sobrado_salmao', 'A', 'salmao', 6],
  ['casas/terraco_amarelo', 'B', 'amarelo', 6],
  ['casas/terraco_azul', 'B', 'azul', 6],
  ['casas/terraco_verde', 'B', 'verde', 6],
  ['casas/sobrado_verde', 'T', 'verde', 7],
];

// ------------------------------------------------------------------ party wall with a painted mural (behind the banca)
function empena() {
  const w = 48, h = 96;
  const img = blank(w, h);
  const cw = COLORWAYS.amarelo;
  // plaster wall with a little brick noise
  rect(img, 0, 0, w, h, cw.wall[3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x * 7 + y * 13 + ((x >> 2) * (y >> 3)) * 5) % 11 === 0) dot(img, x, y, cw.wall[2]);
  for (let y = 3; y < h; y += 8) for (let x = (y >> 3) % 2 ? 4 : 0; x < w; x += 8) if ((x + y) % 5 !== 0) dot(img, x, y, cw.wall[4]);
  // cornice
  rect(img, 0, 0, w, 6, cw.trim[3]);
  hline(img, 0, 0, w, cw.trim[5]);
  hline(img, 0, 5, w, cw.trim[1]);
  hline(img, 0, 6, w, C.navy);
  // plinth
  rect(img, 0, h - 8, w, 8, cw.trim[2]);
  hline(img, 0, h - 8, w, cw.trim[5]);
  hline(img, 0, h - 1, w, cw.trim[0]);
  // pilasters
  for (const x of [0, w - 3]) {
    rect(img, x, 7, 3, h - 15, cw.trim[3]);
    vline(img, x, 7, h - 15, cw.trim[5]);
    vline(img, x + 2, 7, h - 15, cw.trim[1]);
  }
  // drainpipe
  rect(img, 40, 8, 2, h - 16, C.slate2);
  vline(img, 40, 8, h - 16, C.mist2);
  vline(img, 41, 8, h - 16, C.slate);
  // mural: a mustard panel with TUDO / BEM? in terracotta, framed
  const mx = 7, my = 12, mw = 30, mh = 30;
  rect(img, mx, my, mw, mh, '#e8d9b0');
  box(img, mx, my, mw, mh, null, C.navy);
  hline(img, mx + 1, my + 1, mw - 2, '#f5ecd0');
  drawText5(img, mx + Math.floor((mw - width5('TUDO')) / 2), my + 5, 'TUDO', K.te3);
  drawText5(img, mx + Math.floor((mw - width5('BEM?')) / 2), my + 16, 'BEM?', K.te3);
  // a sun and a little bird for colour
  dot(img, mx + 4, my + mh - 5, C.y2);
  dot(img, mx + 5, my + mh - 5, C.y2);
  dot(img, mx + 4, my + mh - 4, C.y3);
  dot(img, mx + 5, my + mh - 4, C.y3);
  // light from the upper left: a lit west edge and a shaded east edge
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ bus stop shelter (3x1 tiles, 48 x 47)
function pontoOnibus() {
  const w = 48, h = 47;
  const img = blank(w, h);
  // back panel: glass between the posts
  rect(img, 3, 12, 42, 23, K.gl3);
  for (let y = 12; y < 35; y++) for (let x = 3; x < 45; x++) if ((x + y) % 9 === 0 || (x + y) % 9 === 1) dot(img, x, y, K.gl1);
  vline(img, 24, 12, 23, K.gl5);
  vline(img, 25, 12, 23, K.gl1);
  hline(img, 3, 12, 42, K.gl5);
  // posts
  for (const x of [1, 45]) {
    rect(img, x, 9, 2, 36, C.slate);
    vline(img, x, 9, 36, C.mist2);
  }
  // roof slab: lit top, shaded front
  rect(img, 0, 3, w, 7, C.slate2);
  hline(img, 0, 3, w, C.lav2);
  hline(img, 0, 4, w, C.mist2);
  hline(img, 0, 9, w, C.slate);
  hline(img, 1, 10, w - 2, C.navy2);
  // the sign on the roof front: blue plaque with ONIBUS
  const sw = text3Width('ONIBUS') + 4;
  const sx = Math.floor((w - sw) / 2);
  rect(img, sx, 4, sw, 7, C.b3);
  box(img, sx, 3, sw, 8, C.b3, C.navy);
  text3(img, sx + 2, 4, 'ONIBUS', C.white);
  // bench: green plank seat and backrest, navy legs
  rect(img, 6, 30, 36, 3, C.sp2);
  hline(img, 6, 30, 36, C.sp3);
  hline(img, 6, 32, 36, C.sp0);
  rect(img, 6, 26, 36, 2, C.sp1);
  hline(img, 6, 26, 36, C.sp3);
  for (const x of [8, 39]) rect(img, x, 33, 2, 8, C.navy2);
  // timetable box on the right post and a ticket flyer
  rect(img, 38, 15, 6, 9, C.lav3);
  box(img, 38, 15, 6, 9, C.lav3, C.navy);
  hline(img, 39, 17, 4, C.b3);
  hline(img, 39, 19, 4, C.mist);
  hline(img, 39, 21, 3, C.mist);
  // floor line / shadow strip
  hline(img, 0, 44, w, C.navy2);
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ "EM BREVE" banner over the feira lot (4x1 tiles, 64 x 30)
function emBreve() {
  const w = 64, h = 30;
  const img = blank(w, h);
  // posts
  for (const x of [0, w - 3]) {
    rect(img, x, 4, 3, h - 4, K.br2);
    vline(img, x, 4, h - 4, K.br0);
    vline(img, x + 2, 4, h - 4, K.br3);
    rect(img, x - 1, 2, 5, 3, K.br1);
    hline(img, x - 1, 2, 5, K.br0);
  }
  // hanging cloth with scalloped bottom, terracotta with a mustard rim and cream letters
  rect(img, 4, 3, w - 8, 17, K.te2);
  hline(img, 4, 3, w - 8, K.te0);
  hline(img, 4, 4, w - 8, K.te1);
  hline(img, 4, 18, w - 8, K.te4);
  for (let x = 4; x < w - 4; x += 4) {
    rect(img, x, 19, 2, 2, K.te4);
    dot(img, x, 21, K.te5);
  }
  rect(img, 5, 6, w - 10, 1, K.brandMustard);
  rect(img, 5, 15, w - 10, 1, K.brandMustard);
  drawText5(img, Math.floor((w - width5('EM BREVE')) / 2), 8, 'EM BREVE', K.brandCream, { shadow: K.te5 });
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ generators (registered in derive.mjs)
export async function casas(ctx) {
  const src = await sources(ctx);
  const parts = [];
  for (const [key, kind, cwName, tiles] of HOUSES) {
    const body = dress(houseFront(src, kind), COLORWAYS[cwName]);
    outlineAround(body);
    const w = body.w;
    const glass = findGlass(body);
    const lit = litOverlay(w, body.h, glass, { curtains: true });
    parts.push({ key, img: body, anchor: [Math.floor(w / 2), body.h - 1], meta: { footprint: [tiles, 6], shadow: null, cast: CAST, windows: glass, lit: `${key}_lit` } });
    parts.push({ key: `${key}_lit`, img: lit, anchor: [Math.floor(w / 2), body.h - 1], meta: { footprint: [tiles, 6], shadow: null } });
  }
  parts.push({ key: 'casas/empena', img: empena(), anchor: [24, 95], meta: { footprint: [3, 6], shadow: null, cast: CAST } });
  // the first part inherits the import-map line, so it must be the one named there
  return parts;
}

export async function pontoOnibusPart() {
  const img = pontoOnibus();
  return [{ img, anchor: [24, 44] }];
}

export async function emBrevePart() {
  const img = emBreve();
  return [{ img, anchor: [32, 27] }];
}

export async function preview() {
  return [pontoOnibus(), emBreve(), empena()];
}
void roof; void clone; void paste; void px; void setPx; void hexPx;
