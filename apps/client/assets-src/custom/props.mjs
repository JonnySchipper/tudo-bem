// Street props for Vila Ipê (art1). Some are derived from LimeZu sprites (recolor / edit), some are authored with the pack palette.
import { blank, paste, crop, setPx, hexPx, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, rectP, union, minus, recolorRamp, swap, stripSoftAlpha, outlineAround, stampGrid } from './kit.mjs';
import { text3, text3Width } from './draw.mjs';

const PROPS = 'TS:3_City_Props_16x16.png'; // alias only for docs; loaded through the import-map sheet 'props'

/** Orange fiberglass shell (orelhão): dome hood, dark cavity with the handset and keypad, a short grey mount. 1x1 tile. */
export async function orelhao() {
  const W = 20, H = 32;
  const img = blank(W, H);
  // grey mount / pedestal first (the shell overlaps it)
  rect(img, 7, 26, 6, 4, C.slate2);
  rect(img, 6, 29, 8, 2, C.slate);
  hline(img, 7, 26, 6, C.mist);
  hline(img, 6, 29, 8, C.mist2);
  hline(img, 6, 30, 8, C.slate);
  outlineAround(img);
  // shell silhouette: a dome on a narrowing skirt
  const shell = newMask(20, 28);
  fillMask(shell, union(ellipse(10, 10, 9.4, 10), (x, y) => y >= 10 && y < 27 && Math.abs(x - 10) <= 9.4 - (y - 10) * 0.28));
  // cavity: the arch that shows the phone
  const cav = newMask(20, 28);
  fillMask(cav, union(ellipse(10.5, 12.2, 5.2, 6.2), rectP(5.4, 12.2, 15.6, 22.6)));
  const body = blank(W, H);
  drawShaded(body, shell, 0, 0, [K.te2, C.y4, C.y3, C.y1], { rimLit: 1, rimShade: 3, ol: C.navy });
  // sheen on the crown and a darker lower skirt
  for (const [x, y, c] of [[5, 3, C.y2], [6, 2, C.y2], [7, 2, C.y1], [4, 4, C.y2], [4, 5, C.y2], [8, 1, C.y2]]) dot(body, x, y, c);
  for (let x = 4; x < 17; x++) if (shell.a[24 * 20 + x]) dot(body, x, 24, K.te2);
  for (let y = 22; y < 27; y++) for (let x = 3; x < 18; x++) if (shell.a[y * 20 + x] && y > 24) dot(body, x, y, K.te2);
  // cavity paint
  for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) if (cav.a[y * 20 + x]) setPx(body, x, y, hexPx(C.navy2));
  // lit inner rim on the left, deep shadow inside the top (light comes from the upper left)
  for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) {
    if (!cav.a[y * 20 + x]) continue;
    const up = y > 0 && cav.a[(y - 1) * 20 + x];
    const left = x > 0 && cav.a[y * 20 + x - 1];
    if (!up) setPx(body, x, y, hexPx(C.navy));
    else if (!left) setPx(body, x, y, hexPx(C.navy));
  }
  // cavity edge lip (the shell's thickness, lit on the right/bottom inner side)
  for (let y = 0; y < 28; y++) for (let x = 0; x < 20; x++) {
    if (!shell.a[y * 20 + x] || cav.a[y * 20 + x]) continue;
    if (cav.a[y * 20 + x - 1] || cav.a[(y - 1) * 20 + x]) setPx(body, x, y, hexPx(C.y4));
  }
  // handset (red) on the left wall, phone body + keypad
  rect(body, 7, 9, 2, 8, C.r3); vline(body, 7, 9, 8, C.r1); vline(body, 8, 11, 6, C.r4);
  rect(body, 10, 8, 5, 3, C.slate2); hline(body, 10, 8, 5, C.mist);
  rect(body, 10, 11, 5, 8, C.slate);
  hline(body, 10, 11, 5, C.slate2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) dot(body, 10 + c * 2, 13 + r * 2, C.lav3);
  dot(body, 11, 9, C.b2); dot(body, 12, 9, C.b2); dot(body, 13, 9, C.b1);
  dot(body, 11, 19, C.g2); dot(body, 13, 19, C.r2);
  // little phone pictogram above the arch
  const ico = [' ##', '#.#', '#.#', ' ##'];
  paste(img, body, 0, 0);
  return [{ img, anchor: [10, 30] }];
}

