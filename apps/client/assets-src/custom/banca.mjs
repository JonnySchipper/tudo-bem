// Banca de jornal (newsstand), 3x2 tile footprint. Hand-authored with rects and 1px navy outlines, LimeZu palette only.
import { blank, paste } from '../../../../scripts/lib/pixel/img.mjs';
import { C, rect, hline, vline, dot, box, outlineAround, text, textWidth } from './draw.mjs';

export const BANCA = { w: 56, h: 58, ax: 28, ay: 55, footprint: [3, 2] };

function magazine(img, x, y, cover, band) {
  // 4x6 magazine cover, 1px highlight column, a band across the title area
  rect(img, x, y, 4, 6, cover);
  vline(img, x, y, 6, C.lav4);
  hline(img, x + 1, y + 1, 3, band);
  dot(img, x + 2, y + 4, C.navy2);
}

function bottle(img, x, y, body, cap) {
  rect(img, x, y + 1, 3, 5, body);
  dot(img, x + 1, y, cap);
  dot(img, x, y + 2, C.lav4); // glint
}

export function banca() {
  const img = blank(BANCA.w, BANCA.h);

  // ---- body (behind the awning)
  const body = blank(BANCA.w, BANCA.h);
  // back wall / recess
  rect(body, 5, 30, 46, 23, C.navy2);
  // skirt (green panels)
  rect(body, 4, 46, 48, 8, C.sp1);
  hline(body, 4, 46, 48, C.sp3);
  for (let x = 4; x < 52; x += 12) { vline(body, x, 47, 7, C.sp0); }
  hline(body, 4, 53, 48, C.sp0);
  for (let x = 4; x < 52; x += 12) { rect(body, x + 3, 49, 6, 3, C.sp2); hline(body, x + 3, 49, 6, C.sp3); }

  // counter
  rect(body, 3, 41, 50, 5, C.w3);
  hline(body, 3, 41, 50, C.w1);
  hline(body, 3, 42, 50, C.w2);
  hline(body, 3, 45, 50, C.w5);
  // posts (mustard trim) dividing bays
  for (const px of [6, 20, 35, 49]) { rect(body, px, 30, 2, 12, C.y3); vline(body, px, 30, 12, C.y2); }

  // left bay: magazine rack, 3 shelves
  const covers = [[C.r3, C.y2], [C.b2, C.lav4], [C.y2, C.r4], [C.g2, C.lav4], [C.p2, C.lav4], [C.b1, C.y3], [C.lav3, C.r3], [C.y3, C.navy], [C.r2, C.lav4]];
  for (let s = 0; s < 3; s++) {
    const sy = 32 + s * 3;
    rect(body, 8, sy + 6 > 40 ? 40 : sy + 6, 12, 1, C.w4);
  }
  let ci = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const [cv, bd] = covers[ci++ % covers.length];
      magazine(body, 8 + col * 4, 31 + row * 5, cv, bd);
    }
  }
  rect(body, 8, 41 - 1, 12, 1, C.w4);

  // center bay: serving window with hanging papers
  rect(body, 22, 31, 13, 10, C.navy);
  hline(body, 22, 31, 13, C.slate);
  // a vendor silhouette hint (head + shoulders) behind the counter
  rect(body, 26, 34, 5, 4, '#b57972'); // head (skin ramp tone)
  hline(body, 26, 33, 5, '#565972'); // cap
  rect(body, 25, 38, 7, 3, C.r4);
  dot(body, 27, 36, C.navy); dot(body, 29, 36, C.navy);
  // string with clipped newspapers on the left of the window
  hline(body, 22, 32, 13, C.mist);
  rect(body, 22, 33, 3, 4, C.cr1); rect(body, 32, 33, 3, 4, C.lav3);
  dot(body, 23, 34, C.navy2); dot(body, 33, 35, C.navy2);

  // right bay: bottles and snacks on two shelves
  rect(body, 37, 31, 12, 10, C.navy2);
  hline(body, 37, 36, 12, C.w4); hline(body, 37, 41 - 1, 12, C.w4);
  const bs = [[C.b2, C.lav4], [C.g2, C.y2], [C.y3, C.r3], [C.r3, C.lav4]];
  bs.forEach(([b, c], i) => bottle(body, 38 + i * 3, 31, b, c));
  bs.slice().reverse().forEach(([b, c], i) => bottle(body, 38 + i * 3, 36 - 0, b, c));
  // snack boxes on the right end
  rect(body, 47, 32, 2, 3, C.y3); rect(body, 47, 37, 2, 3, C.p2);

  // items on the counter: newspaper stack + flat magazines
  rect(body, 22, 38, 8, 3, C.lav3); hline(body, 22, 38, 8, C.lav4); hline(body, 22, 39, 8, C.mist2); hline(body, 22, 40, 8, C.lav2);
  rect(body, 38, 39, 7, 2, C.cr1); hline(body, 38, 39, 7, C.cr0); dot(body, 41, 40, C.r4);
  rect(body, 10, 40, 6, 1, C.b2); // magazine edge

  outlineAround(body);
  paste(img, body, 0, 0);

  // ---- awning / roof (drawn last, in front)
  const aw = blank(BANCA.w, BANCA.h);
  const stripeA = C.y3, stripeB = C.cr0;
  // roof top plane, 13 rows
  for (let y = 12; y < 25; y++) for (let x = 2; x < 54; x++) {
    const stripe = Math.floor((x - 2) / 4) % 2 === 0;
    let col = stripe ? stripeA : stripeB;
    if (y === 12) col = stripe ? C.y1 : C.lav4; // lit top edge
    if (y >= 22) col = stripe ? C.y4 : C.cr2;    // shaded front lip of the roof
    dot(aw, x, y, col);
  }
  // scalloped valance, each stripe gets a rounded bottom
  for (let s = 0; s < 13; s++) {
    const x0 = 2 + s * 4;
    const stripe = s % 2 === 0;
    const colTop = stripe ? C.y3 : C.cr0;
    const colShade = stripe ? C.y4 : C.cr2;
    rect(aw, x0, 25, 4, 3, colTop);
    hline(aw, x0, 27, 4, colShade);
    hline(aw, x0 + 1, 28, 2, colShade);
  }
  outlineAround(aw);

  // sign plaque on two posts above the roof
  const sign = blank(BANCA.w, BANCA.h);
  rect(sign, 16, 9, 2, 4, C.slate); rect(sign, 38, 9, 2, 4, C.slate);
  box(sign, 12, 0, 32, 11, C.sp1, C.navy);
  hline(sign, 13, 1, 30, C.sp3);
  hline(sign, 13, 9, 30, C.sp0);
  const tw = textWidth('BANCA');
  text(sign, 12 + Math.round((32 - tw) / 2), 3, 'BANCA', C.y1);
  // little mustard rivets
  dot(sign, 14, 2, C.y3); dot(sign, 41, 2, C.y3); dot(sign, 14, 8, C.y3); dot(sign, 41, 8, C.y3);

  paste(img, sign, 0, 0);
  paste(img, aw, 0, 0);

  // side details: leaning newspaper bundle at the right foot, small trash bin left
  rect(img, 50, 51, 5, 3, C.cr1); hline(img, 50, 51, 5, C.cr0); hline(img, 50, 53, 5, C.cr3);
  rect(img, 50, 50, 5, 1, C.lav3);
  outlineAround(img);
  return img;
}
