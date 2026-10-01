// Feira dressing of the V2 composition pass: produce crates (tomatoes, bananas, watermelons, cabbages), sacks of potatoes, a platform scale.
// Built with the helpers of feira.mjs (same palette, same lighting: upper left, navy outline, hard pixels).
import { blank, put, shape, ell, fillRect, NAVY, h2 } from './paint.mjs';
import { C, K, hline, vline, dot, outlineAround } from './kit.mjs';
import { crate, heap, bananas, lettuce, RAMPS } from './feira.mjs';

/** A watermelon seen from above-front: striped green ellipsoid. */
function melancia(img, x, y, w = 11, h = 8) {
  const cx = x + w / 2, cy = y + h / 2;
  shape(img, ell(cx, cy, w / 2, h / 2), [cx, cy, w / 2, h / 2], [C.teal0, C.teal1, C.teal3, C.teal5], {
    ol: NAVY,
    t: [0.82, 0.38, -0.1],
    pattern: (px, py, idx) => (Math.floor((px - x + (py - y) * 0.4) / 2) % 2 === 0 ? Math.max(0, idx - 1) : idx),
  });
}

function caixaProduto(kind) {
  const img = blank(18, 26);
  crate(img, 1, 14, 16, 11);
  if (kind === 'tomate') {
    heap(img, 2, 5, 14, 9, [RAMPS.red, [C.r4, C.r2, C.r1, C.r0], [C.r5, C.r3, C.r2, C.r1]], 3);
  } else if (kind === 'banana') {
    bananas(img, 2, 5); bananas(img, 6, 8);
    dot(img, 14, 11, C.y2); dot(img, 15, 12, C.y4);
  } else if (kind === 'melancia') {
    melancia(img, 1, 8, 10, 7); melancia(img, 8, 5, 10, 7); melancia(img, 4, 2, 9, 6);
  } else {
    // repolho: four cabbages
    lettuce(img, 1, 8, [C.g3, C.g2, C.g1, C.g0]); lettuce(img, 9, 8, [C.g3, C.g2, C.g1, C.g0]);
    lettuce(img, 5, 4, [C.sp0, C.g3, C.g2, C.g1]); lettuce(img, 12, 4, [C.g3, C.g2, C.g1, C.g0]);
  }
  return img;
}

/** One burlap sack: a lumpy body, a tied neck, shading from the upper left. */
function saco(img, x, y, w, h, ramp) {
  const cx = x + w / 2;
  const body = (px, py) => py >= y + 3 && py < y + h && Math.abs(px - cx) <= w / 2 - (py - y < 6 ? (6 - (py - y)) * 0.5 : 0) + (py - y > h - 3 ? -0.6 : 0);
  shape(img, body, [cx, y + h * 0.6, w / 2, h / 2], ramp, { ol: NAVY, t: [0.82, 0.34, -0.25] });
  // neck and the tie
  fillRect(img, Math.floor(cx) - 1, y + 1, 3, 3, ramp[1]);
  put(img, Math.floor(cx) - 1, y + 1, ramp[2]); put(img, Math.floor(cx) + 1, y + 2, ramp[0]);
  hline(img, Math.floor(cx) - 2, y + 3, 5, K.br2);
  for (let i = 0; i < 4; i++) put(img, x + 2 + Math.floor(h2(i, x, 7) * (w - 4)), y + 6 + Math.floor(h2(i, y, 9) * (h - 8)), ramp[0]);
}
function sacos() {
  const img = blank(24, 22);
  const BURLAP = ['#8a6a43', '#a98a5a', '#c8a972', '#e2c991'];
  saco(img, 1, 6, 10, 15, BURLAP);
  saco(img, 11, 2, 11, 18, ['#7b5b3a', '#98774c', '#b8975f', '#d3b57a']);
  // spilled potatoes
  for (const [x, y] of [[9, 19], [11, 20], [7, 20]]) { shape(img, ell(x + 1, y, 2, 1.5), [x + 1, y, 2, 1.5], [K.br3, K.br1, K.te0, K.or1], { ol: NAVY, t: [0.8, 0.3, -0.2] }); }
  return img;
}

/** Balança de prato: a pole, a beam and two pans hanging from strings (1 tile, 18x26). */
function balanca() {
  const img = blank(18, 26);
  fillRect(img, 8, 6, 2, 17, C.slate2); vline(img, 8, 6, 17, C.mist);
  fillRect(img, 4, 22, 10, 3, C.slate); hline(img, 4, 22, 10, C.mist);
  fillRect(img, 2, 4, 14, 2, C.slate2); hline(img, 2, 4, 14, C.mist2);
  dot(img, 8, 2, C.y3); dot(img, 9, 2, C.y3); dot(img, 8, 3, C.y4); dot(img, 9, 3, C.y4);
  for (const x of [3, 14]) { vline(img, x, 6, 6, K.br2); }
  for (const x of [0, 11]) {
    fillRect(img, x, 12, 7, 2, C.mist); hline(img, x, 12, 7, C.lav3); hline(img, x, 13, 7, C.slate2);
  }
  // a few oranges on the left pan, a weight on the right
  for (const [x, y] of [[1, 9], [3, 9], [2, 7]]) shape(img, ell(x + 1.5, y + 1.5, 1.9, 1.9), [x + 1.5, y + 1.5, 1.9, 1.9], [C.y4, C.y3, C.y2, C.y1], { ol: NAVY, flat: false });
  fillRect(img, 13, 9, 3, 3, C.slate); hline(img, 13, 9, 3, C.lav);
  outlineAround(img);
  return img;
}

export async function caixaTomate() { return [{ img: caixaProduto('tomate'), anchor: [9, 24] }]; }
export async function caixaBanana() { return [{ img: caixaProduto('banana'), anchor: [9, 24] }]; }
export async function caixaMelancia() { return [{ img: caixaProduto('melancia'), anchor: [9, 24] }]; }
export async function caixaRepolho() { return [{ img: caixaProduto('repolho'), anchor: [9, 24] }]; }
export async function sacosBatata() { return [{ img: sacos(), anchor: [12, 20] }]; }
export async function balancaPrato() { return [{ img: balanca(), anchor: [9, 24] }]; }
