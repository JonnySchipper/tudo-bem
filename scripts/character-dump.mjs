#!/usr/bin/env node
/** Dumps one frame of a character layer as hex pixels: node scripts/character-dump.mjs <layerKey> <row> <col> (frame rows/cols of the canonical sheet). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [key, row, col] = [process.argv[2], Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 0)];
const { data, info } = await sharp(path.join(ROOT, 'apps/client/public/pixel/chars', key + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
console.log('    ' + Array.from({ length: 16 }, (_, x) => String(x).padEnd(6)).join(' '));
for (let y = 0; y < 32; y++) {
  let s = '';
  let any = false;
  for (let x = 0; x < 16; x++) {
    const i = ((row * 32 + y) * info.width + col * 16 + x) * 4;
    if (data[i + 3]) {
      any = true;
      s += ' ' + [0, 1, 2].map((q) => data[i + q].toString(16).padStart(2, '0')).join('') + (data[i + 3] < 255 ? '~' : ' ');
    } else s += ' ...... ';
  }
  if (any) console.log(String(y).padStart(2) + ' ' + s);
}
