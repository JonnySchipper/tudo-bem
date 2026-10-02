import type { FloorKind, RoomId } from '@tudobem/shared';
import { INTRO_BED_LEVEL, IntroMusic } from './audio/introBed';
import { FOOTSTEPS, SILENT_MIX, stepPitch, type ZoneMix } from './audio/zones';
import { playBoutSfx, type BoutSfx } from './audio/boutSfx';

/**
 * Room beds made in Web Audio — no samples, no paid service.
 * Intro: a soft late-afternoon bossa for the title beat + sign-in card (see audio/introBed).
 * Praça: wind, a quiet pentatonic pluck, and the audio zones (traffic near the streets, the fountain, birds by day, crickets at night,
 * rain by weather, a distant radio near the houses), mixed by the local player's position (see audio/zones). Footsteps per terrain.
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
  /** Praça only: one gain per zone layer, driven by the listener's position. */
  zones?: ZoneLayers;
}

interface ZoneLayers {
  gains: Record<keyof ZoneMix, GainNode>;
  /** the last mix: the note and chirp schedulers read it to stay quiet when a layer is far away */
  mix: ZoneMix;
}

/** How loud each layer is at full presence (the bed's own wind sits at 0.05). */
const ZONE_LEVEL: Record<keyof ZoneMix, number> = { traffic: 0.16, fountain: 0.11, birds: 1, crickets: 1, rain: 0.15, radio: 1 };
const ZONE_TAU = 0.35;

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

