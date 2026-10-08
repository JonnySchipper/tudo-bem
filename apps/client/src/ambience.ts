import { feiraOpen, type FloorKind, type RoomId } from '@tudobem/shared';
import { Conductor } from './audio/conductor';
import { DUCK, STING_DIP, XFADE_TAU, createMaster, levels } from './audio/mix';
import { playSting, ThemeSequencer } from './audio/sequencer';
import { createRig, vca, type Rig } from './audio/synth';
import { ARRANGEMENTS, padariaIsNight, type ArrangementKind, type StingKind } from './audio/theme';
import { FOOTSTEPS, SILENT_MIX, stepPitch, type ZoneMix } from './audio/zones';
import { playBoutSfx, type BoutSfx } from './audio/boutSfx';
import { playCorreriaSfx, type CorreriaSfx } from './audio/correriaSfx';
import { DIARY_SFX, playDiarySfx, type DiarySfx } from './audio/diarySfx';

const CORRERIA_SFX = ['grab', 'sizzle', 'ready', 'burnt', 'pop', 'pour', 'glug', 'ding', 'clink', 'chain', 'cash', 'paper', 'chime', 'nope', 'combo', 'tick', 'slap', 'sigh', 'juicer'] as const;

/**
 * Room beds made in Web Audio — no samples, no paid service.
 * One tune runs through all of it: "Tudo Bem" (audio/theme), played by the band in audio/synth.
 * Intro: the whole theme, a 32-bar bossa that builds when the sign-in card arrives.
 * Praça: wind, phrases of the theme by time of day and weather (audio/conductor), and the audio zones (traffic near the streets, the fountain, birds by day, crickets at night,
 * rain by weather, a distant radio near the houses), mixed by the local player's position (see audio/zones). Footsteps per terrain.
 * Padaria: a choro-ish take on the theme in G, a slow vibes version at night, with the murmur and the coffee machine.
 * Kitnet: a music box plays the first eight bars, room tone and a slow fan under it.
 * Academia: a soft samba pulse with the hook; the bout swaps it for a batucada and brass stabs on the hook.
 * Feira (06:00-13:00, while it is open): "Baião da Feira", the theme's forró cousin, over the crowd and the outdoor zones; closed, it is the Praça's bed.
 * Stingers (recado, heart, RV, mission, Caderno, win, lose, the padaria door) are fragments of the same tune.
 * Every level comes from audio/mix (measured loudness targets), and everything goes through one master limiter.
 * Unlocks on the first gesture, crossfades on room change (each bed picks its tune up where it left it), ducks under speech.
 */

type Source = AudioBufferSourceNode | OscillatorNode;
type Scene = 'intro' | 'bout';
type BedId = RoomId | Scene | 'padariaNight';

/** A bed that comes back within this long picks its tune up where it left it; after that it starts from the top. */
const RESUME_MS = 90_000;

interface Resume {
  bar: number;
  at: number;
}

interface Bed {
  gain: GainNode;
  sources: Source[];
  nodes: AudioNode[];
  timers: number[];
  /** Intro only: the tone filter that opens when the sign-in card arrives. */
  tone?: BiquadFilterNode;
  /** Praça only: one gain per zone layer, driven by the listener's position. */
  zones?: ZoneLayers;
  /** The looping arrangement (intro, padaria, kitnet, academia, bout) and the Praça radio's. */
  seq?: ThemeSequencer;
}

export interface World {
  minute: number;
  rain: number;
}

interface ZoneLayers {
  gains: Record<keyof ZoneMix, GainNode>;
  /** the last mix: the note and chirp schedulers read it to stay quiet when a layer is far away */
  mix: ZoneMix;
}

/** How loud each layer is at full presence (the bed's own wind sits at 0.05). */
const ZONE_LEVEL: Record<keyof ZoneMix, number> = { traffic: 0.16, fountain: 0.035, birds: 1, crickets: 1, rain: 0.07, radio: 1 };
const ZONE_TAU = 0.35;

/** Seconds a bed takes to fade out (about four crossfade time constants). */
const FADE = XFADE_TAU * 4;
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

