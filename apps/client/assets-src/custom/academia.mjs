// Academia do Bairro (10x6 facade): the LimeZu ochre/blue market front (cut, widened, awnings turned blue) with a navy sign board,
// big gym windows (dumbbells, a punching bag, a treadmill) and a lit-window overlay. Authored details use the pack palette only.
import { blank, clone, paste, crop, setPx, hexPx, px, C, K, rect, hline, vline, dot, box, drawShaded, newMask, fillMask, ellipse, union, rectP, swap, stretchCols } from './kit.mjs';
import { drawText5, width5, drawText3, width3 } from './font5.mjs';
import { findGlass } from './shop.mjs';
import { stackRows, fillFromBand, litOverlay } from './facades.mjs';

const MARKETS = 'ext:ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_16x16.png';

function dumbbell(img, x, y, night) {
  const bar = night ? C.y4 : C.slate2, plate = night ? K.br2 : C.navy2, hi = night ? C.y3 : C.mist;
  hline(img, x + 2, y + 2, 6, bar);
  rect(img, x, y, 2, 5, plate); rect(img, x + 8, y, 2, 5, plate);
  dot(img, x, y, hi); dot(img, x + 8, y, hi);
}

/** The inside of a gym window: floor line, a rack of dumbbells, a punching bag, a treadmill. */
function gymWindow(img, [x, y, w, h], night = false) {
  const dark = night ? K.br2 : C.navy2, mid = night ? C.y4 : C.slate2, light = night ? C.y3 : C.mist;
  // floor + skirting
  hline(img, x, y + h - 3, w, dark); hline(img, x, y + h - 2, w, mid);
  // rack with two rows of dumbbells (left)
  hline(img, x + 3, y + h - 12, 26, dark); hline(img, x + 3, y + h - 8, 26, dark);
  vline(img, x + 3, y + h - 12, 9, dark); vline(img, x + 28, y + h - 12, 9, dark);
  for (let i = 0; i < 2; i++) { dumbbell(img, x + 5 + i * 11, y + h - 18 + 0, night); dumbbell(img, x + 5 + i * 11, y + h - 12 + 3, night); }
  // punching bag (middle): a chain and a red cylinder
  const bx = x + Math.floor(w / 2) + 2;
  vline(img, bx + 2, y, 4, dark);
  const bag = newMask(5, 10); fillMask(bag, rectP(0, 0, 5, 9));
  drawShaded(img, bag, bx, y + 4, night ? [C.r6, C.r5, C.r4, C.r3] : [C.r5, C.r3, C.r2, C.r1], { rimShade: 1, ol: dark });
  hline(img, bx, y + 8, 5, night ? K.br2 : C.y3);
  // treadmill (right): a slanted belt and a console
  if (w > 40) {
    const tx = x + w - 20;
    for (let i = 0; i < 14; i++) dot(img, tx + i, y + h - 6 - Math.floor(i / 4), mid);
    for (let i = 0; i < 14; i++) dot(img, tx + i, y + h - 5 - Math.floor(i / 4), dark);
    vline(img, tx + 13, y + h - 14, 8, dark);
    rect(img, tx + 10, y + h - 15, 5, 3, dark); hline(img, tx + 10, y + h - 15, 5, light);
    dot(img, tx, y + h - 4, dark);
  }
}

export async function academia(ctx) {
  const sheet = await ctx.load(MARKETS);
  let b = crop(sheet, 240, 549, 112, 139);
  fillFromBand(b, 30, 70, 52, 27, 14, 16);
  // toldo: orange / cream -> blue / white
  const awn = { '#ed931e': C.b3, '#f2b22b': C.b4, '#ddc7c9': C.cr0, '#eed3d5': C.lav4, '#f8e3e3': C.white, '#d4bec2': C.lav3, '#9d7c5b': C.b4 };
  b = swap(b, awn, [4, 92, 37, 18]);
  b = swap(b, awn, [72, 92, 36, 18]);
  // widen the two window bays by 24 px each (stripe period 4)
  b = stretchCols(b, 88, 96, b.w + 24);
  b = stretchCols(b, 16, 24, b.w + 24);
  b = stackRows(b, [[0, 20], [63, 139]]);
  const glass = findGlass(b).filter((r) => r[1] > 50);
  // continuous toldo across the door: tile the band from the left awning
  const ay0 = 94 - 43, ah = 14;
  const awnBand = crop(b, 8, ay0, 40, ah);
  const rightStart = b.w - 112 + 72 + 8; // first x of the right awning after widening (see padaria)
  for (let x = 64; x < 98; x++) {
    for (let y = 0; y < ah; y++) { const p = px(awnBand, 8 + ((x - 98 + 32) % 32), y); if (p && p[3]) setPx(b, x, ay0 + y, p); }
  }
  // sign board: navy with mustard trim
  const bw = 100, bh = 26, bx = Math.floor((b.w - bw) / 2), by = 9;
  rect(b, bx, by, bw, bh, C.navy);
  rect(b, bx + 1, by + 1, bw - 2, bh - 2, C.slate);
  hline(b, bx + 1, by + 1, bw - 2, C.slate2); vline(b, bx + 1, by + 1, bh - 2, C.slate2);
  hline(b, bx + 1, by + bh - 2, bw - 2, C.navy2);
  box(b, bx + 3, by + 3, bw - 6, bh - 6, null, C.y3);
  const tw = width5('ACADEMIA');
  drawText5(b, bx + Math.floor((bw - tw) / 2), by + 6, 'ACADEMIA', C.y1, { shadow: C.navy });
  const sub = 'DO BAIRRO';
  drawText3(b, bx + Math.floor((bw - width3(sub)) / 2), by + 16, sub, C.cr0);
  // dumbbells on both ends of the board
  for (const dx of [bx + 6, bx + bw - 16]) { dumbbell(b, dx, by + 11, false); }
  // windows
  const panes = glass.filter((r) => r[2] > 20);
  const lit = litOverlay(b.w, b.h, glass);
  for (const p of panes) { gymWindow(b, p); gymWindow(lit, p, true); }
  const meta = { footprint: [10, 6], shadow: null, cast: { kx: 0.3, ky: 0.16, rgba: [26, 16, 48, 84] } };
  return [
    { img: b, anchor: [Math.floor(b.w / 2), 95], meta: { ...meta, windows: glass, lit: 'facades/academia_lit' } },
    { key: 'facades/academia_lit', img: lit, anchor: [Math.floor(b.w / 2), 95], meta: { footprint: [10, 6], shadow: null } },
  ];
}
