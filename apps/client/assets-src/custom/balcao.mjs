// "Correria no Balcão" art: everything that sits on / around the padaria counter in the minigame work area (docs/lifesim/CORRERIA-REDESIGN.md).
// Keys (one sprite per frame, anchors bottom centre unless noted): balcao/item_<id> (12 shelf items, 28x28), tray, tray_full, bag, plate,
// chapa_idle / chapa_sizzle_0..2 / chapa_burnt, coffee_idle / coffee_pour_0..3, register, bell_0..1, tipjar_0..3, patience_0..4, fx/steam_0..3,
// and the espremedor (juicer_*, juice_glass_*, orange_*, laranjas) from juicer.mjs.
// Authored with the padaria's palette: navy outline, light from the upper left, LimeZu ramps (K / C), terracotta / cream / mustard accents.
import { blank, put, fillRect, shape, ell, profile, setPx, hexPx, NAVY, C, K } from './paint.mjs';
import { outlineAround } from './draw.mjs';
import { ICONS } from './icons.mjs';
import { juicerParts } from './juicer.mjs';

// ------------------------------------------------------------------ palette
const CRUST = ['#a9764f', '#c78c59', '#daa463', '#f2bd7a'];
const GOLD = ['#b5754d', '#d9a15a', '#f0c060', '#ffe57b'];
const FRY = ['#a9764f', '#c78c59', '#e0a64a', '#f8d239'];
const STEEL = ['#565972', '#8b8bab', '#b2aecb', '#d8d0e0'];
const GLASS = '#e2f2f3', GLASS2 = '#cce6ec', GLASS3 = '#a4bbd5';
const COFFEE = ['#2a1a14', '#3a2418', '#573c2c', '#6b4b30'];
const BR = '#8f5a2a';

// ------------------------------------------------------------------ small helpers
const el = (cx, cy, rx, ry, a = 0) => (x, y) => {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
};
/** Point-in-polygon on pixel centres. */
const polyP = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
function fillP(img, pred, hex) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (pred(x + 0.5, y + 0.5)) put(img, x, y, hex);
}
const pts = (img, list, hex) => { for (const [x, y] of list) put(img, x, y, hex); };
const R = Math.round;
/** Painted volume without the auto outline (outline is added once at the end with `outlineAround`). */
const vol = (img, pred, box, ramp, t) => shape(img, pred, box, ramp, { outline: false, t });
const done = (img) => outlineAround(img, NAVY);
/** Deterministic speckle: true for ~1 in n pixels. */
const spk = (x, y, n, s = 0) => ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) % n === 0;
const hole = (x, y) => (((x * 31 + y * 17) ^ (x * y)) & 7) === 0;

const ITEM = 28;
const ITEM_ANCHOR = [14, 26];

// ------------------------------------------------------------------ glassware (copo americano & tall tumbler)
/** A straight-sided tumbler: top width wt, bottom width wb, height h, liquid from `level` rows below the rim; liq = [hi, base, shade, surface]. */
function tumbler(img, cx, y0, wt, wb, h, level, liq, opts = {}) {
  const rows = [];
  for (let r = 0; r < h; r++) {
    const w = wt + ((wb - wt) * r) / (h - 1);
    const x0 = Math.round(cx - w / 2);
    const x1 = x0 + Math.round(w) - 1;
    rows.push([x0, x1]);
  }
  rows.forEach(([x0, x1], r) => {
    const y = y0 + r;
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1;
      const baseRow = r >= h - 3;
      let c;
      if (r === 0) c = '#ffffff'; // lit rim
      else if (r === 1) c = edge ? GLASS2 : liq[3]; // liquid surface seen through the open top
      else if (baseRow) c = edge ? GLASS3 : r === h - 3 ? GLASS : GLASS2; // thick glass bottom
      else if (r >= 2 + level) c = edge ? (x === x0 ? '#ffffff' : GLASS3) : x === x0 + 1 ? liq[0] : x >= x1 - 1 ? liq[2] : liq[1];
      else c = edge ? (x === x0 ? '#ffffff' : GLASS3) : x === x1 - 1 ? GLASS2 : GLASS;
      put(img, x, y, c);
    }
  });
  // white glare streak on the lit side
  for (let r = 4; r < h - 5; r++) if (r % 5 !== 3) put(img, rows[r][0] + 1, y0 + r, '#ffffff');
  // foam / crema highlight on the surface
  if (opts.foam) { const [x0, x1] = rows[1]; for (let x = x0 + 1; x < x1; x++) put(img, x, y0 + 1, x < x0 + 3 ? opts.foam[0] : opts.foam[1]); put(img, rows[1][0] + 1, y0 + 2, opts.foam[0]); }
  return rows;
}

// ------------------------------------------------------------------ the twelve shelf items (28x28, anchor [14,26])
const mk = () => blank(ITEM, ITEM);

function itemPao() {
  const img = mk();
  // pão francês: pointed oval, tilted a little
  const a = -0.16, ca = Math.cos(a), sa = Math.sin(a);
  const lemon = (x, y) => {
    const dx = x - 14, dy = y - 16.4;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (Math.abs(u) > 13) return false;
    return Math.abs(v) <= 6.6 * (1 - (Math.abs(u) / 13) ** 1.8) ** 0.7;
  };
  vol(img, lemon, [14, 16, 13, 6.6], CRUST, [0.8, 0.3, -0.2]);
  fillP(img, (x, y) => lemon(x, y) && y > 21, CRUST[0]);
  // crust blisters + flour
  for (let y = 9; y < 24; y++) for (let x = 0; x < 28; x++) {
    if (!lemon(x + 0.5, y + 0.5)) continue;
    if (spk(x, y, 15, 1)) put(img, x, y, CRUST[0]);
    else if (spk(x, y, 21, 2)) put(img, x, y, CRUST[3]);
  }
  // the split: dark gash edges, pale crumb "ear" inside, curved along the loaf
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const x = 4 + i;
    const y = R(17.4 - t * 4.2 - 2.4 * Math.sin(Math.PI * t));
    const mid = t > 0.12 && t < 0.88;
    if (!mid) { put(img, x, y, '#8f5a2a'); continue; }
    put(img, x, y - 1, '#8f5a2a');
    put(img, x, y, '#fff0c4');
    put(img, x, y + 1, '#f0d08a');
    put(img, x, y + 2, '#8f5a2a');
    if (t > 0.3 && t < 0.7) put(img, x, y - 2, '#f9d99a');
  }
  pts(img, [[7, 13], [12, 10], [17, 10], [21, 12], [9, 21], [19, 21]], '#fbf4e0');
  return done(img);
}

