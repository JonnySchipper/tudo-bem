// Visual pass V3: the south row across Rua Jacarandá, redrawn in the same three-quarter view as the north row. We see the BACK of these
// buildings: a roof strip on top (clay tile, fibro, slate, or a laje with its caixa d'água), a rear wall below with a back door, windows with
// grilles, AC units, washing and drainpipes, and a few plots that are just a high garden wall (muro) with a gate under a leafy crown.
// 4 tiles tall (64 px), 6 or 7 wide. Pack palette, navy outline, light from the upper left. Windows are reported for the night overlay.
import { blank, rect, hline, vline, dot, box, C, K, outlineAround, hexPx, setPx } from './kit.mjs';
import { rng } from '../../../../scripts/lib/pixel/img.mjs';
import { shape, ell, mix } from './paint.mjs';
import { tank, dish, antenna, plant, shadowOn } from './telhados.mjs';
import { acWall, grille, pot, lantern } from './v3.mjs';
import { litOverlay } from './facades.mjs';
import { COLORWAYS } from './vila.mjs';

const H = 64;
const R = 22; // roof strip rows
const FLOOR = 57; // top of the plinth
const TANK = [C.b4, C.b3, C.b2, C.b1];
const TANK_BROWN = ['#7b5b3a', '#a9764f', '#c78c59', '#daa463'];
const TANK_GREY = [C.slate, C.slate2, C.mist, C.lav];
const LEAF = ['#2f5f4a', '#3f7a4a', '#5da23d', '#8cc24a'];
const LEAF_DARK = ['#23483a', '#2f5f4a', '#3f7a4a', '#5da23d'];
const IPE_ROXO = ['#7a4f9a', '#9a6fb8', '#c08ad0', '#e3b8e6'];
const BOUGA = ['#a3245f', '#c93a7c', '#e8629a', '#ffa0c8'];
const shade = (hex, t = 0.3) => mix(hex, '#2a2a48', t);

// ------------------------------------------------------------------ roofs (rows 0..R-1)
function roofTelha(img, w, tone) {
  const t = tone === 'slate' ? ['#463d66', '#5b4c78', '#72608f', '#8a76a8', '#a38fc0'] : tone === 'old' ? ['#7a3a2a', '#a13a30', '#ab4a36', '#b35e3f', '#ca8854'] : [K.te5, K.te3, K.te2, K.te1, K.te0];
  const r = rng(w + (tone === 'slate' ? 3 : 7));
  for (let y = 0; y < R; y++) for (let x = 0; x < w; x++) {
    const row = (y - 3) >> 2, pos = (y - 3) & 3;
    const tx = (x + (row & 1) * 3) % 6;
    let c = pos === 0 ? t[4] : pos === 3 ? t[1] : t[3];
    if (tx === 0) c = pos === 3 ? t[0] : t[2];
    if (r() < 0.04) c = t[2];
    setPx(img, x, y, hexPx(c));
  }
  // ridge cap (top) and eave lip (bottom)
  rect(img, 0, 0, w, 3, t[3]);
  hline(img, 0, 0, w, t[4]);
  hline(img, 0, 2, w, t[1]);
  hline(img, 0, R - 2, w, t[1]);
  hline(img, 0, R - 1, w, t[0]);
  vline(img, 0, 0, R, t[4]);
  vline(img, w - 1, 0, R, t[0]);
  for (let x = 4; x < w - 6; x += 7) dot(img, x, 1, t[2]);
}

