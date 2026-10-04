/**
 * The small objects and signs added for the language diary do not all stand about at once: each game day a room shows only a couple of
 * them, a different couple each day, so the ground stays tidy. The pick is a pure function of the room and the game day, so the server,
 * the renderer and the camera always agree, and it walks through a shuffled list of the room's objects (a new shuffle each lap), so
 * every one is out on some day. Scenery and signs that were already in the rooms are always there.
 */
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import type { RoomId } from './types.js';

/** Small objects shown in a room on one game day, and signs. Tune here. */
export const DAILY_OBJECTS = 2;
export const DAILY_SIGNS = 1;

/** Placements that are fixtures, not litter: always there. */
const ALWAYS = new Set(['bandeira_br']);

const pool = (room: RoomId, signs: boolean): string[] =>
  DIARY_PLACEMENTS.filter((p) => p.room === room && !!p.sign === signs && !ALWAYS.has(p.id)).map((p) => p.id);

const POOLS = new Map<string, string[]>();
const poolOf = (room: RoomId, signs: boolean): string[] => {
  const key = `${room}:${signs ? 's' : 'o'}`;
  let p = POOLS.get(key);
  if (!p) POOLS.set(key, (p = pool(room, signs)));
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
function at(room: RoomId, signs: boolean, position: number): string {
  const list = poolOf(room, signs);
  const n = list.length;
  const lapNo = Math.floor(position / n);
  const key = `${room}:${signs ? 's' : 'o'}:${lapNo}`;
  let order = LAPS.get(key);
  if (!order) {
    if (LAPS.size > 4000) LAPS.clear();
    LAPS.set(key, (order = lap(list, key)));
  }
  return order[position % n]!;
}

/** The ids of the added objects and signs standing in `room` on game day `day`. */
export function dailyDiaryIds(room: RoomId, day: number): Set<string> {
  const out = new Set<string>();
  for (const [signs, count] of [[false, DAILY_OBJECTS], [true, DAILY_SIGNS]] as const) {
    const n = poolOf(room, signs).length;
    if (!n) continue;
    const d = Math.max(0, Math.floor(day));
    for (let i = 0; i < count; i++) out.add(at(room, signs, d * count + i));
  }
  return out;
}

const ROTATING = new Map<string, RoomId>();
for (const p of DIARY_PLACEMENTS) if (!ALWAYS.has(p.id)) ROTATING.set(p.id, p.room);

/** Is this prop or sign out today? Anything that is not one of the rotating small objects is always out. */
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
