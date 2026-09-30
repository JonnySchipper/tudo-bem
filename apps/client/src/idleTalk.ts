/**
 * NPC idle bubbles with the weather in them (HOWTO Phase 6 step 4). The client picks the idle lines (main.ts), so this is where the weather
 * small talk is mixed in: at most one line in four is about the weather, and dry-weather chat stays out of the night.
 */
import { WEATHER_IDLE_LINES, type Bilingual, type Weather } from '@tudobem/shared';

/** At most 1 in this many idle lines is weather small talk. */
export const WEATHER_TALK_EVERY = 4;
/** Chance to take a weather line once one is allowed. */
export const WEATHER_TALK_CHANCE = 0.5;

/** Sunny / cloudy chat fits the day (06:00-21:00); rain is worth mentioning at any hour. */
export function weatherTalkFits(weather: Weather, minutes: number): boolean {
  if (weather === 'garoa' || weather === 'chuva') return true;
  return minutes >= 360 && minutes < 1260;
}

export class IdleTalk {
  /** ordinary lines since the last weather line */
  private since = 0;

  /** The next idle line for an NPC: its own, or (rarely) a weather one. `rand` is injectable for tests. */
  next(own: readonly Bilingual[], weather: Weather, minutes: number, rand: () => number = Math.random): Bilingual {
    const pool = WEATHER_IDLE_LINES[weather];
    if (pool.length && this.since >= WEATHER_TALK_EVERY - 1 && weatherTalkFits(weather, minutes) && rand() < WEATHER_TALK_CHANCE) {
      this.since = 0;
      return pool[Math.floor(rand() * pool.length) % pool.length];
    }
    this.since++;
    return own[Math.floor(rand() * own.length) % own.length];
  }
}
