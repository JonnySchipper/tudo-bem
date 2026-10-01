/** Pure pattern math for `water.ts` (caustics, the water mask, sparkle picks), kept free of Phaser so it is unit tested. */
import { hashPos01 } from './dayNight';

/** True for the blue / teal pixels of the basin water. */
export function isWaterPixel(r: number, g: number, b: number, a: number): boolean {
  return a > 200 && b > 120 && b > r + 30 && g > r + 10;
}

/** Caustic brightness 0..1 at pixel (x, y) in frame `f` (0..3): two crossing wave sets, thresholded into thin bright filaments. */
export function causticAt(x: number, y: number, f: number): number {
  const ph = (f * Math.PI) / 2;
  const v = Math.sin(x * 0.85 + ph) * Math.sin(y * 1.15 - ph * 0.7) + Math.sin((x + y * 0.8) * 0.55 + ph * 1.3) * 0.8;
  return Math.max(0, Math.min(1, (v - 0.75) * 1.6));
}

export interface WaterMask {
  w: number;
  h: number;
  /** water pixels as [x, y] */
  px: [number, number][];
}

export function waterMask(data: Uint8ClampedArray | Uint8Array, w: number, h: number): WaterMask {
  const px: [number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isWaterPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) px.push([x, y]);
    }
  return { w, h, px };
}

/** Which water pixels sparkle (`n` of them, deterministic by the sprite position). */
export function sparklePixels(mask: WaterMask, n: number, seed: number): [number, number][] {
  if (!mask.px.length) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push(mask.px[Math.floor(hashPos01(seed * 31 + i * 7, i * 13 + 5) * mask.px.length)]);
  return out;
}

