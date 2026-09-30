/**
 * Title-screen camera over the real Vila Ipê (HOWTO Phase 6 step 7). A slow loop: the street in front of the padaria,
 * east along Rua dos Ipês, down to the fountain, and back. Pure, so the path is unit-tested; the scene only follows it.
 */

/** One full loop, in milliseconds. */
export const INTRO_PAN_MS = 42_000;

/** Tile centres the camera visits, in order. */
const WAYPOINTS: readonly { x: number; y: number }[] = [
  { x: 14.5, y: 9.5 }, // Rua dos Ipês, in front of the padaria
  { x: 36.5, y: 10.5 }, // the academia and the bus stop
  { x: 25.5, y: 22.5 }, // the fountain
  { x: 16.5, y: 16.5 }, // the brick path back toward the street
];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** World px (art pixels) of the camera centre `elapsedMs` into the loop. `tile` is art px per tile. */
export function introPanAt(elapsedMs: number, tile = 16): { x: number; y: number } {
  const n = WAYPOINTS.length;
  const u = (((elapsedMs % INTRO_PAN_MS) + INTRO_PAN_MS) % INTRO_PAN_MS) / INTRO_PAN_MS;
  const f = u * n;
  const i = Math.floor(f) % n;
  const t = smooth(f - Math.floor(f));
  const a = WAYPOINTS[i]!;
  const b = WAYPOINTS[(i + 1) % n]!;
  return { x: (a.x + (b.x - a.x) * t) * tile, y: (a.y + (b.y - a.y) * t) * tile };
}
