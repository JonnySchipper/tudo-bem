#!/usr/bin/env node
/**
 * Phase 3 character lineup: composes characters with the SAME code the game runs (looks.ts -> composeLook -> charcompose.ts, bundled
 * with esbuild) from the layer PNGs in public/pixel/chars, and lays them out as one contact sheet.
 *
 *   pnpm pixel && node scripts/character-lineup.mjs [out.png] [scale]
 *
 * Sections: 8 skin tones x 4 hair styles, all 9 hair styles, all 12 hats (S and E), the 5 NPCs, the 5 emotes (+ the phone pose) as frame
 * strips, the 3 body types, the 15 top x bottom combinations, faces, extras and idle poses.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/lifesim/shots/p3/lineup.png'));
const S = Number(process.argv[3] ?? 5);

// ---- bundle the client modules that compose a look (pure TS, no Phaser)
const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild'); // esbuild is a server dev dependency
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-lineup-'));
const outfile = path.join(tmp, 'bundle.mjs');
await build({
  stdin: {
    contents: `export * from './apps/client/src/render/pixel/looks.ts'; export { composeLook } from './apps/client/src/render/pixel/composeLook.ts';
      export * from './packages/shared/src/index.ts';`,
    resolveDir: ROOT,
    sourcefile: 'entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
});
const K = await import(pathToFileURL(outfile).href);
const { lookForAppearance, lookForNpc, composeLook, DEFAULT_APPEARANCE, HATS, HAIR_STYLES, BODY_TYPES, TOP_STYLES, BOTTOM_STYLES, FACE_STYLES, EXTRA_STYLES, IDLE_POSES } = K;

const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const [FW, FH] = manifest.sheet.frame;
const SW = FW * manifest.sheet.cols, SH = FH * manifest.sheet.rows;
const layers = new Map();
for (const [key, file] of Object.entries(manifest.chars)) {
  const { data } = await sharp(path.join(PIX, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  layers.set(key, { data: new Uint8ClampedArray(data) });
}
const src = { sheetW: SW, sheetH: SH, geometry: { frameW: FW, frameH: FH, cols: manifest.sheet.cols, rows: manifest.sheet.rows }, layer: (k) => layers.get(k) };
const sheetOf = (look) => composeLook(src, look);

const A = (o = {}) => ({ ...DEFAULT_APPEARANCE, body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 1, face: 'suave', extra: 'nenhum', idle: 'solto', ...o });
const ROW = { S: 0, W: 1, E: 2, N: 3 };
const anims = manifest.sheet.anims;

// ---- canvas
const cells = []; // { x, y, w, h, rgba? , svg? }
let cursorY = 24;
const MAXW = 2400;
const labels = [];
const frameRgba = (sheet, row, col) => {
  const out = Buffer.alloc(FW * FH * 4);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const si = ((row * FH + y) * SW + col * FW + x) * 4;
    out.set(sheet.subarray(si, si + 4), (y * FW + x) * 4);
  }
  return out;
};
const composites = [];
function place(rgba, x, y, w, h) {
  composites.push({ rgba, x, y, w, h });
}
/** A run of frames laid out left to right, wrapping when the row is full. Returns the next y. */
function section(title, groups, { gap = 14, fillBg } = {}) {
  labels.push({ x: 12, y: cursorY + 14, text: title, size: 18, bold: true });
  cursorY += 30;
  let x = 12;
  let rowH = 0;
  for (const g of groups) {
    const w = g.frames.length * (FW * S + 4) - 4;
    if (x + w > MAXW - 12) {
      x = 12;
      cursorY += rowH + 34;
      rowH = 0;
    }
    labels.push({ x, y: cursorY + 12, text: g.label, size: 12 });
    g.frames.forEach((f, i) => place(f, x + i * (FW * S + 4), cursorY + 20, FW, FH));
    rowH = Math.max(rowH, FH * S + 20);
    x += w + gap;
  }
  cursorY += rowH + 40;
}
const fr = (look, list) => {
  const sheet = sheetOf(look);
  return list.map(([row, col]) => frameRgba(sheet, row, col));
};
const faces = (look) => fr(look, [[ROW.S, 0], [ROW.E, 0], [ROW.N, 0]]);

