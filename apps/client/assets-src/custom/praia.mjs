// Praia do Jerivá (PRAIA-PLAN.md 1.6): every new piece of the beach, hand-authored in the LimeZu manner (navy outline where a shape meets
// empty space, light from the upper left, flat bands, no gradients). The packs have no beach, so all of it is original; the brand palette plus
// two beach tokens, sea teal #3FA9A0 and sand #EBD9A8 (docs/art/palette.md).
//
//   terrain      areia (s, flat with shell / footprint / pebble variants), agua (o, the `shore` edge: foam where it meets anything), deque (b)
//   the strip    praia/mureta (the Avenida's sea wall), praia/placa_jeriva, praia/placa_praia (the 875 plaque on Rua dos Ipês)
//   the dune     praia/quiosque_coco + _telhado (overhead) + _lit, praia/placa_jo, praia/arara_chapeus, praia/placa_compro_peixe,
//                praia/posto_salva_vidas + _lit, praia/placa_proibido, praia/galpao_barcos + _lit (BARCOS DO BENTO), praia/placa_aluguel
//   the sand     praia/guarda_sol_a|b|c + _copa (overhead) + _fechado, praia/cadeira_praia(_b), praia/castelo_areia, praia/concha_a|b,
//                praia/pegadas, praia/madeira_mar, praia/canoa, praia/rede_secando, praia/balde, praia/vara_apoiada, praia/pesca_stake
//   the lagoa    praia/pedras_a|b|c, praia/taboa
//   the costão   praia/costao (one 6 x 17 pile of granite), praia/placa_perigo, praia/gaivota (a perched gull, 2 frames)
//   the pier     praia/pier_poste, praia/pier_grade, praia/pier_lampada, praia/pier_fim, praia/placa_pier, praia/pesca_bollard
//   the boats    praia/barco_remo, praia/barco_pesca, praia/barco_alto_mar, praia/barco_festa (hull and deck as a decal you walk on, the cabin,
//                mast and upper deck as an overhead part)
//   the deck     praia/festa_grade, praia/festa_cabine, praia/festa_som, praia/festa_churrasqueira, praia/festa_cooler, praia/festa_placa
//   life         critters/gaivota (the pigeon strip recoloured white and grey), critters/caranguejo (2 frames), fx/onda_0..2 (the foam roll)
//   kitnet       furniture/<id>_0|1 for the beach items (`kit.mjs` rules: rot 1 is the mirror)
//   icons        icons/peixe_<id> (14 fish), the junk, the bottle, the kiosk snacks and what they leave in your hand
import { blank, crop, paste, flipH } from '../../../../scripts/lib/pixel/img.mjs';
import { put, fillRect, NAVY, h2, shape, ell, and, or } from './paint.mjs';
import { C, K, drawShaded, newMask, fillMask, outlineAround, recolorRamp, stripSoftAlpha } from './kit.mjs';
import { text, textW } from './aeroporto.mjs';
import { hat } from './stall.mjs';

// ------------------------------------------------------------------ palette
export const SAND = { base: '#ebd9a8', lo: '#e2cd98', lo2: '#d6bd86', hi: '#f3e5bd', speck: '#c9ab78', shell: '#fbf3e6', pink: '#eab6a8' };
export const SEA = { deep: '#2b8783', lo: '#359a92', base: '#3fa9a0', hi: '#5bbdb1', hi2: '#8fd6c8', foam: '#f2faf6', foam2: '#d2efe6' };
const DECK = { gap: '#5a4a3e', lo: '#8c765f', base: '#a38c72', hi: '#b9a287', grain: '#967f66', nail: '#6c5a4a' };
const WOOD = ['#5f4a38', '#7e6550', '#9c8268', '#b9a086'];
const WOODW = [C.w5, C.w3, C.w2, C.w1];
const WHITE = [C.lav, C.lav3, C.lav4, C.white];
const RED = [C.r6, C.r4, C.r2, C.r1];
const TERRA = ['#8f3f22', '#b0522b', '#c45c26', '#dc8350'];
const MUST = ['#8f6b10', '#b88c12', '#d4a017', '#eec450'];
const SPG = [C.sp0, C.sp1, C.sp2, C.sp3];
const CREAM = [C.cr3, C.cr2, C.cr1, C.cr0];
const TEAL = [SEA.deep, SEA.lo, SEA.base, SEA.hi];
const BLUE = ['#244f86', '#2f64a6', '#3f7cc4', '#6aa0dc'];
const NAVYB = ['#1f2c4a', '#2a3a60', '#3a4c78', '#556a98'];
const ROCK = ['#5c5662', '#77707e', '#948c99', '#b3abb5'];
const THATCH = ['#8a6a32', '#a8843e', '#c6a052', '#e0c070'];
const GREEN = [C.g3, '#4f9a45', C.g2, C.g1];
const YEL = [C.y4, C.y3, C.y2, C.y1];
const STEEL = [C.slate, C.slate2, C.mist, C.mist2];
const WARM = '#ffd27a';

const rect = (img, x, y, w, h, hex) => fillRect(img, x, y, w, h, hex);
const dot = (img, x, y, hex) => put(img, x, y, hex);
const mask = (w, h, pred) => fillMask(newMask(w, h), pred);
/** A mask the size of `img`, lit and outlined with `ramp` [dark, mid, light, hi]. */
const solid = (img, pred, ramp, o = {}) => drawShaded(img, mask(img.w, img.h, pred), 0, 0, ramp, o);
const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const elp = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const poly = (pts) => (x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const opaque = (img, x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] > 0;
/** Centred 3x5 text (the airport font: accents and the cedilla work). */
const ctext = (img, cx, y, str, hex, shadow = null) => text(img, Math.round(cx - textW(str) / 2), y, str, hex, 1, shadow);
/** A wooden post `h` px tall with its foot at (x, foot). */
function post(img, x, top, foot, ramp = WOOD, w = 2) {
  rect(img, x, top, w, foot - top, ramp[1]);
  rect(img, x, top, 1, foot - top, ramp[2]);
}
/** A semi-transparent pixel (glass, light). */
const glow = (img, x, y, hex, a) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = parseInt(hex.slice(1, 3), 16);
  img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
  img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
  img.data[i + 3] = a;
};

// ------------------------------------------------------------------ terrain fills
/** s: warm pale sand. Fill 0 plus variants (duplicates weigh the plain ones): shells, a pair of footprints, a pebble, a wind ripple. */
export function areia() {
  const noise = (seed) => {
    const t = blank(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = h2(x, y, seed);
      put(t, x, y, r < 0.05 ? SAND.lo2 : r < 0.17 ? SAND.lo : r > 0.95 ? SAND.hi : SAND.base);
    }
    return t;
  };
  const a = noise(11), b = noise(12), c = noise(13);
  const shell = noise(14);
  for (const [x, y, hex] of [[6, 7, SAND.shell], [7, 7, SAND.shell], [8, 7, SAND.pink], [7, 6, SAND.shell], [6, 8, SAND.speck], [8, 8, SAND.speck], [12, 11, SAND.pink], [12, 12, SAND.speck]]) put(shell, x, y, hex);
  const steps = noise(15);
  for (const [fx, fy] of [[3, 2], [9, 8]]) {
    for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4]]) put(steps, fx + dx, fy + dy, SAND.lo2);
    put(steps, fx, fy, SAND.lo2);
    put(steps, fx + 2, fy + 1, SAND.lo);
  }
  const pebble = noise(16);
  put(pebble, 10, 5, '#b9a99a'); put(pebble, 11, 5, '#d8cabb'); put(pebble, 10, 6, '#8a7e74'); put(pebble, 11, 6, '#9d8f84');
  put(pebble, 4, 11, '#c2b2a2'); put(pebble, 4, 12, '#8a7e74');
  const ripple = noise(17);
  for (let x = 1; x < 15; x++) { put(ripple, x, 9 + (x > 8 ? 1 : 0), SAND.hi); put(ripple, x, 10 + (x > 8 ? 1 : 0), SAND.lo); }
  return [a, b, c, a, shell, steps, b, pebble, ripple, c];
}

/** o: the sea, two teals with a short lighter ripple every third row and a few glints. 32 px pattern = 2 x 2 phases. */
export function agua() {
  const sheet = blank(32, 32);
  const dash = (x, y) => {
    if (y % 3 !== 1) return false;
    const xx = (x + ((y * 5) % 32) + 32) % 32;
    return xx % 4 !== 3 && h2(Math.floor(xx / 4), y, 9) < 0.42;
  };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let c = h2(x, y, 5) < 0.07 ? SEA.lo : SEA.base;
    if (dash(x, y)) c = SEA.hi;
    else if (dash((x + 31) % 32, (y + 31) % 32)) c = SEA.lo;
    if (h2(x, y, 21) < 0.01) c = SEA.hi2;
    put(sheet, x, y, c);
  }
  const out = [];
  for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) out.push(crop(sheet, px * 16, py * 16, 16, 16));
  return out;
}

/** b: weathered grey-brown planks running east-west, 4 px apart, staggered joints and nail heads. 32 px wide = 2 phases. */
export function deque() {
  const sheet = blank(32, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
    const row = y >> 2, r = y & 3;
    const jx = (row * 13 + 7) % 32;
    let c;
    if (r === 3) c = DECK.gap;
    else if (x === jx) c = DECK.gap;
    else if (r === 1 && (x === (jx + 1) % 32 || x === (jx + 31) % 32)) c = DECK.nail;
    else if (r === 0) c = h2(x, y, 3) < 0.15 ? DECK.base : DECK.hi;
    else if (r === 2) c = h2(x, y, 4) < 0.25 ? DECK.grain : DECK.lo;
    else c = h2(x, y, 5) < 0.14 ? DECK.grain : DECK.base;
    put(sheet, x, y, c);
  }
  return [crop(sheet, 0, 0, 16, 16), crop(sheet, 16, 0, 16, 16)];
}

// ------------------------------------------------------------------ the calçadão and the Avenida
/** The low sea wall between the Avenida Beira-Mar and the calçadão: 40 tiles of whitewashed concrete with a teal band. */
function mureta() {
  const W = 640, H = 12;
  const img = blank(W, H);
  for (let x = 0; x < W; x++) {
    dot(img, x, 2, '#f7f3ea');
    dot(img, x, 3, '#ece6da');
    for (let y = 4; y < 10; y++) dot(img, x, y, y === 6 || y === 7 ? (x % 32 < 30 ? SEA.lo : '#bdb2a0') : x % 32 === 31 ? '#c4baa8' : '#ddd5c6');
    dot(img, x, 10, '#a99d8a');
    if (h2(x, 8, 2) < 0.04) dot(img, x, 8, '#c9bfae');
  }
  outlineAround(img);
  return { img, anchor: [320, H] };
}

/** The calçadão sign: PRAIA DO JERIVÁ on a teal board between two posts. */
function placaJeriva() {
  const img = blank(48, 34);
  post(img, 6, 16, 34);
  post(img, 40, 16, 34);
  rect(img, 1, 2, 46, 17, SEA.lo);
  rect(img, 1, 2, 46, 1, SEA.hi);
  rect(img, 2, 3, 44, 1, SEA.base);
  rect(img, 1, 18, 46, 1, SEA.deep);
  ctext(img, 24, 5, 'PRAIA DO', CREAM[3], SEA.deep);
  ctext(img, 24, 12, 'JERIVÁ', '#ffe57b', SEA.deep);
  // a little palm on each side
  for (const px of [5, 42]) {
    dot(img, px, 8, C.g2); dot(img, px - 1, 7, C.g2); dot(img, px + 1, 7, C.g1); dot(img, px, 9, C.w3); dot(img, px, 10, C.w3);
  }
  outlineAround(img);
  return { img, anchor: [24, 33] };
}