function chirp(ctx: AudioContext, dest: AudioNode, freq: number, when: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, when);
  o.frequency.exponentialRampToValueAtTime(freq * 1.4, when + 0.09);
  const g = vca(ctx);
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
  const g = vca(ctx);
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
  const water = loopNoise(ctx, gains.fountain, white, 2600, 'bandpass', 0.32, 0.5);
  keep(...water);
  const fountainGain = water[2];
  keep(...loopNoise(ctx, gains.fountain, white, 900, 'highpass', 0.1, 0.4));
  const burble = ctx.createOscillator();
  const burbleDepth = ctx.createGain();
  burble.frequency.value = 0.9;
  burbleDepth.gain.value = 0.16;
  burble.connect(burbleDepth);
  burbleDepth.connect((fountainGain as GainNode).gain);
  burble.start();
  keep(burble, burbleDepth);

  // rain on the ground: hiss plus a soft drumming
  keep(...loopNoise(ctx, gains.rain, white, 3400, 'bandpass', 0.6, 0.3));
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
      const g = vca(ctx);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.011, when + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, when + 0.055);
      o.connect(g);
      g.connect(gains.crickets);
      o.start(when);
      o.stop(when + 0.07);
    }
  }, 380);

  // a radio behind a window: the theme again, telephone-band, with static
  const radioBand = ctx.createBiquadFilter();
  radioBand.type = 'bandpass';
  radioBand.frequency.value = 1300;
  radioBand.Q.value = 0.8;
  radioBand.connect(gains.radio);
  keep(radioBand);
  keep(...loopNoise(ctx, gains.radio, white, 2200, 'bandpass', 0.012, 0.6));
  const radio = new ThemeSequencer(ctx, radioBand, 'radio', { reverb: 0, level: levels.bed('radio'), startBar: 8 * Math.floor(Math.random() * 4) });
  keep(...radio.nodes);
  bed.timers.push(window.setInterval(() => radio.tick(1.4, mix.radio >= 0.03), 250));
}

function schedule(bed: Bed, fn: () => void, ms: number) {
  const id = window.setTimeout(function tick() {
    fn();
    const next = window.setTimeout(tick, ms);
    bed.timers.push(next);
  }, ms);
  bed.timers.push(id);
}

function buildBed(ctx: AudioContext, dest: AudioNode, room: BedId, world: () => World, resume: (kind: ArrangementKind) => number): Bed {
  const gain = vca(ctx);
  const now = ctx.currentTime;
  const intro = room === 'intro';
  gain.gain.setValueAtTime(0, now);
  // A slow swell for the intro so it never arrives at full level; the rooms overlap the one they replace.
  gain.gain.setTargetAtTime(1, now + (intro ? 0.2 : 0.05), intro ? INTRO_FADE_IN / 3 : XFADE_TAU);
  gain.connect(dest);
  const bed: Bed = { gain, sources: [], nodes: [gain], timers: [] };
  const buf = noiseBuffer(ctx);
  const keep = (...nodes: AudioNode[]) => {
    for (const n of nodes) {
      bed.nodes.push(n);
      if ('start' in n) bed.sources.push(n as Source);
    }
  };
  const band = (kind: Exclude<ArrangementKind, 'radio'>, dst: AudioNode, boost = 0) => {
    const seq = new ThemeSequencer(ctx, dst, kind, { level: levels.bed(kind), boost, startAt: now + 0.15, startBar: resume(kind) });
    keep(...seq.nodes);
    seq.tick();
    bed.timers.push(window.setInterval(() => seq.tick(), 250));
    bed.seq = seq;
    return seq;
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
    keep(...loopNoise(ctx, gain, buf, 520, 'lowpass', 0.006, 0.5));
    band('intro', tone);
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
    // phrases of the theme drift over the square, by the hour and the weather
    const rig: Rig = createRig(ctx, gain, { bpm: 104 });
    keep(...rig.nodes);
    const conductor = new Conductor(rig, world, () => bed.zones?.mix.radio ?? 0);
    bed.timers.push(window.setInterval(() => conductor.tick(), 1000));
    buildZones(ctx, gain, bed, buf, keep);
  } else if (room === 'feira') {
    // the market: a breeze, the crowd between the stalls, the trio playing at the end of the aisle, and the outdoor zones (birds, rain)
    keep(...loopNoise(ctx, gain, buf, 700, 'lowpass', 0.035, 0.6));
    keep(...loopNoise(ctx, gain, buf, 520, 'bandpass', 0.03, 0.9));
    band('feira', gain);
    buildZones(ctx, gain, bed, buf, keep);
  } else if (room === 'padaria' || room === 'padariaNight') {
    // the room: a murmur and, now and then, the coffee machine
    keep(...loopNoise(ctx, gain, buf, 480, 'bandpass', room === 'padaria' ? 0.035 : 0.018, 0.8));
    band(room, gain);
    if (room === 'padaria')
      schedule(bed, () => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200;
        filter.Q.value = 4;
        const g = vca(ctx);
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
  } else if (room === 'academia') {
    keep(...loopNoise(ctx, gain, buf, 300, 'lowpass', 0.03, 0.5));
    band('academia', gain);
  } else if (room === 'bout') {
    keep(...loopNoise(ctx, gain, buf, 300, 'lowpass', 0.02, 0.5));
    band('bout', gain);
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
    band('kitnet', gain);
  }
  return bed;
}

function stopBed(ctx: AudioContext, bed: Bed, fade = FADE) {
  const t = ctx.currentTime;
  bed.gain.gain.cancelScheduledValues(t);
  bed.gain.gain.setValueAtTime(bed.gain.gain.value, t);
  // an exponential tail: most of the level goes in the first second, the last of it drifts out under the next bed
  bed.gain.gain.setTargetAtTime(0, t, fade / 4);
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
  }, fade * 1500 + 80);
}

