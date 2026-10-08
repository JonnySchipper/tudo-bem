// Contact sheet of the espremedor art at 6x: the machine cycle (idle, roll, cut, press, pour, peel), the glass levels with the line,
// the overflow, the three orange sizes and the shelf crate.
//   node scripts/juicer-sheet.mjs [out.png]      -> docs/lifesim/shots/juicer/sheet.png
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { juicerParts, JUICER_STEPS, GLASS_LEVELS } from '../apps/client/assets-src/custom/juicer.mjs';

const out = process.argv[2] ?? 'docs/lifesim/shots/juicer/sheet.png';
const parts = new Map(juicerParts().map((p) => [p.key, p]));
const S = 6, PAD = 12;
const rows = [
  JUICER_STEPS.map((s) => `balcao/juicer_${s}`),
  [...Array.from({ length: GLASS_LEVELS }, (_, k) => `balcao/juice_glass_${k}`), 'balcao/juice_glass_spill'],
  ['balcao/orange_p', 'balcao/orange_m', 'balcao/orange_g', 'balcao/laranjas'],
];
const rowW = (keys) => keys.reduce((a, k) => a + parts.get(k).img.w * S + PAD, PAD);
const rowH = (keys) => Math.max(...keys.map((k) => parts.get(k).img.h)) * S + PAD;
const W = Math.max(...rows.map(rowW));
const H = rows.reduce((a, r) => a + rowH(r), PAD);
const px = new Uint8Array(W * H * 3);
const bg = [0xcf, 0x9b, 0x62];
for (let i = 0; i < W * H; i++) px.set(bg, i * 3);
let y = PAD;
for (const keys of rows) {
  let x = PAD;
  const h = rowH(keys) - PAD;
  for (const k of keys) {
    const { img } = parts.get(k);
    const oy = y + h - img.h * S;
    for (let yy = 0; yy < img.h; yy++) for (let xx = 0; xx < img.w; xx++) {
      const i = (yy * img.w + xx) * 4;
      if (!img.data[i + 3]) continue;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) px.set([img.data[i], img.data[i + 1], img.data[i + 2]], ((oy + yy * S + sy) * W + x + xx * S + sx) * 3);
    }
    x += img.w * S + PAD;
  }
  y += rowH(keys);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(Buffer.from(px), { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
console.log(`wrote ${out} (${W}x${H})`);
