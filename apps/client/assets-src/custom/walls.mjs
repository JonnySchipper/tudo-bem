// Top-down interior walls, wall decor and doors (art track 3). Hand-authored in the LimeZu look: navy outline, white-ish wall cap, plaster
// face with sparse noise, lit from the upper left. Everything is built from 16 px columns so the scene can tile it.
//
// North band (3 tiles = 48 px above row 0): `walls/north_<style>_l|_m|_r` (16 x 48, plus 4 rows of soft floor shadow below the anchor row 48).
// West strip (1 tile wide left of column 0): `walls/west_<style>` and `_b` (bottom end), 16 x 16 plus 4 columns of floor shadow on the right.
import { blank, put, fillRect, line, mix, h2, C, K, NAVY } from './paint.mjs';
import { drawText5, width5 } from './font5.mjs';

export const STYLES = {
  praca: { face: '#e2d3b8', faceLo: '#d3c3a6', faceHi: '#eee2cc', cap: '#f2ece0', capLo: '#cfc4b2', trim: '#8f7a62', base: '#9c8b74', block: false },
  padaria: { face: '#f5e6d3', faceLo: '#e9d6bf', faceHi: '#fbf1e3', cap: '#fbf4ea', capLo: '#d8c5ae', trim: '#c45c26', base: '#a84a20', block: false },
  kitnet: { face: '#efe0c6', faceLo: '#e2d0b3', faceHi: '#f7ebd5', cap: '#f8f1e4', capLo: '#d5c5ab', trim: '#8b5e3c', base: '#8b5e3c', block: false },
  academia: { face: '#e9dcc4', faceLo: '#cfc3ac', faceHi: '#f3e9d5', cap: '#f2ece0', capLo: '#c3b8a4', trim: '#3f5b8a', base: '#33496f', block: true, paint: '#4a6a9c', paintLo: '#3c5883', paintHi: '#6486b8' },
};

const SHADOW = [78, 52, 30, 14];
const setA = (img, x, y, rgb, a) => { const i = (y * img.w + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a; };

/** plaster face with sparse lighter / darker specks (seamless: depends on x, y only). */
function face(img, x0, y0, x1, y1, s, seed) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const r = h2(x, y, seed);
    put(img, x, y, r < 0.05 ? s.faceLo : r > 0.965 ? s.faceHi : s.face);
  }
}

/** 16x8 painted concrete block courses (academia): mortar lines, staggered. */
function blocks(img, y0, y1, s, base, lo, hi) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor((y - y0) / 8);
    const ry = (y - y0) % 8;
    const off = row % 2 ? 8 : 0;
    const mortarV = (x + off) % 16 === 15;
    if (ry === 7 || mortarV) put(img, x, y, lo);
    else put(img, x, y, ry === 0 ? hi : h2(x, y, 5) < 0.05 ? lo : base);
  }
}

function northTile(style, part) {
  const s = STYLES[style];
  const img = blank(16, 52);
  fillRect(img, 0, 0, 16, 48, s.face);
  face(img, 0, 7, 48, 48, s, 3);
  // cap: outline, lit top, body, shade, underside shadow line
  fillRect(img, 0, 0, 16, 1, NAVY);
  fillRect(img, 0, 1, 16, 1, '#ffffff');
  fillRect(img, 0, 2, 16, 3, s.cap);
  fillRect(img, 0, 5, 16, 1, s.capLo);
  fillRect(img, 0, 6, 16, 1, mix(s.capLo, NAVY, 0.45));
  // soft shadow under the cap onto the face (gives the wall depth)
  for (let x = 0; x < 16; x++) { put(img, x, 7, mix(s.face, s.trim, 0.18)); put(img, x, 8, mix(s.face, s.trim, 0.08)); }
  if (style === 'academia') {
    blocks(img, 7, 27, s, s.face, s.faceLo, s.faceHi);
    blocks(img, 27, 47, s, s.paint, s.paintLo, s.paintHi);
    fillRect(img, 0, 26, 16, 1, s.trim);
  } else if (style === 'kitnet') {
    // wooden baseboard + a chair-rail shadow
    fillRect(img, 0, 42, 16, 1, s.capLo);
    fillRect(img, 0, 43, 16, 4, s.trim);
    fillRect(img, 0, 43, 16, 1, '#a9764f');
    fillRect(img, 0, 46, 16, 1, '#573c2c');
  } else if (style === 'padaria') {
    fillRect(img, 0, 46, 16, 1, s.base);
  } else {
    fillRect(img, 0, 45, 16, 2, s.base);
  }
  // bottom line where the wall meets the floor
  fillRect(img, 0, 47, 16, 1, style === 'kitnet' ? '#573c2c' : mix(s.base, NAVY, 0.55));
  // floor shadow (alpha) below the anchor row
  for (let i = 0; i < 4; i++) for (let x = 0; x < 16; x++) setA(img, x, 48 + i, [26, 16, 48], SHADOW[i]);
  if (part === 'l') {
    fillRect(img, 0, 0, 1, 48, NAVY);
    fillRect(img, 1, 1, 1, 6, '#ffffff');
    for (let i = 0; i < 4; i++) setA(img, 0, 48 + i, [26, 16, 48], 0);
  }
  if (part === 'r') {
    fillRect(img, 15, 0, 1, 48, NAVY);
    fillRect(img, 14, 7, 1, 40, mix(s.face, NAVY, 0.2));
    for (let i = 0; i < 4; i++) setA(img, 15, 48 + i, [26, 16, 48], 0);
  }
  return img;
}

