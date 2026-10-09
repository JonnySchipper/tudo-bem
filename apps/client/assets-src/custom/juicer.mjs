// "Correria no Balcão": the espremedor automático (the Zummo-style orange juicer on every padaria counter) and its parts.
// Keys (one sprite per frame, anchor bottom centre):
//   balcao/juicer_<idle|roll|cut|press|pour|peel>  40x42 (20, 41)  the machine through one orange: it rolls out of the feeder, the blade
//                                                                   cuts it, the two cups press the halves, juice runs out of the spout,
//                                                                   and the spent peels drop down the chute into the bin (amber lamp lit)
//   balcao/juicer_ready                             40x42 (20, 41)  idle with the green lamp lit: the glass is at the line
//   balcao/juice_glass_<0..9> · juice_glass_spill  14x12 (7, 11)    the glass under the spout, 7 rows = the line (red ticks)
//   balcao/orange_<p|m|g>                          7x7 / 9x9 / 11x11 the next orange on the feeder (pequena, média, grande)
//   balcao/laranjas                                28x28 (14, 26)  a crate of oranges on the shelf (tapping it feeds the machine too)
// Same palette and rules as balcao.mjs: navy outline, light from the upper left, hard pixels, steel ramp for the machine.
import { blank, put, fillRect, shape, NAVY } from './paint.mjs';
import { outlineAround, text3 } from './draw.mjs';

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

// ------------------------------------------------------------------ the machine (40x42, anchor (20, 41))
// Top to bottom: the clear hopper dome heaped with oranges and the feeder cradle on its right (the next orange waits there), an
// orange crown with SUCO on it, the chamber window (the blade and the two press cups), the spout over the glass bay, the drip tray.
// Left of the window the three lamps (amber = running, green = glass at the line, red = stop) over the peel bin (bagaço); right of
// it the sight gauge, an empty tube the stage fills with the glass's level (green ticks = the good band, a red tick = the line).
const JW = 40, JH = 42;
/** The chamber window frame (x1, y1 exclusive); the dark inside is one pixel in. */
const WIN = { x0: 8, y0: 17, x1: 32, y1: 26 };
const inWin = (x, y) => x >= WIN.x0 + 1 && x < WIN.x1 - 1 && y >= WIN.y0 + 1 && y < WIN.y1 - 1;
const SPOUT_X = 20;
const CUP_Y = 21.5;
/** The sight gauge's inside (the stage fills it, `JUICE_GAUGE` in correriaArt.ts): x, top row, width, rows. It shows up to 1.3 of the line. */
export const GAUGE = { x: 33, y: 18, w: 2, h: 18, max: 1.3 };
const gaugeRow = (f) => GAUGE.y + GAUGE.h - R((GAUGE.h * f) / GAUGE.max);
const LAMP = {
  amber: { at: [4, 18], off: '#7a5326', on: ['#f6a021', '#fff2d0'] },
  green: { at: [4, 21], off: '#2f5a3a', on: ['#4fd06a', '#c8ffd0'] },
  red: { at: [4, 24], off: '#a83030', on: ['#d93232', '#ff8575'] },
};

function hopper(img) {
  // a clear acrylic dome heaped with oranges (a back row peeks over the front one)
  const dome = (x, y) => el(15, 10.6, 12.6, 10.6)(x, y) && y < 10.5;
  fillP(img, dome, ACRYLIC[1]);
  const inside = (x, y) => el(15, 10.8, 11.6, 9.8)(x, y) && y < 10.5;
  for (const [cx, cy, r] of [[10.5, 3.4, 2.6], [16.5, 2.8, 2.6], [21.5, 4.2, 2.4], [7.2, 6.4, 3], [13.4, 5.8, 3.1], [19.4, 6.4, 3], [4.6, 9.2, 2.6], [10.2, 9, 3], [16.4, 9, 3.1], [22.4, 9.2, 2.8]]) orangeBall(img, cx, cy, r, inside);
  // acrylic: a lit rim and a glare streak upper left
  fillP(img, (x, y) => dome(x, y) && !el(15, 10.8, 11.6, 9.8)(x, y), ACRYLIC[2]);
  pts(img, [[6, 3], [7, 2], [8, 1], [9, 1], [5, 4], [4, 6]], '#ffffff');
  // the feeder cradle on the right: the next orange waits on it, a dark slot drops it into the chamber
  fillRect(img, 27, 8, 9, 3, STEEL[1]);
  fillRect(img, 27, 8, 9, 1, STEEL[3]);
  fillRect(img, 29, 10, 5, 1, '#2c2c34');
}

