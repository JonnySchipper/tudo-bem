/**
 * Synthesized sounds of the Feira cart games, in the same Web Audio style as correriaSfx.ts (no samples):
 *
 *   - `cane`: a stalk of cane thunks into the moenda's slot;
 *   - `crush`: one turn of the rollers crushing it, a creaking iron grind with fibres snapping (played over and over while you crank);
 *   - `stream`: the caldo running from the spout into a cup, a bright wet trickle (also over and over);
 *   - `splat`: the same stream hitting the counter when there is no cup;
 *   - `splash`: a squeeze of limão (or a fruit) dropping into the juice, a bloop with a splash;
 *   - `ice`: cubes dropping into the cup, a few clinks and a small plop;
 *   - `cup`: a plastic cup set down under the spout;
 *   - `bin`: something dropped in the lixeira, a hollow thud with the lid clapping;
 *   - `oil`: a pastel slid into hot oil, a splash that opens into a loud sizzle.
 */
import { noise, tone } from './correriaSfx';

export type FeiraSfx = 'cane' | 'crush' | 'stream' | 'splat' | 'splash' | 'ice' | 'cup' | 'bin' | 'oil';
export const FEIRA_SFX = ['cane', 'crush', 'stream', 'splat', 'splash', 'ice', 'cup', 'bin', 'oil'] as const;

/** How often the looping sounds repeat while the wheel is held, in ms (each recipe is a little longer, so they overlap). */
export const FEIRA_LOOP_MS = { crush: 300, stream: 260 } as const;

export function playFeiraSfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: FeiraSfx): void {
  const now = ctx.currentTime;
  // a small random drift so a loop never sounds like one sample on repeat
  const k = 0.94 + Math.random() * 0.12;
  switch (kind) {
    case 'cane':
      // a woody knock, then the stalk sliding in
      tone(ctx, dest, now, 210 * k, 120 * k, 0.12, 0.09, 'triangle');
      noise(ctx, white, dest, now, 0.05, 'bandpass', 1400, 900, 0.08, 1.2, 0.002);
      noise(ctx, white, dest, now + 0.06, 0.22, 'bandpass', 900, 600, 0.04, 0.9, 0.04);
      break;
    case 'crush':
      // the rollers: a low iron grind with a creak on top, and fibres snapping
      tone(ctx, dest, now, 62 * k, 70 * k, 0.34, 0.05, 'sawtooth');
      tone(ctx, dest, now + 0.05, 340 * k, 290 * k, 0.16, 0.012, 'square');
      noise(ctx, white, dest, now, 0.3, 'lowpass', 700 * k, 380 * k, 0.07, 0.8, 0.03);
      for (let c = 0; c < 3; c++) noise(ctx, white, dest, now + 0.04 + c * 0.09 + Math.random() * 0.03, 0.025, 'bandpass', 2600 * k, 1800 * k, 0.06, 1.6, 0.001);
      break;
    case 'stream':
      // a thin pour: band-passed noise that wobbles, with a little rising bloop as the cup fills
      noise(ctx, white, dest, now, 0.3, 'bandpass', 1300 * k, 1700 * k, 0.05, 2.2, 0.03);
      noise(ctx, white, dest, now + 0.04, 0.22, 'highpass', 4200, 5200, 0.015, 0.7, 0.03);
      tone(ctx, dest, now + 0.08, 520 * k, 760 * k, 0.07, 0.012, 'sine');
      break;
    case 'splat':
      // the stream hitting the counter: flatter, drippier
      noise(ctx, white, dest, now, 0.26, 'bandpass', 700 * k, 520 * k, 0.06, 1.4, 0.02);
      tone(ctx, dest, now + 0.05, 300 * k, 220 * k, 0.06, 0.015, 'sine');
      break;
    case 'splash':
      // the fruit drops in: a low bloop, then the splash
      tone(ctx, dest, now, 180 * k, 520 * k, 0.12, 0.07, 'sine');
      noise(ctx, white, dest, now + 0.03, 0.24, 'bandpass', 1800 * k, 900 * k, 0.08, 1.1, 0.008);
      noise(ctx, white, dest, now + 0.09, 0.18, 'highpass', 3600, 2800, 0.03, 0.7, 0.02);
      break;
    case 'ice':
      // cubes rattling in, a clink on each, and a small plop into the juice
      for (const [dt, f] of [[0, 2900], [0.07, 3500], [0.13, 2500]] as const) {
        tone(ctx, dest, now + dt, f * k, f * k * 0.96, 0.09, 0.05, 'triangle');
        tone(ctx, dest, now + dt, f * k * 2.4, f * k * 2.3, 0.05, 0.015, 'sine');
      }
      tone(ctx, dest, now + 0.2, 420 * k, 700 * k, 0.08, 0.03, 'sine');
      break;
    case 'cup':
      // a plastic cup set down: a light hollow tock
      tone(ctx, dest, now, 900 * k, 700 * k, 0.05, 0.05, 'triangle');
      noise(ctx, white, dest, now, 0.04, 'bandpass', 2400, 2000, 0.04, 1.3, 0.001);
      break;
    case 'bin':
      // into the lixeira: a hollow thud and the lid clapping shut
      tone(ctx, dest, now, 130 * k, 70 * k, 0.2, 0.1, 'triangle');
      noise(ctx, white, dest, now, 0.12, 'lowpass', 800, 300, 0.08, 0.8, 0.002);
      tone(ctx, dest, now + 0.16, 520 * k, 380 * k, 0.06, 0.05, 'square');
      noise(ctx, white, dest, now + 0.16, 0.05, 'bandpass', 1800, 1400, 0.05, 1.2, 0.001);
      break;
    case 'oil':
      // a pastel slides into the fryer: a splash, then the oil roars up
      noise(ctx, white, dest, now, 0.12, 'bandpass', 1200, 2400, 0.08, 1, 0.004);
      noise(ctx, white, dest, now + 0.05, 1.1, 'highpass', 2600, 4800, 0.09, 0.6, 0.12);
      for (let c = 0; c < 4; c++) noise(ctx, white, dest, now + 0.1 + c * 0.12 + Math.random() * 0.05, 0.02, 'highpass', 5200, 5200, 0.04, 0.7, 0.001);
      break;
  }
}
