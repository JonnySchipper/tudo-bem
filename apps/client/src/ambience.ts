import type { RoomId } from '@tudobem/shared';
import { INTRO_BED_LEVEL, IntroMusic } from './audio/introBed';

/**
 * Room beds made in Web Audio — no samples, no paid service.
 * Intro: a soft late-afternoon bossa for the title beat + sign-in card (see audio/introBed).
 * Praça: wind, distant birds, a quiet pentatonic pluck.
 * Padaria: warm drone, murmur, a soft counter rhythm.
 * Kitnet: room tone and a slow fan.
 * Unlocks on the first gesture, crossfades on room change, ducks under speech.
 */

type Source = AudioBufferSourceNode | OscillatorNode;
type BedId = RoomId | 'intro';

interface Bed {
  gain: GainNode;
  sources: Source[];
  nodes: AudioNode[];
  timers: number[];
  /** Intro only: the tone filter that opens when the sign-in card arrives. */
  tone?: BiquadFilterNode;
}

const FADE = 0.7;
const INTRO_FADE_IN = 3.2;
const INTRO_FADE_OUT = 1.6;
/** Title beat sounds a little distant; the card arrival opens it up. */
const INTRO_TONE_TITLE = 1100;
const INTRO_TONE_OPEN = 5200;

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[i] = brown * 3.2;
  }
  return buf;
}

function loopNoise(ctx: AudioContext, dest: GainNode, buf: AudioBuffer, freq: number, type: BiquadFilterType, gain: number, q = 0.7): [Source, AudioNode, AudioNode] {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start();
  return [src, filter, g];
}

function tone(ctx: AudioContext, dest: GainNode, freq: number, type: OscillatorType, gain: number): [OscillatorNode, GainNode] {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g);
  g.connect(dest);
  o.start();
  return [o, g];
}

function pluck(ctx: AudioContext, dest: AudioNode, freq: number, when: number, dur: number, gain: number) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(dest);
  o.start(when);
  o.stop(when + dur + 0.05);
}

function chirp(ctx: AudioContext, dest: AudioNode, freq: number, when: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, when);
  o.frequency.exponentialRampToValueAtTime(freq * 1.4, when + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.018, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
  o.connect(g);
  g.connect(dest);
  o.start(when);
  o.stop(when + 0.16);
}

function schedule(bed: Bed, fn: () => void, ms: number) {
  const id = window.setTimeout(function tick() {
    fn();
    const next = window.setTimeout(tick, ms);
    bed.timers.push(next);
  }, ms);
  bed.timers.push(id);
}

function buildBed(ctx: AudioContext, dest: AudioNode, room: BedId): Bed {
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const intro = room === 'intro';
  gain.gain.setValueAtTime(0, now);
  // Exponential-feeling swell for the intro so it never arrives at full level.
  if (intro) gain.gain.setTargetAtTime(INTRO_BED_LEVEL, now + 0.2, INTRO_FADE_IN / 3);
  else gain.gain.linearRampToValueAtTime(1, now + FADE);
  gain.connect(dest);
  const bed: Bed = { gain, sources: [], nodes: [gain], timers: [] };
  const buf = noiseBuffer(ctx);
  const keep = (...nodes: AudioNode[]) => {
    for (const n of nodes) {
      bed.nodes.push(n);
      if ('start' in n) bed.sources.push(n as Source);
    }
  };

  if (intro) {
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = INTRO_TONE_TITLE;
    tone.Q.value = 0.5;
    tone.connect(gain);
    bed.tone = tone;
    keep(tone);
    // A breath of Praça air under the band.
    keep(...loopNoise(ctx, gain, buf, 520, 'lowpass', 0.014, 0.5));
    const music = new IntroMusic(ctx, tone, now + 0.15);
    music.tick();
    bed.timers.push(window.setInterval(() => music.tick(), 250));
  } else if (room === 'praca') {
    keep(...loopNoise(ctx, gain, buf, 700, 'lowpass', 0.05, 0.6));
    const wind = bed.nodes.at(-1) as GainNode;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.07;
    depth.gain.value = 0.015;
    lfo.connect(depth);
    depth.connect(wind.gain);
    lfo.start();
    keep(lfo, depth);
    const notes = [392, 440, 494, 587, 659, 494, 440];
    let i = 0;
    schedule(bed, () => pluck(ctx, gain, notes[i++ % notes.length]!, ctx.currentTime + 0.05, 1.4, 0.028), 1600);
    schedule(bed, () => {
      const f = 1700 + Math.random() * 1500;
      chirp(ctx, gain, f, ctx.currentTime + 0.02);
      if (Math.random() > 0.45) chirp(ctx, gain, f * 1.2, ctx.currentTime + 0.16);
    }, 4200);
  } else if (room === 'padaria') {
    keep(...tone(ctx, gain, 146.8, 'sine', 0.03));
    keep(...tone(ctx, gain, 220, 'sine', 0.018));
    keep(...loopNoise(ctx, gain, buf, 480, 'bandpass', 0.035, 0.8));
    const notes = [294, 370, 440, 370, 330, 294, 440, 494];
    let i = 0;
    schedule(bed, () => pluck(ctx, gain, notes[i++ % notes.length]!, ctx.currentTime + 0.05, 0.9, 0.03), 900);
    schedule(bed, () => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 4;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(filter);
      filter.connect(g);
      g.connect(gain);
      src.start(t);
      src.stop(t + 0.09);
    }, 5400);
  } else {
    keep(...loopNoise(ctx, gain, buf, 280, 'lowpass', 0.04, 0.5));
    const [fan, fanGain] = tone(ctx, gain, 62, 'sine', 0.02);
    keep(fan, fanGain);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 4.2;
    depth.gain.value = 0.008;
    lfo.connect(depth);
    depth.connect(fanGain.gain);
    lfo.start();
    keep(lfo, depth);
    const notes = [196, 247, 294, 247];
    let i = 0;
    schedule(bed, () => pluck(ctx, gain, notes[i++ % notes.length]!, ctx.currentTime + 0.05, 2.2, 0.016), 2400);
  }
  return bed;
}

