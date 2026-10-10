import { describe, expect, it } from 'vitest';
import { LOCKUP_ROOM, STAGE_SCALE, printStage } from './photoFindLogic';

const print = { w: 172, h: 165 };

describe('the print on stage', () => {
  it('is centred across, grown, and leaves room for the word above it on a desktop screen', () => {
    const view = { w: 1280, h: 800, top: 64, bottom: 96 };
    const s = printStage(print, view);
    expect(s.x).toBe(640);
    expect(s.scale).toBe(STAGE_SCALE);
    const top = s.y - (print.h * s.scale) / 2;
    expect(top - LOCKUP_ROOM).toBeGreaterThanOrEqual(view.top);
    expect(s.y + (print.h * s.scale) / 2).toBeLessThanOrEqual(view.h - view.bottom);
  });

  it('keeps its own size and stays between the HUD bars on a short phone screen', () => {
    const view = { w: 740, h: 360, top: 48, bottom: 70 };
    const s = printStage(print, view);
    expect(s.scale).toBe(1);
    expect(s.y - print.h / 2).toBeGreaterThanOrEqual(view.top);
    expect(s.y + print.h / 2).toBeLessThanOrEqual(view.h - view.bottom);
  });

  it('centres on a screen too short for the print at all', () => {
    expect(printStage(print, { w: 400, h: 200, top: 60, bottom: 60 }).y).toBe(100);
  });
});
