// Feira livre (street market) stalls, art2: 3x2 footprint each (48x32 base + overhead striped tarp), a folded-tarp closed variant per
// stall, stacked fruit crates (1x1) and tiny blank price tags. Hand-authored with the LimeZu palette (outline navy, wood, red, yellow,
// green ramps) and the same lighting rules as the rest of the set: light from the upper left, navy sel-out outline, no gradients.
// Prices are DOM text, so the tags are blank. The tarp is an `overhead` sprite so characters walk in front of the table and
// under the tarp (same convention as props/barraca_chapeus).
import { blank, put, shape, flat, grid, line, ell, box, or, and, sub, fillRect, ring, NAVY } from './paint.mjs';
import { C, K } from './kit.mjs';

const W = 48, H = 44; // base sprite (3 tiles wide; the bottom 32 px are the 3x2 footprint)
const TW = 56, TH = 24; // tarp sprite
const TARP_BOTTOM_AT = 9; // the tarp's scallop tips end at this row of the base

const CREAM = [C.lav, C.lav3, C.cr0, C.white]; // dark, shade, base, hi
const RAMPS = {
  red: [C.r5, C.r3, C.r2, C.r0],
  green: [C.teal0, C.teal2, C.teal4, C.teal5],
  yellow: [C.y4, C.y3, C.y2, C.y1],
  blue: [C.b4, C.b3, C.b2, C.b1],
  pink: [C.p3, C.p2, C.p1, C.p0],
  orange: [K.te3, C.y4, '#f7a12a', C.y1],
};
const STRIPE = { frutas: RAMPS.red, verduras: RAMPS.green, pastel: RAMPS.yellow, flores: RAMPS.blue };

// ------------------------------------------------------------------ tarp (lona)
function tarp(kind) {
  const img = blank(TW, TH);
  const col = STRIPE[kind];
  // silhouette: a slanted awning, back edge narrower, front valance with scallops
  const top = 1, bot = TH - 5; // scallops below `bot`
  const inShape = (x, y) => {
    const t = Math.max(0, Math.min(1, (y - top) / (bot - top)));
    const half = 24 + t * 4;
    if (Math.abs(x - TW / 2) > half) return false;
    if (y < top || y >= TH - 1) return false;
    if (y < bot) return true;
    // scallops: 6 px wide, 4 px tall
    const sx = ((x - 0) % 7) - 3;
    return y <= bot + 3 - Math.floor((sx * sx) / 3.2);
  };
  shape(img, inShape, [TW / 2, 11, 28, 12], col, {
    t: [0.8, 0.28, -0.4],
    pattern: (x, y) => {
      // vertical stripes 4 px wide, colored / cream; light falls from the upper left, fold shadows on the right of each stripe
      const stripe = Math.floor((x + 1) / 4) % 2;
      const lit = (y < 6 ? 1 : 0);
      const fold = (x + 1) % 4 === 3;
      if (stripe) return fold ? 1 : 2 + lit * 1; // cream: base / shade / hi
      return fold ? 0 : (y > 16 ? 1 : 2 + (lit && (x + 1) % 4 === 0 ? 1 : 0));
    },
    ol: NAVY,
  });
  // repaint cream stripes with the cream ramp (pattern chose ramp indices from the colored ramp)
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inShape(x + 0.5, y + 0.5)) continue;
    const stripe = Math.floor((x + 1) / 4) % 2;
    if (!stripe) continue;
    const fold = (x + 1) % 4 === 3;
    const lit = y < 6;
    const belowFront = y > 16;
    put(img, x, y, fold ? CREAM[0] : belowFront ? CREAM[1] : lit && (x + 1) % 4 === 0 ? CREAM[3] : CREAM[2]);
  }
  // a sagging crease and two stitched seams
  // valance shade line
  for (let x = 0; x < TW; x++) if (inShape(x + 0.5, bot - 0.5)) put(img, x, bot - 1, Math.floor((x + 1) / 4) % 2 ? CREAM[0] : col[0]);
  return img;
}

