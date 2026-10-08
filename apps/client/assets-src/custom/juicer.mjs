// "Correria no Balcão": the espremedor automático (the Zummo-style orange juicer on every padaria counter) and its parts.
// Keys (one sprite per frame, anchor bottom centre):
//   balcao/juicer_<idle|roll|cut|press|pour|peel>  34x36 (17, 35)  the machine through one orange: it rolls out of the hopper, the blade
//                                                                   cuts it, the two cups press the halves, juice runs out of the spout,
//                                                                   and the spent peels drop down the chute into the bin
//   balcao/juice_glass_<0..9> · juice_glass_spill  14x12 (7, 11)    the glass under the spout, 7 rows = the line (red ticks)
//   balcao/orange_<p|m|g>                          7x7 / 9x9 / 11x11 the next orange in the hopper (pequena, média, grande)
//   balcao/laranjas                                28x28 (14, 26)  a crate of oranges on the shelf (tapping it feeds the machine too)
// Same palette and rules as balcao.mjs: navy outline, light from the upper left, hard pixels, steel ramp for the machine.
import { blank, put, fillRect, shape, NAVY } from './paint.mjs';
import { outlineAround } from './draw.mjs';

const STEEL = ['#565972', '#8b8bab', '#b2aecb', '#d8d0e0'];
const ORANGE = ['#b4520e', '#e07a14', '#f6a021', '#ffc04a'];
const RIND = ['#8a3a0c', '#b4520e', '#e07a14'];
const FLESH = ['#f6a021', '#ffcf5a', '#ffe9a8', '#fff2d0'];
const JUICE = ['#e07a14', '#f6a021', '#ffb43a', '#ffd778'];
const ACRYLIC = ['#a4bbd5', '#cce6ec', '#e2f2f3'];
const LEAF = ['#2f6b3a', '#4f9a4a'];
const LINE_RED = '#d93232';

const R = Math.round;
const el = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const vol = (img, pred, box, ramp, t) => shape(img, pred, box, ramp, { outline: false, t });
const done = (img) => outlineAround(img, NAVY);
function fillP(img, pred, hex) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (pred(x + 0.5, y + 0.5)) put(img, x, y, hex);
}
const pts = (img, list, hex) => { for (const [x, y] of list) put(img, x, y, hex); };

/** A whole orange: lit ball, a pale dimple of light and a dark stem dot. `clip` keeps it inside a window (the hopper, the chamber). */
function orangeBall(img, cx, cy, r, clip = () => true) {
  const pred = (x, y) => el(cx, cy, r, r)(x, y) && clip(x, y);
  vol(img, pred, [cx, cy, r, r], ORANGE, [0.84, 0.38, -0.15]);
  const hx = R(cx - r * 0.45), hy = R(cy - r * 0.5);
  if (clip(hx + 0.5, hy + 0.5)) put(img, hx, hy, '#ffe08a');
  const sx = R(cx + r * 0.15), sy = R(cy - r + 0.6);
  if (r >= 2.8 && clip(sx + 0.5, sy + 0.5)) put(img, sx, sy, LEAF[0]);
}

/** A half orange seen from the cut side: rind ring, pith, segmented flesh. `face` -1 = cut side to the left, 1 = to the right. */
function orangeHalf(img, cx, cy, r, face) {
  // the rind dome behind the cut face
  fillP(img, (x, y) => el(cx, cy, r, r)(x, y) && (x - cx) * face <= 0.4, RIND[1]);
  fillP(img, (x, y) => el(cx, cy, r, r)(x, y) && (x - cx) * face <= -r * 0.55, RIND[0]);
  // the cut face: an upright ellipse (seen edge-on) of pith and flesh
  fillP(img, el(cx + face * 0.6, cy, 1.6, r), FLESH[3]);
  fillP(img, el(cx + face * 0.6, cy, 1.0, r - 0.8), FLESH[1]);
  put(img, R(cx + face * 0.6 - 0.5), R(cy - 0.5), FLESH[2]);
}

/** A squashed, spent peel cup (rind outside, pale pith inside). */
function peel(img, x, y, flip = false) {
  const d = flip ? -1 : 1;
  pts(img, [[x, y], [x + d, y], [x + 2 * d, y]], RIND[1]);
  pts(img, [[x, y + 1], [x + 2 * d, y + 1]], RIND[0]);
  put(img, x + d, y + 1, FLESH[3]);
}

