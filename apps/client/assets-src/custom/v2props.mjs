// Praça props of the V2 composition pass: domino and chess tables, stools, the bust on its plinth, flower beds of different shapes, the
// popcorn cart (pipoqueiro) and the coconut-water cart (derived from LimeZu street carts), hanging bunting, a magazine rack, the parked
// Fusca / Kombi / moto (static frames of the traffic art). Authored with the pack palette, light from the upper left, navy outline.
import { blank, put, shape, flat, grid, line, ell, box, or, and, sub, fillRect, NAVY, h2 } from './paint.mjs';
import { C, K, outlineAround, stripSoftAlpha, paste, crop, rect, hline, vline, dot } from './kit.mjs';
import { drawText3, width3 } from './font5.mjs';
import * as vauth from './vehicles-auth.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

const EXT = 'ext:ME_Theme_Sorter_16x16/';
const VEH = EXT + '10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_';

// ------------------------------------------------------------------ tables and stools
/** A square wooden table with a game on it (1 tile, 20x24): `game` = 'domino' (green felt, white tiles) or 'xadrez' (a checker board). */
function mesaJogo(game) {
  const img = blank(20, 24);
  // legs
  for (const x of [3, 15]) { fillRect(img, x, 17, 2, 6, C.w5); put(img, x, 17, C.w3); fillRect(img, x, 17, 1, 6, C.w3); }
  // apron (front face)
  fillRect(img, 1, 15, 18, 3, C.w3);
  hline(img, 1, 15, 18, C.w2); hline(img, 1, 17, 18, C.w5);
  // top face
  fillRect(img, 1, 5, 18, 10, C.w2);
  hline(img, 1, 5, 18, C.w0); vline(img, 1, 5, 10, C.w1); hline(img, 1, 14, 18, C.w4); vline(img, 18, 5, 10, C.w4);
  if (game === 'domino') {
    fillRect(img, 3, 7, 14, 6, C.teal2);
    hline(img, 3, 7, 14, C.teal3); vline(img, 3, 7, 6, C.teal3); hline(img, 3, 12, 14, C.teal1);
    // three dominoes (white tiles with a pip row), one standing on edge
    for (const [x, y] of [[5, 8], [10, 10], [13, 8]]) {
      fillRect(img, x, y, 4, 2, C.cr0); hline(img, x, y + 1, 4, C.cr2);
      dot(img, x, y, C.white); dot(img, x + 1, y, C.navy); dot(img, x + 3, y, C.navy); dot(img, x + 2, y + 1, C.navy);
    }
    // a small pile of face-down tiles
    fillRect(img, 4, 11, 3, 1, C.cr3); fillRect(img, 4, 10, 3, 1, C.cr1);
  } else {
    // 6x4 board of 2x2 cells, cream and brown, with two pieces
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const dark = (r + c) % 2 === 1;
      fillRect(img, 4 + c * 2, 6 + r * 2, 2, 2, dark ? C.w5 : C.cr1);
    }
    hline(img, 3, 5, 14, C.w4);
    dot(img, 7, 7, C.navy); dot(img, 7, 8, C.slate2); dot(img, 12, 9, C.r3); dot(img, 12, 10, C.r5);
    dot(img, 9, 7, C.lav3); dot(img, 14, 11, C.navy);
  }
  outlineAround(img);
  return img;
}

