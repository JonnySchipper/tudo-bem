import { describe, expect, it } from 'vitest';
import type { Dir } from '@tudobem/shared';
import { FACING, FACING_ROW, facingAlongPath, facingForStep, type Facing } from './facing.js';

describe('pixel facing (D5)', () => {
  it('maps the isometric-era wire Dir onto top-down facings', () => {
    expect(FACING.SE).toBe('E'); // +x
    expect(FACING.SW).toBe('S'); // +y
    expect(FACING.NE).toBe('N'); // -y
    expect(FACING.NW).toBe('W'); // -x
  });

  it('covers every Dir with a distinct facing', () => {
    const dirs: Dir[] = ['SE', 'SW', 'NE', 'NW'];
    expect(Object.keys(FACING).sort()).toEqual([...dirs].sort());
    expect(new Set(dirs.map((d) => FACING[d])).size).toBe(4);
  });

  it('uses the canonical sheet row order S, W, E, N', () => {
    expect(FACING_ROW).toEqual({ S: 0, W: 1, E: 2, N: 3 });
    const facings: Facing[] = ['S', 'W', 'E', 'N'];
    expect(facings.map((f) => FACING_ROW[f])).toEqual([0, 1, 2, 3]);
  });
});

describe('walking facing (diagonal flicker fix)', () => {
  it('exact diagonals face E/W, whatever the facing was', () => {
    for (const cur of ['S', 'W', 'E', 'N'] as Facing[]) {
      expect(facingForStep(1, 1, cur)).toBe('E');
      expect(facingForStep(1, -1, cur)).toBe('E');
      expect(facingForStep(-1, 1, cur)).toBe('W');
      expect(facingForStep(-1, -1, cur)).toBe('W');
    }
  });

  it('cardinal steps face their axis', () => {
    expect(facingForStep(1, 0)).toBe('E');
    expect(facingForStep(-1, 0)).toBe('W');
    expect(facingForStep(0, 1)).toBe('S');
    expect(facingForStep(0, -1)).toBe('N');
    expect(facingForStep(0, 0, 'W')).toBe('W'); // no step keeps the facing
  });

  it('near-diagonals are stable: float noise around |dx| = |dy| never changes the facing', () => {
    for (const start of ['E', 'W'] as Facing[]) {
      let f: Facing = start;
      for (let i = 0; i < 200; i++) {
        const noise = (i % 2 ? 1 : -1) * 1e-9 * (1 + (i % 7));
        f = facingForStep(0.37 + noise, 0.37 - noise, f);
        expect(f).toBe('E');
      }
    }
    // the old rule picked a different axis on alternating frames; the vertical facing is only kept when clearly vertical
    expect(facingForStep(0.3, 0.31, 'E')).toBe('E');
    expect(facingForStep(0.3, 0.6, 'E')).toBe('S');
    expect(facingForStep(0.3, 0.6, 'S')).toBe('S');
  });

  const walk = (from: { x: number; y: number }, path: { x: number; y: number }[], current: Facing = 'S') => {
    const seq: Facing[] = [];
    let prev = from;
    let cur = current;
    for (let i = 0; i < path.length; i++) {
      cur = facingAlongPath(prev, path.slice(i), cur);
      seq.push(cur);
      prev = path[i]!;
    }
    return seq;
  };

  it('a run of diagonal steps keeps one facing', () => {
    const path = [1, 2, 3, 4, 5, 6].map((i) => ({ x: 10 + i, y: 10 + i }));
    expect(new Set(walk({ x: 10, y: 10 }, path)).size).toBe(1);
    expect(walk({ x: 10, y: 10 }, path)[0]).toBe('E');
    const nw = [1, 2, 3, 4].map((i) => ({ x: 10 - i, y: 10 - i }));
    expect(walk({ x: 10, y: 10 }, nw, 'N')).toEqual(['W', 'W', 'W', 'W']);
  });

  it('a turn changes the facing once', () => {
    // 4 diagonal steps east-ish, then 4 straight up
    const path = [
      ...[1, 2, 3, 4].map((i) => ({ x: 10 + i, y: 10 + i })),
      ...[1, 2, 3, 4].map((i) => ({ x: 14, y: 14 - i })),
    ];
    const seq = walk({ x: 10, y: 10 }, path);
    let changes = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
    expect(changes).toBe(1);
    expect(seq[0]).toBe('E');
    expect(seq[seq.length - 1]).toBe('N');
  });

  it('a one-tile cardinal jog inside a diagonal run (A* around a prop) does not turn the sprite', () => {
    const path = [
      { x: 11, y: 9 },
      { x: 12, y: 8 },
      { x: 12, y: 7 }, // jog north
      { x: 13, y: 6 },
      { x: 14, y: 5 },
      { x: 15, y: 4 },
    ];
    expect(new Set(walk({ x: 10, y: 10 }, path, 'E')).size).toBe(1);
  });

  it('an empty remaining path keeps the facing', () => {
    expect(facingAlongPath({ x: 1, y: 1 }, [], 'W')).toBe('W');
  });
});
