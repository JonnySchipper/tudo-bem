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
  /** Extra look offset in world px (design-mode pan). Clicks use the same centre as the picture. */
  ox?: number;
  oy?: number;
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

function look(c: CamState): { cx: number; cy: number } {
  return { cx: c.cx + (c.ox ?? 0), cy: c.cy + (c.oy ?? 0) };
}

/** World px -> CSS px, relative to the canvas' top-left corner. */
export function worldToCanvas(c: CamState, wx: number, wy: number): { px: number; py: number } {
  const o = look(c);
  return { px: ((wx - o.cx) * c.zoom + c.w / 2) / c.dpr, py: ((wy - o.cy) * c.zoom + c.h / 2) / c.dpr };
}

/** CSS px (relative to the canvas' top-left corner) -> world px. */
export function canvasToWorld(c: CamState, px: number, py: number): { wx: number; wy: number } {
  const o = look(c);
  return { wx: (px * c.dpr - c.w / 2) / c.zoom + o.cx, wy: (py * c.dpr - c.h / 2) / c.zoom + o.cy };
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
 * Clamp `v` to [min, max] with a soft knee `knee` wide at each end: in the middle `v` passes through, and within `knee` of an end the result
 * eases into the end (a quadratic, so position and speed are both continuous) instead of stopping dead. The result never leaves [min, max].
 */
export function softClamp(v: number, min: number, max: number, knee: number): number {
  const k = Math.min(knee, (max - min) / 2);
  if (!(k > 0)) return Math.min(max, Math.max(min, v));
  const ease = (d: number) => (d <= -k ? 0 : d >= k ? d : (d + k) ** 2 / (4 * k));
  if (v - min < k) return min + ease(v - min);
  if (max - v < k) return max - ease(max - v);
  return v;
}

/**
 * Camera centre for a focus point. Per axis: if the room (`bounds`) is smaller than the free part of the screen it is centred in
 * that part (the outside shows the backdrop); otherwise the focus is followed and clamped so the view never leaves the bounds.
 * `insets` (device px) reserve screen edges for the HUD; the focus is kept inside the free region. A `knee` (world px) softens the clamp
 * (`softClamp`), so a camera following the avatar to the edge of a map slows into it instead of stopping in one frame.
 */
export function cameraCenter(view: { w: number; h: number; zoom: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, knee = 0): { cx: number; cy: number } {
  const axis = (size: number, lo: number, hi: number, b0: number, b1: number, f: number) => {
    // world distance from the centre to the free region's edges
    const toLo = (size / 2 - lo) / view.zoom;
    const toHi = (size / 2 - hi) / view.zoom;
    const min = b0 + toLo;
    const max = b1 - toHi;
    if (min >= max) return (b0 + b1) / 2 - (toHi - toLo) / 2; // fits: centre the room in the free region
    return softClamp(f, min, max, knee);
  };
  return {
    cx: axis(view.w, insets.left, insets.right, bounds.x0, bounds.x1, focus.x),
    cy: axis(view.h, insets.top, insets.bottom, bounds.y0, bounds.y1, focus.y),
  };
}

/** Snap a camera coordinate to the device pixel grid so art pixels never straddle two device pixels. */
export const snapToDevice = (v: number, zoom: number): number => Math.round(v * zoom) / zoom;

/** The HUD's own compact layout (hud.css): one strip on top and the chat bar below, on a narrow phone or a landscape phone. */
export const HUD_COMPACT_QUERY = '(max-width: 640px), (max-height: 520px)';

/**
 * HUD space (CSS px) the camera keeps the avatar out of, matching the HUD's layout. Desktop: the top bar and the chat bar with its emote row.
 * Compact portrait: the strip plus the tracker pill under it, and the chat bar (the old 168 px also held the removed joystick, #127). Compact
 * landscape: the strip and the chat bar only, so a 390 px tall phone keeps most of its height for the street.
 */
export function hudInsets(w: number, h: number, compact: boolean, safeTop = 0, safeBottom = 0): Insets {
  if (!compact) return { top: 64 + safeTop, bottom: 110 + safeBottom, left: 0, right: 0 };
  const landscape = w > h && h <= 520;
  return { top: (landscape ? 60 : 124) + safeTop, bottom: (landscape ? 64 : 72) + safeBottom, left: 0, right: 0 };
}

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

/** Floor (world px) kept in view below the avatar's feet when the camera leans north: three tiles, so the way south is always visible. */
export const MIN_VIEW_BELOW = 3 * T;

/**
 * The north look-ahead (world px) a room asks for (`CAMERA_LEAD_NORTH`), cut down on a short window so at least `MIN_VIEW_BELOW` of floor
 * stays visible between the avatar's feet and the bottom HUD. The camera centres `feetToFocus + lead` above the feet, so the room for the
 * lead is the half-height of the canvas above the bottom inset, less that offset and the floor kept below. Never negative.
 */
export function leadNorthFor(lead: number, viewH: number, insetBottom: number, zoom: number, feetToFocus: number): number {
  if (!(lead > 0)) return 0;
  const room = (viewH / 2 - insetBottom) / zoom - feetToFocus - MIN_VIEW_BELOW;
  return Math.max(0, Math.min(lead, room));
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
  return framingAt(view, bounds, focus, insets, deviceZoomFor(cssZoom, dpr), OUTDOOR_NORTH, EDGE_KNEE);
}

/** World px over which the outdoor camera eases into the edge of the map (issue #154): two tiles, so the stop reads as a slow-down. */
export const EDGE_KNEE = 2 * T;

function framingAt(view: { w: number; h: number }, bounds: Rect, focus: { x: number; y: number }, insets: Insets, zoom: number, north: { rows: number; bandPx: number } | false, knee = 0): { zoom: number; cx: number; cy: number; fits: boolean } {
  const c = cameraCenter({ w: view.w, h: view.h, zoom }, bounds, focus, insets, knee);
  let cy = c.cy;
  const toLoY = (view.h / 2 - insets.top) / zoom;
  // the camera centre that puts the top of the north wall band (3 tiles above row 0; a facade may rise higher, that part may be cropped) at the top of the free region
  const topCy = Math.max(bounds.y0, -(north ? north.bandPx : 0)) + toLoY;
  if (north && cy > topCy) {
    // following: while the avatar is in the top NORTH_ROWS rows the view sits at the top of the bounds, and eases into following over the next four rows
    const t = Math.min(1, Math.max(0, (focus.y - (north.rows * T - 10)) / (4 * T)));
    cy = topCy + (cy - topCy) * t;
  }
  return { zoom, cx: c.cx, cy, fits: fitsAt(view, bounds, insets, zoom) };
}

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