function itemPaoNaChapa() {
  const img = mk();
  vol(img, el(14, 21.4, 13, 4.2), [14, 21, 13, 4], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 21.8, 8.4, 2.2), C.lav3); fillP(img, el(14, 21.6, 6.5, 1.5), C.lav4);
  // crust wall
  vol(img, el(14, 16.4, 11.6, 5.2, -0.05), [14, 16, 11.5, 5.4], CRUST, [0.85, 0.3, -0.2]);
  // open toasted face: bright golden crumb with a darker toasted rim
  vol(img, el(14, 13.6, 10.2, 3.7, -0.05), [14, 13.6, 10, 3.6], ['#c8843a', '#e8b058', '#f6cc78', '#fff0b0'], [0.9, 0.35, -0.25]);
  fillP(img, (x, y) => el(14, 13.6, 10.2, 3.7, -0.05)(x, y) && !el(14, 13.6, 8.6, 2.6, -0.05)(x, y) && y < 14.5, '#d89440');
  // grill marks: dark diagonal bars across the face
  for (const x0 of [7, 11, 15, 19]) for (let i = 0; i < 4; i++) { put(img, x0 + i, 15 - i, '#7b4a1e'); if (i > 0 && i < 3) put(img, x0 + i, 14 - i + 0, '#9a5a22'); }
  // melting butter pat with a glossy sheen and runs
  fillP(img, el(13.5, 12.4, 4, 1.8), '#f8d239'); fillP(img, el(13, 12, 2.8, 1.1), '#ffe57b');
  pts(img, [[11, 11], [12, 11], [14, 12]], '#fff9c4'); put(img, 11, 10, '#ffffff'); put(img, 17, 13, '#f8d239'); put(img, 18, 14, '#f8d239'); put(img, 16, 14, '#fff59a');
  pts(img, [[18, 12], [21, 11], [8, 16]], '#fff9c4'); // glisten
  pts(img, [[6, 17], [13, 18], [21, 17]], '#fff2b0');
  pts(img, [[4, 18], [9, 19], [17, 19], [23, 18]], CRUST[0]);
  return done(img);
}

function itemPastel() {
  const img = mk();
  // fried pastel: a flat, blistered half-moon lying on a slant, folded edge crimped with a fork
  const a = -0.24, c = Math.cos(a), s = Math.sin(a);
  const CX = 14, CY = 19;
  const loc = (x, y) => { const dx = x - CX, dy = y - CY; return [dx * c + dy * s, dx * s - dy * c]; };
  const dome = (x, y) => { const [u, v] = loc(x, y); return v >= 0 && (u / 12.8) ** 2 + (v / 11) ** 2 <= 1; };
  const under = (x, y) => { const [u, v] = loc(x, y); return v < 0 && v > -2.6 && (u / 12.6) ** 2 + (v / 2.8) ** 2 <= 1; };
  fillP(img, under, '#a05a24');
  fillP(img, (x, y) => under(x, y) && loc(x, y)[1] < -1.4, '#7b4a1e');
  vol(img, dome, [11, 13, 15, 13], ['#c0782e', '#dc9a40', '#eab04a', '#f8cc62'], [0.92, 0.45, 0.0]);
  // the folded seam: a pale flat band with dark fork grooves
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    if (!dome(x + 0.5, y + 0.5)) continue;
    const [u, v] = loc(x + 0.5, y + 0.5);
    if (v < 3.2) put(img, x, y, Math.floor(u + 30) % 2 === 0 ? '#9a5a22' : v > 1.6 ? '#fbe6a0' : '#f2c868');
    else if (v < 4.0) put(img, x, y, '#ffe9a0');
  }
  // big pale fried bubbles, each with a darker lower lip
  const bub = (x, y) => { if (!dome(x + 1.5, y + 1.5)) return; put(img, x, y, '#fff6c8'); put(img, x + 1, y, '#fff6c8'); put(img, x + 2, y, '#ffe9a0'); put(img, x, y + 1, '#ffe9a0'); put(img, x + 1, y + 1, '#f6cf6a'); put(img, x + 2, y + 1, '#d89a3c'); put(img, x + 1, y + 2, '#c47a2c'); put(img, x + 2, y + 2, '#c47a2c'); };
  for (const [x, y] of [[8, 11], [14, 7], [19, 8], [12, 12], [18, 12], [6, 14], [22, 12], [15, 4]]) bub(x, y);
  pts(img, [[10, 8], [16, 10], [9, 14], [21, 9]], '#c47a2c');
  return done(img);
}

function itemCoxinha() {
  const img = mk();
  const shell = profile(14, [[3, 0.9], [5, 2.6], [9, 6], [14, 9], [20, 11.2], [24, 10], [26, 6]]);
  const pred = (x, y) => shell(x + (y - 14) * 0.2, y);
  vol(img, pred, [12, 15, 11, 12], ['#a8683a', '#d49a4c', '#eebb4e', '#ffe08a'], [0.8, 0.3, -0.28]);
  for (let y = 3; y < 27; y++) for (let x = 0; x < 28; x++) {
    if (!pred(x + 0.5, y + 0.5)) continue;
    if (spk(x, y, 9, 3)) put(img, x, y, '#b5754d');
    else if (spk(x, y, 15, 4)) put(img, x, y, '#fff2b0');
  }
  pts(img, [[13, 3], [14, 3], [13, 4]], '#f8d239'); put(img, 15, 4, '#a9764f');
  for (let i = 0; i < 6; i++) put(img, 8 + (i >> 1), 13 + i, '#fff2b0');
  for (let x = 6; x < 24; x++) if (pred(x + 0.5, 25.5)) put(img, x, 25, '#a9764f');
  return done(img);
}

function itemBolo() {
  const img = mk();
  vol(img, el(14, 22.6, 13, 3.8), [14, 22, 13, 4], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 22.6, 9.2, 2), C.lav4);
  // cut face (front): two carrot-cake layers with a cream filling
  const face = polyP([[5, 12], [22, 12], [22, 22], [5, 22]]);
  fillP(img, face, '#e8943a');
  fillP(img, (x, y) => face(x, y) && x < 8, '#f6b25a');
  fillP(img, (x, y) => face(x, y) && y > 19.5, '#c0702a');
  fillP(img, (x, y) => face(x, y) && y > 21, '#a85a1e');
  fillP(img, (x, y) => face(x, y) && y > 16 && y < 18, '#fbe9bf'); // cream layer
  fillP(img, (x, y) => face(x, y) && y > 16 && y < 17, '#fffbe6');
  for (let y = 13; y < 22; y++) for (let x = 5; x < 22; x++) if (face(x + 0.5, y + 0.5) && !(y > 15 && y < 19) && spk(x, y, 6, 5)) put(img, x, y, '#c0702a');
  pts(img, [[9, 14], [14, 20], [18, 14], [11, 21]], '#f6b25a');
  // chocolate glaze: top triangle + drips down the front
  const top = polyP([[5, 12], [22, 12], [22, 11], [11, 5], [6, 8]]);
  vol(img, top, [14, 9, 10, 5], ['#3a2418', '#573c2c', '#6b3a26', '#8a5236'], [0.9, 0.5, 0.0]);
  fillP(img, top, '#573c2c');
  fillP(img, polyP([[8, 8], [11, 6.4], [17, 9.6], [14, 10.4]]), '#6b3a26');
  pts(img, [[8, 8], [9, 7], [10, 7], [11, 6], [12, 8], [13, 8], [9, 10], [10, 10]], '#8a5236');
  pts(img, [[10, 7], [11, 7], [9, 9]], '#c78c59'); // glossy sparkle on the glaze
  for (let x = 5; x < 22; x++) { put(img, x, 12, '#573c2c'); put(img, x, 13, '#6b3a26'); }
  for (const [x, len] of [[6, 3], [9, 2], [12, 4], [15, 2], [18, 3], [21, 4]]) for (let k = 0; k < len; k++) { put(img, x, 14 + k, '#573c2c'); if (k < len - 1) put(img, x + 1, 14 + k, '#6b3a26'); }
  fillP(img, (x, y) => face(x, y) && x > 21, '#a85a1e');
  put(img, 7, 12, '#8a5236');
  return done(img);
}

function itemCafe() {
  const img = mk();
  // saucer, then a copo americano of black coffee with a hazel crema
  vol(img, el(14, 23.4, 12, 3), [14, 23, 12, 3], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 23.5, 8, 1.7), C.lav3);
  tumbler(img, 14, 5, 14, 11, 18, 1, [COFFEE[3], COFFEE[2], COFFEE[0], '#a9764f'], { foam: ['#e0b870', '#c78c59'] });
  return done(img);
}