/** West strip cell: seen from above, the wall shows its cap (light) and a darker inner side face; floor shadow on the right (x 16..19). */
function westTile(style, bottom) {
  const s = STYLES[style];
  const img = blank(20, 16);
  const sideFace = mix(s.face, s.trim, 0.16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(img, x, y, h2(x, y, 9) < 0.06 ? mix(sideFace, NAVY, 0.1) : sideFace);
  fillRect(img, 0, 0, 1, 16, NAVY);
  fillRect(img, 1, 0, 1, 16, '#ffffff');
  fillRect(img, 2, 0, 4, 16, s.cap);
  fillRect(img, 6, 0, 1, 16, s.capLo);
  fillRect(img, 7, 0, 1, 16, mix(s.capLo, NAVY, 0.45));
  // inner face lit a little at the top (perspective), darker toward the floor edge
  fillRect(img, 14, 0, 2, 16, mix(sideFace, NAVY, 0.28));
  fillRect(img, 15, 0, 1, 16, mix(sideFace, NAVY, 0.5));
  if (style === 'kitnet') { fillRect(img, 12, 0, 2, 16, s.trim); }
  if (style === 'academia') { fillRect(img, 8, 0, 6, 16, mix(s.paint, NAVY, 0.25)); }
  for (let x = 16; x < 20; x++) for (let y = 0; y < 16; y++) setA(img, x, y, [26, 16, 48], SHADOW[x - 16]);
  if (bottom) {
    // the strip ends at the south edge: navy end cap
    fillRect(img, 0, 15, 16, 1, NAVY);
    fillRect(img, 1, 14, 14, 1, mix(s.capLo, NAVY, 0.3));
    for (let x = 16; x < 20; x++) setA(img, x, 15, [26, 16, 48], 0);
  }
  return img;
}

export function wallSet(_ctx, { style }) {
  const parts = [];
  for (const p of ['l', 'm', 'r']) parts.push({ key: `walls/north_${style}_${p}`, img: northTile(style, p), anchor: [0, 48], meta: { shadow: null } });
  parts.push({ key: `walls/west_${style}`, img: westTile(style, false), anchor: [16, 16], meta: { shadow: null } });
  parts.push({ key: `walls/west_${style}_b`, img: westTile(style, true), anchor: [16, 16], meta: { shadow: null } });
  return parts;
}

// ------------------------------------------------------------------ decor: shared bits
const WOOD = { lo: '#573c2c', mid: '#8b5e3c', hi: '#c78c59', hi2: '#daa463' };

function frame(img, x, y, w, h, outline = NAVY) {
  fillRect(img, x, y, w, h, outline);
  fillRect(img, x + 1, y + 1, w - 2, h - 2, WOOD.mid);
  fillRect(img, x + 1, y + 1, w - 2, 1, WOOD.hi);
  fillRect(img, x + 1, y + 1, 1, h - 2, WOOD.hi);
  fillRect(img, x + 1, y + h - 2, w - 2, 1, WOOD.lo);
  fillRect(img, x + w - 2, y + 1, 1, h - 2, WOOD.lo);
}

const blankImg = (w, h) => blank(w, h);

// azulejos: terracotta tile wainscot, 16 wide tileable, 18 tall: cap moulding + 2 rows of 8x8 tiles with a lighter glaze and a cream accent tile
function azulejos() {
  const img = blankImg(16, 18);
  const T1 = ['#c8683a', '#b95a30', '#d8804c'];
  fillRect(img, 0, 0, 16, 18, '#e9d9bd'); // grout
  // moulding: mustard line + shade
  fillRect(img, 0, 0, 16, 1, NAVY);
  fillRect(img, 0, 1, 16, 1, '#f0c95a');
  fillRect(img, 0, 2, 16, 1, '#c99a2a');
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const x0 = tx * 8, y0 = 3 + ty * 7;
    const accent = (tx + ty) % 2 === 1;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
      let c = T1[0];
      if (y === 0 || x === 0) c = T1[2];
      else if (y === 5 || x === 6) c = T1[1];
      if (accent) {
        const d = Math.abs(x - 3) + Math.abs(y - 2.5);
        c = d <= 1.6 ? '#f5e6d3' : d <= 2.6 ? '#f0c95a' : c;
      }
      put(img, x0 + x, y0 + y, c);
    }
  }
  fillRect(img, 0, 17, 16, 1, '#7d3e22');
  return { img, anchor: [0, 17] };
}