function roofFibro(img, w, pal) {
  const s = pal === 'verde' ? ['#9bc2b6', '#7fae9f', '#67988a', '#4f7f6a'] : ['#d6dde6', '#b9c4d2', '#9eabbf', '#8391a8'];
  for (let y = 0; y < R; y++) for (let x = 0; x < w; x++) setPx(img, x, y, hexPx(s[[0, 1, 2, 3][x % 4]]));
  for (const y of [8, 15]) { hline(img, 0, y, w, s[3]); hline(img, 0, y + 1, w, s[0]); }
  rect(img, 0, 0, w, 2, s[3]);
  hline(img, 0, 0, w, s[0]);
  hline(img, 0, R - 2, w, s[3]);
  hline(img, 0, R - 1, w, shade(s[3], 0.4));
  const r = rng(w * 3);
  for (let i = 0; i < 6; i++) {
    const bx = 6 + Math.floor(r() * (w - 16)), by = 3 + Math.floor(r() * 12);
    rect(img, bx, by, 5, 3, '#b18a74');
    hline(img, bx, by, 5, '#d0be9c');
    hline(img, bx, by + 2, 5, '#916662');
    box(img, bx - 1, by - 1, 7, 5, null, C.navy);
  }
}

/** A concrete deck with a far parapet, items standing on it, and the near coping (drawn after the items so legs and lines hide behind it). */
function roofLaje(img, w, cw, o = {}) {
  const trim = cw.trim, wall = cw.wall;
  // far coping + inner face
  rect(img, 0, 0, w, 3, trim[4]);
  hline(img, 0, 0, w, trim[5]);
  hline(img, 0, 2, w, trim[1]);
  rect(img, 0, 3, w, 3, wall[1]);
  hline(img, 0, 3, w, wall[0]);
  // deck
  const r = rng(w + 5);
  for (let y = 6; y < R; y++) for (let x = 0; x < w; x++) setPx(img, x, y, hexPx(r() < 0.09 ? '#a3a2bd' : '#b7b2cb'));
  for (let x = 30; x < w; x += 34) vline(img, x, 6, R - 6, '#a2a0ba');
  // items
  if (o.tank) tank(img, o.tank[0], -1, o.tank[1] ?? TANK);
  if (o.antenna != null) antenna(img, o.antenna, 2, 16);
  if (o.dish != null) dish(img, o.dish, 6);
  if (o.plants) for (const x of o.plants) plant(img, x, 8, true);
  if (o.line) {
    const [x0, x1] = o.line;
    const cols = ['#f8f8f8', '#fc5c46', '#4280dd', '#f2b22b', '#ffa0a0', '#64b63b'];
    for (const x of [x0, x1]) vline(img, x, 8, 11, C.navy2);
    for (let x = x0; x <= x1; x++) dot(img, x, 9 + ((x - x0 < 3 || x1 - x < 3) ? 0 : 1), C.mist2);
    let x = x0 + 2, i = 0;
    while (x < x1 - 3) { const c = cols[(i + x0) % cols.length]; const wd = 3 + (i % 2); rect(img, x, 10, wd, 7, c); hline(img, x, 10, wd, mix(c, '#ffffff', 0.35)); vline(img, x + wd - 1, 11, 6, shade(c, 0.3)); x += wd + 2; i++; }
  }
  // near coping
  rect(img, 0, R - 4, w, 4, trim[4]);
  hline(img, 0, R - 4, w, trim[5]);
  hline(img, 0, R - 1, w, trim[1]);
}

// ------------------------------------------------------------------ rear wall
function wallFill(img, w, cw, top = R) {
  const { wall, trim } = cw;
  for (let y = top; y < H; y++) for (let x = 0; x < w; x++) setPx(img, x, y, hexPx(wall[(x * 7 + y * 13) % 19 === 0 ? 2 : (x * 5 + y * 3) % 23 === 0 ? 4 : 3]));
  // pilasters
  for (const [x, lit] of [[0, true], [w - 3, false]]) { rect(img, x, top, 3, H - top, trim[lit ? 3 : 2]); vline(img, x, top, H - top, trim[lit ? 5 : 3]); vline(img, x + 2, top, H - top, trim[1]); }
  // cornice under the roof and the eave shadow
  rect(img, 0, top, w, 2, trim[4]);
  hline(img, 0, top, w, trim[5]);
  hline(img, 0, top + 1, w, trim[2]);
  for (let yy = 0; yy < 4; yy++) for (let x = 3; x < w - 3; x++) {
    const i = ((top + 2 + yy) * w + x) * 4;
    const hex = '#' + [0, 1, 2].map((c) => img.data[i + c].toString(16).padStart(2, '0')).join('');
    const p = hexPx(mix(hex, '#2a2a48', 0.34 - yy * 0.08));
    img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2];
  }
  // plinth
  rect(img, 0, FLOOR, w, H - FLOOR, trim[2]);
  hline(img, 0, FLOOR, w, trim[5]);
  hline(img, 0, FLOOR + 1, w, trim[4]);
  hline(img, 0, H - 2, w, trim[0]);
  hline(img, 0, H - 1, w, C.navy2);
}

