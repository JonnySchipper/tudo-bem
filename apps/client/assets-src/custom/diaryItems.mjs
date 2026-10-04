// Language diary: the small objects the camera finds, and the signs the player reads. Authored here, no pack art (the LimeZu packs have
// almost none of this at 16 px). Items are ASCII grids (see diary/*.mjs) with a palette of one letter per colour; the 1 px navy
// outline is added around every shape. Signs are painted from a 3x5 pixel font. Keys are `diary/<id>` (items) and `diary/sign_<id>`.
import { blank, setPx, hexPx } from '../../../../scripts/lib/pixel/img.mjs';
import { outlineAround } from './draw.mjs';
import { PRACA } from './diary/praca.mjs';
import { RUA } from './diary/rua.mjs';
import { PADARIA } from './diary/padaria.mjs';
import { FEIRA } from './diary/feira.mjs';
import { KITNET } from './diary/kitnet.mjs';
import { ACADEMIA } from './diary/academia.mjs';
import { ESCOLA } from './diary/escola.mjs';

export const PAL = {
  k: '#3a3a50', d: '#565972', g: '#8b8bab', l: '#c6bdd5', i: '#ebe4f2', w: '#f8f8f8',
  r: '#d93232', R: '#9e2b2d', o: '#ed931e', O: '#b5541b', y: '#f8d239', Y: '#fff59a',
  n: '#a9764f', N: '#6b4c2c', t: '#daa463', T: '#f2bd7a', m: '#8a5a38',
  e: '#64b63b', E: '#32675a', f: '#9bc246',
  b: '#4995e3', B: '#3d56d2', c: '#95e3e3', u: '#50a7e8',
  p: '#e07070', P: '#b95d72', v: '#8a6bbf', V: '#5e4a96', s: '#f0c8a0', S: '#c98f6a',
};

export const ITEMS = { ...PRACA, ...RUA, ...PADARIA, ...FEIRA, ...KITNET, ...ACADEMIA, ...ESCOLA };

/** One sprite from its grid: 1 px of padding all round for the navy outline. Anchor is the bottom centre of the art. */
export function diaryItem({ id }) {
  const rows = ITEMS[id];
  if (!rows) throw new Error(`diaryItems: no art for '${id}'`);
  const w = Math.max(...rows.map((r) => r.length));
  const img = blank(w + 2, rows.length + 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const hex = PAL[ch];
      if (!hex) throw new Error(`diaryItems: '${id}' uses unknown colour '${ch}'`);
      setPx(img, x + 1, y + 1, hexPx(hex));
    }
  });
  outlineAround(img);
  return { img, anchor: [Math.floor(img.w / 2), img.h - 1] };
}

/** Size of a sprite in pixels, for the import map (footprint) and the layout pass. */
export function itemSize(id) {
  const rows = ITEMS[id];
  return rows ? { w: Math.max(...rows.map((r) => r.length)) + 2, h: rows.length + 2 } : null;
}

// ---------------------------------------------------------------- signs

