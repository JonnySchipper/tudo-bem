/**
 * Synthesized sound effects of the bout, in the same Web Audio style as ambience.ts (no samples, no paid service): a mat slap on a
 * transition, crowd swells (a cheer and claps on points, an "ooh" on a close one), a referee whistle, the tap-out slaps and a soft gong
 * to start. Pure recipes over an AudioContext (`ambience.sfx` owns the context, the unlock and the ducking).
 */

import { vca } from './synth';

export type BoutSfx = 'slap' | 'cheer' | 'gasp' | 'claps' | 'whistle' | 'tapout' | 'gong' | 'tick' | 'hit' | 'whoosh' | 'mount' | 'sub' | 'win' | 'loss';

function noise(ctx: AudioContext, white: AudioBuffer, dest: AudioNode, when: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, q = 0.8, attack = 0.01) {
  const src = ctx.createBufferSource();
  src.buffer = white;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = vca(ctx);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(when, Math.random() * 0.4);
  src.stop(when + dur + 0.05);
}

function thump(ctx: AudioContext, dest: AudioNode, when: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = vca(ctx);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(dest);
  o.start(when);
  o.stop(when + dur + 0.04);
}

/** A few separate hand claps: short band-passed noise ticks at uneven gaps. */
function claps(ctx: AudioContext, white: AudioBuffer, dest: AudioNode, when: number, n: number, peak: number) {
  let t = when;
  for (let i = 0; i < n; i++) {
    noise(ctx, white, dest, t, 0.06, 'bandpass', 1800 + Math.random() * 900, 1500, peak * (0.6 + Math.random() * 0.5), 1.2, 0.002);
    t += 0.07 + Math.random() * 0.1;
  }
}

/**
 * Each effect's trim (dB), measured against the bout music (`node scripts/audio-lab.mjs sfx`): the cheer, the whistle and the
 * tap-out land at about the music's level, the slap and the claps a little under, the timer tick is barely there.
 */
export const SFX_TRIM_DB: Record<BoutSfx, number> = {
  slap: 12.5,
  cheer: 8,
  gasp: 16,
  claps: 19,
  whistle: 7,
  tapout: 8,
  gong: 8.5,
  tick: 26,
  hit: 14,
  whoosh: 12,
  mount: 11,
  sub: 10,
  win: 9,
  loss: 13,
};

export function playBoutSfx(ctx: AudioContext, out: AudioNode, white: AudioBuffer, kind: BoutSfx): void {
  try {
    playBoutSfxNow(ctx, out, white, kind);
  } catch {
    /* a missing file or a closed context must not stop the match */
  }
}

function playBoutSfxNow(ctx: AudioContext, out: AudioNode, white: AudioBuffer, kind: BoutSfx): void {
  const now = ctx.currentTime;
  const dest = ctx.createGain();
  dest.gain.value = Math.pow(10, (SFX_TRIM_DB[kind] ?? 12) / 20);
  dest.connect(out);
  setTimeout(() => {
    try {
      dest.disconnect();
    } catch {
      /* already torn down */
    }
  }, 2500);
  switch (kind) {
    case 'slap':
      // the flat crack of two bodies on the mat plus a soft thump
      noise(ctx, white, dest, now, 0.09, 'bandpass', 1400, 600, 0.2, 0.9, 0.003);
      thump(ctx, dest, now, 120, 48, 0.16, 0.22);
      break;
    case 'cheer':
      // the bleachers: a swell of filtered noise with claps on top
      noise(ctx, white, dest, now, 1.35, 'bandpass', 900, 1300, 0.12, 0.5, 0.35);
      noise(ctx, white, dest, now + 0.05, 1.2, 'highpass', 2400, 2400, 0.03, 0.7, 0.4);
      claps(ctx, white, dest, now + 0.25, 7, 0.07);
      break;
    case 'claps':
      claps(ctx, white, dest, now, 5, 0.06);
      break;
    case 'gasp':
      // an "ooh": a quick rise of band-passed noise
      noise(ctx, white, dest, now, 0.55, 'bandpass', 600, 1500, 0.1, 1.1, 0.12);
      break;
    case 'whistle':
      for (const [dt, len] of [[0, 0.18], [0.24, 0.32]] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 38;
        const lg = ctx.createGain();
        lg.gain.value = 70;
        lfo.connect(lg);
        lg.connect(o.frequency);
        o.frequency.setValueAtTime(2350, now + dt);
        const g = vca(ctx);
        g.gain.setValueAtTime(0.0001, now + dt);
        g.gain.exponentialRampToValueAtTime(0.07, now + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dt + len);
        o.connect(g);
        g.connect(dest);
        o.start(now + dt);
        lfo.start(now + dt);
        o.stop(now + dt + len + 0.05);
        lfo.stop(now + dt + len + 0.05);
      }
      break;
    case 'tapout':
      for (let i = 0; i < 3; i++) {
        noise(ctx, white, dest, now + i * 0.11, 0.06, 'bandpass', 1700, 1100, 0.16, 1, 0.002);
        thump(ctx, dest, now + i * 0.11, 180, 90, 0.07, 0.12);
      }
      break;
    case 'gong':
      thump(ctx, dest, now, 392, 380, 1.1, 0.07, 'triangle');
      thump(ctx, dest, now, 588, 570, 0.8, 0.035, 'sine');
      break;
    case 'tick':
      thump(ctx, dest, now, 880, 700, 0.05, 0.03, 'triangle');
      break;
    case 'hit':
      // a move connects: a short crack, higher than the mat slap
      noise(ctx, white, dest, now, 0.07, 'highpass', 900, 500, 0.16, 0.7, 0.004);
      thump(ctx, dest, now, 220, 90, 0.09, 0.14, 'triangle');
      break;
    case 'whoosh':
      // takedown: noise sweeping downward
      noise(ctx, white, dest, now, 0.22, 'bandpass', 1800, 240, 0.18, 0.6, 0.01);
      break;
    case 'mount':
      // someone gets mounted: a low thump
      thump(ctx, dest, now, 90, 42, 0.2, 0.28, 'sine');
      thump(ctx, dest, now + 0.02, 60, 36, 0.16, 0.12, 'triangle');
      break;
    case 'sub':
      // a submission attempt, hit or miss: two tight tones
      thump(ctx, dest, now, 520, 480, 0.08, 0.08, 'square');
      thump(ctx, dest, now + 0.09, 390, 340, 0.1, 0.07, 'square');
      break;
    case 'win':
      thump(ctx, dest, now, 523, 523, 0.18, 0.07, 'sine');
      thump(ctx, dest, now + 0.12, 659, 659, 0.22, 0.06, 'sine');
      thump(ctx, dest, now + 0.24, 784, 784, 0.28, 0.05, 'sine');
      break;
    case 'loss':
      thump(ctx, dest, now, 392, 370, 0.2, 0.06, 'triangle');
      thump(ctx, dest, now + 0.16, 311, 280, 0.26, 0.05, 'triangle');
      break;
  }
}