// 1. 8 skin tones x 4 hair styles
{
  const groups = [];
  for (const hair of ['curto', 'cacheado', 'longo', 'black']) for (let skin = 0; skin < 8; skin++) groups.push({ label: `${hair} / skin ${skin}`, frames: fr(lookForAppearance(A({ skin, hair, hairColor: [1, 0, 3, 5][['curto', 'cacheado', 'longo', 'black'].indexOf(hair)], topColor: (skin * 2) % 13, bottomColor: 2 })), [[0, 0], [2, 0]]) });
  section('8 skin tones x 4 hair styles (S and E)', groups, { gap: 10 });
}
// 2. all 9 hair styles x 3 facings
section('All 9 hair styles (S, E, N)', HAIR_STYLES.map((hair, i) => ({ label: hair, frames: faces(lookForAppearance(A({ hair, hairColor: i % 8, skin: 1 + (i % 4) }))) })));
// 3. hats
section('All 12 hats (S, E, N; catalog colors)', HATS.map((h, i) => ({ label: h.id, frames: faces(lookForAppearance(A({ hair: ['curto', 'longo', 'cacheado', 'undercut'][i % 4], hairColor: [1, 0, 3, 2][i % 4], skin: [1, 2, 4, 5][i % 4] }), { hat: h.id })) })));
// 4. NPCs
section('NPCs (S, E, N)', ['carlos', 'nanda', 'julia', 'graca', 'tia_lu'].map((id) => ({ label: id, frames: faces(lookForNpc(id)) })));
// 5. emotes
{
  const look = lookForAppearance(A({ skin: 2, hair: 'ondulado', hairColor: 2, top: 'camiseta', topColor: 0, bottom: 'bermuda', bottomColor: 2 }));
  const sheet = sheetOf(look);
  const strip = (name, n) => Array.from({ length: n }, (_, c) => frameRgba(sheet, anims[name].row, c));
  const groups = [
    { label: 'oi (wave)', frames: strip('oi', anims.oi.frames) },
    { label: 'dancar (dance)', frames: strip('dancar', anims.dancar.frames) },
    { label: 'rir (laugh)', frames: strip('rir', anims.rir.frames) },
    { label: 'valeu (thumbs up)', frames: strip('valeu', anims.valeu.frames) },
    { label: 'desculpa (sorry: the pack bow)', frames: strip('desculpa', anims.desculpa.frames) },
  ];
  const phone = sheetOf(lookForAppearance(A({ idle: 'celular', skin: 2, hair: 'ondulado', hairColor: 2, top: 'camiseta', topColor: 0 })));
  groups.push({ label: 'idle: celular (pack phone loop)', frames: Array.from({ length: anims.phone.frames }, (_, c) => frameRgba(phone, anims.phone.row, c)) });
  section('Emotes as frame strips (real frames; gesture layer on top)', groups, { gap: 24 });
}
// 6. body types
section('Body types (S, E, N; esguio / medio / forte)', BODY_TYPES.flatMap((body) => [
  { label: `${body} camisa/calca`, frames: faces(lookForAppearance(A({ body }))) },
  { label: `${body} camiseta/bermuda`, frames: faces(lookForAppearance(A({ body, top: 'camiseta', bottom: 'bermuda', topColor: 3, bottomColor: 2 }))) },
]));
// 7. 15 combos
{
  const groups = [];
  let i = 0;
  for (const top of TOP_STYLES) for (const bottom of BOTTOM_STYLES) groups.push({ label: `${top}/${bottom}`, frames: fr(lookForAppearance(A({ top, bottom, topColor: [0, 3, 7, 1, 9][i % 5], bottomColor: [2, 5, 10, 2, 3][(i + 1) % 5], skin: 2, hair: 'curto', hairColor: 1 })), [[0, 0], [2, 0], [3, 0]]) }), i++;
  section('Top x bottom: 5 x 3 outfits (S, E, N)', groups, { gap: 12 });
}
// 8. faces, extras, idle poses
section('Faces (suave marcante doce maduro) and extras (oculos barba bigode brincos sardas)', [
  ...FACE_STYLES.map((face) => ({ label: face, frames: fr(lookForAppearance(A({ face, skin: 3 })), [[0, 0], [2, 0]]) })),
  ...EXTRA_STYLES.filter((e) => e !== 'nenhum').map((extra) => ({ label: extra, frames: fr(lookForAppearance(A({ extra, skin: 2 })), [[0, 0], [2, 0]]) })),
]);
section('Idle poses (S, E)', IDLE_POSES.map((idle) => ({ label: idle, frames: fr(lookForAppearance(A({ idle, top: 'camiseta', topColor: 0 })), [[idle === 'celular' ? anims.phone.row : 0, 0], [2, 0]]) })));

// ---- render
const H = cursorY + 20;
const canvas = Buffer.alloc(MAXW * H * 4);
for (let i = 0; i < MAXW * H; i++) canvas.set([138, 138, 148, 255], i * 4);
for (const c of composites) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const si = (y * c.w + x) * 4;
    const a = c.rgba[si + 3];
    if (!a) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const di = ((c.y + y * S + dy) * MAXW + c.x + x * S + dx) * 4;
      const fa = a / 255;
      for (let q = 0; q < 3; q++) canvas[di + q] = Math.round(c.rgba[si + q] * fa + canvas[di + q] * (1 - fa));
    }
  }
}
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MAXW}" height="${H}">${labels.map((l) => `<text x="${l.x}" y="${l.y}" font-size="${l.size}" font-family="sans-serif" ${l.bold ? 'font-weight="bold"' : ''} fill="#101018">${esc(l.text)}</text>`).join('')}</svg>`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(canvas, { raw: { width: MAXW, height: H, channels: 4 } }).composite([{ input: svg }]).png().toFile(OUT);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${path.relative(ROOT, OUT)} ${MAXW}x${H}`);
