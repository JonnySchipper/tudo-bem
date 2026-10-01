// Art track 4: the roofs across Rua Jacarandá, rebuilt as nine different São Paulo rooftops (4 tiles tall, 6 or 7 wide).
// Seen from the upper south: a slab with a parapet, a colonial tile roof, corrugated sheets with bricks holding them down, a terraço with a
// grill and an umbrella, a puxadinho (little extra room) with its own roof. Caixas d'água, satellite dishes, TV antennas, laundry lines,
// potted plants and AC units are scattered on them. Authored in the pack palette (navy outline, light from the upper left, shadows down-right).
import { blank, rect, hline, vline, dot, C, K, outlineAround, hexPx, setPx } from './kit.mjs';
import { rng } from '../../../../scripts/lib/pixel/img.mjs';
import { shape, ell, box as boxP, mix, line } from './paint.mjs';

const H = 64;
const PASTEL = {
  salmao: ['#a9534b', '#c6715f', '#d88a6d', '#e9a283'],
  amarelo: ['#c99a2c', '#e0b23f', '#f0cb5e', '#f7dc8a'],
  azul: ['#5d7fae', '#7d9fca', '#98b6da', '#b9d0ea'],
  verde: ['#4f7f6a', '#6ea088', '#89b6a0', '#a9cdb9'],
  lilas: ['#8a6fa4', '#ab92c1', '#c4abd3', '#dccbe6'],
  creme: ['#c3ac90', '#dccaa6', '#efe0c0', '#f7ecd0'],
};
const TANK = [C.b4, C.b3, C.b2, C.b1];
const TANK_ALT = ['#7b5b3a', '#a9764f', '#c78c59', '#daa463']; // fibra marrom
const TANK_GREY = [C.slate, C.slate2, C.mist, C.lav];
const PLANT = ['#32675a', '#568d61', '#64b63b', '#9bc246'];

const shade = (hex) => mix(hex, '#3a3a50', 0.38);

/** Darkens the existing opaque pixels of a rectangle (cast shadow on the deck, down-right of objects). */
export function shadowOn(img, x, y, w, h, t = 0.3) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
    const i = (yy * img.w + xx) * 4;
    if (!img.data[i + 3]) continue;
    const hex = '#' + [0, 1, 2].map((c) => img.data[i + c].toString(16).padStart(2, '0')).join('');
    const m = mix(hex, '#2a2a48', t);
    const p = hexPx(m);
    img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2];
  }
}

export function deckNoise(img, x0, y0, w, h, base, alt, seed, density = 0.07) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    rect(img, x, y, 1, 1, base);
    if (r() < density) dot(img, x, y, alt);
  }
}

/** Parapet rim around the roof: lit cap on the north and west, shaded inner lip. `col` = 4-step pastel ramp. */
export function parapet(img, col, w, h = H) {
  rect(img, 0, 0, w, 5, col[2]);
  hline(img, 0, 0, w, col[3]);
  hline(img, 0, 3, w, col[1]);
  hline(img, 0, 4, w, col[0]);
  for (const [x, lit] of [[0, true], [w - 3, false]]) {
    rect(img, x, 5, 3, h - 5, col[lit ? 2 : 1]);
    vline(img, x, 5, h - 5, col[lit ? 3 : 2]);
    vline(img, x + 2, 5, h - 5, col[0]);
  }
}

export function tank(img, x, y, pal = TANK) {
  // platform, body, lid, hoops, a cast shadow on the deck
  shadowOn(img, x + 4, y + 18, 18, 6, 0.32);
  rect(img, x + 1, y + 16, 15, 3, C.slate2);
  hline(img, x + 1, y + 16, 15, C.mist2);
  hline(img, x + 1, y + 18, 15, C.slate);
  for (const lx of [x + 2, x + 13]) rect(img, lx, y + 19, 2, 3, C.navy2);
  shape(img, boxP(x + 1, y + 5, x + 16, y + 16), [x + 8, y + 10, 7, 6], pal, { flat: false, t: [0.7, 0.2, -0.3] });
  shape(img, ell(x + 8.5, y + 5.5, 7.5, 3.2), [x + 8.5, y + 5.5, 7.5, 3.2], [pal[1], pal[2], pal[3], '#f0efde'], {});
  hline(img, x + 1, y + 10, 15, pal[0]);
  hline(img, x + 1, y + 13, 15, pal[0]);
  dot(img, x + 8, y + 4, C.navy);
  dot(img, x + 9, y + 4, '#f0efde');
}

