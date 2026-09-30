import { describe, expect, it } from 'vitest';
import { WEATHER_KINDS } from '@tudobem/shared';
import { clock12h, clockPillView, weatherEmoji } from './clockPill';

describe('clock pill', () => {
  it('shows weekday · 24h time · weather, and the English reading in the title', () => {
    // game day 1 is a Monday (Seg); 17:40 = minute 1060
    const v = clockPillView(1, 1060, 'sol');
    expect(v.text).toBe('Seg · 17:40 · ☀️');
    expect(v.title).toBe('Monday · 5:40 pm · Sunny');
    expect(v.period).toBe('tarde');
  });

  it('English 12-hour edges: midnight, noon, single-digit hours', () => {
    expect(clock12h(0)).toBe('12:00 am');
    expect(clock12h(60 * 12)).toBe('12:00 pm');
    expect(clock12h(60 * 12 + 5)).toBe('12:05 pm');
    expect(clock12h(60 * 9 + 7)).toBe('9:07 am');
    expect(clock12h(23 * 60 + 59)).toBe('11:59 pm');
  });

  it('weekday cycles and follows the game day', () => {
    const shorts = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => clockPillView(d, 600, 'sol').day);
    expect(shorts).toEqual(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);
  });

  it('every weather has a symbol and an English name; a clear night shows the moon', () => {
    for (const w of WEATHER_KINDS) {
      const v = clockPillView(3, 600, w);
      expect(v.emoji.length).toBeGreaterThan(0);
      expect(v.title.split(' · ')).toHaveLength(3);
    }
    expect(weatherEmoji('sol', 12 * 60)).toBe('☀️');
    expect(weatherEmoji('sol', 23 * 60)).toBe('🌙');
    expect(weatherEmoji('sol', 5 * 60 + 59)).toBe('🌙');
    expect(weatherEmoji('sol', 6 * 60)).toBe('☀️');
    expect(clockPillView(3, 600, 'garoa').title).toBe('Wednesday · 10:00 am · Drizzle');
    expect(clockPillView(3, 600, 'chuva').title).toBe('Wednesday · 10:00 am · Rain');
    expect(clockPillView(3, 600, 'nublado').title).toBe('Wednesday · 10:00 am · Cloudy');
  });
});
