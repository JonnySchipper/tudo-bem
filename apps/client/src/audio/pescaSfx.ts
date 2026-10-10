/**
 * Synthesized sounds of fishing at the Praia (PRAIA-PLAN.md 1.5), in the same Web Audio style as feiraSfx.ts / boutSfx.ts (no samples):
 *
 *   - `cast`: the rod whips and the line whistles out;
 *   - `plop`: the bobber lands, a bloop and a little splash;
 *   - `nibble`: a fake bite, one soft tick under the water;
 *   - `fisgou`: the real bite, a short rising fifth on the theme's own hook pitches (E up to B) with a thump under it;
 *   - `reel`: one click of the reel's ratchet (played over and over while the line is held);
 *   - `tug`: the fish is about to run: a dull tug on the rod;
 *   - `creak`: the rod creaks as the tension climbs past the red;
 *   - `snap`: the line breaks, a crack and the rod springing back;
 *   - `leap`: the fish leaps out at the end of the fight;
 *   - `catch`: the catch jingle, the theme's hook (E F♯ · C♯ D E) on vibes, two short bars;
 *   - `trophy`: the trophy fanfare, the win stinger's three notes over a surdo;
 *   - `tangle`: the line tangles on a cast held too long, a rustle and a sour note;
 *   - `miss`: too early, too late or it got away: a low "nope";
 *   - `junk`: a chinelo, a can or weed comes up: a wet slap;
 *   - `puff`: a baiacu puffs up, a squeak and a soft pop.
 *
 * `PESCA_TRIM_DB` is each effect's trim against the beach bed, the `boutSfx.ts` pattern (`node scripts/audio-lab.mjs sfx`).
 */
import { noise, tone } from './correriaSfx';
import { hz } from './synth';
import { MOTIF } from './theme';

export type PescaSfx = 'cast' | 'plop' | 'nibble' | 'fisgou' | 'reel' | 'tug' | 'creak' | 'snap' | 'leap' | 'catch' | 'trophy' | 'tangle' | 'miss' | 'junk' | 'puff';
/** (`leap`, not `splash`: the feira's `splash` is dispatched first in `ambience.sfx`.) */
export const PESCA_SFX = ['cast', 'plop', 'nibble', 'fisgou', 'reel', 'tug', 'creak', 'snap', 'leap', 'catch', 'trophy', 'tangle', 'miss', 'junk', 'puff'] as const;

/** How often the ratchet repeats while the line is held, in ms. */
export const PESCA_LOOP_MS = { reel: 240 } as const;

/** The hook's first two pitches (E and F♯ at bar 0): the bite's fifth starts on the first and lands a fifth above it. */
const HOOK_E = MOTIF[0]?.midi ?? 76;
/** The hook in 16th steps at the theme's tempo (112 bpm), as seconds. */
const STEP_S = 60 / 112 / 4;

/** Each effect's trim (dB) against the beach bed: the bite and the fanfare land a little over it, the ratchet and the nibble well under. */
export const PESCA_TRIM_DB: Record<PescaSfx, number> = {
  cast: 12,
  plop: 11,
  nibble: 18,
  fisgou: 7,
  reel: 20,
  tug: 14,
  creak: 15,
  snap: 8,
  leap: 10,
  catch: 8,
  trophy: 6,
  tangle: 12,
  miss: 13,
  junk: 12,
  puff: 11,
};

export function playPescaSfx(ctx: AudioContext, out: AudioNode, white: AudioBuffer, kind: PescaSfx): void {
  try {
    playNow(ctx, out, white, kind);
  } catch {
    /* a closed context must never stop a cast */
  }
}

/** A short vibes-like note: a sine with a touch of its octave, a quick decay. */
function vibe(ctx: AudioContext, dest: AudioNode, when: number, midi: number, dur: number, vel: number) {
  tone(ctx, dest, when, hz(midi), hz(midi), dur, vel, 'sine');
  tone(ctx, dest, when, hz(midi + 12), hz(midi + 12), dur * 0.6, vel * 0.25, 'sine');
}