/** A round wooden stool (10x12). */
function banquinho() {
  const img = blank(10, 12);
  for (const x of [2, 7]) fillRect(img, x, 8, 1, 3, C.w5);
  fillRect(img, 1, 5, 8, 3, C.w3);
  shape(img, ell(5, 4, 4.5, 2.6), [5, 4, 4.5, 2.6], [C.w4, C.w2, C.w1, C.w0], { ol: NAVY, t: [0.8, 0.3, -0.3] });
  hline(img, 2, 6, 6, C.w5);
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ the bust on its plinth
function busto() {
  const W = 24, H = 46;
  const img = blank(W, H);
  const stone = [C.slate2, C.mist, C.lav, C.lav3];
  // plinth: a base step, a shaft, a cap (front faces only, light from the upper left)
  fillRect(img, 2, 38, 20, 7, C.mist); hline(img, 2, 38, 20, C.lav3); vline(img, 2, 38, 7, C.lav2); hline(img, 2, 44, 20, C.slate2); vline(img, 21, 39, 6, C.slate2);
  fillRect(img, 5, 21, 14, 17, C.lav); vline(img, 5, 21, 17, C.lav3); vline(img, 6, 21, 17, C.lav2); vline(img, 18, 21, 17, C.mist); vline(img, 17, 21, 17, C.mist2);
  fillRect(img, 3, 18, 18, 4, C.lav2); hline(img, 3, 18, 18, C.lav4); hline(img, 3, 21, 18, C.slate2); vline(img, 20, 19, 3, C.mist);
  // the plaque on the shaft (a mustard plate with two lines of "text")
  fillRect(img, 8, 27, 8, 6, NAVY); fillRect(img, 9, 28, 6, 4, C.y2); hline(img, 9, 28, 6, C.y1); hline(img, 9, 31, 6, C.y4);
  hline(img, 10, 29, 4, K.br2); hline(img, 10, 30, 3, K.br2);
  // the bust, verdigris bronze: shoulders, neck, head, hair
  const bronze = ['#2e5c55', '#3f7a6c', '#5fa08c', '#9fd6bd'];
  shape(img, (x, y) => y >= 12.5 && y < 19 && Math.abs(x - 12) <= 6.5 - Math.max(0, 14 - y) * 0.9, [12, 16, 7, 5], bronze, { ol: NAVY, t: [0.82, 0.4, 0.0] });
  shape(img, box(10, 10, 14, 14), [12, 12, 2, 3], bronze, { ol: NAVY, flat: true });
  shape(img, ell(12, 7, 4.2, 5), [12, 7, 4.2, 5], bronze, { ol: NAVY, t: [0.8, 0.38, -0.05] });
  // face: brow line, nose, a moustache, hair cap
  put(img, 10, 7, bronze[0]); put(img, 14, 7, bronze[0]); put(img, 12, 8, bronze[1]);
  hline(img, 10, 9, 5, bronze[0]);
  hline(img, 9, 3, 7, bronze[0]); hline(img, 10, 2, 5, bronze[1]); put(img, 10, 3, bronze[2]);
  put(img, 8, 5, bronze[1]); put(img, 16, 5, bronze[0]);
  outlineAround(img);
  void stone;
  return img;
}

// ------------------------------------------------------------------ flower beds
const BLOOMS = [
  [C.r0, C.r2], [C.y1, C.y3], [C.p0, C.p2], [C.white, C.lav3], [C.y3, C.y4], ['#d8c8f0', '#968bab'], [C.r1, C.r3],
];
function bloomDot(img, x, y, kind) {
  const [hi, mid] = BLOOMS[kind % BLOOMS.length];
  put(img, x, y, hi); put(img, x + 1, y, mid); put(img, x, y + 1, mid); put(img, x + 1, y + 1, K.br3 === mid ? hi : mid);
  put(img, x, y, hi);
}
function leaves(img, pred, x0, y0, x1, y1, seed) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!pred(x + 0.5, y + 0.5)) continue;
    const r = h2(x, y, seed);
    put(img, x, y, r < 0.34 ? C.g3 : r < 0.74 ? C.sp1 ?? C.g3 : C.g2);
  }
}

/** Round bed (2x2): a low stone ring, dark soil, mixed blooms and a clipped shrub in the middle. */
function canteiroRedondo() {
  const W = 34, H = 32;
  const img = blank(W, H);
  const cx = 17, cy = 17, rx = 15.5, ry = 10;
  // stone wall: the ellipse, thickened toward the viewer
  shape(img, or(ell(cx, cy + 3, rx, ry), ell(cx, cy, rx, ry)), [cx, cy, rx, ry], [C.slate2, C.mist, C.lav, C.lav3], { ol: NAVY, t: [0.9, 0.5, 0.0] });
  // soil + leaves inside
  const inside = ell(cx, cy - 0.5, rx - 3, ry - 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x + 0.5, y + 0.5)) put(img, x, y, (x + y) % 5 === 0 ? K.br2 : K.br3);
  leaves(img, inside, 0, 0, W, H, 3);
  // blooms, kept off the centre
  for (let i = 0; i < 26; i++) {
    const a = h2(i, 5, 7) * Math.PI * 2, r = 0.25 + h2(i, 9, 3) * 0.7;
    const x = Math.round(cx + Math.cos(a) * (rx - 5) * r), y = Math.round(cy - 0.5 + Math.sin(a) * (ry - 4) * r);
    if (inside(x + 1, y + 1)) bloomDot(img, x, y, Math.floor(h2(i, 2, 11) * 7));
  }
  // clipped shrub
  shape(img, ell(cx, cy - 3, 5, 5.2), [cx, cy - 3, 5, 5.2], [C.sp0, C.sp1, C.g3, C.g2], { ol: NAVY, t: [0.8, 0.3, -0.2] });
  put(img, cx - 2, cy - 6, C.g1); put(img, cx - 1, cy - 7, C.g1); put(img, cx - 3, cy - 5, C.g1);
  outlineAround(img);
  return img;
}

