// Pet Shop do Seu Dito (#234, docs/PET-STORE-PLAN.md §1.3–1.5). One derive (`petshopSet`) emits every piece:
//
//   the street      facades/petshop (+ _lit): LimeZu's STORE front (Modern Exteriors, 9_Shopping_Center_and_Markets) cut to 6 x 6 tiles:
//                   the flat roof shortened to the terraço houses' 45 rows, the shop window widened by one 16 px band, the walls repainted
//                   mustard, the PET SHOP · DO SEU DITO marquee on the wall panel, an sp-green scalloped awning, an ABERTO board over
//                   the door, a bone sign, a paw decal, a sleeping dog in the
//                   left pane and a cat loaf on a shelf in the right one. props/placa_petshop (the ADOTE sandwich board), props/tigela_calcada
//   the interior    props/cercadinho, gatil, arranhador, prateleira_racao, cesto_brinquedos, caminha_xadrez / _azul / _cesta, pote_duplo,
//                   saco_racao, balanca_pet, mesa_tosa, banheira_tosa (2 frames), secador, toalha_pet, aquario (2 frames)
//   the walls       walls/quadro_racas (the breed chart), walls/poster_adocao, walls/placa_banho_tosa, walls/placa_vet
//   fx              fx/carinho (three frames of two hearts rising), fx/ossinho and fx/pelucia (the toys a resting pet holds)
//
// Light from the upper left, a 1 px navy outline where a shape meets empty space, LimeZu palette plus the brand colours, no gradients.
import { blank, clone, crop, flipH, paste, px } from '../../../../scripts/lib/pixel/img.mjs';
import { put, fillRect, shape, flat, ell, box, or, and, not, mix, h2, NAVY } from './paint.mjs';
import { swap, stretchCols, outlineAround } from './kit.mjs';
import { findGlass } from './shop.mjs';
import { litOverlay } from './facades.mjs';
import { drawText5, width5 } from './font5.mjs';
import { soleira } from './v3.mjs';

const MARKETS = 'ext:ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_16x16.png';

// ------------------------------------------------------------------ palette (LimeZu + brand)
export const P = {
  navy: NAVY, navy2: '#46465e', slate: '#565972', mist: '#8b8bab', lav: '#c6bdd5', lav4: '#ebe4f2', white: '#f8f8f8',
  // sp-green (brand #2F5D50 and its LimeZu neighbours)
  sp0: '#24554e', sp1: '#2f5d50', sp2: '#46756a', sp3: '#588278', sp4: '#689183',
  // mustard (brand #d4a017) ramp for the walls
  mu0: '#a86f1e', mu1: '#c98a1e', mu2: '#d4a017', mu3: '#f2b22b', mu4: '#f8d239', mu5: '#fff59a',
  cream: '#f5e6d3', cream1: '#f0efde', cream2: '#e0d0b2', cream3: '#d0be9c',
  wood0: '#573c2c', wood1: '#6b4c2c', wood2: '#8b5e3c', wood3: '#a9764f', wood4: '#c78c59', wood5: '#daa463', wood6: '#f2bd7a',
  red0: '#9e2b2d', red1: '#cb2a2a', red2: '#d93232', red3: '#fc5c46', red4: '#ff8575',
  blue0: '#2a3a96', blue1: '#3d56d2', blue2: '#4280dd', blue3: '#50a7e8', blue4: '#95e3e3', blue5: '#defff7',
  pink0: '#b95d72', pink1: '#e07070', pink2: '#ffa0a0',
  green0: '#32675a', green1: '#568d61', green2: '#64b63b', green3: '#9bc246',
  grey0: '#6c6e85', grey1: '#a2a6be', grey2: '#d8d0e0',
  // the caramel dog and the ginger cat of the window (the legacy pet colours)
  car0: '#8a5a38', car1: '#c78c59', car2: '#daa463', car3: '#f2bd7a',
  gin0: '#b5541b', gin1: '#ed931e', gin2: '#f2b22b', gin3: '#ffe57b',
};

const rect = (img, x, y, w, h, hex) => fillRect(img, x, y, w, h, hex);
const dot = (img, x, y, hex) => put(img, x, y, hex);
const hline = (img, x, y, w, hex) => fillRect(img, x, y, w, 1, hex);
const vline = (img, x, y, h, hex) => fillRect(img, x, y, 1, h, hex);

// ------------------------------------------------------------------ 3x5 font with accents (signs, chart, sandwich board)
const G = (s) => s.split('/');
const FONT = {
  A: G('.#./#.#/###/#.#/#.#'), B: G('##./#.#/##./#.#/##.'), C: G('.##/#../#../#../.##'), D: G('##./#.#/#.#/#.#/##.'),
  E: G('###/#../##./#../###'), F: G('###/#../##./#../#..'), G: G('.##/#../#.#/#.#/.##'), H: G('#.#/#.#/###/#.#/#.#'),
  I: G('###/.#./.#./.#./###'), J: G('..#/..#/..#/#.#/.#.'), K: G('#.#/#.#/##./#.#/#.#'), L: G('#../#../#../#../###'),
  M: G('#...#/##.##/#.#.#/#...#/#...#'), N: G('##./#.#/#.#/#.#/#.#'), O: G('.#./#.#/#.#/#.#/.#.'), P: G('##./#.#/##./#../#..'),
  Q: G('.#./#.#/#.#/##./.##'), R: G('##./#.#/##./#.#/#.#'), S: G('.##/#../.#./..#/##.'), T: G('###/.#./.#./.#./.#.'),
  U: G('#.#/#.#/#.#/#.#/###'), V: G('#.#/#.#/#.#/#.#/.#.'), W: G('#...#/#...#/#.#.#/##.##/#...#'), X: G('#.#/#.#/.#./#.#/#.#'),
  Y: G('#.#/#.#/.#./.#./.#.'), Z: G('###/..#/.#./#../###'),
  0: G('###/#.#/#.#/#.#/###'), 1: G('.#./##./.#./.#./###'), 2: G('##./..#/.#./#../###'), 3: G('##./..#/.#./..#/##.'),
  '!': G('#/#/#/./#'), '-': G('.../.../###/.../...'), '·': G('./././#/.'), ' ': G('./././././.'),
};
const MARK = { '́': 2, '̀': 0, '̂': 1, '̃': 1 };
function glyphs(str) {
  const out = [];
  for (const ch of str.normalize('NFD')) {
    if (ch in MARK && out.length) out[out.length - 1].mark = ch;
    else if (ch === '̧' && out.length) out[out.length - 1].cedilla = true;
    else {
      const rows = FONT[ch.toUpperCase()];
      if (!rows) throw new Error(`petshop font: no glyph for '${ch}' in '${str}'`);
      out.push({ rows, mark: null, cedilla: false });
    }
  }
  return out;
}
export const textW = (str) => glyphs(str).reduce((w, g) => w + g.rows[0].length + 1, 0) - 1;
/** Paints `str` with its cap top-left at (x, y). Accents sit one row above the letter, the cedilla one row below. */
export function text(img, x, y, str, hex, shadow = null) {
  let cx = x;
  for (const g of glyphs(str)) {
    const paint = (c, dy) => g.rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') dot(img, cx + rx, y + ry + dy, c); });
    if (shadow) paint(shadow, 1);
    paint(hex, 0);
    if (g.mark === '̃') { dot(img, cx, y - 1, hex); dot(img, cx + 1, y - 2, hex); dot(img, cx + 2, y - 1, hex); }
    else if (g.mark === '̂') { dot(img, cx, y - 1, hex); dot(img, cx + 1, y - 2, hex); dot(img, cx + 2, y - 1, hex); }
    else if (g.mark) dot(img, cx + MARK[g.mark], y - 1, hex);
    if (g.cedilla) dot(img, cx + 1, y + 5, hex);
    cx += g.rows[0].length + 1;
  }
}

