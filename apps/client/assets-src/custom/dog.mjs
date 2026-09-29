// Vira-lata caramelo (art2 redo of the art1 dog): a caramel mutt with a big head, perky pointed ears, a cream muzzle and chest, a
// curled tail and four visible legs. Hand-authored with LimeZu palette colors, lit from the upper left, navy outline.
// 24x17 frames facing east (west = flipH). idle x4 (tail wag + a blink), walk x4, sleep x2 (curled up, head on the paws).
import { blank, put, shape, fillRect, ell, box, or, and, sub, NAVY } from './paint.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

const W = 24, H = 17;
const COAT = ['#a9764f', '#c78c59', '#daa463', '#f2bd7a']; // dark, shade, base, hi
const FAR = ['#8a5a38', '#a9764f', '#c78c59', '#daa463']; // far-side legs / ear (darker)
const CREAM = ['#d9b98a', '#e8cf9f', '#f6e3b8', '#fff2d0'];
const EAR_IN = '#b5754d';

const tri = (ax, ay, bx, by, cx, cy) => (x, y) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

function leg(img, x, y0, y1, ramp, w = 2) {
  shape(img, box(x, y0, x + w, y1), [x + w / 2, (y0 + y1) / 2, w / 2, (y1 - y0) / 2], ramp, { ol: NAVY, t: [0.95, 0.4, -0.2] });
  put(img, Math.floor(x), Math.floor(y1) - 1, ramp === COAT ? CREAM[2] : CREAM[1]); // pale sock
  put(img, Math.floor(x) + 1, Math.floor(y1) - 1, ramp === COAT ? CREAM[1] : CREAM[0]);
}

/** tail: a thick arc curling up and forward over the rump (wag varies the arc's start and end angle) */
function tail(img, kind) {
  const [a0, a1, cx, cy] = [[1.9, 5.6, 3.6, 5.2], [1.6, 5.2, 3.2, 5.0], [2.1, 5.9, 4.0, 5.4]][kind];
  const arc = (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    let a = Math.atan2(y - cy, x - cx);
    if (a < 0) a += Math.PI * 2;
    return d >= 1.1 && d <= 3.0 && a >= a0 && a <= a1;
  };
  shape(img, arc, [cx, cy, 3, 3], COAT, { ol: NAVY, t: [0.85, 0.35, 0] });
  // cream tip
  const tipA = a1 - 0.5;
  put(img, Math.round(cx + Math.cos(tipA) * 2), Math.round(cy + Math.sin(tipA) * 2), CREAM[2]);
}

function head(img, dx, dy, o = {}) {
  // far ear (darker) behind the skull, skull, near ear on top, muzzle, eye, nose
  shape(img, tri(14.4 + dx, 4.4 + dy, 15.6 + dx, -0.6 + dy, 18.2 + dx, 3.8 + dy), [16.2 + dx, 2 + dy, 1.8, 2.6], FAR, { ol: NAVY, t: [0.9, 0.4, 0] });
  shape(img, ell(18.3 + dx, 6.4 + dy, 4.8, 4.2), [18.3 + dx, 6.4 + dy, 4.8, 4.2], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(18.4 + dx, 3.4 + dy, 20.4 + dx, -1.6 + dy, 22.4 + dx, 3.6 + dy), [20.4 + dx, 1.2 + dy, 2, 2.8], COAT, { ol: NAVY, t: [0.86, 0.36, 0] });
  put(img, 20 + dx, 1 + dy, EAR_IN); put(img, 20 + dx, 2 + dy, EAR_IN); put(img, 21 + dx, 2 + dy, COAT[1]); put(img, 19 + dx, 2 + dy, EAR_IN);
  // muzzle: a cream snout to the right
  shape(img, ell(22 + dx, 8.4 + dy, 2.6, 2.1), [22 + dx, 8.4 + dy, 2.6, 2.1], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 23 + dx, 7 + dy, NAVY); put(img, 22 + dx, 7 + dy, '#46465e'); // nose
  put(img, 21 + dx, 10 + dy, CREAM[0]);
  // eye
  if (o.blink) { put(img, 20 + dx, 5 + dy, NAVY); put(img, 19 + dx, 5 + dy, NAVY); }
  else { put(img, 20 + dx, 5 + dy, NAVY); put(img, 20 + dx, 4 + dy, '#46465e'); put(img, 19 + dx, 4 + dy, CREAM[3]); }
  if (o.tongue) { put(img, 22 + dx, 10 + dy, '#d56868'); put(img, 22 + dx, 11 + dy, '#e07070'); }
  put(img, 16 + dx, 8 + dy, COAT[1]); put(img, 15 + dx, 8 + dy, COAT[1]);
}

function body(img, dy = 0) {
  // long, lean body: raised rump, deep chest, darker saddle on the back, cream chest
  const m = or(ell(9.4, 8.6 + dy, 7, 3.3), ell(14.4, 9 + dy, 2.7, 3.5), ell(5.6, 8.2 + dy, 3.2, 3.2));
  shape(img, m, [9.6, 8.6 + dy, 8, 3.5], COAT, { ol: NAVY, t: [0.86, 0.4, 0] });
  for (const [x, y] of [[6, 6], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 6], [13, 6], [8, 6], [9, 6], [10, 6], [11, 6], [7, 6]]) put(img, x, y + dy, COAT[1]);
  for (const [x, y] of [[15, 10], [15, 11], [14, 11], [14, 12], [13, 12]]) put(img, x, y + dy, CREAM[2]);
  put(img, 15, 9 + dy, CREAM[3]);
  for (const [x, y] of [[4, 6], [5, 5], [3, 7]]) put(img, x, y + dy, COAT[3]);
}

