import { describe, expect, it } from 'vitest';
import { WEATHER_KINDS } from '@tudobem/shared';
import { MAX_DROPS, MAX_RIPPLES, MAX_SPLASHES, PARTICLE_CAP, WEATHER_PARAMS, WeatherBlend, lerpParams, rainColor, rainPlan, weatherGrade } from './weatherLook';
import { gradeAt } from './lighting';

const NORMAL = { lowfx: false, reduced: false };

describe('weather -> parameters', () => {
  it('sol changes nothing; nublado has no rain; garoa is light rain; chuva is heavy with puddles', () => {
    const { sol, nublado, garoa, chuva } = WEATHER_PARAMS;
    expect(sol.tintMix).toBe(0);
    expect(sol.rain).toBe(0);
    expect(sol.sun).toBe(1);
    expect(nublado.rain).toBe(0);
    expect(garoa.rain).toBeGreaterThan(0);
    expect(garoa.rain).toBeLessThan(chuva.rain);
    expect(chuva.rain).toBe(1);
    expect(garoa.puddles).toBe(0);
    expect(nublado.puddles).toBe(0);
    expect(chuva.puddles).toBe(1);
  });

  it('sun falls and gloom / desaturation rise from sol to chuva', () => {
    const order = ['sol', 'nublado', 'garoa', 'chuva'] as const;
    for (let i = 1; i < order.length; i++) {
      const a = WEATHER_PARAMS[order[i - 1]];
      const b = WEATHER_PARAMS[order[i]];
      expect(b.sun).toBeLessThanOrEqual(a.sun);
      expect(b.gloom).toBeGreaterThanOrEqual(a.gloom);
      expect(b.desat).toBeGreaterThanOrEqual(a.desat);
    }
    expect(WEATHER_PARAMS.chuva.sun).toBe(0);
  });

  it('every weather kind has parameters', () => {
    for (const w of WEATHER_KINDS) expect(WEATHER_PARAMS[w]).toBeDefined();
  });
});

describe('weatherGrade', () => {
  it('sol leaves the grade untouched', () => {
    for (const h of [8, 12, 17.5, 21]) expect(weatherGrade(gradeAt(h), WEATHER_PARAMS.sol, 0)).toEqual(gradeAt(h));
  });

  it('nublado is desaturated and cooler than sol at 17:30 (golden hour flattens)', () => {
    const g = gradeAt(17.5);
    const n = weatherGrade(g, WEATHER_PARAMS.nublado, 0);
    const spread = (c: number[]) => Math.max(...c) - Math.min(...c);
    expect(spread(n)).toBeLessThan(spread(g));
    expect(n[2] - n[0]).toBeGreaterThan(g[2] - g[0]);
  });

  it('garoa and chuva get a blue-grey grade, chuva the darker one', () => {
    const g = gradeAt(15);
    const ga = weatherGrade(g, WEATHER_PARAMS.garoa, 0);
    const ch = weatherGrade(g, WEATHER_PARAMS.chuva, 0);
    expect(ga[2]).toBeGreaterThanOrEqual(ga[0]);
    expect(ch[2]).toBeGreaterThanOrEqual(ch[0]);
    expect(ch[0] + ch[1] + ch[2]).toBeLessThan(ga[0] + ga[1] + ga[2]);
  });

  it('the weather tint is softer at night so the night grade is not doubled down', () => {
    const g = gradeAt(23);
    const day = weatherGrade(gradeAt(15), WEATHER_PARAMS.chuva, 0);
    const dayLoss = day[0] / gradeAt(15)[0];
    const night = weatherGrade(g, WEATHER_PARAMS.chuva, 1);
    expect(night[0] / g[0]).toBeGreaterThan(dayLoss);
  });
});

