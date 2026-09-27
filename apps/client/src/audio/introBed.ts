/**
 * Intro / sign-in music bed: a soft late-afternoon bossa loop made in Web Audio
 * (nylon-guitar comping, Rhodes pad, upright bass, shaker, a whistled line).
 * The score is pure data so it can be tested and rendered offline; `IntroMusic`
 * schedules it bar by bar a little ahead of the audio clock.
 */

export const INTRO_BPM = 112;
export const STEP_S = 60 / INTRO_BPM / 4;
export const BAR_S = STEP_S * 16;
export const LOOP_BARS = 8;
/** Bed level under the ambience master — modest, so future bird SFX and speech sit on top. */
export const INTRO_BED_LEVEL = 0.4;

export type IntroVoice = 'bass' | 'comp' | 'pad' | 'mel' | 'shaker';

export interface ScoreNote {
  voice: IntroVoice;
  /** 16th-note step within the bar (0–15). */
  step: number;
  /** MIDI note (ignored for the shaker). */
  midi: number;
  /** Length in 16th steps. */
  dur: number;
  /** 0–1 */
  vel: number;
}

interface Chord {
  name: string;
  root: number;
  fifth: number;
  voicing: number[];
}

/** Dmaj9 · Bm9 · Em9 · A13 · F♯m7 · Bm9 · Gmaj9 · A13 — warm, unhurried, resolves home. */
export const INTRO_PROGRESSION: Chord[] = [
  { name: 'Dmaj9', root: 38, fifth: 45, voicing: [54, 57, 61, 64] },
  { name: 'Bm9', root: 35, fifth: 42, voicing: [57, 61, 62, 66] },
  { name: 'Em9', root: 40, fifth: 47, voicing: [55, 59, 62, 66] },
  { name: 'A13', root: 33, fifth: 40, voicing: [55, 59, 61, 66] },
  { name: 'F#m7', root: 42, fifth: 49, voicing: [52, 57, 61, 64] },
  { name: 'Bm9', root: 35, fifth: 42, voicing: [57, 61, 62, 66] },
  { name: 'Gmaj9', root: 43, fifth: 50, voicing: [54, 57, 59, 62] },
  { name: 'A13', root: 33, fifth: 40, voicing: [55, 59, 61, 66] },
];

/** Whistled line, one phrase per bar: [step, midi, dur]. Chord tones / tensions only. */
const MELODY: [number, number, number][][] = [
  [
    [6, 76, 4],
    [10, 78, 6],
  ],
  [
    [0, 73, 8],
    [10, 74, 4],
    [14, 76, 2],
  ],
  [
    [0, 78, 6],
    [6, 74, 4],
    [10, 71, 6],
  ],
  [
    [2, 73, 4],
    [6, 76, 10],
  ],
  [
    [6, 73, 4],
    [10, 76, 6],
  ],
  [
    [0, 74, 6],
    [8, 73, 4],
    [12, 69, 4],
  ],
  [
    [0, 71, 8],
    [10, 74, 6],
  ],
  [[2, 73, 12]],
];

/** Two-bar bossa comping figure (16th steps). */
const COMP: number[][] = [
  [0, 3, 6, 10, 12],
  [2, 6, 8, 11, 14],
];

export function introBar(index: number): ScoreNote[] {
  const bar = ((index % LOOP_BARS) + LOOP_BARS) % LOOP_BARS;
  const loop = Math.floor(index / LOOP_BARS);
  const chord = INTRO_PROGRESSION[bar]!;
  const out: ScoreNote[] = [];

  for (const m of chord.voicing) out.push({ voice: 'pad', step: 0, midi: m, dur: 16, vel: 0.9 });

  out.push({ voice: 'bass', step: 0, midi: chord.root, dur: 6, vel: 1 });
  out.push({ voice: 'bass', step: 8, midi: chord.fifth, dur: 6, vel: 0.85 });
  out.push({ voice: 'bass', step: 14, midi: chord.root + 12, dur: 2, vel: 0.55 });

  COMP[bar % 2]!.forEach((step, i) => {
    const vel = i === 0 ? 0.95 : 0.7 + ((i * 37) % 5) * 0.05;
    for (const m of chord.voicing) out.push({ voice: 'comp', step, midi: m, dur: 3, vel });
  });

  for (let step = 0; step < 16; step += 2) out.push({ voice: 'shaker', step, midi: 0, dur: 1, vel: step % 4 === 2 ? 1 : 0.55 });

  // The whistle rests every third loop so the bed breathes.
  if (loop % 3 !== 2) for (const [step, midi, dur] of MELODY[bar]!) out.push({ voice: 'mel', step, midi, dur, vel: 1 });
  return out;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function whiteNoise(ctx: BaseAudioContext, seconds = 0.5) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(g: GainNode, when: number, attack: number, peak: number, end: number) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
}