function windowAt(img, glass, cw, x, y, w, h, kind) {
  const { trim, wall } = cw;
  rect(img, x - 2, y - 2, w + 4, h + 4, trim[4]);
  box(img, x - 2, y - 2, w + 4, h + 4, null, C.navy);
  hline(img, x - 1, y - 1, w + 2, trim[5]);
  if (kind === 'cobogo') {
    rect(img, x, y, w, h, wall[1]);
    for (let yy = y; yy < y + h; yy += 3) for (let xx = x; xx < x + w; xx += 3) { rect(img, xx, yy, 2, 2, C.navy2); dot(img, xx, yy, C.slate); }
  } else if (kind === 'venez') {
    rect(img, x, y, w, h, wall[2]);
    for (let yy = y; yy < y + h; yy += 2) { hline(img, xx0(x), yy, w, wall[4]); hline(img, xx0(x), yy + 1, w, wall[1]); }
    vline(img, x + (w >> 1), y, h, C.navy2);
  } else {
    rect(img, x, y, w, h, K.gl3);
    hline(img, x, y, w, K.gl1);
    for (let i = 0; i < Math.min(w, h) - 2; i += 5) dot(img, x + 2 + i, y + 2 + i, C.white);
    vline(img, x + (w >> 1), y, h, K.gl5);
    glass.push([x, y, w, h]);
    if (kind === 'grille') grille(img, x, y, w, h, 3);
  }
  // sill
  rect(img, x - 3, y + h + 2, w + 6, 2, trim[3]);
  hline(img, x - 3, y + h + 2, w + 6, trim[5]);
  hline(img, x - 3, y + h + 3, w + 6, trim[1]);
  // grime streaks under the sill
  for (let i = 0; i < w; i += 5) vline(img, x + 1 + i, y + h + 4, 3 + (i % 3), shade(wall[3], 0.14));
}
const xx0 = (x) => x;

function doorAt(img, cw, x, w, h, kind) {
  const { trim } = cw;
  const y = FLOOR - h;
  rect(img, x - 2, y - 2, w + 4, h + 2, trim[4]);
  box(img, x - 2, y - 2, w + 4, h + 3, null, C.navy);
  if (kind === 'garage') {
    for (let yy = y; yy < FLOOR; yy++) hline(img, x, yy, w, (yy - y) % 3 === 2 ? C.slate : yy % 2 ? C.mist : C.lav);
    hline(img, x, y, w, C.slate);
    rect(img, x + (w >> 1) - 2, FLOOR - 4, 4, 2, C.slate);
  } else if (kind === 'metal') {
    rect(img, x, y, w, h, '#4e6a66');
    for (let yy = y + 3; yy < FLOOR - 2; yy += 6) { box(img, x + 2, yy, w - 4, 4, '#5f7d78', '#3e5754'); }
    vline(img, x, y, h, '#6f8f89');
    dot(img, x + w - 3, y + (h >> 1) + 1, C.y2);
  } else {
    rect(img, x, y, w, h, '#a9764f');
    vline(img, x, y, h, '#c78c59');
    vline(img, x + w - 1, y, h, '#7b5b3a');
    rect(img, x + 2, y + 2, w - 4, 6, K.gl3);
    box(img, x + 1, y + 1, w - 2, 8, null, '#573c2c');
    dot(img, x + w - 3, y + (h >> 1) + 2, C.y2);
    hline(img, x + 2, y + h - 5, w - 4, '#7b5b3a');
  }
  // step
  rect(img, x - 3, FLOOR - 1, w + 6, 2, trim[1]);
  hline(img, x - 3, FLOOR - 1, w + 6, trim[5]);
}