function itemCafeComLeite() {
  const img = mk();
  vol(img, el(14, 23.4, 12, 3), [14, 23, 12, 3], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 23.5, 8, 1.7), C.lav3);
  tumbler(img, 14, 5, 14, 11, 18, 1, ['#e0b08a', '#c88a5a', '#a9764f', '#f2d8b0'], { foam: ['#ffffff', '#f8efe0'] });
  // latte swirl of milk on the surface
  pts(img, [[13, 6], [14, 6], [15, 6]], '#ffffff');
  return done(img);
}

function itemSuco() {
  const img = mk();
  vol(img, el(14, 23.6, 11, 2.8), [14, 23, 11, 3], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 23.6, 7, 1.5), C.lav3);
  tumbler(img, 13, 4, 12, 10, 20, 2, ['#ffcf5a', '#f6a021', '#e07a14', '#ffd778'], { foam: ['#fff0a0', '#ffd778'] });
  // pulp
  for (let y = 9; y < 20; y++) for (let x = 8; x < 18; x++) if (spk(x, y, 9, 8)) put(img, x, y, '#ffcf5a');
  // paper straw (red and white stripes) leaning left
  for (let i = 0; i < 14; i++) { const c = (i >> 1) % 2 ? '#f8f8f8' : '#d93232'; put(img, 11 - (i >> 2), 2 + i - (i > 3 ? 0 : 0), c); put(img, 12 - (i >> 2), 2 + i, c); }
  // an orange wheel on the rim
  const cx = 20, cy = 6;
  vol(img, el(cx, cy, 4.6, 4.6), [cx, cy, 4.6, 4.6], ['#e07a14', '#f6a021', '#ffb43a', '#ffd778'], [0.9, 0.4, -0.1]);
  fillP(img, el(cx, cy, 3.4, 3.4), '#fff2d0');
  fillP(img, el(cx, cy, 2.6, 2.6), '#f6a021');
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]]) put(img, cx + dx, cy + dy, '#ffcf5a');
  put(img, cx, cy, '#fff2d0');
  return done(img);
}

function itemAgua() {
  const img = mk();
  const body = profile(14, [[2, 1.2], [4, 1.6], [6, 2.2], [8, 3], [10, 4.8], [12, 5.6], [24, 5.8], [25, 4.4]]);
  fillP(img, body, GLASS);
  // water inside (below the shoulder) with depth shading toward the right
  fillP(img, (x, y) => body(x, y) && y > 7.5, '#bfe4f4');
  fillP(img, (x, y) => body(x, y) && y > 7.5 && x > 15.5, '#8fcbea');
  fillP(img, (x, y) => body(x, y) && y > 7.5 && x < 10.5, '#dcf3fb');
  // blue cap + neck ring
  fillRect(img, 12, 1, 4, 3, '#3d56d2'); fillRect(img, 12, 1, 1, 3, '#4f7ae8'); fillRect(img, 15, 1, 1, 3, '#2a3fa8');
  for (let x = 12; x < 16; x += 1) if (x % 2 === 0) put(img, x, 2, '#2a3fa8');
  fillRect(img, 11, 4, 6, 1, '#8fa1c8');
  // wrap-around label: blue band with a wave
  fillRect(img, 8, 14, 12, 6, '#4280dd'); fillRect(img, 8, 14, 12, 1, '#6aa0f0'); fillRect(img, 8, 19, 12, 1, '#2f5fb8');
  for (let x = 9; x < 19; x++) put(img, x, 16 + (((x >> 1) % 2) ? 1 : 0), '#f8f8f8');
  put(img, 12, 17, '#95e3e3'); put(img, 15, 18, '#95e3e3');
  // ribs near the base, glare along the lit side
  for (const y of [22, 24]) for (let x = 9; x < 19; x++) put(img, x, y, x % 2 ? '#8fcbea' : '#dcf3fb');
  for (let y = 9; y < 22; y++) if (y < 14 || y > 19) put(img, 9, y, '#ffffff');
  for (let y = 6; y < 12; y++) put(img, 12, y, '#ffffff');
  // water level line and bubbles
  for (let x = 11; x < 17; x++) put(img, x, 8, '#f0fbff');
  pts(img, [[12, 12], [16, 11], [17, 21]], '#f0fbff');
  return done(img);
}

function itemPaoDeQueijo() {
  const img = mk();
  vol(img, el(14, 21.2, 13, 4.6), [14, 21, 13, 4.6], ['#a82b2d', '#d93232', '#e63f38', '#ff8575'], [0.85, 0.3, -0.1]);
  for (let y = 16; y < 27; y++) for (let x = 1; x < 27; x++) {
    if (!el(14, 21.2, 12.5, 4.1)(x + 0.5, y + 0.5)) continue;
    const a = ((x >> 1) + (y >> 1)) % 2 === 0;
    put(img, x, y, a ? '#f8f2e4' : '#e63f38');
  }
  const balls = [[14, 10.2, 4.7], [8.2, 14.6, 4.7], [19.8, 14.8, 4.7], [14, 17.4, 4.7]];
  balls.forEach(([cx, cy, r], bi) => {
    shape(img, el(cx, cy, r, r * 0.96), [cx, cy, r, r], GOLD, { ol: '#7b4a1e', t: [0.85, 0.4, -0.05] });
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!el(cx, cy, r, r * 0.96)(x + 0.5, y + 0.5)) continue;
      if (spk(x, y, 8, bi + 9)) put(img, x, y, '#b5754d');
      else if (spk(x, y, 12, bi + 2)) put(img, x, y, '#fff2b0');
    }
    put(img, R(cx - r * 0.45), R(cy - r * 0.5), '#fff9c4'); put(img, R(cx - r * 0.2), R(cy - r * 0.6), '#fff9c4');
  });
  return done(img);
}