function prateleira(w = 96) {
  const h = 36;
  const img = blankImg(w, h);
  // back panel + side posts + two shelf boards with brackets
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#b9834f');
  for (let x = 2; x < w - 2; x += 4) fillRect(img, x, 2, 1, h - 4, '#a9744a');
  fillRect(img, 1, 1, w - 2, 1, WOOD.hi2);
  const shelfY = [16, 33];
  for (const sy of shelfY) {
    fillRect(img, 0, sy - 1, w, 3, NAVY);
    fillRect(img, 1, sy, w - 2, 1, WOOD.hi);
    fillRect(img, 1, sy + 1, w - 2, 1, WOOD.lo);
  }
  // breads on each shelf, repeating groups of goods
  const goods = [bread, roll, baguette, cake, bread, roll, loaf];
  let x = 4, gi = 0;
  for (const sy of shelfY) {
    x = 4 + (sy === 33 ? 5 : 0);
    while (x < w - 12) { const g = goods[gi++ % goods.length]; x += g(img, x, sy - 1) + 3; }
  }
  // paper price tags on the shelf edge
  for (let x0 = 10; x0 < w - 8; x0 += 22) { fillRect(img, x0, 14, 5, 2, '#f5e6d3'); fillRect(img, x0 + 12, 31, 5, 2, '#f5e6d3'); }
  return { img, anchor: [0, h - 2] };
}

// small goods, each draws with its base row at y and returns its width
function bread(img, x, y) { // pao frances: golden oval with a slash
  const rows = ['.nooon.', 'nogggon', 'ogGgggo', 'ogggggo', '.oooo..'];
  paintGoods(img, x, y - 4, rows, { n: NAVY, o: '#a9581e', g: '#e8a444', G: '#f6cf7a' });
  put(img, x + 3, y - 3, '#f6cf7a'); put(img, x + 4, y - 2, '#f6cf7a');
  return 7;
}
function roll(img, x, y) { // pao de queijo balls
  paintGoods(img, x, y - 3, ['.nn.nn.', 'nyyNyyn', 'nyYnyYn', '.nn.nn.'].map((r) => r.replace('N', 'n')), { n: '#8f5a1e', y: '#eab84a', Y: '#f8de8c' });
  return 7;
}
function baguette(img, x, y) {
  paintGoods(img, x, y - 3, ['.nnnnnnnn.', 'nggGgGgggn', 'nooooooooon', '.nnnnnnnn.'], { n: '#8f4f1a', g: '#e6a040', G: '#f4c874', o: '#c47a2c' });
  return 10;
}
function cake(img, x, y) { // bolo with chocolate icing
  paintGoods(img, x, y - 5, ['.nnnnnn.', 'nkkkkkkn', 'nkKkKkkn', 'noooooon', 'noOooOon', '.nnnnnn.'], { n: '#573c2c', k: '#6b3a26', K: '#8a5236', o: '#e8b44e', O: '#f6d27a' });
  return 8;
}
function loaf(img, x, y) { // pao de forma
  paintGoods(img, x, y - 5, ['.nnnnnn.', 'nssssssn', 'nsSssSsn', 'nooooooo', 'nooooooo', '.nnnnnn.'], { n: '#8f5a1e', s: '#d99a3e', S: '#eab868', o: '#c47a2c' });
  return 8;
}
function paintGoods(img, x, y, rows, pal) {
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') put(img, x + rx, y + ry, pal[ch] ?? pal.n); }));
}