function standing(img, o = {}) {
  const { legs = [[4, 0], [8, 0], [13, 0], [16, 0]], tailKind = 0, bob = 0, blink = false, tongue = false } = o;
  tail(img, tailKind);
  leg(img, legs[1][0], 10 + bob, 15.8 - legs[1][1], FAR);
  leg(img, legs[3][0], 10 + bob, 15.8 - legs[3][1], FAR);
  body(img, bob);
  leg(img, legs[0][0], 10 + bob, 15.8 - legs[0][1], COAT);
  leg(img, legs[2][0], 10 + bob, 15.8 - legs[2][1], COAT);
  head(img, 0, bob, { blink, tongue });
}

export function dogIdle(frame) {
  const img = blank(W, H);
  standing(img, { tailKind: [0, 1, 0, 2][frame], blink: frame === 3 });
  return img;
}

export function dogWalk(phase) {
  const img = blank(W, H);
  const sw = [[-1, 1, 1, -1], [0, 0, 0, 0], [1, -1, -1, 1], [0, 0, 0, 0]][phase];
  const lift = [[0, 1, 0, 1], [0, 0, 0, 0], [1, 0, 1, 0], [0, 0, 0, 0]][phase];
  const legs = [[4 + sw[0], lift[0]], [8 + sw[1], lift[1]], [13 + sw[2], lift[2]], [16 + sw[3], lift[3]]];
  standing(img, { legs, tailKind: [0, 1, 0, 2][phase], bob: phase % 2 ? -1 : 0, tongue: phase === 2 });
  return img;
}

export function dogSleep(frame) {
  // curled up asleep: a round back, the tail wrapped along the belly to the paws, head lifted a little on the front paws
  // with a closed eye, one ear perked and one flopped. 24x15.
  const img = blank(W, 15);
  const up = frame ? 1 : 0; // breathing
  shape(img, ell(10.4, 10.2 - up * 0.5, 8.4, 4.6 + up * 0.5), [10.4, 10, 8.4, 5], COAT, { ol: NAVY, t: [0.85, 0.4, 0] });
  for (const [x, y] of [[4, 8], [5, 7], [6, 6], [7, 6], [8, 5], [9, 5], [10, 5], [11, 5], [12, 6]]) put(img, x, y - up, COAT[3]);
  for (const [x, y] of [[6, 8], [7, 8], [8, 7], [9, 7], [10, 7], [11, 7], [12, 8]]) put(img, x, y - up, COAT[1]);
  // tail wrapped around the front-bottom of the mound, cream tip
  for (const [x, y] of [[3, 10], [3, 11], [4, 12], [5, 13], [7, 13], [9, 13], [11, 13], [13, 12]]) put(img, x, y, COAT[1]);
  for (const [x, y] of [[4, 10], [4, 11], [5, 12], [6, 13], [8, 13], [10, 13], [12, 13]]) put(img, x, y, COAT[2]);
  put(img, 14, 12, CREAM[2]); put(img, 15, 12, CREAM[1]);
  // head resting at the front (right)
  shape(img, tri(14.4, 6.4, 15.4, 2.2, 18, 6), [16, 4.4, 1.8, 2.2], FAR, { ol: NAVY, t: [0.9, 0.4, 0] }); // far ear, perked
  shape(img, ell(17.6, 9.6, 4.2, 3.6), [17.6, 9.6, 4.2, 3.6], COAT, { ol: NAVY, t: [0.84, 0.4, 0] });
  shape(img, tri(17, 6.8, 19.6, 3, 21, 7.4), [19.2, 5.4, 2, 2], COAT, { ol: NAVY, t: [0.86, 0.36, 0] }); // near ear, half-flopped
  put(img, 19, 5, EAR_IN); put(img, 20, 6, EAR_IN);
  shape(img, ell(21.4, 11.2, 2.5, 2), [21.4, 11.2, 2.5, 2], CREAM, { ol: NAVY, t: [0.9, 0.4, 0] });
  put(img, 22, 10, NAVY); put(img, 21, 10, '#46465e');
  put(img, 19, 9, NAVY); put(img, 20, 9, NAVY); put(img, 18, 10, COAT[1]);
  // paws under the chin
  shape(img, ell(19.8, 13.2, 3.2, 1.2), [19.8, 13.2, 3.2, 1.2], CREAM, { ol: NAVY, t: [0.95, 0.4, 0] });
  put(img, 18, 13, CREAM[3]);
  return img;
}

export async function viraLata() {
  const idle = [0, 1, 2, 3].map(dogIdle), walk = [0, 1, 2, 3].map(dogWalk), sleep = [0, 1].map(dogSleep);
  const meta = { footprint: [1, 1], shadow: 'fx/shadow_16' };
  const out = [];
  const add = (name, frames, fps, ax, ay) => {
    out.push({ key: `critters/vira_lata_${name}_e`, frames, fps, anchor: [ax, ay], meta });
    out.push({ key: `critters/vira_lata_${name}_w`, frames: frames.map(flipH), fps, anchor: [frames[0].w - 1 - ax, ay], meta });
  };
  add('idle', idle, 3, 12, 16);
  add('walk', walk, 8, 12, 16);
  add('sleep', sleep, 1.5, 12, 14);
  return out;
}

export async function preview() {
  return [...[0, 1, 2, 3].map(dogIdle), ...[0, 1, 2, 3].map(dogWalk), dogSleep(0), dogSleep(1)];
}
void fillRect; void sub; void and;
