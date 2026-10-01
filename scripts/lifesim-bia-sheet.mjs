#!/usr/bin/env node
/**
 * Professora Bia review sheet: her look composed with the game's own code (looks.ts -> composeLook), four facings idle frame 0 plus a walk
 * frame, at a large integer scale, and (with --portraits) her four portraits next to Júlia's for the style check.
 *
 *   pnpm pixel && node scripts/lifesim-bia-sheet.mjs [out.png] [scale] [--portraits=out.png]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const OUT = path.resolve(args[0] ?? path.join(ROOT, 'docs/lifesim/shots/art4/bia_look.png'));
const S = Number(args[1] ?? 12);
const NPC = flags.npc ?? 'prof';

const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-bia-'));
const outfile = path.join(tmp, 'bundle.mjs');
await build({
  stdin: {
    contents: `export * from './apps/client/src/render/pixel/looks.ts'; export { composeLook } from './apps/client/src/render/pixel/composeLook.ts';`,
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
for (const [key, file] of Object.entries(manifest.chars)) {
  const { data } = await sharp(path.join(PIX, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  layers.set(key, { data: new Uint8ClampedArray(data) });
}
const src = { sheetW: SW, sheetH: SH, geometry: { frameW: FW, frameH: FH, cols: manifest.sheet.cols, rows: manifest.sheet.rows }, layer: (k) => layers.get(k) };
const sheet = K.composeLook(src, K.lookForNpc(NPC));
const data = sheet.data ?? sheet;
const frame = async (row, col) => {
  const buf = Buffer.alloc(FW * FH * 4);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const si = ((row * FH + y) * SW + col * FW + x) * 4;
    for (let k = 0; k < 4; k++) buf[(y * FW + x) * 4 + k] = data[si + k];
  }
  return sharp(buf, { raw: { width: FW, height: FH, channels: 4 } }).resize(FW * S, FH * S, { kernel: 'nearest' }).png().toBuffer();
};
const cells = [];
for (const [row, col] of [[0, 0], [1, 0], [2, 0], [3, 0], [0, 2]]) cells.push(await frame(row, col));
const W = FW * S + 16;
await sharp({ create: { width: W * cells.length, height: FH * S + 16, channels: 4, background: '#b9c4cf' } })
  .composite(cells.map((input, i) => ({ input, left: i * W + 8, top: 8 })))
  .png()
  .toFile(OUT);
console.log('wrote', OUT);

if (flags.portraits) {
  const exprs = ['neutro', 'feliz', 'surpreso', 'pensativo'];
  const rows = [['prof', 'prof'], ['julia', 'julia']];
  const comps = [];
  let ri = 0;
  for (const [, id] of rows) {
    for (let i = 0; i < exprs.length; i++) {
      const file = path.join(PIX, 'portraits', `${id}_${exprs[i]}.png`);
      if (!fs.existsSync(file)) continue;
      comps.push({ input: await sharp(file).resize(64 * 4, 64 * 4, { kernel: 'nearest' }).png().toBuffer(), left: 8 + i * 272, top: 8 + ri * 272 });
    }
    ri++;
  }
  await sharp({ create: { width: 8 + 4 * 272, height: 8 + 2 * 272, channels: 4, background: '#2a2733' } }).composite(comps).png().toFile(path.resolve(flags.portraits));
  console.log('wrote', flags.portraits);
}