function lousa(w = 48) {
  const h = 30;
  const img = blankImg(w, h);
  frame(img, 0, 0, w, h);
  // blank slate, green-black, faint chalk smudges (text is DOM)
  fillRect(img, 3, 3, w - 6, h - 8, '#2f4a3f');
  for (let y = 3; y < h - 5; y++) for (let x = 3; x < w - 3; x++) { const r = h2(x, y, 21); if (r < 0.04) put(img, x, y, '#3d5c50'); else if (r > 0.985) put(img, x, y, '#6f8f82'); }
  fillRect(img, 3, 3, w - 6, 1, '#1f342c');
  fillRect(img, 3, 3, 1, h - 8, '#1f342c');
  // chalk tray
  fillRect(img, 3, h - 5, w - 6, 2, WOOD.lo);
  fillRect(img, 6, h - 6, 4, 1, '#f5e6d3'); fillRect(img, 12, h - 6, 3, 1, '#f0c95a');
  return { img, anchor: [0, h] };
}

function skyPane(img, x, y, w, h, kind) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const t = yy / h;
    put(img, x + xx, y + yy, t < 0.35 ? '#8fc3ec' : t < 0.6 ? '#a9d2f0' : '#c4dff2');
  }
  if (kind === 'city') {
    const sil = ['#7f96b8', '#6d84a8', '#8aa0bf'];
    let cx = 0, i = 0;
    while (cx < w) { const bw = 4 + Math.floor(h2(cx, 3, 4) * 4); const bh = 3 + Math.floor(h2(cx, 5, 4) * (h * 0.4)); fillRect(img, x + cx, y + h - bh, Math.min(bw, w - cx), bh, sil[i++ % 3]); for (let wy = y + h - bh + 1; wy < y + h - 1; wy += 3) put(img, x + cx + 1, wy, '#e6f0f8'); cx += bw + 1; }
  }
  fillRect(img, x + 1, y + 1, 5, 1, '#ffffff'); fillRect(img, x + 1, y + 2, 1, 3, '#ffffff'); // glint
}

function janela(w, h, kind, frameColor) {
  const img = blankImg(w, h);
  const fc = frameColor ?? '#f3ecdf';
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, fc);
  fillRect(img, 1, h - 3, w - 2, 2, mix(fc, NAVY, 0.25));
  skyPane(img, 3, 3, w - 6, h - 8, kind);
  // mullion(s)
  const panes = Math.max(1, Math.round((w - 6) / 16));
  for (let p = 1; p < panes; p++) { const mx = 3 + Math.round(((w - 6) * p) / panes); fillRect(img, mx - 1, 3, 2, h - 8, fc); fillRect(img, mx - 1, 3, 1, h - 8, '#ffffff'); }
  fillRect(img, 3, 3, w - 6, 1, mix('#8fc3ec', NAVY, 0.25));
  // sill
  fillRect(img, 0, h - 3, w, 3, NAVY);
  fillRect(img, 1, h - 3, w - 2, 1, '#ffffff');
  fillRect(img, 1, h - 2, w - 2, 1, mix(fc, NAVY, 0.3));
  return { img, anchor: [0, h] };
}