export function dish(img, x, y) {
  shadowOn(img, x + 3, y + 8, 9, 4, 0.3);
  line(img, x + 5, y + 10, x + 6, y + 6, C.slate);
  shape(img, ell(x + 5.5, y + 4.5, 5.6, 4.4), [x + 5.5, y + 4.5, 5.6, 4.4], [C.lav2, C.lav3, C.lav3, C.white], { flat: true });
  shape(img, ell(x + 5, y + 4.5, 3.6, 2.8), [x + 5, y + 4.5, 3.6, 2.8], [C.slate, C.slate2, C.mist, C.mist2], { outline: false });
  dot(img, x + 5, y + 4, C.slate);
  line(img, x + 5, y + 4, x + 10, y - 1, C.navy2);
  dot(img, x + 10, y - 1, C.r2);
}

export function antenna(img, x, y, hgt = 18) {
  shadowOn(img, x + 1, y + hgt, 7, 2, 0.3);
  vline(img, x, y, hgt, C.navy2);
  vline(img, x + 1, y + 2, hgt - 2, C.mist);
  for (let i = 0; i < 4; i++) {
    const yy = y + 2 + i * 4;
    const hw = 6 - i;
    hline(img, x - hw, yy, hw * 2 + 2, C.slate2);
    hline(img, x - hw + 1, yy, hw * 2, C.lav2);
  }
}

export function laundry(img, x0, x1, y, seed) {
  const r = rng(seed);
  const cols = ['#f8f8f8', '#fc5c46', '#4280dd', '#f2b22b', '#ffa0a0', '#64b63b', '#f5e6d3'];
  for (const x of [x0, x1]) { vline(img, x, y - 4, 7, C.navy2); dot(img, x + 1, y + 3, C.navy); }
  for (let x = x0; x <= x1; x++) dot(img, x, y + (x - x0 < 3 || x1 - x < 3 ? 0 : 1), C.mist2);
  let x = x0 + 3;
  while (x < x1 - 3) {
    const c = cols[Math.floor(r() * cols.length)];
    const wd = 3 + Math.floor(r() * 3);
    const ht = 4 + Math.floor(r() * 3);
    rect(img, x, y + 1, wd, ht, c);
    hline(img, x, y + 1, wd, mix(c, '#ffffff', 0.35));
    hline(img, x + 1, y + 1 + ht, wd, mix(c, '#2a2a48', 0.5)); // shadow on the deck, lowered and to the right
    vline(img, x + wd, y + 2, ht - 1, shade(c));
    x += wd + 2 + Math.floor(r() * 3);
  }
}

export function plant(img, x, y, big = false) {
  const r = big ? 4 : 3;
  shadowOn(img, x + 3, y + 3, 7, 3, 0.3);
  rect(img, x + 1, y + r + 1, 5, 4, K.te2);
  hline(img, x + 1, y + r + 1, 5, K.te0);
  hline(img, x + 1, y + r + 4, 5, K.te4);
  dot(img, x + 1, y + r + 2, K.te1);
  shape(img, ell(x + 3.5, y + r, r + 0.8, r), [x + 3.5, y + r, r + 0.8, r], PLANT, {});
  if (big) { dot(img, x + 2, y + 1, C.r2); dot(img, x + 5, y + 2, C.y2); }
}

