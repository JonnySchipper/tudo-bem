/**
 * The sounds of a word found on a sign (ui/achado.ts), synthesized like diarySfx.ts (no samples): the star drawing breath, the burst (a
 * bell whose pitch climbs with the streak), a glassy tick for each letter landing, the swoosh into the Diário, a soft fizzle when nothing
 * came of it, and the music-box run when a room's last word is found.
 */
import { noise, tone } from './correriaSfx';

export type AchadoSfx = 'charge' | 'burst' | 'tick' | 'collect' | 'fizzle' | 'complete';

/** A5: the burst bell before the streak lifts it. */
const BASE_HZ = 880;
const hz = (semis: number) => BASE_HZ * 2 ** (semis / 12);

/** A small struck bell: a sine with inharmonic partials, each dying away faster than the one below. */
function bell(ctx: AudioContext, dest: AudioNode, when: number, f: number, peak: number, ring = 1.4) {
  const partials: [number, number, number][] = [
    [1, 1, ring],
    [2.01, 0.42, ring * 0.6],
    [3.02, 0.22, ring * 0.35],
    [4.17, 0.12, ring * 0.2],
  ];
  for (const [mul, amp, dur] of partials) tone(ctx, dest, when, f * mul, f * mul, dur, peak * amp, 'sine');
}

/**
 * `step` is in semitones above the base: the burst climbs the pentatonic with the streak, a letter tick climbs the arpeggio of its word.
 */
export function playAchadoSfx(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, kind: AchadoSfx, step = 0): void {
  const now = ctx.currentTime;
  switch (kind) {
    case 'charge':
      // breath in: a rising airy sweep under a soft rising whistle
      noise(ctx, white, dest, now, 0.42, 'bandpass', 600, 5200, 0.07, 1.4, 0.3);
      tone(ctx, dest, now + 0.05, 330, 990, 0.38, 0.025, 'triangle');
      break;
    case 'burst': {
      const f = hz(step);
      noise(ctx, white, dest, now, 0.25, 'highpass', 5000, 2500, 0.09, 0.7, 0.002);
      tone(ctx, dest, now, 140, 60, 0.18, 0.12, 'sine');
      bell(ctx, dest, now + 0.01, f, 0.13, 1.6);
      bell(ctx, dest, now + 0.09, f * 1.5, 0.07, 1.2);
      // sparkles falling around it
      for (let i = 0; i < 6; i++) tone(ctx, dest, now + 0.12 + i * 0.055, f * (2 + ((i * 5) % 7) / 4), f * 2.2, 0.09, 0.018, 'sine');
      break;
    }
    case 'tick':
      tone(ctx, dest, now, hz(step + 12), hz(step + 12), 0.16, 0.035, 'sine');
      tone(ctx, dest, now, hz(step + 24), hz(step + 24), 0.06, 0.012, 'triangle');
      break;
    case 'collect':
      noise(ctx, white, dest, now, 0.5, 'bandpass', 1800, 6000, 0.05, 1.1, 0.12);
      tone(ctx, dest, now + 0.1, hz(12), hz(19), 0.3, 0.03, 'sine');
      break;
    case 'fizzle':
      noise(ctx, white, dest, now, 0.3, 'bandpass', 2400, 500, 0.05, 1, 0.01);
      tone(ctx, dest, now, 660, 330, 0.25, 0.02, 'triangle');
      break;
    case 'complete': {
      // a quick music-box run up the major arpeggio, then the top bell twice
      const run = [0, 4, 7, 12, 16, 19, 24];
      run.forEach((s, i) => bell(ctx, dest, now + i * 0.075, hz(s - 12), 0.08, 0.9));
      bell(ctx, dest, now + run.length * 0.075 + 0.05, hz(12), 0.12, 2);
      bell(ctx, dest, now + run.length * 0.075 + 0.05, hz(16), 0.07, 2);
      break;
    }
  }
}
