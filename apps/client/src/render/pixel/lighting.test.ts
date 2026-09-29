import { describe, expect, it } from 'vitest';
import { darknessAlpha, formatHour, glowStrength, gradeAt, lightsOn, rgbToInt } from './lighting';

describe('gradeAt', () => {
  it('hits the doc keyframes exactly', () => {
    expect(gradeAt(9)).toEqual([255, 255, 255]);
    expect(gradeAt(17.5)).toEqual([0xff, 0xbd, 0x80]);
    expect(gradeAt(19)).toEqual([0x6b, 0x6f, 0xa8]);
    expect(rgbToInt(gradeAt(20))).toBe(0x3b4a7c);
  });
  it('interpolates between keyframes (17:00 sits between 16:30 and 17:30)', () => {
    const [r, g, b] = gradeAt(17);
    expect(r).toBeGreaterThan(0xf0);
    expect(g).toBeGreaterThan(0xbd);
    expect(g).toBeLessThan(0xd9);
    expect(b).toBeGreaterThan(0x80);
    expect(b).toBeLessThan(0xa0);
  });
  it('wraps the hour and is dark at midnight', () => {
    expect(gradeAt(24)).toEqual(gradeAt(0));
    expect(gradeAt(25)).toEqual(gradeAt(1));
    expect(gradeAt(0)[2]).toBeLessThan(0x90);
  });
  it('golden hour is warm: red > green > blue', () => {
    for (const h of [16.75, 17.25, 17.75]) {
      const [r, g, b] = gradeAt(h);
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });
});

describe('darknessAlpha', () => {
  it('is 0 in daylight and golden hour start, max at night', () => {
    expect(darknessAlpha(12)).toBe(0);
    expect(darknessAlpha(17)).toBe(0);
    expect(darknessAlpha(22)).toBeCloseTo(0.55, 5);
    expect(darknessAlpha(2)).toBeCloseTo(0.55, 5);
  });
  it('increases monotonically through the 17:00-20:00 slider range', () => {
    let prev = -1;
    for (let h = 17; h <= 20.001; h += 0.05) {
      const a = darknessAlpha(h);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
  it('lights come on during the slider range: off at 17:30, on at 19:30', () => {
    expect(lightsOn(17.5)).toBe(false);
    expect(lightsOn(19.5)).toBe(true);
    expect(glowStrength(17.5)).toBe(0);
    expect(glowStrength(19.5)).toBeGreaterThan(0.9);
  });
});

describe('formatHour', () => {
  it('formats HH:MM', () => {
    expect(formatHour(17.5)).toBe('17:30');
    expect(formatHour(19.5)).toBe('19:30');
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(17.999)).toBe('18:00');
  });
});