// ------------------------------------------------------------------ the machine
const JW = 34, JH = 36;
/** The chamber window where the orange is cut and pressed. */
const WIN = { x0: 10, y0: 12, x1: 26, y1: 20 };
const inWin = (x, y) => x >= WIN.x0 + 1 && x < WIN.x1 - 1 && y >= WIN.y0 + 1 && y < WIN.y1 - 1;
const SPOUT_X = 17;

function hopper(img) {
  // a clear acrylic dome, stocked with oranges, a chute at its lower right into the chamber
  const dome = (x, y) => el(13, 9.2, 11.2, 9.2)(x, y) && y < 11 && x > 1.5;
  fillP(img, dome, ACRYLIC[1]);
  const inside = (x, y) => el(13, 9.4, 10.2, 8.4)(x, y) && y < 10.6;
  for (const [cx, cy, r] of [[7, 5.6, 2.8], [12.2, 4.4, 2.9], [17.4, 5.6, 2.8], [4.6, 8.6, 2.6], [9.6, 8.4, 3], [15, 8.2, 3], [20, 8.6, 2.6]]) orangeBall(img, cx, cy, r, inside);
  // acrylic shine: a lit rim and a glare streak upper left
  fillP(img, (x, y) => dome(x, y) && !el(13, 9.4, 10.2, 8.4)(x, y), ACRYLIC[2]);
  pts(img, [[5, 3], [6, 2], [7, 2], [4, 4], [8, 1], [9, 1]], '#ffffff');
  pts(img, [[3, 6], [3, 7]], ACRYLIC[2]);
  // the lid knob
  fillRect(img, 12, 0, 3, 1, STEEL[1]);
  // chute from the hopper down into the chamber
  fillRect(img, 21, 9, 4, 3, STEEL[0]);
  fillRect(img, 21, 9, 4, 1, STEEL[1]);
}

function body(img) {
  // brushed steel cabinet
  fillRect(img, 2, 10, 30, 23, STEEL[2]);
  fillRect(img, 2, 10, 30, 1, '#ffffff');
  fillRect(img, 2, 11, 30, 1, STEEL[3]);
  fillRect(img, 2, 10, 2, 23, STEEL[3]);
  fillRect(img, 30, 10, 2, 23, STEEL[1]);
  for (let x = 5; x < 29; x += 4) for (let y = 22; y < 32; y += 3) put(img, x, y, STEEL[3]);
  // the chamber window: dark inside, a steel frame, a pale reflection on its clear cover
  fillRect(img, WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, STEEL[0]);
  fillRect(img, WIN.x0 + 1, WIN.y0 + 1, WIN.x1 - WIN.x0 - 2, WIN.y1 - WIN.y0 - 2, '#2c2c34');
  fillRect(img, WIN.x0 + 1, WIN.y0 + 1, WIN.x1 - WIN.x0 - 2, 1, '#3a3a50');
  // brand plate: an orange badge with a leaf, right of the window
  fillRect(img, 27, 13, 3, 4, ORANGE[2]);
  fillRect(img, 27, 13, 3, 1, ORANGE[3]);
  put(img, 29, 16, ORANGE[0]);
  put(img, 28, 12, LEAF[1]);
  // peel chute (diagonal, left of the chamber) into the bin
  pts(img, [[9, 19], [8, 20], [7, 21], [6, 22], [9, 20], [8, 21], [7, 22]], STEEL[0]);
  // the peel bin (bagaço): a door with a handle and a slot that shows the peels in it
  fillRect(img, 3, 23, 7, 9, STEEL[1]);
  fillRect(img, 3, 23, 7, 1, STEEL[3]);
  fillRect(img, 3, 31, 7, 1, STEEL[0]);
  fillRect(img, 4, 25, 5, 2, '#2c2c34');
  pts(img, [[4, 26], [6, 26], [7, 25]], RIND[1]);
  put(img, 5, 26, FLESH[3]);
  fillRect(img, 5, 29, 3, 1, STEEL[0]);
  // the glass bay under the spout: a dark recess so the glass reads
  fillRect(img, 11, 21, 14, 11, '#46465e');
  fillRect(img, 11, 21, 14, 1, '#2c2c34');
  // spout
  fillRect(img, SPOUT_X - 1, 20, 3, 1, STEEL[0]);
  put(img, SPOUT_X, 21, STEEL[1]);
  // controls on the right: a green start and a red stop button
  fillRect(img, 26, 23, 4, 8, STEEL[1]);
  fillRect(img, 27, 24, 2, 2, '#4fa04a');
  put(img, 27, 24, '#8ff0a4');
  fillRect(img, 27, 28, 2, 2, LINE_RED);
  put(img, 27, 28, '#ff8575');
  // drip tray with a grille (the glass stands on it)
  fillRect(img, 1, 32, 32, 4, STEEL[1]);
  fillRect(img, 1, 32, 32, 1, STEEL[3]);
  fillRect(img, 1, 35, 32, 1, STEEL[0]);
  for (let x = 4; x < 31; x += 2) put(img, x, 34, STEEL[0]);
}