/** The 875 plaque at the Vila's bus stop: a wave over a sun, the line number, PRAIA. */
function placaPraia() {
  const img = blank(24, 37);
  rect(img, 11, 25, 2, 11, C.slate2);
  rect(img, 11, 25, 1, 11, C.mist);
  rect(img, 9, 35, 6, 2, C.slate);
  rect(img, 1, 0, 22, 13, BLUE[1]);
  rect(img, 1, 0, 22, 1, BLUE[2]);
  // sun and two waves
  for (const [x, y] of [[14, 2], [15, 2], [13, 3], [14, 3], [15, 3], [16, 3], [14, 4], [15, 4]]) dot(img, x, y, C.y2);
  for (let x = 3; x < 21; x++) { dot(img, x, 7 + ((x >> 1) % 2), C.white); dot(img, x, 10 + (((x + 1) >> 1) % 2), C.b0); }
  rect(img, 1, 13, 22, 6, C.y2);
  ctext(img, 12, 14, '875', NAVY);
  rect(img, 1, 19, 22, 6, C.white);
  ctext(img, 12, 20, 'PRAIA', BLUE[1]);
  outlineAround(img);
  return { img, anchor: [12, 36] };
}

// ------------------------------------------------------------------ the barraca da Jô
/** Jô's coconut kiosk (3 x 1): posts, a slatted counter piled with green coconuts, and a thatched roof (the overhead part). */
function quiosque() {
  const W = 52, H = 48;
  const full = blank(W, H);
  // roof: a straw cone with a ridge, a ragged fringe
  const roof = poly([[3, 20], [49, 20], [41, 3], [11, 3]]);
  solid(full, (x, y) => roof(x, y) || (y >= 20 && y < 23 && x > 3 && x < 49 && h2(Math.floor(x), 0, 4) < 0.7), THATCH);
  for (let y = 5; y < 20; y += 3) for (let x = 4; x < 48; x++) if (roof(x + 0.5, y + 0.5) && h2(x, y, 6) < 0.5) dot(full, x, y, THATCH[0]);
  rect(full, 11, 2, 30, 2, THATCH[0]);
  rect(full, 12, 2, 28, 1, THATCH[2]);
  const roofImg = crop(full, 0, 0, W, 24);
  // the standing part
  const base = blank(W, H);
  for (const x of [6, 44]) post(base, x, 20, 46, WOODW);
  // string lights between the posts (bulbs drawn dark; the _lit overlay lights them)
  for (let x = 8; x < 44; x++) dot(base, x, 22 + Math.round(Math.sin(((x - 8) / 36) * Math.PI) * 2), C.navy2);
  const bulbs = [];
  for (let x = 10; x < 44; x += 5) { const y = 23 + Math.round(Math.sin(((x - 8) / 36) * Math.PI) * 2); dot(base, x, y, C.cr2); bulbs.push([x, y]); }
  // the counter: a cream top over teal-painted slats
  solid(base, box(4, 33, 48, 46), TEAL, { rimShade: 1 });
  for (let x = 7; x < 46; x += 4) for (let y = 34; y < 46; y++) dot(base, x, y, SEA.deep);
  solid(base, box(3, 30, 49, 33), CREAM);
  // coconuts on the counter, a pineapple-free stack, and a chalk menu hung on the left post
  for (const [cx, cy] of [[13, 28], [17, 28], [15, 25.5], [33, 28], [37, 28]]) solid(base, elp(cx, cy, 2.6, 2.4), GREEN);
  for (const [x, y] of [[13, 27], [33, 27], [15, 25]]) dot(base, x, y, C.y1);
  solid(base, box(22, 25, 28, 30), [C.lav, C.lav3, C.lav4, C.white]); // a styrofoam cooler
  rect(base, 22, 26, 6, 1, C.r2);
  solid(base, box(1, 24, 6, 31), ['#1f2a26', '#26332e', '#2f3d38', '#3a4a44'], { rimShade: 1 });
  for (const [x, y] of [[2, 26], [3, 26], [4, 26], [2, 28], [4, 28]]) dot(base, x, y, C.cr1);
  const baseImg = crop(base, 0, 20, W, H - 20);
  // lit: the bulbs and their little haloes
  const lit = blank(W, H - 20);
  for (const [x, y] of bulbs) {
    dot(lit, x, y - 20, '#fff6c0');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(lit, x + dx, y - 20 + dy, WARM, 150);
  }
  return {
    base: { img: baseImg, anchor: [26, H - 20 - 1] },
    roof: { img: roofImg, anchor: [26, H - 1] },
    lit: { img: lit, anchor: [26, H - 20 - 1] },
  };
}

/** The A-frame chalkboard at the kiosk: JÔ, a coconut, a stick of cheese. */
function placaJo() {
  const img = blank(16, 22);
  rect(img, 2, 18, 2, 4, C.w4); rect(img, 12, 18, 2, 4, C.w4);
  solid(img, box(2, 1, 14, 19), [C.w5, C.w4, C.w3, C.w2], { rimShade: 1 });
  rect(img, 3, 2, 10, 15, '#26332e');
  ctext(img, 8, 4, 'JÔ', C.cr0);
  for (const [x, y] of [[5, 11], [6, 11], [5, 12], [6, 12]]) dot(img, x, y, C.g1);
  for (let y = 10; y < 15; y++) dot(img, 10, y, C.cr2);
  rect(img, 9, 10, 3, 2, C.y2);
  return { img, anchor: [8, 21] };
}

/** The beach rack: a T-stand with a bucket hat, a visor and a cap. */
function araraChapeus() {
  const img = blank(24, 34);
  post(img, 11, 9, 32, WOODW);
  rect(img, 7, 32, 10, 2, C.w5);
  rect(img, 2, 9, 20, 2, C.w3);
  rect(img, 2, 9, 20, 1, C.w1);
  paste(img, hat('straw'), 6, 1);
  for (const x of [5, 18]) dot(img, x, 11, C.navy2);
  paste(img, hat('bucket'), 0, 12);
  paste(img, hat('cap'), 12, 12);
  outlineAround(img);
  return { img, anchor: [12, 33] };
}

/** "COMPRO PEIXE": a plank on a post with a fish under the words. */
function placaCompro() {
  const img = blank(30, 30);
  post(img, 14, 18, 30);
  solid(img, box(1, 1, 29, 19), WOODW, { rimShade: 1 });
  ctext(img, 15, 3, 'COMPRO', C.cr0, C.w5);
  ctext(img, 15, 9, 'PEIXE', C.cr0, C.w5);
  for (let x = 10; x < 19; x++) dot(img, x, 16, C.b1);
  for (let x = 11; x < 18; x++) dot(img, x, 15, C.b0);
  dot(img, 9, 15, C.b1); dot(img, 9, 17, C.b1); dot(img, 17, 15, NAVY);
  return { img, anchor: [15, 29] };
}

// ------------------------------------------------------------------ the lifeguard tower
function postoSalvaVidas() {
  const W = 38, H = 60;
  const img = blank(W, H);
  // stilts and braces
  for (const x of [5, 30]) post(img, x, 28, 59, WOODW, 3);
  for (let i = 0; i < 24; i++) { dot(img, 7 + i, 31 + i, C.w4); dot(img, 30 - i, 31 + i, C.w4); }
  // the ladder down the front right
  for (const x of [22, 27]) rect(img, x, 30, 1, 29, C.w2);
  for (let y = 33; y < 59; y += 4) rect(img, 22, y, 6, 1, C.w1);
  // the platform
  solid(img, box(2, 26, 36, 30), WOODW, { rimShade: 1 });
  // the cabin: white boards, red trim, a dark window and a number plate
  solid(img, box(5, 12, 33, 27), WHITE, { rimShade: 1 });
  rect(img, 5, 12, 28, 1, C.r2);
  rect(img, 5, 25, 28, 1, C.r3);
  solid(img, box(9, 15, 21, 22), ['#2a3a60', '#33467a', '#4a5f94', '#6a80b0'], { rimShade: 1, outline: false });
  rect(img, 9, 15, 12, 1, '#7f96c4');
  solid(img, box(24, 15, 30, 21), RED, { rimShade: 1 });
  ctext(img, 27, 16, '1', C.white);
  // the roof, red with a lighter ridge
  solid(img, poly([[2, 13], [36, 13], [30, 5], [8, 5]]), RED);
  rect(img, 9, 5, 20, 1, C.r0);
  // the flag on its pole (left) and the lamp on the right corner
  rect(img, 3, 0, 1, 13, C.slate);
  for (let y = 0; y < 5; y++) for (let x = 4; x < 11 - y; x++) dot(img, x, y, y < 1 ? C.r1 : C.r3);
  rect(img, 33, 8, 3, 3, C.slate2);
  dot(img, 34, 9, C.cr2);
  outlineAround(img);
  const lit = blank(W, H);
  for (let y = 15; y < 22; y++) for (let x = 9; x < 21; x++) glow(lit, x, y, WARM, y < 17 ? 220 : 170);
  dot(lit, 34, 9, '#fff6c0');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(lit, 34 + dx, 9 + dy, WARM, 160);
  return { img, anchor: [19, 59], lit, light: { x: 34, y: 9, r: 44, color: '#ffd890' } };
}

/** "PROIBIDO PESCAR" (the joke the mentor explains: you fish from the shore row, not under the lifeguard). */
function placaProibido() {
  const img = blank(40, 30);
  post(img, 19, 18, 30, STEEL);
  solid(img, box(1, 1, 39, 19), WHITE, { rimShade: 1 });
  for (let x = 2; x < 38; x++) { dot(img, x, 2, C.r3); dot(img, x, 17, C.r3); }
  for (let y = 2; y < 18; y++) { dot(img, 2, y, C.r3); dot(img, 37, y, C.r3); }
  ctext(img, 20, 4, 'PROIBIDO', C.r4);
  ctext(img, 20, 11, 'PESCAR', NAVY);
  return { img, anchor: [20, 29] };
}

// ------------------------------------------------------------------ Seu Bento's shack
function galpao() {
  const W = 68, H = 66;
  const img = blank(W, H);
  const BOARDS = ['#2a557c', '#346694', '#4479a8', '#5b8fbc'];
  // walls: vertical blue boards with dark seams, weathered spots
  solid(img, box(2, 22, 66, 65), BOARDS, { rimShade: 1 });
  for (let x = 6; x < 66; x += 5) for (let y = 23; y < 64; y++) dot(img, x, y, BOARDS[0]);
  for (let y = 23; y < 64; y++) for (let x = 3; x < 65; x++) if (h2(x, y, 31) < 0.03) dot(img, x, y, '#7ea6c8');
  // the plaque over the door: BARCOS DO BENTO
  solid(img, box(3, 24, 65, 33), CREAM, { rimShade: 1 });
  ctext(img, 34, 26, 'BARCOS DO BENTO', '#2a3a60');
  // the big open door with a boat's bow inside in the dark
  rect(img, 22, 37, 22, 28, '#1f2436');
  rect(img, 22, 37, 22, 1, C.w5);
  for (let y = 50; y < 65; y++) for (let x = 27; x < 27 + Math.min(14, (y - 48) * 2); x++) dot(img, x, y, y < 53 ? C.cr1 : '#3a5f8c');
  // a window (lit at night)
  solid(img, box(50, 39, 61, 49), [C.w5, C.w4, C.w3, C.w2], { rimShade: 1 });
  rect(img, 51, 40, 9, 8, '#2a3a60');
  rect(img, 55, 40, 1, 8, C.w4);
  // the life ring (red and white quarters) and two oars on the left wall
  for (let y = 37; y < 50; y++) for (let x = 5; x < 18; x++) {
    const d = Math.hypot(x + 0.5 - 11.5, y + 0.5 - 43.5);
    if (d <= 6.2 && d >= 3) dot(img, x, y, (Math.atan2(y - 43.5, x - 11.5) + Math.PI) / (Math.PI / 2) % 2 < 1 ? C.r3 : C.white);
  }
  for (const x of [18, 20]) { rect(img, x, 36, 1, 22, C.w2); rect(img, x - 1, 54, 3, 6, C.w3); }
  // corrugated tin roof
  solid(img, poly([[0, 23], [68, 23], [62, 3], [6, 3]]), ['#6c7a86', '#85939e', '#a0adb6', '#c0cad0']);
  for (let x = 4; x < 66; x += 3) for (let y = 4; y < 23; y++) if (poly([[0, 23], [68, 23], [62, 3], [6, 3]])(x + 0.5, y + 0.5)) dot(img, x, y, '#76848f');
  for (let x = 6; x < 62; x++) if (h2(x, 1, 7) < 0.12) dot(img, x, 12 + Math.round(h2(x, 2, 7) * 6), '#b0743e'); // rust
  outlineAround(img);
  const lit = blank(W, H);
  for (let y = 40; y < 48; y++) for (let x = 51; x < 60; x++) if (x !== 55) glow(lit, x, y, WARM, y < 42 ? 230 : 180);
  return { img, anchor: [34, 65], lit };
}