// ------------------------------------------------------------------ common structure
function drawPoles(img) {
  for (const x0 of [1, 43]) {
    fillRect(img, x0, 0, 4, H, NAVY);
    fillRect(img, x0 + 1, 0, 2, H - 1, C.w3);
    fillRect(img, x0 + 1, 0, 1, H - 1, C.w1);
    fillRect(img, x0 + 2, 0, 1, H - 1, C.w4);
  }
}
/** wooden table: top boards + front planks + legs. `cloth` optionally covers the top with a cloth ramp. */
function drawTable(img, o = {}) {
  const x0 = 4, x1 = 43; // exclusive right edge
  // legs and back shade
  for (const lx of [5, 39]) { fillRect(img, lx - 1, 37, 5, 7, NAVY); fillRect(img, lx, 37, 3, 6, C.w5); put(img, lx, 37, C.w3); fillRect(img, lx, 37, 1, 6, C.w3); }
  // front face: 3 planks
  fillRect(img, x0, 28, x1 - x0, 10, NAVY);
  for (let r = 0; r < 3; r++) {
    const y = 29 + r * 3;
    fillRect(img, x0 + 1, y, x1 - x0 - 2, 2, r === 0 ? C.w2 : C.w3);
    fillRect(img, x0 + 1, y, x1 - x0 - 2, 1, r === 0 ? C.w0 : C.w2);
    for (let x = x0 + 4 + r * 3; x < x1 - 2; x += 9) put(img, x, y + 1, C.w5);
  }
  put(img, x0 + 1, 29, C.w0);
  // tabletop
  fillRect(img, x0, 21, x1 - x0, 8, NAVY);
  const top = o.cloth ? o.cloth : [C.w3, C.w2, C.w1, C.w0];
  fillRect(img, x0 + 1, 22, x1 - x0 - 2, 6, top[2]);
  fillRect(img, x0 + 1, 22, x1 - x0 - 2, 1, top[3]);
  fillRect(img, x0 + 1, 27, x1 - x0 - 2, 1, top[1]);
  if (!o.cloth) for (let x = x0 + 6; x < x1 - 2; x += 11) { put(img, x, 24, top[1]); put(img, x + 1, 25, top[1]); put(img, x + 2, 25, top[1]); }
  else for (let x = x0 + 2; x < x1 - 3; x += 4) put(img, x, 25, top[1]);
}

/** a tiny blank price tag hung on the table front (a cream card with a string) */
function tag(img, x, y, ramp = [C.cr3, C.cr1, C.cr0, C.white]) {
  fillRect(img, x, y, 6, 4, NAVY);
  fillRect(img, x + 1, y + 1, 4, 2, ramp[2]);
  put(img, x + 1, y + 1, ramp[3]); put(img, x + 4, y + 2, ramp[1]);
}

