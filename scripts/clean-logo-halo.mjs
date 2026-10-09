/**
 * Strip the cream fringe and the beige drop shadow around the official logos.
 *
 * The source PNGs are binary-alpha (0 or 255). Two things sit on the
 * transparent edge and read as a halo on anything but the beige credits card:
 *   - a one-pixel pale cream outline;
 *   - a warm beige drop shadow down and right of the letters and the parrot.
 * Both are cleared by flooding in from transparency. The shadow also shows in
 * gaps between letters that the green outline closes off, so warm beige
 * pockets ringed only by dark outline are cleared too. The neutral grey beak,
 * claws and eye highlights are not warm, so they stay.
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

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Smallest enclosed pocket we clear; smaller warm specks are feather detail. */
const MIN_POCKET = 100;

/** Pale cream, not the yellow letters (low blue) and not the tan extrusion. */
function isFringe(r, g, b) {
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn > 175 && mx - mn < 70 && b > 165 && r > 190 && g > 175;
}

/** Drop shadow: light, low saturation, and warm (blue clearly below red and green). */
function isShadow(r, g, b) {
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn >= 80 && mx - mn < 70 && Math.min(r, g) - b >= 14;
}

/** Looser light test used to grow enclosed pockets, which also hold neutral highlights. */
function isLight(r, g, b) {
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn >= 80 && mx - mn < 70 && r >= b - 8;
}

function isDark(r, g, b) {
  return Math.max(r, g, b) < 130;
}

async function clean(name) {
  const input = path.join(srcDir, name);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pix = Buffer.from(data);
  const clear = (i) => { pix[i] = pix[i + 1] = pix[i + 2] = pix[i + 3] = 0; };
  const neighbours = function* (n) {
    const x = n % width;
    const y = (n - x) / width;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) yield ny * width + nx;
    }
  };

  // Pass 1: flood in from transparency through fringe and shadow pixels.
  const seen = new Uint8Array(width * height);
  const queue = [];
  for (let n = 0; n < width * height; n++) {
    if (pix[n * 4 + 3] !== 0) continue;
    seen[n] = 1;
    queue.push(n);
  }
  let removed = 0;
  for (let q = 0; q < queue.length; q++) {
    for (const m of neighbours(queue[q])) {
      if (seen[m]) continue;
      const i = m * 4;
      if (!isFringe(pix[i], pix[i + 1], pix[i + 2]) && !isShadow(pix[i], pix[i + 1], pix[i + 2])) continue;
      seen[m] = 1;
      clear(i);
      removed++;
      queue.push(m);
    }
  }

  // Pass 2: warm light pockets closed off by the outline (shadow between letters).
  const done = new Uint8Array(width * height);
  let pockets = 0;
  for (let n = 0; n < width * height; n++) {
    const i = n * 4;
    if (done[n] || pix[i + 3] === 0 || !isLight(pix[i], pix[i + 1], pix[i + 2])) continue;
    const comp = [n];
    done[n] = 1;
    let warmth = 0;
    let edge = 0;
    let foreign = 0;
    for (let c = 0; c < comp.length; c++) {
      const ci = comp[c] * 4;
      warmth += pix[ci] - pix[ci + 2];
      for (const m of neighbours(comp[c])) {
        if (done[m]) continue;
        const j = m * 4;
        if (pix[j + 3] !== 0 && isLight(pix[j], pix[j + 1], pix[j + 2])) {
          done[m] = 1;
          comp.push(m);
        } else {
          edge++;
          if (pix[j + 3] !== 0 && !isDark(pix[j], pix[j + 1], pix[j + 2])) foreign++;
        }
      }
    }
    if (comp.length < MIN_POCKET || warmth / comp.length < 20 || foreign > edge * 0.1) continue;
    for (const m of comp) clear(m * 4);
    removed += comp.length;
    pockets++;
  }

  fs.mkdirSync(outDir, { recursive: true });
  // palette PNG (~70% smaller than truecolour; checked by eye for banding at 3x zoom)
  await sharp(pix, { raw: { width, height, channels: 4 } }).png({ palette: true, quality: 65, dither: 0.5, effort: 10, compressionLevel: 9 }).toFile(path.join(outDir, name));
  console.log(`${name}: cleared ${removed} halo and shadow pixels (${pockets} enclosed pockets)`);
}

await clean('tb-logo-stacked.png');
await clean('tb-logo-banner.png');