/** "ALUGUEL DE BARCOS" (two lines) on a post by the shack. */
function placaAluguel() {
  const img = blank(32, 30);
  post(img, 15, 17, 30, WOODW);
  solid(img, box(1, 1, 31, 18), CREAM, { rimShade: 1 });
  ctext(img, 16, 3, 'ALUGUEL', '#2a557c');
  ctext(img, 16, 10, 'BARCOS', C.r4);
  return { img, anchor: [16, 29] };
}

// ------------------------------------------------------------------ umbrellas, chairs
const STRIPES = { a: [TERRA, CREAM], b: [MUST, CREAM], c: [SPG, CREAM] };
/** An open beach umbrella: the pole (standing) and the striped canopy (overhead). */
function guardaSol(kind) {
  const W = 36, H = 40;
  const [col, cream] = STRIPES[kind];
  const canopy = blank(W, H);
  const cx = 18, cy = 12;
  const dome = (x, y) => {
    const dx = (x - cx) / 16.5, dy = (y - cy) / 9;
    if (y > cy + 2 + Math.cos(((x - cx) / 16.5) * Math.PI * 4) * 1.2) return false; // a scalloped hem
    return dx * dx + dy * dy <= 1;
  };
  const m = mask(W, H, dome);
  const ang = (x, y) => Math.atan2(y - (cy - 9), x - cx);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m.a[y * W + x]) continue;
    const seg = Math.floor(((ang(x + 0.5, y + 0.5) + Math.PI) / Math.PI) * 8) % 2;
    const ramp = seg ? col : cream;
    const lit = x + y < cx + cy - 6, dark = y > cy || x > cx + 10;
    put(canopy, x, y, lit ? ramp[3] : dark ? ramp[1] : ramp[2]);
  }
  outlineAround(canopy);
  rect(canopy, cx - 1, 2, 2, 2, C.cr0); // finial
  const pole = blank(W, H);
  rect(pole, cx - 1, 18, 2, 21, C.lav3);
  rect(pole, cx - 1, 18, 1, 21, C.white);
  rect(pole, cx - 3, 38, 6, 2, SAND.lo2);
  outlineAround(pole);
  const closed = blank(W, H);
  rect(closed, cx - 1, 6, 2, 33, C.lav3);
  solid(closed, poly([[cx - 3.5, 30], [cx + 3.5, 30], [cx + 1, 8], [cx - 1, 8]]), col);
  for (let y = 10; y < 30; y += 4) for (let x = cx - 3; x < cx + 4; x++) if (opaque(closed, x, y)) dot(closed, x, y, cream[2]);
  rect(closed, cx - 3, 38, 6, 2, SAND.lo2);
  return { pole: { img: pole, anchor: [cx, H - 1] }, canopy: { img: canopy, anchor: [cx, H - 1] }, closed: { img: closed, anchor: [cx, H - 1] } };
}

/** A folding beach chair facing the camera, striped fabric. */
function cadeiraPraia(fabric) {
  const img = blank(18, 22);
  for (const x of [3, 14]) { rect(img, x, 6, 1, 15, C.mist); dot(img, x, 6, C.white); }
  for (let i = 0; i < 8; i++) { dot(img, 4 + i, 21 - (i >> 1), C.mist); }
  solid(img, box(4, 3, 14, 13), [C.lav, C.lav3, C.lav4, C.white], { outline: false });
  for (let y = 3; y < 13; y++) for (let x = 4; x < 14; x++) dot(img, x, y, ((x - 4) >> 1) % 2 ? fabric[2] : C.white);
  for (let y = 13; y < 17; y++) for (let x = 4; x < 14; x++) dot(img, x, y, ((x - 4) >> 1) % 2 ? fabric[1] : C.lav4);
  rect(img, 3, 12, 12, 1, C.mist);
  outlineAround(img);
  return { img, anchor: [9, 21] };
}

// ------------------------------------------------------------------ sand details
function casteloAreia() {
  const img = blank(18, 16);
  const S4 = [SAND.speck, SAND.lo2, SAND.lo, SAND.hi];
  solid(img, box(2, 8, 16, 15), S4, { rimShade: 1 });
  for (const [x, w, top] of [[2, 4, 3], [7, 4, 5], [12, 4, 2]]) solid(img, box(x, top, x + w, 9), S4, { rimShade: 1 });
  for (const x of [3, 5, 13, 15]) dot(img, x, 2, S4[2]);
  rect(img, 8, 10, 2, 4, SAND.speck); // the gate
  rect(img, 13, 0, 1, 3, C.w3);
  for (const [x, y] of [[14, 0], [15, 0], [14, 1]]) dot(img, x, y, C.p1);
  return { img, anchor: [9, 15] };
}
function concha(kind) {
  const img = blank(8, 7);
  if (kind === 'a') {
    // a scallop, ribs fanning from the hinge
    solid(img, (x, y) => elp(4, 4, 3.4, 3)(x, y) && y > 1, [SAND.pink, '#f2cbbd', '#f8e3d8', SAND.shell], { rimShade: 1, ol: '#b08c7a' });
    for (const x of [2, 4, 6]) dot(img, x, 3, '#e3aa98');
  } else {
    // a little cone snail
    solid(img, poly([[1, 5.5], [7, 5.5], [5, 1], [3.5, 1]]), ['#b98a5c', '#d7ad7c', '#ecd1a8', '#f8ead0'], { rimShade: 1, ol: '#8a6a4a' });
    dot(img, 4, 3, '#a87a4c'); dot(img, 5, 4, '#a87a4c');
  }
  return { img, anchor: [4, 6] };
}
function pegadas() {
  const img = blank(16, 18);
  const foot = (fx, fy) => {
    for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [0, 0], [1, 0]]) glow(img, fx + dx, fy + dy, '#a88a58', 110);
    glow(img, fx, fy - 1, '#a88a58', 80); glow(img, fx + 1, fy - 1, '#a88a58', 80);
  };
  foot(2, 12); foot(6, 7); foot(9, 9); foot(12, 3);
  return { img, anchor: [8, 17] };
}
function madeiraMar() {
  const img = blank(24, 10);
  solid(img, (x, y) => Math.abs(y - 6 + (x - 12) * 0.08) < 2.2 && x > 1 && x < 22, ['#8a8478', '#a8a296', '#c7c1b4', '#e0dbcf'], { rimShade: 1 });
  solid(img, poly([[16, 4], [19, 0.5], [20.5, 1.2], [18, 5]]), ['#8a8478', '#a8a296', '#c7c1b4', '#e0dbcf'], { rimShade: 1 });
  for (let x = 4; x < 20; x += 5) dot(img, x, 6, '#8a8478');
  return { img, anchor: [12, 9] };
}
/** A caiçara canoe pulled up on the sand: dark wood, pointed both ends, a paddle across it. */
function canoa() {
  const img = blank(36, 14);
  const hullP = (x, y) => { const u = (x - 18) / 17; return Math.abs(y - 7) <= 4.2 * Math.sqrt(Math.max(0, 1 - u * u)) && Math.abs(u) <= 1; };
  solid(img, (x, y) => hullP(x, y - 1.5), ['#3a2a20', '#55402e', '#6f553d', '#8a6c4e'], { rimShade: 1 });
  solid(img, (x, y) => { const u = (x - 18) / 15; return Math.abs(y - 6) <= 2.6 * Math.sqrt(Math.max(0, 1 - u * u)) && Math.abs(u) <= 1; }, ['#6f553d', '#8a6c4e', '#a3835f', '#bd9c74'], { rimShade: 1, outline: false });
  for (let x = 10; x < 27; x++) dot(img, x, 5 + Math.round((x - 10) * 0.12), C.w1);
  rect(img, 26, 5, 3, 2, C.w2);
  rect(img, 4, 8, 28, 1, C.r4); // a red line painted along the side
  return { img, anchor: [18, 13] };
}
/** A fishing net drying on two poles, floats along its top. */
function redeSecando() {
  const img = blank(34, 26);
  for (const x of [2, 30]) post(img, x, 2, 26, WOODW);
  for (let y = 4; y < 22; y++) for (let x = 4; x < 30; x++) {
    const sag = Math.round(Math.sin(((x - 4) / 26) * Math.PI) * 3);
    if (y < 5 + sag) continue;
    if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) dot(img, x, y, y > 18 ? '#3f6e52' : '#4f8a63');
  }
  for (let x = 6; x < 30; x += 5) { const sag = Math.round(Math.sin(((x - 4) / 26) * Math.PI) * 3); rect(img, x, 4 + sag, 2, 2, C.y3); }
  outlineAround(img);
  return { img, anchor: [17, 25] };
}
/** Dona Neide's bucket, a fish tail sticking out. */
function balde() {
  const img = blank(12, 14);
  solid(img, poly([[1.5, 4], [10.5, 4], [9.5, 13], [2.5, 13]]), BLUE, { rimShade: 1 });
  rect(img, 1, 4, 10, 1, BLUE[3]);
  for (let x = 2; x < 10; x++) dot(img, x, 2 - Math.round(Math.sin(((x - 2) / 7) * Math.PI) * 1.5), C.mist);
  for (const [x, y] of [[6, 3], [7, 2], [8, 1], [5, 2], [4, 1]]) dot(img, x, y, C.mist2);
  outlineAround(img);
  return { img, anchor: [6, 13] };
}
/** A rod leaning on a forked stick, its line hanging. */
function varaApoiada() {
  const img = blank(14, 30);
  for (let i = 0; i < 26; i++) dot(img, 2 + Math.round(i * 0.4), 28 - i, i < 6 ? C.navy2 : C.w2);
  rect(img, 3, 22, 3, 3, C.slate2); // the reel
  rect(img, 9, 17, 1, 12, C.w4);
  dot(img, 8, 16, C.w4); dot(img, 10, 16, C.w4);
  for (let y = 3; y < 16; y++) dot(img, 12, y, C.lav3);
  dot(img, 12, 16, C.r3); dot(img, 12, 17, C.white);
  return { img, anchor: [7, 29] };
}
/** The free fishing spot's marker: a stake with a little PESCA plate and a rod holder. */
function pescaStake() {
  const img = blank(24, 22);
  post(img, 11, 6, 22, WOODW);
  solid(img, box(1, 1, 23, 8), YEL, { rimShade: 1 });
  ctext(img, 12, 2, 'PESCA', NAVY);
  rect(img, 14, 12, 3, 1, C.slate2); rect(img, 16, 9, 1, 4, C.slate2);
  return { img, anchor: [12, 21] };
}
/** The marker on decks: a mooring bollard with a coil of rope. */
function pescaBollard() {
  const img = blank(14, 14);
  solid(img, box(4, 3, 10, 12), STEEL, { rimShade: 1 });
  solid(img, box(2, 2, 12, 5), STEEL, { rimShade: 1 });
  for (let x = 1; x < 13; x++) { dot(img, x, 11 + (x % 3 === 0 ? 1 : 0), '#c9a86c'); dot(img, x, 12, '#a88a52'); }
  rect(img, 6, 6, 2, 1, C.y2);
  return { img, anchor: [7, 13] };
}