// ------------------------------------------------------------------ goods
/** heap of round fruit / veg on the table: dome mask filled with lit 3x3 "plus" fruits. base = ramps[]; baseline y0+h. */
function heap(img, x0, y0, w, h, ramps, seed = 1) {
  const cx = x0 + w / 2;
  const mask = (x, y) => y < y0 + h && ell(cx, y0 + h, w / 2, h)(x, y);
  shape(img, mask, [cx, y0 + h, w / 2, h], [ramps[0][0], ramps[0][0], ramps[0][0], ramps[0][0]], { flat: true, ol: NAVY });
  let n = 0;
  for (let row = 0; row * 3 < h + 1; row++) {
    const y = y0 + h - 2 - row * 3;
    for (let x = x0 + 1 + (row % 2) * 2; x < x0 + w - 1; x += 3) {
      if (!mask(x + 1, y + 0.5) || !mask(x + 0.5, y - 1)) continue;
      const r = ramps[(n++ + seed + row) % ramps.length];
      put(img, x + 1, y - 1, r[3]); put(img, x, y, r[2]); put(img, x + 1, y, r[2]); put(img, x + 2, y, r[1]);
      put(img, x + 1, y + 1, r[1]); put(img, x, y - 1, r[2]); put(img, x + 2, y - 1, r[2]);
      put(img, x + 2, y + 1, r[0]); put(img, x, y + 1, r[1]);
    }
  }
}
const BANANA = [
  '....ooooo...',
  '..oooYYYyyo.',
  '.oYYYYyyyyo.',
  '.oYYyyyyyoo.',
  'oYYyyyyyoo..',
  'oYyyyyoo....',
  '.oyyooo.....',
  '..ooo.......',
];
function bananas(img, x, y) {
  grid(img, BANANA, { o: NAVY, Y: C.y0, y: C.y2, b: C.y4 }, x, y);
  for (const [dx, dy] of [[4, 4], [6, 5], [8, 3], [3, 3]]) put(img, x + dx, y + dy, C.y3);
  put(img, x + 4, y, K.br2); put(img, x + 5, y, K.br2);
}
function melon(img, x, y) {
  // a cut watermelon half seen from above: green rind, cream band, red flesh with seeds
  const m = (px, py) => ell(x + 6, y + 4, 6, 4.2)(px, py);
  shape(img, m, [x + 6, y + 4, 6, 4.2], [C.teal0, C.teal2, C.teal3, C.teal5], { ol: NAVY });
  shape(img, ell(x + 6, y + 4, 4.7, 3.1), [x + 6, y + 4, 5, 3], [C.r5, C.r3, C.r2, C.r1], { ol: C.cr1, t: [0.9, 0.2, -0.6] });
  for (const [dx, dy] of [[4, 3], [6, 4], [8, 3], [7, 5]]) put(img, x + dx, y + dy, C.navy);
}
function lettuce(img, x, y, ramp = [C.g3, C.g2, C.g1, C.g0]) {
  shape(img, ell(x + 3, y + 3, 3.4, 3.2), [x + 3, y + 3, 3.4, 3.2], ramp, { ol: NAVY });
  put(img, x + 2, y + 2, ramp[3]); put(img, x + 3, y + 4, ramp[0]);
}
function carrots(img, x, y) {
  // a bunch lying flat: orange bodies with green tops
  for (let i = 0; i < 4; i++) {
    line(img, x + 2 + i, y + 1 + i, x + 9 + i, y + 2 + i, i % 2 ? K.te1 : C.y4);
    put(img, x + 1 + i, y + 1 + i, C.g2); put(img, x + i, y + 1 + i, C.g1);
  }
  for (let i = 0; i < 4; i++) put(img, x + 10 + i, y + 2 + i, NAVY);
  put(img, x + 2, y + 1, C.g0);
}
function tomatoes(img, x, y) { heap(img, x, y, 11, 6, [RAMPS.red, [C.r4, C.r3, '#e2523f', C.r0]], 2); }
function bucket(img, x, y, w = 9, h = 8) {
  // galvanized bucket: tapered, lit left, ring bands
  const m = (px, py) => py >= y && py < y + h && Math.abs(px - (x + w / 2)) <= w / 2 - (py - y) * 0.13;
  shape(img, m, [x + w / 2, y + h / 2, w / 2, h / 2], [C.slate, C.mist, C.lav, C.lav4], { ol: NAVY, t: [0.85, 0.35, -0.2] });
  fillRect(img, x + 1, y + 1, w - 2, 1, C.slate2);
  put(img, x + 2, y + 3, C.lav4);
  fillRect(img, x + 1, y + h - 2, w - 2, 1, C.mist);
}
function bloom(img, x, y, kind) {
  // a 3x3 flower head centered on (x, y), lit from the upper left
  const P = {
    girassol: { p: C.y1, q: C.y3, c: K.br2, edge: C.y4 },
    rosa: { p: C.r0, q: C.r2, c: C.r5, edge: C.r4 },
    rosaPink: { p: C.p0, q: C.p2, c: C.p3, edge: C.p3 },
    margarida: { p: C.white, q: C.lav3, c: C.y2, edge: C.lav },
    lilas: { p: '#d8c8f0', q: '#968bab', c: '#76689e', edge: '#54467f' },
  }[kind];
  fillRect(img, x - 1, y - 1, 3, 3, P.q);
  put(img, x - 1, y - 1, P.p); put(img, x, y - 1, P.p); put(img, x - 1, y, P.p);
  put(img, x, y, P.c);
  put(img, x + 1, y + 1, P.edge);
  if (kind === 'girassol') { put(img, x - 2, y, P.p); put(img, x + 2, y, P.q); put(img, x, y - 2, P.p); put(img, x, y + 2, P.q); }
  if (kind === 'margarida') { put(img, x - 2, y, P.p); put(img, x, y - 2, P.p); }
}
function flowerBunch(img, x, y, w, h, kinds, seed = 0) {
  // heads at three heights over stems with leaves, standing in a bucket whose rim is at y + h
  const xs = [x + 1, x + 4, x + 7], ys = [y + 2 + (seed % 2), y + 5 - (seed % 2), y + 3];
  for (let i = 0; i < 3; i++) {
    for (let yy = ys[i] + 2; yy < y + h; yy++) put(img, xs[i], yy, C.g3);
    put(img, xs[i] + (i % 2 ? 1 : -1), ys[i] + 5, C.g2); put(img, xs[i] + (i % 2 ? 2 : -2), ys[i] + 4, C.g1);
  }
  for (let i = 0; i < 3; i++) bloom(img, xs[i], ys[i], kinds[i % kinds.length]);
  put(img, x + 3, y + h - 1, C.g2); put(img, x + 6, y + h - 2, C.g1); put(img, x + 8, y + h - 1, C.g2);
  void w;
}
function crate(img, x, y, w, h, lid = true) {
  fillRect(img, x, y, w, h, NAVY);
  fillRect(img, x + 1, y + 1, w - 2, h - 2, C.w2);
  fillRect(img, x + 1, y + 1, w - 2, 1, C.w0);
  for (let yy = y + 3; yy < y + h - 2; yy += 3) fillRect(img, x + 1, yy, w - 2, 1, C.w4);
  fillRect(img, x + w - 2, y + 1, 1, h - 2, C.w3);
  put(img, x + 1, y + 1, C.w0); void lid;
}

