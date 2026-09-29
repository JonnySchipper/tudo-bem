// Padaria do Seu Carlos interior pieces (art track 3): balcão (LimeZu glass counter recolored terracotta / cream, 1-tile slices), vitrine,
// estufa (+ lit overlay), trilho de pedidos (2-frame flutter), caixa registradora, banqueta, mesa with the checkered cloth, cadeira x 4 facings.
import { put, fillRect, mix, h2, NAVY } from './paint.mjs';
import { blank, crop, paste, trim } from '../../../../scripts/lib/pixel/img.mjs';
import { swap } from './kit.mjs';

const WOOD = { lo: '#573c2c', mid: '#8b5e3c', hi: '#c78c59', hi2: '#daa463' };
const METAL = { lo: '#565972', mid: '#8b8bab', hi: '#b2aecb', hi2: '#d8d0e0' };
const GLASS = { back: '#ecdcc0', pane: '#dbe8f0', hi: '#ffffff', lo: '#b9c3d5' };

/** Ice-cream-shop pink stripes -> padaria terracotta, lavender whites -> warm cream. */
const COUNTER_SWAP = {
  '#c75f98': '#a94a24', '#d6779d': '#c45c26', '#e88dad': '#d97a45', '#eea5b8': '#eda878',
  '#ebe4f2': '#f8efe0', '#d8d0e0': '#ecdcc4', '#c6bdd5': '#dcc7ac', '#b2aecb': '#c8b092', '#b8b5cb': '#cdb798',
};

function paintGoods(img, x, y, rows, pal) {
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') put(img, x + rx, y + ry, pal[ch] ?? NAVY); }));
}

/** tiny salgados / breads used in the cases (each ~6-8 px wide) */
const GOODS = {
  coxinha: (img, x, y) => paintGoods(img, x, y, ['..nn..', '.nggn.', 'nggGgn', 'nggggn', '.nooon', '..nn..'], { n: '#8f4f1a', g: '#e8a040', G: '#f8d078', o: '#c47a2c' }),
  pastel: (img, x, y) => paintGoods(img, x, y, ['.nnnnn.', 'nggGggn', 'nggggon', '.nnnnn.'], { n: '#8f4f1a', g: '#e6a040', G: '#f8d078', o: '#c47a2c' }),
  bolo: (img, x, y) => paintGoods(img, x, y, ['.nnnnnn.', 'nkkkkkkn', 'nkKkKkkn', 'noooooon', 'noOooOon', '.nnnnnn.'], { n: '#573c2c', k: '#6b3a26', K: '#8a5236', o: '#e8b44e', O: '#f6d27a' }),
  pao: (img, x, y) => { paintGoods(img, x, y, ['.nnnn.', 'nggGgn', 'ngggon', '.nnnn.'], { n: '#8f4f1a', g: '#e8a444', G: '#f6cf7a', o: '#c47a2c' }); put(img, x + 3, y + 1, '#f6cf7a'); },
  brig: (img, x, y) => paintGoods(img, x, y, ['.nn.', 'nkkn', 'nkyn', '.nn.'], { n: '#3a2418', k: '#5a3520', y: '#f2c230' }),
};

// ------------------------------------------------------------------ balcao: 5 slices of the LimeZu glass counter
export async function balcao(ctx, { slices = 5 }) {
  const ice = await ctx.sheet('ice');
  // the glass counter: left end, a 2-pane middle, right end (x 192..240, y 8..40), 30 px tall
  const src = swap(crop(ice, 192, 8, 48, 32), COUNTER_SWAP);
  const L = crop(src, 0, 0, 16, 32), M = crop(src, 16, 0, 16, 32), R = crop(src, 32, 0, 16, 32);
  const parts = [];
  for (let i = 0; i < slices; i++) {
    const img = i === 0 ? L : i === slices - 1 ? R : M;
    const t = blank(16, 32);
    paste(t, img, 0, 0);
    // bread and salgados inside the glass panes (panes are the dark grey rows y 4..12)
    const g = [GOODS.pao, GOODS.coxinha, GOODS.pastel, GOODS.bolo][i % 4];
    const g2 = [GOODS.brig, GOODS.pao, GOODS.coxinha, GOODS.pastel, GOODS.pao][i % 5];
    if (i > 0) g(t, 4, 6 + (g === GOODS.bolo ? 0 : 1)); // left pane
    if (i < slices - 1) g2(t, 10, 7); // right pane
    parts.push({ key: `props/balcao_${i}_of_${slices}`, img: t, anchor: [8, 30], meta: { footprint: [1, 1], shadow: null } });
  }
  return parts;
}

