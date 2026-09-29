import { describe, expect, it } from 'vitest';
import { keyStep } from './moveStep';

describe('keyStep', () => {
  it('maps top-down screen axes onto +x and +y', () => {
    expect(keyStep('ArrowRight', 'topdown')).toEqual({ dx: 1, dy: 0 });
    expect(keyStep('KeyD', 'topdown')).toEqual({ dx: 1, dy: 0 });
    expect(keyStep('ArrowDown', 'topdown')).toEqual({ dx: 0, dy: 1 });
    expect(keyStep('s', 'topdown')).toEqual({ dx: 0, dy: 1 });
    expect(keyStep('ArrowLeft', 'topdown')).toEqual({ dx: -1, dy: 0 });
    expect(keyStep('ArrowUp', 'topdown')).toEqual({ dx: 0, dy: -1 });
    expect(keyStep('w', 'topdown')).toEqual({ dx: 0, dy: -1 });
  });

  it('keeps the isometric diamond for the iso view', () => {
    expect(keyStep('ArrowRight', 'iso')).toEqual({ dx: 1, dy: -1 });
    expect(keyStep('ArrowDown', 'iso')).toEqual({ dx: 1, dy: 1 });
    expect(keyStep('a', 'iso')).toEqual({ dx: -1, dy: 1 });
    expect(keyStep('KeyW', 'iso')).toEqual({ dx: -1, dy: -1 });
  });

  it('ignores keys that are not movement', () => {
    expect(keyStep('Enter', 'topdown')).toBeNull();
    expect(keyStep('e', 'iso')).toBeNull();
  });
});
