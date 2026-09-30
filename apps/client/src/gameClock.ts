/**
 * The client's view of the shared game clock (HOWTO §5.7, Phase 6).
 *
 * The server stamps `welcome` and `roomState` with its `Date.now()`; the client keeps `skew = serverNow - Date.now()` and reads the game
 * time from `Date.now() + skew`, so every player sees the same sky. Pure and injectable (`realNow` is a parameter) so it is unit tested.
 *
 * Dev / test overrides (never a production feature of the URL):
 *  - `?clock=N` runs the clock N times faster (a 48-minute day in 48/N minutes). Ignored unless `import.meta.env.DEV`.
 *  - `?time=HH:MM` freezes the time of day (it runs at the `?clock` speed if that is given too). `?weather=sol|nublado|garoa|chuva`
 *    pins the weather. Both also DEV only.
 *  - `window.__tb.setClock({ time, weather, speed })` does the same at runtime for e2e and the shots script (which run against the
 *    production build), like the other `__tb` test hooks.
 */
import { CLOCK_OFFSET_MS, GAME_DAY_MS, WEATHER_KINDS, gameDay, gameMinutes, weatherAt, type Weather } from '@tudobem/shared';

const MIN_PER_DAY = 1440;

/** Real-ms offset to add to the local clock to get the server's clock. */
export const skewOf = (serverNow: number, localNow: number): number => serverNow - localNow;

/** "HH:MM" or "H:MM" -> minutes since midnight, or null. */
export function parseTimeOfDay(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export interface ClockParams {
  speed: number;
  /** minutes since midnight to freeze the clock at */
  time: number | null;
  weather: Weather | null;
}

/** Read `?clock`, `?time`, `?weather`. Everything is ignored when `dev` is false (production builds). */
export function parseClockParams(search: string, dev: boolean): ClockParams {
  const none: ClockParams = { speed: 1, time: null, weather: null };
  if (!dev) return none;
  const q = new URLSearchParams(search);
  const speed = Number(q.get('clock'));
  const w = q.get('weather') as Weather | null;
  return {
    speed: Number.isFinite(speed) && speed >= 1 && speed <= 600 ? speed : 1,
    time: parseTimeOfDay(q.get('time')),
    weather: w && (WEATHER_KINDS as readonly string[]).includes(w) ? w : null,
  };
}

/** The clock timestamp (ms, same timeline as `Date.now() + skew`) that reads `minutes` on game day `day`. */
export const msAt = (day: number, minutes: number): number => day * GAME_DAY_MS - CLOCK_OFFSET_MS + Math.round((minutes / MIN_PER_DAY) * GAME_DAY_MS);

/** Fractional minutes since game midnight, [0, 1440): smooth (unlike `gameMinutes`, which steps once per game minute). */
export function exactMinutes(nowMs: number): number {
  const t = (((nowMs + CLOCK_OFFSET_MS) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return (t / GAME_DAY_MS) * MIN_PER_DAY;
}

export class GameClock {
  private skew = 0;
  private synced = false;
  private speed = 1;
  /** extra clock time gained by running faster than real time, accumulated up to `bonusFrom` */
  private bonus = 0;
  private bonusFrom: number;
  /** while frozen: the clock reading at `frozenFrom` */
  private frozen: number | null = null;
  private frozenFrom = 0;
  private weatherPin: Weather | null = null;

  constructor(private readonly realNow: () => number = Date.now) {
    this.bonusFrom = realNow();
  }

  /** Adopt the server's clock. The first stamp wins; later ones only when the two clocks drifted apart by more than a second. */
  syncServer(serverNow: number | undefined, localNow: number = this.realNow()): void {
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return;
    const s = skewOf(serverNow, localNow);
    if (!this.synced || Math.abs(s - this.skew) > 1000) {
      this.skew = s;
      this.synced = true;
    }
  }

  get skewMs(): number {
    return this.skew;
  }
  get speedFactor(): number {
    return this.speed;
  }
  get isFrozen(): boolean {
    return this.frozen !== null;
  }

  /** Run N times faster from now on (1 = normal). The time of day carries on from the current reading. */
  setSpeed(n: number, at: number = this.realNow()): void {
    if (this.frozen !== null) {
      this.frozen = this.now(at);
      this.frozenFrom = at;
    } else {
      this.bonus += (at - this.bonusFrom) * (this.speed - 1);
      this.bonusFrom = at;
    }
    this.speed = Number.isFinite(n) && n >= 1 ? Math.min(600, n) : 1;
  }

  /** Freeze the time of day at `minutes` (0..1439) on today's game day (it runs at the `?clock` speed if that is above 1), or `null` to follow the clock again. */
  setTime(minutes: number | null, at: number = this.realNow()): void {
    if (minutes === null) {
      this.frozen = null;
      this.bonusFrom = at;
      return;
    }
    const day = gameDay(this.now(at));
    this.frozen = msAt(day, Math.max(0, Math.min(MIN_PER_DAY - 1, minutes)));
    this.frozenFrom = at;
  }

  setWeather(w: Weather | null): void {
    this.weatherPin = w;
  }

  /** Apply parsed URL overrides. */
  configure(p: ClockParams, at: number = this.realNow()): void {
    if (p.speed !== 1) this.setSpeed(p.speed, at);
    if (p.time !== null) this.setTime(p.time, at);
    if (p.weather) this.setWeather(p.weather);
  }

  /** The clock's timestamp (a `Date.now()`-shaped number that `gameMinutes` / `gameDay` / `weatherAt` understand). */
  now(at: number = this.realNow()): number {
    if (this.frozen !== null) return this.frozen + (this.speed > 1 ? (at - this.frozenFrom) * this.speed : 0);
    return at + this.skew + this.bonus + (at - this.bonusFrom) * (this.speed - 1);
  }

  /** Whole game minutes since midnight (0..1439). */
  minutes(at?: number): number {
    return gameMinutes(this.now(at));
  }
  /** Fractional game minutes: smooth, for lighting. */
  minutesExact(at?: number): number {
    return exactMinutes(this.now(at));
  }
  day(at?: number): number {
    return gameDay(this.now(at));
  }
  weather(at?: number): Weather {
    return this.weatherPin ?? weatherAt(this.now(at));
  }
}

/** The one clock the client uses. */
export const clock = new GameClock();
clock.configure(parseClockParams(typeof location === 'undefined' ? '' : location.search, !!import.meta.env?.DEV));
