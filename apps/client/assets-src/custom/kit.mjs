// Shared helpers for the Brazilian set pieces (art1). Everything here works on { w, h, data } RGBA images and only uses
// LimeZu palette colors (exteriors Palette.png + the outline navy), plus the brand colors from docs/art/palette.md.
import { blank, clone, crop, paste, setPx, hexPx, px, rng, rgbToHex, hexToRgb, luma } from '../../../../scripts/lib/pixel/img.mjs';
import { C, rect, hline, vline, dot, box, outlineAround } from './draw.mjs';

export { blank, clone, crop, paste, setPx, hexPx, px, rng, C, rect, hline, vline, dot, box, outlineAround };

/** More LimeZu Palette.png ramps (exteriors). */
export const K = {
  // orange / terracotta rows of Palette.png
  or0: '#f1ce8e', or1: '#e0b870', or2: '#daa463', or3: '#c78c59', or4: '#c18452', or5: '#b5754d', or6: '#a85f46',
  te0: '#d9a16a', te1: '#ca8854', te2: '#b35e3f', te3: '#ae5539', te4: '#ab4a36', te5: '#a13a30',
  // browns
  br0: '#887044', br1: '#7b5b3a', br2: '#6b4b30', br3: '#63412f', br4: '#573c2c',
  // greys with a warm tint
  wg0: '#d6cab3', wg1: '#cbbead', wg2: '#c3ac90', wg3: '#b99e86', wg4: '#b18a74', wg5: '#9c786b', wg6: '#916662',
  // blues (light to dark) from the water/sky rows
  sk0: '#defff7', sk1: '#b7ffee', sk2: '#95e3e3', sk3: '#50a7e8', sk4: '#4995e3', sk5: '#4280dd', sk6: '#3d56d2',
  gl0: '#c4d7e3', gl1: '#e2f2f3', gl2: '#cce6ec', gl3: '#bad2e0', gl4: '#a4bbd5', gl5: '#8fa1c8', gl6: '#738ca8',
  // plum / purple (for shadows toward violet)
  pu0: '#968bab', pu1: '#887ca4', pu2: '#76689e', pu3: '#54467f', pu4: '#b8b5cb',
  // brand colors (docs/art/palette.md)
  brandTerracotta: '#c45c26', brandMustard: '#d4a017', brandCream: '#f5e6d3',
  // dark warm outlines for wood / terracotta (sel-out)
  ol: '#3a3a50', ol2: '#46465e',
};

export const hexAt = (img, x, y) => {
  const p = px(img, x, y);
  return p && p[3] ? rgbToHex(p[0], p[1], p[2]) : null;
};

/** Recolors `img` by mapping its distinct colors (not in `keep`) to `ramp` (dark -> light) by luminance rank. */
export function recolorRamp(img, ramp, keep = ['#3a3a50', '#46465e']) {
  const keepSet = new Set(keep);
  const cols = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    const h = rgbToHex(img.data[i], img.data[i + 1], img.data[i + 2]);
    if (keepSet.has(h)) continue;
    cols.set(h, (cols.get(h) ?? 0) + 1);
  }
  const sorted = [...cols.keys()].sort((a, b) => luma(...hexToRgb(a)) - luma(...hexToRgb(b)));
  const map = new Map();
  sorted.forEach((h, i) => map.set(h, ramp[Math.min(ramp.length - 1, Math.round((i / Math.max(1, sorted.length - 1)) * (ramp.length - 1)))]));
  const out = clone(img);
  for (let i = 0; i < out.data.length; i += 4) {
    if (!out.data[i + 3]) continue;
    const t = map.get(rgbToHex(out.data[i], out.data[i + 1], out.data[i + 2]));
    if (!t) continue;
    const [r, g, b] = hexToRgb(t);
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
  }
  return out;
}

/** Exact color replacement with an object { '#from': '#to' }. */
export function swap(img, table, region = null) {
  const m = new Map(Object.entries(table).map(([a, b]) => [hexToRgb(a).join(','), hexToRgb(b)]));
  const out = clone(img);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (region && !(x >= region[0] && y >= region[1] && x < region[0] + region[2] && y < region[1] + region[3])) continue;
    const i = (y * img.w + x) * 4;
    if (!out.data[i + 3]) continue;
    const t = m.get(out.data[i] + ',' + out.data[i + 1] + ',' + out.data[i + 2]);
    if (t) { out.data[i] = t[0]; out.data[i + 1] = t[1]; out.data[i + 2] = t[2]; }
  }
  return out;
}

/** Removes semi-transparent baked shadow pixels (the frame draws its own contact + cast shadows). */
export function stripSoftAlpha(img) {
  const out = clone(img);
  for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3] > 0 && out.data[i + 3] < 255) out.data[i + 3] = 0;
  return out;
}