// ------------------------------------------------------------------ open stalls
function baseOpen(kind) {
  const img = blank(W, H);
  drawPoles(img);
  drawTable(img);
  if (kind === 'frutas') {
    heap(img, 5, 13, 13, 13, [RAMPS.orange, [C.y3, C.y4, '#f7a12a', C.y1]], 0);
    heap(img, 19, 11, 13, 15, [RAMPS.red, [C.r4, C.r2, C.r1, C.r0], [C.g3, C.g2, C.g1, C.g0]], 1);
    for (let yy = 8; yy < 13; yy++) put(img, 37, yy, K.br3);
    bananas(img, 32, 12);
    melon(img, 33, 21);
    tag(img, 8, 32); tag(img, 22, 32); tag(img, 35, 32);
  } else if (kind === 'verduras') {
    lettuce(img, 6, 20); lettuce(img, 11, 19, [C.teal1, C.teal3, C.g2, C.g0]); lettuce(img, 8, 15); lettuce(img, 13, 16, [C.g3, C.g2, C.g1, C.g0]); lettuce(img, 6, 11);
    heap(img, 17, 15, 12, 11, [RAMPS.red, [C.r4, C.r3, '#e2523f', C.r0]], 2);
    heap(img, 30, 13, 11, 7, [[C.g3, C.g2, C.g1, C.g0], [C.teal1, C.teal3, C.g2, C.g0]], 1);
    carrots(img, 29, 21);
    tag(img, 8, 32); tag(img, 22, 32); tag(img, 35, 32);
  } else if (kind === 'flores') {
    bucket(img, 6, 17, 10, 9); flowerBunch(img, 6, 6, 10, 12, ['girassol', 'margarida', 'girassol'], 0);
    bucket(img, 19, 17, 10, 9); flowerBunch(img, 19, 6, 10, 12, ['rosa', 'rosaPink', 'rosa'], 1);
    bucket(img, 32, 17, 10, 9); flowerBunch(img, 32, 6, 10, 12, ['lilas', 'margarida', 'lilas'], 2);
    tag(img, 8, 32); tag(img, 22, 32); tag(img, 35, 32);
  } else {
    pastelStall(img);
  }
  return img;
}

