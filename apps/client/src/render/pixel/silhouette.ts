/**
 * Soft shadow silhouettes from sprite alpha (V5). Pure pixel math on RGBA arrays (no canvas, no Phaser), so it is unit tested; `shadowLayer.ts`
 * reads a sprite frame into an array, calls `buildSilhouette`, and packs the result into the shadow atlas.
 *
 * A silhouette is the part of a sprite at or above its foot line, as white with alpha = the sprite's alpha times a contact-hardening ramp
 * (darkest at the foot, lighter toward the tip) and a small blur. It is cached once per sprite frame: the sun only changes the shear, which
 * is applied by the GPU (a sheared container), so the shadow moves smoothly with the clock and nothing is regenerated.
 */
import { SIL_PAD, rampAlpha, shadowRows } from './shadows';

export interface RgbaImage {
  w: number;
  h: number;
  /** RGBA, row-major, 4 bytes per pixel */
  data: Uint8ClampedArray | Uint8Array;
}

export interface Silhouette extends RgbaImage {
  /** where the foot sits inside the silhouette (px from its top-left): the Phaser anchor */
  ax: number;
  ay: number;
}

/** Number of [1 2 1] / 4 passes for a blur radius in art px. */
export const blurPasses = (radius: number): number => (radius <= 0.25 ? 0 : Math.max(1, Math.round(radius * 1.2)));

/** One separable [1 2 1] / 4 pass over a float plane. */
function blurPlane(a: Float32Array, w: number, h: number): Float32Array {
  const t = new Float32Array(a.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      t[i] = 0.5 * a[i] + 0.25 * (x > 0 ? a[i - 1] : 0) + 0.25 * (x < w - 1 ? a[i + 1] : 0);
    }
  const o = new Float32Array(a.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      o[i] = 0.5 * t[i] + 0.25 * (y > 0 ? t[i - w] : 0) + 0.25 * (y < h - 1 ? t[i + w] : 0);
    }
  return o;
}

/**
 * The shadow silhouette of a sprite image whose foot is `(ax, ay)` in frame pixels. Rows below the foot are dropped (they stand in front of the
 * footprint and would project toward the sun); everything above it is kept, padded by `SIL_PAD` on all sides for the blur.
 */
export function buildSilhouette(img: RgbaImage, ax: number, ay: number, opts: { blur?: number; tip?: number } = {}): Silhouette {
  const rows = shadowRows(img.h, ay);
  const P = SIL_PAD;
  const W = img.w + 2 * P;
  const H = rows + 2 * P;
  let plane: Float32Array = new Float32Array(W * H);
  for (let r = 0; r < rows; r++) {
    const z = rows - 0.5 - r;
    const ramp = rampAlpha(z, rows, opts.tip ?? 0.55);
    for (let x = 0; x < img.w; x++) {
      const a = img.data[(r * img.w + x) * 4 + 3] / 255;
      if (a > 0.04) plane[(r + P) * W + x + P] = a * ramp;
    }
  }
  for (let i = blurPasses(opts.blur ?? 0.9); i > 0; i--) plane = blurPlane(plane, W, H);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < plane.length; i++) {
    const v = plane[i];
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = Math.round(Math.min(1, v) * 255);
  }
  return { w: W, h: H, data, ax: ax + P, ay: rows + P };
}

/** A shelf packer for the shadow atlas: frames go left to right in rows; `null` when the atlas is full. 1 px gutters stop LINEAR filtering bleeding. */
export class ShelfPacker {
  private x = 0;
  private y = 0;
  private rowH = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly gutter = 1,
  ) {}
  alloc(w: number, h: number): { x: number; y: number } | null {
    const g = this.gutter;
    if (w + g > this.width) return null;
    if (this.x + w + g > this.width) {
      this.y += this.rowH + g;
      this.x = 0;
      this.rowH = 0;
    }
    if (this.y + h + g > this.height) return null;
    const at = { x: this.x, y: this.y };
    this.x += w + g;
    this.rowH = Math.max(this.rowH, h);
    return at;
  }
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.rowH = 0;
  }
}