/** Nylon-string pluck: triangle + soft octave, filter closes as it decays. */
function nylon(ctx: BaseAudioContext, dest: AudioNode, freq: number, when: number, dur: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  o2.detune.value = 5;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.28;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(2600, when);
  f.frequency.exponentialRampToValueAtTime(700, when + dur * 0.7);
  const g = ctx.createGain();
  env(g, when, 0.005, peak, when + dur);
  o.connect(f);
  o2.connect(o2g).connect(f);
  f.connect(g).connect(dest);
  o.start(when);
  o2.start(when);
  o.stop(when + dur + 0.05);
  o2.stop(when + dur + 0.05);
}

/** Rhodes-ish pad: sine + faint bell partial, slow swell, gone by the next chord. */
function rhodes(ctx: BaseAudioContext, dest: AudioNode, freq: number, when: number, dur: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const bell = ctx.createOscillator();
  bell.type = 'sine';
  bell.frequency.value = freq * 3.01;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.18, when);
  bg.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.18);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, when + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.25);
  o.connect(g);
  bell.connect(bg).connect(g);
  g.connect(dest);
  o.start(when);
  bell.start(when);
  o.stop(when + dur + 0.3);
  bell.stop(when + dur + 0.3);
}

function bass(ctx: BaseAudioContext, dest: AudioNode, freq: number, when: number, dur: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.35;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 520;
  const g = ctx.createGain();
  env(g, when, 0.012, peak, when + dur);
  o.connect(f);
  o2.connect(o2g).connect(f);
  f.connect(g).connect(dest);
  o.start(when);
  o2.start(when);
  o.stop(when + dur + 0.05);
  o2.stop(when + dur + 0.05);
}

function shaker(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, when: number, peak: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 7200;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  env(g, when, 0.008, peak, when + 0.07);
  src.connect(f).connect(g).connect(dest);
  src.start(when, Math.random() * 0.4);
  src.stop(when + 0.09);
}

/** Soft whistle with a gentle delayed vibrato. */
function whistle(ctx: BaseAudioContext, dest: AudioNode, freq: number, when: number, dur: number, peak: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, when);
  depth.gain.linearRampToValueAtTime(9, when + Math.min(0.5, dur * 0.6));
  lfo.connect(depth).connect(o.detune);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.07);
  g.gain.setValueAtTime(peak, when + Math.max(0.08, dur - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.25);
  o.connect(g).connect(dest);
  o.start(when);
  lfo.start(when);
  o.stop(when + dur + 0.3);
  lfo.stop(when + dur + 0.3);
}

const PEAK: Record<IntroVoice, number> = { bass: 0.17, comp: 0.04, pad: 0.014, mel: 0.04, shaker: 0.018 };

/** Schedule one bar starting at `when` (audio-clock seconds). Works on live and offline contexts. */
export function scheduleIntroBar(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, index: number, when: number) {
  for (const n of introBar(index)) {
    const t = when + n.step * STEP_S;
    const d = n.dur * STEP_S;
    const peak = PEAK[n.voice] * n.vel;
    if (n.voice === 'pad') rhodes(ctx, dest, hz(n.midi), t, d, peak);
    else if (n.voice === 'bass') bass(ctx, dest, hz(n.midi), t, Math.max(0.25, d), peak);
    else if (n.voice === 'comp') {
      // Thumb-down strum: low → high, a few ms apart.
      const spread = (n.midi % 12) * 0.0012;
      nylon(ctx, dest, hz(n.midi), t + spread, Math.max(0.5, d * 1.6), peak);
    } else if (n.voice === 'shaker') shaker(ctx, dest, noise, t + (n.step % 4 === 2 ? 0.006 : 0), peak);
    else whistle(ctx, dest, hz(n.midi), t, d, peak);
  }
}

/** Look-ahead sequencer: call `tick()` every ~250 ms; it keeps ~1.2 s of music queued. */
export class IntroMusic {
  private bar = 0;
  private next: number;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly dest: AudioNode,
    startAt = ctx.currentTime + 0.1,
  ) {
    this.noise = whiteNoise(ctx);
    this.next = startAt;
  }

  tick(lookahead = 1.2) {
    const now = this.ctx.currentTime;
    // Throttled background tab: skip what was missed instead of bursting it all at once.
    if (this.next < now - 0.05) this.next = now + 0.05;
    while (this.next < now + lookahead) {
      scheduleIntroBar(this.ctx, this.dest, this.noise, this.bar++, this.next);
      this.next += BAR_S;
    }
  }
}
