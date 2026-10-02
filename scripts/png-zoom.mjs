#!/usr/bin/env node
/** Dev tool: crop and nearest-neighbour zoom of a PNG over a flat background. node scripts/png-zoom.mjs in.png out.png scale [#bg] [x,y,w,h] */
import sharp from 'sharp';

const [input, out, scale, bg = '#8a8a94', crop] = process.argv.slice(2);
let img = sharp(input);
let { width, height } = await sharp(input).metadata();
if (crop) {
  const [left, top, w, h] = crop.split(',').map(Number);
  img = img.extract({ left, top, width: w, height: h });
  width = w;
  height = h;
}
await img
  .resize(width * Number(scale), height * Number(scale), { kernel: 'nearest' })
  .flatten({ background: bg })
  .png()
  .toFile(out);
console.log('wrote', out);