function sandwichHalf(img, ox, oy, shade = 0) {
  const W = 16;
  const f = (x, y, w, h, c) => fillRect(img, ox + x, oy + y, w, h, c);
  // top face (toasted, grill marks) = parallelogram sloping to the back-right
  fillP(img, polyP([[ox + 0, oy], [ox + W, oy], [ox + W + 4, oy - 4], [ox + 4, oy - 4]]), '#e2a24c');
  fillP(img, polyP([[ox + 0, oy], [ox + 4, oy - 4], [ox + 9, oy - 4], [ox + 5, oy]]), '#f0c070');
  for (const k of [3, 7, 11]) { for (let i = 0; i < 3; i++) put(img, ox + k + i + 1, oy - i, BR); }
  // right side face (crust edge)
  fillP(img, polyP([[ox + W, oy], [ox + W + 4, oy - 4], [ox + W + 4, oy + 5], [ox + W, oy + 9]]), '#a9764f');
  // front cut face: bread / cheese / ham / cheese / bread
  f(0, 0, W, 3, '#daa463'); f(0, 0, W, 1, '#8f5a2a'); f(1, 1, W - 2, 1, '#f2c27a');
  f(0, 3, W, 2, '#f8d239'); f(0, 3, W, 1, '#fff2a0');
  f(0, 5, W, 2, '#e07a7a'); f(0, 5, W, 1, '#ffa0a0'); f(0, 6, W, 1, '#c85a5a');
  f(0, 7, W, 1, '#f8d239');
  f(0, 8, W, 3, '#daa463'); f(0, 10, W, 1, '#8f5a2a'); f(1, 8, 2, 1, '#f2c27a');
  // melted cheese drips over the ham and the lower bread
  for (const [x, l] of [[2, 3], [6, 2], [10, 4], [13, 2]]) for (let k = 0; k < l; k++) put(img, ox + x, oy + 7 + k, k === l - 1 ? '#f0b82a' : '#f8d239');
  pts(img, [[ox + 4, oy + 1], [ox + 9, oy + 1], [ox + 12, oy + 9], [ox + 6, oy + 9]], '#c78c59'); // toast speckle
  void shade;
}
function itemMisto() {
  const img = mk();
  vol(img, el(14, 24.2, 13, 2.6), [14, 24, 13, 3], [C.lav, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  sandwichHalf(img, 7, 10);
  sandwichHalf(img, 1, 14);
  return done(img);
}

function itemGuarana() {
  const img = mk();
  const G = ['#2c5f33', '#3f8f3a', '#64b63b', '#a6d84e'];
  const x0 = 9, x1 = 19;
  for (let y = 6; y < 25; y++) for (let x = x0; x < x1; x++) {
    const k = x - x0;
    put(img, x, y, k <= 0 ? G[2] : k === 1 ? G[3] : k <= 5 ? G[2] : k <= 7 ? G[1] : G[0]);
  }
  for (let y = 7; y < 24; y += 1) put(img, x0 + 2, y, y % 6 === 3 ? G[2] : '#c8ea78');
  fillP(img, el(14, 5.4, 5.2, 2.2), '#8b8bab'); fillP(img, el(14, 5.2, 4.2, 1.5), '#d8d0e0'); fillP(img, el(13.6, 5.2, 2.4, 0.8), '#f8f8f8');
  pts(img, [[15, 5], [16, 5]], '#565972'); put(img, 13, 4, '#ffffff');
  fillRect(img, x0, 6, 10, 1, '#b2aecb'); fillRect(img, x0 + 8, 6, 2, 1, '#8b8bab');
  fillRect(img, x0, 24, 10, 1, '#8b8bab'); fillRect(img, x0, 24, 3, 1, '#b2aecb');
  // generic label: sun-yellow wave bands and a round red berry on a cream disc (no brand, no letters)
  for (let x = x0; x < x1; x++) { const w = ((x >> 1) % 2) ? 0 : 1; put(img, x, 9 + w, '#f8d239'); put(img, x, 10 + w, '#ffe57b'); put(img, x, 20 + (1 - w), '#f8d239'); }
  fillP(img, el(14, 15, 4, 4), '#f8efe0'); fillP(img, el(14, 15, 3.4, 3.4), '#fbf4e6');
  vol(img, el(14, 15, 2.8, 2.8), [14, 15, 2.8, 2.8], ['#9e2b2d', '#d93232', '#fc5c46', '#ff8575'], [0.85, 0.4, -0.1]);
  put(img, 13, 14, '#ffd0c8'); put(img, 15, 16, '#9e2b2d');
  fillRect(img, 14, 11, 1, 1, '#3f8f3a'); put(img, 15, 11, '#2c5f33');
  return done(img);
}

const ITEM_FNS = {
  pao: itemPao, pao_na_chapa: itemPaoNaChapa, pastel: itemPastel, coxinha: itemCoxinha, bolo: itemBolo, cafe: itemCafe,
  cafe_com_leite: itemCafeComLeite, suco_de_laranja: itemSuco, agua: itemAgua, pao_de_queijo: itemPaoDeQueijo, misto_quente: itemMisto, guarana: itemGuarana,
};

// ------------------------------------------------------------------ tray, tray with food, paper bag, plate
function trayBase(img, y0) {
  // steel tray seen from the front-top: raised rim, pale floor, grip cut-outs at both ends, a rolled front lip
  const W = img.w;
  fillP(img, polyP([[1, y0 + 2], [W - 1, y0 + 2], [W - 3, y0 + 10], [3, y0 + 10]]), STEEL[2]);
  fillP(img, polyP([[3, y0 + 3], [W - 3, y0 + 3], [W - 5, y0 + 9], [5, y0 + 9]]), STEEL[3]);
  for (let x = 5; x < W - 5; x++) if (x % 7 === 3) put(img, x, y0 + 6, '#f0ebf6'); // faint floor sheen
  fillRect(img, 1, y0 + 2, W - 2, 1, '#f8f8f8'); // lit back rim
  fillP(img, polyP([[3, y0 + 10], [W - 3, y0 + 10], [W - 3, y0 + 12], [3, y0 + 12]]), STEEL[1]);
  fillRect(img, 3, y0 + 10, W - 6, 1, STEEL[2]);
  fillRect(img, 4, y0 + 12, W - 8, 1, STEEL[0]);
  fillRect(img, 2, y0 + 3, 1, 7, STEEL[1]); fillRect(img, W - 3, y0 + 3, 1, 7, STEEL[0]);
  fillRect(img, 4, y0 + 7, 3, 1, STEEL[0]); fillRect(img, W - 7, y0 + 7, 3, 1, STEEL[0]);
  // a red-white paper napkin under the lip? no: a thin terracotta stripe on the rim front (padaria colours)
  fillRect(img, 6, y0 + 11, W - 12, 1, '#c45c26');
}
function tray() {
  const img = blank(64, 16);
  trayBase(img, 1);
  return done(img);
}
function trayFull() {
  const img = blank(64, 34);
  const y0 = 19;
  trayBase(img, y0);
  const put16 = (fn, x, y) => {
    const ic = fn();
    for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
      const i = (yy * 16 + xx) * 4;
      if (ic.data[i + 3] === 0) continue;
      const tx = x + xx, ty = y + yy;
      const di = (ty * img.w + tx) * 4;
      img.data[di] = ic.data[i]; img.data[di + 1] = ic.data[i + 1]; img.data[di + 2] = ic.data[i + 2]; img.data[di + 3] = 255;
    }
  };
  put16(ICONS.pastel, 6, y0 - 7);
  put16(ICONS.pao, 21, y0 - 8);
  put16(ICONS.cafe, 38, y0 - 9);
  return done(img);
}

function bag() {
  const img = blank(24, 30);
  const kraft = ['#a9764f', '#c78c59', '#daa463', '#e8b87a'];
  // loaves poking out of the top
  fillP(img, polyP([[6, 9], [9, 1], [12, 1], [11, 9]]), '#daa463'); fillRect(img, 9, 1, 1, 6, '#f2bd7a'); pts(img, [[10, 3], [10, 5]], '#a9764f');
  fillP(img, polyP([[12, 9], [14, 3], [17, 4], [16, 9]]), '#c78c59'); put(img, 15, 5, '#f2bd7a');
  fillP(img, polyP([[3, 9], [20, 9], [20, 29], [3, 29]]), kraft[2]);
  // side gusset (right, darker) and light on the left edge
  fillRect(img, 17, 9, 3, 20, kraft[0]); fillRect(img, 17, 9, 1, 20, kraft[1]);
  fillRect(img, 3, 9, 2, 20, kraft[3]);
  // folded-over lip at the top with a crease
  fillRect(img, 3, 9, 17, 4, kraft[3]); fillRect(img, 3, 12, 17, 1, kraft[1]); fillRect(img, 3, 9, 17, 1, '#f5d49a');
  fillRect(img, 17, 9, 3, 4, kraft[2]);
  // crinkle shading on the front
  for (const [x, y, h] of [[8, 14, 4], [12, 18, 5], [6, 22, 3], [14, 23, 4]]) { fillRect(img, x, y, 1, h, kraft[1]); }
  // label: cream band with a terracotta stripe and a tiny wheat ear
  fillRect(img, 3, 17, 14, 7, '#f8efe0'); fillRect(img, 3, 17, 14, 1, '#ffffff'); fillRect(img, 3, 23, 14, 1, '#dcc7ac');
  fillRect(img, 3, 18, 14, 1, '#c45c26'); fillRect(img, 3, 22, 14, 1, '#c45c26');
  const wheat = [[9, 19], [10, 19], [8, 20], [9, 20], [10, 20], [11, 20], [9, 21], [10, 21]];
  pts(img, wheat, '#d4a017'); pts(img, [[6, 20], [7, 20], [12, 20], [13, 20]], '#d4a017'); put(img, 8, 19, '#f2c230'); put(img, 11, 19, '#f2c230');
  fillRect(img, 3, 27, 14, 2, kraft[0]); fillRect(img, 17, 27, 3, 2, '#8f5a2a');
  return done(img);
}

function plate() {
  const img = blank(28, 12);
  vol(img, el(14, 7, 13, 4.6), [14, 6.5, 13, 4.6], [C.lav2, C.lav3, C.lav4, C.white], [0.85, 0.35, -0.1]);
  fillP(img, el(14, 7.2, 10, 3.2), '#4995e3');
  fillP(img, el(14, 7.2, 9.2, 2.7), C.lav4);
  vol(img, el(14, 7.6, 7.6, 2.1), [14, 7.4, 7.6, 2.1], [C.lav3, C.lav4, C.white, C.white], [0.9, 0.4, -0.1]);
  fillP(img, el(14, 6.6, 12, 3.4), '#f8f8f8');
  fillP(img, (x, y) => el(14, 7.0, 12.6, 4.2)(x, y) && !el(14, 7.0, 9.8, 2.9)(x, y) && y < 7.5, '#ffffff');
  fillP(img, (x, y) => el(14, 7.2, 10.2, 3.1)(x, y) && !el(14, 7.2, 9.4, 2.7)(x, y) && y >= 6, '#4995e3');
  fillP(img, el(14, 7.4, 8.6, 2.4), C.lav4);
  put(img, 9, 6, '#ffffff'); put(img, 10, 5, '#ffffff');
  fillP(img, (x, y) => el(14, 8.6, 12.6, 3.4)(x, y) && !el(14, 7.6, 12.4, 3.6)(x, y), C.lav2);
  return done(img);
}

// ------------------------------------------------------------------ chapa (griddle with a hinged press)
function chapaBody(img, { lid = true } = {}) {
  const W = 40;
  // cabinet
  fillP(img, polyP([[2, 24], [W - 2, 24], [W - 2, 34], [2, 34]]), STEEL[1]);
  fillRect(img, 2, 24, W - 4, 2, STEEL[3]); fillRect(img, 2, 26, W - 4, 1, STEEL[2]);
  fillRect(img, 2, 24, 2, 10, STEEL[2]); fillRect(img, W - 4, 24, 2, 10, STEEL[0]);
  fillRect(img, 2, 32, W - 4, 2, STEEL[0]);
  for (const [x, c] of [[9, '#d93232'], [15, '#2c2c34'], [21, '#2c2c34']]) { fillP(img, el(x, 29.5, 2.6, 2.6), '#d8d0e0'); fillP(img, el(x, 29.5, 1.8, 1.8), c); put(img, x - 1, 28, c === '#d93232' ? '#ff8575' : '#6c6e85'); put(img, x + 1, 31, STEEL[0]); }
  fillRect(img, 27, 27, 9, 5, '#2c2c34'); fillRect(img, 28, 28, 7, 3, '#46251a'); put(img, 29, 29, '#ff8a2a'); put(img, 30, 29, '#ffb45a'); put(img, 33, 29, '#ffb45a'); put(img, 32, 30, '#d93232');
  fillRect(img, 4, 35, 4, 1, STEEL[0]); fillRect(img, W - 8, 35, 4, 1, STEEL[0]);
  // griddle: raised back splash, a big dark seasoned plate with a front lip + grease gutter
  fillRect(img, 3, 11, W - 6, 3, STEEL[1]); fillRect(img, 3, 11, W - 6, 1, STEEL[3]); fillRect(img, 3, 13, W - 6, 1, STEEL[0]);
  fillP(img, polyP([[2, 14], [W - 2, 14], [W - 1, 24], [1, 24]]), '#565972');
  fillRect(img, 3, 14, W - 6, 8, '#6c6e85');
  fillRect(img, 3, 14, W - 6, 1, '#565972');
  for (let y = 15; y < 22; y++) for (let x = 4; x < W - 4; x++) if (spk(x, y, 8, 1)) put(img, x, y, '#5a5d78');
  // grease shine streaks
  fillRect(img, 5, 16, 6, 1, '#a2a6be'); fillRect(img, 6, 15, 3, 1, '#d8d0e0'); fillRect(img, 26, 20, 7, 1, '#a2a6be'); fillRect(img, 28, 19, 3, 1, '#d8d0e0');
  pts(img, [[12, 21], [34, 17], [8, 19], [31, 15]], '#fff0b8');
  fillRect(img, 3, 22, W - 6, 1, '#4a4c63');
  fillRect(img, 2, 23, W - 4, 1, STEEL[3]); fillRect(img, 2, 24, W - 4, 0, STEEL[2]);
  fillRect(img, 34, 15, 3, 3, '#4a4c63'); fillRect(img, 34, 15, 3, 1, '#2f3045');
  if (lid) {
    // the press, hinged at the back and propped open: ribbed underside facing us, black handle on top
    fillP(img, polyP([[8, 2], [32, 2], [35, 11], [5, 11]]), '#46465e');
    fillP(img, polyP([[9, 3], [31, 3], [33, 10], [7, 10]]), '#565972');
    for (let i = 0; i < 4; i++) { const y = 4 + i * 2; fillRect(img, R(9 - i * 0.5), y, R(22 + i), 1, '#6c6e85'); }
    fillRect(img, 8, 2, 24, 1, '#8b8bab'); fillRect(img, 5, 10, 30, 1, '#8b8bab');
    fillRect(img, 13, 0, 14, 2, '#2c2c34'); fillRect(img, 13, 0, 14, 1, '#6c6e85');
    fillRect(img, 13, 2, 2, 1, '#2c2c34'); fillRect(img, 25, 2, 2, 1, '#2c2c34');
  }
}
/** A split bread roll (cut side down) on the plate. toast 0..3: pale, golden, deep, burnt. */
function breadOnChapa(img, toast) {
  const ramps = [
    ['#a9764f', '#c78c59', '#daa463', '#f2bd7a'],
    ['#8f5a2a', '#c28a3c', '#e8b050', '#fbd070'],
    ['#5a2e12', '#8a4a1c', '#a8622a', '#c88438'],
    ['#14141a', '#1f1a1c', '#2a2024', '#3c2e30'],
  ][toast];
  const lemon = (x, y) => { const u = x - 20; if (Math.abs(u) > 11.4) return false; return Math.abs(y - 18.4) <= 4.4 * (1 - (Math.abs(u) / 11.4) ** 1.8) ** 0.7; };
  vol(img, lemon, [20, 18.2, 11.4, 4.6], ramps, [0.82, 0.3, -0.2]);
  fillP(img, (x, y) => lemon(x, y) && y > 20.6, ramps[0]);
  if (toast < 3) {
    // slash + butter shine
    for (let x = 13; x < 28; x++) { const y = R(18 - 1.6 * Math.sin(((x - 13) / 14) * Math.PI)); put(img, x, y, toast === 0 ? '#fff0c4' : toast === 1 ? '#fbe29a' : '#d89c58'); }
    pts(img, [[15, 17], [18, 16], [23, 16], [26, 18]], '#fff9c4');
    for (let x = 14; x < 27; x += 3) put(img, x, 20, toast === 2 ? '#3a1c0a' : '#8f5a2a');
  } else {
    pts(img, [[15, 17], [19, 16], [24, 18], [17, 19], [22, 20]], '#46465e');
  }
}
function chapaIdle() {
  const img = blank(40, 36);
  chapaBody(img);
  return done(img);
}
const BUBBLES = [
  [[8, 18], [10, 21], [30, 19], [32, 17], [27, 22], [14, 22]],
  [[7, 17], [11, 22], [31, 20], [33, 18], [25, 22], [16, 23]],
  [[9, 20], [13, 22], [32, 16], [28, 22], [34, 20], [6, 19]],
];
function chapaSizzle(k) {
  const img = blank(40, 36);
  chapaBody(img);
  breadOnChapa(img, k);
  // bubbling butter around the loaf: bright bubbles with a lit rim, plus sparks flying off
  for (const [x, y] of BUBBLES[k]) { put(img, x, y, '#ffffff'); put(img, x + 1, y, '#fff59a'); put(img, x, y + 1, '#fff59a'); put(img, x + 1, y + 1, '#ffd24a'); }
  for (const [x, y] of [[[17, 12], [25, 13]], [[19, 11], [23, 12]], [[16, 13], [27, 12]]][k]) put(img, x, y, '#fff59a');
  for (const [x, y] of [[[18, 11]], [[21, 10]], [[20, 12]]][k]) put(img, x, y, '#ffffff');
  return done(img);
}
function chapaBurnt() {
  const img = blank(40, 36);
  chapaBody(img);
  breadOnChapa(img, 3);
  const smoke = [[18, 12, '#6c6e85'], [19, 11, '#8b8bab'], [20, 10, '#6c6e85'], [21, 9, '#565972'], [19, 9, '#8b8bab'], [22, 11, '#6c6e85'], [21, 7, '#6c6e85'], [20, 8, '#565972'], [22, 6, '#8b8bab'], [21, 13, '#565972'], [17, 13, '#8b8bab'], [23, 8, '#565972'], [24, 12, '#6c6e85'], [25, 10, '#8b8bab']];
  for (const [x, y, c] of smoke) { put(img, x, y, c); put(img, x + 1, y, c); }
  pts(img, [[15, 18], [26, 20], [12, 19]], '#ff8a2a');
  return done(img);
}

// ------------------------------------------------------------------ coffee machine (classic padaria espresso, red enamel + chrome)
function coffeeBody(img) {
  // cup warmer rail with three little white cups (spaced so each reads as a cup)
  fillRect(img, 3, 4, 28, 2, STEEL[3]); fillRect(img, 3, 4, 28, 1, '#ffffff'); fillRect(img, 3, 6, 28, 1, STEEL[1]);
  for (const x of [6, 13, 20]) { fillRect(img, x, 1, 5, 3, '#f8f8f8'); fillRect(img, x, 1, 5, 1, '#ffffff'); fillRect(img, x + 4, 2, 1, 2, C.lav3); fillRect(img, x + 5, 2, 1, 1, '#c6bdd5'); put(img, x + 1, 2, '#d8d0e0'); }
  // main enamel body (red) with chrome posts
  fillRect(img, 2, 7, 30, 16, '#a82b2d');
  fillRect(img, 3, 8, 28, 14, '#d93232');
  fillRect(img, 3, 8, 28, 2, '#fc5c46'); fillRect(img, 3, 8, 3, 14, '#e63f38'); fillRect(img, 28, 8, 3, 14, '#b02424');
  fillRect(img, 2, 7, 30, 1, '#ff8575');
  fillRect(img, 2, 7, 2, 16, STEEL[3]); fillRect(img, 30, 7, 2, 16, STEEL[1]); fillRect(img, 2, 7, 1, 16, '#ffffff');
  // gauge, buttons, brand plate
  fillP(img, el(9.5, 13, 3.6, 3.6), '#f8f2e4'); fillP(img, el(9.5, 13, 3, 3), '#ffffff');
  fillP(img, (x, y) => el(9.5, 13, 3.6, 3.6)(x, y) && !el(9.5, 13, 3, 3)(x, y), STEEL[1]);
  put(img, 10, 12, '#d93232'); put(img, 11, 11, '#d93232'); put(img, 9, 14, '#565972'); put(img, 8, 12, '#c6bdd5'); put(img, 10, 15, '#c6bdd5');
  fillRect(img, 17, 11, 2, 2, '#4fa04a'); put(img, 17, 11, '#8ff0a4'); fillRect(img, 21, 11, 2, 2, '#f2c230'); put(img, 21, 11, '#fff59a');
  fillRect(img, 17, 16, 11, 4, '#f8efe0'); fillRect(img, 17, 16, 11, 1, '#ffffff'); fillRect(img, 17, 19, 11, 1, '#dcc7ac');
  for (let x = 19; x < 27; x += 2) fillRect(img, x, 17, 1, 2, '#c45c26');
  // chrome group head and the spout
  fillRect(img, 10, 23, 14, 3, STEEL[1]); fillRect(img, 10, 23, 14, 1, STEEL[3]); fillRect(img, 10, 25, 14, 1, STEEL[0]);
  fillRect(img, 15, 26, 4, 2, STEEL[0]); fillRect(img, 15, 26, 1, 2, STEEL[2]);
  // portafilter handle
  fillRect(img, 21, 26, 7, 2, '#2c2c34'); fillRect(img, 21, 26, 7, 1, '#565972'); fillRect(img, 26, 27, 2, 2, '#2c2c34');
  // steam wand
  fillRect(img, 32, 15, 1, 15, STEEL[2]); fillRect(img, 33, 15, 1, 15, STEEL[0]); fillRect(img, 31, 29, 3, 1, STEEL[1]); put(img, 31, 30, STEEL[0]);
  // two red legs leave a clear cup bay between them
  fillRect(img, 3, 23, 5, 16, '#cf3030'); fillRect(img, 3, 23, 1, 16, '#e63f38'); fillRect(img, 7, 23, 1, 16, '#a82b2d');
  fillRect(img, 26, 23, 5, 16, '#cf3030'); fillRect(img, 26, 23, 1, 16, '#e63f38'); fillRect(img, 30, 23, 1, 16, '#a82b2d');
  // drip tray with a grille
  fillRect(img, 1, 39, 32, 3, STEEL[1]); fillRect(img, 1, 39, 32, 1, STEEL[3]); fillRect(img, 1, 41, 32, 1, STEEL[0]);
  for (let x = 4; x < 30; x += 2) put(img, x, 40, STEEL[0]);
  // back panel behind the cup bay: dark so the glass pops
  fillRect(img, 8, 28, 18, 11, '#7e2024');
  fillRect(img, 8, 28, 18, 1, '#561418');
}
function coffeeFrame(k) {
  const img = blank(34, 42);
  coffeeBody(img);
  if (k < 0) return done(img);
  const lvl = [0, 2, 4, 6][k];
  const x0 = 11, x1 = 23, top = 30, bot = 40; // a copo americano 12 wide, 10 tall
  for (let y = top; y < bot; y++) for (let x = x0; x < x1; x++) {
    const edge = x === x0 || x === x1 - 1;
    const rowFromBottom = bot - 1 - y;
    let c = edge ? (x === x0 ? '#ffffff' : GLASS3) : x === x0 + 1 ? '#f0fbff' : GLASS;
    if (y >= bot - 2) c = edge ? GLASS3 : GLASS2;
    else if (rowFromBottom >= 2 && rowFromBottom < 2 + lvl && !edge) c = x < x0 + 3 ? COFFEE[3] : x > x1 - 4 ? COFFEE[0] : COFFEE[2];
    put(img, x, y, c);
  }
  fillRect(img, x0, top, x1 - x0, 1, '#ffffff');
  if (lvl > 0) { const y = bot - 2 - lvl; for (let x = x0 + 1; x < x1 - 1; x++) put(img, x, y, x < x0 + 3 ? '#e0b870' : '#c78c59'); }
  const sx = 16;
  const surface = lvl > 0 ? bot - 2 - lvl : bot - 3;
  if (k < 3) { for (let y = 28; y < surface; y++) { put(img, sx, y, COFFEE[2]); put(img, sx + 1, y, COFFEE[3]); } }
  else { put(img, sx, 28, COFFEE[2]); put(img, sx, 30, COFFEE[3]); }
  if (k === 0) { put(img, 15, bot - 3, COFFEE[2]); put(img, 16, bot - 3, COFFEE[2]); put(img, 17, bot - 3, COFFEE[3]); }
  return done(img);
}

// ------------------------------------------------------------------ register
function register() {
  const img = blank(26, 24);
  // base unit with the drawer, then the sloped key deck, then the display on a stand
  fillRect(img, 2, 14, 22, 9, '#cdbfa6'); fillRect(img, 2, 14, 22, 1, '#e8dcc4'); fillRect(img, 2, 22, 22, 1, '#9c8b74');
  fillRect(img, 2, 14, 2, 9, '#e8dcc4'); fillRect(img, 22, 14, 2, 9, '#a89a80');
  fillRect(img, 5, 19, 16, 3, '#a89a80'); fillRect(img, 5, 19, 16, 1, '#8c7e66'); fillRect(img, 11, 20, 4, 1, NAVY);
  // key deck
  fillP(img, polyP([[3, 9], [23, 9], [24, 14], [2, 14]]), '#e8dcc4'); fillRect(img, 3, 9, 20, 1, '#fbf4e6');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const x = 5 + c * 3, y = 10 + r;
    put(img, x, y, c === 5 ? '#c45c26' : c === 4 && r === 2 ? '#4fa04a' : '#f8f8f8');
    put(img, x + 1, y, c === 5 ? '#a94a24' : '#d8d0e0');
  }
  // display housing + green screen with digits
  fillRect(img, 6, 1, 15, 8, '#3a3a50'); fillRect(img, 7, 1, 13, 7, '#e8dcc4'); fillRect(img, 7, 1, 13, 1, '#fbf4e6');
  fillRect(img, 8, 2, 11, 5, '#2f4a3f'); fillRect(img, 8, 2, 11, 1, '#24392f');
  for (const x of [9, 12, 15]) { fillRect(img, x, 3, 2, 1, '#8ff0a4'); put(img, x, 4, '#8ff0a4'); fillRect(img, x, 5, 2, 1, '#8ff0a4'); put(img, x + 1, 5, '#4fa04a'); }
  put(img, 17, 5, '#8ff0a4');
  fillRect(img, 21, 3, 1, 4, '#c45c26'); // cash-call button
  // receipt paper curling out of the back
  fillRect(img, 22, 0, 3, 5, '#f8f8f8'); put(img, 24, 0, '#d8d0e0'); put(img, 23, 1, '#c6bdd5'); put(img, 22, 3, '#d8d0e0'); put(img, 24, 4, '#c6bdd5');
  fillRect(img, 22, 0, 1, 5, '#ffffff');
  return done(img);
}