function pastelStall(img) {
  // left: glass display case with golden pasteis; middle: blank menu slate over a fryer; right: the caldo de cana press with its cane
  fillRect(img, 5, 13, 16, 14, NAVY);
  fillRect(img, 6, 14, 14, 12, K.gl2);
  fillRect(img, 6, 14, 14, 1, K.gl1); fillRect(img, 6, 14, 1, 12, K.gl1);
  fillRect(img, 19, 15, 1, 11, K.gl4);
  fillRect(img, 6, 20, 14, 1, C.lav3); fillRect(img, 6, 25, 14, 1, C.lav);
  for (const [px, py] of [[7, 16], [12, 16], [15, 16], [7, 21], [11, 21], [15, 21]]) {
    // a golden half-moon pastel (4x4) with a crimped bottom edge
    fillRect(img, px, py + 1, 4, 3, C.w1); fillRect(img, px + 1, py, 2, 1, C.w1);
    put(img, px + 1, py, C.w0); put(img, px, py + 1, C.w0); put(img, px + 3, py + 3, C.w3); put(img, px + 1, py + 3, C.w3); put(img, px + 3, py + 2, C.w2);
  }
  // fryer with golden oil, steam
  fillRect(img, 21, 21, 7, 6, NAVY); fillRect(img, 22, 22, 5, 4, C.slate2); fillRect(img, 22, 22, 5, 1, C.mist2);
  fillRect(img, 22, 23, 5, 2, C.y3); fillRect(img, 22, 23, 5, 1, C.y1); put(img, 25, 24, C.y4);
  for (const [sx, sy] of [[23, 19], [24, 18], [25, 17], [26, 19]]) put(img, sx, sy, C.lav3);
  // blank menu slate hanging from the tarp beam
  fillRect(img, 22, 10, 6, 6, NAVY); fillRect(img, 23, 11, 4, 4, C.cr0); fillRect(img, 23, 11, 4, 1, C.white); fillRect(img, 23, 14, 4, 1, C.cr3);
  put(img, 24, 12, C.r2); put(img, 25, 12, C.r2); put(img, 24, 13, C.y3);
  // sugar cane bundle leaning against the press
  for (let i = 0; i < 3; i++) line(img, 28 + i, 26, 30 + i, 10, i === 1 ? C.g2 : C.g3);
  for (const [nx, ny] of [[28, 22], [29, 17], [30, 14], [31, 22], [31, 18], [30, 12]]) put(img, nx, ny, C.g0);
  // press: green cabinet, grey hopper with rollers, flywheel on the front, jug of juice
  fillRect(img, 32, 15, 9, 12, NAVY);
  fillRect(img, 33, 16, 7, 10, C.teal3); fillRect(img, 33, 16, 7, 1, C.teal5); fillRect(img, 33, 16, 1, 10, C.teal5); fillRect(img, 39, 17, 1, 9, C.teal1);
  fillRect(img, 33, 24, 7, 2, C.teal1);
  fillRect(img, 33, 10, 7, 6, NAVY); fillRect(img, 34, 11, 5, 4, C.slate2); fillRect(img, 34, 11, 5, 1, C.mist2); fillRect(img, 35, 13, 3, 1, C.slate); put(img, 36, 12, C.g2); put(img, 37, 12, C.g3);
  ring(img, 36, 21, 3.3, (x, y) => (x + y < 56 ? C.lav3 : C.slate2));
  fillRect(img, 35, 20, 2, 2, C.y3); put(img, 35, 20, C.y1);
  fillRect(img, 41, 22, 3, 5, NAVY); fillRect(img, 42, 23, 1, 3, K.gl2); put(img, 42, 25, C.y1); put(img, 42, 24, C.g0);
  tag(img, 8, 32); tag(img, 22, 32); tag(img, 35, 32);
}