function relogio() {
  const img = blankImg(14, 14);
  const cx = 6.5, cy = 6.5;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 6.8) put(img, x, y, d > 5.6 ? NAVY : d > 4.6 ? '#c45c26' : '#f8f3e6');
  }
  for (const [x, y] of [[6, 2], [7, 2], [6, 11], [7, 11], [2, 6], [2, 7], [11, 6], [11, 7]]) put(img, x, y, '#573c2c');
  line(img, 6, 6, 6, 3, NAVY); line(img, 7, 7, 9, 8, NAVY);
  put(img, 7, 7, '#d93232');
  return { img, anchor: [7, 14] };
}

function tv() {
  const w = 30, h = 20;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h - 2, NAVY);
  fillRect(img, 1, 1, w - 2, h - 4, '#2d2d3a');
  // football pitch: two-tone stripes, white lines, a tiny match
  for (let y = 0; y < h - 6; y++) for (let x = 0; x < w - 4; x++) put(img, 2 + x, 2 + y, Math.floor(x / 4) % 2 ? '#4fa04a' : '#5db457');
  const X0 = 2, Y0 = 2, W = w - 4, H = h - 6;
  fillRect(img, X0, Y0, W, 1, '#e9f3e0'); fillRect(img, X0, Y0 + H - 1, W, 1, '#e9f3e0');
  fillRect(img, X0, Y0, 1, H, '#e9f3e0'); fillRect(img, X0 + W - 1, Y0, 1, H, '#e9f3e0');
  fillRect(img, X0 + W / 2 - 1, Y0, 1, H, '#e9f3e0');
  fillRect(img, X0 + W / 2 - 2, Y0 + H / 2 - 2, 4, 1, '#e9f3e0'); fillRect(img, X0 + W / 2 - 2, Y0 + H / 2 + 1, 4, 1, '#e9f3e0');
  const players = [[7, 5, '#f2d13a'], [10, 8, '#f2d13a'], [14, 6, '#2f6fd0'], [18, 9, '#2f6fd0'], [21, 5, '#f2d13a'], [12, 10, '#2f6fd0']];
  for (const [px, py, c] of players) { put(img, X0 + px, Y0 + py, c); put(img, X0 + px, Y0 + py + 1, mix(c, NAVY, 0.4)); }
  put(img, X0 + 15, Y0 + 8, '#ffffff');
  // scoreboard chip + stand
  fillRect(img, X0 + 1, Y0 + 1, 6, 3, NAVY); put(img, X0 + 2, Y0 + 2, '#f2d13a'); put(img, X0 + 4, Y0 + 2, '#ffffff'); put(img, X0 + 5, Y0 + 2, '#2f6fd0');
  put(img, 2, 2, '#ffffff'); put(img, 3, 2, '#ffffff');
  fillRect(img, 0, h - 2, w, 1, '#565972');
  fillRect(img, w / 2 - 4, h - 1, 8, 1, NAVY);
  return { img, anchor: [w / 2, h] };
}

function cobogo() {
  const img = blankImg(16, 30);
  fillRect(img, 0, 0, 16, 30, NAVY);
  for (let by = 0; by < 3; by++) for (let bx = 0; bx < 2; bx++) {
    const x0 = 1 + bx * 7, y0 = 1 + by * 9;
    fillRect(img, x0, y0, 7, 8, '#eadcc2');
    fillRect(img, x0, y0, 7, 1, '#f8eed8'); fillRect(img, x0, y0, 1, 8, '#f8eed8');
    fillRect(img, x0, y0 + 7, 7, 1, '#c8b594'); fillRect(img, x0 + 6, y0, 1, 8, '#c8b594');
    // the geometric hole (diamond) showing the sky
    for (const [dx, dy, c] of [[3, 2, '#a9d2f0'], [2, 3, '#a9d2f0'], [3, 3, '#c4dff2'], [4, 3, '#a9d2f0'], [3, 4, '#a9d2f0'], [1, 3, NAVY], [5, 3, NAVY], [3, 1, NAVY], [3, 5, NAVY], [2, 2, NAVY], [4, 2, NAVY], [2, 4, NAVY], [4, 4, NAVY]]) put(img, x0 + dx, y0 + dy, c);
  }
  return { img, anchor: [8, 30] };
}