// ------------------------------------------------------------------ bell (still / rung)
function bell(rung) {
  const img = blank(22, 16);
  const y = rung ? 1 : 0;
  // wooden base disc
  vol(img, el(11, 12.4, 8, 2.4), [11, 12, 8, 2.6], ['#573c2c', '#8b5e3c', '#c78c59', '#daa463'], [0.85, 0.35, -0.1]);
  // brass dome (half ellipse)
  const dome = (x, yy) => el(11, 11, 6.4, 6.4)(x, yy + 0 - 0) && yy <= 11.4;
  vol(img, (x, yy) => dome(x, yy - y), [11, 8 + y, 6.4, 5.4], ['#a85f46', '#ed931e', '#f8d239', '#fff59a'], [0.78, 0.25, -0.2]);
  fillRect(img, 4, 11 + y, 14, 1, '#a85f46');
  // plunger button on top
  fillRect(img, 10, 3 + y + (rung ? 1 : 0), 3, 2, '#d8d0e0'); put(img, 10, 3 + y + (rung ? 1 : 0), '#ffffff'); put(img, 11, 2 + y + (rung ? 1 : 0), '#b2aecb');
  fillRect(img, 10, 5 + y, 3, 1, '#565972');
  put(img, 8, 6 + y, '#ffffff'); put(img, 8, 7 + y, '#fff59a');
  if (rung) {
    // vibration ticks on both sides + a "ding" sparkle
    for (const [dx, dy] of [[0, 0], [1, 2], [0, 4]]) { put(img, 3 - dx, 4 + dy, '#fff59a'); put(img, 18 + dx, 4 + dy, '#fff59a'); }
    pts(img, [[2, 7], [19, 7]], '#ffe57b');
    put(img, 17, 0, '#ffffff'); put(img, 17, 1, '#fff59a'); put(img, 16, 1, '#fff59a'); put(img, 18, 1, '#fff59a'); put(img, 17, 2, '#fff59a');
  }
  return done(img);
}

