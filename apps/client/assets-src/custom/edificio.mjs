// Edifício Ipê Nº 42 (10x6 facade + a rooftop that pokes above the 6 tiles): LimeZu "Generic Building" yellow apartment modules
// (two 48 px door modules + two 32 px window modules), with window grilles, laundry lines (varal), a caixa d'água on the roof,
// a number plaque and a lit-window overlay authored here in the pack palette.
import { blank, clone, paste, crop, setPx, hexPx, px, C, K, rect, hline, vline, dot, box, drawShaded, newMask, fillMask, ellipse, union, rectP, outlineAround, hexAt, rng } from './kit.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';
import { drawText3, width3 } from './font5.mjs';
import { findGlass } from './shop.mjs';
import { stackRows, litOverlay } from './facades.mjs';

const GENERIC = 'ext:ME_Theme_Sorter_16x16/4_Generic_Buildings_16x16.png';
export const ROOF = 28; // extra rows above the 6-tile body (tank, antenna)

/** One column module of the source building as rows [y0, y1) stacked. */
function module(sheet, x, w, rows) {
  return stackRows(crop(sheet, x, 0, w, sheet.h), rows);
}

/** Window grille (grade): dark bars over the glass, every third column plus a rail. */
function grille(img, [x, y, w, h]) {
  for (let xx = x + 1; xx < x + w - 1; xx += 3) vline(img, xx, y, h, C.navy2);
  hline(img, x, y + Math.floor(h / 2), w, C.navy2);
  hline(img, x, y + h - 1, w, C.navy2);
}

/** Water tank: a blue cylinder with a lid, lit from the upper left, standing on a small plinth. 24 wide x 26 tall. */
function tank() {
  const img = blank(24, 28);
  // plinth + pipe
  rect(img, 4, 24, 16, 3, C.slate); hline(img, 4, 24, 16, C.slate2); hline(img, 4, 26, 16, C.navy2);
  // body
  const m = newMask(22, 24);
  fillMask(m, union(rectP(1, 5, 21, 21), ellipse(11, 5.5, 10, 3.2), ellipse(11, 20.6, 10, 3.2)));
  drawShaded(img, m, 1, 1, [C.b4, C.b3, C.b2, C.b0], { rimLit: 2, rimShade: 3 });
  // ribs
  for (const y of [11, 17]) { for (let x = 2; x < 22; x++) { const p = px(img, x, y); if (p && p[3]) setPx(img, x, y, hexPx(x < 9 ? C.b3 : C.b4)); } }
  // lid
  const lid = newMask(8, 4); fillMask(lid, ellipse(4, 2.2, 4, 2));
  drawShaded(img, lid, 8, 0, [C.mist, C.lav2, C.lav3, C.lav4], { rimShade: 1, ol: C.navy });
  dot(img, 11, 2, C.slate);
  return img;
}

/** Roof extras: caixa d'água on the left, a TV antenna on the right. */
function roofDeco(w) {
  const img = blank(w, ROOF);
  paste(img, tank(), 18, 0);
  // antenna: mast + crossbars
  vline(img, w - 26, 4, 24, C.slate2); vline(img, w - 25, 4, 24, C.slate);
  for (const [y, len] of [[6, 8], [10, 10], [14, 8]]) { hline(img, w - 26 - Math.floor(len / 2), y, len, C.mist2); hline(img, w - 26 - Math.floor(len / 2), y + 1, len, C.slate); }
  // satellite dish (parabolica)
  const dish = newMask(9, 7); fillMask(dish, ellipse(4.5, 3.5, 4.4, 3.2));
  drawShaded(img, dish, w - 46, 16, [C.mist, C.lav2, C.lav3, C.lav4], { rimShade: 2 });
  dot(img, w - 42, 19, C.slate);
  vline(img, w - 42, 22, 5, C.slate);
  outlineAround(img);
  return img;
}