export function acUnit(img, x, y) {
  shadowOn(img, x + 2, y + 6, 11, 3, 0.3);
  rect(img, x, y, 11, 7, C.lav3);
  hline(img, x, y, 11, C.white);
  hline(img, x, y + 6, 11, C.mist);
  vline(img, x + 10, y, 7, C.mist2);
  shape(img, ell(x + 4, y + 3.5, 2.6, 2.6), [x + 4, y + 3.5, 2.6, 2.6], [C.slate, C.slate2, C.mist, C.lav2], {});
  for (let i = 0; i < 3; i++) hline(img, x + 7, y + 1 + i * 2, 3, C.slate2);
  box(img, x - 1, y - 1, 13, 9, null, C.navy);
}

function box(img, x, y, w, h, fill, outline) {
  if (fill) rect(img, x + 1, y + 1, w - 2, h - 2, fill);
  hline(img, x, y, w, outline); hline(img, x, y + h - 1, w, outline);
  vline(img, x, y, h, outline); vline(img, x + w - 1, y, h, outline);
}

export function bricks(img, x, y, w, h) {
  // a stack of weight-bricks / a cement block on a roof
  shadowOn(img, x + 2, y + h, w, 2, 0.3);
  rect(img, x, y, w, h, '#b18a74');
  hline(img, x, y, w, '#d0be9c');
  hline(img, x, y + h - 1, w, '#916662');
  vline(img, x + w - 1, y, h, '#916662');
  if (h > 3) hline(img, x, y + 2, w, '#9c786b');
  box(img, x - 1, y - 1, w + 2, h + 2, null, C.navy);
}

// ---------------------------------------------------------------- the roofs
/** 1: concrete slab, pastel parapet, caixa d'água on legs, laundry, plants. */
function laje(w, cw, seed, tankPal = TANK) {
  const img = blank(w, H);
  deckNoise(img, 0, 0, w, H, '#b7b2cb', '#a3a2bd', seed, 0.09);
  // expansion joints and a patched corner
  for (let x = 28; x < w; x += 34) vline(img, x, 6, H - 6, '#a2a0ba');
  hline(img, 3, 30, w - 6, '#a2a0ba');
  parapet(img, PASTEL[cw], w);
  tank(img, w - 36, 8, tankPal);
  laundry(img, 9, 50, 38, seed + 3);
  plant(img, 10, 10, true);
  plant(img, 24, 14);
  dish(img, 58, 12 + (seed % 3));
  plant(img, w - 18, 46);
  return outlineAround(img);
}

/** 2: colonial tile roof, two slopes and a ridge, chimney, antenna. */
function ceramica(w, cw, seed, tone = 0) {
  const img = blank(w, H);
  const t = tone ? ['#3f3f58', '#54567a', '#6c7194', '#8489ab', '#a6abc8'] : [K.te3, K.te2, K.te1, K.te0, K.or2];
  const ridge = tone ? 30 : 22;
  const rr = rng(seed);
  // colonial tile (capa e canal): vertical barrels, a darker seam every 5 rows
  const paint = (y0, y1, dark) => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
      const col = x % 4;
      let c = col === 0 ? t[dark ? 1 : 3] : col === 3 ? t[dark ? 0 : 1] : t[dark ? 1 : 2];
      if ((y - y0) % 6 === 5) c = t[dark ? 0 : 1];
      if (rr() < 0.02) c = t[dark ? 0 : 4];
      rect(img, x, y, 1, 1, c);
    }
  };
  paint(0, ridge, true);
  rect(img, 0, ridge, w, 3, t[3]);
  hline(img, 0, ridge, w, t[4]);
  hline(img, 0, ridge + 2, w, t[1]);
  paint(ridge + 3, H, false);
  vline(img, 0, 0, H, t[4]);
  vline(img, w - 1, 0, H, t[0]);
  if (!tone) {
    bricks(img, w - 26, 5, 8, 14);
    rect(img, w - 27, 4, 10, 2, '#d0be9c');
    antenna(img, 18, 27, 20);
    shadowOn(img, 52, 44, 18, 4, 0.3);
    rect(img, 46, 36, 16, 10, K.gl3);
    box(img, 46, 36, 16, 10, null, C.navy);
    hline(img, 47, 37, 14, K.gl1);
    vline(img, 54, 37, 8, K.gl5);
    for (let i = 0; i < 6; i++) dot(img, 48 + i * 2, 38 + (i % 3) * 2, C.white);
    plant(img, 8, 50);
  } else {
    // slate hip roof: a tank on a slab platform, a dish, a cat-door skylight
    rect(img, 6, 6, 26, 20, '#b7b2cb');
    box(img, 5, 5, 28, 22, null, C.navy);
    hline(img, 6, 6, 26, C.lav3);
    tank(img, 9, 4, TANK_ALT);
    dish(img, w - 26, 38);
    antenna(img, 40, 36, 18);
    plant(img, w - 18, 10, true);
  }
  return outlineAround(img);
}

