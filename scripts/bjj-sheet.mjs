// Contact sheet of every bjj/* key at 4x (animations as frame strips, each pair also with 3 skin/hair swaps) -> docs/lifesim/shots/academia-art/sheet.png
//   node scripts/bjj-sheet.mjs [out.png] [scale] [filter]    filter = substring of the key to limit the sheet
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { bjjFrames, placar } from '../apps/client/assets-src/custom/bjj.mjs';
import { swapKeys, KEY_RAMPS, buildRamp, rampMap, mergeTables } from '../apps/client/src/render/pixel/palette.ts';

const out = process.argv[2] ?? 'docs/lifesim/shots/academia-art/sheet.png';
const S = Number(process.argv[3] ?? 4);
const filter = process.argv[4] ?? '';
const tableFor = (r) => mergeTables(...Object.entries(r).map(([n, b]) => rampMap(KEY_RAMPS[n], buildRamp(b, KEY_RAMPS[n].length))));
const SWAPS = [
  { skin: '#d9a07a', hair: '#3a2418', skin2: '#8a5a3a', hair2: '#1c1c20', belt: '#f2f2f2' },
  { skin: '#f1c9a5', hair: '#c9a04a', skin2: '#c68642', hair2: '#6b2a12', belt: '#3a6fd0' },
  { skin: '#8a5a3a', hair: '#1c1c20', skin2: '#f1c9a5', hair2: '#d0562a', belt: '#f2f2f2' },
  { skin: '#c68642', hair: '#d0562a', skin2: '#e0ac86', hair2: '#2a1a14', belt: '#3a6fd0' },
];
const frames = bjjFrames().filter((f) => f.key.includes(filter));
const byGroup = new Map();
for (const f of frames) {
  const g = f.key.replace(/_\d$/, '');
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(f);
}
const groups = [...byGroup.entries()];
const swapped = (img, sw) => { const c = { w: img.w, h: img.h, data: new Uint8Array(img.data) }; swapKeys(c.data, tableFor(sw)); return c; };

const PAD = 4, LABEL = 12;
const cells = []; // { img, x, y }
const labels = [];
const COLS = 2;
let col = 0, rowY = 0, rowH = 0, maxX = 0;
const place = (g, imgs, label) => {
  const w = imgs.reduce((a, i) => a + i.w * S + PAD, 0);
  const h = Math.max(...imgs.map((i) => i.h)) * S + LABEL + PAD;
  if (col === COLS) { col = 0; rowY += rowH; rowH = 0; }
  const colW = 4 * 64 * S + 5 * PAD;
  const x0 = col * colW;
  let x = x0;
  labels.push({ x: x0 + 2, y: rowY + 10, text: label });
  for (const img of imgs) { cells.push({ img, x, y: rowY + LABEL }); x += img.w * S + PAD; }
  maxX = Math.max(maxX, x0 + colW);
  rowH = Math.max(rowH, h);
  col++;
};
for (const [g, fs_] of groups) {
  if (g.startsWith('bjj/ref_')) continue;
  place(g, fs_.map((f) => swapped(f.img, SWAPS[0])), g.replace('bjj/', ''));
}
const refs = frames.filter((f) => f.key.startsWith('bjj/ref_'));
if (refs.length) place('refs', refs.map((f) => swapped(f.img, SWAPS[0])), 'ref_combate pontos2 pontos3 pontos4 vantagem parar vitoria');
if (!filter || filter === 'placar') place('placar', [placar().img], 'props/placar');
// swaps: each position's frame 0 in 4 appearances
col = COLS; // new row
for (const id of ['de_pe', 'guarda_fechada', 'meia_guarda', 'cem_quilos', 'joelho', 'montada', 'costas', 'finish_tap']) {
  const f0 = frames.find((f) => f.key === `bjj/${id.startsWith('finish') ? id + '_0' : 'pair_' + id + '_0'}`);
  if (!f0) continue;
  place('sw', SWAPS.map((sw) => swapped(f0.img, sw)), `${id} swaps`);
}
const width = maxX, height = rowY + rowH + 8;
const raw = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) { raw[i * 4] = 98; raw[i * 4 + 1] = 142; raw[i * 4 + 2] = 98; raw[i * 4 + 3] = 255; }
for (const { img, x, y } of cells) {
  for (let yy = 0; yy < img.h * S; yy++) for (let xx = 0; xx < img.w * S; xx++) {
    const si = (Math.floor(yy / S) * img.w + Math.floor(xx / S)) * 4;
    const a = img.data[si + 3];
    const edge = xx === 0 || yy === 0;
    const di = ((y + yy) * width + x + xx) * 4;
    if (a) { raw[di] = img.data[si]; raw[di + 1] = img.data[si + 1]; raw[di + 2] = img.data[si + 2]; }
    else if (edge) { raw[di] = 70; raw[di + 1] = 105; raw[di + 2] = 70; }
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${labels.map((l) => `<text x="${l.x}" y="${l.y}" font-family="monospace" font-size="10" fill="#fff">${l.text}</text>`).join('')}</svg>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(raw, { raw: { width, height, channels: 4 } }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out);
console.log('wrote', out, width, height);