// ------------------------------------------------------------------ the lagoa
function pedras(kind) {
  const sets = {
    a: { w: 20, h: 16, rocks: [[9, 9, 6, 5], [14, 11, 4, 3]] },
    b: { w: 36, h: 18, rocks: [[9, 10, 7, 5.5], [20, 8, 8, 6], [28, 12, 5, 4], [15, 13, 4, 3]] },
    c: { w: 36, h: 32, rocks: [[18, 12, 10, 8], [9, 20, 7, 6], [26, 22, 8, 7], [17, 26, 5, 4]] },
  };
  const s = sets[kind];
  const img = blank(s.w, s.h);
  for (const [cx, cy, rx, ry] of [...s.rocks].sort((p, q) => p[1] - q[1])) {
    solid(img, (x, y) => elp(cx, cy, rx, ry)(x, y) && y < cy + ry * 0.7, ROCK);
    dot(img, Math.round(cx - rx * 0.3), Math.round(cy - ry * 0.4), '#c9c2cc');
    if (rx > 5) dot(img, Math.round(cx + 1), Math.round(cy), '#9fb06a');
  }
  return { img, anchor: [Math.floor(s.w / 2), s.h - 1] };
}
/** Taboa (cattails) by the lagoa: green blades and brown heads. */
function taboa() {
  const img = blank(16, 26);
  for (const [x, lean, top] of [[4, -0.15, 6], [7, 0.05, 2], [10, 0.2, 5], [12, 0.35, 9], [6, -0.3, 10]]) {
    for (let y = top; y < 25; y++) dot(img, Math.round(x + (25 - y) * lean), y, y < top + 3 ? C.g1 : C.g2);
  }
  for (const [x, y] of [[7, 3], [4, 8], [10, 7]]) { rect(img, x, y, 2, 4, C.w4); dot(img, x, y, C.w3); }
  outlineAround(img);
  return { img, anchor: [8, 25] };
}

// ------------------------------------------------------------------ the costão
/** The rocky headland: one tall pile of weathered granite boulders (6 x 17 tiles), lichen, a few tufts on its top. */
function costao() {
  const W = 100, H = 286;
  const img = blank(W, H);
  const rocks = [];
  // back to front: rows of boulders, a few larger ones, jittered; the left edge stays ragged
  for (let row = 0; row < 24; row++) {
    const cy = 10 + row * 11.6;
    for (let k = 0; k < 5; k++) {
      const rx = 9 + h2(row, k, 3) * 9;
      const ry = 6 + h2(row, k, 4) * 5;
      const cx = 8 + k * 21 + (h2(row, k, 5) - 0.5) * 10 + (row % 2) * 8;
      if (cx - rx < 1 || cx + rx > W - 1) continue;
      rocks.push([cx, cy + (h2(row, k, 6) - 0.5) * 5, rx, ry, row * 10 + k]);
    }
  }
  rocks.sort((p, q) => p[1] - q[1]);
  for (const [cx, cy, rx, ry, seed] of rocks) {
    const wob = (x, y) => {
      const a = Math.atan2(y - cy, x - cx);
      const r = 1 + Math.sin(a * 3 + seed) * 0.08 + Math.cos(a * 5 + seed * 2) * 0.05;
      return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r;
    };
    if (cy + ry > H - 1) continue;
    solid(img, wob, ROCK, { rimShade: 2 });
    // a crack and lichen
    for (let i = 0; i < rx * 0.8; i++) { const x = Math.round(cx - rx * 0.3 + i), y = Math.round(cy + Math.sin(i + seed) * 1.2); if (wob(x + 0.5, y + 0.5) && h2(x, y, seed) < 0.6) dot(img, x, y, ROCK[0]); }
    for (let n = 0; n < 4; n++) {
      const x = Math.round(cx + (h2(seed, n, 8) - 0.5) * rx), y = Math.round(cy - ry * 0.3 + (h2(seed, n, 9) - 0.5) * ry * 0.6);
      if (wob(x + 0.5, y + 0.5)) dot(img, x, y, n % 2 ? '#a8b46a' : '#c9cf8a');
    }
    // the gulls' marks on the upper rocks
    if (h2(seed, 1, 12) < 0.3) dot(img, Math.round(cx + 2), Math.round(cy - ry * 0.5), C.white);
  }
  // tufts of restinga on the top
  for (let x = 6; x < 94; x += 7) for (let i = 0; i < 4; i++) dot(img, x + i, 5 + (i % 2), i % 2 ? C.g1 : C.g2);
  return { img, anchor: [50, H - 1] };
}
/** PERIGO · CORRENTEZA: a yellow board with a red header. */
function placaPerigo() {
  const img = blank(46, 30);
  post(img, 22, 18, 30, STEEL);
  solid(img, box(1, 1, 45, 19), YEL, { rimShade: 1 });
  rect(img, 2, 2, 42, 7, C.r3);
  ctext(img, 23, 3, 'PERIGO', C.white);
  ctext(img, 23, 11, 'CORRENTEZA', NAVY);
  return { img, anchor: [23, 29] };
}
/** A gull standing on the rocks: two frames (head down, head turned). */
function gaivotaPousada() {
  const frame = (turn) => {
    const img = blank(14, 12);
    solid(img, elp(6.5, 7, 4.5, 3), WHITE, { rimShade: 1 });
    solid(img, (x, y) => elp(5, 6.2, 4, 2)(x, y) && y < 7.5, [C.slate, C.slate2, C.mist, C.mist2], { outline: false });
    rect(img, 1, 5, 2, 2, C.navy2); // the black wingtip
    solid(img, elp(turn ? 10 : 10.5, 4, 2.2, 2), WHITE, { rimShade: 1 });
    dot(img, turn ? 9 : 11, 3, NAVY);
    rect(img, turn ? 6 : 12, turn ? 4 : 4, 2, 1, C.y3);
    dot(img, 5, 10, C.y4); dot(img, 7, 10, C.y4); dot(img, 5, 11, C.y4); dot(img, 7, 11, C.y4);
    return img;
  };
  return { frames: [frame(false), frame(false), frame(true), frame(false)], anchor: [7, 11], fps: 1.2 };
}

// ------------------------------------------------------------------ the pier
function pierPoste() {
  const img = blank(8, 16);
  solid(img, box(2, 2, 6, 14), WOOD, { rimShade: 1 });
  rect(img, 2, 2, 4, 1, WOOD[3]);
  rect(img, 2, 11, 4, 1, '#5a6b5e'); // the tide line
  return { img, anchor: [4, 14] };
}
/** A rail section (overhead along the pier's side). */
function pierGrade() {
  const img = blank(16, 14);
  for (const x of [1, 14]) rect(img, x, 2, 1, 12, WOODW[1]);
  rect(img, 0, 2, 16, 2, WOODW[2]); rect(img, 0, 2, 16, 1, WOODW[3]);
  rect(img, 0, 8, 16, 1, WOODW[1]);
  outlineAround(img);
  return { img, anchor: [8, 13] };
}
/** An old iron lamp on the pier. */
function pierLampada() {
  const img = blank(12, 36);
  rect(img, 5, 10, 2, 25, '#2f4a40'); rect(img, 5, 10, 1, 25, '#3f6052');
  rect(img, 3, 33, 6, 3, '#2f4a40');
  solid(img, poly([[2.5, 9], [9.5, 9], [8, 3], [4, 3]]), ['#a8823a', '#e9c06a', '#ffe08a', '#fff2c0'], { rimShade: 1 });
  rect(img, 3, 1, 6, 2, '#2f4a40'); dot(img, 5, 0, '#2f4a40'); dot(img, 6, 0, '#2f4a40');
  rect(img, 2, 9, 8, 1, '#2f4a40');
  outlineAround(img);
  return { img, anchor: [6, 35], light: { x: 6, y: 6, r: 46, color: '#ffd890' } };
}
/** The end of the pier: a rail across it, a life ring hung in the middle. */
function pierFim() {
  const img = blank(34, 20);
  for (const x of [1, 16, 31]) rect(img, x, 4, 2, 15, WOODW[1]);
  rect(img, 0, 4, 34, 2, WOODW[2]); rect(img, 0, 4, 34, 1, WOODW[3]); rect(img, 0, 10, 34, 1, WOODW[1]);
  for (let y = 5; y < 16; y++) for (let x = 6; x < 15; x++) {
    const d = Math.hypot(x + 0.5 - 10.5, y + 0.5 - 10.5);
    if (d <= 4.6 && d >= 2.2) dot(img, x, y, (Math.atan2(y - 10.5, x - 10.5) + Math.PI) / (Math.PI / 2) % 2 < 1 ? C.r3 : C.white);
  }
  outlineAround(img);
  return { img, anchor: [17, 19] };
}
function placaPier() {
  const img = blank(22, 26);
  post(img, 10, 10, 26, WOODW);
  solid(img, box(1, 1, 21, 11), WOODW, { rimShade: 1 });
  ctext(img, 11, 3, 'PÍER', C.cr0, C.w5);
  return { img, anchor: [11, 25] };
}

// ------------------------------------------------------------------ boats
/**
 * A hull seen from above and a little from the south (stern west at the pier, bow east): the side band shows `side` px under the gunwale.
 * Returns the deck predicate (inside the gunwale) for the caller to furnish.
 */
