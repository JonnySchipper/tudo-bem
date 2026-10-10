/**
 * The Mapa: one picture of Vila Ipê where every place is its own button. Pure data and rules (no DOM), so the panel (`townMap.ts`), the
 * picture (`townMapArt.ts`) and the tests share them: where each area of the game sits on the map, where each place can be tapped, and what
 * a tap on it does.
 *
 * The picture is the real town: each outdoor area is drawn from its own layout with the game's own sprites (the same snapshot the title screen
 * uses), laid out the way the areas join in the game. The Rua dos Ipês runs across the top (west half, then east half) with the Padaria,
 * Edifício Ipê, Academia, Escola and Pet Shop fronts on it; the Praça sits under the brick path that leads down from the rua; the Feira opens off the
 * Praça's east path; the Aeroporto (its runway and terminal front) sits up the road the 875 bus takes from the rua leste.
 *
 * Every room in the shared room list has an entry in `ROOM_ON_MAP` (a new RoomId fails to compile until it is placed or routed through
 * another place). Praia and Fazenda are drawn at the end of the road as "Em breve": tapping them shows a teaser, never travel.
 */
import { ROOMS, ROOM_IDS, type RoomId } from '@tudobem/shared';

/** One map tile is one game tile (16 art px). */
export const MAP_T = 16;
export const MAP_COLS = 80;
export const MAP_ROWS = 40;
/** The map is MAP_W × MAP_H art pixels: one art pixel of the map is one pixel of the game. */
export const MAP_W = MAP_COLS * MAP_T;
export const MAP_H = MAP_ROWS * MAP_T;

/** A tap area in map pixels: x, y, width, height. */
export type Box = readonly [x: number, y: number, w: number, h: number];

/** The outdoor areas the picture is drawn from. */
export type MapArea = 'rua' | 'rua_leste' | 'praca' | 'feira' | 'aeroporto';

/**
 * Where each area's top-left tile sits on the map, in tiles. These follow the game's own seams: the rua leste goes on where the rua ends
 * (x21), the Praça's entrance path (x14-17) sits under the rua's brick path (x15-18), the Feira's gate (y7-10) meets the Praça's east path
 * (y10-13). The Aeroporto is up the bus road, east of the rua.
 */
export const AREA_AT: Record<MapArea, readonly [col: number, row: number]> = {
  rua: [0, 0],
  rua_leste: [ROOMS.rua.cols, 0],
  praca: [1, ROOMS.rua.rows],
  feira: [1 + ROOMS.praca.cols, ROOMS.rua.rows + 3],
  aeroporto: [50, 0],
};

/** The Aeroporto on the map: its runway and the terminal's first rows (to `AERO_KEEP`), then its front (from `AERO_FRONT`: the low glass, the curb, the bus). */
export const AERO_KEEP = 14;
export const AERO_FRONT = 23;
export const AERO_MAP_ROWS = AERO_KEEP + (ROOMS.aeroporto.rows - AERO_FRONT);

export type SoonId = 'praia' | 'fazenda';

export interface MapSpot {
  /** A RoomId for a real place, or a coming-soon id. */
  id: RoomId | SoonId;
  /** Where a tap travels; null for the coming-soon places. */
  room: RoomId | null;
  pt: string;
  en: string;
  /** The tap areas in map pixels (the place itself is the button); the first one anchors the label and the "você está aqui" pin. */
  hit: Box[];
  soon?: { pt: string; en: string };
}

const at = (area: MapArea, x: number, y: number, w: number, h: number): Box => [(AREA_AT[area][0] + x) * MAP_T, (AREA_AT[area][1] + y) * MAP_T, w * MAP_T, h * MAP_T];

/** Bilingual name of a room on the map (the room's own name and gloss). */
const roomLabel = (id: RoomId) => ({ pt: ROOMS[id].name, en: ROOMS[id].gloss });

const place = (id: RoomId, hit: Box[]): MapSpot => ({ id, room: id, ...roomLabel(id), hit });

/** Every room of the shared room list: a place on the map, or reached through another place (shown there as "você está aqui"). */
export const ROOM_ON_MAP: Record<RoomId, MapSpot | { via: RoomId }> = {
  aeroporto: place('aeroporto', [at('aeroporto', 0, 0, ROOMS.aeroporto.cols, AERO_MAP_ROWS - 1)]),
  desembarque: { via: 'aeroporto' },
  // the building fronts on the rua (tiles x0-5 of each area): the door is in the front
  padaria: place('padaria', [at('rua', 0, 0, 8, 6)]),
  kitnet: place('kitnet', [at('rua', 11, 0, 10, 6)]),
  academia: place('academia', [at('rua_leste', 0, 0, 10, 6)]),
  escola: place('escola', [at('rua_leste', 10, 0, 6, 6)]),
  petshop: place('petshop', [at('rua_leste', 16, 0, 6, 6)]),
  // the street itself, from the sidewalk under the fronts to the lawns
  rua: place('rua', [at('rua', 0, 6, ROOMS.rua.cols, ROOMS.rua.rows - 6)]),
  rua_leste: place('rua_leste', [at('rua_leste', 0, 6, ROOMS.rua_leste.cols, ROOMS.rua_leste.rows - 6)]),
  praca: place('praca', [at('praca', 0, 0, ROOMS.praca.cols, ROOMS.praca.rows)]),
  feira: place('feira', [at('feira', 0, 0, ROOMS.feira.cols, ROOMS.feira.rows)]),
  // a player academy's floor is upstairs in the Academia do Bairro
  andar: { via: 'academia' },
};

