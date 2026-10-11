/**
 * Wayfinding: every room says where its doors go. Each door, and each walk-off edge of the open-air areas, gets a tag in the world with
 * the destination in Portuguese over a small English line (the pixel view draws them with the nameplates, `WorldScene`). The first time
 * you stand in a room its tags glow for a while; after that they sit quietly. Every room's tags glow on a first visit, so there is no
 * separate "ways out" banner. `doorTagsFor` is pure and tested.
 */
import type { RoomDef, RoomId } from '@tudobem/shared';

export interface DoorTag {
  key: string;
  /** Tile (may be fractional) the tag stands on. */
  x: number;
  y: number;
  /** Arrow + Portuguese destination. */
  pt: string;
  en: string;
  to: RoomId;
}

/** The arrow for a portal: an edge points off the map; a door in a wall or a facade points at itself. */
function arrowFor(room: RoomDef, x: number, y: number, edge: boolean): string {
  if (!edge) return '🚪';
  if (x === 0) return '←';
  if (x === room.cols - 1) return '→';
  if (y === 0) return '↑';
  if (y === room.rows - 1) return '↓';
  return '→';
}

/**
 * One tag per way out: a door gets its own; a run of edge tiles to the same room (a whole street end) gets one, in its middle.
 * The English line drops a leading "to "/"Bus … · " echo of the Portuguese so the tag stays short.
 */
export function doorTagsFor(room: RoomDef): DoorTag[] {
  const groups = new Map<string, { xs: number[]; ys: number[]; pt: string; en: string; to: RoomId; edge: boolean; x0: number; y0: number }>();
  for (const p of room.portals) {
    const edge = !!p.edge;
    const x = p.doorAt?.x ?? p.x;
    const y = p.doorAt?.y ?? p.y;
    const side = edge ? arrowFor(room, p.x, p.y, true) : `${p.id}`;
    const key = `${p.to}|${side}`;
    const g = groups.get(key) ?? { xs: [], ys: [], pt: p.label.pt, en: p.label.en, to: p.to, edge, x0: p.x, y0: p.y };
    g.xs.push(x);
    g.ys.push(y);
    groups.set(key, g);
  }
  const mid = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return (s[0]! + s[s.length - 1]!) / 2;
  };
  return [...groups.entries()].map(([key, g]) => {
    const arrow = arrowFor(room, g.x0, g.y0, g.edge);
    return { key, x: mid(g.xs), y: mid(g.ys), pt: `${arrow} ${g.pt}`, en: g.en, to: g.to };
  });
}

const seenKey = (pid: string | undefined, room: RoomId) => `tb_room_seen:${pid ?? 'guest'}:${room}`;
/** How long a fresh room's tags glow. */
export const FRESH_MS = 20_000;
let freshUntil = 0;

/** Are this room's door tags still in their first-visit glow? */
export const doorsFresh = (): boolean => performance.now() < freshUntil;

/** First visit to a room: its door tags glow for a while. The tutorial rooms have their own guidance and skip it. */
export function noteRoomVisit(room: RoomId, tags: readonly DoorTag[], pid: string | undefined): void {
  freshUntil = 0;
  if (room === 'desembarque' || room === 'aeroporto' || room === 'andar' || !tags.length) return;
  let seen = false;
  try {
    seen = localStorage.getItem(seenKey(pid, room)) === '1';
    localStorage.setItem(seenKey(pid, room), '1');
  } catch {
    /* private mode: every visit is a first one */
  }
  if (!seen) freshUntil = performance.now() + FRESH_MS;
}
