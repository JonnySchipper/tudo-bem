import { describe, expect, it } from 'vitest';
import { BUBBLE_SCALE, bubbleLeft, bubbleSide } from './labels';

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
