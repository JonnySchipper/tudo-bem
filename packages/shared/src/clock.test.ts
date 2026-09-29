import { describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, GAME_DAY_MS, clockLabel, formatHHMM, gameDay, gameMinutes, greetingFor, period } from './clock.js';

const MINUTE_MS = GAME_DAY_MS / 1440;

/** nowMs whose game clock reads minute `min` on game day `day`. */
function at(day: number, min: number): number {
  return day * GAME_DAY_MS - CLOCK_OFFSET_MS + min * MINUTE_MS;
}

describe('game clock', () => {
  it('keeps gameMinutes in 0..1439, including before the epoch', () => {
    for (let i = 0; i < 4000; i++) {
      const now = i * 137 - 50_000_000;
      const m = gameMinutes(now);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(1440);
      expect(Number.isInteger(m)).toBe(true);
    }
  });

  it('lands a fresh boot near 17:00', () => {
    const min = gameMinutes(0);
    expect(Math.floor(min / 60)).toBe(17);
    expect(formatHHMM(min)).toBe('17:00');
    expect(clockLabel(0)).toEqual({ weekday: 'Dom', hhmm: '17:00', icon: '☀️' });
  });

  it('splits the day at the period boundaries', () => {
    expect(period(299)).toBe('madrugada');
    expect(period(300)).toBe('manha');
    expect(period(719)).toBe('manha');
    expect(period(720)).toBe('tarde');
    expect(period(1079)).toBe('tarde');
    expect(period(1080)).toBe('noite');
  });

  it('greets across the morning, afternoon, and night cuts', () => {
    expect(greetingFor(4 * 60 + 59)).toBe('boa noite');
    expect(greetingFor(5 * 60)).toBe('bom dia');
    expect(greetingFor(11 * 60 + 59)).toBe('bom dia');
    expect(greetingFor(12 * 60)).toBe('boa tarde');
    expect(greetingFor(17 * 60 + 59)).toBe('boa tarde');
    expect(greetingFor(18 * 60)).toBe('boa noite');
  });

  it('cycles weekdays from gameDay % 7', () => {
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let day = 0; day < 14; day++) {
      expect(gameDay(at(day, 0))).toBe(day);
      expect(clockLabel(at(day, 17 * 60 + 40)).weekday).toBe(names[day % 7]);
    }
    expect(gameDay(at(-1, 0))).toBe(-1);
    expect(clockLabel(at(-1, 0)).weekday).toBe('Sáb');
    expect(formatHHMM(17 * 60 + 40)).toBe('17:40');
  });

  it('picks a sun, moon, or star from the period', () => {
    expect(clockLabel(at(0, 8 * 60)).icon).toBe('☀️');
    expect(clockLabel(at(0, 15 * 60)).icon).toBe('☀️');
    expect(clockLabel(at(0, 21 * 60)).icon).toBe('🌙');
    expect(clockLabel(at(0, 2 * 60)).icon).toBe('🌟');
  });

  it('does not throw on negative nowMs', () => {
    expect(() => gameMinutes(-1)).not.toThrow();
    expect(() => gameDay(-1)).not.toThrow();
    expect(() => clockLabel(-1)).not.toThrow();
    const now = -CLOCK_OFFSET_MS - GAME_DAY_MS * 5 - 1;
    expect(() => gameMinutes(now)).not.toThrow();
    const m = gameMinutes(now);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(1440);
    expect(Number.isFinite(gameDay(now))).toBe(true);
  });
});
