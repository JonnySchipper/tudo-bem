// Tiny pixel drawing helpers for hand-authored pieces (no anti-aliasing, palette colors only).
import { blank, setPx, hexPx, px } from '../../../../scripts/lib/pixel/img.mjs';

export { blank };

export const C = {
  // LimeZu outline navy + lavender greys
  navy: '#3a3a50', navy2: '#46465e', slate: '#565972', slate2: '#6c6e85', mist: '#8b8bab', mist2: '#a2a6be', lav: '#b2aecb', lav2: '#c6bdd5', lav3: '#d8d0e0', lav4: '#ebe4f2', white: '#f8f8f8',
  // greens (teal-ish family from the exteriors palette)
  teal0: '#2a575b', teal1: '#2e7177', teal2: '#367f82', teal3: '#49928f', teal4: '#539b8f', teal5: '#5ea592',
  sp0: '#32675a', sp1: '#46756a', sp2: '#588278', sp3: '#689183',
  // yellow / orange ramp
  y0: '#fff59a', y1: '#ffe57b', y2: '#f8d239', y3: '#f2b22b', y4: '#ed931e', y5: '#66451e', y6: '#381a08',
  // reds
  r0: '#ff8575', r1: '#fc5c46', r2: '#e63f38', r3: '#d93232', r4: '#cb2a2a', r5: '#a82b2d', r6: '#9e2b2d',
  // pinks
  p0: '#ffa0a0', p1: '#e07070', p2: '#d56868', p3: '#b95d72',
  // blues
  b0: '#95e3e3', b1: '#50a7e8', b2: '#4995e3', b3: '#4280dd', b4: '#3d56d2',
  // wood
  w0: '#f2bd7a', w1: '#daa463', w2: '#c78c59', w3: '#a9764f', w4: '#916e41', w5: '#6b4c2c', w6: '#573c2c',
  // creams
  cr0: '#f0efde', cr1: '#eee1b7', cr2: '#e0d0b2', cr3: '#d0be9c',
  // greens for leaves
  g0: '#b8d040', g1: '#9bc246', g2: '#64b63b', g3: '#568d61',
};

export function rect(img, x, y, w, h, hex) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(img, xx, yy, hexPx(hex));
}
export const hline = (img, x, y, w, hex) => rect(img, x, y, w, 1, hex);
export const vline = (img, x, y, h, hex) => rect(img, x, y, 1, h, hex);
export const dot = (img, x, y, hex) => setPx(img, x, y, hexPx(hex));

/** Box with a 1px outline. Fill may be null. */
export function box(img, x, y, w, h, fill, outline = C.navy) {
  if (fill) rect(img, x + 1, y + 1, w - 2, h - 2, fill);
  hline(img, x, y, w, outline); hline(img, x, y + h - 1, w, outline);
  vline(img, x, y, h, outline); vline(img, x + w - 1, y, h, outline);
}

/** Draws the 1px navy outline around every opaque region of the image (only into transparent pixels, 4-neighborhood). */
export function outlineAround(img, hex = C.navy) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = px(img, x, y);
    if (p && p[3] > 0) continue;
    const n = [px(img, x - 1, y), px(img, x + 1, y), px(img, x, y - 1), px(img, x, y + 1)];
    if (n.some((q) => q && q[3] > 0)) setPx(out, x, y, hexPx(hex));
  }
  for (let i = 0; i < img.data.length; i += 4) if (out.data[i + 3]) { img.data[i] = out.data[i]; img.data[i + 1] = out.data[i + 1]; img.data[i + 2] = out.data[i + 2]; img.data[i + 3] = 255; }
  return img;
}

/** 4x5 pixel font for short signs (uppercase only). */
export const FONT4 = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  '.': ['.', '.', '.', '.', '#'],
  ' ': ['..', '..', '..', '..', '..'],
};
export function text(img, x, y, str, hex) {
  let cx = x;
  for (const ch of str) {
    const g = FONT4[ch];
    if (!g) throw new Error('font: missing ' + ch);
    g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') dot(img, cx + rx, y + ry, hex); });
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
export const textWidth = (str) => [...str].reduce((w, ch) => w + (FONT4[ch]?.[0].length ?? 4) + 1, -1);

/** 3x5 pixel font for shop plaques (uppercase, only the letters the Vila Ipê signs need). */
export const FONT3 = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  ' ': ['.', '.', '.', '.', '.'],
};
export const text3Width = (str) => [...str].reduce((w, ch) => w + (FONT3[ch]?.[0].length ?? 3) + 1, -1);
export function text3(img, x, y, str, hex, shadowHex = null) {
  let cx = x;
  for (const ch of str) {
    const g = FONT3[ch];
    if (!g) throw new Error('font3: missing ' + ch);
    if (shadowHex) g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') dot(img, cx + rx, y + ry + 1, shadowHex); });
    g.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') dot(img, cx + rx, y + ry, hex); });
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