function drainpipe(img, x, y0, y1) {
  vline(img, x, y0, y1 - y0, C.mist2);
  vline(img, x + 1, y0, y1 - y0, C.slate2);
  vline(img, x + 2, y0, y1 - y0, C.slate);
  for (let y = y0 + 6; y < y1; y += 12) hline(img, x - 1, y, 5, C.navy2);
}

function meterBox(img, x, y) {
  rect(img, x, y, 7, 9, C.lav2);
  box(img, x - 1, y - 1, 9, 11, null, C.navy);
  shape(img, ell(x + 3.5, y + 4, 2.4, 2.4), [x + 3.5, y + 4, 2.4, 2.4], [C.slate, C.mist, C.lav3, C.white], {});
  hline(img, x + 1, y + 7, 5, C.slate2);
}

/** Washing hung on the wall between two hooks. */
function varal(img, x0, x1, y, seed) {
  const cols = ['#f8f8f8', '#fc5c46', '#4280dd', '#f2b22b', '#ffa0a0', '#64b63b', '#f5e6d3'];
  for (let x = x0; x <= x1; x++) dot(img, x, y + ((x - x0 < 3 || x1 - x < 3) ? 0 : 1), C.slate2);
  for (const x of [x0, x1]) { dot(img, x, y - 1, C.navy); dot(img, x, y, C.navy); }
  let x = x0 + 2, i = seed;
  while (x < x1 - 3) {
    const c = cols[i++ % cols.length], wd = 3 + (i % 3), ht = 5 + (i % 3);
    rect(img, x, y + 1, wd, ht, c);
    hline(img, x, y + 1, wd, mix(c, '#ffffff', 0.35));
    vline(img, x + wd - 1, y + 2, ht - 1, shade(c, 0.25));
    hline(img, x + 1, y + 1 + ht, wd, shade('#cfc2a8', 0.3));
    x += wd + 2;
  }
}

// ------------------------------------------------------------------ a garden wall with a gate and a tree crown
function crown(img, w, pal, x0, x1, seed, blooms = null) {
  const r = rng(seed);
  // dense blobs along the top, an irregular lower edge hanging over the wall
  for (let x = x0; x < x1; x += 5) {
    const cy = 6 + Math.floor(r() * 6), rr = 6 + Math.floor(r() * 3);
    shape(img, ell(x + 3, cy, rr, rr - 1), [x + 3, cy, rr, rr - 1], pal, {});
  }
  for (let x = x0 + 2; x < x1 - 2; x += 7) {
    const cy = 14 + Math.floor(r() * 5);
    shape(img, ell(x + 2, cy, 5.2, 4.2), [x + 2, cy, 5.2, 4.2], pal, {});
  }
  if (blooms) for (let i = 0; i < 26; i++) { const bx = x0 + 2 + Math.floor(r() * (x1 - x0 - 4)), by = 2 + Math.floor(r() * 18); dot(img, bx, by, blooms[1 + (i % 3)]); }
  void w;
}

