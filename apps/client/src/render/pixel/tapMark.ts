/**
 * The tap-to-walk marker (issue #154): what the ground shows where a tap or click sends the avatar. Pure timing and pixel math, no Phaser, so it is
 * unit tested; WorldScene draws it.
 *
 * - `walk`: a white pixel ring pops out on the floor tile and settles into a small ring that stays until the avatar gets there.
 * - `target`: the same in gold, on the tile in front of a person, a stall, a door or a sign, so "go and do something" reads apart from "go there".
 * - `steer`: the settled ring only, no pop, for a finger held down and dragged (it moves several times a second).
 * - `refused`: a red cross that shakes once and fades, on a tile nobody can stand on (or off the map, on the town around it).
 */
export type TapCue = 'walk' | 'target' | 'steer' | 'refused';

export const TAP_COLORS: Record<TapCue, number> = { walk: 0xffffff, target: 0xf2c230, steer: 0xffffff, refused: 0xe5572f };

/** Seconds the ring takes to pop out; the refused cross's whole life. */
export const TAP_POP_S = 0.3;
export const TAP_REFUSED_S = 0.7;
/** A ring nobody walks to (the server refused the path, a dialogue opened) goes away on its own. */
export const TAP_HOLD_MAX_S = 8;
/** Ground ellipse: the ring is a circle seen from the game's top-down angle. */
export const RING_SQUASH = 0.6;
const RING_SETTLED = 5;
const RING_PEAK = 8;

export interface TapFrame {
  /** ring radius in art px (0 for the cross) */
  radius: number;
  alpha: number;
  /** art px the cross is pushed sideways this frame */
  shake: number;
}

/**
 * The marker at `t` seconds after the tap, or null once it is gone. `arrived`: the avatar stands on the tile (the settled ring then goes). With
 * `reduced` motion there is no pop and no shake: the ring appears settled and the cross only fades.
 */
export function tapFrame(kind: TapCue, t: number, arrived: boolean, reduced = false): TapFrame | null {
  if (t < 0) return null;
  if (kind === 'refused') {
    if (t >= TAP_REFUSED_S) return null;
    const u = t / TAP_REFUSED_S;
    // full strength for the first half (the eye has to find it), then gone quickly
    const fade = Math.max(0, u - 0.5) * 2;
    return { radius: 0, alpha: 1 - fade * fade, shake: reduced ? 0 : Math.round(Math.sin(t * 50) * 1.6 * (1 - u)) };
  }
  const popping = kind !== 'steer' && !reduced && t < TAP_POP_S;
  if (popping) {
    // out past the settled size and back, fast then slow
    const u = t / TAP_POP_S;
    const out = Math.sin(u * Math.PI);
    return { radius: Math.round(RING_SETTLED - 2 + (RING_PEAK - RING_SETTLED + 2) * out * (1 - 0.35 * u)), alpha: 1, shake: 0 };
  }
  if (arrived || t > TAP_HOLD_MAX_S) return null;
  // a slow breath, so the spot is easy to find again without drawing the eye all the time
  return { radius: RING_SETTLED, alpha: reduced ? 0.7 : 0.6 + 0.2 * Math.sin(t * 5), shake: 0 };
}

/** Integer offsets (art px) of a one-pixel ground ring of radius `r`, each once, going round. */
export function ringPixels(r: number, squash = RING_SQUASH): [number, number][] {
  if (r <= 0) return [[0, 0]];
  const out: [number, number][] = [];
  const seen = new Set<string>();
  const steps = Math.max(12, Math.ceil(2 * Math.PI * r * 2));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * r);
    const y = Math.round(Math.sin(a) * r * squash);
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([x, y]);
  }
  return out;
}

/** Offsets (art px) of the refused cross: two 7 px diagonals. */
export const CROSS_PIXELS: [number, number][] = [-3, -2, -1, 0, 1, 2, 3].flatMap((d) => (d === 0 ? [[0, 0]] : [[d, d], [d, -d]])) as [number, number][];
