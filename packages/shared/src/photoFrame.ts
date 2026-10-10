import type { Tile } from './types.js';

/**
 * The viewfinder in the world, as the client sends it with a shot: a rect in world (art) px, 16 px per tile, the same units the pixel view
 * draws in. The client decides which objects are in the picture from the art it draws; the server only checks that the claimed objects are
 * plausibly near that frame, and that the frame is plausibly somewhere on the player's screen. Pure, shared by both sides.
 */
export interface PhotoFrame {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Art px per tile (the pixel view's `T`). */
const TILE = 16;

/**
 * Biggest frame a real viewfinder can cover, in tiles: 220 x 148 CSS px at the lowest zoom the view uses (2 CSS px per art px, a little less on
 * a fractional device pixel ratio, coords.deviceZoomFor) is about 9 x 6 tiles. Bigger is not a picture the game took.
 */
export const PHOTO_FRAME_MAX_TILES = { w: 12, h: 8 } as const;

/**
 * How far from the player (Chebyshev tiles) the frame's centre may be: a whole screen across (a 1660 px wide desktop at 3 CSS px per art px
 * shows about 35 tiles, and the camera stops following at the map's edge, so the player can stand at one side of it).
 */
export const PHOTO_VIEW_RANGE = 40;

/**
 * How far an object's tile box may be from the frame and still have its art in it (tiles). Art stands on its footprint and rises above it: a
 * tree, a lamp post or a building front shows several tiles north of the tiles it stands on, so the frame may be well above the box.
 */
export const PHOTO_ART_REACH = { up: 10, side: 3, down: 2 } as const;

/** A frame from the wire: four finite numbers, a positive size no bigger than a viewfinder. Null otherwise. */
export function photoFrame(raw: unknown): PhotoFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const { x0, y0, x1, y1 } = raw as Record<string, unknown>;
  if (![x0, y0, x1, y1].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const f = { x0: x0 as number, y0: y0 as number, x1: x1 as number, y1: y1 as number };
  const w = f.x1 - f.x0;
  const h = f.y1 - f.y0;
  if (!(w > 0 && h > 0) || w > PHOTO_FRAME_MAX_TILES.w * TILE || h > PHOTO_FRAME_MAX_TILES.h * TILE) return null;
  return f;
}

/** Is the frame's centre within a screen of the player? */
export function frameNearPlayer(f: PhotoFrame, player: Tile, range = PHOTO_VIEW_RANGE): boolean {
  const cx = (f.x0 + f.x1) / 2 / TILE;
  const cy = (f.y0 + f.y1) / 2 / TILE;
  return Math.max(Math.abs(cx - (player.x + 0.5)), Math.abs(cy - (player.y + 0.5))) <= range;
}

/**
 * Can something standing on this tile box (tiles; `w`/`h` default 1) show in the frame? The box, grown by the art reach (mostly upwards),
 * must overlap the frame.
 */
export function frameReaches(f: PhotoFrame, box: { x: number; y: number; w?: number; h?: number }): boolean {
  const r = PHOTO_ART_REACH;
  const x0 = (box.x - r.side) * TILE;
  const x1 = (box.x + Math.max(1, box.w ?? 1) + r.side) * TILE;
  const y0 = (box.y - r.up) * TILE;
  const y1 = (box.y + Math.max(1, box.h ?? 1) + r.down) * TILE;
  return f.x0 < x1 && f.x1 > x0 && f.y0 < y1 && f.y1 > y0;
}
