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

/** True when `bounds` (world px) fits inside the free part of the screen (`view` minus the HUD `insets`, device px) at device `zoom`. */
export function fitsAt(view: { w: number; h: number }, bounds: Rect, insets: Insets, zoom: number): boolean {
  const freeW = view.w - insets.left - insets.right;
  const freeH = view.h - insets.top - insets.bottom;
  return (bounds.x1 - bounds.x0) * zoom <= freeW && (bounds.y1 - bounds.y0) * zoom <= freeH;
}

/**
 * Device zoom for a room. Starts from the HOWTO §5.3 zoom for the window (`cssZoom`, `dpr`); when the whole room (walls included) does not
 * fit at that zoom but does one integer CSS zoom lower (never below 2), it takes the lower one, so a padaria on a 1280 x 800 desktop is seen
 * whole (zoom 3) instead of cropped at the north wall (zoom 4). Always an integer in device px, so pixels stay crisp.
 */
export function roomZoom(view: { w: number; h: number }, bounds: Rect, insets: Insets, cssZoom: number, dpr: number): number {
  const base = deviceZoomFor(cssZoom, dpr);
  if (fitsAt(view, bounds, insets, base) || cssZoom <= 2) return base;
  const lower = deviceZoomFor(cssZoom - 1, dpr);
  return lower < base && fitsAt(view, bounds, insets, lower) ? lower : base;
}

/**
 * The whole camera for a room: the zoom (`roomZoom`) and its centre. A room that fits is centred in the free region with its whole wall
 * band in view; a bigger one follows `focus`, clamped to the bounds, so with the avatar in the top rows the view sits at the top of the
 * bounds and the north wall is never cropped.
 */
export function roomFraming(view: { w: number; h: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, cssZoom: number, dpr: number): { zoom: number; cx: number; cy: number; fits: boolean } {
  const zoom = roomZoom(view, bounds, insets, cssZoom, dpr);
  const c = cameraCenter({ w: view.w, h: view.h, zoom }, bounds, focus, insets);
  let cy = c.cy;
  const toLoY = (view.h / 2 - insets.top) / zoom;
  const topCy = bounds.y0 + toLoY; // the camera centre that puts the top of the bounds (the north wall) at the top of the free region
  if (cy > topCy) {
    // following: while the avatar is in the top NORTH_ROWS rows the view sits at the top of the bounds, and eases into following over the next four rows
    const t = Math.min(1, Math.max(0, (focus.y - (NORTH_ROWS * T - 10)) / (4 * T)));
    cy = topCy + (cy - topCy) * t;
  }
  return { zoom, cx: c.cx, cy, fits: fitsAt(view, bounds, insets, zoom) };
}

/** Rows next to the north wall in which the camera keeps the whole wall in view. */
export const NORTH_ROWS = 3;

/** World y of the top edge of the free region (just under the HUD) for a camera centre: what the player sees at the top of the map. */
export const viewTop = (view: { h: number }, cy: number, zoom: number, insets: Insets): number => cy - (view.h / 2 - insets.top) / zoom;
