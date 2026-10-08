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

/** CSS zoom (art px -> CSS px): about 26-28 tiles across and 14+ tall on a desktop (1280 x 800 -> 3), phones stay at 2, clamped to 2..5. */
export function cssZoomFor(innerW: number, innerH: number): number {
  const z = Math.floor(Math.min(innerW / (26 * T), innerH / (14 * T)));
  return Math.min(5, Math.max(2, z));
}

/** Integer device zoom for a CSS zoom. Fractional DPRs (1.25, 1.5) round down so pixels stay even. */
export function deviceZoomFor(cssZoom: number, dpr: number): number {
  return Number.isInteger(dpr) ? cssZoom * dpr : Math.max(1, Math.floor(cssZoom * dpr));
}

/** Stay under the WebGL texture limit common on phones and retina displays (#48). */
export const MAX_BUFFER = 4096;

/**
 * Backing-store size for the world canvas. The device pixel ratio is clamped to 1..3, then lowered until neither side exceeds
 * `MAX_BUFFER`. Pass layout sizes (innerWidth/clientWidth), never a transformed getBoundingClientRect.
 */
export function bufferPixels(cssW: number, cssH: number, devicePixelRatio: number): { dpr: number; width: number; height: number } {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  const wanted = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
  const dpr = Math.min(wanted, MAX_BUFFER / w, MAX_BUFFER / h);
  return { dpr, width: Math.max(1, Math.floor(w * dpr)), height: Math.max(1, Math.floor(h * dpr)) };
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
 * Screen edges (CSS px) the HUD covers, kept clear of the avatar. Desktop: the top bar, and the emote chips over the chat bar. The phone layout
 * (`compact`, hudLayout.COMPACT_QUERY) has the emotes behind a smiley in the chat bar: a portrait phone keeps the taller top (the bar and the
 * pills under it) and only the chat bar at the bottom (the joystick that once sat above it is gone, #127); a landscape phone has a single
 * bar strip on top and the chat bar, so the avatar is not pushed into the top third of a 390 px tall screen.
 */
export function hudInsets(w: number, h: number, compact: boolean, safe: { top: number; bottom: number } = { top: 0, bottom: 0 }): Insets {
  const landscape = compact && h <= 520 && w > h;
  const top = landscape ? 60 : compact ? 124 : 64;
  const bottom = landscape ? 70 : compact ? 76 : 110;
  return { top: top + safe.top, bottom: bottom + safe.bottom, left: 0, right: 0 };
}

/**
 * Camera centre for a focus point. Per axis: if the room (`bounds`) is smaller than the free part of the screen it is centred in
 * that part (the outside shows the backdrop); otherwise the focus is followed and clamped so the view never leaves the bounds.
 * `insets` (device px) reserve screen edges for the HUD; the focus is kept inside the free region. `knee` (world px, 0 = a hard clamp) rounds
 * the clamp off (`softClamp`), so walking toward an edge the camera slows down and settles instead of stopping dead; `kneeTop` is the north
 * edge's own (0 where the north hold of `framingAt` already eases it: a knee there would stop the view short of the top of the bounds).
 */
export function cameraCenter(view: { w: number; h: number; zoom: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, knee = 0, kneeTop = knee): { cx: number; cy: number } {
  const axis = (size: number, lo: number, hi: number, b0: number, b1: number, f: number, kLo: number) => {
    // world distance from the centre to the free region's edges
    const toLo = (size / 2 - lo) / view.zoom;
    const toHi = (size / 2 - hi) / view.zoom;
    const min = b0 + toLo;
    const max = b1 - toHi;
    if (min >= max) return (b0 + b1) / 2 - (toHi - toLo) / 2; // fits: centre the room in the free region
    return softClamp(f, min, max, kLo, knee);
  };
  return {
    cx: axis(view.w, insets.left, insets.right, bounds.x0, bounds.x1, focus.x, knee),
    cy: axis(view.h, insets.top, insets.bottom, bounds.y0, bounds.y1, focus.y, kneeTop),
  };
}

/**
 * Clamp `f` to [min, max] with rounded corners: within `kneeLo` / `kneeHi` of a bound the output bends smoothly (a quadratic, slope 1 to 0)
 * and reaches the bound that far past it, so the followed camera eases into the edge of a map instead of stopping dead. A knee of 0 is a plain
 * clamp on that side. Each knee is narrowed to half the range so the two corners never overlap.
 */
export function softClamp(f: number, min: number, max: number, kneeLo: number, kneeHi = kneeLo): number {
  const half = (max - min) / 2;
  const lo = Math.min(kneeLo, half);
  const hi = Math.min(kneeHi, half);
  if (hi > 0 && f > max - hi) {
    const u = Math.min(2 * hi, f - (max - hi));
    return max - hi + u - (u * u) / (4 * hi);
  }
  if (lo > 0 && f < min + lo) {
    const u = Math.min(2 * lo, min + lo - f);
    return min + lo - u + (u * u) / (4 * lo);
  }
  return Math.min(max, Math.max(min, f));
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
export function roomFraming(view: { w: number; h: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, cssZoom: number, dpr: number, north: { rows: number; bandPx: number } | false = { rows: NORTH_ROWS, bandPx: NORTH_BAND_PX }): { zoom: number; cx: number; cy: number; fits: boolean } {
  return framingAt(view, bounds, focus, insets, roomZoom(view, bounds, insets, cssZoom, dpr), north);
}

/**
 * The camera for an open-air map (issue #123): the window's own integer zoom, never stepped down to fit the map, following the avatar and
 * clamped to the map's bounds (an axis narrower than the screen is centred). The town drawn around the map (surround.ts) fills the rest
 * of the window, so a street on a big desktop is seen at the same scale as everywhere else instead of shrunk onto black.
 */
export function outdoorFraming(view: { w: number; h: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, cssZoom: number, dpr: number): { zoom: number; cx: number; cy: number; fits: boolean } {
  return framingAt(view, bounds, focus, insets, deviceZoomFor(cssZoom, dpr), OUTDOOR_NORTH, OUTDOOR_KNEE);
}

function framingAt(view: { w: number; h: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, zoom: number, north: { rows: number; bandPx: number } | false, knee = 0): { zoom: number; cx: number; cy: number; fits: boolean } {
  const c = cameraCenter({ w: view.w, h: view.h, zoom }, bounds, focus, insets, knee, north ? 0 : knee);
  let cy = c.cy;
  const toLoY = (view.h / 2 - insets.top) / zoom;
  // the camera centre that puts the top of the north wall band (3 tiles above row 0; a facade may rise higher, that part may be cropped) at the top of the free region
  const topCy = Math.max(bounds.y0, -(north ? north.bandPx : 0)) + toLoY;
  if (north && cy > topCy) {
    // following: while the avatar is in the top NORTH_ROWS rows the view sits at the top of the bounds, and eases into following over the next
    // four rows (smoothstep: no kink where the hold ends or where the follow takes over)
    const t = Math.min(1, Math.max(0, (focus.y - (north.rows * T - 10)) / (4 * T)));
    cy = topCy + (cy - topCy) * t * t * (3 - 2 * t);
  }
  return { zoom, cx: c.cx, cy, fits: fitsAt(view, bounds, insets, zoom) };
}

/** Open-air maps round off the follow clamp over 2 tiles each side of the edge (softClamp). */
export const OUTDOOR_KNEE = 2 * T;

/** Rows next to the north wall in which the camera keeps the whole wall in view. */
export const NORTH_ROWS = 3;
/** The outdoor map keeps the tops of its building fronts in view while you stand on the north sidewalk (rows 0-8), then eases into following. */
export const OUTDOOR_NORTH = { rows: 8, bandPx: 0 };
/** Height of the north wall band in art px (roomLayout.NORTH_BAND_TILES * T). */
export const NORTH_BAND_PX = 3 * T;

/** World y of the top edge of the free region (just under the HUD) for a camera centre: what the player sees at the top of the map. */
export const viewTop = (view: { h: number }, cy: number, zoom: number, insets: Insets): number => cy - (view.h / 2 - insets.top) / zoom;

/** World rect the whole canvas shows (HUD areas included) for a camera centre and device zoom. */
export const viewRect = (view: { w: number; h: number }, cx: number, cy: number, zoom: number): Rect => ({ x0: cx - view.w / 2 / zoom, y0: cy - view.h / 2 / zoom, x1: cx + view.w / 2 / zoom, y1: cy + view.h / 2 / zoom });
