/**
 * Decorate mode helpers (kitnet, HOWTO Phase 4 step 3). Pure: no Phaser, no `game` state.
 *
 * While a piece is being placed (`game.placing`) or a placed piece is being moved (`game.selectedFurniture` in edit mode) the scene draws a
 * translucent ghost of the real furniture sprite on the hovered tile, tinted green when the server would accept the move and red when it
 * would not (`canPlaceFurniture`, the same check the server runs).
 */
import { canPlaceFurniture, furnitureById, type PlacedFurniture, type RoomDef, type Tile } from '@tudobem/shared';

/** Multiplicative tints (Phaser `setTint`): light enough to keep the sprite's own colours readable under them. */
export const GHOST_OK = 0x9dffb0;
export const GHOST_BAD = 0xff8272;
/** Tile highlight colours under the ghost. */
export const TILE_OK = 0x5fd06b;
export const TILE_BAD = 0xe5572f;
export const GHOST_ALPHA = 0.62;

export interface GhostSpec {
  itemId: string;
  rot: 0 | 1;
  x: number;
  y: number;
  ok: boolean;
  /** tint for the sprite */
  tint: number;
  /** colour of the tile highlight */
  tile: number;
}

/**
 * The ghost to draw, or null when there is nothing to show: no piece in hand, the pointer is outside the room, the piece is unknown, or (moving)
 * the pointer is on the piece's own tile.
 */
export function ghostFor(
  room: RoomDef,
  furniture: readonly PlacedFurniture[],
  hover: Tile | null,
  placing: { itemId: string; rot: 0 | 1 } | null,
  selectedUid: string | null,
  editMode: boolean,
): GhostSpec | null {
  if (!hover) return null;
  let itemId: string;
  let rot: 0 | 1;
  let ignore: string | undefined;
  if (placing) {
    itemId = placing.itemId;
    rot = placing.rot;
  } else if (editMode && selectedUid) {
    const f = furniture.find((x) => x.uid === selectedUid);
    if (!f || (f.x === hover.x && f.y === hover.y)) return null;
    itemId = f.itemId;
    rot = f.rot;
    ignore = f.uid;
  } else return null;
  if (!furnitureById(itemId)) return null;
  const ok = canPlaceFurniture(room, furniture as PlacedFurniture[], hover.x, hover.y, ignore);
  return { itemId, rot, x: hover.x, y: hover.y, ok, tint: ok ? GHOST_OK : GHOST_BAD, tile: ok ? TILE_OK : TILE_BAD };
}