const G = (s) => s.split('/');
const FONT = {
  A: G('.#./#.#/###/#.#/#.#'), B: G('##./#.#/##./#.#/##.'), C: G('.##/#../#../#../.##'), D: G('##./#.#/#.#/#.#/##.'),
  E: G('###/#../##./#../###'), F: G('###/#../##./#../#..'), G: G('.##/#../#.#/#.#/.##'), H: G('#.#/#.#/###/#.#/#.#'),
  I: G('###/.#./.#./.#./###'), J: G('..#/..#/..#/#.#/.#.'), K: G('#.#/#.#/##./#.#/#.#'), L: G('#../#../#../#../###'),
  M: G('#.#/###/###/#.#/#.#'), N: G('##./#.#/#.#/#.#/#.#'), O: G('.#./#.#/#.#/#.#/.#.'), P: G('##./#.#/##./#../#..'),
  Q: G('.#./#.#/#.#/##./.##'), R: G('##./#.#/##./#.#/#.#'), S: G('.##/#../.#./..#/##.'), T: G('###/.#./.#./.#./.#.'),
  U: G('#.#/#.#/#.#/#.#/###'), V: G('#.#/#.#/#.#/#.#/.#.'), W: G('#.#/#.#/###/###/#.#'), X: G('#.#/#.#/.#./#.#/#.#'),
  Y: G('#.#/#.#/.#./.#./.#.'), Z: G('###/..#/.#./#../###'),
  0: G('###/#.#/#.#/#.#/###'), 1: G('.#./##./.#./.#./###'), 2: G('##./..#/.#./#../###'), 3: G('##./..#/.#./..#/##.'),
  4: G('#.#/#.#/###/..#/..#'), 5: G('###/#../##./..#/##.'), 6: G('.##/#../###/#.#/###'), 7: G('###/..#/.#./.#./.#.'),
  8: G('###/#.#/###/#.#/###'), 9: G('###/#.#/###/..#/##.'),
  $: G('.##/##./.#./.##/##.'), '/': G('..#/..#/.#./#../#..'), '.': G('.../.../.../.../.#.'), ' ': G('.../.../.../.../...'),
};
const MARK = { '́': 2, '̀': 0, '̂': 1, '̃': 1 };

/** Glyphs of a sign text: [{ rows, mark, cedilla }]. Accents are read from the decomposed letter. */
function glyphs(text) {
  const out = [];
  for (const ch of text.normalize('NFD')) {
    if (ch in MARK && out.length) out[out.length - 1].mark = MARK[ch];
    else if (ch === '̧' && out.length) out[out.length - 1].cedilla = true;
    else {
      const rows = FONT[ch.toUpperCase()];
      if (!rows) throw new Error(`diary sign font: no glyph for '${ch}' in '${text}'`);
      out.push({ rows, mark: null, cedilla: false });
    }
  }
  return out;
}

const textPx = (text) => glyphs(text).length * 4 - 1;
/** Tiles a sign of this text covers (one tile of art is 16 px; the board is the text plus a border). */
export const signTiles = (text) => Math.max(1, Math.ceil((textPx(text) + 4) / 16));

const SIGN_STYLES = {
  white: { bg: '#f8f8f8', ink: '#3a3a50', edge: '#8b8bab' },
  red: { bg: '#d93232', ink: '#f8f8f8', edge: '#9e2b2d' },
  blue: { bg: '#3d56d2', ink: '#f8f8f8', edge: '#2a3a96' },
  green: { bg: '#2e8a55', ink: '#f8f8f8', edge: '#1d5f3a' },
  yellow: { bg: '#f8d239', ink: '#3a3a50', edge: '#b5541b' },
};

/** A sign board, `tiles` wide and one tile tall at most, standing on a short post when it is a single tile. */
export function diarySign({ text, style = 'white' }) {
  const st = SIGN_STYLES[style] ?? SIGN_STYLES.white;
  const gl = glyphs(text);
  const tw = textPx(text);
  const tiles = signTiles(text);
  const w = tiles * 16;
  const h = 12;
  const img = blank(w, h);
  const bw = tw + 4;
  const bx = Math.floor((w - bw) / 2);
  const by = h - 11;
  for (let y = 0; y < 9; y++) for (let x = 0; x < bw; x++) {
    const edge = x === 0 || y === 0 || x === bw - 1 || y === 8;
    setPx(img, bx + x, by + y, hexPx(edge ? st.edge : st.bg));
  }
  let cx = bx + 2;
  for (const g of gl) {
    g.rows.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) if (row[rx] === '#') setPx(img, cx + rx, by + 2 + ry, hexPx(st.ink));
    });
    if (g.mark != null) setPx(img, cx + g.mark, by + 1, hexPx(st.ink));
    if (g.cedilla) setPx(img, cx + 1, by + 7, hexPx(st.ink));
    cx += 4;
  }
  outlineAround(img);
  // a short post under a one-tile sign
  if (tiles === 1) for (let y = by + 10; y < h; y++) setPx(img, Math.floor(w / 2), y, hexPx('#565972'));
  return { img, anchor: [Math.floor(w / 2), h] };
}
