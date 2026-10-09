import { describe, expect, it } from 'vitest';
import { CARRY } from '@tudobem/shared';
import { BITE_MS } from '../render/pixel/carryFx';
import { CARRY_SFX, carrySfxFor, carrySfxGain, playCarrySfx } from './carrySfx';

/** A context that records when each source starts. */
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

describe('eating and drinking sounds', () => {
  it('gives every food and drink a sound, and none to empties', () => {
    for (const def of Object.values(CARRY)) {
      const kind = carrySfxFor(def.id);
      if (def.kind === 'trash') expect(kind).toBeNull();
      else expect(kind, def.id).not.toBeNull();
    }
    expect(carrySfxFor(null)).toBeNull();
  });

  it('crunches pipoca, munches salgados, gulps cold drinks and slurps coffee', () => {
    expect(carrySfxFor('pipoca_doce')).toBe('crunch');
    expect(carrySfxFor('coxinha')).toBe('munch');
    expect(carrySfxFor('agua_de_coco')).toBe('gulp');
    expect(carrySfxFor('cafezinho')).toBe('slurp');
  });

  it('lands a sound on each bite or sip of the beat', () => {
    for (const kind of CARRY_SFX) {
      const { starts, ctx } = fakeCtx();
      playCarrySfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      for (const ms of BITE_MS) expect(starts.some((t) => Math.abs(t - (10 + ms / 1000)) < 0.001), `${kind} @${ms}`).toBe(true);
      expect(Math.max(...starts)).toBeLessThan(10 + 0.9);
    }
  });

  it('builds a different recipe for each kind', () => {
    const recipes = CARRY_SFX.map((kind) => {
      const { made, starts, ctx } = fakeCtx();
      playCarrySfx(ctx, {} as AudioNode, {} as AudioBuffer, kind);
      return `${made.join(',')}|${starts.map((t) => t.toFixed(3)).join(',')}`;
    });
    expect(new Set(recipes).size).toBe(CARRY_SFX.length);
  });

  it('plays yours at full level and fades other people out with distance', () => {
    expect(carrySfxGain(true, 20)).toBe(1);
    expect(carrySfxGain(false, 0)).toBe(0.5);
    expect(carrySfxGain(false, 5)).toBeLessThan(0.5);
    expect(carrySfxGain(false, 5)).toBeGreaterThan(0);
    expect(carrySfxGain(false, 8)).toBe(0);
  });
});
