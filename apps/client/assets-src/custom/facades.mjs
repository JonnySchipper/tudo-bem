// Facades for Vila Ipê (art1): Padaria do Seu Carlos (8x6), Edifício Ipê Nº 42 (10x6), Academia do Bairro (10x6).
// They are kit-bashed from LimeZu building modules (Modern Exteriors: shopping-center markets, generic buildings): the wall,
// plinth, windows and doors are the pack's pixels, cut and widened along plain bands; the toldo, signs, bread, window grilles,
// laundry lines, water tank, gym silhouettes and the lit-window overlays are authored here in the pack palette.
import { blank, clone, paste, crop, setPx, hexPx, px, C, K, rect, hline, vline, dot, box, drawShaded, newMask, fillMask, ellipse, union, rectP, swap, outlineAround, stretchCols, hexAt, bbox } from './kit.mjs';
import { drawText5, width5 } from './font5.mjs';
import { text3, text3Width } from './draw.mjs';
import { findGlass } from './shop.mjs';

const MARKETS = 'ext:ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_16x16.png';
const GENERIC = 'ext:ME_Theme_Sorter_16x16/4_Generic_Buildings_16x16.png';

/** Stacks row ranges [y0, y1) of `src` into a new image (all with the same width). */
export function stackRows(src, ranges) {
  const H = ranges.reduce((n, [a, b]) => n + (b - a), 0);
  const out = blank(src.w, H);
  let y = 0;
  for (const [a, b] of ranges) { paste(out, crop(src, 0, a, src.w, b - a), 0, y); y += b - a; }
  return out;
}

/** Repeats the band [x0, x1) of `img` `times` times right where it is (widens by (x1 - x0) * times). */
function widen(img, x0, x1, extra) {
  return stretchCols(img, x0, x1, img.w + extra);
}

/** Fills rect (x, y, w, h) with the columns [sx, sx + pw) of the same rows, repeated (used to erase the pack's plates). */
export function fillFromBand(img, x, y, w, h, sx, pw) {
  const src = clone(img);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const p = px(src, sx + ((xx - x) % pw), yy);
    if (p) setPx(img, xx, yy, p);
  }
}

/** Lit-window overlay: an image the size of the facade with only the window panes drawn in warm light (plus a hint of furniture). */
export function litOverlay(w, h, rects, style = {}) {
  const o = blank(w, h);
  for (const [x, y, rw, rh] of rects) {
    rect(o, x, y, rw, rh, style.base ?? C.y1);
    // warm gradient: brighter at the top-left, amber toward the bottom-right
    for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) {
      const t = (xx / rw + yy / rh) / 2;
      setPx(o, x + xx, y + yy, hexPx(t < 0.3 ? C.y0 : t < 0.62 ? C.y1 : t < 0.85 ? C.y2 : C.y3));
    }
    // a silhouette in the window: lamp/curtain pole at the top, a table edge at the bottom
    hline(o, x, y + rh - 2, rw, C.y4);
    if (style.curtains) { vline(o, x, y, rh, C.r4); vline(o, x + rw - 1, y, rh, C.r4); }
  }
  return o;
}

// ------------------------------------------------------------------ bread (shared by the padaria window and its lit overlay)
export function loaf(kind, night = false) {
  const ramp = night ? [C.w4, C.w3, C.w2, C.w1] : [C.w3, C.w2, C.w1, C.w0];
  if (kind === 'roll') {
    const img = blank(8, 6); const m = newMask(6, 4); fillMask(m, ellipse(3, 2, 3, 2));
    drawShaded(img, m, 1, 1, ramp, { rimShade: 1, ol: K.br3 });
    dot(img, 3, 2, C.cr1); dot(img, 4, 2, C.cr1);
    return img;
  }
  if (kind === 'baguette') {
    const img = blank(3, 12);
    for (let y = 0; y < 12; y++) { setPx(img, 1, y, hexPx(ramp[2])); setPx(img, 0, y, hexPx(ramp[3])); setPx(img, 2, y, hexPx(ramp[0])); }
    setPx(img, 1, 0, hexPx(K.br3)); setPx(img, 1, 11, hexPx(K.br3));
    for (const y of [2, 5, 8]) setPx(img, 1, y, hexPx(C.cr1));
    return img;
  }
  // big round loaf
  const img = blank(12, 8); const m = newMask(10, 6); fillMask(m, ellipse(5, 3, 5, 3));
  drawShaded(img, m, 1, 1, ramp, { rimShade: 1, ol: K.br3 });
  for (const [x, y] of [[4, 3], [6, 2], [8, 3]]) dot(img, x, y, C.cr1);
  return img;
}