function hull(img, ox, oy, w, h, { side = 4, ramp, stripe = null, gunwale = WHITE, deck = [DECK.lo, DECK.base, DECK.hi, DECK.hi] }) {
  const top = (x, y) => {
    const u = (x - ox) / w, v = (y - oy - h / 2) / (h / 2);
    if (u < 0 || u > 1) return false;
    let hw = 1;
    if (u > 0.58) hw = Math.sqrt(Math.max(0, 1 - ((u - 0.58) / 0.42) ** 1.8));
    if (u < 0.05) hw = Math.min(hw, 0.82 + u * 3.6);
    return Math.abs(v) <= hw;
  };
  const body = (x, y) => { for (let k = 0; k <= side; k++) if (top(x, y - k)) return true; return false; };
  solid(img, body, ramp, { rimShade: 2 });
  if (stripe) for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (body(x + 0.5, y + 0.5) && !top(x + 0.5, y + 0.5) && !body(x + 0.5, y + 2.5)) dot(img, x, y, stripe);
  solid(img, top, gunwale, { rimShade: 1, outline: false });
  const inner = (x, y) => top(x, y) && top(x - 2, y) && top(x + 2, y) && top(x, y - 2) && top(x, y + 2);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!inner(x + 0.5, y + 0.5)) continue;
    const r = (y - oy) & 3;
    put(img, x, y, r === 3 ? deck[0] : r === 0 ? deck[2] : deck[1]);
  }
  return inner;
}
/** The rowboat (2 x 1): green outside, a white gunwale, a thwart and the two oars shipped along it. */
function barcoRemo() {
  const img = blank(40, 26);
  const inner = hull(img, 2, 4, 36, 14, { side: 3, ramp: ['#1f5a40', '#2b7552', '#3a8f63', '#58ab7c'], stripe: C.white });
  rect(img, 16, 6, 3, 11, C.w3); rect(img, 16, 6, 1, 11, C.w1); // the thwart
  for (const y of [7, 15]) { for (let x = 6; x < 30; x++) dot(img, x, y, C.w2); rect(img, 29, y - 1, 4, 3, C.w2); }
  void inner;
  return { base: { img, anchor: [18, 20] } };
}
/** The fishing boat (3 x 2): a white hull with a blue band, nets in the stern, a cabin and a mast with a pennant (overhead). */
function barcoPesca() {
  const W = 58, H = 58;
  const img = blank(W, H);
  hull(img, 3, 14, 52, 30, { side: 5, ramp: WHITE, stripe: BLUE[1] });
  // the nets heaped in the stern, a crate
  solid(img, elp(12, 28, 6, 5), ['#2f5e44', '#3f7a58', '#58966f', '#78b08a']);
  for (let y = 24; y < 33; y += 2) for (let x = 7; x < 18; x += 3) if (elp(12, 28, 6, 5)(x + 0.5, y + 0.5)) dot(img, x, y, C.y3);
  solid(img, box(18, 31, 24, 36), WOODW, { rimShade: 1 });
  const over = blank(W, H);
  // cabin: white walls, blue roof, windows
  solid(over, box(28, 18, 44, 34), WHITE, { rimShade: 1 });
  solid(over, box(26, 14, 46, 19), BLUE);
  for (const x of [30, 35, 40]) { rect(over, x, 23, 3, 4, '#2a3a60'); dot(over, x, 23, '#7f96c4'); }
  // the mast and its pennant
  rect(over, 22, 0, 2, 30, C.lav3); rect(over, 22, 0, 1, 30, C.white);
  for (let y = 1; y < 5; y++) for (let x = 24; x < 31 - y; x++) dot(over, x, y, y < 2 ? C.y2 : C.y3);
  rect(over, 14, 9, 18, 1, C.lav2); // a boom
  outlineAround(over);
  return { base: { img, anchor: [27, 46] }, over: { img: over, anchor: [27, 46] } };
}
/** The deep-sea boat (4 x 2): a bigger navy-striped hull, a cabin with a radar dome, rod holders at the stern. */
function barcoAltoMar() {
  const W = 74, H = 62;
  const img = blank(W, H);
  hull(img, 3, 18, 68, 32, { side: 6, ramp: WHITE, stripe: NAVYB[1] });
  // the fighting chair in the stern
  solid(img, box(12, 30, 18, 37), STEEL, { rimShade: 1 });
  const over = blank(W, H);
  // rod holders: four rods angled up off the stern
  for (const [x, y] of [[8, 24], [8, 42], [14, 22], [14, 44]]) for (let i = 0; i < 14; i++) dot(over, x - Math.round(i * 0.45), y - i, i < 3 ? NAVY : C.lav3);
  solid(over, box(30, 20, 56, 40), WHITE, { rimShade: 1 });
  solid(over, box(28, 16, 58, 21), NAVYB);
  for (const x of [33, 39, 45, 51]) { rect(over, x, 25, 4, 5, '#2a3a60'); dot(over, x, 25, '#7f96c4'); }
  solid(over, elp(44, 12, 5, 4), WHITE); // the radar dome
  rect(over, 43, 3, 2, 6, C.slate2); rect(over, 39, 3, 10, 1, C.slate2);
  outlineAround(over);
  return { base: { img, anchor: [35, 50] }, over: { img: over, anchor: [35, 50] } };
}
/** The party boat (5 x 3): a mustard and teal hull, a wooden deck, the upper deck with rails, bunting and two speakers (overhead). */
function barcoFesta() {
  const W = 92, H = 74;
  const img = blank(W, H);
  hull(img, 3, 20, 86, 44, { side: 7, ramp: MUST, stripe: SEA.lo });
  // the grill and a cooler on the lower deck
  solid(img, box(14, 34, 22, 40), STEEL, { rimShade: 1 });
  solid(img, box(14, 46, 21, 51), BLUE, { rimShade: 1 });
  const over = blank(W, H);
  solid(over, box(36, 22, 74, 52), CREAM, { rimShade: 1 });
  solid(over, box(34, 16, 76, 23), TEAL);
  for (let x = 38; x < 72; x += 6) { rect(over, x, 28, 4, 5, '#2a3a60'); dot(over, x, 28, '#7f96c4'); }
  // upper deck rail and the bunting strung from a mast
  for (let x = 34; x < 77; x++) dot(over, x, 13, C.white);
  for (let x = 36; x < 76; x += 4) rect(over, x, 13, 1, 4, C.white);
  rect(over, 54, 0, 2, 16, C.lav3);
  const FLAGS = [C.r2, C.y2, C.g2, C.b1, C.p1];
  for (let i = 0; i < 12; i++) {
    const x = 8 + i * 4, y = 4 + Math.round(Math.abs(i - 6) * 0.9);
    dot(over, x, y, C.lav3); dot(over, x + 1, y + 1, FLAGS[i % 5]); dot(over, x + 2, y + 1, FLAGS[i % 5]); dot(over, x + 1, y + 2, FLAGS[i % 5]);
  }
  for (let i = 0; i < 9; i++) {
    const x = 58 + i * 3, y = 3 + i;
    dot(over, x, y, C.lav3); dot(over, x + 1, y + 1, FLAGS[(i + 2) % 5]); dot(over, x + 1, y + 2, FLAGS[(i + 2) % 5]);
  }
  for (const x of [38, 68]) { solid(over, box(x, 6, x + 5, 13), [C.navy, C.navy2, C.slate, C.slate2], { rimShade: 1 }); dot(over, x + 2, 9, C.slate2); }
  outlineAround(over);
  const lit = blank(W, H);
  for (let i = 0; i < 12; i++) glow(lit, 9 + i * 4, 5 + Math.round(Math.abs(i - 6) * 0.9), '#fff2b0', 230);
  for (let x = 38; x < 72; x += 6) for (let y = 28; y < 33; y++) for (let dx = 0; dx < 4; dx++) glow(lit, x + dx, y, WARM, 190);
  return { base: { img, anchor: [43, 66] }, over: { img: over, anchor: [43, 66] }, lit: { img: lit, anchor: [43, 66] } };
}

// ------------------------------------------------------------------ the party deck
function festaGrade() {
  const img = blank(16, 12);
  for (const x of [0, 8]) rect(img, x, 2, 1, 10, C.lav3);
  rect(img, 0, 2, 16, 1, C.white); rect(img, 0, 6, 16, 1, C.lav3);
  return { img, anchor: [8, 11] };
}
function festaCabine() {
  const W = 50, H = 78;
  const img = blank(W, H);
  solid(img, box(2, 18, 48, 77), CREAM, { rimShade: 1 });
  solid(img, box(0, 12, 50, 19), TEAL);
  solid(img, box(6, 22, 44, 34), ['#2a3a60', '#33467a', '#4a5f94', '#6a80b0'], { rimShade: 1, outline: false });
  rect(img, 6, 22, 38, 1, '#8aa0cc');
  for (const x of [18, 31]) rect(img, x, 22, 1, 12, CREAM[2]);
  // the captain's wheel seen through the glass
  for (let a = 0; a < 16; a++) dot(img, Math.round(25 + Math.cos((a / 16) * Math.PI * 2) * 4), Math.round(30 + Math.sin((a / 16) * Math.PI * 2) * 3), C.w2);
  // a door, a horn on the roof, the sign
  solid(img, box(30, 48, 42, 77), [C.w5, C.w4, C.w3, C.w2], { rimShade: 1 });
  dot(img, 32, 62, C.y2);
  solid(img, box(5, 40, 26, 48), MUST, { rimShade: 1 });
  ctext(img, 15, 42, 'FESTA', NAVY);
  solid(img, box(20, 6, 30, 12), WHITE);
  return { img, anchor: [25, 77] };
}
function festaSom() {
  const img = blank(14, 24);
  solid(img, box(2, 2, 12, 23), [C.navy, C.navy2, C.slate, C.slate2], { rimShade: 1 });
  for (const [cy, r] of [[8, 3.2], [17, 4]]) for (let y = 0; y < 24; y++) for (let x = 0; x < 14; x++) { const d = Math.hypot(x + 0.5 - 7, y + 0.5 - cy); if (d < r) dot(img, x, y, d < 1.2 ? C.slate2 : d > r - 1 ? C.mist : NAVY); }
  return { img, anchor: [7, 23] };
}
function festaChurrasqueira() {
  const img = blank(18, 24);
  for (const x of [4, 13]) rect(img, x, 14, 1, 10, C.slate);
  solid(img, (x, y) => elp(9, 13, 7, 4)(x, y) && y > 11, STEEL);
  for (let x = 3; x < 16; x += 2) dot(img, x, 11, C.lav3);
  for (const [x, c] of [[5, C.r3], [8, C.y3], [11, C.r4]]) { rect(img, x, 9, 2, 2, c); dot(img, x + 1, 8, C.w3); }
  for (const [x, y] of [[8, 5], [9, 3], [8, 1], [11, 4], [12, 2]]) glow(img, x, y, '#e9e6f0', 120);
  return { img, anchor: [9, 23] };
}
function festaCooler() {
  const img = blank(14, 12);
  solid(img, box(1, 4, 13, 11), BLUE, { rimShade: 1 });
  solid(img, box(1, 2, 13, 5), WHITE, { rimShade: 1 });
  rect(img, 5, 1, 4, 1, C.lav);
  return { img, anchor: [7, 11] };
}
/** CHURRASCO · REFRI · MÚSICA, a little board: a skewer, a soda can and a note (the words are the hotspot). */
function festaPlaca() {
  const img = blank(20, 24);
  post(img, 9, 14, 24, WOODW);
  solid(img, box(1, 1, 19, 15), ['#1f2a26', '#26332e', '#2f3d38', '#3a4a44'], { rimShade: 1 });
  for (let x = 3; x < 8; x++) dot(img, x, 7, C.cr2);
  rect(img, 4, 5, 3, 2, C.r3);
  rect(img, 9, 4, 3, 6, C.r2); dot(img, 10, 4, C.lav3);
  rect(img, 15, 4, 1, 6, C.cr0); dot(img, 14, 9, C.cr0); dot(img, 13, 9, C.cr0); dot(img, 16, 4, C.cr0); dot(img, 17, 5, C.cr0);
  ctext(img, 10, 11, 'FESTA', C.y1);
  return { img, anchor: [10, 23] };
}

// ------------------------------------------------------------------ living things
/** The foam that rolls up the shore: 3 frames of a 16 x 6 strip, the lace moving east. Semi-transparent white over the water. */
function onda(k) {
  const img = blank(16, 6);
  for (let x = 0; x < 16; x++) {
    const ph = ((x + k * 5) / 16) * Math.PI * 2;
    const crest = 1 + Math.round((Math.sin(ph) + 1) * 0.9);
    for (let y = 0; y < 6; y++) {
      if (y < crest - 1) continue;
      if (y === crest - 1 || y === crest) glow(img, x, y, SEA.foam, 230);
      else if (y === crest + 1 && h2(x, k, 3) < 0.7) glow(img, x, y, SEA.foam2, 150);
      else if (h2(x * 3 + k, y, 4) < 0.25) glow(img, x, y, SEA.foam2, 90);
    }
  }
  return { img, anchor: [0, 0] };
}
/** The gull flock: the Vila's pigeon strip (6 frames) recoloured to white with grey wings. */
async function gaivotaFlock(ctx) {
  const src = stripSoftAlpha(await ctx.sheet('pigeon'));
  const ramp = ['#3a3a50', '#6d7383', '#9ca2b1', '#c9ced8', '#eceff3', '#ffffff'];
  const frames = [];
  for (let i = 0; i < 6; i++) frames.push(recolorRamp(crop(src, i * 16, 0, 16, 16), ramp));
  // a yellow beak: the frontmost lit pixel of the head row
  for (const f of frames) {
    for (let y = 2; y < 9; y++) {
      let xr = -1;
      for (let x = 15; x >= 0; x--) if (opaque(f, x, y)) { xr = x; break; }
      if (xr > 9) { put(f, xr, y, C.y3); break; }
    }
  }
  return { frames, anchor: [8, 14], fps: 6 };
}
/** A crab, 2 frames (legs in, legs out). Night only, on the shore row. */
function caranguejo() {
  const frame = (k) => {
    const img = blank(12, 9);
    solid(img, elp(6, 5, 3.6, 2.4), ['#9a3a24', '#c45c26', '#e0783a', '#f0a060'], { rimShade: 1 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) dot(img, 6 + s * (4 + (k ? 1 : 0)), 5 + i - 1 + (i === 1 && k ? 1 : 0), '#9a3a24');
      dot(img, 6 + s * 4, 2, '#c45c26'); dot(img, 6 + s * (4 + 1), 1, '#e0783a');
    }
    dot(img, 5, 3, NAVY); dot(img, 7, 3, NAVY);
    return img;
  };
  return { frames: [frame(0), frame(1)], anchor: [6, 8], fps: 4 };
}

