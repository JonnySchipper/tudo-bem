import { describe, expect, it } from 'vitest';
import { SFX_TRIM_DB, playBoutSfx, type BoutSfx } from './boutSfx';

const MARKS: BoutSfx[] = ['hit', 'whoosh', 'mount', 'sub', 'win', 'loss'];

/** A context that records which nodes a tone asks for. Enough to tell the placeholders apart. */
function fakeCtx() {
  const made: string[] = [];
  const param = () => ({
    value: 1,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = () => {
    const n = {
      connect() {
        return n;
      },
      start() {},
      stop() {},
      disconnect() {},
      frequency: param(),
      gain: param(),
      Q: param(),
      type: 'sine' as OscillatorType,
      buffer: null as AudioBuffer | null,
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    createGain() {
      made.push('gain');
      return node();
    },
    createOscillator() {
      made.push('osc');
      return node();
    },
    createBufferSource() {
      made.push('src');
      return node();
    },
    createBiquadFilter() {
      made.push('biquad');
      return node();
    },
  };
  return { made, ctx: ctx as unknown as AudioContext };
}

describe('placeholder fight tones', () => {
  it('keeps a distinct trim for each moment', () => {
    const trims = MARKS.map((k) => SFX_TRIM_DB[k]);
    expect(new Set(trims).size).toBe(MARKS.length);
    for (const db of trims) expect(db).toBeLessThan(30);
  });

  it('still returns when the context cannot build a node', () => {
    const ctx = {
      currentTime: 0,
      createGain() {
        throw new Error('no audio');
      },
    } as unknown as AudioContext;
    for (const kind of MARKS) expect(() => playBoutSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind)).not.toThrow();
  });

  it('builds a different recipe for each moment', () => {
    const recipes = MARKS.map((kind) => {
      const { made, ctx } = fakeCtx();
      playBoutSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      return made.join(',');
    });
    expect(new Set(recipes).size).toBe(MARKS.length);
  });
});
