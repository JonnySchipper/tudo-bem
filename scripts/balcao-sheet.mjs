// Contact sheet of every balcao/* key + fx/steam_* at 4x (animations as strips) and a mock composite of the counter work area at game zoom 3
//   node scripts/balcao-sheet.mjs [out.png]      -> docs/lifesim/shots/correria-art/sheet.png
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { balcaoParts } from '../apps/client/assets-src/custom/balcao.mjs';

const out = process.argv[2] ?? 'docs/lifesim/shots/correria-art/sheet.png';
const parts = new Map(balcaoParts().map((p) => [p.key, p]));
const get = (k) => { const p = parts.get(k); if (!p) throw new Error(k); return p; };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

class Canvas {
  constructor(w, h, bg) { this.w = w; this.h = h; this.d = new Uint8Array(w * h * 3); this.fill(0, 0, w, h, bg); }
  fill(x, y, w, h, c) { const [r, g, b] = typeof c === 'string' ? hex(c) : c; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue; const i = (yy * this.w + xx) * 3; this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; } }
  /** blit a sprite at (x, y) (top-left, world px) scaled by s, alpha composited */
  blit(img, x, y, s) {
    for (let yy = 0; yy < img.h; yy++) for (let xx = 0; xx < img.w; xx++) {
      const i = (yy * img.w + xx) * 4; const a = img.data[i + 3] / 255; if (!a) continue;
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
        const tx = x + xx * s + sx, ty = y + yy * s + sy; if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const j = (ty * this.w + tx) * 3;
        for (let c = 0; c < 3; c++) this.d[j + c] = Math.round(img.data[i + c] * a + this.d[j + c] * (1 - a));
      }
    }
  }
  /** blit a sprite by its anchor at world position (wx, wy) with an origin at (ox, oy) screen px */
  place(key, wx, wy, ox, oy, s) { const p = get(key); this.blit(p.img, ox + (wx - p.anchor[0]) * s, oy + (wy - p.anchor[1] + 1) * s, s); }
}

const S = 4, PAD = 10;
const rows = [
  ['items', ['pao', 'pao_na_chapa', 'pastel', 'coxinha', 'bolo', 'cafe'].map((i) => `balcao/item_${i}`)],
  ['items', ['cafe_com_leite', 'suco_de_laranja', 'agua', 'pao_de_queijo', 'misto_quente', 'guarana'].map((i) => `balcao/item_${i}`)],
  ['tray', ['balcao/tray', 'balcao/tray_full', 'balcao/bag', 'balcao/plate']],
  ['chapa', ['balcao/chapa_idle', 'balcao/chapa_sizzle_0', 'balcao/chapa_sizzle_1', 'balcao/chapa_sizzle_2', 'balcao/chapa_burnt']],
  ['coffee', ['balcao/coffee_idle', ...[0, 1, 2, 3].map((k) => `balcao/coffee_pour_${k}`), 'balcao/register']],
  ['small', ['balcao/bell_0', 'balcao/bell_1', ...[0, 1, 2, 3].map((k) => `balcao/tipjar_${k}`), ...[0, 1, 2, 3, 4].map((k) => `balcao/patience_${k}`), ...[0, 1, 2, 3].map((k) => `fx/steam_${k}`)]],
];
const BG = '#7d6d86';
const widthOf = (keys) => keys.reduce((a, k) => a + get(k).img.w * S + PAD, PAD);
const rowW = Math.max(...rows.map((r) => widthOf(r[1])));
const rowH = (keys) => Math.max(...keys.map((k) => get(k).img.h)) * S + PAD;
const sheetH = rows.reduce((a, r) => a + rowH(r[1]), PAD);
const Z = 3;
const mockW = 144 * Z, mockH = 104 * Z;
const W = Math.max(rowW, mockW + PAD * 2);
const cv = new Canvas(W, sheetH + mockH + PAD * 3, BG);
let y = PAD;
for (const [, keys] of rows) {
  let x = PAD;
  const h = rowH(keys) - PAD;
  for (const k of keys) {
    const p = get(k);
    cv.fill(x - 2, y - 2, p.img.w * S + 4, h + 4, '#f3e8d6');
    cv.blit(p.img, x, y + (h - p.img.h * S), S);
    x += p.img.w * S + PAD;
  }
  y += rowH(keys);
}

