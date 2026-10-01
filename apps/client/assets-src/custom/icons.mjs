// Item icons, 16x16 (shown in the UI at 3-4x): the padaria shelf of "Me vê um" (packages/shared/src/meveum.ts SHELF) plus jornal, flores
// and banana from the recados ITEMS. The LimeZu packs have only a handful of tiny food pieces (a few 6x12 bottles, plates in the kitchen
// and grocery sheets), so every icon is authored here with masks, the pack palette and the pack lighting (light from the upper left,
// navy outline, 1 px lit rim / 2 px shaded rim). Keys are `icons/<itemId>`.
import { blank, put, shape, flat, grid, line, ell, box, or, and, sub, fillRect, ring, NAVY } from './paint.mjs';
import { C, K } from './kit.mjs';

const N = 16;
const el = (cx, cy, rx, ry, a = 0) => (x, y) => {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
};
const CRUST = ['#a9764f', '#c78c59', '#daa463', '#f2bd7a'];
const GOLD = ['#b5754d', '#d9a15a', '#f0c060', '#ffe57b'];
const FRY = ['#a9764f', '#c78c59', '#e0a64a', '#f8d239'];
const GLASS = [K.gl4, K.gl3, K.gl2, K.gl1];
const dark = (r) => r[0];

const icon = () => blank(N, N);