/** 3: corrugated fibrocimento sheets held down by bricks, dish and TV mast. */
function fibro(w, cw, seed, pal = 0) {
  const img = blank(w, H);
  const sheets = pal ? ['#9bc2b6', '#7fae9f', '#67988a', '#4f7f6a'] : ['#d6dde6', '#b9c4d2', '#9eabbf', '#8391a8'];
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
    const rib = x % 4;
    rect(img, x, y, 1, 1, sheets[rib === 0 ? 0 : rib === 3 ? 3 : rib === 1 ? 1 : 2]);
  }
  // sheet seams (overlaps), each a shaded line and a lit one
  for (const y of [20, 41]) { hline(img, 0, y, w, sheets[3]); hline(img, 0, y + 1, w, sheets[0]); hline(img, 0, y + 2, w, sheets[1]); }
  parapet(img, PASTEL[cw], w);
  const r = rng(seed);
  for (let i = 0; i < 9; i++) bricks(img, 8 + Math.floor(r() * (w - 22)), 7 + Math.floor(r() * 50), 5, 3);
  antenna(img, w - 22, 8, 22);
  dish(img, 14, 24);
  tank(img, w - 46, 28, TANK_ALT);
  laundry(img, 8, 30, 54, seed + 9);
  return outlineAround(img);
}

/** 4: terraço with grill, parasol table, AC units, plants. */
function terraco(w, cw, seed) {
  const img = blank(w, H);
  deckNoise(img, 0, 0, w, H, '#c78c59', '#b5754d', seed, 0.06);
  // clay floor tiles
  for (let y = 7; y < H; y += 8) hline(img, 0, y, w, '#b5754d');
  for (let x = 6; x < w; x += 12) for (let y = 7; y < H; y += 8) vline(img, x + ((y >> 3) % 2) * 6, y, 8, '#b5754d');
  parapet(img, PASTEL[cw], w);
  // churrasqueira (brick grill with a chimney)
  shadowOn(img, 14, 26, 14, 4, 0.3);
  rect(img, 8, 10, 14, 16, '#a85f46');
  hline(img, 8, 10, 14, '#dcaa8a');
  for (let y = 13; y < 26; y += 3) hline(img, 8, y, 14, '#8f4b38');
  rect(img, 11, 4, 6, 8, '#a85f46');
  hline(img, 11, 4, 6, '#dcaa8a');
  rect(img, 11, 18, 8, 6, C.navy2);
  hline(img, 11, 18, 8, C.slate);
  box(img, 7, 9, 16, 18, null, C.navy);
  // table with a striped parasol
  shadowOn(img, 50, 40, 18, 6, 0.3);
  shape(img, ell(57, 40, 7, 3.5), [57, 40, 7, 3.5], [K.br2, K.br1, K.or3, K.or1], {});
  for (const x of [52, 61]) rect(img, x, 43, 2, 6, K.br2);
  const stripes = ['#fc5c46', '#f8f8f8'];
  shape(img, ell(57, 28, 14, 9), [57, 28, 14, 9], [C.r4, C.r3, C.r2, C.r1], { pattern: (x, y, i) => ((x >> 2) % 2 ? i : 3) });
  void stripes;
  dot(img, 57, 28, C.navy);
  // ACs and plants
  acUnit(img, w - 22, 12);
  acUnit(img, w - 22, 26);
  tank(img, 4, 36, TANK_GREY);
  plant(img, 30, 48, true);
  plant(img, w - 20, 50);
  plant(img, w - 32, 10);
  return outlineAround(img);
}

