import type { RoomId, Tile } from './types.js';

/**
 * Readable world (HOWTO Phase 7 step 2): signs, menus, posters, headlines. The list is empty until
 * the art/content agents author it; the server already validates `read` messages against it.
 */
export interface HotspotDef {
  id: string;
  room: RoomId;
  x: number;
  y: number;
  /** Footprint in tiles (default 1x1). */
  w?: number;
  h?: number;
  pt: string;
  en: string;
  /** Curriculum card ids this text teaches. */
  cards?: string[];
}

export const HOTSPOTS: HotspotDef[] = [];

export const hotspotById = (id: string): HotspotDef | undefined => HOTSPOTS.find((h) => h.id === id);

/** You can read a hotspot from this many tiles away (Chebyshev, measured to its nearest tile). */
export const HOTSPOT_READ_RANGE = 3;

/** Chebyshev distance between two tiles (diagonal steps count as 1, like the door check). */
export const tileDistance = (a: Tile, b: Tile): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Distance from a tile to the nearest tile of the hotspot's footprint. */
export function hotspotDistance(h: Pick<HotspotDef, 'x' | 'y' | 'w' | 'h'>, tile: Tile): number {
  const w = Math.max(1, h.w ?? 1);
  const hh = Math.max(1, h.h ?? 1);
  const dx = Math.max(h.x - tile.x, 0, tile.x - (h.x + w - 1));
  const dy = Math.max(h.y - tile.y, 0, tile.y - (h.y + hh - 1));
  return Math.max(dx, dy);
}
