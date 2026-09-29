/**
 * Top-down layout of a room's walls and doors (HOWTO §6 Phase 2 step 4). Pure: no Phaser.
 *
 * The isometric "right" wall (y = 0) becomes a NORTH wall band, 3 tiles tall, above row 0. The isometric "left" wall (x = 0) becomes a
 * WEST wall strip, 1 tile wide, left of column 0. Wall decor on the north wall is placed at from..to along x. Wall decor on the west wall
 * cannot be seen edge-on, so Phase 2 skips it (`skippedWestDecor`); Phase 4 moves it to the north wall or to floor props in rooms.ts.
 */
import type { PortalDef, RoomDef, RoomId, WallDecor } from '@tudobem/shared';
import { T, type Rect } from './coords';

export const NORTH_BAND_TILES = 3;
export const WEST_STRIP_TILES = 1;

/** Facade sprites (manifest keys) for a door on the north wall, by destination room. Only the padaria fits the Phase 2 Praça width. */
export const FACADE_FOR_ROOM: Partial<Record<RoomId, string>> = { padaria: 'facades/padaria' };

/** Game hour whose lighting grade a room uses until the game clock arrives (Phase 6): `tarde` is golden hour, `manha` warm morning, `dia` neutral. */
export const ROOM_HOUR: Record<RoomDef['lighting'], number> = { tarde: 17.5, manha: 8, dia: 12 };

/** Floor chars with no terrain art of their own that borrow another terrain (dirt d looks like grass; t, l, m, k, j have their own flush terrain since art track 3). Still reported as missing art. */
export const FLOOR_SUBSTITUTE: Record<string, string> = { d: 'g' };

/** Flat fills for interior floors until their tiles exist (HOWTO §5.10 placeholders; `x` is not drawn). */
export const FLOOR_PLACEHOLDER: Record<string, string | undefined> = { x: undefined };

/** Wall decor on the west wall: skipped in Phase 2 (not visible edge-on). */
export const skippedWestDecor = (room: RoomDef): WallDecor[] => room.walls.filter((w) => w.wall === 'left');

export const northDecor = (room: RoomDef): WallDecor[] => room.walls.filter((w) => w.wall === 'right');

/** `padaria: azulejos 0-9, janela 2-4, ...` for the console and the report. */
export function describeSkipped(rooms: Record<string, RoomDef>): string[] {
  return Object.values(rooms).flatMap((r) => skippedWestDecor(r).map((d) => `${r.id}: ${d.kind} ${d.from}-${d.to}${d.text ? ` "${d.text}"` : ''}`));
}

export const isNorthPortal = (p: PortalDef) => p.wall === 'right';
export const isWestPortal = (p: PortalDef) => p.wall === 'left';

/** World rect of the north wall band (x from the west strip to the east edge, y above row 0). */
export const northBandRect = (room: RoomDef): Rect => ({ x0: -WEST_STRIP_TILES * T, y0: -NORTH_BAND_TILES * T, x1: room.cols * T, y1: 0 });

/** World rect of the west wall strip (rows 0..rows-1, left of column 0). */
export const westStripRect = (room: RoomDef): Rect => ({ x0: -WEST_STRIP_TILES * T, y0: 0, x1: 0, y1: room.rows * T });

/** Where a north-wall decor item sits on the band: its `from..to` span along x, in the middle of the band. */
export const northDecorRect = (d: WallDecor): Rect => ({ x0: d.from * T, y0: -NORTH_BAND_TILES * T + 6, x1: d.to * T, y1: -8 });

/** A door in the north wall: the door frame rises above the portal tile. */
export const northDoorRect = (p: PortalDef): Rect => ({ x0: p.x * T, y0: -2 * T, x1: (p.x + 1) * T, y1: 0 });

/** A door in the west wall: the frame fills the wall strip cell at the portal's row. */
export const westDoorRect = (p: PortalDef): Rect => ({ x0: -WEST_STRIP_TILES * T, y0: p.y * T, x1: 0, y1: (p.y + 1) * T });

/** The doormat is the portal tile itself. */
export const doormatRect = (p: PortalDef): Rect => ({ x0: p.x * T, y0: p.y * T, x1: (p.x + 1) * T, y1: (p.y + 1) * T });

/** Clickable area of a portal: the door plus its floor tile. */
export function portalHitRect(p: PortalDef): Rect {
  const mat = doormatRect(p);
  const door = isNorthPortal(p) ? northDoorRect(p) : westDoorRect(p);
  return { x0: Math.min(mat.x0, door.x0), y0: Math.min(mat.y0, door.y0), x1: Math.max(mat.x1, door.x1), y1: Math.max(mat.y1, door.y1) };
}

/** Facades to draw for the north doors of a room: manifest key and the anchor (bottom-centre of the facade, on the wall base line). */
export function northFacades(room: RoomDef, has: (key: string) => boolean): { key: string; wx: number; wy: number; portal: PortalDef }[] {
  const out: { key: string; wx: number; wy: number; portal: PortalDef }[] = [];
  for (const p of room.portals) {
    if (!isNorthPortal(p)) continue;
    const key = FACADE_FOR_ROOM[p.to];
    if (key && has(key)) out.push({ key, wx: (p.x + 0.5) * T, wy: 0, portal: p });
  }
  return out;
}

/** Whether a north decor item is covered by a facade drawn at one of its portals (then the flat placeholder is not drawn). */
export const decorCoveredByFacade = (d: WallDecor, facades: { portal: PortalDef }[]): boolean => d.kind === 'fachada_padaria' && facades.some((f) => f.portal.x >= d.from && f.portal.x < d.to);

/** Bounds the camera may show: the room plus its walls, and any facade that rises above the band. */
export function roomBounds(room: RoomDef, tallestFacade = 0): Rect {
  return { x0: -WEST_STRIP_TILES * T, y0: -Math.max(NORTH_BAND_TILES * T, tallestFacade), x1: room.cols * T, y1: room.rows * T };
}
