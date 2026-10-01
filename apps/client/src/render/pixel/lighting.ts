/**
 * Time-of-day lighting math (HOWTO §5.8). Pure functions so they can be unit tested; the Phaser side lives in the scene.
 *
 * Grade: a MULTIPLY color by game hour, interpolated in linear RGB between keyframes. Golden hour (16:30-18:30) gets the
 * most keyframes. Darkness: an overlay alpha that ramps in at dusk; lamps and lit windows switch on with it.
 */

export type Rgb = [number, number, number];

export const GRADE_KEYS: readonly [number, string][] = [
  [0, '#3b4a7c'],
  [4.5, '#4a4f86'],
  // dawn (V5): cool violet, then pink, then a soft peach that has warmed to white by nine
  [5.3, '#8a72a8'],
  [5.9, '#d98fa6'],
  [6.5, '#f4b9ae'],
  [7, '#ffd4c0'],
  [8, '#ffeede'],
  [9, '#ffffff'],
  [15, '#fff6e6'],
  // golden hour (V5): deeper amber at 17:30, a coral dusk, then the violet that hands over to the night grade
  [16.5, '#ffe4bf'],
  [17, '#ffd7a8'],
  [17.5, '#ffc48e'],
  [18, '#fbaa8a'],
  [18.3, '#ee9690'],
  [18.7, '#b87fa8'],
  [19, '#7a78ae'],
  [20, '#3b4a7c'],
  [24, '#3b4a7c'],
];

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));

function hex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The multiply grade color at game hour `h` (0..24, wraps), interpolated in linear RGB. */
export function gradeAt(hour: number, keys: readonly [number, string][] = GRADE_KEYS): Rgb {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < keys.length - 2 && h >= keys[i + 1][0]) i++;
  const [h0, c0] = keys[i];
  const [h1, c1] = keys[i + 1];
  const t = h1 === h0 ? 0 : Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  const a = hex(c0), b = hex(c1);
  return [0, 1, 2].map((k) => linearToSrgb(srgbToLinear(a[k]) * (1 - t) + srgbToLinear(b[k]) * t)) as Rgb;
}

export const rgbToInt = ([r, g, b]: Rgb) => (r << 16) | (g << 8) | b;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Darkness overlay alpha: 0 by day, ramping up between `from` and `to` (default 17:45 -> 20:15) to `max` (0.55 by the doc),
 * and back down again before dawn (05:00 -> 06:30).
 */
export function darknessAlpha(hour: number, max = 0.55, from = 17.75, to = 20.25): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= from) return max * smooth(Math.min(1, (h - from) / (to - from)));
  if (h < 5) return max;
  if (h < 6.5) return max * (1 - smooth((h - 5) / 1.5));
  return 0;
}

/** Lamps and lit windows are on once it is dark enough to notice. */
export const lightsOn = (hour: number) => darknessAlpha(hour) > 0.06;

/** 0..1 strength of the lit-window/lamp glow, easing in a little before full dark so the switch-on is gradual. */
export function glowStrength(hour: number): number {
  return Math.min(1, darknessAlpha(hour) / 0.3);
}

/**
 * 0..1 warm low-sun glow from the side the sun is on: fades in from 16:00, peaks around 17:30, gone by 19:00; and a gentler one at dawn
 * (5:30 to 8:00, peak 6:45).
 */
export function sunGlow(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5.5 && h <= 8) return 0.75 * (h < 6.75 ? smooth((h - 5.5) / 1.25) : smooth((8 - h) / 1.25));
  if (h < 16 || h > 19) return 0;
  return h < 17.5 ? smooth((h - 16) / 1.5) : smooth((19 - h) / 1.5);
}

/** Cool blue that fills the shadows at golden hour (sky light bounce), applied with a SCREEN blend so it lifts darks more than lights. */
export const SHADOW_FILL_COLOR: Rgb = [0x34, 0x54, 0xa8];
/** Peak alpha of the shadow fill layer. */
export const SHADOW_FILL_MAX = 0.2;

/**
 * 0..1 strength of the cool shadow fill: it starts with the low sun (16:30), peaks through the golden hour (17:30-18:15) and fades out
 * as the night grade (already blue) and the darkness overlay take over (gone by 19:45). Without it, 17:30 is a flat orange wash.
 */
export function shadowFillStrength(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 16.5 || h > 19.75) return 0;
  if (h < 17.5) return smooth((h - 16.5) / 1);
  if (h <= 18.25) return 1;
  return smooth((19.75 - h) / 1.5);
}

/** The shadow fill as { color, alpha } for the current hour. */
export function shadowFill(hour: number): { color: Rgb; alpha: number } {
  return { color: SHADOW_FILL_COLOR, alpha: SHADOW_FILL_MAX * shadowFillStrength(hour) };
}

export function formatHour(hour: number): string {
  const total = Math.round(((hour % 24) + 24) % 24 * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
