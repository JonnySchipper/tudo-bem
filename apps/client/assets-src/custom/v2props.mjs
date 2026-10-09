// Praça props of the V2 composition pass: domino and chess tables, stools, the bust on its plinth, flower beds of different shapes, the
// popcorn cart (pipoqueiro) and the coconut-water cart (derived from LimeZu street carts), hanging bunting, a magazine rack, the parked
// Fusca / Kombi / moto (static frames of the traffic art). Authored with the pack palette, light from the upper left, navy outline.
import { blank, put, shape, flat, grid, line, ell, box, or, and, sub, fillRect, ring, NAVY, h2 } from './paint.mjs';
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
function canteiroRedondo(shrub = true) {
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
  if (shrub) {
    shape(img, ell(cx, cy - 3, 5, 5.2), [cx, cy - 3, 5, 5.2], [C.sp0, C.sp1, C.g3, C.g2], { ol: NAVY, t: [0.8, 0.3, -0.2] });
    put(img, cx - 2, cy - 6, C.g1); put(img, cx - 1, cy - 7, C.g1); put(img, cx - 3, cy - 5, C.g1);
  }
  outlineAround(img);
  return img;
}

/** The round bed with the bust standing in its middle (2x2 footprint, 36x60). */
function canteiroBusto() {
  const img = blank(36, 60);
  paste(img, canteiroRedondo(false), 1, 28);
  paste(img, busto(), 6, 0);
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

/**
 * Carrinho de água de coco: the umbrella cart repainted green and white, a stacked pile of green coconuts in the left bin, cut ones with
 * straws standing in ice on the right, and a COCO board on the front.
 */
async function cocoCart(ctx) {
  const cart = stripSoftAlpha(await ctx.load(VEH + 'Fruit_Flowers_Cart_1.png'));
  const img = blank(56, 64);
  paste(img, cart, 0, 0);
  // repaint the umbrella: green and cream gores that keep the pack's shading.
  // The canopy is a dome seen from above; the gores radiate from the hub (the pale pixels
  // at x 16..17, y 14..15), not from the middle of the disc. Only inside the canopy's
  // outline: the cart's top rail behind it is the same warm wood and must stay wood.
  const cx = 16.5, cy = 14.5;
  const canopy = (x, y) => ((x + 0.5 - 16.5) / 16.2) ** 2 + ((y + 0.5 - 21.5) / 13.2) ** 2 <= 1;
  const GREEN = ['#2e7177', '#367f82', '#49928f', '#5ea592'];
  const CREAM = ['#c6bdd5', '#d8d0e0', '#ebe4f2', '#f8f8f8'];
  for (let y = 9; y < 38; y++) for (let x = 0; x < 36; x++) {
    const i = (y * 56 + x) * 4;
    if (!img.data[i + 3] || !canopy(x, y)) continue;
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
  // coconuts: green ellipsoids lit from the upper left, each with a dark-green rim so a heap still reads as separate nuts.
  // Drawn back to front (top of the heap first) so every front nut overlaps the one behind it.
  const SHELL = ['#2f5a2a', '#4f8a35', '#74b043', '#b8d97a'];
  const coco = (cx_, cy_, r = 3.3) => {
    shape(img, ell(cx_, cy_, r, r * 0.92), [cx_, cy_, r, r], SHELL, { ol: '#1f3a1c', t: [0.8, 0.3, -0.1] });
    put(img, Math.round(cx_ - 1.5), Math.round(cy_ - 1.6), '#e3e8b0');
  };
  // the left bin (wood front x 5..21, top edge y 35): a pyramid of whole coconuts standing up out of it
  for (const [x, y] of [[13, 29.5], [9.8, 32.6], [16.4, 32.6], [6.8, 35.8], [13.1, 35.8], [19.3, 35.8]]) coco(x, y);
  // the ice box on the right (dark inside x 22..40, y 36..46): crushed ice, three cut coconuts with straws standing in it
  for (let y = 37; y < 46; y++) for (let x = 23; x < 39; x++) {
    const r = h2(x, y, 17);
    put(img, x, y, y < 39 ? (r < 0.5 ? '#f8f8f8' : '#d8e8f0') : r < 0.3 ? '#ffffff' : r < 0.75 ? '#c6dceb' : '#9ab8cf');
  }
  for (const [x, y] of [[26, 35.5], [31.5, 34.6], [36.8, 35.5]]) {
    coco(x, y, 3);
    // the cut top: husk rim and pale flesh, and a red-and-white straw leaning out
    put(img, Math.round(x) - 1, Math.round(y) - 3, '#d8cc98'); put(img, Math.round(x), Math.round(y) - 3, '#fffaf0'); put(img, Math.round(x) + 1, Math.round(y) - 3, '#d8cc98');
    line(img, Math.round(x), Math.round(y) - 4, Math.round(x) + 2, Math.round(y) - 9, C.r3);
    put(img, Math.round(x) + 1, Math.round(y) - 6, C.white); put(img, Math.round(x) + 2, Math.round(y) - 9, C.r1);
  }
  // the board on the front of the ice box: navy frame, cream face, green letters, a green coconut dot either side
  const w = width3('COCO') + 8;
  const bx = 23, by = 46;
  fillRect(img, bx, by, w, 9, NAVY);
  fillRect(img, bx + 1, by + 1, w - 2, 7, '#f8f8f8');
  hline(img, bx + 1, by + 7, w - 2, '#d8d0e0');
  drawText3(img, bx + 4, by + 2, 'COCO', '#2e7177');
  put(img, bx + 2, by + 4, '#4f8a35'); put(img, bx + w - 3, by + 4, '#4f8a35');
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
export async function canteiroBustoPart() {
  return [{ img: canteiroBusto(), anchor: [18, 56] }];
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

// ------------------------------------------------------------------ Feira game cart and the bright board (not the coconut cart, not the mat scoreboard)

/**
 * A push-cart for the Feira games, one per game (`args.game`), so the cart always names today's game:
 *   tapioca  red / yellow / green awning, a little chapa with tapiocas, filling bowls, a TAPIOCA plaque
 *   pastel   yellow / red awning, a fryer with golden oil, a glass case of pastéis, a PASTEL plaque
 *   caldo    green / yellow awning, the green cane press with its flywheel, cane and two cups, a CALDO DE CANA plaque
 */
const CART_LOOK = {
  tapioca: { stripes: [C.r2, C.cr0, C.y2, C.cr0, C.g2, C.cr0], plaque: ['TAPIOCA'], bg: [C.r3, C.r1], fg: [C.y1, C.r5] },
  pastel: { stripes: [C.y2, C.cr0, C.r2, C.cr0], plaque: ['PASTEL'], bg: [C.y2, C.y0], fg: [C.r4, C.y4] },
  caldo: { stripes: [C.g2, C.cr0, C.y2, C.cr0], plaque: ['CALDO', 'DE CANA'], bg: [C.teal2, C.teal4], fg: [C.y1, C.teal0] },
};

/** The plaque on the cart front: navy frame, one or two lines of 3x5 capitals, centred on the cart box (x 6..57). */
function cartPlaque(img, lines, bg, fg) {
  const w = Math.max(...lines.map(width3)) + 6;
  const h = lines.length * 6 + 3;
  const x = 32 - Math.floor(w / 2);
  const y = lines.length > 1 ? 33 : 36;
  fillRect(img, x, y, w, h, NAVY);
  fillRect(img, x + 1, y + 1, w - 2, h - 2, bg[0]);
  fillRect(img, x + 1, y + 1, w - 2, 1, bg[1]);
  lines.forEach((t, i) => drawText3(img, 32 - Math.floor(width3(t) / 2), y + 2 + i * 6, t, fg[0], fg[1]));
}

function tapiocaCounter(img) {
  // a small steel chapa on the left of the counter
  fillRect(img, 8, 18, 22, 9, C.slate);
  fillRect(img, 8, 18, 22, 1, C.mist2);
  fillRect(img, 8, 18, 1, 9, C.mist);
  fillRect(img, 29, 18, 1, 9, C.navy2);
  fillRect(img, 9, 26, 20, 1, C.navy);
  // two tapioca discs on the chapa, one still pale and one lacy
  shape(img, ell(14, 22, 4.2, 3.2), [14, 22, 4.2, 3.2], ['#e2b340', '#f0d090', '#fff6e0', '#fffdf8'], { ol: NAVY, t: [0.8, 0.35, 0] });
  shape(img, ell(23, 22, 3.6, 2.8), [23, 22, 3.6, 2.8], ['#f0d090', '#fff6e0', '#fffdf8', '#ffffff'], { ol: NAVY, t: [0.82, 0.4, 0] });
  put(img, 13, 21, '#fffdf8'); put(img, 22, 21, '#fff59a');
  // a red pilot light and a dial on the chapa front
  put(img, 10, 25, C.r1); put(img, 12, 25, C.y2);
  // four filling bowls along the right of the counter
  const bowls = [C.y2, C.cr0, '#6b3a22', C.r2];
  bowls.forEach((c, i) => {
    const x = 34 + i * 6;
    fillRect(img, x, 22, 5, 4, C.lav3);
    fillRect(img, x, 22, 5, 1, C.white);
    fillRect(img, x + 1, 23, 3, 2, c);
    put(img, x + 1, 23, C.white);
  });
}

/** a golden half-moon pastel (5x4) with a crimped top edge */
function pastelBit(img, x, y) {
  fillRect(img, x, y + 1, 5, 3, C.y3); fillRect(img, x + 1, y, 3, 1, C.y2);
  put(img, x + 1, y, C.y1); put(img, x, y + 1, C.y1); put(img, x + 4, y + 3, C.y4); put(img, x + 2, y + 3, C.y4);
  for (let i = 0; i < 5; i += 2) put(img, x + i, y + 1, C.y4);
}

function pastelCounter(img) {
  // the fryer: a steel tank with golden oil, a wire basket handle, steam
  fillRect(img, 8, 17, 21, 10, NAVY);
  fillRect(img, 9, 18, 19, 8, C.slate);
  fillRect(img, 9, 18, 19, 1, C.mist2); fillRect(img, 9, 18, 1, 8, C.mist);
  fillRect(img, 10, 19, 17, 3, C.y3); fillRect(img, 10, 19, 17, 1, C.y1);
  for (const x of [12, 17, 23]) put(img, x, 20, C.y0);
  pastelBit(img, 11, 18); pastelBit(img, 19, 18);
  line(img, 27, 19, 30, 15, C.slate2); put(img, 30, 14, C.mist2);
  for (const [sx, sy] of [[13, 15], [14, 14], [21, 14], [22, 13], [16, 12]]) put(img, sx, sy, C.lav3);
  put(img, 11, 24, C.r1); put(img, 13, 24, C.y2);
  // the glass case: two shelves of pastéis
  fillRect(img, 33, 14, 22, 13, NAVY);
  fillRect(img, 34, 15, 20, 11, K.gl2);
  fillRect(img, 34, 15, 20, 1, K.gl1); fillRect(img, 34, 15, 1, 11, K.gl1);
  fillRect(img, 34, 20, 20, 1, C.lav3);
  for (const x of [36, 42, 48]) { pastelBit(img, x, 16); pastelBit(img, x, 21); }
  fillRect(img, 34, 25, 20, 1, C.lav);
}

function caldoCounter(img) {
  // the green cane press: hopper on top, a yellow band, the flywheel on its left, a spout over a cup
  fillRect(img, 12, 14, 15, 13, NAVY);
  fillRect(img, 13, 15, 13, 11, C.teal3);
  fillRect(img, 13, 15, 13, 1, C.teal5); fillRect(img, 13, 15, 1, 11, C.teal5); fillRect(img, 25, 16, 1, 10, C.teal1);
  fillRect(img, 13, 19, 13, 3, C.y2); fillRect(img, 13, 19, 13, 1, C.y1); fillRect(img, 13, 21, 13, 1, C.y4);
  fillRect(img, 15, 10, 9, 5, NAVY); fillRect(img, 16, 11, 7, 3, C.slate2); fillRect(img, 16, 11, 7, 1, C.mist2);
  ring(img, 10, 20, 4.3, (x, y) => (x + y < 28 ? C.lav3 : C.slate2));
  fillRect(img, 9, 19, 2, 2, C.y3); put(img, 9, 19, C.y1);
  fillRect(img, 26, 22, 4, 2, NAVY); put(img, 27, 22, C.mist2); put(img, 28, 22, C.mist2);
  put(img, 29, 24, '#d4e56a');
  // cane leaning into the hopper
  for (let i = 0; i < 3; i++) line(img, 17 + i * 2, 13, 22 + i * 2, 2, i === 1 ? C.g2 : C.g3);
  for (const [nx, ny] of [[18, 10], [20, 6], [22, 9], [23, 4], [25, 7]]) put(img, nx, ny, C.y2);
  // two cups of juice and a bundle of cane on the right of the counter
  for (const x of [32, 38]) {
    fillRect(img, x, 19, 5, 7, NAVY);
    fillRect(img, x + 1, 20, 3, 5, K.gl1);
    fillRect(img, x + 1, 22, 3, 3, '#d4e56a'); put(img, x + 1, 22, '#f7f8d8');
  }
  for (let i = 0; i < 4; i++) { fillRect(img, 45 + i * 3, 16, 2, 10, i % 2 ? C.g3 : C.g2); put(img, 45 + i * 3, 19, C.y2); put(img, 46 + i * 3, 23, C.y3); }
  fillRect(img, 44, 21, 13, 1, K.br2);
}

export async function feiraGameCart(_ctx, args = {}) {
  const look = CART_LOOK[args.game ?? 'tapioca'];
  if (!look) throw new Error(`feiraGameCart: unknown game ${args.game}`);
  const W = 64, H = 62;
  const img = blank(W, H);
  // wheels
  for (const cx of [16, 46]) {
    shape(img, ell(cx, 54, 6.2, 6.2), [cx, 54, 6.2, 6.2], [C.navy, C.slate, C.slate2, C.mist], { ol: NAVY, t: [0.8, 0.4, 0] });
    shape(img, ell(cx, 54, 2.4, 2.4), [cx, 54, 2.4, 2.4], [C.w4, C.w2, C.w1, C.w0], { ol: NAVY, t: [0.85, 0.4, 0] });
  }
  // axle and the lower body
  fillRect(img, 8, 48, 48, 4, C.w5);
  fillRect(img, 8, 48, 48, 1, C.w3);
  fillRect(img, 8, 51, 48, 1, C.w6);
  // cart box
  fillRect(img, 6, 30, 52, 19, C.w3);
  fillRect(img, 6, 30, 52, 2, C.w1);
  fillRect(img, 6, 30, 2, 19, C.w1);
  fillRect(img, 56, 30, 2, 19, C.w5);
  fillRect(img, 6, 47, 52, 2, C.w5);
  // plank seams
  for (const x of [18, 30, 42]) fillRect(img, x, 32, 1, 15, C.w4);
  // the game's plaque on the front (each cart names its own game)
  cartPlaque(img, look.plaque, look.bg, look.fg);
  // counter top
  fillRect(img, 5, 26, 54, 5, C.w2);
  fillRect(img, 5, 26, 54, 1, C.w0);
  fillRect(img, 5, 30, 54, 1, C.w4);
  if (args.game === 'pastel') pastelCounter(img);
  else if (args.game === 'caldo') caldoCounter(img);
  else tapiocaCounter(img);
  // awning poles
  fillRect(img, 8, 8, 2, 18, C.w4);
  fillRect(img, 8, 8, 1, 18, C.w1);
  fillRect(img, 54, 8, 2, 18, C.w4);
  fillRect(img, 55, 8, 1, 18, C.w6);
  // striped awning (feira red / cream / yellow / green), scalloped front
  const STRIPES = look.stripes;
  for (let x = 6; x <= 57; x++) {
    const col = STRIPES[Math.floor((x - 6) / 4) % STRIPES.length];
    const scallop = (x % 6) < 2 ? 1 : (x % 6) > 3 ? 1 : 0;
    for (let y = 4; y < 14 + scallop; y++) put(img, x, y, y < 6 ? (col === C.cr0 ? C.white : col) : col);
    if (x % 4 === 3) for (let y = 5; y < 13; y++) put(img, x, y, NAVY);
  }
  fillRect(img, 6, 4, 52, 1, NAVY);
  // a string of bulbs under the awning
  for (let x = 12; x < 54; x += 6) put(img, x, 15, C.y0);
  // push handle on the right
  fillRect(img, 58, 20, 2, 16, C.w5);
  fillRect(img, 58, 20, 1, 16, C.w2);
  fillRect(img, 57, 18, 5, 2, C.w3);
  fillRect(img, 57, 18, 5, 1, C.w0);
  outlineAround(img);
  return [{ img, anchor: [32, 60] }];
}

/** A bright Feira easel: cream board, festa stripes, FEIRA in mustard, three medal pips and a little crown. Not the mat scoreboard. */
export async function feiraGameSign() {
  const img = blank(44, 52);
  // legs and feet
  fillRect(img, 8, 36, 3, 14, C.w4);
  fillRect(img, 8, 36, 1, 14, C.w1);
  fillRect(img, 33, 36, 3, 14, C.w4);
  fillRect(img, 35, 36, 1, 14, C.w6);
  fillRect(img, 6, 48, 7, 2, C.w5);
  fillRect(img, 31, 48, 7, 2, C.w5);
  // cross brace
  for (let i = 0; i < 10; i++) put(img, 12 + i, 40 + Math.floor(i / 3), C.w5);
  // board
  fillRect(img, 2, 6, 40, 32, NAVY);
  fillRect(img, 3, 7, 38, 30, C.y1);
  fillRect(img, 3, 7, 38, 2, C.y0);
  fillRect(img, 3, 7, 2, 30, C.y0);
  fillRect(img, 39, 7, 2, 30, C.y4);
  fillRect(img, 3, 35, 38, 2, C.y4);
  // festa stripe along the top of the face
  const stripe = [C.r2, C.y2, C.g2, C.b2];
  for (let x = 5; x < 39; x++) put(img, x, 10, stripe[(x - 5) % 4]);
  for (let x = 5; x < 39; x++) put(img, x, 11, stripe[(x - 5) % 4]);
  // a little crown above the word
  fillRect(img, 18, 13, 8, 3, C.y2);
  put(img, 18, 12, C.y2); put(img, 21, 12, C.y0); put(img, 25, 12, C.y2);
  put(img, 19, 14, C.r2); put(img, 22, 14, C.b2); put(img, 24, 14, C.g2);
  // FEIRA
  drawText3(img, 12, 18, 'FEIRA', C.r4, C.y4);
  // three medal pips: gold, silver, bronze — flat discs, a one-pixel shine
  const medals = [
    [C.y4, C.y2, C.y1, C.y0],
    [C.slate2, C.lav, C.lav3, C.white],
    [K.te4, K.te2, K.te0, K.or0],
  ];
  medals.forEach((ramp, i) => {
    const x = 14 + i * 8;
    shape(img, ell(x, 29, 3.1, 3.1), [x, 29, 3.1, 3.1], ramp, { ol: NAVY, t: [0.84, 0.5, 0.12] });
  });
  outlineAround(img);
  return [{ img, anchor: [22, 50] }];
}
/**
 * The Praça's Placar da Vila (52x56): a wooden village notice board under a little terracotta roof with bunting, a cream PLACAR
 * plaque and two pinned sheets — a book (words learned) and a flame (streak) — each ruled with gold / silver / bronze ranking rows.
 * Not the mat scoreboard (props/placar), which stays in the academia.
 */
export async function vilaBoard() {
  const img = blank(52, 56);
  // posts and feet
  for (const x of [7, 42]) {
    fillRect(img, x, 8, 3, 46, C.w4);
    fillRect(img, x, 8, 1, 46, C.w2);
    fillRect(img, x + 2, 8, 1, 46, C.w6);
  }
  fillRect(img, 5, 52, 7, 2, C.w5);
  fillRect(img, 40, 52, 7, 2, C.w5);
  hline(img, 5, 52, 7, C.w3); hline(img, 40, 52, 7, C.w3);
  // terracotta roof: two rows of rounded tiles under a ridge beam
  fillRect(img, 4, 1, 44, 2, C.w5);
  hline(img, 4, 1, 44, C.w3);
  for (let y = 3; y < 9; y++) {
    const inset = Math.max(0, 8 - y) - 1;
    for (let x = 1 + inset; x < 51 - inset; x++) {
      const k = (x + (y >= 6 ? 2 : 0)) % 4;
      put(img, x, y, y === 5 || y === 8 ? K.te5 : k === 0 ? K.te4 : k === 1 ? K.te0 : K.te2);
    }
  }
  // festa bunting under the eave
  const flags = [C.r2, C.y2, C.g2, C.b2, C.p1];
  for (let i = 0; i < 9; i++) {
    const x = 4 + i * 5, c = flags[i % flags.length];
    fillRect(img, x, 9, 3, 1, c);
    put(img, x + 1, 10, c);
  }
  // board: wooden frame around warm planks
  fillRect(img, 3, 11, 46, 33, C.w3);
  hline(img, 3, 11, 46, C.w1); vline(img, 3, 11, 33, C.w1);
  hline(img, 3, 43, 46, C.w5); vline(img, 48, 11, 33, C.w5);
  fillRect(img, 5, 13, 42, 29, C.w5);
  for (let y = 13; y < 42; y += 5) hline(img, 5, y, 42, C.w6);
  for (let y = 14; y < 42; y += 5) hline(img, 5, y, 42, K.br1);
  // PLACAR plaque, nailed on
  fillRect(img, 11, 14, 30, 9, NAVY);
  fillRect(img, 12, 15, 28, 7, C.cr1);
  hline(img, 12, 15, 28, C.cr0); hline(img, 12, 21, 28, C.cr3);
  drawText3(img, 15, 16, 'PLACAR', K.te5, C.cr3);
  put(img, 13, 18, C.w5); put(img, 39, 18, C.w5);
  // two pinned sheets: words (book) and streak (flame), three ranked rows each
  const MEDALS = [[C.y3, C.y0], [C.mist2, C.white], [K.te2, K.or0]];
  const sheet = (x0, icon, lens) => {
    fillRect(img, x0, 24, 18, 17, NAVY);
    fillRect(img, x0 + 1, 25, 16, 15, C.cr0);
    hline(img, x0 + 1, 39, 16, C.cr2); vline(img, x0 + 16, 25, 15, C.cr2);
    put(img, x0 + 8, 24, C.r3); put(img, x0 + 8, 23, C.r1); // pin
    icon(x0 + 6, 26);
    lens.forEach((len, i) => {
      const y = 31 + i * 3;
      const [m, shine] = MEDALS[i];
      fillRect(img, x0 + 2, y, 2, 2, m); put(img, x0 + 2, y, shine);
      hline(img, x0 + 5, y + 1, len, C.slate);
      hline(img, x0 + 13, y + 1, 2, K.te4);
    });
  };
  const book = (x, y) => {
    // an open book: green cover under two white pages, a spine and two lines of text per page
    fillRect(img, x - 1, y + 1, 8, 4, C.g3);
    fillRect(img, x, y, 3, 4, C.white); fillRect(img, x + 4, y, 3, 4, C.white);
    vline(img, x + 3, y + 1, 4, C.sp0);
    for (const ly of [y + 1, y + 2]) { hline(img, x, ly, 2, C.mist); hline(img, x + 5, ly, 2, C.mist); }
  };
  const flame = (x, y) => {
    put(img, x + 3, y, C.r1); fillRect(img, x + 2, y + 1, 2, 1, C.r1); fillRect(img, x + 1, y + 2, 4, 2, C.r2);
    fillRect(img, x + 2, y + 2, 2, 2, C.y3); put(img, x + 2, y + 3, C.y1);
  };
  sheet(7, book, [7, 6, 5]);
  sheet(27, flame, [6, 7, 4]);
  outlineAround(img);
  return [{ img, anchor: [26, 54] }];
}
void flat; void sub; void and; void grid; void crop; void rect; void flipH; void NAVY;