function body(img) {
  // brushed steel cabinet
  fillRect(img, 2, 11, 36, 27, STEEL[2]);
  fillRect(img, 2, 11, 2, 27, STEEL[3]);
  fillRect(img, 36, 11, 2, 27, STEEL[1]);
  // the orange crown with the brand: SUCO in pale letters with a dark drop shadow, a leaf either side
  fillRect(img, 2, 10, 36, 7, ORANGE[2]);
  fillRect(img, 2, 10, 36, 1, ORANGE[3]);
  fillRect(img, 2, 16, 36, 1, ORANGE[0]);
  fillRect(img, 2, 10, 1, 7, ORANGE[3]);
  fillRect(img, 37, 10, 1, 7, ORANGE[1]);
  text3(img, 13, 11, 'SUCO', '#fff2d0', ORANGE[0]);
  pts(img, [[8, 12], [9, 12], [9, 13]], LEAF[1]);
  put(img, 8, 13, LEAF[0]);
  pts(img, [[30, 12], [31, 12], [30, 13]], LEAF[1]);
  put(img, 31, 13, LEAF[0]);
  // a steel ring where the dome sits on the crown
  fillRect(img, 3, 10, 25, 1, STEEL[1]);
  // the chamber window: dark inside, a steel frame, a dim top row
  fillRect(img, WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, STEEL[0]);
  fillRect(img, WIN.x0 + 1, WIN.y0 + 1, WIN.x1 - WIN.x0 - 2, WIN.y1 - WIN.y0 - 2, '#2c2c34');
  fillRect(img, WIN.x0 + 1, WIN.y0 + 1, WIN.x1 - WIN.x0 - 2, 1, '#3a3a50');
  // the lamp panel, left of the window
  fillRect(img, 3, 17, 4, 9, STEEL[1]);
  fillRect(img, 3, 17, 4, 1, STEEL[3]);
  // the sight gauge, right of the window: an empty tube with the good band (green) and the line (red) marked on its frame
  fillRect(img, GAUGE.x - 1, GAUGE.y - 1, GAUGE.w + 2, GAUGE.h + 2, STEEL[0]);
  fillRect(img, GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, '#2c2c34');
  for (let y = gaugeRow(1.2); y <= gaugeRow(0.8); y++) put(img, GAUGE.x + GAUGE.w, y, '#4fa04a');
  put(img, GAUGE.x - 1, gaugeRow(1), LINE_RED);
  put(img, GAUGE.x + GAUGE.w, gaugeRow(1), LINE_RED);
  // peel chute (diagonal from the chamber) into the bin (bagaço): a door with a slot that shows the peels, and a handle
  pts(img, [[8, 26], [7, 27], [8, 27]], STEEL[0]);
  fillRect(img, 3, 27, 7, 10, STEEL[1]);
  fillRect(img, 3, 27, 7, 1, STEEL[3]);
  fillRect(img, 3, 36, 7, 1, STEEL[0]);
  fillRect(img, 4, 29, 5, 2, '#2c2c34');
  pts(img, [[4, 30], [6, 30], [7, 29]], RIND[1]);
  put(img, 5, 30, FLESH[3]);
  fillRect(img, 5, 33, 3, 1, STEEL[0]);
  // the glass bay under the spout: a dark recess so the glass reads, its back wall lit a little on the left
  fillRect(img, 11, 26, 19, 11, '#46465e');
  fillRect(img, 11, 26, 19, 1, '#2c2c34');
  fillRect(img, 12, 27, 1, 9, '#56567a');
  // spout
  fillRect(img, SPOUT_X - 2, 26, 5, 1, STEEL[0]);
  put(img, SPOUT_X, 27, STEEL[1]);
  // drip tray with a grille (the glass stands on it)
  fillRect(img, 1, 37, 38, 5, STEEL[1]);
  fillRect(img, 1, 37, 38, 1, STEEL[3]);
  fillRect(img, 1, 41, 38, 1, STEEL[0]);
  for (let x = 3; x < 37; x += 2) put(img, x, 39, STEEL[0]);
}

function lamps(img, lit) {
  for (const [name, l] of Object.entries(LAMP)) {
    const [x, y] = l.at;
    const on = lit.includes(name);
    fillRect(img, x, y, 2, 2, on ? l.on[0] : l.off);
    if (on) put(img, x, y, l.on[1]);
  }
}