/** The two press cups in the chamber; `gap` is how far each sits from the centre line. */
function cups(img, gap) {
  const cy = 16;
  for (const side of [-1, 1]) {
    const cx = 18 + side * gap;
    const bowl = (x, y) => el(cx, cy, 2.6, 3)(x, y) && (x - cx) * side >= -0.3 && inWin(x, y);
    fillP(img, bowl, STEEL[1]);
    fillP(img, (x, y) => bowl(x, y) && (x - cx) * side >= 1.4, STEEL[0]);
    put(img, cx + side * 0, cy - 3, STEEL[3]);
    // the arm that drives the cup
    const ax = side < 0 ? WIN.x0 + 1 : WIN.x1 - 2;
    for (let x = Math.min(ax, cx + side * 2); x <= Math.max(ax, cx + side * 2); x++) if (inWin(x + 0.5, cy + 0.5)) put(img, x, cy, STEEL[0]);
  }
}

function stream(img, from, to) {
  for (let y = from; y < to; y++) put(img, SPOUT_X, y, y % 2 ? JUICE[1] : JUICE[2]);
}

const JUICER_FRAMES = {
  idle(img) {
    cups(img, 4);
  },
  roll(img) {
    cups(img, 4);
    // the orange drops out of the chute into the chamber
    orangeBall(img, 21.5, 14.6, 2.6, inWin);
    put(img, 23, 12, ORANGE[2]);
  },
  cut(img) {
    cups(img, 4);
    // the blade comes down through the middle: two halves, a bright cut line
    orangeHalf(img, 16.5, 16, 2.8, 1);
    orangeHalf(img, 19.5, 16, 2.8, -1);
    for (let y = WIN.y0 + 1; y < WIN.y1 - 1; y++) put(img, 18, y, y < 14 ? '#ffffff' : STEEL[3]);
    pts(img, [[15, 13], [21, 19]], FLESH[2]);
  },
  press(img) {
    // the cups close on the halves; juice beads at the spout
    orangeHalf(img, 16.6, 16, 2.4, 1);
    orangeHalf(img, 19.4, 16, 2.4, -1);
    cups(img, 3);
    pts(img, [[17, 18], [18, 18], [19, 18]], JUICE[3]);
    put(img, SPOUT_X, 21, JUICE[2]);
  },
  pour(img) {
    orangeHalf(img, 16.6, 16, 2.4, 1);
    orangeHalf(img, 19.4, 16, 2.4, -1);
    cups(img, 3);
    pts(img, [[17, 18], [18, 18]], JUICE[2]);
    stream(img, 21, 26);
  },
  peel(img) {
    // cups open again, the spent peels tumble down the chute into the bin
    cups(img, 4);
    peel(img, 7, 19);
    peel(img, 5, 21, true);
    put(img, SPOUT_X, 21, JUICE[1]);
  },
};
export const JUICER_STEPS = Object.keys(JUICER_FRAMES);

function juicerFrame(step) {
  const img = blank(JW, JH);
  hopper(img);
  body(img);
  JUICER_FRAMES[step](img);
  // the clear cover over the chamber: a short diagonal glare, upper left
  pts(img, [[12, 13], [13, 13], [11, 14]], '#6c6e85');
  return done(img);
}

// ------------------------------------------------------------------ the glass (14x12): walls at x 2 and 11, liquid rows 1..9, 7 rows = the line
export const GLASS_LEVELS = 10;
const GL = { x0: 2, x1: 11, top: 1, bot: 9, line: 7 };
const GLASS = ['#a4bbd5', '#cce6ec', '#e2f2f3'];

