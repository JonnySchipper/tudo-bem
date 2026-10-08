/**
 * Tap-to-walk cues (issue #154): what the pixel view draws where you tapped. Pure functions with no Phaser or DOM imports, so they are unit tested;
 * `tapMarkerLayer.ts` draws them.
 *
 * - `floor`: a white pixel ring on the tile you are walking to. It lands with a one-frame pop (a wider ring), breathes while you walk, and
 *   fades when you arrive (or when the walk never started: the server refused it).
 * - `act`: the same ring in gold, on the tile you walk to for someone or something (an NPC, a sign, a door, a stall), so a tap that will do
 *   something reads differently from a tap on the floor.
 * - `refused`: a small red cross that shakes once and fades, on a tile you cannot walk to (a prop, the town drawn past the map edge).
 */
import type { Hit } from '../view';

export type TapKind = 'floor' | 'act' | 'refused';

export interface TapMark {
  /** tile; for `refused` it may lie outside the room (the surround) */
  x: number;
  y: number;
  kind: TapKind;
  /** performance.now() when it was placed */
  t0: number;
  /** a press-and-hold steer is driving this target: no pop and no timeout while the finger is down */
  held?: boolean;
}

/** The pop: the first frames show the wider ring. */
export const MARK_POP_MS = 120;
/** How long the ring takes to fade once you are there. */
export const MARK_FADE_MS = 220;
/** A walk that has not started by then never will (the server drops a move it cannot path): the ring fades. */
export const MARK_STALE_MS = 1400;
/** The refused cross: on screen this long, the last part fading. */
export const REFUSED_MS = 560;
const REFUSED_SHAKE = [1, -1, 1, -1, 0];

/** What kind of marker a hit gets: the floor (or a seat) is a plain walk, anything with an action is gold. Avatars and furniture get none. */
export function tapKindFor(hit: Hit | null): Exclude<TapKind, 'refused'> | null {
  if (!hit) return null;
  if (hit.kind === 'tile' || hit.kind === 'seat') return 'floor';
  if (hit.kind === 'npc' || hit.kind === 'prop' || hit.kind === 'portal' || hit.kind === 'hotspot') return 'act';
  return null;
}

export interface MarkLook {
  /** 0: the resting ring, 1: the wider pop ring (unused for `refused`) */
  frame: 0 | 1;
  alpha: number;
  /** whole art px of sideways shake (the refused cross) */
  dx: number;
}

/**
 * How a marker looks `age` ms after it was placed. `fadeAge` is ms since the walk ended (null while walking). Returns null once it is gone.
 * `reduced` (prefers-reduced-motion): no pop, no breathing, no shake.
 */
export function markLook(kind: TapKind, age: number, fadeAge: number | null, reduced = false): MarkLook | null {
  if (age < 0) return { frame: 0, alpha: 0, dx: 0 };
  if (kind === 'refused') {
    if (age >= REFUSED_MS) return null;
    const fadeFrom = REFUSED_MS * 0.55;
    const alpha = age < fadeFrom ? 1 : 1 - (age - fadeFrom) / (REFUSED_MS - fadeFrom);
    const dx = reduced ? 0 : (REFUSED_SHAKE[Math.floor(age / 40)] ?? 0);
    return { frame: 0, alpha, dx };
  }
  if (fadeAge !== null && fadeAge >= MARK_FADE_MS) return null;
  const breathe = reduced ? 0.85 : 0.72 + 0.2 * Math.sin(age / 150);
  const fade = fadeAge === null ? 1 : 1 - Math.max(0, fadeAge) / MARK_FADE_MS;
  return { frame: !reduced && age < MARK_POP_MS ? 1 : 0, alpha: Math.max(0, Math.min(1, breathe * fade)), dx: 0 };
}

/**
 * When a floor/act marker starts fading: `arrived` (the avatar stands on the marked tile), or the walk went stale (still standing elsewhere after
 * MARK_STALE_MS). Returns the time the fade began, or null to keep showing it.
 */
export function markFadeStart(mark: TapMark, now: number, self: { x: number; y: number; moving: boolean } | null, fadingSince: number | null): number | null {
  if (fadingSince !== null) return fadingSince;
  if (mark.kind === 'refused' || mark.held) return null;
  if (!self) return now;
  if (!self.moving && self.x === mark.x && self.y === mark.y) return now;
  if (!self.moving && now - mark.t0 > MARK_STALE_MS) return now;
  return null;
}

/** Art px offsets (from the centre pixel) on the outline of an ellipse with radii `rx` x `ry`: the destination ring, crisp at any integer zoom. */
export function ringPixels(rx: number, ry: number): [number, number][] {
  const inside = (i: number, j: number, a: number, b: number) => a > 0 && b > 0 && (i * i) / (a * a) + (j * j) / (b * b) <= 1;
  const out: [number, number][] = [];
  for (let j = -ry; j <= ry; j++)
    for (let i = -rx; i <= rx; i++) {
      if (!inside(i, j, rx + 0.5, ry + 0.5)) continue;
      // on the outline: inside, with at least one 4-neighbour outside
      if (!inside(i + 1, j, rx + 0.5, ry + 0.5) || !inside(i - 1, j, rx + 0.5, ry + 0.5) || !inside(i, j + 1, rx + 0.5, ry + 0.5) || !inside(i, j - 1, rx + 0.5, ry + 0.5)) out.push([i, j]);
    }
  return out;
}

/** Art px offsets of the refused cross: two 2 px wide diagonals, `r` px from the centre. */
export function crossPixels(r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = -r; k <= r; k++) out.push([k, k], [k + 1, k], [k, -k], [k + 1, -k]);
  const seen = new Set<string>();
  return out.filter(([i, j]) => {
    const key = `${i},${j}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Steering by press-and-hold: the press turns into a steer after this long without moving, or as soon as it drags past the tap slop. */
export const HOLD_STEER_MS = 320;
/** While steering, the target is re-aimed at most this often (the camera moves under a still finger, so the tile under it changes too). */
export const STEER_EVERY_MS = 160;

/** True when a press should turn into a steer: held long enough, or dragged past the slop. Only presses that began on the floor steer. */
export function shouldSteer(press: { t0: number; x: number; y: number; floor: boolean }, now: number, x: number, y: number, slopPx: number): boolean {
  if (!press.floor) return false;
  return now - press.t0 >= HOLD_STEER_MS || Math.hypot(x - press.x, y - press.y) > slopPx;
}
