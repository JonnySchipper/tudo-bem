import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { LIGHT_FADE_MIN, MAX_LIGHT_DELAY, computeLook, hourLook, isOutdoor, lightDelay, lightState } from './dayNight';
import { darknessAlpha, gradeAt } from './lighting';
import { WEATHER_PARAMS } from './weatherLook';
import { ROOM_HOUR } from './roomLayout';

const T = (h: number, m = 0) => h * 60 + m;

describe('light delay', () => {
  it('is deterministic, within 0..40 game minutes, and spread out', () => {
    const spots: [number, number][] = [];
    for (let i = 0; i < 40; i++) spots.push([i * 16 + 7, (i % 9) * 16 + 3]);
    const ds = spots.map(([x, y]) => lightDelay(x, y));
    for (const d of ds) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(MAX_LIGHT_DELAY);
    }
    expect(ds).toEqual(spots.map(([x, y]) => lightDelay(x, y)));
    expect(Math.max(...ds) - Math.min(...ds)).toBeGreaterThan(25);
    expect(new Set(ds.map((d) => Math.round(d))).size).toBeGreaterThan(20);
  });
  it('depends on the position only', () => {
    expect(lightDelay(100, 200)).toBe(lightDelay(100, 200));
    expect(lightDelay(100, 200)).not.toBe(lightDelay(200, 100));
  });
});

