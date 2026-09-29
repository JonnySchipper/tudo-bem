import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, formatClock, gameDay, gameMinutes, greetingFor, period, weekday } from './clock.js';

/** A timestamp (>= 0) at which the game clock reads exactly `min` on game day `day`. */
const at = (day: number, min: number) => day * GAME_DAY_MS + (min / 1440) * GAME_DAY_MS - CLOCK_OFFSET_MS;

describe('game clock', () => {
  it('a game day is 48 real minutes', () => {
    expect(GAME_DAY_MS).toBe(2_880_000);
  });

  it('reads 17:00 at Unix time 0 and at every 4-hour UTC boundary', () => {
    for (const utcHour of [0, 4, 8, 12, 16, 20]) {
      const t = Date.UTC(2026, 5, 15, utcHour, 0, 0);
      expect(formatClock(gameMinutes(t))).toBe('17:00');
    }
    expect(gameMinutes(0)).toBe(1020);
  });

  it('gameMinutes stays within 0..1439 and hits the exact boundaries', () => {
    expect(gameMinutes(at(10, 0))).toBe(0);
    expect(gameMinutes(at(10, 300))).toBe(300);
    expect(gameMinutes(at(10, 720))).toBe(720);
    expect(gameMinutes(at(10, 1080))).toBe(1080);
    expect(gameMinutes(at(10, 1439))).toBe(1439);
    expect(gameMinutes(at(10, 0) - 1)).toBe(1439);
    expect(gameMinutes(at(10, 300) - 1)).toBe(299);
    expect(gameMinutes(at(10, 720) - 1)).toBe(719);
    expect(gameMinutes(at(10, 1080) - 1)).toBe(1079);
  });

  it('gameDay rolls over at game midnight', () => {
    expect(gameDay(at(10, 0))).toBe(10);
    expect(gameDay(at(10, 0) - 1)).toBe(9);
    expect(gameDay(at(10, 1439))).toBe(10);
  });

  it('advances one game minute per 2 real seconds and is monotonic within a day', () => {
    const start = at(50, 0);
    let prev = -1;
    for (let ms = 0; ms < GAME_DAY_MS; ms += 500) {
      const m = gameMinutes(start + ms);
      expect(m).toBeGreaterThanOrEqual(prev);
      expect(gameDay(start + ms)).toBe(50);
      prev = m;
    }
    expect(prev).toBe(1439);
    expect(gameMinutes(start + 2000)).toBe(1);
    expect(gameMinutes(start + 1999)).toBe(0);
  });

  it('handles negative and very large timestamps', () => {
    for (const t of [-1, -GAME_DAY_MS, -123_456_789_012, 4_102_444_800_000, 9e15]) {
      const m = gameMinutes(t);
      expect(Number.isInteger(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1439);
    }
    expect(gameMinutes(-CLOCK_OFFSET_MS)).toBe(0);
    expect(gameDay(-CLOCK_OFFSET_MS)).toBe(0);
    expect(gameDay(-CLOCK_OFFSET_MS - 1)).toBe(-1);
    expect(gameMinutes(-CLOCK_OFFSET_MS - 1)).toBe(1439);
  });

  it('period boundaries', () => {
    expect(period(0)).toBe('madrugada');
    expect(period(299)).toBe('madrugada');
    expect(period(300)).toBe('manha');
    expect(period(719)).toBe('manha');
    expect(period(720)).toBe('tarde');
    expect(period(1079)).toBe('tarde');
    expect(period(1080)).toBe('noite');
    expect(period(1439)).toBe('noite');
  });

  it('greeting edges', () => {
    expect(greetingFor(0)).toBe('boa noite');
    expect(greetingFor(299)).toBe('boa noite'); // 04:59
    expect(greetingFor(300)).toBe('bom dia'); // 05:00
    expect(greetingFor(719)).toBe('bom dia'); // 11:59
    expect(greetingFor(720)).toBe('boa tarde'); // 12:00
    expect(greetingFor(1079)).toBe('boa tarde'); // 17:59
    expect(greetingFor(1080)).toBe('boa noite'); // 18:00
    expect(greetingFor(1439)).toBe('boa noite');
  });

  it('formatClock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(1060)).toBe('17:40');
    expect(formatClock(1439)).toBe('23:59');
    expect(formatClock(-3)).toBe('00:00');
    expect(formatClock(5000)).toBe('23:59');
  });

  it('weekday cycles Dom..Sáb through negative days too', () => {
    const shorts = [0, 1, 2, 3, 4, 5, 6].map((d) => weekday(d).short);
    expect(shorts).toEqual(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);
    expect(weekday(7).short).toBe('Dom');
    expect(weekday(-1).short).toBe('Sáb');
    expect(weekday(-7).short).toBe('Dom');
    expect(weekday(2)).toEqual({ short: 'Ter', pt: 'terça-feira', en: 'Tuesday' });
    expect(weekday(1_000_003).short).toBe(weekday(1_000_003 % 7).short);
  });
});
