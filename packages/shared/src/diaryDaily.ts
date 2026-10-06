/**
 * The small objects added for the language diary do not all stand about at once: each game day a room shows only a couple of them, a
 * different couple each day, so the ground stays tidy. The reading words (signs) do not rotate: they are written on things already in the
 * room and have no sprite, so every one is readable every day. The pick is a pure function of the room and the game day, so the server,
 * the renderer and the camera always agree, and it walks through a shuffled list of the room's objects (a new shuffle each lap), so
 * every one is out on some day. Scenery and signs that were already in the rooms are always there.
 */
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import type { RoomId } from './types.js';

/** Small objects shown in a room on one game day. Tune here. */
export const DAILY_OBJECTS = 2;

/** Placements that are fixtures, not litter: always there. */
const ALWAYS = new Set(['bandeira_br']);

const pool = (room: RoomId): string[] => DIARY_PLACEMENTS.filter((p) => p.room === room && !p.sign && !ALWAYS.has(p.id)).map((p) => p.id);

const POOLS = new Map<string, string[]>();
const poolOf = (room: RoomId): string[] => {
  let p = POOLS.get(room);
  if (!p) POOLS.set(room, (p = pool(room)));
  return p;
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The pool in a fixed shuffled order for one lap of the days. */
function lap(list: readonly string[], seed: string): string[] {
  const out = [...list];
  let s = hash(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0;
    s = (s ^ (s >>> 13)) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const LAPS = new Map<string, string[]>();
function at(room: RoomId, position: number): string {
  const list = poolOf(room);
  const n = list.length;
  const lapNo = Math.floor(position / n);
  const key = `${room}:o:${lapNo}`;
  let order = LAPS.get(key);
  if (!order) {
    if (LAPS.size > 4000) LAPS.clear();
    LAPS.set(key, (order = lap(list, key)));
  }
  return order[position % n]!;
}

/** The ids of the added objects standing in `room` on game day `day` (signs are always out). */
export function dailyDiaryIds(room: RoomId, day: number): Set<string> {
  const out = new Set<string>();
  if (!poolOf(room).length) return out;
  const d = Math.max(0, Math.floor(day));
  for (let i = 0; i < DAILY_OBJECTS; i++) out.add(at(room, d * DAILY_OBJECTS + i));
  return out;
}

const ROTATING = new Map<string, RoomId>();
for (const p of DIARY_PLACEMENTS) if (!ALWAYS.has(p.id) && !p.sign) ROTATING.set(p.id, p.room);

/** Is this prop out today? Anything that is not one of the rotating small objects (a sign included) is always out. */
export function diaryVisible(room: RoomId, id: string, day: number): boolean {
  if (ROTATING.get(id) !== room) return true;
  return dailyDiaryIds(room, day).has(id);
}

/** The first game day at or after `from` on which a rotating object is out (for tests and tools). */
export function diaryDayFor(id: string, from = 0): number {
  const room = ROTATING.get(id);
  if (!room) return from;
  for (let d = from; d < from + 100_000; d++) if (dailyDiaryIds(room, d).has(id)) return d;
  throw new Error(`${id} is never out`);
}