// ------------------------------------------------------------------ closed stalls
function baseClosed(kind) {
  const img = blank(W, H);
  drawPoles(img);
  // crossbar the roll rests on
  fillRect(img, 4, 7, 40, 2, NAVY); fillRect(img, 4, 7, 40, 1, C.w2); fillRect(img, 5, 8, 38, 1, C.w4);
  drawTable(img, { cloth: undefined });
  // a tarp cover thrown over the goods: lumps under a plain colored sheet tied with rope
  const col = STRIPE[kind];
  const lumps = (x, y) => y >= 16 && y < 28 && x >= 5 && x < 43 && (y >= 20 || (x > 8 && x < 40 && y >= 17 + Math.abs(Math.sin(x / 4.2)) * 1.5 * 0));
  const cover = (x, y) => y >= 15 + 4 * Math.pow(Math.abs(x - 24) / 19, 2) - 2 * Math.sin((x - 6) / 5) + 2 && y < 28 && x >= 5.5 && x < 42.5;
  void lumps;
  shape(img, cover, [24, 22, 20, 8], col, { ol: NAVY, t: [0.85, 0.3, -0.4] });
  // fold creases and rope
  for (let x = 9; x < 41; x += 7) for (let y = 19; y < 27; y++) if (cover(x + 0.5, y + 0.5)) put(img, x + Math.floor((y - 19) / 3), y, col[0]);
  for (const rx of [14, 30]) for (let y = 16; y < 28; y++) if (cover(rx + 0.5, y + 0.5)) { put(img, rx, y, K.br1); put(img, rx + 1, y, K.br3); }
  put(img, 15, 24, C.cr1); put(img, 31, 24, C.cr1);
  tag(img, 21, 32);
  return img;
}
function roll(kind) {
  // a folded tarp roll lying on the crossbar, striped ends and two ropes
  const w = 52, h = 12;
  const img = blank(w, h);
  const col = STRIPE[kind];
  const m = (x, y) => ell(w / 2, 6.2, 25.8, 5.2)(x, y);
  shape(img, m, [w / 2, 5, 26, 5.5], col, { ol: NAVY, t: [0.85, 0.3, -0.4] });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m(x + 0.5, y + 0.5)) continue;
    const cream = Math.floor((x + 1) / 4) % 2;
    if (cream) put(img, x, y, y > 7 ? CREAM[1] : y < 3 ? CREAM[3] : CREAM[2]);
  }
  for (const rx of [15, 35]) for (let y = 1; y < 11; y++) if (m(rx + 0.5, y + 0.5)) { put(img, rx, y, K.br2); put(img, rx + 1, y, K.br4); }
  return img;
}

// ------------------------------------------------------------------ crates (1x1), tags
function caixotes() {
  const img = blank(16, 26);
  // two stacked crates of fruit, a third small one on top
  crate(img, 1, 14, 14, 11);
  crate(img, 1, 5, 14, 10);
  heap(img, 2, 0, 12, 6, [RAMPS.orange, [C.y3, C.y4, '#f7a12a', C.y1]], 0);
  return img;
}
function precoTag(kind) {
  if (kind === 'papel') {
    const img = blank(12, 10);
    fillRect(img, 1, 3, 10, 7, NAVY); fillRect(img, 2, 4, 8, 5, C.cr0); fillRect(img, 2, 4, 8, 1, C.white); fillRect(img, 2, 8, 8, 1, C.cr3);
    put(img, 3, 1, K.br2); put(img, 4, 2, K.br2); put(img, 5, 3, NAVY); put(img, 6, 2, K.br2); put(img, 7, 1, K.br2);
    put(img, 5, 3, C.r2);
    return img;
  }
  if (kind === 'lousa') {
    const img = blank(14, 16);
    fillRect(img, 6, 9, 2, 7, NAVY); fillRect(img, 6, 9, 1, 7, C.w1); fillRect(img, 7, 9, 1, 6, C.w4);
    fillRect(img, 0, 0, 14, 10, NAVY); fillRect(img, 1, 1, 12, 8, C.w2); fillRect(img, 2, 2, 10, 6, C.navy2); fillRect(img, 2, 2, 10, 1, C.slate);
    fillRect(img, 1, 1, 12, 1, C.w0); fillRect(img, 1, 1, 1, 8, C.w0);
    return img;
  }
  const img = blank(16, 10);
  fillRect(img, 0, 0, 16, 10, NAVY);
  fillRect(img, 1, 1, 14, 8, C.y2); fillRect(img, 1, 1, 14, 1, C.y0); fillRect(img, 1, 8, 14, 1, C.y4);
  fillRect(img, 2, 2, 12, 6, C.cr0); fillRect(img, 2, 2, 12, 1, C.white); fillRect(img, 2, 7, 12, 1, C.cr3);
  return img;
}