/** 5: slab with a puxadinho (extra room: corrugated roof, wall face, door, window) and a tank on top. */
function puxadinho(w, cw, seed) {
  const img = blank(w, H);
  deckNoise(img, 0, 0, w, H, '#b2aecb', '#9ea0bb', seed, 0.1);
  hline(img, 4, 34, w - 8, '#9ea0bb');
  parapet(img, PASTEL[cw], w);
  // the little room (wall face under its roof)
  const rx = 12, ry = 10, rw = 44, rh = 40;
  shadowOn(img, rx + 6, ry + rh, rw, 6, 0.32);
  shadowOn(img, rx + rw, ry + 6, 6, rh, 0.3);
  const wall = PASTEL[cw === 'amarelo' ? 'verde' : 'amarelo'];
  rect(img, rx, ry + 16, rw, rh - 16, wall[2]);
  hline(img, rx, ry + 16, rw, wall[0]);
  vline(img, rx, ry + 16, rh - 16, wall[3]);
  vline(img, rx + rw - 1, ry + 16, rh - 16, wall[1]);
  // roof plate (corrugated), overhanging
  for (let y = ry; y < ry + 18; y++) for (let x = rx - 2; x < rx + rw + 2; x++) rect(img, x, y, 1, 1, ['#d6dde6', '#b9c4d2', '#9eabbf', '#b9c4d2'][x % 4]);
  hline(img, rx - 2, ry, rw + 4, C.white);
  hline(img, rx - 2, ry + 17, rw + 4, '#6c6e85');
  box(img, rx - 3, ry - 1, rw + 6, 20, null, C.navy);
  // door and window
  rect(img, rx + 6, ry + 24, 11, 26, '#2e7177');
  box(img, rx + 5, ry + 23, 13, 28, null, C.navy);
  rect(img, rx + 8, ry + 26, 7, 8, K.gl3);
  dot(img, rx + 15, ry + 40, C.y2);
  rect(img, rx + 25, ry + 26, 13, 11, K.gl3);
  box(img, rx + 24, ry + 25, 15, 13, null, C.navy);
  vline(img, rx + 31, ry + 26, 11, K.gl5);
  hline(img, rx + 25, ry + 31, 13, K.gl5);
  hline(img, rx + 25, ry + 26, 13, K.gl1);
  box(img, rx, ry + 16, rw, rh - 16, null, C.navy);
  // tank on top, antenna, plants
  tank(img, w - 34, 6, TANK);
  antenna(img, w - 10, 30, 22);
  plant(img, 62, 34);
  plant(img, 4, 54);
  laundry(img, 60, w - 18, 54, seed + 5);
  return outlineAround(img);
}

/** 6: a low pastel building with a flat roof edge, a tile pergola strip and lots of plants (roof garden). */
function jardim(w, cw, seed) {
  const img = blank(w, H);
  deckNoise(img, 0, 0, w, H, '#a9b09a', '#9aa58d', seed, 0.1); // gravel / moss
  parapet(img, PASTEL[cw], w);
  // planter beds with bushes
  for (const [bx, by, bw] of [[10, 12, 30], [10, 40, 24], [w - 40, 30, 28]]) {
    shadowOn(img, bx + 2, by + 9, bw, 4, 0.3);
    rect(img, bx, by, bw, 10, '#7b5b3a');
    hline(img, bx, by, bw, '#a9764f');
    for (let i = 0; i < bw; i += 5) shape(img, ell(bx + i + 3, by + 2, 3.4, 3), [bx + i + 3, by + 2, 3.4, 3], PLANT, {});
    for (let i = 2; i < bw; i += 9) dot(img, bx + i, by + 1, [C.r1, C.y2, C.p0][(i + seed) % 3]);
    box(img, bx - 1, by - 3, bw + 2, 14, null, C.navy);
  }
  // pergola beams
  const px0 = w - 44;
  for (let i = 0; i < 6; i++) { rect(img, px0 + i * 6, 8, 2, 18, K.br2); hline(img, px0 + i * 6, 8, 2, K.or3); }
  hline(img, px0 - 2, 8, 36, K.br1);
  hline(img, px0 - 2, 25, 36, K.br3);
  shadowOn(img, px0, 27, 36, 4, 0.28);
  dish(img, 50, 34);
  tank(img, 48, 6, TANK);
  laundry(img, 10, 40, 58, seed + 1);
  return outlineAround(img);
}

