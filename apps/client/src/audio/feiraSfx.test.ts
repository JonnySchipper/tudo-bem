import { describe, expect, it } from 'vitest';
import { FEIRA_LOOP_MS, FEIRA_SFX, playFeiraSfx } from './feiraSfx';

/** A context that records which nodes a recipe makes and when its sources start. */
function fakeCtx() {
  const starts: number[] = [];
  const made: string[] = [];
  const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = (kind: string) => {
    made.push(kind);
    const n = {
      connect() {
        return n;
      },
      start(when: number) {
        starts.push(when);
      },
      stop() {},
      frequency: param(),
      gain: param(),
      Q: param(),
      type: '',
      buffer: null,
    };
    return n;
  };
  const ctx = {
    currentTime: 10,
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBufferSource: () => node('src'),
    createBiquadFilter: () => node('biquad'),
  };
  return { starts, made, ctx: ctx as unknown as AudioContext };
}

describe('feira cart sounds', () => {
  it('plays something right away for every kind, and nothing runs long', () => {
    for (const kind of FEIRA_SFX) {
      const { starts, ctx } = fakeCtx();
      playFeiraSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      expect(starts.length, kind).toBeGreaterThan(0);
      expect(Math.min(...starts), kind).toBeLessThan(10.05);
      expect(Math.max(...starts), kind).toBeLessThan(10 + 1);
    }
  });

  it('builds a different recipe for each kind', () => {
    const recipes = FEIRA_SFX.map((kind) => {
      const { made, starts, ctx } = fakeCtx();
      playFeiraSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      return `${made.join(',')}|${starts.map((t) => t.toFixed(2)).join(',')}`;
    });
    expect(new Set(recipes).size).toBe(FEIRA_SFX.length);
  });

  it('repeats the press and the pour often enough to sound continuous', () => {
    expect(FEIRA_LOOP_MS.crush).toBeLessThanOrEqual(340);
    expect(FEIRA_LOOP_MS.stream).toBeLessThanOrEqual(300);
  });
});