// ------------------------------------------------------------------ kitnet furniture (beach items, earned and sold)
const FURN = {
  /** a giant scallop shell on a little stand */
  concha_grande: () => {
    const img = blank(18, 18);
    rect(img, 7, 14, 4, 3, C.w3);
    solid(img, (x, y) => elp(9, 10, 7.5, 6.5)(x, y) && y > 3, ['#d48a7a', SAND.pink, '#f6d6c8', SAND.shell], { rimShade: 1 });
    for (const x of [4, 7, 9, 11, 14]) for (let y = 5; y < 14; y++) if (elp(9, 10, 7.5, 6.5)(x + 0.5, y + 0.5) && y > 4) dot(img, x, y, '#e3aa98');
    return { img, anchor: [9, 17] };
  },
  concha_pequena: () => {
    const img = blank(12, 10);
    solid(img, (x, y) => elp(6, 6, 4.4, 3.6)(x, y) && y > 2, ['#c9a88a', '#e6cdb0', '#f4e4cc', SAND.shell], { rimShade: 1 });
    dot(img, 4, 5, '#c9a88a'); dot(img, 6, 4, '#c9a88a'); dot(img, 8, 5, '#c9a88a');
    return { img, anchor: [6, 9] };
  },
  /** a surfboard leaning upright */
  prancha: () => {
    const img = blank(12, 32);
    solid(img, elp(6, 15, 4.2, 14.5), [C.b4, C.b3, C.b1, C.b0], { rimShade: 1 });
    for (let y = 3; y < 28; y++) dot(img, 6, y, C.white);
    for (let y = 12; y < 18; y++) for (let x = 3; x < 10; x++) if (elp(6, 15, 4.2, 14.5)(x + 0.5, y + 0.5) && (y === 12 || y === 17)) dot(img, x, y, C.y2);
    return { img, anchor: [6, 30] };
  },
  /** a fishing net hung on a frame, two floats and a starfish caught in it */
  rede_pesca_parede: () => {
    const img = blank(18, 24);
    for (const x of [1, 16]) rect(img, x, 1, 1, 22, C.w3);
    rect(img, 1, 1, 16, 1, C.w2);
    for (let y = 3; y < 20; y++) for (let x = 2; x < 16; x++) if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) dot(img, x, y, '#4f8a63');
    rect(img, 4, 3, 2, 2, C.y3); rect(img, 12, 3, 2, 2, C.r3);
    for (const [x, y] of [[9, 11], [8, 12], [10, 12], [9, 13], [7, 13], [11, 13], [8, 14], [10, 14]]) dot(img, x, y, C.y4);
    outlineAround(img);
    return { img, anchor: [9, 23] };
  },
  /** a life ring on a post */
  boia_parede: () => {
    const img = blank(16, 22);
    rect(img, 7, 12, 2, 10, C.w3);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d <= 6.6 && d >= 3.2) dot(img, x, y, (Math.atan2(y - 8, x - 8) + Math.PI) / (Math.PI / 2) % 2 < 1 ? C.r3 : C.white);
    }
    outlineAround(img);
    return { img, anchor: [8, 21] };
  },
  /** the message in a bottle, on a little driftwood shelf */
  garrafa_mensagem: () => {
    const img = blank(16, 16);
    solid(img, box(1, 11, 15, 14), ['#8a8478', '#a8a296', '#c7c1b4', '#e0dbcf'], { rimShade: 1 });
    solid(img, or(elp(7, 7, 5, 3), box(11, 6, 15, 9)), ['#2f6e4a', '#3f8a5c', '#5aa878', '#8ccfa2'], { rimShade: 1 });
    rect(img, 14, 6, 1, 3, C.w3);
    rect(img, 4, 6, 6, 2, C.cr1);
    return { img, anchor: [8, 15] };
  },
  /** the beach chair as kitnet furniture */
  cadeira_praia: () => cadeiraPraia([C.b4, C.b3, C.b1, C.b0]),
};

// ------------------------------------------------------------------ icons: fish, junk, snacks
const N = 16;
const icon = () => blank(N, N);
/**
 * One fish facing right, lit from the upper left: body ellipse, a forked or round tail, dorsal and belly fins, an eye. `o` tunes it:
 * back / belly ramps, length, depth, stripes, spots, the special parts (a marlin's bill and sail, a puffer's spines, catfish barbels).
 */
function fish(o) {
  const img = icon();
  const cx = o.cx ?? 8.5, cy = o.cy ?? 8.2, rx = o.rx ?? 5.6, ry = o.ry ?? 3;
  // tail
  const tx = cx - rx + 0.8;
  const tail = o.roundTail
    ? elp(tx - 1.6, cy, 2.2, 2.6)
    : poly([[tx + 0.6, cy - 0.8], [tx - 3.4, cy - (o.tailH ?? 3.6)], [tx - 2.4, cy], [tx - 3.4, cy + (o.tailH ?? 3.6)], [tx + 0.6, cy + 0.8]]);
  shape(img, tail, [tx - 2, cy, 3, 3.5], o.fin ?? o.back, { ol: NAVY });
  // dorsal fin (a sail for the marlin)
  const dorsal = o.sail ? poly([[cx - 3, cy - ry + 0.6], [cx - 2.5, cy - ry - 4.6], [cx + 2.5, cy - ry - 3.2], [cx + 2, cy - ry + 0.6]]) : poly([[cx - 2.2, cy - ry + 0.8], [cx - 0.6, cy - ry - (o.dorsalH ?? 1.8)], [cx + 1.8, cy - ry + 0.8]]);
  shape(img, dorsal, [cx, cy - ry - 1, 3, 2], o.fin ?? o.back, { ol: NAVY });
  // body: the back ramp above the lateral line, the belly below
  const body = o.spiky ? elp(cx, cy, rx, ry) : (x, y) => elp(cx, cy, rx, ry)(x, y) && !(x > cx + rx - 1.4 && Math.abs(y - cy) > ry - 1.2);
  shape(img, body, [cx, cy, rx, ry], o.back, { ol: NAVY, pattern: (x, y, idx) => (y > cy + (o.bellyAt ?? 0.4) ? Math.min(3, idx + 1) : idx) });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (body(x + 0.5, y + 0.5) && y + 0.5 > cy + (o.bellyAt ?? 0.4) + 0.6) put(img, x, y, y + 0.5 > cy + ry - 1.2 ? o.belly[0] : o.belly[1]);
  // markings
  if (o.line) for (let x = Math.ceil(cx - rx + 1); x < cx + rx - 1.5; x++) put(img, x, Math.round(cy + (o.lineDy ?? 0)), o.line);
  if (o.bars) for (const bx of o.bars) for (let y = 0; y < N; y++) if (body(bx + 0.5, y + 0.5) && y < cy + ry - 1) put(img, bx, y, o.barC);
  if (o.spots) for (const [x, y] of o.spots) put(img, x, y, o.spotC);
  if (o.eyespot) { put(img, Math.round(tx), Math.round(cy - 1), NAVY); put(img, Math.round(tx), Math.round(cy - 2), C.y2); }
  // special parts
  if (o.bill) for (let x = Math.round(cx + rx - 0.5); x < 16; x++) put(img, x, Math.round(cy - 0.5), o.back[1]);
  if (o.spiky) for (let a = 0; a < 12; a++) { const ang = (a / 12) * Math.PI * 2; put(img, Math.round(cx + Math.cos(ang) * (rx + 0.8)), Math.round(cy + Math.sin(ang) * (ry + 0.8)), o.back[0]); }
  if (o.barbels) { for (const [x, y] of [[cx + rx, cy + 1], [cx + rx + 1, cy + 2], [cx + rx + 1, cy + 1], [cx + rx + 2, cy + 3]]) put(img, Math.round(x), Math.round(y), NAVY); }
  if (o.finlets) for (let x = Math.round(cx - rx + 1.5); x < cx - 1; x += 2) { put(img, x, Math.round(cy - ry), C.y2); put(img, x, Math.round(cy + ry), C.y2); }
  // eye
  const ex = Math.round(cx + rx - (o.eyeIn ?? 2.2)), ey = Math.round(cy - (o.eyeUp ?? 0.8));
  put(img, ex, ey, C.white); put(img, ex + (o.big ? 0 : 1), ey + (o.big ? 1 : 0), NAVY);
  if (o.mouth) put(img, Math.round(cx + rx - 0.6), Math.round(cy + 0.6), NAVY);
  return img;
}
const SILVER = [C.mist, C.mist2, C.lav3, C.white];
export const FISH_ART = {
  bagre: () => fish({ back: ['#5a5560', '#77707a', '#948a8c', '#b0a6a2'], belly: ['#c9c0b4', '#ddd4c6'], barbels: true, ry: 2.8, roundTail: false, tailH: 3 }),
  sardinha: () => fish({ back: ['#2f4f86', '#4070b0', '#6a9ad0', '#a6c8ec'], belly: [C.lav4, C.white], rx: 5.4, ry: 2.2, spots: [[7, 7], [9, 7]], spotC: NAVY, dorsalH: 1.2 }),
  baiacu: () => fish({ back: ['#8a6a2a', '#b8923a', '#d8b456', '#f0d888'], belly: ['#f4ecd8', '#fbf6ea'], rx: 4.8, ry: 4.4, spiky: true, roundTail: true, spots: [[7, 6], [9, 5], [6, 8], [10, 7]], spotC: '#6a4a1a', eyeUp: 1.6 }),
  tainha: () => fish({ back: ['#4f5a6a', '#6c7888', '#8e9aa8', '#b8c2cc'], belly: SILVER.slice(2), line: '#8e9aa8', lineDy: 0.6, ry: 2.6 }),
  robalo: () => fish({ back: ['#5f6a72', '#7f8b92', '#a3aeb4', '#cdd5d8'], belly: SILVER.slice(2), line: NAVY, lineDy: 0, rx: 6, ry: 2.7, mouth: true }),
  corvina: () => fish({ back: ['#6f6a5c', '#8e8878', '#ada694', '#ccc6b2'], belly: ['#e6dccb', '#f2ead9'], spots: [[6, 6], [8, 6], [10, 6], [7, 7], [9, 7]], spotC: '#5a5448', ry: 3 }),
  pargo: () => fish({ back: ['#a8384a', '#cc5060', '#e47a7e', '#f4a8a0'], belly: ['#f6d0c4', '#fbe6dc'], ry: 3.4, dorsalH: 2.4, fin: ['#a8384a', '#cc5060', '#e47a7e', '#f4a8a0'] }),
  garoupa: () => fish({ back: ['#4a3a2a', '#6a5038', '#8c6a48', '#ae8a62'], belly: ['#c8a880', '#dcc29a'], ry: 3.6, big: true, mouth: true, spots: [[6, 6], [9, 7], [7, 9], [11, 6], [10, 9]], spotC: '#d6c08e' }),
  dourado: () => fish({ back: ['#2f7a5a', '#3f9a6a', '#7cc06a', '#c8e070'], belly: ['#f0d040', '#f8e480'], rx: 6, ry: 3, eyeIn: 1.4, sail: false, dorsalH: 2.6, spots: [[7, 6], [10, 7], [8, 8]], spotC: '#4a8ad0', fin: YEL }),
  atum: () => fish({ back: ['#1f2c4a', '#2a3a60', '#3a5080', '#5a74a8'], belly: SILVER.slice(2), rx: 6, ry: 3.2, finlets: true, fin: ['#1f2c4a', '#2a3a60', '#3a5080', '#5a74a8'] }),
  marlim: () => fish({ back: ['#1f3a6a', '#2f54a0', '#4a78c8', '#7aa4e4'], belly: SILVER.slice(2), cx: 7.5, rx: 5, ry: 2.4, sail: true, bill: true, bars: [5, 7, 9], barC: '#6aa0dc' }),
  tilapia: () => fish({ back: ['#4f5a48', '#6a7660', '#8a967c', '#aab49a'], belly: ['#d6d8c4', '#e6e8d6'], ry: 3.4, bars: [6, 8, 10], barC: '#5a6650', dorsalH: 2.2 }),
  tambaqui: () => fish({ back: ['#3a3a40', '#55555c', '#72727a', '#90909a'], belly: ['#e0a84a', '#f0c870'], ry: 4, rx: 5.2, bellyAt: 0.8, roundTail: true }),
  tucunare: () => fish({ back: ['#6a8a2a', '#8aa83a', '#b8c850', '#e0e070'], belly: ['#f0d040', '#f8e480'], ry: 3, bars: [6, 8, 10], barC: '#3a4a2a', eyespot: true, mouth: true, fin: ['#b8502a', '#d86a3a', '#f08a4a', '#f8b070'] }),
};
const JUNK_ART = {
  chinelo: () => {
    const img = icon();
    shape(img, (x, y) => elp(8, 6, 3.4, 4.4)(x, y) || elp(8, 11.5, 3, 3.2)(x, y), [8, 8, 4, 7], [C.b4, C.b3, C.b2, C.b1], { ol: NAVY });
    for (const [x, y] of [[8, 4], [7, 5], [9, 5], [6, 6], [10, 6], [6, 7], [10, 7]]) put(img, x, y, C.white);
    return img;
  },
  lata: () => {
    const img = icon();
    shape(img, box(4, 3, 12, 14), [8, 8, 4, 6], [C.r6, C.r4, C.r2, C.r1], { ol: NAVY });
    shape(img, elp(8, 3, 4, 1.4), [8, 3, 4, 1.4], SILVER, { ol: NAVY });
    for (let y = 6; y < 11; y++) put(img, 6, y, C.white);
    put(img, 9, 7, C.y2); put(img, 10, 8, C.y2);
    return img;
  },
  alga: () => {
    const img = icon();
    for (const [x0, lean] of [[5, 0.3], [8, -0.2], [11, 0.1]]) for (let y = 2; y < 15; y++) { const x = Math.round(x0 + Math.sin(y * 0.8 + x0) * 1.2 + (14 - y) * lean * 0.2); put(img, x, y, y < 5 ? C.g1 : C.g2); put(img, x + 1, y, '#3a7a40'); }
    outlineAround(img);
    return img;
  },
  garrafa: () => {
    const img = icon();
    shape(img, or(elp(7, 9, 5.4, 3.6), box(11, 8, 15, 11)), [7, 9, 6, 4], ['#2f6e4a', '#3f8a5c', '#5aa878', '#8ccfa2'], { ol: NAVY });
    for (let x = 3; x < 10; x++) put(img, x, 8, C.cr1);
    put(img, 14, 8, C.w3); put(img, 14, 9, C.w3); put(img, 14, 10, C.w3);
    return img;
  },
};
const SNACK_ART = {
  /** queijo coalho na brasa: a grilled block on a skewer */
  queijo_coalho: () => {
    const img = icon();
    for (let i = 0; i < 9; i++) put(img, 3 + i, 14 - i, C.w2);
    shape(img, poly([[5, 9], [10, 4], [13, 7], [8, 12]]), [9, 8, 4, 4], ['#c9a052', '#e8c870', '#f6e2a0', '#fff4cc'], { ol: NAVY });
    for (const [x, y] of [[7, 8], [8, 7], [9, 6], [9, 9], [10, 8], [11, 7]]) put(img, x, y, '#a87830');
    return img;
  },
  picole: () => {
    const img = icon();
    put(img, 8, 13, C.w1); put(img, 8, 14, C.w1); put(img, 7, 14, C.w2);
    shape(img, (x, y) => box(4.5, 2, 11.5, 13)(x, y) && !(y < 3 && (x < 5.5 || x > 10.5)), [8, 7, 4, 6], [C.p3, C.p1, C.p0, '#ffd0d0'], { ol: NAVY });
    for (let x = 5; x < 11; x++) { put(img, x, 9, C.white); put(img, x, 10, '#f8e8e8'); }
    return img;
  },
  milho_verde: () => {
    const img = icon();
    shape(img, elp(8, 8, 3.2, 6.4), [8, 8, 3.2, 6.4], YEL, { ol: NAVY, pattern: (x, y, i) => ((x + y) % 2 ? i : Math.max(0, i - 1)) });
    shape(img, poly([[3, 14], [5, 6], [7, 14]]), [5, 10, 2, 4], GREEN, { ol: NAVY });
    shape(img, poly([[9, 14], [11, 6], [13, 14]]), [11, 10, 2, 4], GREEN, { ol: NAVY });
    return img;
  },
  concha: () => {
    const img = icon();
    shape(img, (x, y) => elp(8, 9, 6, 5)(x, y) && y > 4, [8, 9, 6, 5], ['#d48a7a', SAND.pink, '#f6d6c8', SAND.shell], { ol: NAVY });
    for (const x of [4, 6, 8, 10, 12]) for (let y = 6; y < 13; y++) if (elp(8, 9, 6, 5)(x + 0.5, y + 0.5)) put(img, x, y, '#e3aa98');
    shape(img, box(6, 12, 10, 15), [8, 13, 2, 1.5], ['#d48a7a', SAND.pink, '#f6d6c8', SAND.shell], { ol: NAVY });
    return img;
  },
  palito_vazio: () => {
    const img = icon();
    for (let i = 0; i < 11; i++) put(img, 3 + i, 14 - i, i > 7 ? '#a87830' : C.w2);
    outlineAround(img);
    return img;
  },
  palito_picole: () => {
    const img = icon();
    for (let y = 4; y < 14; y++) { put(img, 7, y, C.w1); put(img, 8, y, C.w2); }
    put(img, 7, 4, C.p1);
    outlineAround(img);
    return img;
  },
  sabugo: () => {
    const img = icon();
    shape(img, elp(8, 8, 2.6, 6), [8, 8, 2.6, 6], ['#b8945a', '#d6b47a', '#ead2a0', '#f8e8c8'], { ol: NAVY, pattern: (x, y, i) => ((x + y) % 2 ? i : Math.max(0, i - 1)) });
    put(img, 7, 5, C.y2); put(img, 9, 10, C.y2);
    return img;
  },
};