function whiteBuffer(ctx: AudioContext, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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

/** A short noise swoosh through a band-pass sweep: a car going by, far away. */
function swoosh(ctx: AudioContext, dest: AudioNode, white: AudioBuffer, when: number, from: number, to: number, dur: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = white;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(from, when);
  f.frequency.exponentialRampToValueAtTime(to, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(when);
  src.stop(when + dur + 0.05);
}

/**
 * The Praça's zone layers (audio/zones): each has its own gain node that `Ambience.listen` moves with the player's position.
 * Continuous layers (traffic hum, fountain, rain) are noise through filters; the event layers (birds, crickets, the radio, cars passing)
 * are scheduled and skip themselves when their layer is far away.
 */
function buildZones(ctx: AudioContext, dest: GainNode, bed: Bed, brown: AudioBuffer, keep: (...nodes: AudioNode[]) => void) {
  const white = whiteBuffer(ctx);
  const mk = () => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(dest);
    keep(g);
    return g;
  };
  const gains = { traffic: mk(), fountain: mk(), birds: mk(), crickets: mk(), rain: mk(), radio: mk() };
  const mix: ZoneMix = { ...SILENT_MIX };
  bed.zones = { gains, mix };

  // traffic: a low rumble with a slow swell, and now and then a car going by
  keep(...loopNoise(ctx, gains.traffic, brown, 210, 'lowpass', 0.9, 0.6));
  keep(...loopNoise(ctx, gains.traffic, brown, 640, 'bandpass', 0.25, 0.5));
  schedule(bed, () => {
    if (mix.traffic < 0.08 || Math.random() > 0.7) return;
    const up = Math.random() > 0.5;
    swoosh(ctx, gains.traffic, white, ctx.currentTime + 0.02, up ? 260 : 800, up ? 800 : 260, 2.6 + Math.random() * 1.6, 0.5);
  }, 3600);

  // fountain: a hiss of falling water with a burble
  const water = loopNoise(ctx, gains.fountain, white, 2600, 'bandpass', 0.55, 0.5);
  keep(...water);
  const fountainGain = water[2];
  keep(...loopNoise(ctx, gains.fountain, white, 900, 'highpass', 0.18, 0.4));
  const burble = ctx.createOscillator();
  const burbleDepth = ctx.createGain();
  burble.frequency.value = 0.9;
  burbleDepth.gain.value = 0.16;
  burble.connect(burbleDepth);
  burbleDepth.connect((fountainGain as GainNode).gain);
  burble.start();
  keep(burble, burbleDepth);

  // rain on the ground: hiss plus a soft drumming
  keep(...loopNoise(ctx, gains.rain, white, 4200, 'bandpass', 0.6, 0.4));
  keep(...loopNoise(ctx, gains.rain, brown, 420, 'lowpass', 0.7, 0.5));

  // birds (day): the old chirps, now more of them and only where and when the birds are
  schedule(bed, () => {
    if (Math.random() > mix.birds * 1.4) return;
    const f = 1700 + Math.random() * 1500;
    chirp(ctx, gains.birds, f, ctx.currentTime + 0.02);
    if (Math.random() > 0.45) chirp(ctx, gains.birds, f * 1.2, ctx.currentTime + 0.16);
    if (Math.random() > 0.7) chirp(ctx, gains.birds, f * 0.9, ctx.currentTime + 0.32);
  }, 1900);

  // crickets (night): bursts of three pulses on a high carrier
  let side = 0;
  schedule(bed, () => {
    if (mix.crickets < 0.04) return;
    const f = (side++ % 2 ? 4150 : 4450) * (0.98 + Math.random() * 0.04);
    for (let k = 0; k < 3; k++) {
      const when = ctx.currentTime + 0.02 + k * 0.07;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.011, when + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, when + 0.055);
      o.connect(g);
      g.connect(gains.crickets);
      o.start(when);
      o.stop(when + 0.07);
    }
  }, 380);

  // a radio behind a window: telephone-band bossa, faint, with static
  const radioBand = ctx.createBiquadFilter();
  radioBand.type = 'bandpass';
  radioBand.frequency.value = 1300;
  radioBand.Q.value = 0.8;
  radioBand.connect(gains.radio);
  keep(radioBand);
  keep(...loopNoise(ctx, gains.radio, white, 2200, 'bandpass', 0.012, 0.6));
  const tune = [293.7, 349.2, 440, 392, 349.2, 329.6, 293.7, 261.6, 293.7, 329.6, 349.2, 293.7];
  let n = 0;
  schedule(bed, () => {
    if (mix.radio < 0.03) return;
    const i = n++ % tune.length;
    if (i % 4 === 3 && Math.random() > 0.5) return;
    pluck(ctx, radioBand, tune[i]!, ctx.currentTime + 0.03, 0.5, 0.05);
    if (i % 2 === 0) pluck(ctx, radioBand, tune[i]! / 2, ctx.currentTime + 0.03, 0.6, 0.035);
  }, 430);
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
    buildZones(ctx, gain, bed, buf, keep);
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
  private zoneMix: ZoneMix = SILENT_MIX;
  private lastStepAt = 0;
  private whiteBuf: AudioBuffer | null = null;
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

  /** The zone mix at the local player's position (audio/zones.zoneMix); silent mix outside the outdoor map. Cheap: call it a few times a second. */
  listen(mix: ZoneMix) {
    this.zoneMix = mix;
    const ctx = this.ctx;
    const z = this.bed?.zones;
    if (!ctx || !z) return;
    const t = ctx.currentTime;
    Object.assign(z.mix, mix);
    for (const k of Object.keys(z.gains) as (keyof ZoneMix)[]) {
      const g = z.gains[k].gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(mix[k] * ZONE_LEVEL[k], t, ZONE_TAU);
    }
  }

  /** One quiet footstep on a floor of the given kind, pitch within 5%. Honors the music switch and the speech ducking (it goes through the same duck gain). */
  step(kind: FloorKind, rand = Math.random()) {
    const ctx = this.ctx;
    if (!ctx || !this.bedIn || !this.enabled || !this.unlocked || ctx.state !== 'running' || this.scene) return;
    const now = ctx.currentTime;
    if (now - this.lastStepAt < 0.11) return;
    this.lastStepAt = now;
    const p = FOOTSTEPS[kind];
    const rate = stepPitch(rand);
    this.whiteBuf ??= whiteBuffer(ctx, 1);
    const src = ctx.createBufferSource();
    src.buffer = this.whiteBuf;
    src.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter();
    filter.type = p.filter;
    filter.frequency.value = p.freq * rate;
    filter.Q.value = p.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bedIn);
    src.start(now, Math.random() * 0.5);
    src.stop(now + p.dur + 0.03);
    if (p.thump) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(p.thump * rate, now);
      o.frequency.exponentialRampToValueAtTime(p.thump * rate * 0.6, now + p.dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(p.gain * 0.9, now + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, now + p.dur + 0.02);
      o.connect(og);
      og.connect(this.bedIn);
      o.start(now);
      o.stop(now + p.dur + 0.05);
    }
  }

  /** One bout sound effect (mat slap, crowd, whistle...). Silent until the browser lets the context run; goes through the same duck gain as the beds. */
  sfx(kind: BoutSfx) {
    const ctx = this.ctx;
    if (!ctx || !this.bedIn || !this.unlocked || ctx.state !== 'running') return;
    this.whiteBuf ??= whiteBuffer(ctx, 1);
    try {
      playBoutSfx(ctx, this.bedIn, this.whiteBuf, kind);
    } catch {
      /* an effect must never break the game */
    }
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
    // the three open-air areas (rua, praça, feira) share one outdoor bed, so walking between them never restarts the music
    return this.unlocked ? (this.room === 'rua' || this.room === 'feira' ? 'praca' : this.room) : null;
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
    // a new Praça bed starts at the listener's current mix instead of fading up from silence
    const z = this.bed.zones;
    if (z) {
      Object.assign(z.mix, this.zoneMix);
      for (const k of Object.keys(z.gains) as (keyof ZoneMix)[]) z.gains[k].gain.value = this.zoneMix[k] * ZONE_LEVEL[k];
    }
    if (prev) stopBed(this.ctx, prev, fadeOutPrev);
  }
}

export const ambience = new Ambience();
