import { describe, expect, it } from 'vitest';
import { FLOOR_CHARS, ROOMS } from '@tudobem/shared';
import { AMBIENT } from '../render/pixel/ambientData';
import { FOOTSTEPS, FootstepClock, SILENT_MIX, STEP_PX, daylight, falloff, radioOn, stepPitch, trafficPresence, zoneMix } from './zones';

// split areas: the traffic hum belongs to the rua, the fountain and the dog corner's radio to the praça, the feira has only the ambient birds
const z = AMBIENT.rua.audio;
const zp = AMBIENT.praca.audio;
const at = (x: number, y: number, minute = 720, rain = 0) => zoneMix(z, { x, y, minute, rain });
const atPraca = (x: number, y: number, minute = 720, rain = 0) => zoneMix(zp, { x, y, minute, rain });
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
  it('has traffic hum on the rua (loudest at the street, softer at the lawn strip) and none in the praça or the feira', () => {
    const street = at(25 * T, 10 * T);
    expect(street.traffic).toBeGreaterThan(0.95);
    // the hum grows as you walk to the street
    expect(at(25 * T, 15 * T).traffic).toBeLessThan(street.traffic);
    expect(at(25 * T, 15 * T).traffic).toBeGreaterThan(0);
    // the praça and the feira have no street at all: calm
    for (const [x, y] of [[16 * T, 5 * T], [16 * T, 16 * T], [5 * T, 20 * T]]) expect(atPraca(x, y).traffic).toBe(0);
    expect(zoneMix(AMBIENT.feira.audio, { x: 10 * T, y: 8 * T, minute: 720, rain: 0 }).traffic).toBe(0);
  });

  it('puts the fountain at its basin (the praça), and nowhere else', () => {
    expect(atPraca(zp.fountain.x, zp.fountain.y + 3 * T).fountain).toBeCloseTo(falloff(3 * T, 44, 200), 5);
    expect(atPraca(zp.fountain.x, zp.fountain.y).fountain).toBe(1);
    expect(atPraca(zp.fountain.x + 250, zp.fountain.y).fountain).toBe(0);
    expect(atPraca(2 * T, 2 * T).fountain).toBe(0);
    // the rua and the feira are out of earshot of it
    expect(at(20 * T, 8 * T).fountain).toBe(0);
    expect(zoneMix(AMBIENT.feira.audio, { x: 10 * T, y: 8 * T, minute: 720, rain: 0 }).fountain).toBe(0);
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
    const street = (m: number) => at(20 * T, 10 * T, m).traffic;
    expect(street(12 * 60)).toBeGreaterThan(street(23 * 60));
    expect(street(3 * 60)).toBeLessThan(0.2);
    expect(trafficPresence(3 * 60)).toBeLessThan(trafficPresence(23 * 60));
  });

  it('keeps every gain in 0..1', () => {
    for (let x = 0; x < 40 * T; x += 37)
      for (let y = 0; y < 24 * T; y += 41)
        for (const [m, r] of [[0, 0], [400, 0.3], [720, 0], [1200, 1], [1439, 0.55]] as const) {
          const g = at(x, y, m, r);
          for (const k of Object.keys(SILENT_MIX) as (keyof typeof SILENT_MIX)[]) {
            expect(g[k]).toBeGreaterThanOrEqual(0);
            expect(g[k]).toBeLessThanOrEqual(1);
          }
        }
  });

  it('uses zones that sit inside their own map (a room without a fountain parks it far outside)', () => {
    for (const id of ['rua', 'praca', 'feira'] as const) {
      const def = ROOMS[id];
      const zones = AMBIENT[id].audio;
      const pts = [...zones.radios, ...zones.streets.map((s) => ({ x: (s.x0 + s.x1) / 2, y: s.y }))];
      if (zones.fountain.x > -1000) pts.push(zones.fountain);
      for (const p of pts) {
        expect(p.x, id).toBeGreaterThan(0);
        expect(p.x, id).toBeLessThan(def.cols * T);
        expect(p.y, id).toBeGreaterThan(0);
        expect(p.y, id).toBeLessThan(def.rows * T);
      }
    }
    // only the rua has a street, only the praça a fountain
    expect(AMBIENT.praca.audio.streets).toEqual([]);
    expect(AMBIENT.feira.audio.streets).toEqual([]);
    expect(AMBIENT.rua.audio.streets).toHaveLength(1);
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
