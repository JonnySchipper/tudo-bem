// Calçada de petit-pavé: original pixel art for Vila Ipê, authored as code that emits pixel grids.
// Colors are ONLY LimeZu palette colors (exteriors Palette.png / character outline navy).
import { blank, setPx, hexPx, rng } from '../../../../scripts/lib/pixel/img.mjs';

export const STONE = {
  light: ['#f0efde', '#ebe4f2', '#ebe4f2', '#f0efde', '#d8d0e0', '#eee1b7'],
  lightShade: '#c6bdd5',
  lightHi: '#f8f8f8',
  dark: ['#7d7f99', '#7d7f99', '#6c6e85', '#7d7f99'],
  darkShade: '#6c6e85',
  darkHi: '#8b8bab',
};

/**
 * The paving itself: the light/dark contrast is about 40% lower than the mosaic (STONE, above) so the wave stays readable but no
 * longer competes with the characters. Light stones sit around luma 192 and dark ones around 128 (was 233 / 125 = 108, now ~64).
 */
export const PAVE = {
  light: ['#c6bdd5', '#c6bdd5', '#d8d0e0', '#bcb7cd', '#b2aecb', '#c6bdd5'],
  lightShade: '#a2a6be',
  lightHi: '#d8d0e0',
  dark: ['#8b8bab', '#8b8bab', '#7d7f99', '#8b8bab'],
  darkShade: '#6c6e85',
  darkHi: '#989ebe',
};

const TAU = Math.PI * 2;

/** True when a stone at tile-local px (sx, sy) lies on a dark wave band. Period is exactly one tile in x and y, so the paving tiles seamlessly. */
function isDark(sx, sy) {
  const wave = 4.2 * Math.sin((TAU * sx) / 32);
  const v = (((sy + wave) % 16) + 16) % 16;
  return v < 8;
}

/** One seamless 16x16 tile of the wave paving: 2x2 px stones in a running bond (odd rows shifted by 1px). */
export function calcadaFill(phase = 0) {
  const img = blank(16, 16);
  const rand = rng(0xca1c + phase * 977);
  const tint = [];
  for (let r = 0; r < 8; r++) { tint.push([]); for (let c = 0; c < 8; c++) tint[r].push(rand()); }
  for (let y = 0; y < 16; y++) {
    const r = y >> 1;
    const off = r % 2;
    for (let x = 0; x < 16; x++) {
      const xs = (x - off + 16) % 16;
      const c = xs >> 1;
      const lx = xs & 1, ly = y & 1;
      const dark = isDark(phase * 16 + c * 2 + 1 + off, r * 2 + 1);
      const t = tint[r][c];
      const pool = dark ? PAVE.dark : PAVE.light;
      let hex = pool[Math.floor(t * pool.length) % pool.length];
      if (lx === 0 && ly === 0 && t > 0.45) hex = dark ? PAVE.darkHi : PAVE.lightHi;
      if (lx === 1 && ly === 1) hex = dark ? PAVE.darkShade : PAVE.lightShade;
      setPx(img, x, y, hexPx(hex));
    }
  }
  return img;
}

/**
 * São Paulo state outline in (lon, lat), simplified. Rasterized to a bitmap and drawn as a light stone mosaic on a dark field.
 */
const SP_POLY = [
  [-53.1, -22.6], [-52.6, -21.9], [-51.9, -21.3], [-51.1, -20.4], [-50.4, -19.9], [-49.4, -20.0], [-48.6, -20.3],
  [-47.5, -19.95], [-46.8, -20.3], [-46.4, -20.9], [-46.35, -21.8], [-45.9, -22.4], [-45.0, -22.7], [-44.6, -22.9],
  [-44.15, -23.25], [-44.7, -23.4], [-45.4, -23.8], [-46.3, -24.05], [-47.0, -24.45], [-47.9, -25.0], [-48.15, -25.3],
  [-48.6, -24.7], [-48.7, -24.3], [-49.4, -24.3], [-50.0, -24.2], [-50.7, -24.0], [-51.6, -23.5], [-52.3, -22.8],
];

function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The state bitmap inside a w x h decal. */
export function spMapBitmap(w = 32, h = 32, margin = 3) {
  const lons = SP_POLY.map((p) => p[0]), lats = SP_POLY.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const spanLon = maxLon - minLon, spanLat = maxLat - minLat;
  const aspect = (spanLon * 0.92) / spanLat; // 1 deg lon ~ 0.92 deg lat here
  const innerW = w - margin * 2, innerH = h - margin * 2;
  let mw = innerW, mh = innerW / aspect;
  if (mh > innerH) { mh = innerH; mw = innerH * aspect; }
  const ox = (w - mw) / 2, oy = (h - mh) / 2;
  const bits = [];
  for (let y = 0; y < h; y++) {
    bits.push([]);
    for (let x = 0; x < w; x++) {
      const lon = minLon + ((x + 0.5 - ox) / mw) * spanLon;
      const lat = maxLat - ((y + 0.5 - oy) / mh) * spanLat;
      bits[y].push(x >= ox && x < ox + mw && y >= oy && y < oy + mh && inPoly(SP_POLY, lon, lat));
    }
  }
  const cx = Math.round(ox + ((-46.63 - minLon) / spanLon) * mw - 0.5); // São Paulo city
  const cy = Math.round(oy + ((maxLat + 23.55) / spanLat) * mh - 0.5);
  return { bits, cx, cy };
}

/** Ground decal (default 48x32 = 3x2 tiles, close to the real aspect of the state): the state of São Paulo in light stones on a dark field, with a light border. */
export function spMosaic(W = 48, H = 32) {
  const img = blank(W, H);
  const { bits, cx, cy } = spMapBitmap(W, H, 2);
  const rand = rng(0x5a0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const inner = false; // single light border so the state can be as large as possible
      const shade = (x & 1) === 1 && (y & 1) === 1; // same 2x2 stone shading as the paving
      let hex;
      if (border) hex = '#d8d0e0';
      else if (inner) hex = '#565972';
      else if (bits[y][x]) hex = shade ? STONE.lightShade : rand() < 0.3 ? '#d8d0e0' : '#ebe4f2';
      else hex = shade ? STONE.darkShade : rand() < 0.3 ? '#565972' : '#46465e';
      setPx(img, x, y, hexPx(hex));
    }
  }
  const dot = [[0, 0, '#f2b22b'], [1, 0, '#ed931e'], [0, 1, '#ed931e'], [1, 1, '#cb2a2a']];
  for (const [dx, dy, hex] of dot) setPx(img, cx + dx, cy + dy, hexPx(hex));
  return img;
}
