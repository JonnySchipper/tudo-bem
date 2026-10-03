/**
 * Where every NPC is, and how it walks between schedule slots (HOWTO Phase 8 step 6, D4: tile based, A* over tiles).
 *
 * The whole timeline is a PURE function of the game clock: an NPC starts walking to its next slot the moment the boundary minute
 * passes, along `findPath` over its room's static grid, and stands there until the next boundary. Nothing is stored, so the server,
 * a reconnecting client and the tests all agree, and a walk in progress can be resumed from any moment.
 *
 * Changing rooms is two legs: walk to the portal tile in the old room (and vanish there), then appear at the portal's arrival tile in
 * the new room and walk to the slot tile. Going `em_casa` is a walk to the room's home door; coming back starts at its home entry.
 */
import { gameMinutesExact, MS_PER_GAME_MINUTE } from './clock.js';
import { findPath, npcStepMs, pathDuration, positionAlong, type PathPos } from './path.js';
import { buildGrid, key, npcDefById, ROOMS, type NpcId, type PortalDef, type RoomGrid } from './rooms.js';
import { NPC_HOME_DOORS, SCHEDULES, slotIndexAt, type NpcActivity, type ScheduleSlot } from './schedules.js';
import type { Dir, RoomId, Tile } from './types.js';

/** Tiles that are blocked in a room's static grid but an NPC may walk through: the gap behind the padaria counter (the vase). */
export const NPC_NAV_OPEN: Partial<Record<RoomId, Tile[]>> = { padaria: [{ x: 9, y: 2 }] };

const navGrids = new Map<RoomId, RoomGrid>();
/** The static grid NPCs path on: the room's props, minus the staff gap, and no NPC blocks another (a schedule never walks two into a corridor). */
export function npcNavGrid(room: RoomId): RoomGrid {
  let g = navGrids.get(room);
  if (!g) {
    g = buildGrid(ROOMS[room]);
    for (const t of NPC_NAV_OPEN[room] ?? []) g.blocked.delete(key(t.x, t.y));
    navGrids.set(room, g);
  }
  return g;
}

export interface NpcLeg {
  room: RoomId;
  from: Tile;
  path: Tile[];
  /** Walk length in real ms. */
  ms: number;
  /** The NPC leaves the world when this leg ends (through a portal or its home door). */
  vanish: boolean;
  /** `findPath` found no route (never true for the shipped schedules; a test asserts it): the leg is then an instant move. */
  broken: boolean;
}

function leg(room: RoomId, from: Tile, to: Tile, vanish: boolean): NpcLeg {
  const path = findPath(npcNavGrid(room), from, to);
  if (!path) return { room, from: to, path: [], ms: 0, vanish, broken: true };
  return { room, from, path, ms: pathDuration(from, path, npcStepMs), vanish, broken: false };
}

const legCache = new Map<string, NpcLeg[]>();

/** The public rooms an NPC may walk through on the way to another one (a kitnet is private: it is only ever a start or an end). */
const routeCache = new Map<string, RoomId[] | null>();
function roomRoute(from: RoomId, to: RoomId): RoomId[] | null {
  const ck = `${from}>${to}`;
  if (routeCache.has(ck)) return routeCache.get(ck)!;
  const prev = new Map<RoomId, RoomId | null>([[from, null]]);
  const queue: RoomId[] = [from];
  while (queue.length) {
    const r = queue.shift()!;
    if (r === to) break;
    for (const p of ROOMS[r].portals) {
      if (prev.has(p.to) || (ROOMS[p.to].private && p.to !== to)) continue;
      prev.set(p.to, r);
      queue.push(p.to);
    }
  }
  let out: RoomId[] | null = null;
  if (prev.has(to)) {
    out = [to];
    while (out[0] !== from) out.unshift(prev.get(out[0]!)!);
  }
  routeCache.set(ck, out);
  return out;
}