/** Diamond bed (3x2): four coloured quarters like a parterre, a light path cross and a small round shrub in the middle. */
function canteiroLosango() {
  const W = 50, H = 32;
  const img = blank(W, H);
  const cx = 25, cy = 16, rx = 23.5, ry = 11.5;
  const dia = (x, y) => Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
  const diaIn = (x, y) => Math.abs(x - cx) / (rx - 4) + Math.abs(y - cy) / (ry - 3) <= 1;
  // wall (thick toward the viewer)
  shape(img, or(dia, (x, y) => dia(x, y - 3)), [cx, cy, rx, ry], [C.slate2, C.mist, C.lav, C.lav3], { ol: NAVY, t: [0.95, 0.6, 0.1] });
  const quarters = [
    // [pred, bloom kinds]
    [(x, y) => x < cx && y < cy, [0, 2]],
    [(x, y) => x >= cx && y < cy, [1, 4]],
    [(x, y) => x < cx && y >= cy, [3, 5]],
    [(x, y) => x >= cx && y >= cy, [6, 0]],
  ];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!diaIn(x + 0.5, y + 0.5)) continue;
    put(img, x, y, (x * 3 + y) % 7 === 0 ? K.br2 : K.br3);
  }
  for (const [pred, kinds] of quarters) {
    for (let i = 0; i < 40; i++) {
      const x = 4 + Math.floor(h2(i, kinds[0], 31) * (W - 8)), y = 4 + Math.floor(h2(i, kinds[1], 37) * (H - 10));
      if (!pred(x, y) || !diaIn(x + 1, y + 1) || Math.abs(x - cx) < 3 || Math.abs(y - cy) < 2) continue;
      bloomDot(img, x, y, kinds[i % 2]);
    }
  }
  // light gravel cross
  for (let x = 0; x < W; x++) if (diaIn(x + 0.5, cy + 0.5)) { put(img, x, cy, K.wg1); if (x % 3 === 0) put(img, x, cy + 1, K.wg3); }
  for (let y = 0; y < H; y++) if (diaIn(cx + 0.5, y + 0.5)) put(img, cx, y, K.wg1);
  shape(img, ell(cx, cy - 2, 4.5, 4.8), [cx, cy - 2, 4.5, 4.8], [C.sp0, C.sp1, C.g3, C.g2], { ol: NAVY, t: [0.8, 0.3, -0.2] });
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ the carts
const SIGN_BOARD = (img, x, y, text, bg = C.y2, fg = C.r4) => {
  const w = width3(text) + 4;
  fillRect(img, x, y, w, 9, NAVY);
  fillRect(img, x + 1, y + 1, w - 2, 7, bg);
  hline(img, x + 1, y + 1, w - 2, C.y1); hline(img, x + 1, y + 7, w - 2, C.y4);
  drawText3(img, x + 2, y + 2, text, fg);
  return w;
};

