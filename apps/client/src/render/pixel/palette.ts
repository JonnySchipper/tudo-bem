/**
 * Palette-swap helpers for the pixel character pipeline (HOWTO §5.5).
 *
 * Pure functions, no DOM: usable from the client, from vitest and from
 * `scripts/pixel-import.mjs` (Node strips the types natively). Do not add
 * relative imports here, the import script loads this file directly.
 *
 * Layer PNGs are authored/converted in **key colors** (exact, arbitrary RGB
 * values per rank). At load time each key is replaced by the color of the
 * same rank from a ramp generated from the appearance color.
 */

export type RampName = 'skin' | 'hair' | 'top' | 'bottom' | 'shoes';

/** Exact key colors per ramp, darkest to lightest. Layers in the canonical sheets use these. */
export const KEY_RAMPS: Record<RampName, readonly string[]> = {
  skin: ['#a0003a', '#c00050', '#e00068', '#ff2080'],
  hair: ['#003aa0', '#0050c0', '#0068e0', '#2080ff'],
  top: ['#00a03a', '#00c050', '#00e068', '#20ff80'],
  bottom: ['#a08000', '#c09c00', '#e0b800', '#ffd420'],
  shoes: ['#a000a0', '#d000d0', '#ff20ff'],
};

/**
 * Which key ranks a source layer with N distinct shades maps to. The base color of the ramp is
 * rank 2 (the shadow ranks sit below it, the highlight above), so a 2-shade layer uses
 * base + highlight, a 3-shade layer uses shadow + base + highlight.
 */
export const RANKS_FOR_COUNT: Record<number, readonly number[]> = {
  1: [2],
  2: [2, 3],
  3: [1, 2, 3],
  4: [0, 1, 2, 3],
};

export type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** Packs RGB into a 24-bit integer key. */
export const pack = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

/** Rec. 601 luma, 0..255. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
  else if (max === gf) h = (bf - rf) / d + 2;
  else h = (rf - gf) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

/** Signed shortest hue step (degrees) moving `from` toward `target`, capped at `max`. */
function hueToward(from: number, target: number, max: number): number {
  let d = ((target - from + 540) % 360) - 180;
  if (d > max) d = max;
  if (d < -max) d = -max;
  return d;
}

/**
 * Pixel-art ramp from a base color: shadows are darker and shift toward cool/purple, highlights are
 * lighter and shift toward warm/yellow. Returns `count` colors (4 or 3), darkest first, base at rank 2
 * for 4-color ramps (rank 1 for the 3-color shoe ramp: shadow, base, highlight).
 * Luminance is strictly increasing even when the base is near black or white.
 */
export function buildRamp(baseHex: string, count: 3 | 4 = 4): string[] {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const steps: { dl: number; shade: 'cool' | 'warm' | 'base'; amt: number }[] =
    count === 4
      ? [
          { dl: -0.28, shade: 'cool', amt: 12 },
          { dl: -0.14, shade: 'cool', amt: 6 },
          { dl: 0, shade: 'base', amt: 0 },
          { dl: 0.12, shade: 'warm', amt: 6 },
        ]
      : [
          { dl: -0.2, shade: 'cool', amt: 9 },
          { dl: 0, shade: 'base', amt: 0 },
          { dl: 0.12, shade: 'warm', amt: 6 },
        ];
  const out: [number, number, number][] = [];
  let prevLuma = -1;
  for (const st of steps) {
    let hh = h;
    if (st.shade === 'cool') hh = h + hueToward(h, 265, st.amt);
    else if (st.shade === 'warm') hh = h + hueToward(h, 50, st.amt);
    let ll = Math.min(0.97, Math.max(0.05, l + st.dl));
    let rgb = hslToRgb(hh, s, ll);
    // Enforce strictly increasing luma (clamping can flatten the ends).
    let guard = 0;
    while (luma(...rgb) <= prevLuma + 1 && guard++ < 40) {
      ll = Math.min(1, ll + 0.01);
      rgb = hslToRgb(hh, s, ll);
    }
    prevLuma = luma(...rgb);
    out.push([Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])]);
  }
  return out.map(([rr, gg, bb]) => rgbToHex(rr, gg, bb));
}

/** Builds the replacement table key color -> target color (both as packed ints). Equal length required. */
export function rampMap(keyRamp: readonly string[], targetRamp: readonly string[]): Map<number, number> {
  if (keyRamp.length !== targetRamp.length) throw new Error(`ramp length mismatch ${keyRamp.length} vs ${targetRamp.length}`);
  const m = new Map<number, number>();
  keyRamp.forEach((k, i) => {
    const [kr, kg, kb] = hexToRgb(k);
    const [tr, tg, tb] = hexToRgb(targetRamp[i]);
    m.set(pack(kr, kg, kb), pack(tr, tg, tb));
  });
  return m;
}

/**
 * Replaces exact key colors in an RGBA buffer, in place. Fully transparent pixels are skipped and alpha is
 * never touched. Returns the number of pixels replaced. Works on a plain Uint8ClampedArray, so no canvas is needed.
 */
export function swapKeys(data: Uint8ClampedArray | Uint8Array, table: Map<number, number>): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const to = table.get(pack(data[i], data[i + 1], data[i + 2]));
    if (to === undefined) continue;
    data[i] = (to >> 16) & 255;
    data[i + 1] = (to >> 8) & 255;
    data[i + 2] = to & 255;
    n++;
  }
  return n;
}

/** Merges several key->target tables (skin + hair + ...) into one so a layer is swapped in a single pass. */
export function mergeTables(...tables: Map<number, number>[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of tables) for (const [k, v] of t) out.set(k, v);
  return out;
}

/**
 * Converts source shades (hex list, any order) into key colors by luminance rank. `shades` are the layer's own
 * distinct colors for one group (for example the 3 hair browns). Used by the import script.
 */
export function keyMapForShades(shades: readonly string[], ramp: RampName): Map<number, number> {
  const sorted = [...shades].sort((a, b) => luma(...hexToRgb(a)) - luma(...hexToRgb(b)));
  const ranks = RANKS_FOR_COUNT[sorted.length];
  if (!ranks) throw new Error(`unsupported shade count ${sorted.length} for ${ramp}`);
  const keys = KEY_RAMPS[ramp];
  const m = new Map<number, number>();
  sorted.forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex);
    const key = keys[Math.min(ranks[i], keys.length - 1)];
    const [kr, kg, kb] = hexToRgb(key);
    m.set(pack(r, g, b), pack(kr, kg, kb));
  });
  return m;
}
