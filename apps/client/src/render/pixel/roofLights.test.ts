import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { litGrade, roofHall } from './roofLights';
import { lightState } from './dayNight';
import { T } from './coords';

const aero = ROOMS.aeroporto;
const M = (h: number, m = 0) => h * 60 + m;

describe('roof hall (the airport terminal lit at night, issue #168)', () => {
  const hall = roofHall(aero)!;

  it('covers the hall under the roof edge to edge, from the foot of the north glass to the south glass', () => {
    expect(hall).not.toBeNull();
    const roof = aero.roof!;
    expect(hall.x0).toBe(0);
    expect(hall.x1).toBe(aero.cols * T);
    expect(hall.bands[0].y0).toBe((roof.y0 + 1) * T);
    expect(hall.bands[hall.bands.length - 1].y1).toBe((roof.y1 + 1) * T);
    // the bands tile the hall with no gap or overlap (the rig fills around and between them)
    for (let i = 1; i < hall.bands.length; i++) expect(hall.bands[i].y0).toBe(hall.bands[i - 1].y1);
    expect(hall.bands.length).toBeGreaterThanOrEqual(2);
    expect(hall.bands.length).toBeLessThanOrEqual(3);
  });

  it('is off at noon, on at 21:00, and lights up bank by bank over dusk', () => {
    expect(hall.bands.every((b) => lightState(M(12), b.delay) === 0)).toBe(true);
    expect(hall.bands.every((b) => lightState(M(21), b.delay) === 1)).toBe(true);
    // a few minutes after 18:00 the front bank is up and the back one is still dark
    const at = M(18, 5);
    expect(lightState(at, hall.bands[0].delay)).toBe(1);
    expect(lightState(at, hall.bands[hall.bands.length - 1].delay)).toBe(0);
  });

  it('keeps some of the night in a lit hall (a lit terminal, not noon)', () => {
    expect(hall.gain).toBeGreaterThan(0.4);
    expect(hall.gain).toBeLessThan(1);
  });

  it('only a roofed map has a hall', () => {
    expect(roofHall(ROOMS.praca)).toBeNull();
    expect(roofHall({ cols: 10 })).toBeNull();
  });
});

describe('litGrade', () => {
  it('is the grade itself when unlit, the tint when fully lit', () => {
    expect(litGrade(0x405080, 0xfff1d6, 0)).toBe(0x405080);
    expect(litGrade(0x405080, 0xfff1d6, 1)).toBe(0xfff1d6);
    expect(litGrade(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});