function glassFrame(level, spill = false) {
  const img = blank(14, 12);
  const lineY = GL.bot - GL.line + 1;
  for (let y = 0; y <= 11; y++) for (let x = GL.x0; x <= GL.x1; x++) {
    const wall = x === GL.x0 || x === GL.x1;
    let c;
    if (y === 0) c = '#ffffff';
    else if (y >= 10) c = wall ? GLASS[0] : y === 10 ? GLASS[2] : GLASS[1];
    else {
      const wet = y > GL.bot - level;
      if (wall) c = x === GL.x0 ? '#ffffff' : GLASS[0];
      else if (wet) c = y === GL.bot - level + 1 ? JUICE[3] : x === GL.x0 + 1 ? JUICE[2] : x >= GL.x1 - 1 ? JUICE[0] : JUICE[1];
      else c = x === GL.x1 - 1 ? GLASS[1] : GLASS[2];
    }
    put(img, x, y, c);
  }
  // pulp flecks in the juice
  for (const [x, y] of [[5, 8], [8, 6], [6, 4], [9, 9], [4, 6]]) if (y > GL.bot - level && y < 10) put(img, x, y, JUICE[3]);
  // the line: red ticks outside both walls and a dashed mark across the glass (pale over juice, white over glass)
  pts(img, [[0, lineY], [1, lineY], [12, lineY], [13, lineY]], LINE_RED);
  const wetLine = lineY > GL.bot - level;
  for (let x = GL.x0 + 1; x < GL.x1; x += 2) put(img, x, lineY, wetLine ? '#fff2d0' : LINE_RED);
  if (spill) {
    // over the rim: foam on top, runs down both outsides, a puddle on the tray
    for (let x = GL.x0; x <= GL.x1; x++) put(img, x, 0, x % 2 ? JUICE[3] : '#fff2d0');
    pts(img, [[1, 1], [1, 2], [1, 4], [0, 5], [0, 6], [12, 1], [12, 2], [12, 3], [13, 5], [12, 7], [13, 8]], JUICE[1]);
    for (let x = 0; x < 14; x++) put(img, x, 11, x % 3 ? JUICE[1] : JUICE[2]);
  }
  return done(img);
}

// ------------------------------------------------------------------ the next orange, in three sizes
export const ORANGE_SIZES = { p: [7, 2.8], m: [9, 3.6], g: [11, 4.5] };
function orangeSprite(size) {
  const [n, r] = ORANGE_SIZES[size];
  const img = blank(n, n);
  orangeBall(img, n / 2, n / 2 + 0.2, r);
  // a tiny leaf on the big ones
  if (size !== 'p') { put(img, R(n / 2), 0, LEAF[1]); put(img, R(n / 2) + 1, 0, LEAF[0]); }
  return done(img);
}

// ------------------------------------------------------------------ a crate of oranges for the shelf (28x28, anchor [14,26])
function crate() {
  const img = blank(28, 28);
  const wood = ['#8f5a2a', '#b07040', '#c98d55', '#e2b07a'];
  // oranges heaped over the rim
  for (const [cx, cy, r] of [[7, 13, 3.6], [13.6, 11.6, 3.8], [20.4, 13, 3.6], [10.2, 15.4, 3.4], [17.2, 15.4, 3.4]]) orangeBall(img, cx, cy, r);
  // the caixote: three slats, corner posts, a stencilled mark
  fillRect(img, 3, 16, 22, 10, wood[1]);
  for (const y of [16, 20, 23]) { fillRect(img, 3, y, 22, 2, wood[2]); fillRect(img, 3, y, 22, 1, wood[3]); }
  fillRect(img, 3, 16, 2, 10, wood[0]); fillRect(img, 23, 16, 2, 10, wood[0]);
  fillRect(img, 3, 16, 1, 10, wood[1]);
  fillRect(img, 3, 25, 22, 1, wood[0]);
  pts(img, [[11, 21], [12, 21], [13, 21], [15, 21], [16, 21]], wood[0]);
  return done(img);
}

// ------------------------------------------------------------------ registry
export function juicerParts() {
  const out = [];
  const add = (key, img, anchor) => out.push({ key, img, anchor });
  for (const s of JUICER_STEPS) add(`balcao/juicer_${s}`, juicerFrame(s), [17, 35]);
  for (let k = 0; k < GLASS_LEVELS; k++) add(`balcao/juice_glass_${k}`, glassFrame(k), [7, 11]);
  add('balcao/juice_glass_spill', glassFrame(GLASS_LEVELS - 1, true), [7, 11]);
  for (const s of Object.keys(ORANGE_SIZES)) {
    const n = ORANGE_SIZES[s][0];
    add(`balcao/orange_${s}`, orangeSprite(s), [Math.floor(n / 2), n - 1]);
  }
  add('balcao/laranjas', crate(), [14, 26]);
  return out;
}