/** Binary mask helpers. mask = { w, h, a: Uint8Array } */
export const newMask = (w, h) => ({ w, h, a: new Uint8Array(w * h) });
export const maskAt = (m, x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? 0 : m.a[y * m.w + x]);
export function fillMask(m, pred) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (pred(x + 0.5, y + 0.5)) m.a[y * m.w + x] = 1;
  return m;
}
export const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export const rectP = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
export const union = (...ps) => (x, y) => ps.some((p) => p(x, y));
export const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);

/**
 * Draws a mask with LimeZu-style lighting: ramp = [dark, mid, light, hi] (4 colors), light from the upper left.
 * A 1px dark outline is drawn OUTSIDE the mask (outline color `ol`), so the shape keeps its size.
 * opts: rimLit (px of lit rim on N/W edges, default 1), rimShade (px of shaded rim on S/E edges, default 2), hiCorner (bool).
 */
export function drawShaded(dst, mask, ox, oy, ramp, opts = {}) {
  const { rimLit = 1, rimShade = 2, ol = K.ol, hiCorner = true, outline = true } = opts;
  const run = (x, y, dx, dy, max) => { for (let s = 1; s <= max; s++) if (!maskAt(mask, x + dx * s, y + dy * s)) return s; return max + 1; };
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
    if (!maskAt(mask, x, y)) continue;
    const n = run(x, y, 0, -1, rimLit), w = run(x, y, -1, 0, rimLit);
    const s = run(x, y, 0, 1, rimShade), e = run(x, y, 1, 0, rimShade);
    let c = ramp[1];
    if (s <= rimShade || e <= rimShade) c = ramp[0];
    if (n <= rimLit || w <= rimLit) c = ramp[2];
    if (hiCorner && n <= rimLit && w <= rimLit) c = ramp[3];
    setPx(dst, ox + x, oy + y, hexPx(c));
  }
  if (outline) for (let y = -1; y <= mask.h; y++) for (let x = -1; x <= mask.w; x++) {
    if (maskAt(mask, x, y)) continue;
    if (maskAt(mask, x - 1, y) || maskAt(mask, x + 1, y) || maskAt(mask, x, y - 1) || maskAt(mask, x, y + 1)) setPx(dst, ox + x, oy + y, hexPx(ol));
  }
}

/** Repeats the columns [from, to) of `img` so that the image becomes `newW` wide (extra width taken by cycling that band). */
export function stretchCols(img, from, to, newW) {
  const extra = newW - img.w;
  if (extra < 0) throw new Error('stretchCols: shrink not supported');
  const band = to - from;
  const out = blank(newW, img.h);
  for (let x = 0; x < newW; x++) {
    let sx;
    if (x < to) sx = x;
    else if (x < to + extra) sx = from + ((x - to) % band);
    else sx = x - extra;
    for (let y = 0; y < img.h; y++) {
      const si = (y * img.w + sx) * 4, di = (y * newW + x) * 4;
      out.data.set(img.data.subarray(si, si + 4), di);
    }
  }
  return out;
}

/** Same for rows (grow: repeat band [from, to) to reach newH; shrink: cut rows [from, from + (h - newH))). */
export function stretchRows(img, from, to, newH) {
  const extra = newH - img.h;
  const out = blank(img.w, newH);
  const srcRow = (y) => {
    if (extra >= 0) {
      if (y < to) return y;
      if (y < to + extra) return from + ((y - to) % (to - from));
      return y - extra;
    }
    return y < from ? y : y - extra; // extra < 0: skip -extra rows starting at `from`
  };
  for (let y = 0; y < newH; y++) {
    const sy = srcRow(y);
    out.data.set(img.data.subarray(sy * img.w * 4, (sy + 1) * img.w * 4), y * img.w * 4);
  }
  return out;
}

/** Copies rect (sx, sy, w, h) of `src` to (dx, dy) of `dst` (opaque pixels only). */
export function blit(dst, src, sx, sy, w, h, dx, dy) {
  paste(dst, crop(src, sx, sy, w, h), dx, dy);
}

/** Fills the transparent pixels of `img` that are surrounded by opaque ones? No: simple flood erase of a color region. */
export function eraseRect(img, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(img, xx, yy, [0, 0, 0, 0]);
}

/** Bounding box of opaque pixels: { x, y, w, h }. */
export function bbox(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Grid painter: rows of chars mapped by `pal` (char -> hex; '.' = transparent) stamped at (ox, oy). */
export function stampGrid(dst, rows, pal, ox, oy) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const hex = pal[ch];
      if (!hex) throw new Error(`grid: no palette entry for '${ch}' at ${x},${y}`);
      setPx(dst, ox + x, oy + y, hexPx(hex));
    }
  });
}

export const mirrorRows = (rows) => rows.map((r) => [...r].reverse().join(''));