// ------------------------------------------------------------------ the fishing stage (PRAIA-PLAN.md 2.1): 320 x 180 backdrops, the rod
// and the bobber. Flat bands of the palette, the water in the lower 60%, the foreground of the place you fish from (the shore, the reeds,
// the rowboat's gunwale, the fishing boat's rail, the deep-sea boat's stern, the party deck). The stage draws the line and the fish over.
const SKY = ['#a6d4e4', '#bfe3ee', '#d6eef5'];
function fundoBase(img, horizon, seaTop = horizon) {
  for (let y = 0; y < horizon; y++) for (let x = 0; x < img.w; x++) put(img, x, y, SKY[Math.min(2, Math.floor((y / horizon) * 3))]);
  // a few flat clouds
  for (const [cx, cy, w] of [[60, 18, 34], [200, 30, 46], [270, 12, 22]]) {
    rect(img, cx - w / 2, cy, w, 3, '#f2faf6');
    rect(img, cx - w / 2 + 4, cy - 2, w - 10, 2, '#f2faf6');
  }
  const bands = [SEA.hi, SEA.base, SEA.lo, SEA.deep];
  for (let y = seaTop; y < img.h; y++) {
    const t = (y - seaTop) / Math.max(1, img.h - seaTop);
    for (let x = 0; x < img.w; x++) put(img, x, y, bands[Math.min(3, Math.floor(t * 4))]);
  }
  // ripple dashes, longer toward the viewer
  for (let y = seaTop + 2; y < img.h; y += 3) {
    const len = 3 + Math.floor(((y - seaTop) / (img.h - seaTop)) * 8);
    for (let x = (y * 7) % 13; x < img.w; x += len * 3 + 5) for (let i = 0; i < len; i++) if (h2(x, y, 3) < 0.7) put(img, x + i, y, SEA.hi2);
  }
}
function fundo(water) {
  const img = blank(320, 180);
  if (water === 'praia') {
    fundoBase(img, 70);
    // the sand at your feet, the shore's foam, the pier on the right
    for (let y = 140; y < 180; y++) for (let x = 0; x < 320; x++) put(img, x, y, y < 144 ? SEA.foam : h2(x, y, 4) < 0.1 ? SAND.lo : SAND.base);
    for (let x = 0; x < 320; x++) put(img, x, 139 + Math.round(Math.sin(x / 9)), SEA.foam2);
    rect(img, 250, 92, 70, 6, WOOD[2]);
    rect(img, 250, 92, 70, 1, WOOD[3]);
    for (const x of [256, 276, 296, 316]) rect(img, x, 98, 3, 42, WOOD[0]);
  } else if (water === 'lagoa') {
    fundoBase(img, 60);
    // the far bank: a dune line and a jerivá; reeds in the foreground
    for (let y = 52; y < 62; y++) for (let x = 0; x < 320; x++) if (y > 56 + Math.sin(x / 20) * 3) put(img, x, y, C.g3);
    rect(img, 230, 22, 2, 34, C.w4);
    for (const [dx, dy] of [[-8, 0], [8, 0], [-5, -3], [5, -3], [0, -4]]) rect(img, 231 + dx - 3, 20 + dy, 7, 2, C.g2);
    for (let x = 0; x < 320; x += 6) for (let y = 150 - Math.floor(h2(x, 1, 2) * 30); y < 180; y++) put(img, x + (y % 3 === 0 ? 1 : 0), y, y < 156 ? C.g1 : C.g2);
    for (const x of [18, 64, 300]) rect(img, x, 140, 3, 8, C.w4);
  } else if (water === 'remo') {
    fundoBase(img, 64);
    // the beach small behind, the rowboat's gunwale and an oar in front
    rect(img, 0, 58, 320, 6, SAND.base);
    for (const x of [40, 90, 150]) rect(img, x, 50, 2, 8, C.g2);
    for (let y = 150; y < 180; y++) for (let x = 0; x < 320; x++) put(img, x, y, y < 154 ? C.white : y < 160 ? '#3a8f63' : '#2b7552');
    for (let i = 0; i < 120; i++) put(img, 180 + i, 150 - Math.round(i * 0.35), C.w2);
    rect(img, 296, 104, 24, 8, C.w3);
  } else if (water === 'pesca') {
    fundoBase(img, 56);
    rect(img, 0, 54, 320, 2, C.g3); // the coast as a line
    // the deck rail and a heap of nets
    rect(img, 0, 146, 320, 34, DECK.base);
    for (let y = 146; y < 180; y += 4) rect(img, 0, y, 320, 1, DECK.gap);
    rect(img, 0, 132, 320, 3, C.white);
    for (let x = 6; x < 320; x += 28) rect(img, x, 132, 3, 16, C.white);
    for (let y = 150; y < 176; y++) for (let x = 20; x < 90; x++) if ((x + y) % 3 === 0 && (x - 55) ** 2 / 1200 + (y - 170) ** 2 / 400 < 1) put(img, x, y, '#4f8a63');
  } else if (water === 'alto_mar') {
    fundoBase(img, 80);
    // only sea and sky: a big swell, the stern and two rod holders
    for (let x = 0; x < 320; x++) for (let y = 80; y < 80 + 6 + Math.round(Math.sin(x / 30) * 5); y++) put(img, x, y, SEA.hi);
    rect(img, 0, 156, 320, 24, C.white);
    rect(img, 0, 156, 320, 2, C.lav3);
    rect(img, 0, 170, 320, 3, NAVYB[1]);
    for (const x of [40, 270]) { rect(img, x, 140, 4, 16, C.slate); for (let i = 0; i < 40; i++) put(img, x + 2 - Math.round(i * 0.4), 140 - i, C.lav3); }
  } else {
    // the party deck at sunset
    for (let y = 0; y < 70; y++) for (let x = 0; x < 320; x++) put(img, x, y, ['#f2b84a', '#f2a050', '#e88a5a', '#d87a6a'][Math.min(3, Math.floor(y / 18))]);
    rect(img, 140, 52, 40, 8, '#ffe08a');
    for (let y = 70; y < 180; y++) for (let x = 0; x < 320; x++) put(img, x, y, [SEA.hi, SEA.base, SEA.lo, SEA.deep][Math.min(3, Math.floor((y - 70) / 28))]);
    for (let y = 72; y < 130; y += 3) for (let x = 150; x < 170; x++) if (h2(x, y, 5) < 0.4) put(img, x, y, '#f8d890');
    rect(img, 0, 150, 320, 30, DECK.base);
    for (let y = 150; y < 180; y += 4) rect(img, 0, y, 320, 1, DECK.gap);
    rect(img, 0, 138, 320, 2, C.white);
    for (let i = 0; i < 40; i++) { const x = i * 8 + 4, y = 8 + Math.round(Math.abs(i - 20) * 0.6); rect(img, x, y, 3, 3, [C.r2, C.y2, C.g2, C.b1, C.p1][i % 5]); }
  }
  return img;
}
function vara() {
  // the rod, butt at the bottom right, tip up to the left (the stage rotates nothing: it draws the bend as the line)
  const img = blank(64, 96);
  for (let i = 0; i < 90; i++) {
    const x = 60 - Math.round(i * 0.55), y = 94 - i;
    put(img, x, y, i < 20 ? NAVY : i < 24 ? C.y2 : C.w2);
    if (i < 18) put(img, x + 1, y, '#2a2a3c');
  }
  rect(img, 52, 70, 8, 8, C.slate2); rect(img, 53, 71, 6, 6, C.mist); // the reel
  return img;
}
function boiaImg() {
  const img = blank(8, 12);
  solid(img, elp(4, 4, 3, 3.5), RED, { rimShade: 1 });
  solid(img, (x, y) => elp(4, 4, 3, 3.5)(x, y) && y > 4.5, WHITE, { rimShade: 1, outline: false });
  rect(img, 3, 8, 2, 3, C.w4);
  return img;
}

