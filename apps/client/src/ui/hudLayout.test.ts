import { describe, expect, it } from 'vitest';
import { toastTop, type Box } from './hudLayout';
import { spriteZoom, wingFrame } from './introParrots';

const box = (top: number, bottom: number): Box => ({ top, bottom, left: 0, right: 100 });

describe('toastTop', () => {
  it('starts under the top bar', () => {
    expect(toastTop(box(10, 54), [])).toBe(62);
  });

  it('goes under whatever hangs below the bar in the same column', () => {
    expect(toastTop(box(10, 54), [box(60, 104), null])).toBe(112);
    expect(toastTop(box(10, 54), [box(40, 50)])).toBe(62);
  });

  it('falls back to the screen top without a bar', () => {
    expect(toastTop(null, [])).toBe(8);
  });
});

describe('pixel flock', () => {
  it('only ever scales sprites by whole numbers, 1x to 6x', () => {
    for (let s = 0.2; s < 4; s += 0.07) {
      const z = spriteZoom(s);
      expect(Number.isInteger(z)).toBe(true);
      expect(z).toBeGreaterThanOrEqual(1);
      expect(z).toBeLessThanOrEqual(6);
    }
  });

  it('near birds are bigger than far ones', () => {
    expect(spriteZoom(1.6)).toBeGreaterThan(spriteZoom(0.4));
  });

  it('cycles the 4 wing frames at the bird\'s own rate', () => {
    const b = { wingPhase: 0, wingHz: 2, hero: false, seed: 0 };
    const seen = new Set<number>();
    for (let t = 0; t < 1; t += 0.05) seen.add(wingFrame(b, t));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('holds the glider half-up between beats', () => {
    const b = { wingPhase: 0, wingHz: 1.35, hero: true, seed: 0 };
    const frames = new Set<number>();
    for (let t = 0; t < 12; t += 0.1) frames.add(wingFrame(b, t));
    expect(frames.has(1)).toBe(true);
  });
});