// ------------------------------------------------------------------ little animals and objects shared by the facade, the chart and the props
/** A sleeping dog seen from the side, curled (13 x 7): the body, then the head resting on the paws with a floppy ear. */
function sleepingDog(img, x, y, ramp = [P.car0, P.car1, P.car2, P.car3]) {
  shape(img, ell(x + 5, y + 4.5, 5, 2.6), [x + 4, y + 3, 6, 3], ramp);
  shape(img, ell(x + 10, y + 4.6, 2.6, 2.1), [x + 9.5, y + 4, 3, 2.4], ramp, { ol: ramp[0] });
  dot(img, x + 9, y + 3, ramp[0]); dot(img, x + 9, y + 4, ramp[0]); // the ear
  dot(img, x + 10, y + 4, NAVY); dot(img, x + 11, y + 4, NAVY); // the closed eye
  dot(img, x + 12, y + 5, NAVY); // the nose
  dot(img, x, y + 3, ramp[2]); dot(img, x + 1, y + 2, ramp[2]); // the tail tip over the back
}

/** A cat loaf (8 x 6) facing the viewer: ears, two slit eyes, a tail curled at the side. */
function catLoaf(img, x, y, ramp = [P.gin0, P.gin1, P.gin2, P.gin3]) {
  const loafShape = or(ell(x + 4, y + 4, 4, 2.4), ell(x + 4, y + 2.4, 2.8, 2.2));
  shape(img, loafShape, [x + 4, y + 3, 4, 3], ramp);
  dot(img, x + 1, y, NAVY); dot(img, x + 2, y + 1, ramp[2]); dot(img, x + 6, y, NAVY); dot(img, x + 5, y + 1, ramp[2]);
  dot(img, x + 3, y + 2, NAVY); dot(img, x + 5, y + 2, NAVY);
  dot(img, x + 4, y + 3, P.pink1);
  for (const sx of [x + 2, x + 6]) dot(img, sx, y + 4, ramp[0]); // tabby stripes
}

/** A paw print (5 x 5): the pad and four toes. */
function paw(img, x, y, hex) {
  for (const [dx, dy] of [[0, 1], [1, 0], [3, 0], [4, 1], [1, 3], [2, 3], [3, 3], [1, 4], [2, 4], [3, 4], [2, 2]]) dot(img, x + dx, y + dy, hex);
}

/** A bone (w x 4): the knobs at both ends, the shaft between. */
function bone(img, x, y, w, base, shade) {
  rect(img, x + 1, y + 1, w - 2, 2, base);
  for (const ex of [x, x + w - 2]) { rect(img, ex, y, 2, 2, base); rect(img, ex, y + 2, 2, 2, base); }
  hline(img, x + 2, y + 2, w - 4, shade);
  dot(img, x + 1, y + 3, shade); dot(img, x + w - 1, y + 3, shade);
}

// ------------------------------------------------------------------ the facade
const WALL_SWAP = { '#416095': P.mu0, '#5f90ae': P.mu2, '#74aabf': P.mu3 };

/** The awning: sp-green and cream stripes, 4 px each, with a scalloped edge (w x h). */
function awning(w, h) {
  const img = blank(w, h);
  for (let x = 0; x < w; x++) {
    const green = Math.floor(x / 4) % 2 === 0;
    const base = green ? P.sp2 : P.cream;
    const lo = green ? P.sp1 : P.cream2;
    const hi = green ? P.sp3 : P.white;
    const k = x % 8;
    const drop = h - (k === 0 || k === 7 ? 4 : k === 1 || k === 6 ? 3 : 2);
    for (let y = 0; y <= drop; y++) put(img, x, y, y === 0 ? NAVY : y === 1 ? hi : y >= drop - 1 ? lo : base);
    put(img, x, drop + 1, NAVY);
  }
  return img;
}

/** The dressing behind the two panes of the shop window: a dog asleep on a bed (left), a cat loaf on a shelf (right). */
function windowDressing(img, [x, y, w, h], night = false) {
  const half = Math.floor(w / 2);
  const dim = (hex) => (night ? mix(hex, '#3a2a18', 0.3) : hex);
  // left pane: a red cushion bed with the caramel dog
  const bx = x + 2, by = y + h - 7;
  rect(img, bx, by + 2, 15, 4, dim(P.red1)); hline(img, bx, by + 2, 15, dim(P.red3)); hline(img, bx, by + 5, 15, dim(P.red0));
  rect(img, bx + 2, by + 1, 11, 2, dim(P.cream2));
  sleepingDog(img, bx + 2, by - 4, [P.car0, P.car1, P.car2, P.car3].map(dim));
  // the paw decal on the glass (top-left of the left pane)
  if (!night) paw(img, x + 2, y + 2, P.mu1);
  // right pane: a wooden shelf with the cat loaf and a ball of yarn
  const sx = x + half + 2, sy = y + Math.floor(h / 2) + 1;
  rect(img, sx, sy, w - half - 4, 2, dim(P.wood3)); hline(img, sx, sy + 1, w - half - 4, dim(P.wood1));
  catLoaf(img, sx + 2, sy - 6, [P.gin0, P.gin1, P.gin2, P.gin3].map(dim));
  shape(img, ell(sx + 14, sy - 2, 2, 2), [sx + 14, sy - 2, 2, 2], [P.blue0, P.blue1, P.blue2, P.blue3].map(dim));
  // bags of ração on the floor of the right pane
  [P.red1, P.sp2].forEach((c, i) => {
    rect(img, sx + 1 + i * 6, y + h - 6, 5, 6, dim(c));
    hline(img, sx + 1 + i * 6, y + h - 6, 5, dim(P.cream));
    dot(img, sx + 3 + i * 6, y + h - 3, dim(P.cream));
  });
}