/** A stocked bread window: two shelves in the glass rect (x, y, w, h). */
function stockWindow(img, [x, y, w, h], night = false) {
  const shelf = night ? K.br2 : K.br1;
  const shelfY = [y + Math.floor(h * 0.48), y + h - 3];
  for (const sy of shelfY) { hline(img, x, sy, w, shelf); hline(img, x, sy + 1, w, night ? K.br3 : K.br2); }
  // top shelf: rolls + baguettes leaning at the sides
  paste(img, loaf('baguette', night), x + 2, shelfY[0] - 11);
  for (let i = 0; i < Math.floor((w - 12) / 8); i++) paste(img, loaf('roll', night), x + 6 + i * 8, shelfY[0] - 5);
  paste(img, loaf('baguette', night), x + w - 5, shelfY[0] - 11);
  // bottom shelf: round loaves
  for (let i = 0; i < Math.floor((w - 2) / 13); i++) paste(img, loaf('round', night), x + 2 + i * 13, shelfY[1] - 7);
}

// ------------------------------------------------------------------ Padaria do Seu Carlos
export async function padaria(ctx) {
  const sheet = await ctx.load(MARKETS);
  let b = crop(sheet, 0, 901, 112, 139);
  // the pack's "MARKET" plate goes away (replaced by our own sign below); take the fill from a clean band of wall
  fillFromBand(b, 30, 70, 52, 27, 14, 16);
  // red / white toldo: recolor the maroon + pink awning pixels (only the two awnings, not the door frame)
  const awn = { '#7f4d56': C.r3, '#67575c': C.r5, '#916662': C.r4, '#83515a': C.r4, '#ddc7c9': C.cr0, '#eed3d5': C.lav4, '#f8e3e3': C.white, '#d4bec2': C.lav3, '#716467': C.r6 };
  b = swap(b, awn, [4, 94, 37, 14]);
  b = swap(b, awn, [72, 94, 36, 14]);
  // widen: +8 in each window (stripe period is 4 px, so a band of 8 keeps the stripes in phase)
  b = stretchCols(b, 88, 96, b.w + 8);
  b = stretchCols(b, 16, 24, b.w + 8);
  // 128 x 96: cut 41 rows out of the blank wall so the shopfront keeps its size
  b = stackRows(b, [[0, 20], [63, 139]]);
  // glass panes (before we draw over them)
  const glass = findGlass(b).filter((r) => r[1] > 50);
  // continuous toldo: copy the awning band across the door
  const ay0 = 94 - 43, ah = 14;
  const awnBand = crop(b, 8, ay0, 40, ah);
  for (let x = 48; x < 82; x++) {
    for (let y = 0; y < ah; y++) { const p = px(awnBand, 8 + ((x - 50 + 32) % 32), y); if (p && p[3]) setPx(b, x, ay0 + y, p); }
  }
  // sign board on the wall panel: terracotta-red board, mustard trim, cream letters
  const bx = 22, by = 11, bw = 84, bh = 22;
  rect(b, bx, by, bw, bh, C.r5);
  rect(b, bx + 1, by + 1, bw - 2, bh - 2, C.r3);
  hline(b, bx + 1, by + 1, bw - 2, C.r1); vline(b, bx + 1, by + 1, bh - 2, C.r2);
  hline(b, bx + 1, by + bh - 2, bw - 2, C.r5);
  for (let x = bx + 3; x < bx + bw - 3; x += 4) { dot(b, x, by + 3, C.y3); }
  box(b, bx, by, bw, bh, null, C.navy);
  const tw = width5('PADARIA');
  drawText5(b, bx + Math.floor((bw - tw) / 2), by + 5, 'PADARIA', C.cr0, { shadow: C.r6 });
  const sub = 'DO SEU CARLOS';
  text3(b, bx + Math.floor((bw - text3Width(sub)) / 2), by + 14, sub, C.y1);
  // little loaves on both ends of the board
  for (const lx of [bx + 6, bx + bw - 15]) paste(b, loaf('round'), lx, by + 7);
  // stocked windows
  const panes = glass.filter((r) => r[2] > 20);
  for (const p of panes) stockWindow(b, p);
  const lit = litOverlay(b.w, b.h, glass);
  for (const p of panes) stockWindow(lit, p, true);
  const meta = { footprint: [8, 6], shadow: null, cast: { kx: 0.3, ky: 0.16, rgba: [26, 16, 48, 84] } };
  return [
    { img: b, anchor: [64, 95], meta: { ...meta, windows: glass, lit: 'facades/padaria_lit' } },
    { key: 'facades/padaria_lit', img: lit, anchor: [64, 95], meta: { footprint: [8, 6], shadow: null } },
  ];
}
