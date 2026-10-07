/**
 * The airport's runway (rows 2-3 of `ROOMS.aeroporto`): every so often a plane comes down out of the sky over one end, touches down and
 * rolls out along the runway, past the glass, and off the map at the other end. Landings alternate: from the east (rolling west, across
 * the part of the view the checklist card leaves open), then from the west. A pure function of the clock (no Phaser), so every player sees the same landing and
 * the test can check the path. World px.
 */
import { T } from './coords';

export interface RunwayDef {
  /** feet y of a plane on the runway (its wheels on the centre line) */
  y: number;
  /** the map's width in px (the plane leaves past it) */
  w: number;
}

/** The airport's runway: the centre line between rows 2 and 3. */
export const RUNWAYS: Record<string, RunwayDef> = { aeroporto: { y: 4 * T - 6, w: 30 * T } };

/** One landing every this many ms; the approach, the touchdown and the roll-out take the first `LANDING_MS` of it. */
export const RUNWAY_CYCLE_MS = 42_000;
export const LANDING_MS = 16_000;
const APPROACH_MS = 5_000;
const ALT0 = 96;

export interface RunwayPose {
  visible: boolean;
  /** the wheels' x and the runway y the plane is over (its shadow is drawn there) */
  x: number;
  groundY: number;
  /** height above the runway, px (the sprite is drawn this much higher) */
  alt: number;
  /** nose up a little on the approach, level on the ground (radians) */
  pitch: number;
  /** a puff of tyre smoke at touchdown, 0..1 */
  puff: number;
  /** which way the nose points: 'w' (from the east) or 'e' (from the west) */
  dir: 'e' | 'w';
}

export function runwayPose(def: RunwayDef, tMs: number): RunwayPose {
  const dir = Math.floor(tMs / RUNWAY_CYCLE_MS) % 2 === 0 ? 'w' : 'e';
  const t = ((tMs % RUNWAY_CYCLE_MS) + RUNWAY_CYCLE_MS) % RUNWAY_CYCLE_MS;
  const p = eastbound(def, t);
  return dir === 'e' ? { ...p, dir } : { ...p, x: def.w - p.x, pitch: p.pitch, dir };
}

/** The landing as seen from the west end (nose east); the westbound one is its mirror. */
function eastbound(def: RunwayDef, t: number): Omit<RunwayPose, 'dir'> {
  const hidden = { visible: false, x: -999, groundY: def.y, alt: 0, pitch: 0, puff: 0 };
  if (t >= LANDING_MS) return hidden;
  const touchX = 4 * T;
  if (t < APPROACH_MS) {
    // a straight glide: from beyond the west edge, high, down to the touchdown point
    const k = t / APPROACH_MS;
    return { visible: true, x: -10 * T + (touchX + 10 * T) * k, groundY: def.y, alt: ALT0 * (1 - k) ** 1.4, pitch: -0.06 * (1 - k), puff: 0 };
  }
  // the roll-out: fast at the touchdown, braking, still moving when it leaves the map
  const k = (t - APPROACH_MS) / (LANDING_MS - APPROACH_MS);
  const end = def.w + 8 * T;
  const eased = 1 - (1 - k) ** 1.7;
  const since = t - APPROACH_MS;
  return { visible: true, x: touchX + (end - touchX) * eased, groundY: def.y, alt: 0, pitch: 0, puff: since < 900 ? 1 - since / 900 : 0 };
}