/** The portal of `room` to `to` nearest to `from` (an edge has one portal per tile: the NPC takes the closest one). */
function nearestPortal(room: RoomId, from: Tile, to: RoomId) {
  let best: PortalDef | undefined;
  let bd = Infinity;
  for (const p of ROOMS[room].portals) {
    if (p.to !== to) continue;
    const d = Math.abs(p.x - from.x) + Math.abs(p.y - from.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** The legs of a walk from `fromTile` in `fromRoom` to `toTile` in `toRoom`, hopping through the portals (doors and edges) in between. */
function route(fromRoom: RoomId, fromTile: Tile, toRoom: RoomId, toTile: Tile, vanishAtEnd: boolean): NpcLeg[] {
  const rooms = fromRoom === toRoom ? [fromRoom] : roomRoute(fromRoom, toRoom);
  if (!rooms) return [{ room: toRoom, from: toTile, path: [], ms: 0, vanish: vanishAtEnd, broken: true }];
  const legs: NpcLeg[] = [];
  let cur = fromTile;
  for (let i = 0; i + 1 < rooms.length; i++) {
    const portal = nearestPortal(rooms[i]!, cur, rooms[i + 1]!)!;
    legs.push(leg(rooms[i]!, cur, { x: portal.x, y: portal.y }, true));
    cur = portal.arrive;
  }
  legs.push(leg(toRoom, cur, toTile, vanishAtEnd));
  return legs;
}

/** The walk that takes an NPC from where `prev` left it to where `cur` wants it. Empty when it just keeps standing. */
export function legsBetween(prev: ScheduleSlot, cur: ScheduleSlot): NpcLeg[] {
  const ck = `${prev.npc}|${prev.from}>${cur.from}`;
  let out = legCache.get(ck);
  if (out) return out;
  const wasOut = prev.activity !== 'em_casa';
  const goesOut = cur.activity !== 'em_casa';
  if (!wasOut && !goesOut) out = [];
  else if (!wasOut) {
    // coming out of the home door of the room the home slot names, then on to where the slot wants them (possibly through other areas)
    const door = NPC_HOME_DOORS[prev.room];
    out = route(prev.room, door ? door.entry : prev.tile, cur.room, cur.tile, false);
  } else if (!goesOut) {
    const door = NPC_HOME_DOORS[cur.room];
    out = route(prev.room, prev.tile, cur.room, door ? door.exit : cur.tile, true);
  } else out = route(prev.room, prev.tile, cur.room, cur.tile, false);
  legCache.set(ck, out);
  return out;
}

/** One NPC in the world right now. `from` + `path` is the walk still to do, `startMs` when that walk began. */
export interface NpcPose {
  npc: NpcId;
  room: RoomId;
  from: Tile;
  path: Tile[];
  startMs: number;
  /** Facing when standing (and the starting facing of a walk). */
  dir: Dir;
  /** True when the NPC sits down on arrival (or already sits). */
  sit: boolean;
  activity: NpcActivity;
  /** Where to stand to talk to this NPC: the interact tile of the slot it is heading for. */
  interact: Tile;
  /** Changes whenever a new walk starts or the NPC enters a room: the server broadcasts when it differs from the last one it sent. */
  legId: string;
  /** The slot tile the NPC ends up on. */
  dest: Tile;
}

/** Slot start as a real timestamp: `nowMs` minus how far into the slot we are. */
function slotStartMs(nowMs: number, slot: ScheduleSlot): number {
  return nowMs - (gameMinutesExact(nowMs) - slot.from) * MS_PER_GAME_MINUTE;
}

const homeInteract = (npc: NpcId, slot: ScheduleSlot | null) => slot?.interact ?? npcDefById(npc)?.interact ?? { x: 0, y: 0 };

/**
 * The pose of `npc` at `nowMs` (the game-clock timestamp), or null when it is not in the world (`em_casa`, or vanished at a door).
 * An NPC with no schedule is always at its room's `x, y`.
 */
export function npcPoseAt(npc: NpcId, nowMs: number): NpcPose | null {
  const slots = SCHEDULES[npc];
  if (!slots) {
    const def = npcDefById(npc);
    if (!def) return null;
    const home = Object.values(ROOMS).find((r) => r.npcs.includes(def));
    return home ? { npc, room: home.id, from: { x: def.x, y: def.y }, path: [], startMs: nowMs, dir: def.dir, sit: false, activity: 'trabalhando', interact: def.interact, legId: `${npc}:fixed`, dest: { x: def.x, y: def.y } } : null;
  }
  const idx = slotIndexAt(slots, gameMinutesExact(nowMs));
  const cur = slots[idx]!;
  const prev = slots[(idx - 1 + slots.length) % slots.length]!;
  const t0 = slotStartMs(nowMs, cur);
  const legs = legsBetween(prev, cur);
  let e = nowMs - t0;
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i]!;
    if (e < l.ms) {
      const last = i === legs.length - 1;
      return {
        npc,
        room: l.room,
        from: l.from,
        path: l.path,
        startMs: nowMs - e,
        dir: cur.dir,
        sit: last && !l.vanish && cur.activity === 'sentado',
        activity: cur.activity,
        interact: homeInteract(npc, cur),
        legId: `${npc}:${cur.from}:${i}`,
        dest: cur.tile,
      };
    }
    e -= l.ms;
    if (l.vanish && i === legs.length - 1) return null;
  }
  if (cur.activity === 'em_casa') return null;
  return {
    npc,
    room: cur.room,
    from: cur.tile,
    path: [],
    startMs: nowMs - e,
    dir: cur.dir,
    sit: cur.activity === 'sentado',
    activity: cur.activity,
    interact: homeInteract(npc, cur),
    // the id of the walk that just ended (no new message on arrival), or "stand" when there was no walk
    legId: `${npc}:${cur.from}:${legs.length ? legs.length - 1 : "stand"}`,
    dest: cur.tile,
  };
}

/** Where the pose is at `nowMs`: the last whole tile reached, the path still ahead of it, and the interpolated position. */
export interface PoseWalk {
  tile: Tile;
  rest: Tile[];
  pos: PathPos;
}

export function poseWalk(pose: NpcPose, nowMs: number): PoseWalk {
  const pos = positionAlong(pose.from, pose.path, nowMs - pose.startMs, pose.dir, npcStepMs);
  let prev = pose.from;
  let t = nowMs - pose.startMs;
  let i = 0;
  for (; i < pose.path.length; i++) {
    const p = pose.path[i]!;
    const d = npcStepMs(prev, p);
    if (t < d) break;
    t -= d;
    prev = p;
  }
  return { tile: prev, rest: pose.path.slice(i), pos };
}

/** Every NPC in `room` at `nowMs`. */
export function npcPosesIn(room: RoomId, nowMs: number, ids?: readonly NpcId[]): NpcPose[] {
  const out: NpcPose[] = [];
  for (const id of ids ?? NPC_TIMELINE_IDS) {
    const p = npcPoseAt(id, nowMs);
    if (p && p.room === room) out.push(p);
  }
  return out;
}

/** Every NPC that exists (scheduled or fixed). */
const NPC_TIMELINE_IDS: NpcId[] = Object.values(ROOMS).flatMap((r) => r.npcs.map((n) => n.id));
export const npcIds = (): readonly NpcId[] => NPC_TIMELINE_IDS;