// ---------------------------------------------------------------- bread
function pao() {
  // pão francês: a fat oval roll with a lengthwise slash and a pale crumb edge, lit from the upper left
  const img = icon();
  const m = el(8, 9, 7, 4.3, -0.3);
  shape(img, m, [8, 9, 7, 4.5], CRUST, { ol: NAVY, t: [0.82, 0.32, -0.15] });
  // the slash (lighter, wavy) with a dark lip below it
  for (const [x, y] of [[4, 9], [5, 8], [6, 8], [7, 7], [8, 7], [9, 6], [10, 6], [11, 6]]) put(img, x, y, '#f7dca0');
  for (const [x, y] of [[4, 10], [5, 9], [6, 9], [7, 8], [8, 8], [9, 7], [10, 7], [11, 7]]) put(img, x, y, '#b5754d');
  put(img, 12, 6, '#f2bd7a');
  // flour dust
  for (const [x, y] of [[6, 6], [9, 5], [11, 8]]) put(img, x, y, '#f0efde');
  return img;
}
function paoQueijo() {
  // three round cheese breads in a little pyramid: chewy golden crust with cheese-bubble speckles
  const img = icon();
  const balls = [[4.6, 11, 3.9], [11.4, 11, 3.9], [8, 5.6, 4.2]];
  for (const [cx, cy, r] of balls) {
    shape(img, ell(cx, cy, r, r * 0.95), [cx, cy, r, r], GOLD, { ol: NAVY, t: [0.85, 0.4, -0.05] });
    put(img, Math.round(cx - r * 0.45), Math.round(cy - r * 0.5), '#fff2b0');
    put(img, Math.round(cx + r * 0.3), Math.round(cy + r * 0.1), '#c78c59');
  }
  for (const [x, y] of [[8, 4], [7, 7], [11, 10], [5, 12], [10, 12], [3, 11]]) put(img, x, y, '#a9764f');
  return img;
}
function paoNaChapa() {
  // pão na chapa: a toasted french bread split open, grill marks and a shiny melted butter pat, on a small plate
  const img = icon();
  // plate
  shape(img, el(8, 12, 7.2, 2.8), [8, 12, 7.5, 3], [C.lav, C.lav3, C.lav4, C.white], { ol: NAVY });
  // bread body
  shape(img, and(el(8, 8.2, 6.8, 3.4, -0.12), (x, y) => y < 11.5), [8, 8, 7, 4], CRUST, { ol: NAVY, t: [0.85, 0.3, -0.15] });
  // open face: pale crumb strip along the top with toasted grill marks and butter
  shape(img, el(8.2, 6.6, 5.6, 1.9, -0.12), [8, 6.6, 6, 2], ['#c78c59', '#e0b870', '#f1ce8e', '#fff2b0'], { ol: '#a9764f', t: [0.9, 0.35, -0.2] });
  for (const x of [5, 8, 11]) put(img, x, 7, '#a9764f');
  fillRect(img, 6, 5, 3, 1, '#ffe57b'); put(img, 6, 5, '#fff59a'); put(img, 8, 6, '#f8d239');
  for (const x of [5, 7, 9, 11]) put(img, x, 9, '#a9764f');
  return img;
}
function misto() {
  // misto quente: a toasted sandwich seen from a corner: golden top with grill marks, front cut face with bread / cheese / ham / cheese / bread
  const img = icon();
  const top = (x, y) => y >= 2 && y < 6 && x >= 1 + (6 - y) * 1.6 && x < 11 + (6 - y) * 1.6 + 0.5;
  shape(img, top, [9, 4, 6, 2], CRUST, { ol: NAVY, t: [0.85, 0.3, -0.15] });
  for (const [x, y] of [[6, 5], [8, 4], [10, 3], [7, 5], [9, 4], [11, 3]]) put(img, x, y, '#8a5a38');
  const front = (x, y) => x >= 1 && x < 11 && y >= 6 && y < 14;
  shape(img, front, [6, 10, 5, 4], CRUST, { ol: NAVY, t: [0.9, 0.3, -0.2] });
  const side = (x, y) => x >= 11 && x < 15 && y >= 3 + (15 - x) * 0 + (11 - x) * -1 - 0.2 && y < 12.5 - (x - 11) + 0.5;
  shape(img, side, [13, 8, 2, 4], ['#8a5a38', '#a9764f', '#c78c59', '#daa463'], { ol: NAVY, t: [1.5, 1.0, 0.6] });
  const rows = ['#f2bd7a', '#f2bd7a', '#ffe57b', '#ffe57b', '#e07070', '#ffe57b', '#daa463', '#daa463'];
  for (let y = 6; y < 14; y++) for (let x = 1; x < 11; x++) if (front(x + 0.5, y + 0.5)) put(img, x, y, rows[y - 6]);
  for (let y = 6; y < 14; y++) put(img, 1, y, y < 8 ? '#fff0c8' : '#f7dca0');
  for (const [x, y] of [[3, 9], [4, 9], [7, 9], [9, 9]]) put(img, x, y, '#f8d239'); // melted cheese sagging
  put(img, 4, 10, '#f8d239'); put(img, 8, 10, '#f8d239');
  for (let x = 1; x < 11; x++) { put(img, x, 6, '#dcae62'); put(img, x, 13, '#a9764f'); }
  return img;
}