// ------------------------------------------------------------------ vitrine: upright glass case with cakes and sweets
export function vitrine() {
  const w = 16, h = 30;
  const img = blank(w, h);
  fillRect(img, 0, 0, w, h - 2, NAVY);
  fillRect(img, 1, 1, w - 2, 2, METAL.hi2); // top cap
  fillRect(img, 1, 3, w - 2, 1, METAL.mid);
  // glass body between two metal posts
  fillRect(img, 1, 4, 2, 17, METAL.mid); fillRect(img, w - 3, 4, 2, 17, METAL.lo); fillRect(img, 1, 4, 1, 17, METAL.hi);
  fillRect(img, 3, 4, w - 6, 17, GLASS.back);
  // glass sheen: lighter diagonal
  for (let i = 0; i < 9; i++) { put(img, 4 + i, 5 + i, GLASS.pane); if (i < 8) put(img, 5 + i, 5 + i, '#f8f4ea'); }
  // shelves
  for (const y of [12, 20]) { fillRect(img, 1, y, w - 2, 2, METAL.hi2); fillRect(img, 1, y + 1, w - 2, 1, METAL.lo); }
  GOODS.bolo(img, 4, 6); GOODS.brig(img, 3, 8 + 0); GOODS.brig(img, 12, 8);
  GOODS.pao(img, 4, 14); GOODS.coxinha(img, 10, 13); GOODS.brig(img, 7, 17); GOODS.brig(img, 5, 17);
  // base: terracotta panel with a mustard rail
  fillRect(img, 1, 21, w - 2, 7, '#b35e3f'); fillRect(img, 1, 21, w - 2, 1, '#f0c95a'); fillRect(img, 1, 22, w - 2, 1, '#c99a2a');
  fillRect(img, 3, 24, w - 6, 3, '#a13a30'); fillRect(img, 3, 24, w - 6, 1, '#d97a45');
  fillRect(img, 1, 27, w - 2, 1, NAVY);
  return { img, anchor: [8, h - 2] };
}

// ------------------------------------------------------------------ estufa: warm case for salgados (+ lit overlay)
function estufaBase(lit) {
  const w = 16, h = 30;
  const img = blank(w, h);
  if (!lit) {
    fillRect(img, 0, 0, w, h - 2, NAVY);
    fillRect(img, 1, 1, w - 2, 3, '#a82b2d'); // heat-lamp housing
    fillRect(img, 1, 1, w - 2, 1, '#ff8575');
    fillRect(img, 2, 3, w - 4, 1, '#f2c230');
    fillRect(img, 1, 4, 2, 17, METAL.mid); fillRect(img, w - 3, 4, 2, 17, METAL.lo); fillRect(img, 1, 4, 1, 17, METAL.hi);
    fillRect(img, 3, 4, w - 6, 17, '#f0b463');
    for (const y of [12, 20]) { fillRect(img, 1, y, w - 2, 2, METAL.hi2); fillRect(img, 1, y + 1, w - 2, 1, METAL.lo); }
    GOODS.coxinha(img, 3, 5); GOODS.coxinha(img, 8, 6); GOODS.pastel(img, 4, 15); GOODS.pastel(img, 9, 14);
    put(img, 4, 5, '#f8d078');
    fillRect(img, 1, 21, w - 2, 7, METAL.mid); fillRect(img, 1, 21, w - 2, 1, METAL.hi2);
    fillRect(img, 3, 23, 4, 3, NAVY); put(img, 4, 24, '#ffb45a'); // thermostat window
    put(img, 10, 24, '#d93232'); put(img, 12, 24, '#4fa04a'); // knobs
    fillRect(img, 1, 27, w - 2, 1, NAVY);
    // the glass has a subtle glare
    for (let i = 0; i < 6; i++) put(img, 4 + i, 5 + i, '#fff0c8');
  } else {
    // overlay: warm glow on the glass and the lamp strip (semi transparent, drawn additive-ish above the case at night)
    for (let y = 4; y < 21; y++) for (let x = 3; x < w - 3; x++) { const i = (y * w + x) * 4; img.data[i] = 255; img.data[i + 1] = 196; img.data[i + 2] = 96; img.data[i + 3] = y % 8 === 3 ? 0 : 92; }
    fillRect(img, 2, 3, w - 4, 1, '#fff2b0');
    for (let x = 2; x < w - 2; x++) { const i = (3 * w + x) * 4; img.data[i + 3] = 230; }
  }
  return { img, anchor: [8, h - 2] };
}
export const estufa = () => estufaBase(false);
export const estufaLit = () => estufaBase(true);

