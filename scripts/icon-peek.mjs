#!/usr/bin/env node
/**
 * Dev tool: draws item icons straight from the generator (`assets-src/custom/icons.mjs`, no `pnpm pixel` needed), side by side and upscaled.
 *   node scripts/icon-peek.mjs out.png scale id [id...]
 */
import { ICONS } from '../apps/client/assets-src/custom/icons.mjs';
import { blank, paste, savePng } from './lib/pixel/img.mjs';

const [out, s, ...ids] = process.argv.slice(2);
const S = Number(s);
const GAP = 2;
const sheet = blank((16 + GAP) * ids.length, 16);
ids.forEach((id, i) => {
  if (!ICONS[id]) throw new Error(`no icon ${id}`);
  paste(sheet, ICONS[id](), i * (16 + GAP), 0);
});
const big = blank(sheet.w * S, sheet.h * S);
const BG = [138, 138, 148];
for (let y = 0; y < big.h; y++) for (let x = 0; x < big.w; x++) {
  const si = (Math.floor(y / S) * sheet.w + Math.floor(x / S)) * 4;
  const di = (y * big.w + x) * 4;
  const a = sheet.data[si + 3];
  for (let c = 0; c < 3; c++) big.data[di + c] = a ? sheet.data[si + c] : BG[c];
  big.data[di + 3] = 255;
}
await savePng(big, out);
console.log('wrote', out);