async function facade(ctx) {
  const sheet = await ctx.load(MARKETS);
  // rows 409..525 of the STORE front (117 rows): cut 21 rows out of the flat roof so the roof is 45 rows like the terraço houses
  const src = crop(sheet, 176, 409, 80, 117);
  let b = blank(80, 96);
  paste(b, crop(src, 0, 0, 80, 21), 0, 0);
  paste(b, crop(src, 0, 42, 80, 75), 0, 21);
  // widen the shop window by one 16 px band (glass, roof planks and plinth bricks all repeat cleanly there)
  b = stretchCols(b, 48, 64, 96);
  // mustard walls
  b = swap(b, WALL_SWAP);
  const glassAll = findGlass(b);
  const door = glassAll.find((r) => r[0] < 40);
  const shop = glassAll.find((r) => r[0] >= 40);
  // the pack's yellow striped awning (rows 52..65) goes under ours: scalloped, sp-green / cream; the wall shows between the scallops
  rect(b, 41, 52, 48, 14, P.mu3);
  hline(b, 41, 65, 48, P.mu2);
  paste(b, awning(48, 14), 41, 52);
  // the mullion that splits the window in two panes
  const [gx, gy, gw, gh] = shop;
  const mid = gx + Math.floor(gw / 2);
  vline(b, mid - 1, gy, gh, NAVY); vline(b, mid, gy, gh, P.lav); vline(b, mid + 1, gy, gh, NAVY);
  // the marquee on the wall panel (where the padaria carries its sign; the hotspot `petshop_letreiro` reads it): sp-green board,
  // mustard trim, PET SHOP in the 5 px font with DO SEU DITO under it in 3x5, a paw at both ends
  const mx = 8, my = 10, mw = 80, mh = 24;
  rect(b, mx, my, mw, mh, NAVY);
  rect(b, mx + 1, my + 1, mw - 2, mh - 2, P.sp1);
  hline(b, mx + 1, my + 1, mw - 2, P.sp3); vline(b, mx + 1, my + 1, mh - 2, P.sp2);
  hline(b, mx + 1, my + mh - 2, mw - 2, P.sp0); vline(b, mx + mw - 2, my + 1, mh - 2, P.sp0);
  hline(b, mx + 3, my + 3, mw - 6, P.mu3); hline(b, mx + 3, my + mh - 4, mw - 6, P.mu3);
  const title = 'PET SHOP';
  drawText5(b, mx + Math.floor((mw - width5(title)) / 2), my + 5, title, P.cream, { shadow: P.sp0 });
  const sub = 'DO SEU DITO';
  text(b, mx + Math.floor((mw - textW(sub)) / 2), my + 14, sub, P.mu4);
  paw(b, mx + 5, my + 8, P.mu3); paw(b, mx + mw - 10, my + 8, P.mu3);
  // ABERTO board over the door, overhanging the left pillar (the shop is open at every hour): sp-green, mustard trim, cream letters
  const bx = 1, by = 46, bw = 39, bh = 15;
  rect(b, bx, by, bw, bh, NAVY);
  rect(b, bx + 1, by + 1, bw - 2, bh - 2, P.sp1);
  hline(b, bx + 1, by + 1, bw - 2, P.sp3); vline(b, bx + 1, by + 1, bh - 2, P.sp2);
  hline(b, bx + 1, by + bh - 2, bw - 2, P.sp0);
  hline(b, bx + 2, by + 3, bw - 4, P.mu3); hline(b, bx + 2, by + bh - 4, bw - 4, P.mu3);
  const label = 'ABERTO';
  text(b, bx + Math.floor((bw - textW(label)) / 2), by + 5, label, P.cream, P.sp0);
  // a bone-shaped sign hanging under the board at the left pillar
  vline(b, 4, 61, 2, P.slate); vline(b, 9, 61, 2, P.slate);
  bone(b, 2, 63, 10, P.cream, P.cream3);
  outlineRegion(b, 1, 62, 12, 6);
  // window dressing (before the lit overlay is cut from the clean glass)
  const panes = [[gx, gy, mid - 1 - gx, gh], [mid + 2, gy, gx + gw - mid - 2, gh]];
  const lit = litOverlay(b.w, b.h, [door, ...panes]);
  windowDressing(b, shop);
  windowDressing(lit, shop, true);
  // the mullion stays dark on the lit overlay too
  vline(lit, mid - 1, gy, gh, NAVY); vline(lit, mid, gy, gh, P.wood1); vline(lit, mid + 1, gy, gh, NAVY);
  soleira(b);
  const windows = [door, ...panes];
  const meta = { footprint: [6, 6], shadow: null, cast: { kx: 0.3, ky: 0.16, rgba: [26, 16, 48, 84] } };
  return [
    { key: 'facades/petshop', img: b, anchor: [48, 95], meta: { ...meta, windows, lit: 'facades/petshop_lit' } },
    { key: 'facades/petshop_lit', img: lit, anchor: [48, 95], meta: { footprint: [6, 6], shadow: null } },
  ];
}

/** Navy outline around the opaque pixels of a region that touch transparency or the wall (a small hung piece). */
function outlineRegion(img, x, y, w, h) {
  const sub = crop(img, x, y, w, h);
  const keep = clone(sub);
  // only the pixels we painted inside the region count as the shape: everything that is not the bone colours is "outside"
  const isShape = (xx, yy) => {
    const p = px(keep, xx, yy);
    if (!p || !p[3]) return false;
    const hex = '#' + [0, 1, 2].map((c) => p[c].toString(16).padStart(2, '0')).join('');
    return hex === P.cream || hex === P.cream3;
  };
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (isShape(xx, yy)) continue;
    if (isShape(xx - 1, yy) || isShape(xx + 1, yy) || isShape(xx, yy - 1) || isShape(xx, yy + 1)) put(img, x + xx, y + yy, NAVY);
  }
}

// ------------------------------------------------------------------ the sidewalk
/** The ADOTE sandwich board (25 x 26): a green A-frame with a cream panel, a paw over the word. */
function placaPetshop() {
  const img = blank(27, 27);
  // legs of the A-frame (behind)
  for (let y = 4; y < 25; y++) { put(img, 3 + Math.floor((y - 4) / 10), y, P.wood1); put(img, 23 - Math.floor((y - 4) / 10), y, P.wood1); }
  // the board
  rect(img, 1, 2, 25, 19, P.sp1);
  hline(img, 1, 2, 25, P.sp3); vline(img, 1, 2, 19, P.sp2); vline(img, 25, 3, 18, P.sp0); hline(img, 1, 20, 25, P.sp0);
  rect(img, 3, 4, 21, 15, P.cream);
  hline(img, 3, 18, 21, P.cream2); vline(img, 23, 4, 15, P.cream2);
  paw(img, 11, 5, P.red1);
  text(img, 3 + Math.floor((21 - textW('ADOTE')) / 2), 12, 'ADOTE', P.sp1);
  // little feet
  put(img, 3, 25, P.wood0); put(img, 23, 25, P.wood0);
  outlineAround(img);
  return { img, anchor: [13, 26] };
}