// ------------------------------------------------------------------ trilho de pedidos: ticket rail, 2 frames of paper flutter
export function trilho() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const img = blank(16, 30);
    // counter-top plate + pole + rail
    fillRect(img, 2, 25, 12, 3, NAVY); fillRect(img, 3, 25, 10, 2, METAL.hi2); fillRect(img, 3, 27, 10, 1, METAL.lo);
    fillRect(img, 7, 6, 2, 19, NAVY); fillRect(img, 7, 6, 1, 19, METAL.hi); fillRect(img, 8, 6, 1, 19, METAL.mid);
    fillRect(img, 1, 5, 14, 3, NAVY); fillRect(img, 2, 5, 12, 1, METAL.hi2); fillRect(img, 2, 6, 12, 1, METAL.mid); fillRect(img, 2, 7, 12, 1, METAL.lo);
    // bell on the plate
    fillRect(img, 10, 21, 4, 4, NAVY); fillRect(img, 11, 21, 2, 3, '#f2c230'); put(img, 11, 21, '#fff59a');
    // tickets hanging from the rail (they swing 1 px between frames)
    const tk = [[2, 9, '#f8efe0', 9], [4, 9, '#f8d0d0', 12], [10, 8, '#f8efe0', 10], [12, 9, '#dcefd0', 8], [1, 9, '#f8d0d0', 6]];
    tk.forEach(([x0, y0, c, len], i) => {
      const sway = f === 0 ? (i % 2 ? 1 : 0) : (i % 2 ? 0 : 1);
      const x = Math.max(0, Math.min(13, x0 + sway));
      fillRect(img, x, y0, 3, len, NAVY);
      fillRect(img, x + 1, y0 + 1, 1, len - 2, c);
      if (len > 7) { put(img, x + 1, y0 + 3, '#c45c26'); put(img, x + 1, y0 + 5, '#c45c26'); }
      put(img, x + 1, y0 - 1, METAL.hi2); // clip
    });
    frames.push(img);
  }
  return { frames, anchor: [8, 28], fps: 3 };
}

// ------------------------------------------------------------------ caixa registradora: a small counter block with a cream register
export function caixa() {
  const w = 16, h = 30;
  const img = blank(w, h);
  // counter block (same striped front as the balcao: terracotta / cream)
  fillRect(img, 0, 15, w, 15, NAVY);
  fillRect(img, 1, 16, w - 2, 4, '#f8efe0'); fillRect(img, 1, 16, w - 2, 1, '#ffffff');
  for (let x = 1; x < w - 1; x++) { const red = Math.floor((x - 1) / 2) % 2 === 0; fillRect(img, x, 20, 1, 7, red ? '#c45c26' : '#f5e6d3'); }
  fillRect(img, 1, 20, w - 2, 1, '#d97a45');
  fillRect(img, 1, 27, w - 2, 1, '#9c8b74'); fillRect(img, 0, 28, w, 2, NAVY); fillRect(img, 1, 28, w - 2, 1, '#565972');
  // the register: cream body, mustard display, key grid, open-cup drawer
  fillRect(img, 3, 4, 11, 13, NAVY);
  fillRect(img, 4, 5, 9, 4, '#e8dcc4'); fillRect(img, 4, 5, 9, 1, '#fbf4e6');
  fillRect(img, 5, 6, 7, 2, '#2f4a3f'); put(img, 6, 6, '#8ff0a4'); put(img, 8, 6, '#8ff0a4'); put(img, 10, 6, '#8ff0a4'); // green digits
  fillRect(img, 4, 9, 9, 5, '#cdbfa6');
  for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 4; kx++) fillRect(img, 5 + kx * 2, 10 + ky * 2, 1, 1, kx === 3 ? '#c45c26' : '#f8f8f8');
  fillRect(img, 4, 14, 9, 2, '#a89a80'); fillRect(img, 6, 15, 5, 1, NAVY);
  fillRect(img, 12, 2, 1, 3, NAVY); fillRect(img, 12, 2, 1, 1, '#d93232'); // bell stem
  return { img, anchor: [8, 28] };
}

// ------------------------------------------------------------------ banqueta: chrome bar stool with a terracotta leather seat
export function banqueta() {
  const w = 14, h = 22;
  const img = blank(w, h);
  fillRect(img, 3, 9, 8, 1, NAVY); // pole shadow-free: legs first
  // pole
  fillRect(img, 6, 9, 2, 8, NAVY); fillRect(img, 6, 9, 1, 8, METAL.hi2); fillRect(img, 7, 9, 1, 8, METAL.mid);
  // foot ring + base
  fillRect(img, 3, 13, 8, 1, METAL.mid); put(img, 3, 13, NAVY); put(img, 10, 13, NAVY);
  fillRect(img, 2, 17, 10, 2, NAVY); fillRect(img, 3, 17, 8, 1, METAL.hi2); fillRect(img, 3, 18, 8, 1, METAL.lo);
  // seat: oval cushion
  for (let y = 0; y < 8; y++) for (let x = 0; x < w; x++) {
    const d = ((x - 6.5) / 6.4) ** 2 + ((y - 3.5) / 3.9) ** 2;
    if (d <= 1) put(img, x, y + 3, d > 0.72 ? NAVY : x + y < 9 ? '#d97a45' : y > 5 ? '#a94a24' : '#c45c26');
  }
  put(img, 4, 5, '#eda878'); put(img, 5, 5, '#eda878'); put(img, 3, 6, '#eda878');
  fillRect(img, 2, 10, 10, 1, NAVY); fillRect(img, 3, 10, 8, 1, '#8f3a1e');
  return { img, anchor: [7, 20] };
}