// ---------------------------------------------------------------- salgados, bolo
function pastel() {
  // pastel: a fried half-moon (round top, flat crimped bottom), blistered golden crust
  const img = icon();
  const m = (x, y) => y >= 3 && y < 12 && ell(8, 11.6, 7.2, 8.6)(x, y);
  shape(img, m, [8, 11, 7.2, 8.6], ['#a9764f', '#c78c59', '#dd9a3f', '#f0b850'], { ol: NAVY, t: [0.8, 0.28, -0.1] });
  // crimped fold along the flat bottom: dark zigzag on a lighter seam
  for (let x = 1; x <= 14; x++) { if (m(x + 0.5, 10.5)) { put(img, x, 10, x % 2 ? '#8a5a38' : '#c78c59'); put(img, x, 11, x % 2 ? '#a9764f' : '#8a5a38'); } }
  // blisters and the lit rim
  for (const [x, y] of [[5, 6], [6, 5], [9, 6], [10, 8], [7, 8], [12, 9], [4, 9]]) put(img, x, y, '#ffe57b');
  for (const [x, y] of [[8, 5], [6, 7], [11, 7], [9, 9]]) put(img, x, y, '#ed931e');
  return img;
}
function coxinha() {
  // coxinha: a golden breaded teardrop, round belly and a pinched tip, crumb dots
  const img = icon();
  const m = or(ell(8, 10, 5.4, 4.9), (x, y) => y >= 1.5 && y < 9 && Math.abs(x - (8.4 - (9 - y) * 0.12)) <= 0.9 + (y - 1.5) * 0.62);
  shape(img, m, [8, 8, 6, 7.5], ['#a9764f', '#c78c59', '#dd9a3f', '#f0b850'], { ol: NAVY, t: [0.86, 0.36, -0.1] });
  for (const [x, y] of [[6, 9], [9, 8], [10, 11], [7, 12], [9, 5], [5, 11], [11, 9], [8, 10]]) put(img, x, y, '#ffe57b');
  for (const [x, y] of [[8, 12], [10, 9], [7, 7], [6, 11]]) put(img, x, y, '#a9764f');
  put(img, 8, 3, '#fff59a');
  return img;
}
function bolo() {
  // bolo de cenoura: a slice seen from a corner: orange sponge front, chocolate glaze on top dripping down, darker right side
  const img = icon();
  const front = (x, y) => x >= 1 && x < 11 && y >= 6 && y < 14;
  const side = (x, y) => x >= 11 && x < 15 && y >= 4 + (x - 11) * -1 + 2 && y < 12 - (x - 11) * 1 + 0.5;
  const top = (x, y) => y >= 3 && y < 6 && x >= 1 + (6 - y) * 1.3 && x < 11 + (6 - y) * 1.3 + 1;
  shape(img, side, [13, 9, 2, 4], ['#a84f16', '#c46823', '#d97a20', '#ed931e'], { ol: NAVY, t: [1.5, 1.0, 0.6] });
  shape(img, front, [6, 10, 5, 4], ['#c46823', '#ed931e', '#f7a12a', '#ffe57b'], { ol: NAVY, t: [0.9, 0.3, -0.2] });
  shape(img, top, [8, 4.5, 6, 1.5], ['#3f2a1c', '#573c2c', '#6b4b30', '#8a6540'], { ol: NAVY, t: [0.9, 0.3, -0.2] });
  // glaze drips over the front and the side
  for (const [x, y] of [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6]]) put(img, x, y, '#573c2c');
  for (const [x, y] of [[2, 7], [2, 8], [5, 7], [8, 7], [8, 8], [8, 9], [10, 7]]) put(img, x, y, '#573c2c');
  for (const [x, y] of [[12, 6], [13, 6]]) put(img, x, y, '#573c2c');
  put(img, 3, 6, '#6b4b30'); put(img, 7, 6, '#6b4b30');
  // sponge crumb dots
  for (const [x, y] of [[3, 10], [6, 11], [9, 10], [4, 12], [8, 12]]) put(img, x, y, '#c46823');
  return img;
}