/** pesca/fundo_<water>, pesca/vara, pesca/boia (DOM images the stage canvas draws). */
export async function pescaStageParts() {
  const parts = ['praia', 'lagoa', 'remo', 'pesca', 'alto_mar', 'festa'].map((w) => ({ key: `pesca/fundo_${w}`, img: fundo(w) }));
  parts.push({ key: 'pesca/vara', img: vara() }, { key: 'pesca/boia', img: boiaImg() });
  return parts;
}

/** icons/peixe_<id>, icons/<junk>, icons/<snack> as standalone DOM images. */
export async function praiaIconParts() {
  const parts = [];
  for (const [id, fn] of Object.entries(FISH_ART)) parts.push({ key: `icons/peixe_${id}`, img: fn() });
  for (const [id, fn] of Object.entries(JUNK_ART)) parts.push({ key: `icons/${id === 'garrafa' ? 'garrafa_mensagem' : id}`, img: fn() });
  for (const [id, fn] of Object.entries(SNACK_ART)) parts.push({ key: `icons/${id}`, img: fn() });
  return parts;
}

// ------------------------------------------------------------------ parts for the import pipeline
const meta = (fp, shadow = 'fx/shadow_16', cast = true) => ({ footprint: fp, shadow, ...(cast ? { cast: { kx: 0.4, ky: 0.22 } } : {}) });
const flatMeta = (fp) => ({ footprint: fp, shadow: null, decal: true });

export async function praia(ctx) {
  const parts = [];
  const add = (key, made, m) => parts.push({ key, ...made, meta: m });
  add('praia/mureta', mureta(), meta([40, 2], null, false));
  add('praia/placa_jeriva', placaJeriva(), meta([3, 1], 'fx/shadow_48'));
  add('praia/placa_praia', placaPraia(), meta([1, 1], 'fx/shadow_10'));
  // the kiosk: counter (standing), roof (overhead), string lights (lit)
  const q = quiosque();
  parts.push({ key: 'praia/quiosque_coco', ...q.base, meta: { ...meta([3, 1], 'fx/shadow_48'), overhead: 'praia/quiosque_coco_telhado', lit: 'praia/quiosque_coco_lit' } });
  parts.push({ key: 'praia/quiosque_coco_telhado', ...q.roof, meta: { footprint: [3, 1], overhead: true, shadow: null } });
  parts.push({ key: 'praia/quiosque_coco_lit', ...q.lit, meta: { footprint: [3, 1], shadow: null } });
  add('praia/placa_jo', placaJo(), meta([1, 1], 'fx/shadow_10'));
  add('praia/arara_chapeus', araraChapeus(), meta([1, 1], 'fx/shadow_16'));
  add('praia/placa_compro_peixe', placaCompro(), meta([1, 1], 'fx/shadow_10'));
  const p = postoSalvaVidas();
  parts.push({ key: 'praia/posto_salva_vidas', img: p.img, anchor: p.anchor, meta: { ...meta([2, 2], 'fx/shadow_32'), lit: 'praia/posto_salva_vidas_lit', light: p.light } });
  parts.push({ key: 'praia/posto_salva_vidas_lit', img: p.lit, anchor: p.anchor, meta: { footprint: [2, 2], shadow: null } });
  add('praia/placa_proibido', placaProibido(), meta([1, 1], 'fx/shadow_10'));
  const g = galpao();
  parts.push({ key: 'praia/galpao_barcos', img: g.img, anchor: g.anchor, meta: { ...meta([4, 3], null), lit: 'praia/galpao_barcos_lit' } });
  parts.push({ key: 'praia/galpao_barcos_lit', img: g.lit, anchor: g.anchor, meta: { footprint: [4, 3], shadow: null } });
  add('praia/placa_aluguel', placaAluguel(), meta([1, 1], 'fx/shadow_10'));
  for (const k of ['a', 'b', 'c']) {
    const u = guardaSol(k);
    parts.push({ key: `praia/guarda_sol_${k}`, ...u.pole, meta: { ...meta([1, 1], 'fx/shadow_10', false), overhead: `praia/guarda_sol_${k}_copa` } });
    parts.push({ key: `praia/guarda_sol_${k}_copa`, ...u.canopy, meta: { footprint: [1, 1], overhead: true, shadow: null } });
    add(`praia/guarda_sol_${k}_fechado`, u.closed, meta([1, 1], 'fx/shadow_10'));
  }
  add('praia/cadeira_praia', cadeiraPraia([C.b4, C.b3, C.b1, C.b0]), meta([1, 1], 'fx/shadow_16'));
  add('praia/cadeira_praia_b', cadeiraPraia(TERRA), meta([1, 1], 'fx/shadow_16'));
  add('praia/castelo_areia', casteloAreia(), flatMeta([1, 1]));
  add('praia/concha_a', concha('a'), flatMeta([1, 1]));
  add('praia/concha_b', concha('b'), flatMeta([1, 1]));
  add('praia/pegadas', pegadas(), flatMeta([1, 1]));
  add('praia/madeira_mar', madeiraMar(), meta([1, 1], 'fx/shadow_16', false));
  add('praia/canoa', canoa(), meta([2, 1], 'fx/shadow_32', false));
  add('praia/rede_secando', redeSecando(), meta([2, 1], 'fx/shadow_32'));
  add('praia/balde', balde(), meta([1, 1], 'fx/shadow_10'));
  add('praia/vara_apoiada', varaApoiada(), meta([1, 1], 'fx/shadow_10'));
  add('praia/pesca_stake', pescaStake(), meta([1, 1], 'fx/shadow_10'));
  add('praia/pesca_bollard', pescaBollard(), meta([1, 1], 'fx/shadow_10'));
  for (const k of ['a', 'b', 'c']) add(`praia/pedras_${k}`, pedras(k), meta(k === 'a' ? [1, 1] : k === 'b' ? [2, 1] : [2, 2], k === 'c' ? 'fx/shadow_32' : 'fx/shadow_16'));
  add('praia/taboa', taboa(), meta([1, 1], 'fx/shadow_10', false));
  add('praia/costao', costao(), meta([6, 17], null, false));
  add('praia/placa_perigo', placaPerigo(), meta([1, 1], 'fx/shadow_16'));
  add('praia/gaivota', gaivotaPousada(), meta([1, 1], 'fx/shadow_10', false));
  add('praia/pier_poste', pierPoste(), meta([1, 1], null, false));
  add('praia/pier_grade', pierGrade(), { footprint: [1, 1], shadow: null, overhead: true });
  const lamp = pierLampada();
  add('praia/pier_lampada', { img: lamp.img, anchor: lamp.anchor }, { ...meta([1, 1], 'fx/shadow_10', false), light: lamp.light });
  add('praia/pier_fim', pierFim(), meta([2, 1], null, false));
  add('praia/placa_pier', placaPier(), meta([1, 1], 'fx/shadow_10'));
  // the boats: the hull is a decal you walk on, the cabin and the mast stand over you
  const remo = barcoRemo();
  add('praia/barco_remo', remo.base, flatMeta([2, 1]));
  for (const [key, b, fp] of [['barco_pesca', barcoPesca(), [3, 2]], ['barco_alto_mar', barcoAltoMar(), [4, 2]], ['barco_festa', barcoFesta(), [5, 3]]]) {
    parts.push({ key: `praia/${key}`, ...b.base, meta: { ...flatMeta(fp), overhead: `praia/${key}_cabine`, ...(b.lit ? { lit: `praia/${key}_lit` } : {}) } });
    parts.push({ key: `praia/${key}_cabine`, ...b.over, meta: { footprint: fp, overhead: true, shadow: null } });
    if (b.lit) parts.push({ key: `praia/${key}_lit`, ...b.lit, meta: { footprint: fp, shadow: null } });
  }
  add('praia/festa_grade', festaGrade(), meta([1, 1], null, false));
  add('praia/festa_cabine', festaCabine(), meta([3, 4], 'fx/shadow_48'));
  add('praia/festa_som', festaSom(), meta([1, 1], 'fx/shadow_10'));
  add('praia/festa_churrasqueira', festaChurrasqueira(), meta([1, 1], 'fx/shadow_16'));
  add('praia/festa_cooler', festaCooler(), meta([1, 1], 'fx/shadow_10'));
  add('praia/festa_placa', festaPlaca(), meta([1, 1], 'fx/shadow_10'));
  // living things and the foam
  for (const k of [0, 1, 2]) add(`fx/onda_${k}`, onda(k), { footprint: [1, 1], shadow: null, decal: true });
  add('critters/gaivota', await gaivotaFlock(ctx), { footprint: [1, 1], shadow: null });
  add('critters/caranguejo', caranguejo(), { footprint: [1, 1], shadow: 'fx/shadow_10' });
  // kitnet furniture: rot 0 and its mirror
  for (const [id, fn] of Object.entries(FURN)) {
    const r = fn();
    add(`furniture/${id}_0`, r, { footprint: [1, 1], shadow: 'fx/shadow_16' });
    add(`furniture/${id}_1`, { img: flipH(r.img), anchor: [r.img.w - r.anchor[0], r.anchor[1]] }, { footprint: [1, 1], shadow: 'fx/shadow_16' });
  }
  return parts;
}

/** scratch preview hook: every part on one sheet */
export async function preview() {
  return (await praia({ sheet: async () => blank(96, 16) })).map((x) => x.img ?? x.frames[0]);
}
void and; void K; void paste;