describe('WeatherBlend', () => {
  it('starts at its weather, eases toward a new one and settles', () => {
    const b = new WeatherBlend('sol');
    expect(b.current.rain).toBe(0);
    let rain = 0;
    for (let i = 0; i < 60; i++) {
      const p = b.step('chuva', 1 / 60);
      expect(p.rain).toBeGreaterThanOrEqual(rain);
      rain = p.rain;
    }
    expect(rain).toBeGreaterThan(0.2);
    expect(rain).toBeLessThan(0.9); // a second in: still fading in
    for (let i = 0; i < 1200; i++) b.step('chuva', 1 / 60);
    expect(b.current.rain).toBeCloseTo(1, 3);
    for (let i = 0; i < 2400; i++) b.step('nublado', 1 / 60);
    expect(b.current.rain).toBeCloseTo(0, 3);
    expect(b.current.sun).toBeCloseTo(WEATHER_PARAMS.nublado.sun, 3);
  });

  it('snap jumps at once; a paused clock does not move', () => {
    const b = new WeatherBlend('sol');
    b.snap('garoa');
    expect(b.current.rain).toBe(WEATHER_PARAMS.garoa.rain);
    const before = { ...b.current };
    b.step('chuva', 0);
    expect(b.current.rain).toBe(before.rain);
  });

  it('lerpParams is linear', () => {
    const m = lerpParams(WEATHER_PARAMS.sol, WEATHER_PARAMS.chuva, 0.5);
    expect(m.rain).toBeCloseTo(0.5, 6);
    expect(m.sun).toBeCloseTo(0.5, 6);
  });
});

describe('rainPlan (particle budget)', () => {
  it('no rain, no particles', () => {
    for (const fx of [NORMAL, { lowfx: true, reduced: false }, { lowfx: false, reduced: true }]) {
      expect(rainPlan(WEATHER_PARAMS.sol, fx)).toMatchObject({ drops: 0, splashes: 0, ripples: 0 });
      expect(rainPlan(WEATHER_PARAMS.nublado, fx).drops).toBe(0);
    }
  });

  it('garoa is fine rain only; chuva is heavy with splashes and ripples', () => {
    const g = rainPlan(WEATHER_PARAMS.garoa, NORMAL);
    const c = rainPlan(WEATHER_PARAMS.chuva, NORMAL);
    expect(g.drops).toBeGreaterThan(40);
    expect(g.drops).toBeLessThan(c.drops);
    expect(g.splashes).toBe(0);
    expect(g.ripples).toBe(0);
    expect(c.drops).toBe(MAX_DROPS);
    expect(c.splashes).toBe(MAX_SPLASHES);
    expect(c.ripples).toBe(MAX_RIPPLES);
  });

  it('low-fx halves the rain and drops splashes and ripples', () => {
    const c = rainPlan(WEATHER_PARAMS.chuva, { lowfx: true, reduced: false });
    expect(c.drops).toBe(Math.round(MAX_DROPS / 2));
    expect(c.splashes).toBe(0);
    expect(c.ripples).toBe(0);
    expect(rainPlan(WEATHER_PARAMS.garoa, { lowfx: true, reduced: false }).drops).toBeLessThan(rainPlan(WEATHER_PARAMS.garoa, NORMAL).drops);
  });

  it('reduced motion means fewer, slower drops and no splashes', () => {
    const c = rainPlan(WEATHER_PARAMS.chuva, { lowfx: false, reduced: true });
    expect(c.drops).toBeLessThan(MAX_DROPS * 0.5);
    expect(c.drops).toBeGreaterThan(0);
    expect(c.splashes).toBe(0);
    expect(c.speed).toBeLessThan(1);
    expect(rainPlan(WEATHER_PARAMS.chuva, NORMAL).speed).toBe(1);
  });

  it('never exceeds the particle cap, and leaves room for petals and critters', () => {
    for (const w of WEATHER_KINDS) {
      for (const fx of [NORMAL, { lowfx: true, reduced: false }, { lowfx: false, reduced: true }, { lowfx: true, reduced: true }]) {
        const p = rainPlan(WEATHER_PARAMS[w], fx);
        expect(p.drops + p.splashes + p.ripples).toBeLessThanOrEqual(PARTICLE_CAP - 40);
      }
    }
  });

  it('tracks the fade: half the rain intensity, about half the drops', () => {
    expect(rainPlan({ rain: 0.5 }, NORMAL).drops).toBe(Math.round(MAX_DROPS / 2));
    expect(rainPlan({ rain: 2 }, NORMAL).drops).toBe(MAX_DROPS);
    expect(rainPlan({ rain: -1 }, NORMAL).drops).toBe(0);
  });
});

describe('rainColor', () => {
  it('is pale by day and dimmer at night', () => {
    const d = rainColor(0);
    const n = rainColor(1);
    expect(d[0] + d[1] + d[2]).toBeGreaterThan(n[0] + n[1] + n[2]);
    expect(n[2]).toBeGreaterThan(n[0]); // stays blue
  });
});