const ROOFS = [
  ['telhados/r1', 6, (w) => laje(w, 'amarelo', 11)],
  ['telhados/r2', 6, (w) => ceramica(w, 'salmao', 23)],
  ['telhados/r3', 6, (w) => fibro(w, 'azul', 35)],
  ['telhados/r4', 7, (w) => terraco(w, 'lilas', 47)],
  ['telhados/r5', 6, (w) => puxadinho(w, 'salmao', 59)],
  ['telhados/r6', 6, (w) => ceramica(w, 'verde', 71, 1)],
  ['telhados/r7', 6, (w) => jardim(w, 'creme', 83)],
  ['telhados/r8', 6, (w) => fibro(w, 'verde', 95, 1)],
  ['telhados/r9', 7, (w) => laje(w, 'azul', 107, TANK_GREY)],
];

export async function telhados() {
  return ROOFS.map(([key, tiles, fn]) => {
    const img = fn(tiles * 16);
    return { key, img, anchor: [Math.floor(img.w / 2), img.h - 1], meta: { footprint: [tiles, 4], shadow: null } };
  });
}

export async function preview() {
  return ROOFS.map(([, tiles, fn]) => fn(tiles * 16));
}
void setPx;

// ---------------------------------------------------------------- west block: the edícula (little back house) in the fenced garden
function edicula() {
  const w = 48, h = 44;
  const img = blank(w, h);
  const wall = PASTEL.azul;
  // wall face (south front), plaster with a little noise
  const r = rng(5);
  for (let y = 16; y < h; y++) for (let x = 2; x < w - 2; x++) rect(img, x, y, 1, 1, r() < 0.07 ? wall[1] : wall[2]);
  vline(img, 2, 16, h - 16, wall[3]);
  vline(img, w - 3, 16, h - 16, wall[1]);
  rect(img, 2, h - 5, w - 4, 5, PASTEL.creme[1]); // plinth
  hline(img, 2, h - 5, w - 4, PASTEL.creme[3]);
  // tile roof (colonial), overhanging, lit from the upper left
  for (let y = 0; y < 17; y++) for (let x = 0; x < w; x++) {
    const col = x % 4;
    let c = col === 0 ? K.te0 : col === 3 ? K.te2 : K.te1;
    if (y % 5 === 4) c = K.te3;
    rect(img, x, y, 1, 1, c);
  }
  hline(img, 0, 0, w, K.or2);
  hline(img, 0, 16, w, K.te4);
  // door with a glass pane, window with iron bars, lamp and a fuse box
  rect(img, 7, 22, 11, 17, C.teal1);
  hline(img, 7, 22, 11, C.teal3);
  rect(img, 9, 24, 7, 6, K.gl3);
  hline(img, 9, 24, 7, K.gl1);
  dot(img, 15, 33, C.y2);
  box(img, 6, 21, 13, 19, null, C.navy);
  rect(img, 26, 23, 14, 11, K.gl3);
  hline(img, 26, 23, 14, K.gl1);
  for (let x = 28; x < 40; x += 3) vline(img, x, 23, 11, C.slate);
  hline(img, 26, 28, 14, C.slate);
  box(img, 25, 22, 16, 13, null, C.navy);
  hline(img, 25, 35, 16, PASTEL.creme[3]); // sill
  rect(img, 22, 20, 3, 3, C.y1);
  dot(img, 23, 21, C.white);
  rect(img, 42, 28, 3, 5, C.lav3);
  box(img, 41, 27, 5, 7, null, C.navy);
  outlineAround(img);
  return img;
}

export async function edicula_part() {
  return [{ img: edicula(), anchor: [24, 43] }];
}