// ------------------------------------------------------------------ tip jar, 4 fill states
function tipjar(level) {
  const img = blank(20, 24);
  const x0 = 3, x1 = 16, top = 5, bot = 22;
  for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1;
    let c = edge ? (x === x0 ? '#ffffff' : GLASS3) : x === x0 + 1 ? '#f0fbff' : x >= x1 - 1 ? GLASS2 : GLASS;
    if (y >= bot - 1) c = edge ? GLASS3 : GLASS2;
    put(img, x, y, c);
  }
  // stacked coins (3x2, gold or silver, lit top-left) and folded notes
  const coin = (x, y, silver) => { const [hi, md, lo] = silver ? ['#ffffff', '#d8d0e0', '#8b8bab'] : ['#fff59a', '#f8d239', '#b8861a']; put(img, x, y, hi); put(img, x + 1, y, md); put(img, x + 2, y, md); put(img, x, y + 1, md); put(img, x + 1, y + 1, lo); put(img, x + 2, y + 1, lo); };
  const pile = (yTop) => { let r = 0; for (let y = bot - 3; y >= yTop; y -= 2, r++) for (let x = x0 + 1 + (r % 2); x + 2 < x1; x += 3) coin(x, y, ((x * 5 + y * 3) % 4) === 0); };
  const note = (x, y, w, h, c, c2, c3) => { fillRect(img, x, y, w, h, c); fillRect(img, x, y, w, 1, c2); fillRect(img, x, y + h - 1, w, 1, c3); put(img, x + (w >> 1), y + (h >> 1), c2); };
  if (level === 0) { coin(6, bot - 3, false); coin(10, bot - 3, true); }
  if (level === 1) pile(bot - 7);
  if (level === 2) { pile(bot - 11); note(5, 9, 8, 3, '#6fae6a', '#a6d890', '#3f7a3a'); note(8, 7, 6, 3, '#4995e3', '#95e3e3', '#2f5fb8'); }
  if (level === 3) { pile(bot - 13); note(4, 5, 9, 3, '#6fae6a', '#a6d890', '#3f7a3a'); note(6, 4, 8, 3, '#e8b84a', '#ffe57b', '#a07810'); note(8, 8, 7, 3, '#4995e3', '#95e3e3', '#2f5fb8'); note(5, 10, 8, 3, '#6fae6a', '#a6d890', '#3f7a3a'); }
  for (let y = top + 3; y < bot - 3; y += 4) put(img, x0 + 1, y, '#ffffff');
  // screw lid with a coin slot (notes stick out of it when full)
  fillRect(img, x0 - 1, 2, 16, 3, '#d4a017'); fillRect(img, x0 - 1, 2, 16, 1, '#f2c230'); fillRect(img, x0 - 1, 4, 16, 1, '#a07810');
  for (let x = x0; x < x1; x += 2) put(img, x, 3, '#b8860b');
  fillRect(img, 7, 3, 6, 1, '#2c2c34'); put(img, x0 - 1, 2, '#fff59a');
  if (level === 3) { fillRect(img, 8, 0, 4, 3, '#6fae6a'); fillRect(img, 8, 0, 4, 1, '#a6d890'); put(img, 12, 1, '#a6d890'); }
  if (level < 2) { // little heart sticker
    const hx = level === 0 ? 8 : 10, hy = 10;
    pts(img, [[hx, hy], [hx + 2, hy], [hx - 1, hy + 1], [hx, hy + 1], [hx + 1, hy + 1], [hx + 2, hy + 1], [hx + 3, hy + 1], [hx, hy + 2], [hx + 1, hy + 2], [hx + 2, hy + 2], [hx + 1, hy + 3]], '#d93232');
    if (level === 0) put(img, hx - 1, hy + 1, '#ff8575');
  }
  return done(img);
}

