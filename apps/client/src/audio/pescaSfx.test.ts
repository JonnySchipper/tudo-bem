import { describe, expect, it } from 'vitest';
import { PESCA_LOOP_MS, PESCA_SFX, PESCA_TRIM_DB, playPescaSfx } from './pescaSfx';
import { hz } from './synth';
import { MOTIF } from './theme';

/** A context that records which nodes a recipe makes, when its sources start and the frequencies the oscillators are set to. */
function fakeCtx() {
  const starts: number[] = [];
  const made: string[] = [];
  const freqs: number[] = [];
  const param = (onSet?: (v: number) => void) => ({
    value: 1,
    setValueAtTime(v: number) {
      onSet?.(v);
    },
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const node = (kind: string) => {
    made.push(kind);
    const n = {
      connect() {
        return n;
      },
      disconnect() {},
      start(when: number) {
        starts.push(when);
      },
      stop() {},
      frequency: param(kind === 'osc' ? (v) => freqs.push(v) : undefined),
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
  return { starts, made, freqs, ctx: ctx as unknown as AudioContext };
}

describe('fishing sounds (PRAIA-PLAN.md 1.5)', () => {
  it('plays something right away for every kind, and nothing runs long', () => {
    for (const kind of PESCA_SFX) {
      const { starts, ctx } = fakeCtx();
      playPescaSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      expect(starts.length, kind).toBeGreaterThan(0);
      expect(Math.min(...starts), kind).toBeLessThan(10.05);
      expect(Math.max(...starts), kind).toBeLessThan(10 + 1.6);
      expect(PESCA_TRIM_DB[kind], kind).toBeGreaterThan(0);
    }
  });

  it('builds a different recipe for each kind', () => {
    const recipes = PESCA_SFX.map((kind) => {
      const { made, starts, ctx } = fakeCtx();
      playPescaSfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      return `${made.join(',')}|${starts.map((t) => t.toFixed(2)).join(',')}`;
    });
    expect(new Set(recipes).size).toBe(PESCA_SFX.length);
  });

  it('"Fisgou!" is a rising fifth on the hook\'s own first pitch', () => {
    const { freqs, ctx } = fakeCtx();
    playPescaSfx(ctx, {} as AudioNode, {} as AudioBuffer, 'fisgou');
    const e = hz(MOTIF[0]!.midi);
    expect(freqs).toContain(e);
    expect(freqs).toContain(hz(MOTIF[0]!.midi + 7));
    expect(freqs.indexOf(e)).toBeLessThan(freqs.indexOf(hz(MOTIF[0]!.midi + 7)));
  });

  it('the catch jingle plays the theme\'s hook, every note of it', () => {
    const { freqs, ctx } = fakeCtx();
    playPescaSfx(ctx, {} as AudioNode, {} as AudioBuffer, 'catch');
    for (const n of MOTIF) expect(freqs).toContain(hz(n.midi));
  });

  it('the ratchet repeats often enough to sound continuous while the line is held', () => {
    expect(PESCA_LOOP_MS.reel).toBeLessThanOrEqual(300);
  });

  it('never throws on a dead context', () => {
    expect(() => playPescaSfx({} as AudioContext, {} as AudioNode, {} as AudioBuffer, 'snap')).not.toThrow();
  });
});
