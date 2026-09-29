import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, gameDay } from './clock.js';
import { WEATHER_LINES, weatherFor, type Weather } from './weather.js';

const DAYS = 10_000;

describe('weather', () => {
  it('stays fixed for a game day and changes only with gameDay', () => {
    for (let day = 0; day < 40; day++) {
      const start = day * GAME_DAY_MS - CLOCK_OFFSET_MS;
      const end = start + GAME_DAY_MS - 1;
      expect(gameDay(start)).toBe(day);
      expect(gameDay(end)).toBe(day);
      const weather = weatherFor(day);
      expect(weatherFor(gameDay(start))).toBe(weather);
      expect(weatherFor(gameDay(end))).toBe(weather);
      expect(weatherFor(day)).toBe(weather);
    }
    expect(gameDay(GAME_DAY_MS - CLOCK_OFFSET_MS)).toBe(1);
  });

  it('matches 55/25/15/5 within 3 percentage points over 10000 days', () => {
    const counts: Record<Weather, number> = { sol: 0, nublado: 0, garoa: 0, chuva: 0 };
    for (let day = 0; day < DAYS; day++) counts[weatherFor(day)]++;
    const share = (n: number) => n / DAYS;
    expect(Math.abs(share(counts.sol) - 0.55)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(counts.nublado) - 0.25)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(counts.garoa) - 0.15)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(counts.chuva) - 0.05)).toBeLessThanOrEqual(0.03);
  });

  it('does not throw on a negative game day', () => {
    expect(() => weatherFor(-1)).not.toThrow();
    expect(['sol', 'nublado', 'garoa', 'chuva']).toContain(weatherFor(-3));
    expect(weatherFor(-3)).toBe(weatherFor(-3));
  });

  it('marks a short line for each sky', () => {
    for (const key of ['sol', 'nublado', 'garoa', 'chuva'] as const) {
      expect(WEATHER_LINES[key].needs_br).toBe(true);
      expect(WEATHER_LINES[key].pt.length).toBeGreaterThan(0);
      expect(WEATHER_LINES[key].en.length).toBeGreaterThan(0);
    }
    expect(WEATHER_LINES.garoa).toEqual({ pt: 'Que garoa, hein?', en: 'What a drizzle, huh?', needs_br: true });
  });
});