// ------------------------------------------------------------------ mock composite at zoom 3 (130 x 92 world px)
const ox = PAD, oy = y + PAD;
const M = new Canvas(mockW, mockH, '#e9d3b6');
const WW = 144;
// back wall: cream with a terracotta tile wainscot
M.fill(0, 0, mockW, 41 * Z, '#f1dfc4');
M.fill(0, 28 * Z, mockW, 12 * Z, '#d97a45');
for (let i = 0; i < WW; i += 6) { M.fill(i * Z, 28 * Z, 1, 12 * Z, '#a94a24'); M.fill(i * Z, 28 * Z, 6 * Z, Z, '#eda878'); }
M.fill(0, 40 * Z, mockW, Z, '#8b5e3c');
// counter top (cream) with a lip and the striped front, as in the padaria
M.fill(0, 41 * Z, mockW, 41 * Z, '#f6ead4');
for (let i = 0; i < WW; i++) { if ((i >> 1) % 2 === 0) continue; M.fill(i * Z, 41 * Z, Z, 2 * Z, '#eadbbf'); }
M.fill(0, 82 * Z, mockW, 3 * Z, '#d8c4a6');
M.fill(0, 85 * Z, mockW, 19 * Z, '#c45c26');
for (let i = 0; i < WW; i += 4) M.fill((i + 2) * Z, 85 * Z, 2 * Z, 19 * Z, '#f5e6d3');
M.fill(0, 85 * Z, mockW, Z, '#3a3a50');
// customer placeholder with the patience meter over their head
M.fill(75 * Z, 14 * Z, 14 * Z, 27 * Z, '#4a4c63');
M.fill(79 * Z, 7 * Z, 8 * Z, 8 * Z, '#d9a07a');
// back row (feet y 62): chapa, coffee machine, register, bell, tip jar
M.place('balcao/chapa_sizzle_1', 22, 62, 0, 0, Z);
M.place('fx/steam_1', 22, 41, 0, 0, Z);
M.place('balcao/coffee_pour_2', 58, 62, 0, 0, Z);
M.place('fx/steam_3', 62, 31, 0, 0, Z);
M.place('balcao/register', 92, 62, 0, 0, Z);
M.place('balcao/bell_0', 76, 62, 0, 0, Z);
M.place('balcao/tipjar_2', 130, 62, 0, 0, Z);
// front row (feet y 80): plate with a pão na chapa, loaded tray, the bag, loose drinks
M.place('balcao/plate', 14, 80, 0, 0, Z);
M.place('balcao/item_pao_na_chapa', 14, 76, 0, 0, Z);
M.place('balcao/tray_full', 48, 80, 0, 0, Z);
M.place('balcao/bag', 80, 80, 0, 0, Z);
M.place('balcao/item_guarana', 100, 79, 0, 0, Z);
M.place('balcao/item_cafe_com_leite', 116, 79, 0, 0, Z);
M.place('balcao/patience_1', 83, 6, 0, 0, Z);
cv.blit({ w: mockW, h: mockH, data: (() => { const d = new Uint8Array(mockW * mockH * 4); for (let i = 0; i < mockW * mockH; i++) { d[i * 4] = M.d[i * 3]; d[i * 4 + 1] = M.d[i * 3 + 1]; d[i * 4 + 2] = M.d[i * 3 + 2]; d[i * 4 + 3] = 255; } return d; })() }, ox, oy, 1);

fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(Buffer.from(cv.d), { raw: { width: cv.w, height: cv.h, channels: 3 } }).png().toFile(out);
console.log('wrote', out, cv.w, 'x', cv.h);