/** The water bowl shops leave out for strays (14 x 7): steel rim, water with a glint. */
function tigelaCalcada() {
  const img = blank(14, 8);
  shape(img, ell(7, 4.5, 6, 2.6), [6, 3.5, 7, 3], [P.grey0, P.grey1, P.grey2, P.white]);
  flat(img, ell(7, 4, 4.2, 1.4), P.blue2, { outline: false });
  put(img, 5, 4, P.blue5); put(img, 6, 4, P.blue4);
  return { img, anchor: [7, 7] };
}

// ------------------------------------------------------------------ interior props
/** The dog pen (48 x 40, 3 x 2 tiles): a blanket on the floor, a white picket fence along the back and the sides, a low rail in front. */
function cercadinho() {
  const W = 48, H = 41;
  const img = blank(W, H);
  const floorTop = 9, floorBot = H - 3;
  // the blanket (a red / cream check) over the whole floor of the pen
  for (let y = floorTop; y < floorBot; y++) for (let x = 2; x < W - 2; x++) {
    const check = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
    put(img, x, y, check ? P.red2 : P.cream);
    if (h2(x, y, 4) < 0.05) put(img, x, y, check ? P.red1 : P.cream2);
  }
  hline(img, 2, floorBot - 1, W - 4, P.red0);
  // the back fence: pickets 3 px wide, 2 px apart, rails across
  const pickets = (y0, h, x0, x1) => {
    for (let x = x0; x < x1; x += 5) {
      rect(img, x, y0 + 1, 3, h - 1, P.white);
      put(img, x + 1, y0, P.white);
      vline(img, x + 2, y0 + 1, h - 1, P.lav);
    }
  };
  pickets(1, 11, 1, W - 1);
  hline(img, 1, 3, W - 2, P.lav4); hline(img, 1, 8, W - 2, P.lav4);
  hline(img, 1, 4, W - 2, P.lav); hline(img, 1, 9, W - 2, P.lav);
  // side posts (seen end on) down both sides
  for (const x of [1, W - 3]) { rect(img, x, 10, 2, H - 13, P.white); vline(img, x + 1, 10, H - 13, P.lav); }
  // the low front rail with two posts at the corners and a little gate in the middle
  rect(img, 1, H - 6, W - 2, 2, P.white); hline(img, 1, H - 5, W - 2, P.lav);
  for (const x of [1, W - 3, 21, 26]) { rect(img, x, H - 9, 2, 7, P.white); vline(img, x + 1, H - 9, 7, P.lav); }
  put(img, 24, H - 7, P.mu2); // the gate latch
  // a water bowl in the corner of the blanket and a chew bone
  shape(img, ell(40, 30, 3, 1.6), [39, 29, 3, 2], [P.blue0, P.blue1, P.blue2, P.blue3]);
  put(img, 39, 29, P.blue4);
  bone(img, 7, 27, 7, P.cream, P.cream3);
  outlineAround(img);
  return { img, anchor: [24, 32] };
}

/** The cat pen (32 x 44, 2 x 2 tiles): a cushion floor, a wall shelf with a cubby, and a cat tree with two platforms on the right. */
function gatil() {
  const W = 34, H = 45;
  const img = blank(W, H);
  // the cushion floor (sp-green)
  rect(img, 1, 14, W - 2, H - 16, P.sp2);
  for (let y = 14; y < H - 2; y++) for (let x = 1; x < W - 1; x++) if ((x + y) % 6 === 0) put(img, x, y, P.sp3);
  hline(img, 1, H - 3, W - 2, P.sp1);
  // the back: a mesh panel (white frame, grey wire) behind the floor
  rect(img, 1, 1, W - 2, 14, P.white);
  for (let y = 3; y < 13; y++) for (let x = 3; x < W - 3; x++) put(img, x, y, (x + y) % 3 === 0 ? P.grey1 : P.grey2);
  vline(img, 1, 1, 14, P.lav4); vline(img, W - 2, 1, 14, P.lav);
  // a wooden cubby box on the left (a cat hides in the hole)
  rect(img, 3, 16, 12, 10, P.wood4); hline(img, 3, 16, 12, P.wood5); vline(img, 14, 16, 10, P.wood2); hline(img, 3, 25, 12, P.wood2);
  flat(img, ell(9, 21.5, 3, 3), P.wood0, { outline: false });
  // the cat tree on the right: sisal post and two carpeted platforms
  rect(img, 25, 6, 3, H - 12, P.cream2);
  for (let y = 6; y < H - 6; y += 2) hline(img, 25, y, 3, P.cream3);
  for (const [py, pw] of [[6, 10], [22, 8]]) {
    rect(img, 30 - pw, py, pw + 2, 3, P.pink1); hline(img, 30 - pw, py, pw + 2, P.pink2); hline(img, 30 - pw, py + 2, pw + 2, P.pink0);
  }
  // a dangling mouse toy on a string under the top platform
  vline(img, 22, 9, 5, P.slate);
  put(img, 21, 14, P.grey1); put(img, 22, 14, P.grey1); put(img, 23, 14, P.grey2); put(img, 22, 15, P.pink1);
  // the base of the tree
  rect(img, 22, H - 6, 10, 3, P.pink1); hline(img, 22, H - 6, 10, P.pink2);
  outlineAround(img);
  return { img, anchor: [17, 44] };
}

/** A scratching post (16 x 36): carpet base, sisal post, a platform on top with a ball on a string. */
function arranhador() {
  const img = blank(18, 37);
  rect(img, 2, 31, 14, 4, P.blue1); hline(img, 2, 31, 14, P.blue3); hline(img, 2, 34, 14, P.blue0);
  rect(img, 7, 7, 4, 24, P.cream2);
  for (let y = 7; y < 31; y += 2) hline(img, 7, y, 4, P.cream3);
  vline(img, 7, 7, 24, P.cream1);
  rect(img, 3, 3, 12, 4, P.blue1); hline(img, 3, 3, 12, P.blue3); hline(img, 3, 6, 12, P.blue0);
  vline(img, 13, 7, 6, P.slate);
  shape(img, ell(13.5, 14.5, 1.6, 1.6), [13, 14, 2, 2], [P.red0, P.red1, P.red2, P.red3]);
  outlineAround(img);
  return { img, anchor: [9, 35] };
}

/** A bag of ração (8 x 10): the brand band and a paw. `c` = the bag colour ramp [lo, mid, hi]. */
function racaoBag(img, x, y, c) {
  rect(img, x, y + 1, 8, 9, c[1]);
  hline(img, x + 1, y, 6, c[1]); vline(img, x, y + 1, 9, c[2]); vline(img, x + 7, y + 1, 9, c[0]);
  hline(img, x + 1, y + 1, 6, c[0]); // the folded top
  rect(img, x + 1, y + 4, 6, 3, P.cream);
  paw(img, x + 1, y + 4, c[0]);
  // the paw is 5 wide; trim the 6th column back to cream
}

