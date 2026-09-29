// 5x7 pixel capitals (and digits) for the big facade signs, plus a tiny 3x5 digit set. Only the glyphs the Vila Ipê signs need.
// Accented capitals are drawn by the caller (acute / circumflex two rows above the cap height).
import { setPx, hexPx } from '../../../../scripts/lib/pixel/img.mjs';
import { FONT3 } from './draw.mjs';

export const F5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
};

/** Pixel width of `str` set in F5 (1 px between glyphs, `gap` for spaces). */
export const width5 = (str, spacing = 1) => [...str].reduce((w, ch) => w + (F5[ch]?.[0].length ?? 5) + spacing, -spacing);

/**
 * Draws `str` in F5 at (x, y) (top-left of the cap height). `accents` = [{ at: charIndex, kind: 'acute' | 'circ' }] draws a mark 2 rows above.
 * `shadow` = optional color for a 1 px drop shadow (down-right, matches the light from the upper left).
 */
export function drawText5(img, x, y, str, hex, opts = {}) {
  const { shadow = null, spacing = 1, accents = [] } = opts;
  let cx = x;
  const glyphX = [];
  for (const ch of str) {
    const g = F5[ch];
    if (!g) throw new Error('font5: missing ' + ch);
    glyphX.push(cx);
    for (const pass of shadow ? [1, 0] : [0]) {
      g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') setPx(img, cx + rx + pass, y + ry + pass, hexPx(pass ? shadow : hex)); });
    }
    cx += g[0].length + spacing;
  }
  for (const a of accents) {
    const gx = glyphX[a.at] + 1;
    const pts = a.kind === 'acute' ? [[3, -2], [2, -1]] : [[1, -1], [2, -2], [3, -1]];
    for (const [dx, dy] of pts) setPx(img, gx + dx, y + dy, hexPx(hex));
  }
  return cx - x - spacing;
}

// 3x5 extras (digits, the º of "Nº") so small plaques can carry a house number; letters come from FONT3 in draw.mjs.
export const F3 = {
  ...FONT3,
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  'º': ['##', '##', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '#'],
  ' ': ['.', '.', '.', '.', '.'],
};
export const width3 = (str) => [...str].reduce((w, ch) => w + (F3[ch]?.[0].length ?? 3) + 1, -1);
export function drawText3(img, x, y, str, hex, shadowHex = null) {
  let cx = x;
  for (const ch of str) {
    const g = F3[ch];
    if (!g) throw new Error('font3: missing ' + ch);
    if (shadowHex) g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') setPx(img, cx + rx, y + ry + 1, hexPx(shadowHex)); });
    g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') setPx(img, cx + rx, y + ry, hexPx(hex)); });
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
