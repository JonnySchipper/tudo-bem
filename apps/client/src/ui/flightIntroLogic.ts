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

/**
 * The cabin is laid out on at least this many art px of width: room for the whole row of passengers Lia's call can find you among.
 * A narrower view (a phone) sees part of it and the camera pans along the row (`cabinCam`).
 */
export const CABIN_MIN_W = 280;

/**
 * The seats the player can pick, as offsets from the cabin layout's `mySeat` (art px), left to right: four on the window side, then
 * (past the sleeper at +24 and the aisle) three on the far side. One per PASSENGER_LOOKS entry.
 */
export const CANDIDATE_SEATS = [-72, -48, -24, 0, 93, 117, 141] as const;

/**
 * Where the cabin's camera sits (the view's left edge, art px, within the `vw`-wide cabin) for a `w`-wide view. Before the pick it
 * frames the whole row when it fits, else the passenger in focus (else the aisle, where Lia comes in). Once picked it frames the
 * player and Lia in the aisle together, or the player alone when both don't fit.
 */
export function cabinCam(o: { w: number; vw: number; mySeat: number; aisle: number; focus: number | null; picked: number | null }): number {
  const clamp = (x: number) => Math.round(Math.max(0, Math.min(o.vw - o.w, x)));
  const seats = CANDIDATE_SEATS.map((d) => o.mySeat + d);
  const frame = (lo: number, hi: number, fallback: number) => clamp(hi - lo <= o.w ? (lo + hi) / 2 - o.w / 2 : fallback - o.w / 2);
  if (o.picked !== null) {
    const seat = seats[o.picked] ?? o.mySeat;
    return frame(Math.min(seat, o.aisle) - 18, Math.max(seat, o.aisle) + 18, seat);
  }
  const focus = o.focus === null ? o.aisle - o.w / 2 + 24 : seats[o.focus] ?? o.mySeat;
  return frame(seats[0]! - 13, seats.at(-1)! + 13, focus);
}

/** The candidate seat under an art-px point (the passenger's body, head to lap), or -1. */
export function candidateAt(x: number, y: number, mySeat: number, seatY: number): number {
  if (y < seatY - 24 || y > seatY + 10) return -1;
  return CANDIDATE_SEATS.findIndex((d) => Math.abs(x - (mySeat + d)) <= 11);
}