/** Pipoqueiro: the red-and-white striped street cart with a glass popcorn machine, paper cones and a PIPOCA board. */
async function pipoqueiro(ctx) {
  const cart = stripSoftAlpha(await ctx.load(VEH + 'Street_Food_Cart_3.png'));
  const img = blank(48, 48);
  paste(img, cart, 0, 0);
  // the machine on the counter (counter top surface is y 29..38, x 7..40): frame, glass, popcorn heap, little bulbs
  const mx = 11, my = 22, mw = 17, mh = 16;
  fillRect(img, mx, my, mw, mh, NAVY);
  fillRect(img, mx + 1, my + 1, mw - 2, mh - 2, C.r3);
  fillRect(img, mx + 1, my + 1, mw - 2, 1, C.r1); fillRect(img, mx + 1, my + 1, 1, mh - 2, C.r1);
  fillRect(img, mx + 1, my + mh - 3, mw - 2, 2, C.r5);
  fillRect(img, mx + 3, my + 3, mw - 6, mh - 8, NAVY);
  fillRect(img, mx + 4, my + 4, mw - 8, mh - 10, C.gl1 ?? '#e2f2f3');
  // popcorn: yellow-white puffs filling the lower two thirds of the glass
  for (let y = my + 6; y < my + mh - 5; y++) for (let x = mx + 4; x < mx + mw - 4; x++) {
    const r = h2(x, y, 5);
    put(img, x, y, r < 0.25 ? C.y3 : r < 0.6 ? C.y1 : r < 0.85 ? C.cr0 : C.y0);
  }
  for (let x = mx + 4; x < mx + mw - 4; x += 2) { put(img, x, my + 5, h2(x, 1, 2) < 0.5 ? C.y1 : C.cr0); }
  put(img, mx + 4, my + 4, C.white); put(img, mx + 5, my + 4, C.white);
  // bulbs on the frame
  for (let x = mx + 2; x < mx + mw - 1; x += 3) put(img, x, my + 2, C.y0);
  // a kettle crank on the side
  fillRect(img, mx + mw, my + 6, 3, 2, NAVY); put(img, mx + mw + 1, my + 6, C.slate2); put(img, mx + mw + 2, my + 7, K.br2);
  // paper cones on the counter (red / white stripes) with a popcorn top
  for (const [x, y] of [[31, 28], [35, 29]]) {
    for (let i = 0; i < 7; i++) {
      const hw = Math.floor(i / 2) + 1;
      for (let j = -hw; j <= hw - (i > 5 ? 1 : 0); j++) put(img, x + 3 + j, y + 6 - i + 1, (j + 8) % 2 === 0 ? C.r2 : C.cr0);
    }
    for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [4, 0], [2, -1], [3, -1]]) put(img, x + dx, y + dy, (dx + dy) % 2 ? C.y1 : C.cr0);
  }
  // the sign on the counter front (the brown panel)
  SIGN_BOARD(img, 9, 39, 'PIPOCA', C.y2, C.r4);
  // a hanging string of bulbs under the canopy
  for (let x = 6; x < 42; x += 5) put(img, x, 20, C.y0);
  const out = blank(48, 48);
  paste(out, img, 0, 0);
  return [{ img: out, anchor: [24, 44] }];
}

/** Carrinho de água de coco: the umbrella cart repainted green and white, a pile of green coconuts, an ice box with cut ones and a COCO board. */
async function cocoCart(ctx) {
  const cart = stripSoftAlpha(await ctx.load(VEH + 'Fruit_Flowers_Cart_1.png'));
  const img = blank(56, 64);
  paste(img, cart, 0, 0);
  // repaint the umbrella (rows 9..37): green and cream gores that keep the pack's shading
  const cx = 16.5, cy = 21;
  const GREEN = ['#2e7177', '#367f82', '#49928f', '#5ea592'];
  const CREAM = ['#c6bdd5', '#d8d0e0', '#ebe4f2', '#f8f8f8'];
  for (let y = 9; y < 38; y++) for (let x = 0; x < 36; x++) {
    const i = (y * 56 + x) * 4;
    if (!img.data[i + 3]) continue;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 55) continue; // navy outline, grey pole, white hub
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    const idx = l > 200 ? 3 : l > 150 ? 2 : l > 105 ? 1 : 0;
    const ang = Math.atan2(y - cy, x - cx);
    const gore = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 10) % 2;
    const hex = (gore ? CREAM : GREEN)[idx];
    img.data[i] = parseInt(hex.slice(1, 3), 16); img.data[i + 1] = parseInt(hex.slice(3, 5), 16); img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
  }
  // coconuts: green ellipsoids, a pyramid in the left compartment, three cut ones in the ice box on the right
  const coco = (x, y) => {
    shape(img, ell(x + 3, y + 3, 3.4, 3.4), [x + 3, y + 3, 3.4, 3.4], ['#3f7a42', '#5da23d', '#7fb84a', '#b8d97a'], { ol: NAVY, t: [0.8, 0.3, -0.1] });
    put(img, x + 3, y, '#cbd58a'); put(img, x + 2, y, '#e3e8b0');
  };
  for (const [x, y] of [[8, 44], [14, 44], [11, 40], [8, 49], [14, 49], [11, 45]]) coco(x, y);
  for (const [x, y] of [[24, 44], [31, 44], [27, 41]]) {
    coco(x, y);
    line(img, x + 3, y, x + 5, y - 5, C.r3); put(img, x + 5, y - 5, C.r1); // a straw
  }
  // ice
  for (let x = 23; x < 38; x += 2) put(img, x, 49, C.lav4);
  // the chalkboard sign on a stick on the right (the handle side)
  const s = blank(24, 18);
  fillRect(s, 11, 9, 2, 9, K.br2);
  const w = width3('COCO') + 4;
  fillRect(s, 1, 0, w, 10, NAVY); fillRect(s, 2, 1, w - 2, 8, C.navy2);
  fillRect(s, 2, 1, w - 2, 1, C.slate);
  drawText3(s, 3, 2, 'COCO', C.white);
  hline(s, 3, 8, w - 4, C.b1);
  paste(img, s, 34, 40);
  return [{ img, anchor: [24, 62] }];
}