function muro(img, w, cw, o) {
  const { wall, trim } = cw;
  // background: a hint of sky over the neighbour's yard is not drawn; the crown covers the top
  const wy = 24; // top of the wall
  for (let y = wy; y < H; y++) for (let x = 0; x < w; x++) setPx(img, x, y, hexPx(wall[(x * 7 + y * 13) % 19 === 0 ? 2 : 3]));
  // coping with a drip edge
  rect(img, 0, wy, w, 4, trim[4]);
  hline(img, 0, wy, w, trim[5]);
  hline(img, 0, wy + 3, w, trim[1]);
  hline(img, 0, wy + 4, w, shade(wall[3], 0.32));
  hline(img, 0, wy + 5, w, shade(wall[3], 0.2));
  // pillars at each end and around the gate
  const gw = o.gateW, gx = Math.floor((w - gw) / 2) + (o.gateDx ?? 0);
  for (const px0 of [0, w - 5, gx - 6, gx + gw + 1]) { rect(img, px0, wy + 4, 5, H - wy - 4, trim[3]); vline(img, px0, wy + 4, H - wy - 4, trim[5]); vline(img, px0 + 4, wy + 4, H - wy - 4, trim[1]); rect(img, px0 - 1, wy + 1, 7, 3, trim[4]); hline(img, px0 - 1, wy + 1, 7, trim[5]); }
  // the gate
  const gy = wy + 8;
  rect(img, gx, gy, gw, FLOOR + 5 - gy, '#2c3a40');
  box(img, gx - 1, gy - 1, gw + 2, FLOOR + 7 - gy, null, C.navy);
  const bars = o.gate === 'ped' ? 3 : 4;
  for (let x = gx + 1; x < gx + gw - 1; x += bars) { vline(img, x, gy, FLOOR + 5 - gy, '#6f8f89'); vline(img, x + 1, gy, FLOOR + 5 - gy, '#3e5754'); }
  hline(img, gx, gy + 3, gw, '#6f8f89');
  hline(img, gx, FLOOR - 2, gw, '#6f8f89');
  if (o.gate !== 'ped') { vline(img, gx + (gw >> 1), gy, FLOOR + 5 - gy, C.navy); rect(img, gx + (gw >> 1) - 3, gy + 14, 2, 3, C.y2); }
  else dot(img, gx + gw - 4, gy + 14, C.y2);
  // interfone + number plate on the pillar
  const px1 = gx + gw + 1;
  rect(img, px1 + 1, wy + 12, 3, 5, C.lav3); dot(img, px1 + 2, wy + 13, C.r2);
  // plinth line / soleira
  rect(img, 0, FLOOR + 4, w, H - FLOOR - 4, trim[2]);
  hline(img, 0, FLOOR + 4, w, trim[4]);
  hline(img, 0, H - 1, w, C.navy2);
  // a few extras (a pot by the gate, a bougainvillea spilling over the coping)
  if (o.pots) for (const x of o.pots) pot(img, x, FLOOR - 3, o.potBloom ?? '#fc5c46');
  // crown behind/over the wall top
  crown(img, w, o.leaf, 3, w - 3, o.seed, o.blooms ?? null);
  if (o.spill) for (let x = o.spill[0]; x < o.spill[1]; x += 3) { const hgt = 4 + ((x * 7) % 6); for (let yy = 0; yy < hgt; yy++) dot(img, x, wy + 4 + yy, yy % 2 ? BOUGA[1] : BOUGA[2]); dot(img, x + 1, wy + 4, BOUGA[3]); }
  void lantern;
}

