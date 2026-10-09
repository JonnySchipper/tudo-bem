/**
 * Synthesized eating and drinking, in the same Web Audio style as correriaSfx.ts (no samples). One call plays the whole beat: a sound on
 * each bite or sip at the times the scene animates them (`BITE_MS` in carryFx.ts), so it stays in step with the hand going to the mouth.
 * Pipoca crunches, bread and salgados are a soft munch, cold drinks gulp, and hot coffee is a short slurp.
 */
import { carryOf } from '@tudobem/shared';
import { BITE_MS } from '../render/pixel/carryFx';
import { noise, tone } from './correriaSfx';

export type CarrySfx = 'crunch' | 'munch' | 'gulp' | 'slurp';
export const CARRY_SFX = ['crunch', 'munch', 'gulp', 'slurp'] as const;

const HOT = new Set(['cafezinho', 'cafe', 'cafe_com_leite']);

/** The sound of eating or drinking `id`, or null when it is not food or drink. */
export function carrySfxFor(id: string | null | undefined): CarrySfx | null {
  const def = carryOf(id);
  if (!def || def.kind === 'trash') return null;
  if (def.kind === 'drink') return HOT.has(def.id) ? 'slurp' : 'gulp';
  return def.id.startsWith('pipoca') ? 'crunch' : 'munch';
}

export function playCarrySfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: CarrySfx): void {
  const now = ctx.currentTime;
  BITE_MS.forEach((ms, i) => {
    const t = now + ms / 1000;
    // a little pitch drift per bite so three in a row don't sound looped
    const k = 1 + (i - 1) * 0.06;
    switch (kind) {
      case 'crunch':
        // dry crackle: a few bright clicks over a short high noise burst
        noise(ctx, white, dest, t, 0.07, 'bandpass', 3800 * k, 2400 * k, 0.07, 1.2, 0.002);
        for (let c = 0; c < 3; c++) noise(ctx, white, dest, t + 0.012 + c * 0.018, 0.012, 'highpass', 5200, 5200, 0.04, 0.7, 0.001);
        break;
      case 'munch':
        // soft and muffled: low noise with a dull thump
        noise(ctx, white, dest, t, 0.09, 'lowpass', 900 * k, 380 * k, 0.09, 0.9, 0.006);
        tone(ctx, dest, t, 150 * k, 90 * k, 0.07, 0.04, 'triangle');
        break;
      case 'gulp':
        // a swallow: a quick upward bloop with a wet band of noise
        tone(ctx, dest, t, 220 * k, 420 * k, 0.09, 0.05, 'sine');
        noise(ctx, white, dest, t, 0.1, 'bandpass', 600 * k, 900 * k, 0.04, 2, 0.01);
        break;
      case 'slurp':
        // air drawn over hot coffee: a rising hiss, then a small swallow
        noise(ctx, white, dest, t, 0.12, 'bandpass', 1800 * k, 3600 * k, 0.045, 1.6, 0.03);
        tone(ctx, dest, t + 0.1, 260 * k, 380 * k, 0.06, 0.03, 'sine');
        break;
    }
  });
}

/** How loud someone's bite is: yours at full level, anyone else softer and fading out with distance in tiles (silent from `FAR` on). */
export function carrySfxGain(self: boolean, tiles: number): number {
  if (self) return 1;
  const NEAR = 2;
  const FAR = 8;
  if (tiles >= FAR) return 0;
  return 0.5 * Math.min(1, (FAR - tiles) / (FAR - NEAR));
}