/** A pet-food shelf unit (16 x 30): two wooden shelves of ração bags. */
function prateleiraRacao() {
  const img = blank(18, 31);
  rect(img, 1, 1, 16, 28, P.wood2);
  rect(img, 2, 2, 14, 26, P.wood1);
  vline(img, 1, 1, 28, P.wood4); hline(img, 1, 1, 16, P.wood5);
  for (const sy of [14, 27]) { hline(img, 1, sy, 16, P.wood4); hline(img, 1, sy + 1, 16, P.wood0); }
  racaoBag(img, 2, 4, [P.red0, P.red1, P.red3]);
  racaoBag(img, 9, 5, [P.sp0, P.sp2, P.sp4]);
  racaoBag(img, 2, 17, [P.blue0, P.blue1, P.blue3]);
  racaoBag(img, 9, 17, [P.mu0, P.mu2, P.mu4]);
  outlineAround(img);
  return { img, anchor: [9, 30] };
}

/** A wicker toy bin (16 x 16) with a ball, a bone and a toy mouse poking out. */
function cestoBrinquedos() {
  const img = blank(18, 17);
  shape(img, ell(9, 6, 3, 3), [8, 5, 3, 3], [P.red0, P.red1, P.red2, P.red3]);
  put(img, 9, 5, P.white);
  bone(img, 2, 4, 7, P.cream, P.cream3);
  shape(img, ell(13.5, 6, 2.5, 1.6), [13, 5, 3, 2], [P.slate, P.grey0, P.grey1, P.grey2]);
  put(img, 15, 5, P.pink1);
  // the bin: woven wicker (alternating bands)
  for (let y = 8; y < 16; y++) for (let x = 2; x < 16; x++) put(img, x, y, (x + (y >> 1)) % 3 === 0 ? P.wood3 : (y % 2 ? P.wood4 : P.wood5));
  hline(img, 2, 8, 14, P.wood6); hline(img, 2, 15, 14, P.wood2);
  outlineAround(img);
  return { img, anchor: [9, 16] };
}