// ------------------------------------------------------------------ the nine slots
const SLOTS = [
  ['fundos/f1', 6, (img, w, g) => { const cw = COLORWAYS.salmao; roofTelha(img, w, 'terra'); wallFill(img, w, cw); doorAt(img, cw, 14, 12, 24, 'metal'); windowAt(img, g, cw, 48, 33, 14, 12, 'grille'); acWall(img, 70, 39); drainpipe(img, 88, 28, FLOOR); varal(img, 30, 44, 30, 1); meterBox(img, 33, 42); }],
  ['fundos/f2', 6, (img, w, g) => { const cw = COLORWAYS.azul; roofLaje(img, w, cw, { tank: [12, TANK], antenna: 64, dish: 76, plants: [38] }); wallFill(img, w, cw); windowAt(img, g, cw, 14, 33, 12, 12, 'cobogo'); doorAt(img, cw, 40, 12, 24, 'wood'); windowAt(img, g, cw, 66, 33, 14, 12, 'grille'); acWall(img, 64, 51 - 4); drainpipe(img, 90, 28, FLOOR); }],
  ['fundos/f3', 6, (img, w) => { muro(img, w, COLORWAYS.lilas, { gateW: 30, gate: 'car', leaf: IPE_ROXO, seed: 31, blooms: IPE_ROXO, pots: [8, 84], potBloom: '#ffe57b' }); }],
  ['fundos/f4', 7, (img, w, g) => { const cw = COLORWAYS.amarelo; roofFibro(img, w, 'verde'); wallFill(img, w, cw); doorAt(img, cw, 12, 28, 21, 'garage'); windowAt(img, g, cw, 58, 31, 12, 8, 'grille'); doorAt(img, cw, 82, 12, 24, 'metal'); varal(img, 52, 78, 46, 3); lantern(img, 94, 36); drainpipe(img, 106, 28, FLOOR); }],
  ['fundos/f5', 6, (img, w, g) => { const cw = COLORWAYS.verde; roofLaje(img, w, cw, { tank: [60, TANK_BROWN], antenna: 18, line: [30, 54] }); wallFill(img, w, cw); windowAt(img, g, cw, 14, 33, 12, 12, 'venez'); doorAt(img, cw, 38, 12, 24, 'wood'); windowAt(img, g, cw, 62, 33, 12, 12, 'venez'); acWall(img, 80, 40); meterBox(img, 24, 46); drainpipe(img, 6, 28, FLOOR); }],
  ['fundos/f6', 6, (img, w, g) => { const cw = COLORWAYS.lilas; roofTelha(img, w, 'slate'); wallFill(img, w, cw); windowAt(img, g, cw, 12, 33, 12, 12, 'grille'); doorAt(img, cw, 36, 12, 24, 'metal'); windowAt(img, g, cw, 60, 33, 14, 12, 'grille'); varal(img, 58, 82, 48, 0); pot(img, 78, 49, '#ffe57b'); drainpipe(img, 88, 28, FLOOR); }],
  ['fundos/f7', 6, (img, w) => { muro(img, w, COLORWAYS.salmao, { gateW: 14, gate: 'ped', gateDx: -20, leaf: LEAF, seed: 47, blooms: ['', '#ffe57b', '#ffd23a', '#ffe57b'], spill: [52, 86], pots: [78], potBloom: '#ff8575' }); }],
  ['fundos/f8', 6, (img, w, g) => { const cw = COLORWAYS.amarelo; roofFibro(img, w, 'cinza'); wallFill(img, w, cw); doorAt(img, cw, 16, 12, 24, 'wood'); windowAt(img, g, cw, 44, 33, 14, 12, 'grille'); windowAt(img, g, cw, 68, 33, 12, 12, 'grille'); lantern(img, 36, 34); acWall(img, 44, 50 - 4); }],
  ['fundos/f9', 7, (img, w, g) => { const cw = COLORWAYS.azul; roofLaje(img, w, cw, { tank: [74, TANK_GREY], plants: [14, 94], dish: 44 }); wallFill(img, w, cw); doorAt(img, cw, 12, 12, 24, 'metal'); windowAt(img, g, cw, 40, 33, 14, 12, 'cobogo'); windowAt(img, g, cw, 66, 33, 14, 12, 'grille'); acWall(img, 94, 36); drainpipe(img, 106, 28, FLOOR); varal(img, 40, 60, 50, 5); }],
];

export async function fundos() {
  const parts = [];
  for (const [key, tiles, build] of SLOTS) {
    const w = tiles * 16;
    const img = blank(w, H);
    const glass = [];
    build(img, w, glass);
    outlineAround(img);
    const lit = litOverlay(w, H, glass);
    const anchor = [Math.floor(w / 2), H - 1];
    parts.push({ key, img, anchor, meta: { footprint: [tiles, 4], shadow: null, windows: glass, lit: `${key}_lit` } });
    parts.push({ key: `${key}_lit`, img: lit, anchor, meta: { footprint: [tiles, 4], shadow: null } });
  }
  return parts;
}

export async function preview() {
  const out = [];
  for (const [, tiles, build] of SLOTS) { const img = blank(tiles * 16, H); build(img, tiles * 16, []); outlineAround(img); out.push(img); }
  return out;
}
void shadowOn;
