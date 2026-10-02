#!/usr/bin/env node
/** Per hair layer: lowest hair row (relative to the head top) in the face columns, S idle frame 0. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const k of ['curto', 'raspado', 'undercut', 'cacheado', 'black', 'ondulado', 'longo', 'coque', 'trancas']) {
  const { data, info } = await sharp(path.join(ROOT, 'apps/client/public/pixel/chars/hair_' + k + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols = [];
  for (let x = 2; x <= 13; x++) {
    let low = -1;
    for (let y = 0; y < 32; y++) if (data[((y) * info.width + x) * 4 + 3]) low = y;
    cols.push(low);
  }
  console.log(k.padEnd(9), cols.map((v) => String(v).padStart(3)).join(''));
}
