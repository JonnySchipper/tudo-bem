// Wave 2 "garbs": neighbourhood pieces for the CPU crowd, layered over the outfit (see characters.ts GARBS). Authored in the pack style on the
// 16 px grid, key-colored (the look picks the colors), body anchored so they follow the walk bob and the warp of the body types.
//
//   jersey    vertical-striped football shirt (top ramp x accent ramp), no crests or logos
//   jaqueta   motoboy jacket: reflective band across the chest and sleeves, zip
//   macacao   dungarees: bib and straps, denim legs
//   chinelo   flip-flops: bare feet, a coloured sole and a Y strap
//   mochila   backpack (straps on the front, the bag behind)
//   caixa     delivery box on the back
//   sacola    tote bag on a strap across the chest
//   carrinho  feira cart on wheels beside the walker
//
// Back pieces come as an `_u` layer (drawn under the body: only the edges that stick out show, as they should from the front and side)
// and an `_o` layer (drawn over everything: the back view and the straps).
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';
import { OUTLINES, alphaAt, anchorOf, emptySheet, frames, fx, fy, hexAt, putHex, stampSet } from '../../../../scripts/lib/pixel/charedit.mjs';
import { rowFacing } from '../../../../scripts/lib/pixel/chars.mjs';
import { T } from './hats.mjs';

const FEET = 31;
const DOTS = '.'.repeat(16);
const P = (y0, rows, x0 = 0) => ({ y0, rows, x0 });
/** body-anchored pattern from absolute frame rows: { 23: [x, 'chars'], ... } (reference frame: feet at row 31) */
const PA = (spec) => {
  const ys = Object.keys(spec).map(Number);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(spec[y] ? T(spec[y][0], spec[y][1]) : DOTS);
  return P(y0 - FEET, rows);
};

/** A shaded box: outline, light top-left, darker bottom row, optional dark band row. Returns spec rows. */
function boxSpec(x0, y0, w, h, { band = -1, lid = true } = {}) {
  const spec = {};
  for (let j = 0; j < h; j++) {
    let row;
    if (j === 0 || j === h - 1) row = 'o'.repeat(w);
    else {
      const inner = Array.from({ length: w - 2 }, (_, i) => {
        if (j === band) return 'a';
        if (lid && j === 1) return i < 1 || i > w - 4 ? 'c' : 'c';
        if (j === h - 2) return 'a';
        return i === 0 ? 'c' : 'b';
      }).join('');
      row = 'o' + inner + 'o';
    }
    spec[y0 + j] = [x0, row];
  }
  return spec;
}

const ACC = KEY_RAMPS.accent;
const TOPK = KEY_RAMPS.top;
const BOTK = KEY_RAMPS.bottom;
const SHOEK = KEY_RAMPS.shoes;
const SKIN = KEY_RAMPS.skin;
const ACC_RANK = [0, 1, 2, 2];

function eachPixel(img, an, fn) {
  for (const { r, c } of frames()) {
    const a = anchorOf(an, r, c);
    if (!a) continue;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) if (alphaAt(img, fx(c, x), fy(r, y))) fn({ r, c, a, x, y, facing: rowFacing(r), hex: hexAt(img, fx(c, x), fy(r, y)) });
  }
}

/** Stripes: every top-ramp pixel of the outfit torso, alternate 2 px columns on the accent ramp. */
function jersey(outfit, an) {
  const out = emptySheet();
  eachPixel(outfit, an, ({ r, c, a, x, y, hex }) => {
    const rank = TOPK.indexOf(hex);
    if (rank < 0) return;
    const col = Math.floor((x - a.tx0) / 2);
    putHex(out, fx(c, x), fy(r, y), ((col % 2) + 2) % 2 ? ACC[ACC_RANK[rank]] : hex);
  });
  return out;
}