/** The corner east of the Feira, under the bus road: the Praia (top) and the Fazenda (bottom) wait there. */
export const SOON_AT = { col: AREA_AT.feira[0] + ROOMS.feira.cols, praia: 20, fazenda: 30 } as const;

/** The coming-soon places: drawn small at the end of the road, a teaser on tap. */
export const SOON_SPOTS: MapSpot[] = [
  {
    id: 'praia',
    room: null,
    pt: 'Praia',
    en: 'Beach',
    hit: [[SOON_AT.col * MAP_T, SOON_AT.praia * MAP_T, (MAP_COLS - SOON_AT.col) * MAP_T, (SOON_AT.fazenda - SOON_AT.praia) * MAP_T]],
    soon: { pt: 'Areia, mar e um quiosque com água de coco. Logo dá pra pegar o ônibus até a praia!', en: 'Sand, sea and a kiosk with coconut water. Soon you can take the bus to the beach!' }, // needs_br: true
  },
  {
    id: 'fazenda',
    room: null,
    pt: 'Fazenda',
    en: 'Farm',
    hit: [[SOON_AT.col * MAP_T, SOON_AT.fazenda * MAP_T, (MAP_COLS - SOON_AT.col) * MAP_T, (MAP_ROWS - SOON_AT.fazenda) * MAP_T]],
    soon: { pt: 'Plantações, um celeiro e os bichos da fazenda. Em breve você vai poder visitar!', en: 'Fields, a barn and the farm animals. Soon you will be able to visit!' }, // needs_br: true
  },
];

/** All the places on the map: the rooms in the shared room-list order, then the coming-soon places. */
export function mapSpots(): MapSpot[] {
  const rooms = ROOM_IDS.map((id) => ROOM_ON_MAP[id]).filter((s): s is MapSpot => 'hit' in s);
  return [...rooms, ...SOON_SPOTS];
}

/** The place that shows "você está aqui" for the room you are in (a room inside another place marks that place). */
export function hereSpotId(room: RoomId | null | undefined): RoomId | null {
  if (!room) return null;
  const on = ROOM_ON_MAP[room];
  return 'via' in on ? on.via : room;
}

// ---------------------------------------------------------------- what a tap does

export type TapResult = 'travel' | 'select' | 'teaser' | 'stay';

/**
 * Mouse and keyboard: a click on a place travels there. Touch: the first tap lights the place and shows its name (a phone has no hover),
 * a second tap on the same place travels. A coming-soon place only ever shows its teaser; where you already are just closes the map.
 */
export function tapResult(spot: Pick<MapSpot, 'id' | 'room'>, o: { touch: boolean; selected: string | null; here: string | null }): TapResult {
  if (!spot.room) return 'teaser';
  if (o.touch && o.selected !== spot.id) return 'select';
  return spot.id === o.here ? 'stay' : 'travel';
}

/** The centre of a place's first tap area, in map pixels (for the label and the pin). */
export function spotAnchor(spot: Pick<MapSpot, 'hit'>): { x: number; y: number; top: number } {
  const [x, y, w, h] = spot.hit[0]!;
  return { x: x + w / 2, y: y + h / 2, top: y };
}

/** Name tags and ribbons of the places at the map's left and right edges hang inwards from the edge instead of centring (and running off). */
export type TagAlign = 'center' | 'start' | 'end';

/** Where a place's name tag goes, in map pixels, and which way it hangs. */
export function tagPlace(spot: Pick<MapSpot, 'hit'>): { x: number; y: number; align: TagAlign } {
  const [x, , w] = spot.hit[0]!;
  const a = spotAnchor(spot);
  if (a.x < MAP_W * 0.15) return { x: x + 8, y: a.y, align: 'start' };
  if (a.x > MAP_W * 0.85) return { x: x + w - 8, y: a.y, align: 'end' };
  return { x: a.x, y: a.y, align: 'center' };
}

/** Room the "você está aqui" tag needs above its pin, in map pixels (the pin sits on the place's top edge, lower for the fronts along the map's top). */
export const PIN_ROOM = { above: 64, side: 96 } as const;

/** Where the "você está aqui" pin points, in map pixels: the top of the place, kept far enough inside the map for its tag. */
export function pinPlace(spot: Pick<MapSpot, 'hit'>): { x: number; y: number } {
  const a = spotAnchor(spot);
  return { x: Math.min(Math.max(a.x, PIN_ROOM.side), MAP_W - PIN_ROOM.side), y: Math.max(a.top, PIN_ROOM.above) };
}