function foto(w = 32) {
  const h = 24;
  const img = blankImg(w, h);
  const frames = [[1, 3, 12, 15, '#f2b22b'], [16, 1, 14, 11, '#c45c26'], [17, 13, 12, 9, '#3f5b8a']];
  for (const [x, y, fw, fh, c] of frames) {
    fillRect(img, x, y, fw, fh, NAVY); fillRect(img, x + 1, y + 1, fw - 2, fh - 2, c); fillRect(img, x + 1, y + 1, fw - 2, 1, mix(c, '#ffffff', 0.35));
    fillRect(img, x + 3, y + 3, fw - 6, fh - 6, '#efe4d0');
    // a tiny scene: hill + sun + figure
    for (let xx = 0; xx < fw - 6; xx++) { const hh = 1 + Math.floor((fh - 6) * 0.35 + Math.sin(xx * 0.9) * 1.2); fillRect(img, x + 3 + xx, y + fh - 3 - hh, 1, hh, '#7fae5a'); }
    put(img, x + fw - 5, y + 4, '#f2b22b');
    put(img, x + 5, y + fh - 6, '#d93232'); put(img, x + 5, y + fh - 5, '#3f5b8a');
  }
  return { img, anchor: [0, h] };
}

function placa() {
  const w = 64, h = 26;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#3f5b8a');
  fillRect(img, 1, 1, w - 2, 1, '#6486b8'); fillRect(img, 1, 1, 1, h - 2, '#6486b8');
  fillRect(img, 1, h - 2, w - 2, 1, '#2d4468');
  fillRect(img, 3, 3, w - 6, 1, '#f2c230'); fillRect(img, 3, h - 5, w - 6, 1, '#f2c230');
  const l1 = 'ACADEMIA', l2 = 'DO BAIRRO';
  drawText5(img, Math.floor((w - width5(l1)) / 2), 6, l1, '#f8f8f8');
  drawText5(img, Math.floor((w - width5(l2)) / 2), 14, l2, '#f2c230');
  // bolts
  for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) put(img, x, y, '#a2a6be');
  return { img, anchor: [0, h] };
}

function poster(kind) {
  const w = 24, h = 30;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  if (kind === 'sp') {
    fillRect(img, 1, 1, w - 2, h - 2, '#f5e6d3');
    fillRect(img, 3, 3, w - 6, 15, '#f2b22b');
    // skyline
    for (const [x, hh] of [[4, 6], [7, 10], [10, 7], [13, 12], [16, 8], [18, 5]]) fillRect(img, x, 17 - hh, 3, hh, '#3f5b8a');
    put(img, 8, 9, '#f5e6d3'); put(img, 14, 7, '#f5e6d3'); put(img, 14, 10, '#f5e6d3');
    drawText5(img, Math.floor((w - width5('SP')) / 2), 21, 'SP', '#c45c26');
    fillRect(img, 4, 28, 16, 1, '#c45c26');
  } else {
    fillRect(img, 1, 1, w - 2, h - 2, '#2d4468');
    fillRect(img, 1, 1, w - 2, 2, '#c45c26');
    // gi silhouette (kimono) with a belt, and OSS
    fillRect(img, 8, 5, 8, 4, '#f5e6d3'); fillRect(img, 9, 3, 6, 3, '#d9a16a');
    fillRect(img, 6, 9, 12, 10, '#f8f8f8'); fillRect(img, 6, 9, 12, 1, '#c6bdd5');
    fillRect(img, 6, 14, 12, 2, '#8b5e3c'); fillRect(img, 4, 10, 3, 8, '#f8f8f8'); fillRect(img, 17, 10, 3, 8, '#f8f8f8');
    drawText5(img, Math.floor((w - width5('OSS')) / 2), 21, 'OSS', '#f2c230');
    fillRect(img, 4, 28, 16, 1, '#f2c230');
  }
  return { img, anchor: [0, h] };
}

function toldo(w = 80) {
  const h = 12;
  const img = blankImg(w, h);
  for (let x = 0; x < w; x++) {
    const red = Math.floor(x / 8) % 2 === 0;
    const base = red ? '#d93232' : '#f8f2e4';
    const lo = red ? '#a82b2d' : '#d8ccb8';
    const scallop = 3 + (Math.abs((x % 8) - 3.5) < 2.6 ? 3 : 2);
    for (let y = 0; y < scallop + 5; y++) {
      if (y === 0) put(img, x, y, NAVY);
      else if (y < 6) put(img, x, y, y < 3 ? base : lo === base ? base : y === 5 ? lo : base);
      else put(img, x, y, y === scallop + 4 ? NAVY : lo);
    }
  }
  for (let x = 0; x < w; x++) put(img, x, 1, Math.floor(x / 8) % 2 === 0 ? '#ff8575' : '#ffffff');
  return { img, anchor: [0, h] };
}