/** Reflective band (row feet-6) over the torso and sleeves, and a zip down the front. */
function jaqueta(outfit, an) {
  const out = emptySheet();
  eachPixel(outfit, an, ({ r, c, a, x, y, facing, hex }) => {
    if (TOPK.indexOf(hex) < 0) return;
    if (y === a.bottom - 6) putHex(out, fx(c, x), fy(r, y), ACC[1]);
    if (y === a.bottom - 7 && TOPK.indexOf(hex) >= 0 && (x === Math.round((a.tx0 + a.tx1) / 2) || x === Math.round((a.tx0 + a.tx1) / 2) - 1) && facing === 'S') putHex(out, fx(c, x), fy(r, y), TOPK[0]);
    if (facing === 'S' && y >= a.bottom - 5 && y <= a.bottom - 4 && x === Math.round((a.tx0 + a.tx1 - 1) / 2)) putHex(out, fx(c, x), fy(r, y), '#1f1f2e');
  });
  return out;
}

/** Denim legs (the pants band re-keyed to the accent ramp) plus bib, straps and buttons. */
function macacao(outfit, an) {
  const out = emptySheet();
  eachPixel(outfit, an, ({ r, c, a, x, y, hex }) => {
    const rank = BOTK.indexOf(hex);
    if (rank < 0 || y < a.bottom - 4 || y > a.bottom - 2) return;
    putHex(out, fx(c, x), fy(r, y), ACC[ACC_RANK[rank]]);
  });
  const bib = stampSet(emptySheet(), {
    S: PA({ 23: [5, 'b....b'], 24: [5, 'bY..Yb'], 25: [5, 'bccccb'], 26: [5, 'bbbbbb'] }),
    E: PA({ 23: [7, 'b'], 24: [7, 'bY'], 25: [8, 'bb'], 26: [8, 'bb'], 27: [8, 'b'] }),
    N: PA({ 23: [4, 'bc..cb'], 24: [4, 'b....b'], 25: [5, 'bccb'], 26: [5, 'bbbb'] }),
  }, an, 'body', { rows: new Set([0, 1, 2, 3, 4, 5, 6, 7]) });
  for (let i = 0; i < out.data.length; i += 4) if (bib.data[i + 3]) for (let q = 0; q < 4; q++) out.data[i + q] = bib.data[i + q];
  return out;
}

/** Flip-flops: the shoe pixels become bare feet, the bottom row a coloured sole, one pixel nearest the centre a strap. */
function chinelo(outfit, an) {
  const out = emptySheet();
  for (const { r, c } of frames()) {
    const a = anchorOf(an, r, c);
    if (!a) continue;
    const fill = [];
    for (let y = a.bottom - 1; y <= a.bottom; y++) for (let x = 0; x < 16; x++) {
      if (!alphaAt(outfit, fx(c, x), fy(r, y))) continue;
      const hex = hexAt(outfit, fx(c, x), fy(r, y));
      if (SHOEK.includes(hex)) fill.push([x, y]);
      else if (OUTLINES.has(hex) && y === a.bottom) putHex(out, fx(c, x), fy(r, y), ACC[0]);
    }
    for (const [x, y] of fill) putHex(out, fx(c, x), fy(r, y), SKIN[2]);
    // strap: per foot (run of fill pixels in the row), the pixel closest to the body centre
    const byRow = new Map();
    for (const [x, y] of fill) byRow.set(y, [...(byRow.get(y) ?? []), x]);
    for (const [y, xs] of byRow) {
      xs.sort((p, q) => p - q);
      const runs = [];
      for (const x of xs) {
        const last = runs[runs.length - 1];
        if (last && x === last[last.length - 1] + 1) last.push(x);
        else runs.push([x]);
      }
      for (const run of runs) {
        const mid = (a.hx0 + a.hx1) / 2;
        const px = run.reduce((best, x) => (Math.abs(x - mid) < Math.abs(best - mid) ? x : best), run[0]);
        if (y === a.bottom - 1 || runs.length === 1) putHex(out, fx(c, px), fy(r, y), ACC[1]);
      }
    }
  }
  return out;
}

const stamp = (set, rows = new Set([0, 1, 2, 3, 4, 5, 6, 7])) => (an) => stampSet(emptySheet(), set, an, 'body', { rows });

