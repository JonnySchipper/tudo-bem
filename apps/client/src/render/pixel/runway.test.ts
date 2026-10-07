import { describe, expect, it } from 'vitest';
import { LANDING_MS, RUNWAYS, RUNWAY_CYCLE_MS, runwayPose } from './runway';

describe('the airport runway', () => {
  const def = RUNWAYS.aeroporto!;

  it('lands a plane from the west sky, touches down with a puff, and rolls out east off the map', () => {
    const W = RUNWAY_CYCLE_MS; // the odd cycles land from the west
    const at = (t: number) => runwayPose(def, W + t);
    const start = at(0);
    expect(start.dir).toBe('e');
    expect(start.visible).toBe(true);
    expect(start.x).toBeLessThan(0);
    expect(start.alt).toBeGreaterThan(50);
    // the glide only goes down and east
    let prev = start;
    for (let t = 250; t < 5000; t += 250) {
      const p = at(t);
      expect(p.x).toBeGreaterThan(prev.x);
      expect(p.alt).toBeLessThanOrEqual(prev.alt);
      prev = p;
    }
    const touch = at(5000);
    expect(touch.alt).toBe(0);
    expect(touch.puff).toBeGreaterThan(0.9);
    expect(at(7000).puff).toBe(0);
    expect(at(LANDING_MS - 1).x).toBeGreaterThan(def.w);
  });

  it('lands the next one from the east, the mirror of it', () => {
    for (const t of [0, 2500, 5000, 9000]) {
      const w = runwayPose(def, t);
      const e = runwayPose(def, RUNWAY_CYCLE_MS + t);
      expect(w.dir).toBe('w');
      expect(w.x).toBeCloseTo(def.w - e.x);
      expect(w.alt).toBe(e.alt);
    }
  });

  it('keeps the runway empty between landings, and comes round again', () => {
    expect(runwayPose(def, LANDING_MS + 1000).visible).toBe(false);
    expect(runwayPose(def, RUNWAY_CYCLE_MS + 10).visible).toBe(true);
    expect(runwayPose(def, RUNWAY_CYCLE_MS * 3 + 4000)).toEqual(runwayPose(def, RUNWAY_CYCLE_MS + 4000));
  });
});
