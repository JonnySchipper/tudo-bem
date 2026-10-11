/**
 * The player's day: the one day boundary for every player-facing cap, streak, stamp card, paid-run counter and mission.
 * The Escola (streak, goal, RV cap, word mission), the Cartela stamps, the feira cart's paid runs, the feira purchase RV,
 * Jô's fish-sales cap, Correria paid shifts, the kiosk Missão do dia, the Pedido rápido grant and the leaderboard streak
 * all key on `profileDay` (or `playerDay` with the same offset). No other day function is used for a cap.
 *
 * A day is a calendar date (`YYYY-MM-DD`) in the player's own zone. The browser reports its offset in minutes east of UTC
 * (`-new Date().getTimezoneOffset()`) on every `hello` and on Escola actions. The server keeps the latest accepted value in
 * one stored field, `escola.tz` on the profile (every loaded profile has an `escola` object), through `acceptTz`.
 *
 * Fallback: where no offset is known the day is the UTC day, `playerDay(now, 0)`. That covers a profile that has not
 * connected since offsets were stored, and the jobs that are shared by everyone rather than one player's: the Feira cart's
 * public board, its medals and its game rotation, and the admin dashboard's day counts.
 *
 * The 48-minute game day (clock.ts) is ambience only: feira hours, NPC schedules, greetings, recado offers, rotating diary
 * objects, pen litters, scene payouts. Never use it for a cap.
 *
 * Migration: day keys written under an older boundary (New York, São Paulo, UTC) can be a day AHEAD of the player's own
 * day (anyone west of UTC in their evening). Every cap reads a stored key through `sameOrFutureDay`: an earlier key is a
 * past day and rolls over once; a key later than today counts as today (and is written back as today), so the cap does not
 * roll over now and again at local midnight. Stamps, stars, shift counts and streak lengths are never reset by it.
 */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Offsets beyond these do not exist on Earth (UTC-12 .. UTC+14, with margin). */
export const TZ_MIN_MINUTES = -14 * 60;
export const TZ_MAX_MINUTES = 14 * 60;

/** A browser-reported offset (minutes east of UTC), clamped to a real zone. Anything else is 0 (UTC). */
export const clampTz = (tz: unknown): number =>
  typeof tz === 'number' && Number.isFinite(tz) ? Math.min(TZ_MAX_MINUTES, Math.max(TZ_MIN_MINUTES, Math.floor(tz))) : 0;

/** The player's calendar day (`YYYY-MM-DD`) at `nowMs`, `tzOffsetMin` minutes east of UTC. 0 (the default) is the UTC day. */
export function playerDay(nowMs: number, tzOffsetMin = 0): string {
  return new Date(nowMs + clampTz(tzOffsetMin) * MIN).toISOString().slice(0, 10);
}

/**
 * Does a stored day key still count as `today` for a cap? Today's key does, and so does a key later than today: one written
 * under the UTC day, before the player's offset was stored, runs up to a day ahead west of UTC. A missing or malformed key,
 * or an earlier day, does not (the cap rolls over). ISO day strings compare in calendar order. The one rollover check.
 */
export function sameOrFutureDay(stored: unknown, today: string): boolean {
  return typeof stored === 'string' && ISO_DAY.test(stored) && stored >= today;
}

/** Whole days from `a` to `b` (both `YYYY-MM-DD`). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/**
 * Shift a `YYYY-MM-DD` key by whole calendar days.
 * UTC date math, so a daylight-saving boundary does not skip or repeat a day.
 */
export function addCalendarDays(iso: string, days: number): string {
  const n = Math.trunc(Number.isFinite(days) ? days : 0);
  if (!n || !ISO_DAY.test(iso)) return iso;
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** What a profile carries for its day: the one stored offset, and the Testes day offset an admin may have rolled. */
export interface DayHolder {
  escola?: { tz?: number };
  testDayOffset?: number;
}

/** The stored offset of a profile (minutes east of UTC), or 0 (UTC) when none was ever reported. */
export const profileTz = (p: DayHolder | null | undefined): number => clampTz(p?.escola?.tz ?? 0);

/** Today's day key for this profile: its own calendar day, shifted by a Testes day roll. The key every cap compares against. */
export function profileDay(p: DayHolder | null | undefined, nowMs: number): string {
  return addCalendarDays(playerDay(nowMs, profileTz(p)), p?.testDayOffset ?? 0);
}

/**
 * The offset to store when a browser reports `incoming` and the profile holds `stored`.
 * A new offset is taken unless it would move today's key backwards (a traveller heading west keeps the old zone until
 * the new one reaches the same date). Without that, flipping the zone back and forth would roll every cap over and over.
 * A non-number keeps what is stored.
 */
export function acceptTz(nowMs: number, stored: number | undefined, incoming: unknown): number | undefined {
  if (typeof incoming !== 'number' || !Number.isFinite(incoming)) return stored;
  const next = clampTz(incoming);
  if (stored === undefined) return next;
  return playerDay(nowMs, next) < playerDay(nowMs, stored) ? clampTz(stored) : next;
}

/**
 * The viewer's own calendar day, from the browser's zone. Client display only (the same offset the client reports, so it
 * matches the server's `profileDay`). The server never calls this: its process zone is not the player's.
 */
export function viewerDay(nowMs = Date.now()): string {
  return playerDay(nowMs, -new Date(nowMs).getTimezoneOffset());
}

/**
 * Today's day key for the signed-in player, client side (the Cartela card and HUD chip): the server's `profileDay`, from the
 * offset stored on the profile (`escola.tz`), so "stamped today" on screen is the day the server stamps on. The browser's
 * own offset stands in only while the profile has none stored. A Testes day roll is added like on the server.
 */
export function viewerProfileDay(p: DayHolder | null | undefined, nowMs = Date.now(), browserTz = -new Date(nowMs).getTimezoneOffset()): string {
  const tz = typeof p?.escola?.tz === 'number' ? p.escola.tz : browserTz;
  return addCalendarDays(playerDay(nowMs, tz), p?.testDayOffset ?? 0);
}