function mural(w, text) {
  const h = 34;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#2d4468');
  // sunset sky bands
  const bands = ['#f2b22b', '#ee8c3a', '#d9605a', '#a05a8c', '#4a5a9c'];
  bands.forEach((c, i) => fillRect(img, 1, 1 + i * 4, w - 2, 4, c));
  // skyline (Sampa: Copan wave + towers) in dark
  let x = 2;
  while (x < w - 4) { const bw = 3 + Math.floor(h2(x, 1, 8) * 4), bh = 6 + Math.floor(h2(x, 2, 8) * 12); fillRect(img, x, h - 2 - bh, bw, bh, '#2b2b44'); for (let wy = h - bh; wy < h - 3; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) if (h2(wx, wy, 3) > 0.5) put(img, wx, wy, '#f2c230'); x += bw + 1; }
  fillRect(img, 1, h - 3, w - 2, 2, '#1f1f30');
  if (text) drawText5(img, Math.floor((w - width5(text)) / 2), 4, text, '#f8f8f8', { shadow: NAVY });
  return { img, anchor: [0, h] };
}

function predio(w = 48) {
  const h = 44;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#f0cf78');
  fillRect(img, 1, 1, w - 2, 1, '#fbe7a8');
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (h2(x, y, 12) < 0.05) put(img, x, y, '#e0b85a');
  // windows with grilles (3 x 2)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x0 = 5 + c * 14, y0 = 6 + r * 17;
    fillRect(img, x0, y0, 10, 12, NAVY); fillRect(img, x0 + 1, y0 + 1, 8, 10, '#a9d2f0'); fillRect(img, x0 + 1, y0 + 1, 8, 2, '#c4dff2');
    for (let g = 2; g < 9; g += 2) fillRect(img, x0 + g, y0 + 1, 1, 10, '#573c2c');
    fillRect(img, x0 - 1, y0 + 12, 12, 2, '#c8a45a');
    fillRect(img, x0 - 1, y0 + 12, 12, 1, '#f8e6a0');
  }
  fillRect(img, 1, h - 5, w - 2, 4, '#b39a6a'); fillRect(img, 1, h - 5, w - 2, 1, '#d4bb88');
  return { img, anchor: [0, h] };
}

function metro() {
  const w = 48, h = 30;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 2, '#2f4f9c');
  fillRect(img, 1, 1, w - 2, 1, '#5b7fd0');
  fillRect(img, 3, 3, w - 6, 1, '#f8f8f8');
  // big M
  const M = ['#..#.', '##.##', '#.#.#', '#...#', '#...#'];
  M.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') fillRect(img, 5 + rx * 2, 9 + ry * 2, 2, 2, '#f8f8f8'); }));
  drawText5(img, 16, 9, 'METRO', '#f8f8f8');
  fillRect(img, 16, 19, 29, 2, '#e63f38');
  return { img, anchor: [0, h] };
}

function faixasWall() {
  const w = 32, h = 22;
  const img = blankImg(w, h);
  frame(img, 0, 0, w, h);
  fillRect(img, 3, 3, w - 6, h - 6, '#2f3f5c');
  const belts = ['#f8f8f8', '#4a86c8', '#8a5cc0', '#8b5e3c', '#2b2b34'];
  belts.forEach((c, i) => {
    const y = 4 + i * 3;
    fillRect(img, 4, y, w - 8, 2, c);
    fillRect(img, 4, y, w - 8, 1, mix(c, '#ffffff', 0.3));
    fillRect(img, w - 9, y, 4, 2, i === 4 ? '#c93232' : mix(c, NAVY, 0.3)); // stripe / bar at the end
  });
  return { img, anchor: [0, h] };
}

