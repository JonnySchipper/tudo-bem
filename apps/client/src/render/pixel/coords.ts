/**
 * World/screen math for the pixel view (HOWTO §5.3, §5.4). Pure functions with no Phaser or DOM imports, so they are unit tested.
 *
 * World units are art pixels: tile (x, y) covers [x*16, (x+1)*16) x [y*16, (y+1)*16). `x` goes right and `y` goes down (D5).
 * The camera is described by `CamState`: the world point at the centre of the canvas and an integer device zoom.
 */
import type { Tile } from '@tudobem/shared';

/** Art px per tile. */
export const T = 16;

export const tileToWorld = (x: number, y: number) => ({ wx: (x + 0.5) * T, wy: (y + 0.5) * T });

/** Feet of a character standing on tile (x, y); x and y may be fractional while walking. */
export const feet = (x: number, y: number) => ({ wx: (x + 0.5) * T, wy: (y + 1) * T - 3 });

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CamState {
  /** device px per art px (always an integer, HOWTO §5.3) */
  zoom: number;
  /** device px per CSS px */
  dpr: number;
  /** world px at the centre of the canvas */
  cx: number;
  cy: number;
  /** canvas size in device px */
  w: number;
  h: number;
}

/** CSS zoom (art px -> CSS px): about 20 tiles across on a desktop, 12 on a phone, clamped to 2..5. */
export function cssZoomFor(innerW: number, innerH: number): number {
  const z = Math.floor(Math.min(innerW / (20 * T), innerH / (12 * T)));
  return Math.min(5, Math.max(2, z));
}

/** Integer device zoom for a CSS zoom. Fractional DPRs (1.25, 1.5) round down so pixels stay even. */
export function deviceZoomFor(cssZoom: number, dpr: number): number {
  return Number.isInteger(dpr) ? cssZoom * dpr : Math.max(1, Math.floor(cssZoom * dpr));
}

/** World px -> CSS px, relative to the canvas' top-left corner. */
export function worldToCanvas(c: CamState, wx: number, wy: number): { px: number; py: number } {
  return { px: ((wx - c.cx) * c.zoom + c.w / 2) / c.dpr, py: ((wy - c.cy) * c.zoom + c.h / 2) / c.dpr };
}

/** CSS px (relative to the canvas' top-left corner) -> world px. */
export function canvasToWorld(c: CamState, px: number, py: number): { wx: number; wy: number } {
  return { wx: (px * c.dpr - c.w / 2) / c.zoom + c.cx, wy: (py * c.dpr - c.h / 2) / c.zoom + c.cy };
}

/** The tile under a world point, or null outside the room. */
export function tileAtWorld(wx: number, wy: number, cols: number, rows: number): Tile | null {
  const x = Math.floor(wx / T);
  const y = Math.floor(wy / T);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return { x, y };
}

/** CSS px (relative to the canvas) of the centre of tile (x, y): the inverse of `tileAt` for in-range tiles. */
export function tileCenterToCanvas(c: CamState, x: number, y: number): { px: number; py: number } {
  const w = tileToWorld(x, y);
  return worldToCanvas(c, w.wx, w.wy);
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Camera centre for a focus point. Per axis: if the room (`bounds`) is smaller than the free part of the screen it is centred in
 * that part (the outside shows the backdrop); otherwise the focus is followed and clamped so the view never leaves the bounds.
 * `insets` (device px) reserve screen edges for the HUD; the focus is kept inside the free region.
 */
export function cameraCenter(view: { w: number; h: number; zoom: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets): { cx: number; cy: number } {
  const axis = (size: number, lo: number, hi: number, b0: number, b1: number, f: number) => {
    // world distance from the centre to the free region's edges
    const toLo = (size / 2 - lo) / view.zoom;
    const toHi = (size / 2 - hi) / view.zoom;
    const min = b0 + toLo;
    const max = b1 - toHi;
    if (min >= max) return (b0 + b1) / 2 - (toHi - toLo) / 2; // fits: centre the room in the free region
    return Math.min(max, Math.max(min, f));
  };
  return {
    cx: axis(view.w, insets.left, insets.right, bounds.x0, bounds.x1, focus.x),
    cy: axis(view.h, insets.top, insets.bottom, bounds.y0, bounds.y1, focus.y),
  };
}

/** Snap a camera coordinate to the device pixel grid so art pixels never straddle two device pixels. */
export const snapToDevice = (v: number, zoom: number): number => Math.round(v * zoom) / zoom;