function playNow(ctx: AudioContext, out: AudioNode, white: AudioBuffer, kind: PescaSfx): void {
  const now = ctx.currentTime;
  const dest = ctx.createGain();
  dest.gain.value = Math.pow(10, (PESCA_TRIM_DB[kind] ?? 12) / 20);
  dest.connect(out);
  setTimeout(() => {
    try {
      dest.disconnect();
    } catch {
      /* already torn down */
    }
  }, 3000);
  // a small drift so a loop (the ratchet) never sounds like one sample on repeat
  const k = 0.95 + Math.random() * 0.1;
  switch (kind) {
    case 'cast':
      // the rod whips (a downward sweep of noise), then the line whistles out
      noise(ctx, white, dest, now, 0.18, 'bandpass', 2200 * k, 500, 0.14, 0.7, 0.006);
      tone(ctx, dest, now + 0.08, 1800 * k, 2600 * k, 0.22, 0.012, 'sine');
      break;
    case 'plop':
      // the bobber lands: a bloop that dips, then a little splash
      tone(ctx, dest, now, 520 * k, 180 * k, 0.11, 0.08, 'sine');
      noise(ctx, white, dest, now + 0.03, 0.16, 'bandpass', 1600 * k, 800, 0.05, 1.1, 0.01);
      break;
    case 'nibble':
      // one soft tick under the water
      tone(ctx, dest, now, 640 * k, 560 * k, 0.045, 0.05, 'triangle');
      break;
    case 'fisgou':
      // the bite: the hook's E up a fifth to B, bright and quick, with a thump as the rod bends
      tone(ctx, dest, now, hz(HOOK_E), hz(HOOK_E), 0.12, 0.09, 'square');
      tone(ctx, dest, now + 0.1, hz(HOOK_E + 7), hz(HOOK_E + 7), 0.26, 0.1, 'square');
      tone(ctx, dest, now, 140, 60, 0.14, 0.14, 'sine');
      noise(ctx, white, dest, now, 0.08, 'bandpass', 1200, 700, 0.06, 1, 0.004);
      break;
    case 'reel':
      // one click of the ratchet, with a hint of the spool whirring
      noise(ctx, white, dest, now, 0.03, 'bandpass', 2800 * k, 2200 * k, 0.07, 1.5, 0.001);
      tone(ctx, dest, now + 0.01, 420 * k, 380 * k, 0.04, 0.025, 'square');
      break;
    case 'tug':
      // the fish is about to run: a dull pull on the rod
      tone(ctx, dest, now, 180 * k, 90 * k, 0.16, 0.09, 'triangle');
      noise(ctx, white, dest, now, 0.07, 'lowpass', 700, 300, 0.05, 0.8, 0.005);
      break;
    case 'creak':
      // the rod creaks under tension: a narrow, slowly rising squeal over wood
      noise(ctx, white, dest, now, 0.3, 'bandpass', 900 * k, 1500 * k, 0.07, 6, 0.04);
      tone(ctx, dest, now + 0.02, 240 * k, 300 * k, 0.28, 0.02, 'sawtooth');
      break;
    case 'snap':
      // the line breaks: a crack, then the rod springs back with a twang
      noise(ctx, white, dest, now, 0.06, 'highpass', 3800, 2400, 0.22, 0.8, 0.001);
      tone(ctx, dest, now + 0.03, 320, 210, 0.26, 0.09, 'triangle');
      tone(ctx, dest, now + 0.03, 640, 420, 0.14, 0.03, 'sawtooth');
      break;
    case 'leap':
      // the fish leaps: a bloop up, then a wide splash of water
      tone(ctx, dest, now, 220 * k, 640 * k, 0.1, 0.07, 'sine');
      noise(ctx, white, dest, now + 0.04, 0.32, 'bandpass', 1500 * k, 700, 0.1, 0.9, 0.01);
      noise(ctx, white, dest, now + 0.1, 0.24, 'highpass', 3200, 2400, 0.04, 0.7, 0.03);
      break;
    case 'catch':
      // the catch jingle: the hook on vibes, two short bars, its first note on the card's landing
      for (const n of MOTIF) vibe(ctx, dest, now + (n.at - (MOTIF[0]?.at ?? 0)) * STEP_S * 0.45, n.midi, Math.max(0.18, n.dur * STEP_S * 0.55), 0.07);
      break;
    case 'trophy':
      // the fanfare: the win stinger's three notes over a surdo
      for (const [dt, midi] of [[0, 72], [0.13, 76], [0.26, 79]] as const) vibe(ctx, dest, now + dt, midi, 0.32, 0.08);
      vibe(ctx, dest, now + 0.42, 84, 0.6, 0.09);
      for (const dt of [0, 0.26]) tone(ctx, dest, now + dt, 70, 46, 0.3, 0.2, 'sine');
      break;
    case 'tangle':
      // the line tangles: a rustle and a sour note
      noise(ctx, white, dest, now, 0.22, 'bandpass', 2400 * k, 1200 * k, 0.07, 1.2, 0.01);
      tone(ctx, dest, now + 0.12, 330, 300, 0.22, 0.05, 'sawtooth');
      break;
    case 'miss':
      // too early, too late or it got away: a low "nope"
      tone(ctx, dest, now, 300 * k, 250 * k, 0.11, 0.07, 'triangle');
      tone(ctx, dest, now + 0.12, 240 * k, 190 * k, 0.16, 0.06, 'triangle');
      break;
    case 'junk':
      // a chinelo, a can or weed comes up: a wet slap on the sand
      noise(ctx, white, dest, now, 0.09, 'lowpass', 900, 400, 0.12, 0.8, 0.003);
      tone(ctx, dest, now, 160 * k, 80 * k, 0.12, 0.08, 'triangle');
      break;
    case 'puff':
      // a baiacu puffs up: a rising squeak, then a soft pop
      tone(ctx, dest, now, 700 * k, 1300 * k, 0.22, 0.04, 'sine');
      tone(ctx, dest, now + 0.24, 260, 120, 0.08, 0.07, 'sine');
      noise(ctx, white, dest, now + 0.24, 0.05, 'bandpass', 1400, 900, 0.05, 1.1, 0.002);
      break;
  }
}
