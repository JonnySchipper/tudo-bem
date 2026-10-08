import { describe, expect, it } from 'vitest';
import { HOLD_MS, TAP_SLOP_PX, TapGesture } from './tapGesture';

describe('TapGesture', () => {
  it('a mouse click is a click wherever it is released (unchanged)', () => {
    const g = new TapGesture();
    g.start(1, 100, 100, 0, false);
    expect(g.move(1, 300, 300)).toBeNull();
    expect(g.holdDue(5000)).toBe(false);
    expect(g.end(1, 300, 300)).toBe('tap');
  });

  it('a finger lifted within the slop is a tap', () => {
    const g = new TapGesture();
    g.start(1, 100, 100, 0, true);
    expect(g.move(1, 104, 103)).toBeNull();
    expect(g.end(1, 105, 104)).toBe('tap');
  });

  it('a finger dragged past the slop steers, and lifting it is not a tap', () => {
    const g = new TapGesture();
    g.start(1, 100, 100, 0, true);
    expect(g.move(1, 100 + TAP_SLOP_PX + 1, 100)).toBe('steer');
    expect(g.steering).toBe(true);
    // coming back near the start still steers
    expect(g.move(1, 101, 100)).toBe('steer');
    expect(g.end(1, 101, 100)).toBe('steer');
    expect(g.steering).toBe(false);
  });

  it('a finger held still is due after HOLD_MS; the caller decides to steer', () => {
    const g = new TapGesture();
    g.start(1, 50, 50, 1000, true);
    expect(g.holdDue(1000 + HOLD_MS - 1)).toBe(false);
    expect(g.holdDue(1000 + HOLD_MS)).toBe(true);
    // held on a person: no steer, so the release is still a tap on them
    expect(g.end(1, 50, 50)).toBe('tap');
    g.start(2, 50, 50, 2000, true);
    g.steer();
    expect(g.end(2, 50, 50)).toBe('steer');
  });

  it('ignores other pointers, and a cancel forgets the press', () => {
    const g = new TapGesture();
    g.start(1, 0, 0, 0, true);
    expect(g.move(2, 100, 100)).toBeNull();
    expect(g.end(2, 0, 0)).toBeNull();
    g.cancel(1);
    expect(g.end(1, 0, 0)).toBeNull();
    expect(g.origin).toBeNull();
  });
});