// ------------------------------------------------------------------ patience meter: a pie timer, full -> empty (14x14)
const PAT_COL = [
  ['#2f8f3a', '#64b63b', '#a6d84e'],
  ['#6aa832', '#9bc246', '#d0e060'],
  ['#d4a017', '#f2b22b', '#ffe57b'],
  ['#d86a1a', '#ed931e', '#ffb45a'],
  ['#a82b2d', '#d93232', '#ff8575'],
];
function patience(level) {
  const img = blank(14, 14);
  const frac = [1, 0.75, 0.5, 0.25, 0][level];
  const [dk, mid, lt] = PAT_COL[level];
  const cx = 7, cy = 7;
  const disc = el(cx, cy, 5.6, 5.6);
  // clock face: cream; remaining patience is the coloured wedge, sweeping clockwise from 12 o'clock
  fillP(img, disc, '#f8efe0');
  fillP(img, (x, y) => disc(x, y) && y > 9.5, '#e0d0b2');
  if (frac >= 1) fillP(img, el(cx, cy, 4.6, 4.6), mid);
  else if (frac > 0) fillP(img, (x, y) => {
    if (!el(cx, cy, 4.6, 4.6)(x, y)) return false;
    let a = Math.atan2(x - cx, -(y - cy)); // 0 at 12 o'clock, clockwise positive
    if (a < 0) a += Math.PI * 2;
    return a <= frac * Math.PI * 2 - 0.0 + (a === 0 ? 0 : 0);
  }, mid);
  if (frac > 0) {
    for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) {
      const i = (y * 14 + x) * 4;
      if (img.data[i] === parseInt(mid.slice(1, 3), 16) && img.data[i + 1] === parseInt(mid.slice(3, 5), 16) && img.data[i + 2] === parseInt(mid.slice(5, 7), 16)) {
        if (y <= 4 && x <= 7) put(img, x, y, lt);
        else if (y >= 9 || x >= 10) put(img, x, y, dk);
      }
    }
  }
  // centre pin + a clock hand marker
  put(img, cx - 1, cy - 1, '#3a3a50'); put(img, cx, cy - 1, '#3a3a50'); put(img, cx - 1, cy, '#3a3a50'); put(img, cx, cy, '#3a3a50');
  // 12-o'clock tick
  put(img, cx - 1, 1, '#3a3a50');
  if (level === 4) { // out of patience: an exclamation mark and a red rim
    fillRect(img, 6, 3, 2, 4, '#d93232'); fillRect(img, 6, 8, 2, 2, '#d93232'); put(img, 6, 3, '#ff8575');
    fillP(img, (x, y) => disc(x, y) && !el(cx, cy, 4.6, 4.6)(x, y), '#d93232');
  }
  // outline: navy ring
  return outlineAround(img, NAVY);
}