class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private zoneMix: ZoneMix = SILENT_MIX;
  private lastStepAt = 0;
  private whiteBuf: AudioBuffer | null = null;
  private bedIn: GainNode | null = null;
  /** dips the beds while a stinger plays */
  private dip: GainNode | null = null;
  private resume = new Map<ArrangementKind, Resume>();
  private room: RoomId | null = null;
  private scene: Scene | null = null;
  private world: World = { minute: 720, rain: 0 };
  private stingRig: Rig | null = null;
  private lastSting = new Map<StingKind, number>();
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
    // beds → sting dip → speech duck → master (limiter); stingers, footsteps and bout effects join after the dip
    this.master = createMaster(ctx, ctx.destination).input;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = this.ducked ? DUCK.level : 1;
    this.dip = ctx.createGain();
    this.bedIn = ctx.createGain();
    this.bedIn.connect(this.dip);
    this.dip.connect(this.duckGain);
    this.duckGain.connect(this.master);
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
  setScene(scene: Scene | null) {
    if (this.scene === scene) return;
    const leaving = (this.playing === 'intro' || this.playing === 'bout') && scene !== this.playing;
    this.scene = scene;
    if (scene && this.enabled) this.ensureContext()?.resume().catch(() => {});
    this.sync(leaving ? INTRO_FADE_OUT : FADE);
  }

  /** Sign-in card arrived: open the intro bed's tone (title beat reads a touch distant). */
  introReveal() {
    const tone = this.playing === 'intro' ? this.bed?.tone : undefined;
    if (!tone || !this.ctx) return;
    this.bed?.seq?.setBoost(1);
    const t = this.ctx.currentTime;
    tone.frequency.cancelScheduledValues(t);
    tone.frequency.setValueAtTime(tone.frequency.value, t);
    tone.frequency.setTargetAtTime(INTRO_TONE_OPEN, t + 0.1, 0.9);
  }

  setRoom(room: RoomId) {
    const changed = this.room !== room;
    const first = this.room === null;
    this.room = room;
    if (changed || this.playing !== this.target()) this.sync();
    // the bell over the padaria door is the first two notes of the theme's family
    if (changed && !first && room === 'padaria') this.sting('door');
  }

  /** The game clock and the rain, a few times a second: the Praça's phrases follow the hour, the padaria changes shift at 22:00, the feira opens and packs up. */
  setWorld(w: World) {
    this.world = w;
    if ((this.room === 'padaria' || this.room === 'feira') && !this.scene && this.playing !== this.target()) this.sync();
  }

  /** The band plays harder: a finishing chance in the bout. */
  setBoost(n: number) {
    this.bed?.seq?.setBoost(n);
  }

  /** A short fragment of the theme for a moment that deserves one (a recado done, a heart, a win). Honors the music switch and the speech ducking. */
  sting(kind: StingKind) {
    const ctx = this.ctx;
    if (!ctx || !this.bedIn || !this.enabled || !this.unlocked || ctx.state !== 'running' || this.scene === 'intro') return;
    const now = ctx.currentTime;
    if (now - (this.lastSting.get(kind) ?? -9) < (kind === 'coin' ? 1.2 : 0.4)) return;
    this.lastSting.set(kind, now);
    try {
      this.stingRig ??= createRig(ctx, this.duckGain ?? this.bedIn, { bpm: 112 });
      // in the key of whatever is playing (the padaria plays the tune in G), and the bed steps back while it sounds
      const key = this.playing && this.playing in ARRANGEMENTS ? ARRANGEMENTS[this.playing as ArrangementKind].transpose : 0;
      const secs = playSting(this.stingRig, kind, now + 0.03, key === 0 ? 0 : key - 12, levels.sting(kind));
      const d = this.dip?.gain;
      if (d && kind !== 'coin' && kind !== 'door') {
        d.cancelScheduledValues(now);
        d.setValueAtTime(d.value, now);
        d.setTargetAtTime(STING_DIP, now, 0.06);
        d.setTargetAtTime(1, now + secs, 0.5);
      }
    } catch {
      /* a sting must never break the game */
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem('tb_music', on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
    if (on && this.scene) this.ensureContext()?.resume().catch(() => {});
    this.sync(this.playing === 'intro' || this.playing === 'bout' ? INTRO_FADE_OUT : FADE);
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
    const g = vca(ctx);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.duckGain ?? this.bedIn);
    src.start(now, Math.random() * 0.5);
    src.stop(now + p.dur + 0.03);
    if (p.thump) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(p.thump * rate, now);
      o.frequency.exponentialRampToValueAtTime(p.thump * rate * 0.6, now + p.dur);
      const og = vca(ctx);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(p.gain * 0.9, now + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, now + p.dur + 0.02);
      o.connect(og);
      og.connect(this.duckGain ?? this.bedIn);
      o.start(now);
      o.stop(now + p.dur + 0.05);
    }
  }

  /** One bout sound effect (mat slap, crowd, whistle...). Silent until the browser lets the context run; goes through the same duck gain as the beds. */
  sfx(kind: BoutSfx | CorreriaSfx | DiarySfx) {
    const ctx = this.ctx;
    if (!ctx || !this.bedIn || !this.unlocked || ctx.state !== 'running') return;
    this.whiteBuf ??= whiteBuffer(ctx, 1);
    try {
      const out = this.duckGain ?? this.bedIn;
      if ((DIARY_SFX as readonly string[]).includes(kind)) playDiarySfx(ctx, out, this.whiteBuf, kind as DiarySfx);
      else if ((CORRERIA_SFX as readonly string[]).includes(kind)) playCorreriaSfx(ctx, out, this.whiteBuf, kind as CorreriaSfx);
      else playBoutSfx(ctx, out, this.whiteBuf, kind as BoutSfx);
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
    g.setTargetAtTime(on ? DUCK.level : 1, t, on ? DUCK.attack : DUCK.release);
  }

  private target(): BedId | null {
    if (!this.enabled) return null;
    if (this.scene) return this.scene;
    if (!this.unlocked) return null;
    // the open-air areas share one outdoor bed, so walking between them never restarts the music; the feira has its own while it is open
    if (this.room === 'feira') return feiraOpen(this.world.minute) ? 'feira' : 'praca';
    if (this.room === 'rua' || this.room === 'rua_leste') return 'praca';
    if (this.room === 'escola') return 'kitnet';
    return this.room === 'padaria' && padariaIsNight(this.world.minute) ? 'padariaNight' : this.room;
  }

  private sync(fade = FADE) {
    const next = this.target();
    if (!next) return this.halt(fade);
    if (this.playing !== next) this.play(next, fade);
  }

  /** Remember where a bed's tune was, so coming back continues it (from the next four-bar phrase). */
  private remember(bed: Bed | null, id: BedId | null) {
    if (!bed?.seq || !id || id === 'praca') return;
    this.resume.set(id as ArrangementKind, { bar: bed.seq.position, at: performance.now() });
  }

  private resumeBar(kind: ArrangementKind): number {
    const r = this.resume.get(kind);
    if (!r || performance.now() - r.at > RESUME_MS) return 0;
    return (Math.ceil(r.bar / 4) * 4) % ARRANGEMENTS[kind].loopBars;
  }

  private halt(fade = FADE) {
    this.remember(this.bed, this.playing);
    if (this.ctx && this.bed) stopBed(this.ctx, this.bed, fade);
    this.bed = null;
    this.playing = null;
  }

  private play(id: BedId, fadeOutPrev = FADE) {
    if (!this.ctx || !this.bedIn) return;
    const prev = this.bed;
    this.remember(prev, this.playing);
    this.bed = buildBed(this.ctx, this.bedIn, id, () => this.world, (k) => this.resumeBar(k));
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