// ---------------------------------------------------------------- drinks
function cafe() {
  // café: a small white cup and saucer with black coffee and a wisp of steam
  const img = icon();
  shape(img, el(8, 13, 7, 2), [8, 13, 7, 2], [C.lav, C.lav3, C.lav4, C.white], { ol: NAVY });
  const body = (x, y) => y >= 7 && y < 13 && Math.abs(x - 7.5) <= 5 - (y - 7) * 0.35;
  shape(img, body, [7.5, 10, 5, 3], [C.lav, C.lav3, C.lav4, C.white], { ol: NAVY, t: [0.85, 0.3, -0.15] });
  shape(img, el(7.5, 7.4, 5, 1.6), [7.5, 7.4, 5, 1.6], ['#3a2618', '#573c2c', '#6b4b30', '#8a6540'], { ol: NAVY, t: [0.95, 0.3, -0.5] });
  // handle
  for (const [x, y] of [[13, 8], [14, 9], [14, 10], [13, 11], [12, 11]]) put(img, x, y, NAVY);
  for (const [x, y] of [[13, 9], [13, 10]]) put(img, x, y, C.lav3);
  // steam
  for (const [x, y] of [[6, 4], [7, 3], [6, 2], [9, 4], [10, 3], [9, 2]]) put(img, x, y, C.lav3);
  return img;
}
function cafeComLeite() {
  // café com leite: a clear glass mug, coffee at the bottom, milky layer and foam on top
  const img = icon();
  const glass = (x, y) => y >= 3 && y < 14 && Math.abs(x - 7) <= 5 - (y - 3) * 0.12;
  shape(img, glass, [7, 8.5, 5, 6], GLASS, { ol: NAVY, t: [0.9, 0.4, -0.3] });
  // layers
  for (let y = 5; y < 13; y++) for (let x = 2; x < 12; x++) {
    if (!glass(x + 0.5, y + 0.5)) continue;
    const c = y < 6 ? '#fff2d8' : y < 8 ? '#e0b088' : y < 11 ? '#a9764f' : '#7b5b3a';
    const edge = x === 2 || !glass(x + 1.5, y + 0.5);
    put(img, x, y, edge ? (y < 6 ? '#e0d0b2' : y < 8 ? '#c78c59' : y < 11 ? '#8a5a38' : '#573c2c') : c);
  }
  put(img, 3, 6, '#ffffff'); put(img, 3, 8, '#f2d2b0'); put(img, 4, 5, '#ffffff');
  // handle
  for (const [x, y] of [[12, 6], [13, 7], [13, 9], [13, 10], [12, 11]]) put(img, x, y, NAVY);
  for (const [x, y] of [[12, 7], [12, 8], [12, 9], [12, 10]]) put(img, x, y, C.lav3);
  put(img, 13, 8, NAVY);
  return img;
}
function suco() {
  // suco de laranja: a tall glass of orange juice, an orange wheel on the rim, a straw
  const img = icon();
  line(img, 9, 1, 11, 6, NAVY); line(img, 10, 1, 12, 6, C.r2); line(img, 10, 2, 12, 6, C.r0);
  const glass = (x, y) => y >= 4 && y < 15 && Math.abs(x - 7.5) <= 4.6 - (y - 4) * 0.13;
  shape(img, glass, [7.5, 9.5, 4.6, 5.5], GLASS, { ol: NAVY, t: [0.9, 0.4, -0.3] });
  for (let y = 6; y < 14; y++) for (let x = 3; x < 12; x++) {
    if (!glass(x + 0.5, y + 0.5)) continue;
    const edge = x <= 3 || !glass(x + 1.5, y + 0.5);
    put(img, x, y, edge ? '#c46823' : y === 6 ? '#ffe57b' : y < 9 ? '#f7a12a' : '#ed931e');
  }
  put(img, 4, 8, '#ffe57b'); put(img, 4, 9, '#ffe57b'); put(img, 5, 7, '#fff59a');
  // orange wheel on the rim
  ring(img, 12.5, 5.5, 2.6, () => '#ed931e');
  shape(img, ell(12.5, 5.5, 2, 2), [12.5, 5.5, 2, 2], ['#f2b22b', '#f8d239', '#ffe57b', '#fff59a'], { ol: '#ed931e', t: [0.95, 0.5, 0.0] });
  return img;
}
function agua() {
  // água: a small plastic water bottle, blue cap, pale label
  const img = icon();
  const body = (x, y) => (y >= 5 && y < 15 && Math.abs(x - 8) <= 3.6 - (y > 6 && y < 13 ? 0 : (y < 6 ? 1 : 0.6)) + (y >= 6 && y < 8 ? 0.2 : 0)) || (y >= 3 && y < 5 && Math.abs(x - 8) <= 1.6);
  shape(img, body, [8, 9, 3.8, 6], GLASS, { ol: NAVY, t: [0.9, 0.4, -0.3] });
  fillRect(img, 7, 1, 3, 2, NAVY); fillRect(img, 7, 1, 2, 1, C.b1); fillRect(img, 7, 2, 3, 1, C.b3);
  put(img, 7, 3, C.b1); put(img, 8, 3, C.b1);
  // water and label
  for (let y = 7; y < 14; y++) for (let x = 5; x < 12; x++) if (body(x + 0.5, y + 0.5)) put(img, x, y, y < 8 ? K.gl2 : x < 6 ? '#95e3e3' : x > 9 ? '#4995e3' : '#7fcdf0');
  fillRect(img, 5, 9, 6, 3, C.white); fillRect(img, 5, 9, 6, 1, C.lav4); fillRect(img, 5, 11, 6, 1, C.lav3);
  put(img, 7, 10, C.b1); put(img, 8, 10, C.b0); put(img, 9, 10, C.b1);
  put(img, 5, 7, C.white);
  return img;
}
function guarana() {
  // guaraná: an unbranded green soda can with a yellow band and the red guaraná berry
  const img = icon();
  const body = (x, y) => y >= 3 && y < 14 && x >= 3.2 && x < 12.8;
  shape(img, body, [8, 8.5, 4.8, 5.5], [C.teal0, C.teal2, C.teal4, C.teal5], { ol: NAVY, t: [0.85, 0.32, -0.1] });
  // rim and top
  fillRect(img, 3, 2, 10, 2, NAVY); fillRect(img, 4, 2, 8, 1, C.lav2); fillRect(img, 4, 3, 8, 1, C.mist);
  fillRect(img, 3, 13, 10, 1, NAVY); fillRect(img, 4, 13, 8, 1, C.mist);
  // yellow band + berry emblem
  fillRect(img, 4, 7, 8, 3, C.y2); fillRect(img, 4, 7, 8, 1, C.y0); fillRect(img, 4, 9, 8, 1, C.y4);
  shape(img, ell(8, 8, 1.9, 1.9), [8, 8, 2, 2], [C.r5, C.r3, C.r2, C.r0], { ol: NAVY, t: [0.9, 0.3, -0.4] });
  put(img, 8, 8, C.navy);
  // shine
  for (let y = 4; y < 7; y++) put(img, 5, y, C.teal5);
  return img;
}