// ------------------------------------------------------------------ parts for the import pipeline
export async function feira() {
  const parts = [];
  const meta = { footprint: [3, 2], shadow: 'fx/shadow_48', cast: { kx: 0.4, ky: 0.22 } };
  const A = [24, H - 1];
  // the tarp anchor is chosen so its scallop tips end at TARP_BOTTOM_AT on the base
  const tarpAnchor = [TW / 2, A[1] - TARP_BOTTOM_AT + TH];
  for (const kind of ['frutas', 'verduras', 'pastel', 'flores']) {
    parts.push({ key: `feira/${kind}`, img: baseOpen(kind), anchor: A, meta: { ...meta, overhead: `feira/${kind}_tarp` } });
    parts.push({ key: `feira/${kind}_tarp`, img: tarp(kind), anchor: tarpAnchor, meta: { footprint: [3, 2], overhead: true, shadow: null } });
    const rollAnchor = [26, A[1] - 6 + 12];
    parts.push({ key: `feira/${kind}_fechada`, img: baseClosed(kind), anchor: A, meta: { ...meta, overhead: `feira/${kind}_roll` } });
    parts.push({ key: `feira/${kind}_roll`, img: roll(kind), anchor: rollAnchor, meta: { footprint: [3, 2], overhead: true, shadow: null } });
  }
  parts.push({ key: 'feira/caixotes', img: caixotes(), anchor: [8, 25], meta: { footprint: [1, 1], shadow: 'fx/shadow_16', cast: { kx: 0.4, ky: 0.22 } } });
  for (const k of ['papel', 'lousa', 'placa']) {
    const img = precoTag(k);
    parts.push({ key: `feira/preco_${k}`, img, anchor: [Math.floor(img.w / 2), img.h - 1], meta: { footprint: [1, 1], shadow: null } });
  }
  return parts;
}

export async function preview(kind = 'frutas') {
  const out = [];
  for (const k of kind === 'all' ? ['frutas', 'verduras', 'pastel', 'flores'] : [kind]) {
    const b = baseOpen(k), t = tarp(k);
    const comp = blank(60, 70);
    // composite: base at (6, 26), tarp above
    const put2 = (img, dx, dy) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.data[i + 3]) { const j = ((dy + y) * 60 + dx + x) * 4; if (dy + y >= 0 && dy + y < 70) { comp.data[j] = img.data[i]; comp.data[j + 1] = img.data[i + 1]; comp.data[j + 2] = img.data[i + 2]; comp.data[j + 3] = 255; } } } };
    put2(b, 6, 26);
    put2(t, 2, 26 + TARP_BOTTOM_AT - TH);
    out.push(comp);
    const c = baseClosed(k), r = roll(k);
    const comp2 = blank(60, 70);
    const put3 = (img, dx, dy) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.data[i + 3]) { const j = ((dy + y) * 60 + dx + x) * 4; if (dy + y >= 0 && dy + y < 70) { comp2.data[j] = img.data[i]; comp2.data[j + 1] = img.data[i + 1]; comp2.data[j + 2] = img.data[i + 2]; comp2.data[j + 3] = 255; } } } };
    put3(c, 6, 26); put3(r, 4, 26 + 6 - 12 + 1);
    out.push(comp2);
  }
  return out;
}