// ------------------------------------------------------------------ steam: soft rising wisps, 4 frames (semi-transparent)
function steam(k) {
  const img = blank(14, 24);
  for (let y = 22; y >= 1; y--) {
    const t = (22 - y) / 21;
    const phase = (y + k * 5.5) / 3.1;
    const cx = 7 + 2.6 * Math.sin(phase) * (0.5 + t * 0.7);
    const half = 1.4 + t * 2.4;
    const body = 255 * (1 - t) ** 0.8;
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const d = Math.abs(x + 0.5 - cx) / (half + 0.6);
      if (d > 1) continue;
      const a = body * (1 - d ** 1.6);
      if (a < 45) continue;
      if (d > 0.6 && ((x + y + k) & 1)) continue;
      if (t > 0.5 && ((x * 3 + y * 5 + k) % 7 === 0)) continue;
      const edge = d > 0.55;
      setPx(img, x, y, edge ? [196, 190, 216, a > 130 ? 200 : 130] : [252, 250, 255, a > 150 ? 240 : 170]);
    }
  }
  return img;
}

// ------------------------------------------------------------------ registry
export function balcaoParts() {
  const out = [];
  const add = (key, img, anchor) => out.push({ key, img, anchor });
  for (const [id, fn] of Object.entries(ITEM_FNS)) add(`balcao/item_${id}`, fn(), ITEM_ANCHOR);
  add('balcao/tray', tray(), [32, 14]);
  add('balcao/tray_full', trayFull(), [32, 32]);
  add('balcao/bag', bag(), [12, 28]);
  add('balcao/plate', plate(), [14, 10]);
  add('balcao/chapa_idle', chapaIdle(), [20, 35]);
  for (let k = 0; k < 3; k++) add(`balcao/chapa_sizzle_${k}`, chapaSizzle(k), [20, 35]);
  add('balcao/chapa_burnt', chapaBurnt(), [20, 35]);
  add('balcao/coffee_idle', coffeeFrame(-1), [17, 41]);
  for (let k = 0; k < 4; k++) add(`balcao/coffee_pour_${k}`, coffeeFrame(k), [17, 41]);
  add('balcao/register', register(), [13, 23]);
  for (let k = 0; k < 2; k++) add(`balcao/bell_${k}`, bell(k === 1), [11, 14]);
  for (let k = 0; k < 4; k++) add(`balcao/tipjar_${k}`, tipjar(k), [10, 23]);
  for (let k = 0; k < 5; k++) add(`balcao/patience_${k}`, patience(k), [7, 14]);
  for (let k = 0; k < 4; k++) add(`fx/steam_${k}`, steam(k), [7, 23]);
  for (const p of juicerParts()) out.push(p);
  return out;
}

/** Contract: every key and its sprite count (each frame is its own sprite key, no animation block). */
export const BALCAO_KEYS = balcaoParts().map((p) => p.key);

export const DERIVE_BALCAO = {
  balcaoSet: async () => balcaoParts(),
};

void ell; void K; void hole; void hexPx;