// ---------------------------------------------------------------- non-food
function jornal() {
  // jornal: a folded newspaper: masthead, photo block, columns of text lines, a crease
  const img = icon();
  const sheet = (x, y) => x >= 1 && x < 15 && y >= 2 && y < 14;
  shape(img, sheet, [8, 8, 7, 6], [C.cr3, C.cr2, C.cr1, C.cr0], { ol: NAVY, t: [0.95, 0.35, -0.5] });
  fillRect(img, 2, 3, 12, 2, '#565972'); fillRect(img, 3, 3, 4, 1, C.lav3); fillRect(img, 9, 3, 3, 1, C.lav2);
  fillRect(img, 2, 6, 5, 4, C.mist2); fillRect(img, 2, 6, 5, 1, C.lav3); fillRect(img, 3, 8, 2, 2, C.slate2); put(img, 2, 9, C.slate);
  for (const y of [6, 8, 10, 12]) fillRect(img, 8, y, 6, 1, C.slate2);
  fillRect(img, 2, 11, 5, 1, C.slate2); fillRect(img, 2, 12, 5, 1, C.mist);
  vline_(img, 7, 6, 7, C.cr3);
  fillRect(img, 1, 8, 14, 1, C.cr2); // fold shadow
  put(img, 1, 8, C.cr3);
  return img;
}
const vline_ = (img, x, y, h, hex) => { for (let i = 0; i < h; i++) put(img, x, y + i, hex); };
function flores() {
  // flores: a small bouquet in a cream paper cone: red rose, yellow flower, pink flower and leaves
  const img = icon();
  // paper cone
  shape(img, (x, y) => y >= 8 && y < 15 && Math.abs(x - 8) <= 5.2 - (y - 8) * 0.7, [8, 11, 5, 4], [C.cr3, C.cr2, C.cr1, C.white], { ol: NAVY, t: [0.85, 0.3, -0.2] });
  for (let i = 0; i < 4; i++) put(img, 6 + i, 10 + i, C.cr3);
  fillRect(img, 6, 13, 4, 1, C.r3); put(img, 7, 12, C.r2); put(img, 8, 12, C.r2); // ribbon bow
  // leaves
  for (const [x, y] of [[3, 7], [4, 6], [11, 7], [12, 6], [4, 8], [12, 8]]) put(img, x, y, C.g2);
  for (const [x, y] of [[3, 8], [12, 7]]) put(img, x, y, C.g3);
  // flower heads
  const head = (cx, cy, r, ramp) => shape(img, ell(cx, cy, r, r), [cx, cy, r, r], ramp, { ol: NAVY, t: [0.85, 0.3, -0.2] });
  head(8, 3.8, 2.6, [C.r5, C.r3, C.r2, C.r0]); put(img, 8, 4, C.r5); put(img, 7, 3, C.r1);
  head(4.6, 6, 2.3, [C.y4, C.y3, C.y2, C.y0]); put(img, 4, 6, K.br2);
  head(11.4, 6, 2.3, [C.p3, C.p2, C.p1, C.p0]); put(img, 11, 6, C.r4);
  return img;
}
function banana() {
  // banana: a bunch of three crescents fanned out, yellow with a brown stem and tips
  const img = icon();
  const crescent = (dx, dy) => (x, y) => ell(8 + dx, 6.2 + dy, 7.2, 7)(x, y) && !ell(8 + dx, 3.4 + dy, 7.2, 7)(x, y) && y > 2 + dy;
  for (const [dx, dy, ramp] of [[3, 1.4, [C.y4, C.y3, C.y3, C.y2]], [0, 0.4, [C.y4, C.y3, C.y2, C.y1]], [-3, -0.2, [C.y3, C.y2, C.y1, C.y0]]]) {
    shape(img, crescent(dx, dy), [8 + dx, 8 + dy, 7, 5], ramp, { ol: NAVY, t: [0.86, 0.3, -0.1] });
  }
  // stem where the crescents meet, dark tips
  fillRect(img, 2, 3, 3, 2, K.br2); put(img, 2, 3, K.br1); put(img, 1, 4, NAVY);
  put(img, 13, 5, K.br2); put(img, 14, 5, K.br3);
  return img;
}

