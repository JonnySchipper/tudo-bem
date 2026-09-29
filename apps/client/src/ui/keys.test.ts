import { describe, expect, it } from 'vitest';
import { arrowForKey, stepForHeld, stepTarget, type Arrow } from './keys';

describe('keyboard step direction (top-down: right = +x, down = +y)', () => {
  it('maps WASD and the arrow keys, ignores everything else', () => {
    expect(arrowForKey('w')).toBe('up');
    expect(arrowForKey('A')).toBe('left');
    expect(arrowForKey('s')).toBe('down');
    expect(arrowForKey('d')).toBe('right');
    expect(arrowForKey('ArrowUp')).toBe('up');
    expect(arrowForKey('ArrowRight')).toBe('right');
    expect(arrowForKey('e')).toBeNull();
    expect(arrowForKey('Enter')).toBeNull();
    expect(arrowForKey(' ')).toBeNull();
  });

  it('a single key steps one tile in that screen direction', () => {
    expect(stepForHeld(['right'])).toEqual({ dx: 1, dy: 0 });
    expect(stepForHeld(['left'])).toEqual({ dx: -1, dy: 0 });
    expect(stepForHeld(['down'])).toEqual({ dx: 0, dy: 1 });
    expect(stepForHeld(['up'])).toEqual({ dx: 0, dy: -1 });
  });

  it('two keys on different axes step diagonally', () => {
    expect(stepForHeld(['up', 'right'])).toEqual({ dx: 1, dy: -1 });
    expect(stepForHeld(['down', 'left'])).toEqual({ dx: -1, dy: 1 });
  });

  it('the most recent key wins on an axis, and nothing held means no step', () => {
    expect(stepForHeld(['right', 'left'])).toEqual({ dx: -1, dy: 0 });
    expect(stepForHeld(['left', 'right'])).toEqual({ dx: 1, dy: 0 });
    expect(stepForHeld([])).toBeNull();
  });

  it('never steps further than the adjacent tile', () => {
    const held: Arrow[] = ['up', 'up', 'right', 'right'];
    const s = stepForHeld(held);
    expect(Math.abs(s?.dx ?? 9)).toBeLessThanOrEqual(1);
    expect(Math.abs(s?.dy ?? 9)).toBeLessThanOrEqual(1);
  });
});

describe('stepTarget', () => {
  const open = () => true;
  it('is the adjacent tile', () => {
    expect(stepTarget({ x: 5, y: 5 }, { dx: 1, dy: 0 }, open)).toEqual({ x: 6, y: 5 });
    expect(stepTarget({ x: 5, y: 5 }, { dx: 0, dy: -1 }, open)).toEqual({ x: 5, y: 4 });
  });
  it('slides along a free axis when the diagonal is blocked', () => {
    const wall = (x: number, y: number) => !(x === 6 && y === 4);
    expect(stepTarget({ x: 5, y: 5 }, { dx: 1, dy: -1 }, wall)).toEqual({ x: 6, y: 5 });
  });
  it('returns null when every option is blocked (room edge)', () => {
    const edge = (x: number) => x >= 0;
    expect(stepTarget({ x: 0, y: 3 }, { dx: -1, dy: 0 }, edge)).toBeNull();
  });
});