/** Laundry line (varal): a sagging string with hanging garments. */
function varal(img, x0, x1, y, seed, colors) {
  const r = rng(seed);
  const L = x1 - x0;
  const sagAt = (t) => Math.round(2.5 * 4 * t * (1 - t));
  for (let x = x0; x <= x1; x++) dot(img, x, y + sagAt((x - x0) / L), C.mist2);
  dot(img, x0, y - 1, C.slate); dot(img, x1, y - 1, C.slate);
  let cx = x0 + 3;
  while (cx < x1 - 5) {
    const kind = Math.floor(r() * 3);
    const col = colors[Math.floor(r() * colors.length)];
    const yy = y + sagAt((cx - x0) / L) + 1;
    if (kind === 0) { // t-shirt
      rect(img, cx, yy, 5, 5, col[0]); rect(img, cx - 1, yy, 1, 2, col[0]); rect(img, cx + 5, yy, 1, 2, col[0]); hline(img, cx, yy, 5, col[1]); vline(img, cx + 4, yy + 1, 4, col[2]);
      cx += 8;
    } else if (kind === 1) { // towel
      rect(img, cx, yy, 4, 7, col[0]); hline(img, cx, yy + 2, 4, col[1]); vline(img, cx + 3, yy, 7, col[2]); hline(img, cx, yy + 6, 4, col[2]);
      cx += 7;
    } else { // shorts
      rect(img, cx, yy, 5, 3, col[0]); rect(img, cx, yy + 3, 2, 2, col[0]); rect(img, cx + 3, yy + 3, 2, 2, col[0]); hline(img, cx, yy, 5, col[1]);
      cx += 7;
    }
  }
}

export async function edificio(ctx) {
  const sheet = await ctx.load(GENERIC);
  // module x ranges in the sheet: door module (0..48, 48..96) and 32 px window module (112..144)
  const rows = [[76, 91], [91, 122], [158, 168], [168, 208]]; // cornice, one floor of windows, band, ground floor
  const L1 = module(sheet, 0, 48, rows), L2 = module(sheet, 48, 48, rows), M = module(sheet, 112, 32, rows);
  const body = blank(160, 96);
  paste(body, L1, 0, 0); paste(body, M, 48, 0); paste(body, M, 80, 0); paste(body, L2, 112, 0);
  // right end: mirror the left border (first 6 columns of the first module)
  paste(body, flipH(crop(L1, 0, 0, 6, 96)), 154, 0);
  hline(body, 0, 0, 160, C.navy);
  const glass = findGlass(body);
  // second door -> roller shutter (garage)
  const gx = 112 + 13, gy = 96 - 40 + 5;
  rect(body, gx - 2, gy, 28, 34, C.navy);
  for (let y = 0; y < 32; y += 2) { hline(body, gx - 1, gy + 1 + y, 26, y % 4 === 0 ? C.mist : C.mist2); hline(body, gx - 1, gy + 2 + y, 26, C.slate2); }
  hline(body, gx - 2, gy, 28, C.navy2);
  // grilles on every window
  for (const g of glass) grille(body, g);
  // plaque above the door: EDIFICIO IPE / Nº 42 (small, brass on the dark band)
  const px0 = 12, py0 = 61;
  rect(body, px0, py0, 24, 8, K.br1); hline(body, px0, py0, 24, C.y3); hline(body, px0, py0 + 7, 24, K.br3); box(body, px0, py0, 24, 8, null, C.navy);
  drawText3(body, px0 + 3, py0 + 2, 'Nº 42', C.y1);
  // varal across the upper floor between the two middle windows
  varal(body, 52, 108, 25, 42, [[C.r3, C.r1, C.r5], [C.b2, C.b1, C.b3], [C.lav3, C.lav4, C.lav2], [C.y3, C.y1, C.y4], [C.g2, C.g1, C.g3]]);
  // assemble with the roof zone on top
  const img = blank(160, 96 + ROOF);
  paste(img, roofDeco(160), 0, 0);
  paste(img, body, 0, ROOF);
  // building name over the entrance, painted on the cornice
  drawText3(img, 6, ROOF + 4, 'EDIFICIO IPE', K.te0, K.te5);
  const winRects = glass.map(([x, y, w, h]) => [x, y + ROOF, w, h]);
  // lit variant: most windows lit, a few dark, curtains on some
  const lit = litOverlay(160, 96 + ROOF, winRects.filter((_, i) => i % 5 !== 3), { curtains: true });
  const meta = { footprint: [10, 6], shadow: null, cast: { kx: 0.3, ky: 0.16, rgba: [26, 16, 48, 84] } };
  return [
    { img, anchor: [80, ROOF + 95], meta: { ...meta, windows: winRects, lit: 'facades/edificio_ipe_lit' } },
    { key: 'facades/edificio_ipe_lit', img: lit, anchor: [80, ROOF + 95], meta: { footprint: [10, 6], shadow: null } },
  ];
}
