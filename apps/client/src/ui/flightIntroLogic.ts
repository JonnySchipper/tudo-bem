/** The flight-in cutscene's numbers, with no DOM (ui/flightIntro.ts draws; these are tested). */

/**
 * The whole-number scale of the pixel canvas: as big as fits `artH` art px of height and `artW` of width on the viewport, at least 1.
 * The canvas then covers the viewport at that scale, so a wide screen sees more sky, a tall phone more ceiling and carpet.
 */
export function flightScale(vw: number, vh: number, artH: number, artW: number): number {
  return Math.max(1, Math.floor(Math.min(vh / artH, vw / artW)));
}

/** The iris wipe's radius for `open` (0 closed, 1 open): at 1 it clears the farthest corner from the centre (cx, cy in 0-1). */
export function irisRadius(open: number, w: number, h: number, cx: number, cy: number): number {
  const x = cx * w;
  const y = cy * h;
  const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  return Math.max(0, Math.min(1, open)) * (far + 2);
}

/** How long after sign-up an account that has not seen the fly-in still counts as brand new. */
export const FLIGHT_FRESH_MS = 6 * 60 * 60 * 1000;

/**
 * Whether `welcome` should play the fly-in. Brand-new accounts only, once: the creator was up on this page (`justCreated`), or the
 * server says the arrivals hall is still ahead on a profile made moments ago (a reload or reconnect between the creator and `welcome`
 * loses `justCreated`). `seen` is the per-profile "already played" mark; older accounts never replay it.
 */
export function shouldPlayFlightIntro(o: {
  room: string;
  justCreated: boolean;
  seen: boolean;
  profile: { createdAt?: number; desembarqueDone?: boolean };
  now: number;
}): boolean {
  if (o.room !== 'desembarque' || o.seen) return false;
  if (o.justCreated) return true;
  const age = o.now - (o.profile.createdAt ?? 0);
  return o.profile.desembarqueDone === false && age >= 0 && age < FLIGHT_FRESH_MS;
}
