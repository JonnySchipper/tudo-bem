// Tiny RGBA image toolkit for the pixel import script. Images are { w, h, data: Uint8Array(RGBA) }.
import sharp from 'sharp';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, luma } from '../../../apps/client/src/render/pixel/palette.ts';

export { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, luma };

export function blank(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

export async function loadPng(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

export async function savePng(img, file) {
  await sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(file);
}

export function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const sx = x + xx, sy = y + yy;
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
      const si = (sy * img.w + sx) * 4, di = (yy * w + xx) * 4;
      out.data[di] = img.data[si];
      out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2];
      out.data[di + 3] = img.data[si + 3];
    }
  }
  return out;
}

export const clone = (img) => ({ w: img.w, h: img.h, data: new Uint8Array(img.data) });

/** Alpha-composites `src` onto `dst` at (dx, dy). Opaque or fully transparent pixels only get copied (pixel art), semi-transparent are blended. */
export function paste(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
      const si = (y * src.w + x) * 4, di = (ty * dst.w + tx) * 4;
      const a = src.data[si + 3];
      if (a === 0) continue;
      if (a === 255 || dst.data[di + 3] === 0) {
        dst.data[di] = src.data[si];
        dst.data[di + 1] = src.data[si + 1];
        dst.data[di + 2] = src.data[si + 2];
        dst.data[di + 3] = a;
      } else {
        const fa = a / 255, da = dst.data[di + 3] / 255;
        const oa = fa + da * (1 - fa);
        for (let c = 0; c < 3; c++) dst.data[di + c] = Math.round((src.data[si + c] * fa + dst.data[di + c] * da * (1 - fa)) / oa);
        dst.data[di + 3] = Math.round(oa * 255);
      }
    }
  }
  return dst;
}

export const px = (img, x, y) => {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null;
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

export function setPx(img, x, y, rgba) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = rgba[0];
  img.data[i + 1] = rgba[1];
  img.data[i + 2] = rgba[2];
  img.data[i + 3] = rgba[3] ?? 255;
}

export const hexPx = (hex, a = 255) => [...hexToRgb(hex), a];

export function flipH(img) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const si = (y * img.w + x) * 4, di = (y * img.w + (img.w - 1 - x)) * 4;
    out.data.set(img.data.subarray(si, si + 4), di);
  }
  return out;
}

/** Trims fully transparent borders; returns { img, x, y } with the offset of the trimmed box in the source. */
export function trim(img) {
  let minx = img.w, miny = img.h, maxx = -1, maxy = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 0) {
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return { img: blank(1, 1), x: 0, y: 0 };
  return { img: crop(img, minx, miny, maxx - minx + 1, maxy - miny + 1), x: minx, y: miny };
}

/** Replaces exact colors. `map` is Map<"#rrggbb", "#rrggbb">. */
export function remapExact(img, map) {
  const table = new Map();
  for (const [a, b] of map) table.set(hexToRgb(a).join(','), hexToRgb(b));
  const out = clone(img);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue;
    const t = table.get(out.data[i] + ',' + out.data[i + 1] + ',' + out.data[i + 2]);
    if (t) { out.data[i] = t[0]; out.data[i + 1] = t[1]; out.data[i + 2] = t[2]; }
  }
  return out;
}

/** Distinct opaque colors of an image as { hex, n } sorted by luma. Optionally filter by predicate on [r,g,b]. */
export function distinctColors(img, filter = () => true) {
  const m = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    const rgb = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (!filter(rgb)) continue;
    const k = rgbToHex(...rgb);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([hex, n]) => ({ hex, n })).sort((a, b) => luma(...hexToRgb(a.hex)) - luma(...hexToRgb(b.hex)));
}

/** Adds `ext` pixels of edge-replicated border around an image (atlas extrusion). */
export function extrude(img, ext = 1) {
  const out = blank(img.w + ext * 2, img.h + ext * 2);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const sx = Math.min(img.w - 1, Math.max(0, x - ext));
      const sy = Math.min(img.h - 1, Math.max(0, y - ext));
      const si = (sy * img.w + sx) * 4, di = (y * out.w + x) * 4;
      out.data[di] = img.data[si];
      out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2];
      out.data[di + 3] = img.data[si + 3];
    }
  }
  return out;
}

/** Builds an image from a string grid + palette map ('.' or ' ' = transparent). */
export function fromGrid(rows, palette) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const img = blank(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const hex = palette[ch];
      if (!hex) throw new Error(`grid: no palette entry for '${ch}' at ${x},${y}`);
      setPx(img, x, y, hexPx(hex));
    }
  });
  return img;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Keeps only the connected component (8-neighborhood, jumping gaps up to `gap` px) that contains (sx, sy); everything else becomes transparent. */
export function isolate(img, sx, sy, gap = 1) {
  const out = blank(img.w, img.h);
  const seen = new Uint8Array(img.w * img.h);
  const opaque = (x, y) => img.data[(y * img.w + x) * 4 + 3] > 0;
  if (!opaque(sx, sy)) throw new Error(`isolate: (${sx},${sy}) is transparent`);
  const st = [[sx, sy]];
  seen[sy * img.w + sx] = 1;
  while (st.length) {
    const [x, y] = st.pop();
    const i = (y * img.w + x) * 4;
    out.data.set(img.data.subarray(i, i + 4), i);
    for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[ny * img.w + nx] || !opaque(nx, ny)) continue;
      seen[ny * img.w + nx] = 1;
      st.push([nx, ny]);
    }
  }
  return out;
}