function stopBed(ctx: AudioContext, bed: Bed, fade = FADE) {
  const t = ctx.currentTime;
  bed.gain.gain.cancelScheduledValues(t);
  bed.gain.gain.setValueAtTime(bed.gain.gain.value, t);
  bed.gain.gain.linearRampToValueAtTime(0, t + fade);
  window.setTimeout(() => {
    for (const id of bed.timers) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    for (const src of bed.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of bed.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  }, fade * 1000 + 80);
}

class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private bedIn: GainNode | null = null;
  private room: RoomId | null = null;
  private scene: 'intro' | null = null;
  private playing: BedId | null = null;
  private bed: Bed | null = null;
  private unlocked = false;
  private ducked = false;
  private listeners = new Set<() => void>();
  enabled = typeof localStorage !== 'undefined' && localStorage.getItem('tb_music') !== 'off';

  /** Audible right now (the browser has let the context run). */
  get running() {
    return this.ctx?.state === 'running';
  }

  /** Notified when enabled / running changes (intro music toggle). */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = this.ducked ? 0.18 : 1;
    this.bedIn = ctx.createGain();
    this.bedIn.connect(this.duckGain);
    this.duckGain.connect(this.master);
    this.master.connect(ctx.destination);
    ctx.addEventListener('statechange', () => this.emit());
    return ctx;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.unlocked) {
      // A silent buffer inside the gesture is what iOS needs to open the output.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start();
    }
    ctx.resume().catch(() => {});
    this.unlocked = true;
    if (this.ducked) this.duck(true);
    this.sync();
  }

  /**
   * Scene beds outrank the room bed. The intro may start before any gesture: if the
   * browser blocks autoplay the context waits suspended and the swell begins on unlock.
   */
  setScene(scene: 'intro' | null) {
    if (this.scene === scene) return;
    const leaving = this.playing === 'intro' && scene !== 'intro';
    this.scene = scene;
    if (scene && this.enabled) this.ensureContext()?.resume().catch(() => {});
    this.sync(leaving ? INTRO_FADE_OUT : FADE);
  }

  /** Sign-in card arrived: open the intro bed's tone (title beat reads a touch distant). */
  introReveal() {
    const tone = this.playing === 'intro' ? this.bed?.tone : undefined;
    if (!tone || !this.ctx) return;
    const t = this.ctx.currentTime;
    tone.frequency.cancelScheduledValues(t);
    tone.frequency.setValueAtTime(tone.frequency.value, t);
    tone.frequency.setTargetAtTime(INTRO_TONE_OPEN, t + 0.1, 0.9);
  }

  setRoom(room: RoomId) {
    const changed = this.room !== room;
    this.room = room;
    if (changed || this.playing !== this.target()) this.sync();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem('tb_music', on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
    if (on && this.scene) this.ensureContext()?.resume().catch(() => {});
    this.sync(this.playing === 'intro' ? INTRO_FADE_OUT : FADE);
    this.emit();
  }

  duck(on: boolean) {
    this.ducked = on;
    const g = this.duckGain?.gain;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 0.18 : 1, t + 0.12);
  }

  private target(): BedId | null {
    if (!this.enabled) return null;
    if (this.scene) return this.scene;
    return this.unlocked ? this.room : null;
  }

  private sync(fade = FADE) {
    const next = this.target();
    if (!next) return this.halt(fade);
    if (this.playing !== next) this.play(next, fade);
  }

  private halt(fade = FADE) {
    if (this.ctx && this.bed) stopBed(this.ctx, this.bed, fade);
    this.bed = null;
    this.playing = null;
  }

  private play(id: BedId, fadeOutPrev = FADE) {
    if (!this.ctx || !this.bedIn) return;
    const prev = this.bed;
    this.bed = buildBed(this.ctx, this.bedIn, id);
    this.playing = id;
    if (prev) stopBed(this.ctx, prev, fadeOutPrev);
  }
}

export const ambience = new Ambience();