// ---------------------------------------------------------------- the feira (Phase 9)
function laranja() {
  // laranja: a round orange with a dimpled highlight, a green leaf and a stem nub
  const img = icon();
  shape(img, ell(8, 9, 6, 5.6), [8, 9, 6, 6], ['#b8501c', '#d9742a', '#f0902f', '#ffb14d'], { ol: NAVY, t: [0.85, 0.3, -0.2] });
  for (const [x, y] of [[6, 8], [9, 10], [11, 8], [7, 12], [10, 12]]) put(img, x, y, '#c4601f');
  put(img, 5, 7, '#ffd08a'); put(img, 6, 6, '#ffd08a');
  fillRect(img, 8, 3, 1, 2, K.br2);
  shape(img, el(11, 3.4, 2.8, 1.4, -0.4), [11, 3, 3, 1.5], [C.g3, C.g2, C.g2, C.g1 ?? C.g2], { ol: NAVY });
  return img;
}
function maca() {
  // maçã: a red apple, two lobes at the top, a stem and a green leaf
  const img = icon();
  const body = (x, y) => ell(5.8, 9.4, 4.2, 5)(x, y) || ell(10.2, 9.4, 4.2, 5)(x, y);
  shape(img, body, [8, 9, 6, 6], [C.r5, C.r3, C.r2, C.r0], { ol: NAVY, t: [0.85, 0.3, -0.2] });
  put(img, 8, 5, NAVY); put(img, 8, 6, C.r5);
  put(img, 5, 7, C.r0); put(img, 5, 8, C.r0); put(img, 6, 7, C.r0);
  fillRect(img, 8, 2, 1, 3, K.br2);
  shape(img, el(11, 3.6, 2.8, 1.4, -0.4), [11, 3, 3, 1.5], [C.g3, C.g2, C.g2, C.g2], { ol: NAVY });
  return img;
}
function alface() {
  // alface: a round head of ruffled green leaves, paler towards the heart
  const img = icon();
  shape(img, ell(8, 8.6, 6.6, 6), [8, 8, 7, 6], [C.g3, C.g2, C.g1 ?? C.g2, C.g0 ?? C.g2], { ol: NAVY, t: [0.85, 0.3, -0.2] });
  shape(img, ell(8, 8.4, 3.6, 3.4), [8, 8, 4, 4], [C.g2, C.g1 ?? C.g2, C.g0 ?? C.g2, '#d6f0a0'], { ol: C.g3 });
  for (const [x, y] of [[3, 7], [4, 11], [12, 11], [13, 7], [8, 3], [6, 13], [10, 13]]) put(img, x, y, C.g3);
  for (const [x, y] of [[7, 7], [8, 8], [9, 9], [7, 9]]) put(img, x, y, '#e8f8b8');
  fillRect(img, 6, 14, 4, 1, K.br3);
  return img;
}
function tomate() {
  // tomate: a glossy red tomato with a green star calyx
  const img = icon();
  shape(img, ell(8, 9.4, 6.4, 5.4), [8, 9, 7, 6], [C.r5, C.r3, C.r2, C.r0], { ol: NAVY, t: [0.85, 0.3, -0.2] });
  put(img, 4, 8, C.r0); put(img, 5, 7, C.r0); put(img, 5, 8, C.r0);
  for (const [x, y] of [[8, 5], [6, 5], [10, 5], [7, 6], [9, 6], [8, 4], [8, 6]]) put(img, x, y, C.g2);
  put(img, 5, 6, C.g3); put(img, 11, 6, C.g3); put(img, 8, 3, C.g3);
  return img;
}
function caldoDeCana() {
  // caldo de cana: a tall glass of pale green-yellow juice with foam and a cane stalk leaning in it
  const img = icon();
  shape(img, (x, y) => y >= 3 && y < 15 && x >= 4 + (y - 3) * 0.1 && x < 12 - (y - 3) * 0.1, [8, 9, 4, 6], [GLASS[0], GLASS[1], GLASS[2], GLASS[3]], { ol: NAVY });
  fillRect(img, 5, 6, 6, 8, '#bfe08a'); fillRect(img, 5, 6, 6, 1, '#f1f7c4'); fillRect(img, 5, 7, 2, 6, '#d9efa0');
  fillRect(img, 9, 8, 2, 5, '#9cc468');
  fillRect(img, 5, 4, 6, 2, '#f4f8e0'); put(img, 6, 4, C.white); put(img, 9, 3, '#f4f8e0');
  // the cane: a dark green stalk with joints
  for (let i = 0; i < 9; i++) { put(img, 10 + (i >> 2), 1 + i, '#4b7a3a'); put(img, 11 + (i >> 2), 1 + i, '#6d9a4a'); }
  put(img, 11, 4, '#2f5230'); put(img, 12, 8, '#2f5230');
  fillRect(img, 4, 14, 8, 1, NAVY);
  return img;
}

export const ICONS = { pao, pao_na_chapa: paoNaChapa, pastel, coxinha, bolo, cafe, cafe_com_leite: cafeComLeite, suco_de_laranja: suco, agua, pao_de_queijo: paoQueijo, misto_quente: misto, guarana, jornal, flores, banana, laranja, maca, alface, tomate, caldo_de_cana: caldoDeCana };

export async function iconParts() {
  return Object.entries(ICONS).map(([id, fn]) => ({ key: `icons/${id}`, img: fn() }));
}
export async function preview() {
  return Object.values(ICONS).map((fn) => fn());
}
void dark; void flat; void box; void sub; void grid;