// ------------------------------------------------------------------ bunting and the magazine rack
/** A string of festa-junina flags hung between two points (overhead): `w` px wide, a gentle sag. */
function bandeirinhas(w) {
  const h = 14;
  const img = blank(w, h);
  const FLAGS = [C.r3, C.y2, C.b2, C.g2, C.p2, C.y4];
  const sag = (x) => Math.round(2 + 3 * Math.sin((x / (w - 1)) * Math.PI));
  for (let x = 0; x < w; x++) put(img, x, sag(x), K.br2);
  for (let x = 3, n = 0; x < w - 3; x += 5, n++) {
    const y = sag(x) + 1;
    const c = FLAGS[n % FLAGS.length];
    for (let k = 0; k < 4; k++) for (let j = -2 + Math.floor(k / 2); j <= 2 - Math.floor(k / 2); j++) put(img, x + j, y + k, k === 0 && j < 0 ? C.cr0 : c);
    put(img, x, y + 4, c);
  }
  return img;
}

/** Revisteiro: a wire rack of magazines (1 tile, 18x24) that stands by the banca. */
function revisteiro() {
  const img = blank(18, 24);
  for (const x of [2, 14]) fillRect(img, x, 20, 2, 3, C.slate2);
  fillRect(img, 1, 2, 16, 19, C.slate2);
  fillRect(img, 2, 3, 14, 17, C.navy2);
  const COV = [C.r2, C.b2, C.y2, C.g2, C.p2, C.b0, C.y4, C.r1, C.lav3];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const col = COV[(r * 3 + c * 2) % COV.length];
      fillRect(img, 3 + c * 4, 4 + r * 4, 4, 4, col);
      hline(img, 3 + c * 4, 4 + r * 4, 4, C.white);
      dot(img, 4 + c * 4, 6 + r * 4, C.navy2);
    }
    hline(img, 2, 8 + r * 4 - 1, 14, C.slate);
  }
  hline(img, 1, 2, 16, C.mist);
  outlineAround(img);
  return img;
}

// ------------------------------------------------------------------ parked vehicles (static frame 0 of the authored traffic art)
async function parkedAuthored(which) {
  const parts = await vauth[which]();
  return parts.map((p) => ({ key: p.key.replace('vehicles/', 'vehicles/park_'), img: p.frames[0], anchor: p.anchor, meta: p.meta }));
}

// ------------------------------------------------------------------ parts for the import pipeline
export async function mesaDomino() {
  return [{ img: mesaJogo('domino'), anchor: [10, 22] }];
}
export async function mesaXadrez() {
  return [{ img: mesaJogo('xadrez'), anchor: [10, 22] }];
}
export async function banquinhoPart() {
  return [{ img: banquinho(), anchor: [5, 11] }];
}
export async function bustoPart() {
  return [{ img: busto(), anchor: [12, 44] }];
}
export async function canteiroRedondoPart() {
  return [{ img: canteiroRedondo(), anchor: [17, 28] }];
}
export async function canteiroLosangoPart() {
  return [{ img: canteiroLosango(), anchor: [25, 28] }];
}
export async function bandeirinhasPart(ctx, args) {
  const w = args?.w ?? 64;
  // the standing part is a 2 px knot; the flags are the overhead part
  const knot = blank(3, 3);
  fillRect(knot, 0, 0, 3, 3, K.br2);
  return [
    { img: knot, anchor: [1, 2], meta: { overhead: args?.key ?? 'props/bandeirinhas_64_o' } },
    { key: args?.key ?? 'props/bandeirinhas_64_o', img: bandeirinhas(w), anchor: [Math.floor(w / 2), 20], meta: { footprint: [Math.ceil(w / 16), 1], overhead: true, shadow: null } },
  ];
}
export async function revisteiroPart() {
  return [{ img: revisteiro(), anchor: [9, 22] }];
}
export const parkedFusca = () => parkedAuthored('fusca');
export const parkedKombi = () => parkedAuthored('kombi');
export const parkedMoto = () => parkedAuthored('moto');
export { pipoqueiro, cocoCart };
void flat; void sub; void and; void grid; void crop; void rect; void flipH; void NAVY;