// ------------------------------------------------------------------ mesa: café table with a red-and-white checkered cloth
export function mesa() {
  const w = 20, h = 24;
  const img = blank(w, h);
  const top = (x, y) => (Math.floor((x - 1) / 2) + Math.floor(y / 2)) % 2 === 0;
  // table top (a rounded square seen from above) with the checker cloth
  for (let y = 4; y < 14; y++) for (let x = 1; x < w - 1; x++) {
    const edge = y === 4 || y === 13 || x === 1 || x === w - 2;
    put(img, x, y, edge ? NAVY : top(x, y) ? '#d93232' : '#f8f2e4');
  }
  for (let x = 2; x < w - 2; x++) put(img, x, 5, top(x, 5) ? '#ff8575' : '#ffffff'); // lit rim
  // cloth hanging in front (darker checks), scalloped hem
  for (let y = 14; y < 19; y++) for (let x = 2; x < w - 2; x++) put(img, x, y, (Math.floor((x - 2) / 2) + Math.floor(y / 2)) % 2 === 0 ? '#a82b2d' : '#d8ccb8');
  for (let x = 2; x < w - 2; x++) { put(img, x, 19, NAVY); if (x % 4 === 0) put(img, x, 18, NAVY); }
  fillRect(img, 1, 14, 1, 5, NAVY); fillRect(img, w - 2, 14, 1, 5, NAVY);
  // on the table: napkin holder, sugar bowl, a cup
  fillRect(img, 4, 6, 3, 4, NAVY); fillRect(img, 5, 6, 1, 3, '#c6bdd5'); put(img, 5, 5, '#f8f8f8');
  fillRect(img, 9, 8, 4, 3, NAVY); fillRect(img, 10, 8, 2, 2, '#f8f8f8'); put(img, 12, 9, '#f8f8f8');
  fillRect(img, 14, 6, 3, 3, NAVY); fillRect(img, 15, 6, 1, 2, '#c78c59');
  return { img, anchor: [10, 19] };
}

// ------------------------------------------------------------------ cadeira: wooden chair, 4 facings (E / W from the LimeZu kitchen sheet, N / S front-back)
export async function cadeira(ctx) {
  const k = await ctx.sheet('kitchen');
  const tr = (img) => { const r = trim(img).img; return { img: r, anchor: [Math.floor(r.w / 2), r.h - 2] }; };
  const e = tr(crop(k, 64, 176, 16, 32)); // red, back on the left -> faces east
  const wst = tr(crop(k, 112, 208, 16, 32)); // red, back on the right -> faces west
  const ns = tr(crop(k, 16, 192, 16, 24)); // red, seen head-on: backrest above the seat
  return [
    { key: 'props/cadeira_padaria_e', ...e },
    { key: 'props/cadeira_padaria_w', ...wst },
    { key: 'props/cadeira_padaria_n', ...ns },
    { key: 'props/cadeira_padaria_s', ...ns },
  ];
}
export { GLASS, mix, h2 };

/** `derive` registry entries (custom/derive.mjs spreads this): every generator returns manifest parts. */
const one = (fn) => (ctx, args) => {
  const r = fn(ctx, args);
  return [{ img: r.img, anchor: r.anchor }];
};
export const DERIVE_PADARIA = {
  padBalcao: (ctx, a) => balcao(ctx, a ?? {}),
  padVitrine: one(vitrine),
  padEstufa: () => {
    const a = estufa(), l = estufaLit();
    return [{ img: a.img, anchor: a.anchor, meta: { lit: 'props/estufa_lit' } }, { key: 'props/estufa_lit', img: l.img, anchor: l.anchor }];
  },
  padTrilho: () => {
    const r = trilho();
    return [{ frames: r.frames, anchor: r.anchor, fps: r.fps }];
  },
  padCaixa: one(caixa),
  padBanqueta: one(banqueta),
  padMesa: one(mesa),
  padCadeira: (ctx) => cadeira(ctx),
};
