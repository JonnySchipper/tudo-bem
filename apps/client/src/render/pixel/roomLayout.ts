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

/**
 * Wall decor on the west wall: not visible edge-on, so the pixel view moves it (`relocatedWestDecor`). A room with its own `pixelWalls`
 * (rooms.ts) authors the whole north wall for this view, so none of its west decor is skipped.
 */
export const skippedWestDecor = (room: RoomDef): WallDecor[] => (room.pixelWalls ? [] : room.walls.filter((w) => w.wall === 'left'));

/** The decor on the north wall: the room's authored top-down list (`pixelWalls`), else its own right-wall decor. */
export const northDecor = (room: RoomDef): WallDecor[] => room.pixelWalls ?? room.walls.filter((w) => w.wall === 'right');

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

/** Clickable area of an outdoor door (Vila Ipê): the door art (about 24 px wide, 34 px tall, centred on `doorAt`) plus its tile. */
export function outdoorDoorRect(p: PortalDef): Rect {
  const cx = ((p.doorAt?.x ?? p.x) + 0.5) * T;
  return { x0: Math.min(cx - 12, p.x * T), y0: (p.y + 1) * T - 34, x1: Math.max(cx + 12, (p.x + 1) * T), y1: (p.y + 1) * T };
}

/** Clickable area of a portal: the door plus its floor tile. */
export function portalHitRect(p: PortalDef): Rect {
  if (!p.wall) return outdoorDoorRect(p);
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
/** Tiles of sky and far skyline above the north row of an open-air map, so the rooftop of the Edifício (28 px above its 6 rows) is whole. */
export const OUTDOOR_TOP_MARGIN_TILES = 2;

export function roomBounds(room: RoomDef, tallestFacade = 0): Rect {
  // an open-air map is just its tiles: buildings are props inside it, a taller sprite (the rooftop of the Edifício) is cropped by the map top
  if (room.outdoor) return { x0: 0, y0: -OUTDOOR_TOP_MARGIN_TILES * T, x1: room.cols * T, y1: room.rows * T };
  return { x0: -WEST_STRIP_TILES * T, y0: -Math.max(NORTH_BAND_TILES * T, tallestFacade), x1: room.cols * T, y1: room.rows * T };
}

// ------------------------------------------------------------------ wall art (art track 3): mapping tables and pure layout
/** Wall art style per room (`walls/north_<style>_l|_m|_r`, `walls/west_<style>`, `walls/west_<style>_b`). */
export const WALL_STYLE: Record<RoomId, string> = { praca: 'praca', rua: 'praca', rua_leste: 'praca', feira: 'praca', padaria: 'padaria', kitnet: 'kitnet', academia: 'academia', escola: 'academia', andar: 'academia' };

export const northWallKey = (style: string, part: 'l' | 'm' | 'r') => `walls/north_${style}_${part}`;
export const westWallKey = (style: string, bottom: boolean) => `walls/west_${style}${bottom ? '_b' : ''}`;

/**
 * Which sprite draws a wall decor item and where it sits. `bottom` is the world y of the sprite's anchor row (negative = up the north band),
 * `mode` 'tile' repeats the sprite along from..to, 'center' centres it on the span. `tiles` is the span the art was drawn for (used to place
 * west-wall decor that moves to a free part of the north wall).
 */
export interface DecorArt {
  key: string;
  mode: 'tile' | 'center';
  bottom: number;
  tiles: number;
}

export function decorArt(d: WallDecor): DecorArt | null {
  const span = d.to - d.from;
  switch (d.kind) {
    case 'azulejos': return { key: 'walls/azulejos', mode: 'tile', bottom: -1, tiles: 1 };
    case 'prateleira_paes': return { key: 'walls/prateleira_paes', mode: 'center', bottom: -2, tiles: 4 };
    case 'lousa': return { key: 'walls/lousa', mode: 'center', bottom: -8, tiles: 2 };
    case 'janela_rua': return { key: 'walls/janela_rua', mode: 'center', bottom: -8, tiles: 3 };
    case 'janela': return { key: 'walls/janela', mode: 'center', bottom: -8, tiles: 2 };
    case 'relogio': return { key: 'walls/relogio', mode: 'center', bottom: -26, tiles: 1 };
    case 'tv': return { key: 'walls/tv', mode: 'center', bottom: -13, tiles: 2 };
    case 'cobogo': return { key: 'walls/cobogo', mode: 'center', bottom: -8, tiles: 1 };
    case 'foto': return { key: 'walls/foto', mode: 'center', bottom: -12, tiles: 2 };
    case 'placa': return { key: 'walls/placa', mode: 'center', bottom: -12, tiles: 4 };
    case 'poster': return { key: d.text?.startsWith('RESPEITO') ? 'walls/poster_respeito' : 'walls/poster', mode: 'center', bottom: -8, tiles: 2 };
    case 'toldo': return { key: 'walls/toldo', mode: 'center', bottom: -30, tiles: 4 };
    case 'mural': return { key: span >= 6 ? 'walls/mural' : 'walls/mural_s', mode: 'center', bottom: -6, tiles: span >= 6 ? 7 : 4 };
    case 'predio': return { key: 'walls/predio', mode: 'center', bottom: -1, tiles: 3 };
    case 'metro': return { key: 'walls/metro', mode: 'center', bottom: -9, tiles: 2 };
    default: return null; // fachada_padaria is the facade sprite
  }
}

/** The order west-wall decor asks for a free stretch of the north wall (posters and TVs first). */
const WEST_PRIORITY: WallDecor['kind'][] = ['poster', 'tv', 'relogio', 'cobogo', 'foto', 'janela', 'janela_rua', 'metro', 'predio', 'mural'];

/**
 * West-wall decor cannot be seen edge-on, so each item is moved to a free stretch of the north wall (columns -1..cols-1, where column -1 is
 * the corner above the west strip): the first gap wide enough for the art, otherwise dropped (it stays in `describeSkipped`). Azulejos are
 * a wainscot already covered by the north wall's own. Pure and deterministic; rooms.ts is not changed.
 */
export function relocatedWestDecor(room: RoomDef): WallDecor[] {
  if (room.pixelWalls) return []; // authored for the top-down view: nothing to move
  const used = new Set<number>();
  for (const d of northDecor(room)) {
    if (d.kind === 'azulejos' || d.kind === 'toldo') continue; // a wainscot and an awning over the shelves leave the wall free
    for (let x = d.from; x < d.to; x++) used.add(x);
  }
  for (const p of room.portals) {
    if (!isNorthPortal(p)) continue;
    const [a, b] = FACADE_FOR_ROOM[p.to] ? [p.x - 3, p.x + 4] : [p.x, p.x + 1];
    for (let x = a; x < b; x++) used.add(x);
  }
  const out: WallDecor[] = [];
  const west = skippedWestDecor(room).filter((d) => d.kind !== 'azulejos');
  west.sort((a, b) => WEST_PRIORITY.indexOf(a.kind) - WEST_PRIORITY.indexOf(b.kind));
  for (const d of west) {
    const need = decorArt(d)?.tiles ?? 1;
    for (let x = -1; x + need <= room.cols; x++) {
      let free = true;
      for (let k = x; k < x + need; k++) if (used.has(k)) free = false;
      if (!free) continue;
      for (let k = x; k < x + need; k++) used.add(k);
      out.push({ ...d, wall: 'right', from: x, to: x + need });
      break;
    }
  }
  return out;
}

/** Width in px of the window art (`walls/janela` 32, `walls/janela_rua` 48) and the light patch sprite that belongs to it. */
const WINDOW_LIGHT: Partial<Record<WallDecor['kind'], { w: number; key: string }>> = {
  janela: { w: 32, key: 'fx/light_patch_32' },
  janela_rua: { w: 48, key: 'fx/light_patch_48' },
};

/**
 * The window light patches of a room (Phase 4a): one per north-wall window, the top-left corner in world px of the slanted patch that falls on
 * the floor under it (light comes from the upper left, so the patch leans to the right). Pure.
 */
export function windowPatches(room: RoomDef): { key: string; x: number; y: number }[] {
  const out: { key: string; x: number; y: number }[] = [];
  for (const d of allNorthDecor(room)) {
    const win = WINDOW_LIGHT[d.kind];
    if (win) out.push({ key: win.key, x: Math.round(((d.from + d.to) * T) / 2 - win.w / 2), y: 0 });
  }
  return out;
}

/** Everything drawn on the north wall: its own decor plus the relocated west decor. */
export const allNorthDecor = (room: RoomDef): WallDecor[] => [...northDecor(room), ...relocatedWestDecor(room)];