describe('light on / off schedule (18:00 on, 06:00 off, per-light delay)', () => {
  it('a light with no delay is off in the day, eases on from 18:00 and is fully on after the fade', () => {
    expect(lightState(T(12), 0)).toBe(0);
    expect(lightState(T(17, 59), 0)).toBe(0);
    expect(lightState(T(18), 0)).toBe(0);
    const mid = lightState(T(18) + LIGHT_FADE_MIN / 2, 0);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(lightState(T(18) + LIGHT_FADE_MIN, 0)).toBe(1);
    expect(lightState(T(23), 0)).toBe(1);
    expect(lightState(T(3), 0)).toBe(1);
    expect(lightState(T(5, 59), 0)).toBe(1);
  });

  it('eases off from 06:00 and is off after the fade', () => {
    expect(lightState(T(6), 0)).toBe(1);
    const mid = lightState(T(6) + LIGHT_FADE_MIN / 2, 0);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(lightState(T(6) + LIGHT_FADE_MIN, 0)).toBe(0);
    expect(lightState(T(9), 0)).toBe(0);
  });

  it('the delay shifts both switches, so a street does not flip at once', () => {
    const early = 0;
    const late = 40;
    // at 18:20 the early light is on and the late one still off
    expect(lightState(T(18, 20), early)).toBe(1);
    expect(lightState(T(18, 20), late)).toBe(0);
    // at 06:20 the early light is already off, the late one still on
    expect(lightState(T(6, 20), early)).toBe(0);
    expect(lightState(T(6, 20), late)).toBe(1);
    // and every light is on by 18:45 and off by 06:45
    for (let d = 0; d <= MAX_LIGHT_DELAY; d += 2.5) {
      expect(lightState(T(18, 45), d)).toBe(1);
      expect(lightState(T(6, 46), d)).toBe(0);
    }
  });

  it('never pops: the strength changes by a small amount per game second all day', () => {
    for (const delay of [0, 13.7, 40]) {
      let prev = lightState(0, delay);
      for (let m = 0; m < 1440; m += 1 / 30) {
        const s = lightState(m, delay);
        expect(Math.abs(s - prev)).toBeLessThan(0.07);
        prev = s;
      }
    }
  });

  it('is periodic and stays within 0..1', () => {
    expect(lightState(T(19) + 1440, 10)).toBe(lightState(T(19), 10));
    for (let m = 0; m < 1440; m += 7) {
      const s = lightState(m, 21);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('outdoor vs interior rooms', () => {
  it('the praça is outdoor; the padaria, kitnet and academia are interiors', () => {
    expect(isOutdoor(ROOMS.praca)).toBe(true);
    expect(isOutdoor(ROOMS.padaria)).toBe(false);
    expect(isOutdoor(ROOMS.kitnet)).toBe(false);
    expect(isOutdoor(ROOMS.academia)).toBe(false);
  });
});

describe('computeLook', () => {
  const sun = WEATHER_PARAMS.sol;
  const outdoor = (minutes: number, weather = sun) => computeLook({ outdoor: true, roomHour: 17.5, minutes, weather });
  const indoor = (minutes: number, hour = ROOM_HOUR.manha, weather = sun) => computeLook({ outdoor: false, roomHour: hour, minutes, weather });

  it('outdoors follows the live clock: bright at noon, dark at night, golden at 17:30', () => {
    expect(outdoor(T(12)).dark).toBe(0);
    expect(outdoor(T(12)).grade).toEqual(gradeAt(12));
    expect(outdoor(T(23)).dark).toBeGreaterThan(0.45);
    const g = outdoor(T(17, 30)).grade;
    expect(g[0]).toBeGreaterThan(g[1]);
    expect(g[1]).toBeGreaterThan(g[2]);
    expect(outdoor(T(19, 30)).dark).toBeGreaterThan(outdoor(T(18, 30)).dark);
    expect(outdoor(T(2)).dark).toBeCloseTo(outdoor(T(23)).dark, 5);
  });

  it('interiors keep the fixed grade of their RoomDef.lighting whatever the time', () => {
    for (const lighting of ['tarde', 'manha', 'dia'] as const) {
      const fixed = gradeAt(ROOM_HOUR[lighting]);
      for (const m of [T(3), T(8), T(12), T(19), T(23, 30)]) {
        const l = indoor(m, ROOM_HOUR[lighting]);
        expect(l.grade).toEqual(fixed);
        expect(l.dark).toBe(0);
        expect(l.playerGlow).toBe(0);
      }
    }
  });

  it('interior window light patches dim at night (and go cool), and under cloud', () => {
    const day = indoor(T(12));
    const dusk = indoor(T(19, 30));
    const night = indoor(T(23));
    expect(day.patchAlpha).toBeCloseTo(1, 5);
    expect(day.patchTint).toBe(0xffffff);
    expect(night.patchAlpha).toBeLessThan(0.35);
    expect(night.patchAlpha).toBeGreaterThan(0);
    expect(night.patchAlpha).toBeLessThan(dusk.patchAlpha + 0.3);
    expect(night.patchTint).not.toBe(0xffffff);
    expect(indoor(T(12), ROOM_HOUR.dia, WEATHER_PARAMS.nublado).patchAlpha).toBeLessThan(0.45);
    expect(indoor(T(12), ROOM_HOUR.dia, WEATHER_PARAMS.chuva).patchAlpha).toBeLessThan(0.15);
  });

  it('lamps, windows and the estufa follow the schedule (interiors too), and are off by day', () => {
    expect(outdoor(T(12)).lampOn(10)).toBe(0);
    expect(outdoor(T(19)).lampOn(10)).toBe(1);
    expect(indoor(T(12)).lampOn(10)).toBe(0);
    expect(indoor(T(21)).lampOn(10)).toBe(1);
  });

  it('weather changes the outdoor look: cooler, greyer, less sun, more gloom', () => {
    const noon = outdoor(T(15));
    for (const w of ['nublado', 'garoa', 'chuva'] as const) {
      const l = outdoor(T(15), WEATHER_PARAMS[w]);
      expect(l.grade[0] + l.grade[1] + l.grade[2]).toBeLessThan(noon.grade[0] + noon.grade[1] + noon.grade[2]);
      expect(l.grade[2] - l.grade[0]).toBeGreaterThan(noon.grade[2] - noon.grade[0]); // bluer
      expect(l.cast).toBeLessThan(noon.cast);
      expect(l.dark).toBeGreaterThanOrEqual(noon.dark);
    }
    expect(outdoor(T(15), WEATHER_PARAMS.chuva).cast).toBe(0);
    expect(outdoor(T(15), WEATHER_PARAMS.chuva).dark).toBeGreaterThan(outdoor(T(15), WEATHER_PARAMS.garoa).dark);
    expect(outdoor(T(15), WEATHER_PARAMS.chuva).glow).toBeGreaterThan(0.5); // headlights on in the rain
    // no sun patches or golden low sun without sun
    expect(outdoor(T(17, 30), WEATHER_PARAMS.chuva).sun).toBe(0);
    expect(outdoor(T(17, 30)).sun).toBeGreaterThan(0.15);
  });

  it('the night overlay does not exceed its cap, and weather does not black the night out', () => {
    for (let m = 0; m < 1440; m += 20) {
      for (const w of Object.values(WEATHER_PARAMS)) {
        const l = outdoor(m, w);
        expect(l.dark).toBeLessThanOrEqual(0.7);
        expect(Math.min(...l.grade)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(darknessAlpha(23, 0.5)).toBe(0.5);
  });

  it('hourLook (the style frame) has every light follow the glow', () => {
    const l = hourLook(21);
    expect(l.lampOn(0)).toBe(l.glow);
    expect(l.lampOn(30)).toBe(l.glow);
    expect(hourLook(12).glow).toBe(0);
  });
});
