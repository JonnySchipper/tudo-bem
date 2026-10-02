#!/usr/bin/env node
/**
 * Character peek: composes looks with the game's own code and writes a zoomed grid of single frames, for art review.
 *
 *   node scripts/character-peek.mjs <out.png> <scale> <spec.json>
 *
 * spec = [{ appearance?: Partial<Appearance>, opts?: LookOptions, npc?: string, row?: number, col?: number }] (row/col = sheet frame, default S idle 0).
 * Env: COLS (grid columns, 8), BG (#rrggbb background, #8a8a96), SUN (left|right: draws the ground tint only), BAND (draws each cell on a
 * light / dark halves background to judge the outline).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-peek-'));
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
const manifest = JSON.parse(fs.readFileSync(path.join(PIX, 'manifest.json'), 'utf8'));
const [FW, FH] = manifest.sheet.frame;
const SW = FW * manifest.sheet.cols, SH = FH * manifest.sheet.rows;
const layers = new Map();
for (const [k, f] of Object.entries(manifest.chars)) {
  const { data } = await sharp(path.join(PIX, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  layers.set(k, { data: new Uint8ClampedArray(data) });
}
const src = { sheetW: SW, sheetH: SH, geometry: { frameW: FW, frameH: FH, cols: manifest.sheet.cols, rows: manifest.sheet.rows }, layer: (k) => layers.get(k) };
const [out, scaleS, specFile] = process.argv.slice(2);
const S = Number(scaleS);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const base = { ...K.DEFAULT_APPEARANCE, body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 1, face: 'suave', extra: 'nenhum', idle: 'solto' };
const cols = Math.min(spec.length, Number(process.env.COLS || 8));
const rows = Math.ceil(spec.length / cols);
const bg = process.env.BG || '#8a8a96';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cw = FW * S + 4, ch = FH * S + 4;
const W = cols * cw + 4, H = rows * ch + 4;
const buf = Buffer.alloc(W * H * 4);
const [br, bgc, bb] = hex(bg);
for (let i = 0; i < W * H; i++) buf.set([br, bgc, bb, 255], i * 4);
spec.forEach((s, n) => {
  const look = s.npc ? K.lookForNpc(s.npc) : K.lookForAppearance({ ...base, ...(s.appearance || {}) }, s.opts || {});
  const sheet = K.composeLook(src, look);
  const ox = 4 + (n % cols) * cw, oy = 4 + Math.floor(n / cols) * ch;
  if (process.env.BAND) {
    const light = hex('#c9c3d6'), dark = hex('#4f5a45');
    for (let y = 0; y < FH * S; y++) for (let x = 0; x < FW * S; x++) buf.set([...(x < (FW * S) / 2 ? light : dark), 255], ((oy + y) * W + ox + x) * 4);
  }
  const row = s.row ?? 0, col = s.col ?? 0;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const si = ((row * FH + y) * SW + col * FW + x) * 4;
    const al = sheet[si + 3] / 255;
    if (!al) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const di = ((oy + y * S + dy) * W + ox + x * S + dx) * 4;
      for (let q = 0; q < 3; q++) buf[di + q] = Math.round(sheet[si + q] * al + buf[di + q] * (1 - al));
    }
  }
});
await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log('wrote', out, W, H);
