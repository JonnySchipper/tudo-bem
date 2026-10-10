import { describe, expect, it } from 'vitest';
import { WEATHER_KINDS, weekday } from '@tudobem/shared';
import { clock12h, clockPillView, weatherEmoji } from './clockPill';

describe('clock pill', () => {
  it('shows the full Portuguese weekday, its English gloss, 24h time and weather', () => {
    // game day 1 is segunda-feira (Monday); 17:40 = minute 1060
    const v = clockPillView(1, 1060, 'sol');
    expect(v.day).toBe('segunda-feira (Monday)');
    expect(v.pt).toBe('segunda-feira');
    expect(v.en).toBe('Monday');
    expect(v.text).toBe('segunda-feira (Monday) · 17:40 · ☀️');
    expect(v.title).toBe('segunda-feira (Monday) · 5:40 pm · Sunny');
    expect(v.period).toBe('tarde');
  });

  it('English 12-hour edges: midnight, noon, single-digit hours', () => {
    expect(clock12h(0)).toBe('12:00 am');
    expect(clock12h(60 * 12)).toBe('12:00 pm');
    expect(clock12h(60 * 12 + 5)).toBe('12:05 pm');
    expect(clock12h(60 * 9 + 7)).toBe('9:07 am');
    expect(clock12h(23 * 60 + 59)).toBe('11:59 pm');
  });

  it('weekday cycles the full name and never the short tag', () => {
    const days = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => clockPillView(d, 600, 'sol').day);
    expect(days).toEqual([
      'domingo (Sunday)',
      'segunda-feira (Monday)',
      'terça-feira (Tuesday)',
      'quarta-feira (Wednesday)',
      'quinta-feira (Thursday)',
      'sexta-feira (Friday)',
      'sábado (Saturday)',
      'domingo (Sunday)',
    ]);
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      const v = clockPillView(d, 600, 'sol');
      expect(v.text.startsWith(v.day)).toBe(true);
      expect(v.title.startsWith(v.day)).toBe(true);
      expect(v.day).not.toContain(weekday(d).short);
    }
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
    expect(clockPillView(3, 600, 'garoa').title).toBe('quarta-feira (Wednesday) · 10:00 am · Drizzle');
    expect(clockPillView(3, 600, 'chuva').title).toBe('quarta-feira (Wednesday) · 10:00 am · Rain');
    expect(clockPillView(3, 600, 'nublado').title).toBe('quarta-feira (Wednesday) · 10:00 am · Cloudy');
  });
});