/** A round pet bed (16 x 12): a cushion ring and the inner pad. `style` picks the fabric. */
function caminha(style) {
  const img = blank(18, 13);
  const ramps = {
    xadrez: [P.red0, P.red1, P.red2, P.red3],
    azul: [P.blue0, P.blue1, P.blue2, P.blue3],
    cesta: [P.wood2, P.wood3, P.wood4, P.wood5],
  };
  const r = ramps[style];
  shape(img, ell(9, 6.5, 7.5, 5), [8, 5, 8, 5], r, {
    pattern: (x, y, i) => (style === 'xadrez' && (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? Math.max(0, i - 1) : style === 'cesta' && (x + y) % 3 === 0 ? Math.max(0, i - 1) : i),
  });
  const pad = style === 'cesta' ? [P.red1, P.red2, P.red2, P.red3] : [P.cream3, P.cream2, P.cream1, P.white];
  shape(img, ell(9, 7.5, 4.5, 2.6), [8, 7, 5, 3], pad, { ol: r[0] });
  return { img, anchor: [9, 12] };
}

/** The double bowl (16 x 8): a stand with two steel bowls, food in one and water in the other. */
function poteDuplo() {
  const img = blank(18, 9);
  rect(img, 1, 3, 16, 4, P.sp2); hline(img, 1, 3, 16, P.sp3); hline(img, 1, 6, 16, P.sp0);
  for (const [cx, fill] of [[5, P.wood2], [12, P.blue2]]) {
    shape(img, ell(cx + 0.5, 3.5, 3.5, 1.8), [cx, 3, 4, 2], [P.grey0, P.grey1, P.grey2, P.white], { ol: P.sp0 });
    flat(img, ell(cx + 0.5, 3.4, 2.2, 0.9), fill, { outline: false });
  }
  put(img, 4, 3, P.wood4); put(img, 6, 3, P.wood0); put(img, 11, 3, P.blue4);
  outlineAround(img);
  return { img, anchor: [9, 8] };
}

/** A bag of ração leaning on its bowl (16 x 16): the kitnet piece. */
function sacoRacao() {
  const img = blank(18, 17);
  rect(img, 3, 2, 10, 13, P.red1);
  hline(img, 4, 1, 8, P.red1); vline(img, 3, 2, 13, P.red3); vline(img, 12, 2, 13, P.red0); hline(img, 4, 2, 8, P.red0);
  rect(img, 4, 6, 8, 5, P.cream); paw(img, 5, 6, P.red1);
  shape(img, ell(13, 13.5, 3.5, 1.8), [13, 13, 4, 2], [P.grey0, P.grey1, P.grey2, P.white]);
  flat(img, ell(13, 13.3, 2.2, 0.9), P.wood2, { outline: false });
  put(img, 12, 13, P.wood4);
  outlineAround(img);
  return { img, anchor: [9, 16] };
}

/** The pet scale (16 x 14): a low platform with rubber mat and a round dial on a short post. */
function balancaPet() {
  const img = blank(18, 15);
  rect(img, 1, 8, 16, 5, P.grey1); hline(img, 1, 8, 16, P.grey2); hline(img, 1, 12, 16, P.grey0);
  rect(img, 2, 9, 14, 2, P.slate);
  rect(img, 13, 3, 2, 6, P.grey0);
  shape(img, ell(14, 3.5, 3, 3), [13, 3, 3, 3], [P.grey0, P.grey1, P.grey2, P.white]);
  flat(img, ell(14, 3.5, 1.8, 1.8), P.white, { outline: false });
  put(img, 14, 3, P.red1); put(img, 15, 2, P.red1);
  outlineAround(img);
  return { img, anchor: [9, 14] };
}

/** The grooming table (16 x 22): steel top with a rubber mat, folding legs, the arm with its loop. */
function mesaTosa() {
  const img = blank(18, 23);
  vline(img, 3, 13, 8, P.grey0); vline(img, 14, 13, 8, P.grey0);
  vline(img, 5, 13, 7, P.grey1); vline(img, 12, 13, 7, P.grey1);
  rect(img, 1, 10, 16, 3, P.grey2); hline(img, 1, 10, 16, P.white); hline(img, 1, 12, 16, P.grey0);
  rect(img, 2, 10, 14, 1, P.slate);
  // the grooming arm: a post up the back, a bar over, a loop hanging
  vline(img, 14, 1, 9, P.grey1); hline(img, 8, 1, 7, P.grey1);
  vline(img, 9, 2, 3, P.red1); put(img, 8, 5, P.red1); put(img, 10, 5, P.red1); put(img, 9, 6, P.red1);
  outlineAround(img);
  return { img, anchor: [9, 22] };
}

/** The raised grooming tub (16 x 20), two frames: the foam bubbles shift. */
function banheiraTosa(frame) {
  const img = blank(18, 21);
  // legs
  vline(img, 3, 14, 5, P.grey0); vline(img, 14, 14, 5, P.grey0);
  // the tub: white enamel, a steel rim, the inside showing water and foam
  rect(img, 1, 6, 16, 9, P.white); hline(img, 1, 14, 16, P.grey1); vline(img, 16, 6, 9, P.grey2);
  rect(img, 1, 5, 16, 2, P.grey2); hline(img, 1, 5, 16, P.white);
  rect(img, 3, 7, 12, 3, P.blue3); hline(img, 3, 7, 12, P.blue4);
  // the tap and the shower hose
  rect(img, 14, 1, 2, 4, P.grey1); put(img, 13, 1, P.grey1); vline(img, 16, 2, 6, P.slate);
  // foam on the water and bubbles above
  const bubbles = frame ? [[4, 6], [7, 5], [10, 6], [12, 4], [6, 3]] : [[5, 6], [8, 6], [11, 5], [4, 4], [9, 3]];
  for (const [bx, by] of bubbles) { put(img, bx, by, P.white); put(img, bx + 1, by, P.blue5); }
  for (let x = 3; x < 15; x++) if ((x + frame) % 3 !== 0) put(img, x, 7, P.white);
  outlineAround(img);
  return img;
}

/** The pet hair dryer on its stand (16 x 26): a wheeled foot, the pole, the drum and its hose. */
function secador() {
  const img = blank(18, 27);
  hline(img, 4, 24, 10, P.grey0); put(img, 4, 25, NAVY); put(img, 13, 25, NAVY); put(img, 9, 25, NAVY);
  vline(img, 8, 9, 15, P.grey1); vline(img, 9, 9, 15, P.grey0);
  shape(img, ell(9, 5.5, 5, 4), [8, 4, 5, 4], [P.blue0, P.blue1, P.blue2, P.blue3]);
  flat(img, ell(9.5, 6, 2, 1.8), P.slate, { outline: false });
  put(img, 9, 5, P.grey1);
  // the hose curling down to the nozzle
  for (const [x, y] of [[14, 6], [15, 7], [15, 8], [15, 9], [14, 10], [14, 11], [15, 12], [15, 13]]) put(img, x, y, P.grey1);
  rect(img, 14, 14, 2, 2, P.grey0);
  outlineAround(img);
  return { img, anchor: [9, 26] };
}

/** Pet towels (16 x 14): a stack of three folded towels on a little stool. */
function toalhaPet() {
  const img = blank(18, 15);
  vline(img, 3, 10, 4, P.wood2); vline(img, 14, 10, 4, P.wood2);
  rect(img, 2, 9, 14, 2, P.wood4); hline(img, 2, 10, 14, P.wood2);
  [[P.blue1, P.blue3], [P.mu2, P.mu4], [P.pink1, P.pink2]].forEach(([c, hi], i) => {
    const y = 7 - i * 2;
    rect(img, 3, y, 12, 2, c); hline(img, 3, y, 12, hi);
    put(img, 3, y + 1, mix(c, NAVY, 0.25));
  });
  outlineAround(img);
  return { img, anchor: [9, 14] };
}

/** The fish tank on the counter (16 x 14), two frames: the fish swims and the bubbles rise. */
function aquario(frame) {
  const img = blank(18, 15);
  rect(img, 1, 1, 16, 12, P.blue3);
  for (let y = 2; y < 12; y++) for (let x = 2; x < 16; x++) put(img, x, y, y < 4 ? P.blue4 : P.blue3);
  hline(img, 2, 2, 14, P.blue5);
  // sand, a plant, a rock
  rect(img, 2, 10, 14, 2, P.wood6); hline(img, 2, 11, 14, P.wood5);
  for (const [x, y] of [[4, 9], [4, 8], [5, 7], [4, 6], [5, 5]]) put(img, x, y, P.green2);
  put(img, 13, 9, P.grey1); put(img, 12, 9, P.grey0);
  // the fish (orange)
  const fx = frame ? 10 : 8;
  put(img, fx, 6, P.gin1); put(img, fx + 1, 6, P.gin1); put(img, fx + 2, 6, P.gin2); put(img, fx - 1, 5, P.gin0); put(img, fx - 1, 7, P.gin0);
  put(img, fx + 2, 5, NAVY);
  // bubbles
  for (const [bx, by] of frame ? [[6, 3], [7, 6]] : [[6, 5], [7, 8]]) put(img, bx, by, P.blue5);
  // frame: black top lid and base
  rect(img, 1, 0, 16, 2, P.slate); hline(img, 1, 0, 16, P.grey0);
  rect(img, 1, 12, 16, 2, P.slate); hline(img, 1, 12, 16, P.grey0);
  vline(img, 1, 2, 10, P.grey2); vline(img, 16, 2, 10, P.blue1);
  // one row of room above the lid for the navy outline
  const out = blank(18, 16);
  paste(out, img, 0, 1);
  outlineAround(out);
  return out;
}

// ------------------------------------------------------------------ the north wall
/** A board in the wall-decor style: navy outline, `bg` face with lit top / left and a shaded bottom / right. */
function board(w, h, bg, lit, shade) {
  const img = blank(w, h);
  rect(img, 0, 0, w, h, NAVY);
  rect(img, 1, 1, w - 2, h - 2, bg);
  hline(img, 1, 1, w - 2, lit); vline(img, 1, 1, h - 2, lit);
  hline(img, 1, h - 2, w - 2, shade); vline(img, w - 2, 1, h - 2, shade);
  return img;
}

/** The breed chart (60 x 26): six little silhouettes (big dog, small dog, salsicha, cat, fluffy cat, slim cat) over the word RAÇAS. */
function quadroRacas() {
  const W = 62, H = 26;
  const img = board(W, H, P.cream, P.white, P.cream3);
  // title strip
  rect(img, 2, 2, W - 4, 8, P.sp1);
  text(img, Math.floor((W - textW('RAÇAS')) / 2), 3, 'RAÇAS', P.cream);
  const SIL = [
    { ink: P.wood1, rows: ['.......##', '#.....###', '#######..', '.######..', '.#....#..', '.#....#..'] },
    { ink: P.wood2, rows: ['....#.#', '#...###', '.####..', '.####..', '.#..#..'] },
    { ink: P.wood0, rows: ['.......##', '#......##', '########.', '.#....#..'] },
    { ink: P.gin0, rows: ['.....#.#', '#....###', '#.#####.', '.#####..', '.#...#..'] },
    { ink: P.slate, rows: ['......#.#', '##....###', '##.#####.', '.######..', '.##..##..'] },
    { ink: P.car0, rows: ['.....#.#', '#....###', '.#.####.', '..###...', '..#.#...', '..#.#...'] },
  ];
  // bottom-aligned on a little floor line, 1 px apart
  let x = 4;
  const base = 20;
  for (const s of SIL) {
    s.rows.forEach((r, ry) => [...r].forEach((ch, rx) => ch === '#' && dot(img, x + rx, base - s.rows.length + ry, s.ink)));
    x += s.rows[0].length + 1;
  }
  hline(img, 3, base, W - 6, P.cream3);
  return { img, anchor: [0, H] };
}

/** The adoption poster (40 x 40): a heart with a paw, ADOÇÃO, then ADOTE / UM AMIGO. */
function posterAdocao() {
  const W = 40, H = 40;
  const img = board(W, H, P.mu3, P.mu4, P.mu1);
  // the heart
  const heart = (x, y) => ((x - 16) ** 2 / 16 + (y - 7) ** 2 / 12 <= 1) || ((x - 23) ** 2 / 16 + (y - 7) ** 2 / 12 <= 1) || (y >= 7 && y <= 15 && Math.abs(x - 19.5) <= 7.5 - (y - 7) * 0.95);
  for (let y = 2; y < 17; y++) for (let x = 9; x < 31; x++) if (heart(x + 0.5, y + 0.5)) put(img, x, y, P.red2);
  put(img, 15, 5, P.red4); put(img, 14, 6, P.red4);
  paw(img, 17, 7, P.cream);
  const line = (s, y, c) => text(img, Math.floor((W - textW(s)) / 2), y, s, c);
  line('ADOÇÃO', 20, P.sp0);
  line('ADOTE', 28, P.wood0);
  line('UM AMIGO', 34, P.wood0);
  return { img, anchor: [0, H] };
}

/** A plaque (w x 24) with two lines of type: BANHO / E TOSA, VETERINÁRIO / TER E QUI. */
function placaDupla(w, l1, l2) {
  const H = 24;
  const img = board(w, H, P.sp1, P.sp3, P.sp0);
  hline(img, 3, 3, w - 6, P.mu3); hline(img, 3, H - 4, w - 6, P.mu3);
  const cx = (s) => Math.floor((w - textW(s)) / 2);
  text(img, cx(l1), 7, l1, P.cream);
  text(img, cx(l2), 14, l2, P.mu4);
  for (const [x, y] of [[1, 1], [w - 2, 1], [1, H - 2], [w - 2, H - 2]]) put(img, x, y, P.grey1);
  return { img, anchor: [0, H] };
}

// ------------------------------------------------------------------ fx
/** Two small hearts rising (16 x 16), three frames: the carinho in the pens, the meet view and the kitnet. */
function carinhoFrames() {
  const heart = (img, x, y, c, hi) => {
    for (const [dx, dy] of [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]]) put(img, x + dx, y + dy, c);
    put(img, x + 1, y + 1, hi);
  };
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const img = blank(16, 16);
    heart(img, 2, 9 - f * 3, P.red2, P.red4);
    heart(img, 9, 11 - f * 3 + (f === 0 ? 0 : 1), P.pink1, P.pink2);
    outlineAround(img);
    frames.push(img);
  }
  return frames;
}

