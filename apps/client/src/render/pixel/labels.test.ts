import { describe, expect, it } from 'vitest';
import { BUBBLE_SCALE, bubbleLeft, bubbleSide, deoverlapStacks, type StackBox } from './labels';

describe('de-overlap of nameplates and bubbles', () => {
  const plate = { w: 60, h: 18 };
  const box = (key: string, ax: number, ay: number, bubbles: StackBox['bubbles'] = []): StackBox => ({ key, ax, ay, plate, bubbles });

  it('leaves labels that do not touch where they are', () => {
    const r = deoverlapStacks([box('a', 100, 300), box('b', 400, 300)]);
    expect(r.get('a')).toEqual({ plateLift: 0, pileLift: 0 });
    expect(r.get('b')).toEqual({ plateLift: 0, pileLift: 0 });
  });

  it("lifts a farther stack's bubble above a nearer bubble it would cover", () => {
    // two speakers side by side, one a little in front: their bubbles share the same screen space
    const a = box('a', 200, 290, [{ left: -18, w: 120, h: 50 }]);
    const b = box('b', 230, 300, [{ left: -18, w: 120, h: 50 }]);
    const r = deoverlapStacks([a, b]);
    expect(r.get('b')).toEqual({ plateLift: 0, pileLift: 0 });
    expect(r.get('a')!.pileLift).toBeGreaterThan(0);
  });

  it('lifts a plate that sits on a nearer bubble, and the bubbles ride with it', () => {
    const near = box('near', 200, 300, [{ left: -18, w: 120, h: 50 }]);
    const far = box('far', 200, 280, [{ left: -18, w: 80, h: 40 }]);
    const r = deoverlapStacks([far, near]);
    expect(r.get('near')).toEqual({ plateLift: 0, pileLift: 0 });
    const f = r.get('far')!;
    expect(f.plateLift).toBeGreaterThan(0);
    expect(f.pileLift).toBeGreaterThanOrEqual(f.plateLift);
  });

  it('lifts the owner name off a pet tag that would cover it', () => {
    const owner = box('av:me', 200, 180);
    const pet = box('pet:me', 210, 196);
    const r = deoverlapStacks([owner, pet]);
    expect(r.get('pet:me')!.plateLift).toBe(0);
    expect(r.get('av:me')!.plateLift).toBeGreaterThan(0);
  });

  it('is deterministic and caps the lift', () => {
    const many = Array.from({ length: 12 }, (_, i) => box(`n${i}`, 300, 400 - i * 6, [{ left: -18, w: 100, h: 44 }]));
    const a = deoverlapStacks(many);
    expect([...deoverlapStacks([...many].reverse())].sort()).toEqual([...a].sort());
    for (const v of a.values()) expect(v.pileLift).toBeLessThanOrEqual(140);
  });
});

describe('speech bubble placement', () => {
  it('the tail is on the left for speakers in the left half, mirrored to the right for the right half', () => {
    expect(bubbleSide(200, 1280, 'left')).toBe('left');
    expect(bubbleSide(1000, 1280, 'left')).toBe('right');
    expect(bubbleSide(1000, 1280, 'right')).toBe('right');
    expect(bubbleSide(200, 1280, 'right')).toBe('left');
  });

  it('hysteresis: a speaker crossing the middle does not flip on every frame', () => {
    expect(bubbleSide(650, 1280, 'left')).toBe('left');
    expect(bubbleSide(650, 1280, 'right')).toBe('right');
    expect(bubbleSide(700, 1280, 'left')).toBe('right');
    expect(bubbleSide(580, 1280, 'right')).toBe('left');
  });

  it('puts the tail tip over the speaker, and keeps the bubble on screen', () => {
    const tail = 9 * BUBBLE_SCALE;
    expect(bubbleLeft(400, 120, 'left', 1280)).toBe(400 - tail);
    expect(bubbleLeft(400, 120, 'right', 1280)).toBe(400 + tail - 120);
    expect(bubbleLeft(5, 120, 'left', 1280)).toBe(4); // clamped at the left edge
    expect(bubbleLeft(1275, 120, 'right', 1280)).toBe(1280 - 120 - 4); // and at the right edge
    expect(Number.isInteger(bubbleLeft(401.4, 121, 'left', 1280))).toBe(true);
  });
});
