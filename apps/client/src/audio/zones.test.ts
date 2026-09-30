import { describe, expect, it } from 'vitest';
import { FLOOR_CHARS, ROOMS } from '@tudobem/shared';
import { AMBIENT } from '../render/pixel/ambientData';
import { FOOTSTEPS, FootstepClock, SILENT_MIX, STEP_PX, daylight, falloff, radioOn, stepPitch, trafficPresence, zoneMix } from './zones';

const z = AMBIENT.praca.audio;
const at = (x: number, y: number, minute = 720, rain = 0) => zoneMix(z, { x, y, minute, rain });
const T = 16;

describe('falloff', () => {
  it('is 1 inside, 0 outside and monotonic between', () => {
    expect(falloff(10, 40, 200)).toBe(1);
    expect(falloff(300, 40, 200)).toBe(0);
    let last = 1;
    for (let d = 40; d <= 200; d += 10) {
      const g = falloff(d, 40, 200);
      expect(g).toBeLessThanOrEqual(last + 1e-9);
      last = g;
    }
    expect(falloff(120, 40, 200)).toBeCloseTo(0.5, 5);
  });
});

describe('zone mix', () => {
  it('has traffic hum at the street and next to nothing at the far end of the praça', () => {
    const street = at(25 * T, 10 * T);
    const pracaMid = at(25 * T, 22 * T);
    const south = at(25 * T, 34 * T);
    expect(street.traffic).toBeGreaterThan(0.95);
    expect(south.traffic).toBeGreaterThan(0.95);
    expect(pracaMid.traffic).toBeLessThan(0.05);
    // the hum grows as you walk to the street
    expect(at(25 * T, 12 * T).traffic).toBeGreaterThan(at(25 * T, 15 * T).traffic);
    expect(at(25 * T, 15 * T).traffic).toBeGreaterThan(at(25 * T, 17 * T).traffic);
  });

  it('puts the fountain at its basin', () => {
    expect(at(z.fountain.x, z.fountain.y + 3 * T).fountain).toBeCloseTo(falloff(3 * T, 44, 200), 5);
    expect(at(z.fountain.x, z.fountain.y).fountain).toBe(1);
    expect(at(z.fountain.x + 250, z.fountain.y).fountain).toBe(0);
    expect(at(5 * T, 26 * T).fountain).toBe(0);
  });

  it('plays a radio only near the houses, and only in waking hours', () => {
    const house = z.radios[0];
    expect(at(house.x, house.y, 12 * 60).radio).toBe(1);
    expect(at(house.x + 10 * T, house.y, 12 * 60).radio).toBe(0);
    expect(at(house.x, house.y, 3 * 60).radio).toBe(0);
    expect(at(25 * T, 26 * T, 12 * 60).radio).toBe(0);
    expect(radioOn(8 * 60)).toBe(true);
    expect(radioOn(22 * 60)).toBe(false);
  });

  it('swaps birds for crickets with the light', () => {
    const noon = at(25 * T, 26 * T, 12 * 60);
    const night = at(25 * T, 26 * T, 23 * 60);
    expect(noon.birds).toBe(1);
    expect(noon.crickets).toBe(0);
    expect(night.birds).toBe(0);
    expect(night.crickets).toBe(1);
    // dawn and dusk cross-fade
    const dusk = at(25 * T, 26 * T, 18 * 60 + 30);
    expect(dusk.birds).toBeGreaterThan(0);
    expect(dusk.birds).toBeLessThan(1);
    expect(dusk.crickets).toBeCloseTo(1 - dusk.birds, 5);
    expect(daylight(0)).toBe(0);
    expect(daylight(600)).toBe(1);
  });

  it('follows the weather: rain sounds, birds and crickets go quiet', () => {
    const dry = at(25 * T, 26 * T, 12 * 60, 0);
    const wet = at(25 * T, 26 * T, 12 * 60, 1);
    expect(dry.rain).toBe(0);
    expect(wet.rain).toBe(1);
    expect(wet.birds).toBeLessThan(0.2);
    expect(at(25 * T, 26 * T, 12 * 60, 0.55).rain).toBeCloseTo(0.55, 5);
  });

  it('thins the traffic hum at night and nearly silences it from 01:00 to 05:00', () => {
    const street = (m: number) => at(25 * T, 10 * T, m).traffic;
    expect(street(12 * 60)).toBeGreaterThan(street(23 * 60));
    expect(street(3 * 60)).toBeLessThan(0.2);
    expect(trafficPresence(3 * 60)).toBeLessThan(trafficPresence(23 * 60));
  });

  it('keeps every gain in 0..1', () => {
    for (let x = 0; x < 56 * T; x += 37)
      for (let y = 0; y < 40 * T; y += 41)
        for (const [m, r] of [[0, 0], [400, 0.3], [720, 0], [1200, 1], [1439, 0.55]] as const) {
          const g = at(x, y, m, r);
          for (const k of Object.keys(SILENT_MIX) as (keyof typeof SILENT_MIX)[]) {
            expect(g[k]).toBeGreaterThanOrEqual(0);
            expect(g[k]).toBeLessThanOrEqual(1);
          }
        }
  });

  it('uses zones that sit inside the map', () => {
    const def = ROOMS.praca;
    for (const p of [z.fountain, ...z.radios, ...z.streets.map((s) => ({ x: (s.x0 + s.x1) / 2, y: s.y }))]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(def.cols * T);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(def.rows * T);
    }
  });
});

describe('footsteps', () => {
  it('has a quiet sound for every terrain of the game', () => {
    const kinds = new Set(Object.values(FLOOR_CHARS));
    for (const k of kinds) {
      const f = FOOTSTEPS[k];
      expect(f, k).toBeDefined();
      expect(f.gain).toBeGreaterThan(0);
      expect(f.gain).toBeLessThanOrEqual(0.06);
      expect(f.dur).toBeLessThan(0.12);
    }
  });

  it('varies the pitch by at most 5%', () => {
    expect(stepPitch(0)).toBeCloseTo(0.95, 6);
    expect(stepPitch(1)).toBeCloseTo(1.05, 6);
    for (let i = 0; i <= 20; i++) {
      const p = stepPitch(i / 20);
      expect(p).toBeGreaterThanOrEqual(0.95 - 1e-9);
      expect(p).toBeLessThanOrEqual(1.05 + 1e-9);
    }
  });

  it('steps once per stride walked, not while standing, and not across a teleport', () => {
    const c = new FootstepClock();
    expect(c.update(100, 100, false)).toBe(0);
    let steps = 0;
    for (let i = 1; i <= 100; i++) steps += c.update(100 + i, 100, true);
    expect(steps).toBe(Math.floor(100 / STEP_PX));
    expect(c.update(200, 100, false)).toBe(0);
    expect(c.update(200, 100, false)).toBe(0);
    // a room change puts the avatar somewhere else: no burst of steps
    expect(c.update(700, 500, true)).toBe(0);
    let more = 0;
    for (let i = 1; i <= 30; i++) more += c.update(700, 500 + i, true);
    expect(more).toBe(3);
  });
});