/** The two press cups in the chamber; `gap` is how far each sits from the centre line. */
function cups(img, gap) {
  for (const side of [-1, 1]) {
    const cx = SPOUT_X + side * gap;
    const bowl = (x, y) => el(cx, CUP_Y, 3, 3.4)(x, y) && (x - cx) * side >= -0.3 && inWin(x, y);
    fillP(img, bowl, STEEL[1]);
    fillP(img, (x, y) => bowl(x, y) && (x - cx) * side >= 1.6, STEEL[0]);
    put(img, R(cx), R(CUP_Y - 3.4), STEEL[3]);
    // the arm that drives the cup
    const ax = side < 0 ? WIN.x0 + 1 : WIN.x1 - 2;
    const y = Math.floor(CUP_Y);
    for (let x = Math.min(ax, R(cx + side * 2)); x <= Math.max(ax, R(cx + side * 2)); x++) if (inWin(x + 0.5, y + 0.5)) put(img, x, y, STEEL[0]);
  }
}

function stream(img, from, to) {
  for (let y = from; y < to; y++) put(img, SPOUT_X, y, y % 2 ? JUICE[1] : JUICE[2]);
}

const RUN = ['amber'];
const JUICER_FRAMES = {
  idle(img) {
    cups(img, 6);
    lamps(img, []);
  },
  roll(img) {
    cups(img, 6);
    // the orange drops off the feeder into the chamber
    orangeBall(img, 26.5, 20.6, 3, inWin);
    pts(img, [[29, 18], [30, 19]], ORANGE[2]);
    lamps(img, RUN);
  },
  cut(img) {
    cups(img, 6);
    // the blade comes down through the middle: two halves, a bright cut line, a fleck of flesh either side
    orangeHalf(img, 18, CUP_Y, 3.2, 1);
    orangeHalf(img, 22, CUP_Y, 3.2, -1);
    for (let y = WIN.y0 + 1; y < WIN.y1 - 1; y++) put(img, SPOUT_X, y, y < 21 ? '#ffffff' : STEEL[3]);
    pts(img, [[15, 18], [25, 24]], FLESH[2]);
    lamps(img, RUN);
  },
  press(img) {
    // the cups close on the halves; juice beads under them and at the spout
    orangeHalf(img, 18.4, CUP_Y, 2.7, 1);
    orangeHalf(img, 21.6, CUP_Y, 2.7, -1);
    cups(img, 4);
    pts(img, [[19, 24], [20, 24], [21, 24]], JUICE[3]);
    put(img, SPOUT_X, 27, JUICE[2]);
    lamps(img, RUN);
  },
  pour(img) {
    orangeHalf(img, 18.4, CUP_Y, 2.7, 1);
    orangeHalf(img, 21.6, CUP_Y, 2.7, -1);
    cups(img, 4);
    pts(img, [[19, 24], [20, 24]], JUICE[2]);
    stream(img, 27, 30);
    lamps(img, RUN);
  },
  peel(img) {
    // cups open again, the spent peels tumble down the chute into the bin
    cups(img, 6);
    peel(img, 9, 23);
    peel(img, 8, 26, true);
    put(img, SPOUT_X, 27, JUICE[1]);
    lamps(img, RUN);
  },
  /** Idle with the glass at the line: the green lamp is lit (not a step of the cycle; the stage picks it). */
  ready(img) {
    cups(img, 6);
    lamps(img, ['green']);
  },
};
/** The cycle's steps (`juicerStep` in shared) and the frames the art draws (the steps and `ready`). */
export const JUICER_STEPS = ['idle', 'roll', 'cut', 'press', 'pour', 'peel'];
export const JUICER_FRAME_KEYS = Object.keys(JUICER_FRAMES);

function juicerFrame(step) {
  const img = blank(JW, JH);
  body(img);
  hopper(img);
  JUICER_FRAMES[step](img);
  // the clear cover over the chamber: a short diagonal glare, upper left
  pts(img, [[10, 19], [11, 19], [10, 20]], '#6c6e85');
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
  for (const s of JUICER_FRAME_KEYS) add(`balcao/juicer_${s}`, juicerFrame(s), [20, 41]);
  for (let k = 0; k < GLASS_LEVELS; k++) add(`balcao/juice_glass_${k}`, glassFrame(k), [7, 11]);
  add('balcao/juice_glass_spill', glassFrame(GLASS_LEVELS - 1, true), [7, 11]);
  for (const s of Object.keys(ORANGE_SIZES)) {
    const n = ORANGE_SIZES[s][0];
    add(`balcao/orange_${s}`, orangeSprite(s), [Math.floor(n / 2), n - 1]);
  }
  add('balcao/laranjas', crate(), [14, 26]);
  return out;
}