/** The toys a resting pet holds on its lie pose (fx/ossinho 8 x 5, fx/pelucia 8 x 8). */
function ossinhoFx() {
  const img = blank(9, 6);
  bone(img, 1, 1, 7, P.cream, P.cream3);
  outlineAround(img);
  return { img, anchor: [4, 5] };
}
function peluciaFx() {
  const img = blank(9, 10);
  shape(img, or(ell(4.5, 6.5, 3, 2.5), ell(4.5, 4, 2.2, 2), ell(2.5, 2.5, 1, 1), ell(6.5, 2.5, 1, 1)), [4, 5, 3, 3], [P.wood2, P.wood3, P.wood4, P.wood5]);
  put(img, 3, 4, NAVY); put(img, 5, 4, NAVY); put(img, 4, 5, P.wood0);
  return { img, anchor: [4, 9] };
}
/** The ball a dog fetches (`busca`): it lands ahead of the owner and comes back in the dog's mouth (fx/bolinha 7 x 7). */
function bolinhaFx() {
  const img = blank(7, 7);
  shape(img, ell(3.5, 3.5, 2.6, 2.6), [3, 3, 2, 2], [P.red0, P.red1, P.red2, P.red3]);
  put(img, 2, 4, P.white); put(img, 3, 4, P.white); put(img, 4, 3, P.white);
  put(img, 2, 2, P.red4);
  outlineAround(img);
  return { img, anchor: [3, 6] };
}
/** The cloth mouse a cat bats about (`brinca`) (fx/ratinho 10 x 6). */
function ratinhoFx() {
  const img = blank(10, 6);
  shape(img, ell(4.5, 3.5, 3, 1.8), [4, 3, 3, 2], [P.slate, P.grey0, P.grey1, P.grey2]);
  put(img, 2, 1, P.pink1); put(img, 2, 3, NAVY);
  for (const [x, y] of [[8, 3], [9, 2]]) put(img, x, y, P.pink0);
  outlineAround(img);
  return { img, anchor: [4, 5] };
}

