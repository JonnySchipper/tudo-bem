#!/usr/bin/env node
/**
 * Dev tool: renders the kitnet `gato` furniture loop straight from assets-src (no `pnpm pixel` needed).
 *   node --experimental-strip-types scripts/kitnet-cat-preview.mjs <out-prefix> [scale=8]
 * Writes <out-prefix>_strip.png (every unique frame, upscaled, on the kitnet floor tone) and <out-prefix>.gif (the loop at its real
 * timing, both rotations side by side).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { blank, loadPng, paste } from './lib/pixel/img.mjs';
import { loadImportMap } from './lib/pixel/importmap.mjs';
import { gato } from '../apps/client/assets-src/custom/kitnet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'apps/client/assets-src');
const map = loadImportMap(SRC);
const [outPrefix = '/tmp/gato', scaleS = '8'] = process.argv.slice(2);
const S = Number(scaleS);
const BG = [0xc9, 0xa2, 0x7a, 255];

const ctx = {
  async sheet(name) {
    const spec = map.sheets[name];
    const [root, rest] = spec.split(':');
    return loadPng(path.join(SRC, map.roots[root], rest));
  },
};

const parts = await Promise.all([0, 1].map(async (rot) => (await gato(ctx, { rot }))[0]));
const { frames, seq = frames.map((_, i) => i), fps } = parts[0];
const fw = frames[0].w, fh = frames[0].h, pad = 4;

function canvas(w, h) {
  const c = blank(w, h);
  for (let i = 0; i < c.data.length; i += 4) c.data.set(BG, i);
  return c;
}
const up = (img) => sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } }).resize(img.w * S, img.h * S, { kernel: 'nearest' });

// strip of unique frames
const strip = canvas(frames.length * (fw + pad) + pad, fh + pad * 2);
frames.forEach((f, i) => paste(strip, f, pad + i * (fw + pad), pad));
await up(strip).png().toFile(`${outPrefix}_strip.png`);

// animated loop: rot 0 and rot 1 side by side
const pageW = (fw + pad) * 2 + pad, pageH = fh + pad * 2;
const tall = blank(pageW * S, pageH * S * seq.length);
for (const [p, i] of seq.entries()) {
  const page = canvas(pageW, pageH);
  paste(page, parts[0].frames[i], pad, pad);
  paste(page, parts[1].frames[i], pad * 2 + fw, pad);
  const big = await up(page).raw().toBuffer();
  tall.data.set(big, p * pageW * S * pageH * S * 4);
}
await sharp(Buffer.from(tall.data), { raw: { width: pageW * S, height: pageH * S * seq.length, channels: 4, pageHeight: pageH * S } })
  .gif({ loop: 0, delay: seq.map(() => Math.round(1000 / fps)) })
  .toFile(`${outPrefix}.gif`);
console.log(`wrote ${outPrefix}_strip.png and ${outPrefix}.gif (${frames.length} unique frames, ${seq.length} steps at ${fps} fps = ${(seq.length / fps).toFixed(2)} s)`);
