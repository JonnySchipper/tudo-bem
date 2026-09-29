import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, gameDay, gameMinutes } from './clock.js';
import { WEATHER_COPY, WEATHER_IDLE_LINES, WEATHER_KINDS, weatherAt, weatherFor, type Weather } from './weather.js';

const at = (day: number, min: number) => day * GAME_DAY_MS + (min / 1440) * GAME_DAY_MS - CLOCK_OFFSET_MS;

describe('weather', () => {
  it('is deterministic per game day', () => {
    for (let d = -50; d < 500; d++) expect(weatherFor(d)).toBe(weatherFor(d));
    expect(weatherFor(12345)).toBe(weatherFor(12345));
    expect(WEATHER_KINDS).toContain(weatherFor(0));
  });

  it('matches the target distribution within 3% over 20,000 days', () => {
    const N = 20_000;
    const counts: Record<Weather, number> = { sol: 0, nublado: 0, garoa: 0, chuva: 0 };
    for (let d = 0; d < N; d++) counts[weatherFor(20_000 + d)]++;
    expect(Math.abs(counts.sol / N - 0.55)).toBeLessThan(0.03);
    expect(Math.abs(counts.nublado / N - 0.25)).toBeLessThan(0.03);
    expect(Math.abs(counts.garoa / N - 0.15)).toBeLessThan(0.03);
    expect(Math.abs(counts.chuva / N - 0.05)).toBeLessThan(0.03);
  });

  it('is not stuck: consecutive days vary, and streaks stay short', () => {
    let run = 1;
    let longest = 1;
    for (let d = 1; d < 5000; d++) {
      run = weatherFor(d) === weatherFor(d - 1) ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(30);
  });

  it('changes only at 06:00: before it, weatherAt uses the previous day roll', () => {
    for (const day of [3, 100, 4242, 77_777]) {
      expect(weatherAt(at(day, 0))).toBe(weatherFor(day - 1));
      expect(weatherAt(at(day, 359))).toBe(weatherFor(day - 1));
      expect(weatherAt(at(day, 360))).toBe(weatherFor(day));
      expect(weatherAt(at(day, 1439))).toBe(weatherFor(day));
      expect(gameDay(at(day, 359))).toBe(day);
      expect(gameMinutes(at(day, 360))).toBe(360);
    }
  });

  it('weather is constant from 06:00 to 05:59 the next morning', () => {
    const day = 900;
    const w = weatherFor(day);
    for (let m = 360; m < 1440; m += 7) expect(weatherAt(at(day, m))).toBe(w);
    for (let m = 0; m < 360; m += 7) expect(weatherAt(at(day + 1, m))).toBe(w);
  });

  it('has bilingual copy and 2-3 idle lines for every weather', () => {
    for (const w of WEATHER_KINDS) {
      expect(WEATHER_COPY[w].pt.length).toBeGreaterThan(0);
      expect(WEATHER_COPY[w].en.length).toBeGreaterThan(0);
      const lines = WEATHER_IDLE_LINES[w];
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(3);
      for (const l of lines) {
        expect(l.pt.length).toBeGreaterThan(0);
        expect(l.en.length).toBeGreaterThan(0);
      }
    }
    expect(WEATHER_COPY.garoa).toEqual({ pt: 'Garoa', en: 'Drizzle' });
  });
});