/** Orange SP bin: a cylinder in the orange ramp with an open dark mouth and a slot, lit from the upper left. 1x1. */
export async function lixeira() {
  const W = 14, H = 22;
  const img = blank(W, H);
  const body = newMask(12, 18);
  fillMask(body, union(rectP(1, 4, 11, 17), rectP(0.5, 6, 11.5, 15), ellipse(6, 5, 5.5, 2.6), ellipse(6, 16.6, 5, 1.4)));
  const ramp = [K.te2, C.y4, C.y3, C.y1];
  drawShaded(img, body, 1, 2, ramp, { rimLit: 1, rimShade: 3 });
  // mouth
  const mouth = newMask(12, 18);
  fillMask(mouth, ellipse(6, 4.6, 4.2, 1.8));
  for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) if (mouth.a[y * 12 + x]) setPx(img, x + 1, y + 2, hexPx(y < 4 ? C.navy : C.navy2));
  hline(img, 4, 8, 6, K.te3);
  // slot + rim band
  rect(img, 4, 11, 6, 2, C.navy2); hline(img, 4, 13, 6, K.te2);
  hline(img, 2, 15, 10, K.te2);
  vline(img, 4, 8, 7, C.y2); dot(img, 3, 9, C.y1); dot(img, 3, 10, C.y2);
  return [{ img, anchor: [7, 20] }];
}

/** "Missão do dia" totem: terracotta pillar with a mustard screen (a star), a slot and a button. 1x1, lights up at night. */
export async function quiosque() {
  const W = 16, H = 32;
  const img = blank(W, H);
  const body = newMask(12, 28);
  fillMask(body, union(rectP(0, 5, 12, 28), ellipse(6, 6, 6, 5)));
  drawShaded(img, body, 2, 2, [K.te5, K.te3, K.te1, K.or1], { rimLit: 1, rimShade: 2 });
  // plinth
  rect(img, 1, 27, 14, 3, K.te5); hline(img, 1, 27, 14, K.te3); hline(img, 1, 29, 14, K.br3);
  vline(img, 1, 27, 3, K.te3);
  outlineAround(img);
  // screen frame + glow
  rect(img, 4, 7, 8, 10, C.navy);
  rect(img, 5, 8, 6, 8, C.y3);
  rect(img, 5, 8, 6, 1, C.y1); vline(img, 5, 8, 8, C.y1);
  rect(img, 6, 12, 5, 4, C.y4); // lower shade of the glass
  const star = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
  star.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') dot(img, 6 + x, 9 + y - 0, y < 3 ? K.br2 : K.br1); }));
  dot(img, 8, 8, C.y0);
  // lower panel: slot, button, small mustard label
  rect(img, 5, 19, 6, 2, C.navy); hline(img, 5, 21, 6, K.te1);
  rect(img, 6, 23, 4, 2, C.y3); hline(img, 6, 23, 4, C.y1); hline(img, 6, 24, 4, C.y4);
  rect(img, 4, 25, 8, 1, K.te5);
  // pennant on top (a tiny hand-drawn roof detail)
  dot(img, 7, 1, C.y1); dot(img, 8, 1, C.y1);
  return [{ img, anchor: [8, 29] }];
}

/** Blue SP street plate ("R. DOS IPÊS") on a grey pole. The pole is the LimeZu plain sign pole, the plate is drawn in the pack blues. */
export async function placaRua(ctx) {
  const sheet = await ctx.sheet('props');
  const pole = stripSoftAlpha(crop(sheet, 5, 184, 7, 50));
  const W = 26, H = 46;
  const img = blank(W, H);
  paste(img, pole, 9, 12); // pole foot at y = 12 + 49 = 61 > H: crop below
  const out = blank(W, H);
  // keep only the pole's top 30 rows (the rest is trimmed so the foot sits at the sprite bottom)
  paste(out, crop(pole, 0, 20, 7, 30), 9, 16);
  const px0 = 1, py0 = 1, pw = 24, ph = 15;
  rect(out, px0, py0, pw, ph, C.b3);
  for (let x = px0 + 1; x < px0 + pw - 1; x++) { dot(out, x, py0 + 1, C.lav4); dot(out, x, py0 + ph - 2, C.lav3); }
  for (let y = py0 + 1; y < py0 + ph - 1; y++) { dot(out, px0 + 1, y, C.lav4); dot(out, px0 + pw - 2, y, C.lav3); }
  for (let x = px0 + 2; x < px0 + pw - 2; x++) dot(out, x, py0 + 2, C.b2);
  for (let x = px0 + 2; x < px0 + pw - 2; x++) dot(out, x, py0 + ph - 3, C.b4);
  // text: R.DOS / IPES with a caret over the E
  text3(out, px0 + 4, py0 + 3, 'R', C.lav4); dot(out, px0 + 8, py0 + 7, C.lav4);
  text3(out, px0 + 10, py0 + 3, 'DOS', C.lav4);
  text3(out, px0 + 5, py0 + 9, 'IPES', C.lav4);
  for (const x of [px0 + 11, px0 + 12, px0 + 13]) dot(out, x, py0 + 8, C.lav4);
  dot(out, px0 + 12, py0 + 7, C.lav4);
  outlineAround(out);
  return [{ img: out, anchor: [12, 45] }];
}
