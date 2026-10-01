import { describe, expect, it } from 'vitest';
import { SHADOW_FILL_COLOR, SHADOW_FILL_MAX, darknessAlpha, formatHour, glowStrength, gradeAt, lightsOn, rgbToInt, shadowFill, shadowFillStrength, sunGlow } from './lighting';

describe('gradeAt', () => {
  it('hits the doc keyframes exactly', () => {
    expect(gradeAt(9)).toEqual([255, 255, 255]);
    expect(gradeAt(17.5)).toEqual([0xff, 0xc4, 0x8e]);
    expect(gradeAt(19)).toEqual([0x7a, 0x78, 0xae]);
    expect(rgbToInt(gradeAt(20))).toBe(0x3b4a7c);
  });
  it('interpolates between keyframes (17:00 sits between 16:30 and 17:30)', () => {
    const [r, g, b] = gradeAt(17);
    expect(r).toBeGreaterThan(0xf0);
    expect(g).toBeGreaterThan(0xc4);
    expect(g).toBeLessThan(0xe4);
    expect(b).toBeGreaterThan(0x8e);
    expect(b).toBeLessThan(0xbf);
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

describe('sunGlow', () => {
  it('peaks at 17:30 and is zero outside 16:00-19:00', () => {
    expect(sunGlow(12)).toBe(0);
    expect(sunGlow(17.5)).toBeCloseTo(1, 5);
    expect(sunGlow(16)).toBe(0);
    expect(sunGlow(19)).toBe(0);
    expect(sunGlow(16.75)).toBeGreaterThan(0);
    expect(sunGlow(16.75)).toBeLessThan(1);
    expect(sunGlow(19.5)).toBe(0);
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

describe('shadowFill (cool blue fill in the shadows at golden hour)', () => {
  it('is off by day and deep at night', () => {
    expect(shadowFillStrength(12)).toBe(0);
    expect(shadowFillStrength(16)).toBe(0);
    expect(shadowFillStrength(20)).toBe(0);
    expect(shadowFillStrength(2)).toBe(0);
  });
  it('is at full strength at 17:30 and ramps in and out smoothly', () => {
    expect(shadowFillStrength(17.5)).toBe(1);
    expect(shadowFillStrength(18.25)).toBe(1);
    const a = shadowFillStrength(17), b = shadowFillStrength(19);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(1);
    for (let h = 16.5; h < 17.5; h += 0.1) expect(shadowFillStrength(h + 0.1)).toBeGreaterThanOrEqual(shadowFillStrength(h));
  });
  it('is a cool blue (blue > red) with a bounded alpha, and wraps the hour', () => {
    const f = shadowFill(17.5);
    expect(f.color).toEqual(SHADOW_FILL_COLOR);
    expect(f.color[2]).toBeGreaterThan(f.color[0]);
    expect(f.alpha).toBeCloseTo(SHADOW_FILL_MAX);
    expect(shadowFill(17.5 + 24)).toEqual(f);
    expect(shadowFill(12).alpha).toBe(0);
  });
});
