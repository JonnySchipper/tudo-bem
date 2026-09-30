// Painter helpers shared by the portrait, feira and icon generators (art2). Everything works on { w, h, data } RGBA images with
// hard pixels only. Light comes from the upper left (HOWTO 4.2 rule 3), outlines are the pack's navy where a shape meets empty
// space and a tinted dark where it meets another part (sel-out).
import { blank, setPx, hexPx, px } from '../../../../scripts/lib/pixel/img.mjs';
import { C, K } from './kit.mjs';

export { blank, setPx, hexPx, px, C, K };

export const NAVY = '#3a3a50';

/** Pixel-center predicate helpers (x, y are pixel centers). */
export const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
export const or = (...ps) => (x, y) => ps.some((p) => p(x, y));
export const and = (...ps) => (x, y) => ps.every((p) => p(x, y));
export const not = (p) => (x, y) => !p(x, y);
export const sub = (a, b) => (x, y) => a(x, y) && !b(x, y);
/** Symmetric-about-cx shape given half-width keypoints [[y, hw], ...] (linear interpolation, hw 0 outside the range). */
export function profile(cx, pts) {
  return (x, y) => {
    if (y < pts[0][0] || y > pts[pts.length - 1][0]) return false;
    let i = 0;
    while (i < pts.length - 2 && y > pts[i + 1][0]) i++;
    const [y0, h0] = pts[i], [y1, h1] = pts[i + 1];
    const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
    return Math.abs(x - cx) <= h0 + (h1 - h0) * t;
  };
}
/** Half-width at row y for the same keypoints. */
export function hwAt(pts, y) {
  if (y < pts[0][0] || y > pts[pts.length - 1][0]) return 0;
  let i = 0;
  while (i < pts.length - 2 && y > pts[i + 1][0]) i++;
  const [y0, h0] = pts[i], [y1, h1] = pts[i + 1];
  const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
  return h0 + (h1 - h0) * t;
}

export function put(img, x, y, hex) {
  setPx(img, x, y, hexPx(hex));
}
export function fillRect(img, x, y, w, h, hex) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(img, xx, yy, hex);
}
export const alphaAt = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.data[(y * img.w + x) * 4 + 3]);

/** Maps a light value to a ramp index. ramp = [dark, shade, base, hi]. */
function band(v, t) {
  if (v > t[0]) return 3;
  if (v > t[1]) return 2;
  if (v > t[2]) return 1;
  return 0;
}

/**
 * Paints a shape lit from the upper left as an ellipsoid inscribed in `box` = [cx, cy, rx, ry].
 * ramp = [dark, shade, base, hi]. opts: light thresholds `t`, `ol` (tint for the outline where it meets another part; NAVY where it
 * meets empty space), `outline` (default true), `flat` (no shading: base color only), `pattern(x, y, idx) -> idx` (texture hook).
 * Returns the list of painted pixel coordinates.
 */
export function shape(img, pred, box_, ramp, opts = {}) {
  const [cx, cy, rx, ry] = box_;
  const t = opts.t ?? [0.86, 0.46, 0.04];
  const painted = [];
  const inside = new Uint8Array(img.w * img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (pred(x + 0.5, y + 0.5)) inside[y * img.w + x] = 1;
  const isIn = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && inside[y * img.w + x] === 1;
  if (opts.outline !== false) {
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      if (isIn(x, y)) continue;
      if (isIn(x - 1, y) || isIn(x + 1, y) || isIn(x, y - 1) || isIn(x, y + 1)) {
        const empty = alphaAt(img, x, y) === 0;
        put(img, x, y, empty ? NAVY : opts.ol ?? NAVY);
      }
    }
  }
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!isIn(x, y)) continue;
    const nx = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx)), ny = Math.max(-1, Math.min(1, (y + 0.5 - cy) / ry));
    const z = Math.sqrt(Math.max(0.04, 1 - (nx * 0.85) ** 2 - (ny * 0.75) ** 2));
    const v = -0.55 * nx * 0.9 - 0.5 * ny * 0.7 + 0.67 * z;
    let idx = opts.flat ? 2 : band(v, t);
    if (opts.pattern) idx = opts.pattern(x, y, idx);
    put(img, x, y, ramp[idx]);
    painted.push([x, y]);
  }
  return painted;
}

/** Fills with a flat color, with optional outline (same rules as shape). */
export function flat(img, pred, hex, opts = {}) {
  return shape(img, pred, [0, 0, 1, 1], [hex, hex, hex, hex], { ...opts, flat: true });
}

/** Stamp a char grid at (ox, oy); `pal` maps char -> hex or a function () => hex; '.' is transparent. */
export function grid(img, rows, pal, ox, oy, mirror = false) {
  rows.forEach((row, y) => {
    const chars = mirror ? [...row].reverse() : [...row];
    chars.forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const v = pal[ch];
      if (!v) throw new Error(`grid: no palette entry for '${ch}'`);
      put(img, ox + x, oy + y, typeof v === 'function' ? v() : v);
    });
  });
}

export function line(img, x0, y0, x1, y1, hex) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) put(img, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), hex);
}

/** Composite src over dst (opaque copy). */
export function over(dst, src, dx = 0, dy = 0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const i = (y * src.w + x) * 4;
    if (src.data[i + 3] === 0) continue;
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
    const di = (ty * dst.w + tx) * 4;
    dst.data[di] = src.data[i]; dst.data[di + 1] = src.data[i + 1]; dst.data[di + 2] = src.data[i + 2]; dst.data[di + 3] = 255;
  }
  return dst;
}

/** Mirror x within [0, w). */
export const mx = (x, w = 64) => w - 1 - x;

/** Darken / lighten a hex by a factor toward a target (used for tints, not for new palette colors). */
export function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** 1 px ring of radius r around (cx, cy); colorFn(x, y) picks the pixel color. */
export function ring(img, cx, cy, r, colorFn) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (Math.abs(d - r) <= 0.62) put(img, x, y, colorFn(x, y, d));
  }
}
/** Gold hoop earring (lit upper-left). */
export function hoop(img, cx, cy, r) {
  ring(img, cx, cy, r, (x, y) => {
    const s = x + 0.5 - cx + (y + 0.5 - cy);
    return s < -0.6 ? '#fff59a' : s > 1.2 ? '#ed931e' : '#f8d239';
  });
}

/** Deterministic 2D hash in [0,1). */
export function h2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