// ------------------------------------------------------------------ lojinha icons (16 x 16, `icons/<itemId>`, registered in icons.mjs)
/** A collar seen from the front: a band ring with a buckle and a tag. `ramp` = [lo, mid, hi]. */
function collarIcon(ramp, bandana = false) {
  const img = blank(16, 16);
  if (bandana) {
    // a green triangle scarf with a yellow diamond, folded over a band
    const tri = (x, y) => y >= 5 && y <= 14 && Math.abs(x - 8) <= (14 - y) * 0.75 + 0.5;
    shape(img, tri, [8, 8, 6, 5], [P.green0, P.green1, P.green2, P.green3]);
    for (const [x, y] of [[8, 7], [7, 8], [8, 8], [9, 8], [8, 9]]) put(img, x, y, P.mu4);
    put(img, 8, 8, P.blue1);
    rect(img, 1, 3, 14, 3, ramp[1]); hline(img, 1, 3, 14, ramp[2]); hline(img, 1, 5, 14, ramp[0]);
    outlineAround(img);
    return img;
  }
  const ringP = and(ell(8, 7.5, 6.6, 5.2), not(ell(8, 7, 4.6, 3.2)));
  shape(img, ringP, [8, 7, 7, 5], [ramp[0], ramp[0], ramp[1], ramp[2]]);
  // the buckle (steel) on the left, the tag (gold) hanging at the bottom
  rect(img, 1, 6, 3, 3, P.grey1); put(img, 2, 7, P.grey0);
  shape(img, ell(8, 13.5, 2, 2), [8, 13, 2, 2], [P.mu0, P.mu2, P.mu3, P.mu5]);
  put(img, 8, 11, P.grey1);
  return img;
}
function bolinhaIcon() {
  const img = blank(16, 16);
  shape(img, ell(8, 8.5, 6, 6), [7, 7, 6, 6], [P.red0, P.red1, P.red2, P.red3]);
  for (let x = 3; x < 14; x++) put(img, x, 9 + Math.round(Math.sin((x - 3) / 3) * 1), P.white);
  put(img, 5, 5, P.red4);
  return img;
}
function ratinhoIcon() {
  const img = blank(16, 16);
  shape(img, ell(7.5, 10, 5.5, 3.5), [7, 9, 6, 4], [P.slate, P.grey0, P.grey1, P.grey2]);
  shape(img, ell(4, 6.5, 2, 2), [4, 6, 2, 2], [P.pink0, P.pink1, P.pink2, P.pink2], { ol: P.grey0 });
  put(img, 3, 10, NAVY); put(img, 2, 11, P.pink1);
  for (const [x, y] of [[13, 10], [14, 9], [14, 8], [13, 7], [12, 6]]) put(img, x, y, P.pink0);
  // stitches
  put(img, 8, 9, P.grey0); put(img, 9, 10, P.grey0); put(img, 10, 9, P.grey0);
  return img;
}
function ossinhoIcon() {
  const img = blank(16, 16);
  const boneP = or(box(4, 6, 12, 10), ell(3.5, 5.5, 2.5, 2.5), ell(3.5, 10.5, 2.5, 2.5), ell(12.5, 5.5, 2.5, 2.5), ell(12.5, 10.5, 2.5, 2.5));
  shape(img, boneP, [8, 8, 7, 5], [P.cream3, P.cream2, P.cream1, P.white]);
  return img;
}
function peluciaIcon() {
  const img = blank(16, 16);
  const bear = or(ell(8, 10.5, 5, 4), ell(8, 6, 4, 3.5), ell(4.5, 3, 1.6, 1.6), ell(11.5, 3, 1.6, 1.6));
  shape(img, bear, [8, 8, 6, 6], [P.wood1, P.wood2, P.wood3, P.wood5]);
  put(img, 6, 6, NAVY); put(img, 10, 6, NAVY);
  flat(img, ell(8, 8, 1.6, 1.1), P.wood6, { outline: false });
  put(img, 8, 7, NAVY);
  flat(img, ell(8, 11.5, 2.5, 2), P.wood5, { outline: false });
  put(img, 4, 3, P.pink1); put(img, 12, 3, P.pink1);
  return img;
}
function caminhaIcon(style) {
  const img = blank(16, 16);
  paste(img, caminha(style).img, -1, 2);
  return img;
}
function sacoRacaoIcon() {
  const img = blank(16, 16);
  paste(img, sacoRacao().img, -1, -1);
  return img;
}
export const PET_ICONS = {
  coleira_vermelha: () => collarIcon([P.red0, P.red2, P.red3]),
  coleira_azul: () => collarIcon([P.blue0, P.blue1, P.blue3]),
  coleira_verde: () => collarIcon([P.green0, P.green2, P.green3]),
  coleira_rosa: () => collarIcon([P.pink0, P.pink1, P.pink2]),
  bandana_brasil: () => collarIcon([P.green0, P.green1, P.green2], true),
  bolinha: bolinhaIcon,
  ratinho: ratinhoIcon,
  ossinho: ossinhoIcon,
  pelucia: peluciaIcon,
  caminha_xadrez: () => caminhaIcon('xadrez'),
  caminha_azul: () => caminhaIcon('azul'),
  caminha_cesta: () => caminhaIcon('cesta'),
  saco_racao: sacoRacaoIcon,
};

// ------------------------------------------------------------------ the set
const solid = (fp, shadow = 'fx/shadow_16', cast = true) => ({ footprint: fp, shadow, ...(cast ? { cast: { kx: 0.4, ky: 0.22 } } : {}) });
const flatMeta = (fp = [1, 1]) => ({ footprint: fp, shadow: null });

export async function petshopSet(ctx) {
  const parts = [];
  const add = (key, made, meta) => parts.push({ key, ...made, meta });
  parts.push(...(await facade(ctx)));
  // the sidewalk
  add('props/placa_petshop', placaPetshop(), solid([1, 1], 'fx/shadow_10'));
  add('props/tigela_calcada', tigelaCalcada(), flatMeta());
  // the interior
  add('props/cercadinho', cercadinho(), solid([3, 2], null, false));
  add('props/gatil', gatil(), solid([2, 2], null, false));
  add('props/arranhador', arranhador(), solid([1, 1], 'fx/shadow_10'));
  add('props/prateleira_racao', prateleiraRacao(), solid([1, 1]));
  add('props/cesto_brinquedos', cestoBrinquedos(), solid([1, 1], 'fx/shadow_10'));
  for (const s of ['xadrez', 'azul', 'cesta']) {
    add(`props/caminha_${s}`, caminha(s), flatMeta());
    // the same beds as kitnet furniture (round: both rotations are the same art)
    for (const rot of [0, 1]) add(`furniture/caminha_${s}_${rot}`, caminha(s), flatMeta());
  }
  for (const rot of [0, 1]) {
    const bag = sacoRacao();
    add(`furniture/saco_racao_${rot}`, rot ? { img: flipH(bag.img), anchor: [bag.img.w - 1 - bag.anchor[0], bag.anchor[1]] } : bag, solid([1, 1], 'fx/shadow_10'));
  }
  add('props/pote_duplo', poteDuplo(), flatMeta());
  add('props/saco_racao', sacoRacao(), solid([1, 1], 'fx/shadow_10'));
  add('props/balanca_pet', balancaPet(), solid([1, 1], 'fx/shadow_16', false));
  add('props/mesa_tosa', mesaTosa(), solid([1, 1]));
  parts.push({ key: 'props/banheira_tosa', frames: [banheiraTosa(0), banheiraTosa(1)], fps: 2, anchor: [9, 20], meta: solid([1, 1]) });
  add('props/secador', secador(), solid([1, 1], 'fx/shadow_10'));
  add('props/toalha_pet', toalhaPet(), solid([1, 1], 'fx/shadow_10', false));
  parts.push({ key: 'props/aquario', frames: [aquario(0), aquario(1)], fps: 2, anchor: [9, 15], meta: flatMeta() });
  // the north wall
  add('walls/quadro_racas', quadroRacas(), { shadow: null });
  add('walls/poster_adocao', posterAdocao(), { shadow: null });
  add('walls/placa_banho_tosa', placaDupla(32, 'BANHO', 'E TOSA'), { shadow: null });
  add('walls/placa_vet', placaDupla(48, 'VETERINÁRIO', 'TER E QUI'), { shadow: null });
  // fx
  parts.push({ key: 'fx/carinho', frames: carinhoFrames(), fps: 6, anchor: [8, 15], meta: { shadow: null } });
  add('fx/ossinho', ossinhoFx(), { shadow: null });
  add('fx/pelucia', peluciaFx(), { shadow: null });
  add('fx/bolinha', bolinhaFx(), { shadow: null });
  add('fx/ratinho', ratinhoFx(), { shadow: null });
  return parts;
}
