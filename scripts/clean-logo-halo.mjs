/**
 * Strip the faint cream fringe around the official logos.
 *
 * The source PNGs are binary-alpha (0 or 255). A one-pixel pale cream outline
 * sits on the transparent edge and reads as a halo on dark scenes (the title
 * screen and the landing street). Interior letter highlights and the tan
 * extrusion stay: only pale cream pixels that touch transparency are cleared.
 *
 *   node scripts/clean-logo-halo.mjs
 *
 * Reads assets-src/brand/tb-logo-{stacked,banner}.png and writes
 * apps/client/public/brand/.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'assets-src/brand');
const outDir = path.join(root, 'apps/client/public/brand');

/** Pale cream, not the yellow letters (low blue) and not the tan extrusion. */
function isFringe(r, g, b, a) {
  if (a === 0) return false;
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn > 175 && mx - mn < 70 && b > 165 && r > 190 && g > 175;
}

async function clean(name) {
  const input = path.join(srcDir, name);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pix = Buffer.from(data);
  const fringe = new Uint8Array(width * height);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pix[i + 3] !== 0) continue;
      const n = y * width + x;
      fringe[n] = 1;
      queue.push(n);
    }
  }
  let q = 0;
  let removed = 0;
  while (q < queue.length) {
    const n = queue[q++];
    const x = n % width;
    const y = (n - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const m = ny * width + nx;
      if (fringe[m]) continue;
      const i = m * 4;
      if (!isFringe(pix[i], pix[i + 1], pix[i + 2], pix[i + 3])) continue;
      fringe[m] = 1;
      pix[i] = pix[i + 1] = pix[i + 2] = pix[i + 3] = 0;
      removed++;
      queue.push(m);
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  // palette PNG (~70% smaller than truecolour; checked by eye for banding at 3x zoom)
  await sharp(pix, { raw: { width, height, channels: 4 } }).png({ palette: true, quality: 65, dither: 0.5, effort: 10, compressionLevel: 9 }).toFile(path.join(outDir, name));
  console.log(`${name}: cleared ${removed} fringe pixels`);
}

await clean('tb-logo-stacked.png');
await clean('tb-logo-banner.png');