const DECOR = {
  azulejos, prateleira: () => prateleira(96), lousa: () => lousa(48),
  janela_rua: () => janela(48, 34, 'city', '#f8f2e4'), janela: () => janela(32, 30, 'plain', '#f3ecdf'),
  relogio, tv, cobogo, foto: () => foto(32), placa,
  poster_sp: () => poster('sp'), poster_oss: () => poster('oss'),
  toldo: () => toldo(80),
  mural: () => mural(112, 'SAMPA'), mural_s: () => mural(64, null),
  predio: () => predio(48), metro, faixas: faixasWall,
};

export function wallDecor(_ctx, { kind }) {
  const d = DECOR[kind]();
  return [{ img: d.img, anchor: d.anchor }];
}

// ------------------------------------------------------------------ doors
function doorNorth() {
  const w = 16, h = 32;
  const img = blankImg(w, h);
  fillRect(img, 0, 0, w, h, NAVY);
  fillRect(img, 1, 1, w - 2, h - 1, WOOD.mid);
  fillRect(img, 1, 1, w - 2, 2, WOOD.hi); // lintel
  // door leaf with glass (top) and panel (bottom)
  fillRect(img, 2, 3, w - 4, h - 3, WOOD.lo);
  fillRect(img, 3, 4, w - 6, 12, '#a9d2f0'); fillRect(img, 3, 4, w - 6, 3, '#c4dff2'); fillRect(img, 3, 4, 1, 12, '#ffffff');
  fillRect(img, 3, 17, w - 6, 13, WOOD.mid); fillRect(img, 3, 17, w - 6, 1, WOOD.hi); fillRect(img, 5, 19, w - 10, 9, WOOD.lo); fillRect(img, 5, 19, w - 10, 1, WOOD.mid);
  put(img, 11, 18, '#f2c230'); put(img, 11, 19, '#c99a2a'); // handle
  fillRect(img, 0, h - 1, w, 1, NAVY);
  return { img, anchor: [8, h] };
}

function doorWest() {
  const img = blankImg(16, 16);
  // doorway cut in the wall strip: jambs top and bottom, warm daylight in the opening, the door leaf open at an angle
  fillRect(img, 0, 0, 16, 16, '#f0d9a4');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (h2(x, y, 31) < 0.08) put(img, x, y, '#f8ecc4');
  fillRect(img, 0, 0, 16, 3, NAVY); fillRect(img, 0, 1, 16, 1, WOOD.mid); fillRect(img, 0, 2, 16, 1, WOOD.lo);
  fillRect(img, 0, 13, 16, 3, NAVY); fillRect(img, 0, 13, 16, 1, WOOD.hi); fillRect(img, 0, 14, 16, 1, WOOD.mid);
  // open leaf, seen from above: a wooden slab swung into the room
  for (let i = 0; i < 9; i++) { put(img, 3 + i, 3 + Math.floor(i * 0.9), NAVY); put(img, 3 + i, 4 + Math.floor(i * 0.9), WOOD.hi); put(img, 3 + i, 5 + Math.floor(i * 0.9), WOOD.mid); put(img, 3 + i, 6 + Math.floor(i * 0.9), NAVY); }
  put(img, 12, 11, '#f2c230');
  return { img, anchor: [16, 16] };
}

function doormat() {
  const img = blankImg(16, 16);
  fillRect(img, 1, 3, 14, 11, NAVY);
  fillRect(img, 2, 4, 12, 9, '#8b5e3c');
  for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) put(img, x, y, (x + y) % 3 === 0 ? '#6b4c2c' : (x * 3 + y) % 5 === 0 ? '#a9764f' : '#8b5e3c');
  fillRect(img, 3, 5, 10, 1, '#c45c26'); fillRect(img, 3, 11, 10, 1, '#c45c26');
  fillRect(img, 3, 5, 1, 7, '#c45c26'); fillRect(img, 12, 5, 1, 7, '#c45c26');
  fillRect(img, 5, 7, 6, 3, '#d4a017'); fillRect(img, 6, 8, 4, 1, '#f5e6d3');
  return { img, anchor: [8, 15] };
}

export function doorPart(_ctx, { kind }) {
  const d = kind === 'north' ? doorNorth() : kind === 'west' ? doorWest() : doormat();
  return [{ img: d.img, anchor: d.anchor }];
}