/** Layers authored from ASCII (the `_u` under-body and `_o` over-body halves). */
const ART = {
  mochila_u: {
    S: PA({ 25: [1, 'obbbbbbbbbbbbo'], 26: [1, 'obcbbbbbbbbbao'], 27: [1, 'obcbbbbbbbbbao'], 28: [2, 'oaaaaaaaaaao'], 29: [3, 'oooooooooo'] }),
    E: PA({ 23: [1, 'ooooo'], 24: [0, 'obccbo'], 25: [0, 'obbbbo'], 26: [0, 'obbbbo'], 27: [0, 'oaaaao'], 28: [1, 'oooooo'] }),
  },
  mochila_o: {
    S: PA({ 23: [4, 'b......b'], 24: [4, 'b......b'], 25: [4, 'b......b'], 26: [4, 'a......a'] }),
    E: PA({ 24: [5, 'b'], 25: [5, 'b'], 26: [5, 'b'], 27: [5, 'a'] }),
    N: PA({ 23: [3, 'oooooooooo'], 24: [3, 'obccbbbbbo'], 25: [3, 'obcbbbbbbo'], 26: [3, 'obbbbbbbbo'], 27: [3, 'oaaaaaaaao'], 28: [4, 'oooooooo'] }),
  },
  caixa_u: {
    S: PA(boxSpec(1, 21, 14, 9, { band: 5 })),
    E: PA(boxSpec(0, 21, 7, 9, { band: 5 })),
  },
  caixa_o: {
    N: PA(boxSpec(1, 22, 14, 8, { band: 5 })),
  },
  sacola_o: {
    S: PA({ 24: [10, 'bb'], 25: [8, 'bb'], 26: [6, 'bb'], 27: [4, 'bb'], 28: [1, 'obbo'], 29: [1, 'ocbo'], 30: [1, 'obbo'] }),
    E: PA({ 24: [5, 'b'], 25: [6, 'b'], 26: [7, 'b'], 27: [9, 'obbo'], 28: [9, 'ocbo'], 29: [9, 'obbo'], 30: [10, 'oo'] }),
    N: PA({ 24: [4, 'bb'], 25: [6, 'bb'], 26: [8, 'bb'], 27: [10, 'bb'], 28: [12, 'obbo'], 29: [12, 'ocbo'], 30: [12, 'obbo'] }),
  },
  carrinho_o: {
    S: PA({ 20: [14, 'L'], 21: [14, 'L'], 22: [14, 'L'], 23: [14, 'L'], 24: [12, 'oooo'], 25: [12, 'ocbo'], 26: [12, 'obbo'], 27: [12, 'oabo'], 28: [12, 'obbo'], 29: [12, 'oooo'], 30: [12, 'K..K'] }),
    N: PA({ 20: [13, 'L'], 21: [13, 'L'], 22: [13, 'L'], 23: [13, 'L'], 24: [12, 'oooo'], 25: [12, 'ocbo'], 26: [12, 'obbo'], 27: [12, 'oabo'], 28: [12, 'obbo'], 29: [12, 'oooo'], 30: [12, 'K..K'] }),
  },
  carrinho_u: {
    E: PA({ 21: [5, 'L'], 22: [4, 'L'], 23: [3, 'L'], 24: [0, 'ooooo'], 25: [0, 'ocbbo'], 26: [0, 'obbbo'], 27: [0, 'obbbo'], 28: [0, 'oabbo'], 29: [0, 'ooooo'], 30: [1, 'K..K'] }),
  },
};

export function buildGarbs({ layers, an, regBody }) {
  regBody('garb_jersey', jersey(layers.outfit_camiseta_calca, an));
  regBody('garb_jaqueta', jaqueta(layers.outfit_moletom_calca, an));
  regBody('garb_macacao', macacao(layers.outfit_camiseta_calca, an));
  regBody('garb_chinelo', chinelo(layers.outfit_camiseta_calca, an));
  for (const [key, set] of Object.entries(ART)) regBody('garb_' + key, stamp(set)(an));
}
