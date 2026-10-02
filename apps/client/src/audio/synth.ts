/**
 * The band: instruments and drums made in Web Audio (no samples, no paid service). Plucked strings are Karplus-Strong buffers
 * rendered once per pitch, keys are FM, the whistle and flute have breath, the accordion and the brass are filtered saws.
 * Everything goes through a `Rig`: pan per voice, a shared room reverb and a gentle compressor, so a bar of the theme sounds like
 * players in a room and not like a stack of oscillators. Works on live and offline contexts.
 */
import type { Voice } from './theme';

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Inst = 'guitar' | 'cavaco' | 'epiano' | 'vibes' | 'box' | 'bell' | 'whistle' | 'flute' | 'clar' | 'felt' | 'strings' | 'accordion' | 'bass' | 'stab';

export interface Rig {
  readonly ctx: BaseAudioContext;
  /** every node the rig made, so a bed can disconnect them */
  readonly nodes: AudioNode[];
  readonly dry: AudioNode;
  readonly send: AudioNode | null;
  readonly noise: AudioBuffer;
  readonly ks: Map<string, { buf: AudioBuffer; rate: number }>;
}

const irCache = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Plucked-string buffers are shared by every rig of a context, so a room change does not re-render them. */
const ksCache = new WeakMap<BaseAudioContext, Map<string, { buf: AudioBuffer; rate: number }>>();

/** A small warm room: stereo noise with an exponential tail that darkens as it decays. */
function roomImpulse(ctx: BaseAudioContext): AudioBuffer {
  const hit = irCache.get(ctx);
  if (hit) return hit;
  const seconds = 2.1;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng(1234 + c * 77);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.55 - 0.45 * t;
      lp += (r() * 2 - 1 - lp) * k;
      const pre = i < ctx.sampleRate * 0.012 ? 0 : 1;
      d[i] = lp * Math.pow(1 - t, 3.2) * pre * (i < 400 ? i / 400 : 1);
    }
  }
  irCache.set(ctx, buf);
  return buf;
}

export interface RigOptions {
  /** 0 = dry (a radio speaker), 1 = the room */
  reverb?: number;
  level?: number;
}

export function createRig(ctx: BaseAudioContext, dest: AudioNode, opts: RigOptions = {}): Rig {
  const nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const out = keep(ctx.createGain());
  out.gain.value = opts.level ?? 1;
  out.connect(dest);
  const comp = keep(ctx.createDynamicsCompressor());
  comp.threshold.value = -20;
  comp.knee.value = 14;
  comp.ratio.value = 3;
  comp.attack.value = 0.012;
  comp.release.value = 0.3;
  comp.connect(out);
  const dry = keep(ctx.createGain());
  dry.connect(comp);
  let send: AudioNode | null = null;
  const wetAmount = opts.reverb ?? 1;
  if (wetAmount > 0) {
    const conv = keep(ctx.createConvolver());
    conv.buffer = roomImpulse(ctx);
    const wet = keep(ctx.createGain());
    wet.gain.value = 0.55 * wetAmount;
    conv.connect(wet);
    wet.connect(comp);
    send = keep(ctx.createGain());
    send.connect(conv);
  }
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
  const nd = noise.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  let ks = ksCache.get(ctx);
  if (!ks) ksCache.set(ctx, (ks = new Map()));
  return { ctx, nodes, dry, send, noise, ks };
}

/** A voice's way into the rig: gain → pan → dry + a reverb send. */
function strip(rig: Rig, pan: number, sendAmt: number, gain = 1): GainNode {
  const { ctx } = rig;
  const g = ctx.createGain();
  g.gain.value = gain;
  let tail: AudioNode = g;
  if ('createStereoPanner' in ctx) {
    const p = (ctx as BaseAudioContext & { createStereoPanner(): StereoPannerNode }).createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    tail = p;
  }
  tail.connect(rig.dry);
  if (rig.send && sendAmt > 0) {
    const s = ctx.createGain();
    s.gain.value = sendAmt;
    tail.connect(s);
    s.connect(rig.send);
  }
  return g;
}

function ramp(g: AudioParam, when: number, attack: number, peak: number, hold: number, end: number) {
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  if (hold > attack) g.setValueAtTime(Math.max(0.0002, peak), when + hold);
  g.exponentialRampToValueAtTime(0.0001, when + end);
}

// ---------------------------------------------------------------- Karplus-Strong strings

type KsKind = 'nylon' | 'cavaco' | 'bass';

function ksBuffer(rig: Rig, midi: number, kind: KsKind): { buf: AudioBuffer; rate: number } {
  const key = `${kind}:${midi}`;
  const hit = rig.ks.get(key);
  if (hit) return hit;
  const { ctx } = rig;
  const sr = ctx.sampleRate;
  const f = hz(midi);
  const N = Math.max(4, Math.round(sr / f - 0.5));
  const actual = sr / (N + 0.5);
  const seconds = kind === 'bass' ? 1.6 : kind === 'cavaco' ? 0.9 : Math.max(0.9, 2.2 - (midi - 40) * 0.02);
  const len = Math.floor(sr * seconds);
  const out = new Float32Array(len);
  const line = new Float32Array(N);
  const r = rng(midi * 31 + kind.length);
  // pluck: noise, smoothed more for the warmer instruments
  let prev = 0;
  const smooth = kind === 'nylon' ? 0.45 : kind === 'bass' ? 0.2 : 0.7;
  for (let i = 0; i < N; i++) {
    prev += (r() * 2 - 1 - prev) * smooth;
    line[i] = prev;
  }
  const decay = kind === 'bass' ? 0.9985 : kind === 'cavaco' ? 0.9968 : 0.9972;
  let idx = 0;
  let lastOut = 0;
  for (let i = 0; i < len; i++) {
    const a = line[idx]!;
    const b = line[(idx + 1) % N]!;
    const v = (a + b) * 0.5 * decay;
    line[idx] = v;
    idx = (idx + 1) % N;
    // a touch of one-pole low-pass on the output is the instrument body
    lastOut += (a - lastOut) * (kind === 'bass' ? 0.25 : 0.55);
    out[i] = lastOut;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const gain = peak > 0 ? 1 / peak : 1;
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < len; i++) d[i] = out[i]! * gain * (i > len - fade ? (len - i) / fade : 1);
  const made = { buf, rate: f / actual };
  rig.ks.set(key, made);
  return made;
}

function stringNote(rig: Rig, kind: KsKind, midi: number, when: number, dur: number, peak: number, pan: number, tone: number, send: number) {
  const { ctx } = rig;
  const { buf, rate } = ksBuffer(rig, midi, kind);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = tone;
  f.Q.value = 0.5;
  const g = ctx.createGain();
  const ring = Math.max(0.25, dur * 1.5);
  g.gain.setValueAtTime(peak, when);
  g.gain.setTargetAtTime(0.0001, when + ring * 0.6, ring * 0.35);
  src.connect(f);
  f.connect(g);
  g.connect(strip(rig, pan, send));
  src.start(when);
  src.stop(when + Math.min(buf.duration, ring * 2.2 + 0.3));
}

// ---------------------------------------------------------------- the instruments

/** Soft sustained tone with a decaying bell partial: the felt piano / pad of the original bed, now with a stereo pair. */
function felt(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = f * 2.003;
  const o2g = ctx.createGain();
  o2g.gain.setValueAtTime(0.18, when);
  o2g.gain.exponentialRampToValueAtTime(0.01, when + 0.9);
  const bell = ctx.createOscillator();
  bell.type = 'sine';
  bell.frequency.value = f * 3.01;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.14, when);
  bg.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.16);
  g.gain.exponentialRampToValueAtTime(peak * 0.55, when + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.3);
  o.connect(g);
  o2.connect(o2g);
  o2g.connect(g);
  bell.connect(bg);
  bg.connect(g);
  g.connect(strip(rig, pan, 0.5));
  for (const x of [o, o2, bell]) {
    x.start(when);
    x.stop(when + dur + 0.35);
  }
}

/** FM electric piano: a decaying modulation index gives the bark then the bell. */
function epiano(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = f;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.5, when);
  mg.gain.exponentialRampToValueAtTime(f * 0.12, when + 0.7);
  mod.connect(mg);
  mg.connect(car.frequency);
  const tine = ctx.createOscillator();
  tine.type = 'sine';
  tine.frequency.value = f * 14;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, when);
  tg.gain.exponentialRampToValueAtTime(0.06, when + 0.003);
  tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.006);
  g.gain.exponentialRampToValueAtTime(peak * 0.4, when + 0.45);
  g.gain.setTargetAtTime(0.0001, when + Math.max(0.2, dur), 0.18);
  car.connect(g);
  tine.connect(tg);
  tg.connect(g);
  g.connect(strip(rig, pan, 0.55));
  for (const x of [car, mod, tine]) {
    x.start(when);
    x.stop(when + dur + 1.4);
  }
}

/** Vibraphone / marimba-ish bar: a fundamental, a 4× partial that dies fast, and the motor tremolo. */
function vibes(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const parts: [number, number, number][] = [
    [1, 1, 1.6],
    [4.02, 0.22, 0.45],
    [10.1, 0.06, 0.09],
  ];
  const sum = ctx.createGain();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.6;
  const depth = ctx.createGain();
  depth.gain.value = 0.18;
  const am = ctx.createGain();
  am.gain.value = 0.82;
  lfo.connect(depth);
  depth.connect(am.gain);
  sum.connect(am);
  am.connect(strip(rig, pan, 0.6));
  lfo.start(when);
  lfo.stop(when + 3);
  const life = Math.max(1.1, dur * 0.9);
  for (const [ratio, amp, d] of parts) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak * amp, when + 0.004);
    g.gain.setTargetAtTime(0.0001, when + 0.02, (d * life) / 4);
    o.connect(g);
    g.connect(sum);
    o.start(when);
    o.stop(when + life + 1);
  }
}

/** Music box / celesta: bright sine partials, no sustain, a long glassy ring. */
function box(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number, glass = 1) {
  const { ctx } = rig;
  const out = strip(rig, pan, 0.75);
  const parts: [number, number, number][] = [
    [1, 1, 1.5],
    [2, 0.3, 1],
    [3.01, 0.12, 0.6],
    [5.4, 0.07 * glass, 0.18],
  ];
  const life = Math.max(1.2, dur * 0.8);
  for (const [ratio, amp, d] of parts) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak * amp, when + 0.003);
    g.gain.setTargetAtTime(0.0001, when + 0.01, (d * life) / 4);
    o.connect(g);
    g.connect(out);
    o.start(when);
    o.stop(when + life + 1);
  }
}

/** Whistle (breathy, with a scoop into the note and a late vibrato) and flute (same idea, rounder). */
function breath(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number, flute: boolean) {
  const { ctx } = rig;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.985, when);
  o.frequency.exponentialRampToValueAtTime(f, when + 0.07);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = flute ? 5.6 : 5.2;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, when);
  depth.gain.linearRampToValueAtTime(flute ? 12 : 9, when + Math.min(0.5, dur * 0.6));
  lfo.connect(depth);
  depth.connect(o.detune);
  const g = ctx.createGain();
  const att = flute ? 0.09 : 0.06;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + att);
  g.gain.setValueAtTime(peak, when + Math.max(att + 0.01, dur - 0.18));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.25);
  o.connect(g);
  if (flute) {
    const h2 = ctx.createOscillator();
    h2.type = 'sine';
    h2.frequency.value = f * 2;
    const h2g = ctx.createGain();
    h2g.gain.value = 0.16;
    h2.connect(h2g);
    h2g.connect(g);
    h2.start(when);
    h2.stop(when + dur + 0.3);
  }
  // breath
  const n = ctx.createBufferSource();
  n.buffer = rig.noise;
  n.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = Math.min(9000, f * 3);
  nf.Q.value = 2.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(peak * (flute ? 0.32 : 0.18), when + att);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.2);
  n.connect(nf);
  nf.connect(ng);
  const dest = strip(rig, pan, 0.6);
  g.connect(dest);
  ng.connect(dest);
  o.start(when);
  lfo.start(when);
  n.start(when);
  for (const x of [o, lfo, n]) x.stop(when + dur + 0.3);
}

let clarWave: WeakMap<BaseAudioContext, PeriodicWave> | null = null;
/** Clarinet: odd harmonics only, rolled off. */
function clar(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  clarWave ??= new WeakMap();
  let wave = clarWave.get(ctx);
  if (!wave) {
    const re = new Float32Array(12);
    const im = new Float32Array(12);
    for (const [h, a] of [[1, 1], [3, 0.55], [5, 0.3], [7, 0.16], [9, 0.08]] as [number, number][]) im[h] = a;
    wave = ctx.createPeriodicWave(re, im);
    clarWave.set(ctx, wave);
  }
  const o = ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.value = f;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, when);
  depth.gain.linearRampToValueAtTime(7, when + 0.4);
  lfo.connect(depth);
  depth.connect(o.detune);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.035);
  g.gain.setValueAtTime(peak * 0.8, when + Math.max(0.05, dur - 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.12);
  o.connect(lp);
  lp.connect(g);
  g.connect(strip(rig, pan, 0.35));
  o.start(when);
  lfo.start(when);
  o.stop(when + dur + 0.2);
  lfo.stop(when + dur + 0.2);
}

/** Two detuned saws through a slowly opening low-pass: a string pad, or with `reedy` an accordion with its bellows tremolo. */
function sawPad(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number, reedy: boolean) {
  const { ctx } = rig;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(reedy ? 700 : 450, when);
  lp.frequency.linearRampToValueAtTime(reedy ? 1500 : 1100, when + Math.min(dur, 1.2));
  const g = ctx.createGain();
  const att = reedy ? 0.12 : 0.5;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + att);
  g.gain.setValueAtTime(peak, when + Math.max(att + 0.01, dur - 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.5);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 1;
  const oscs: OscillatorNode[] = [];
  for (const cents of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = reedy ? 'square' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = cents;
    o.connect(lp);
    oscs.push(o);
  }
  lp.connect(lfoGain);
  lfoGain.connect(g);
  if (reedy) {
    // bellows: a slow amplitude wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const lg = ctx.createGain();
    lg.gain.value = 0.14;
    lfo.connect(lg);
    lg.connect(lfoGain.gain);
    lfo.start(when);
    lfo.stop(when + dur + 0.6);
  }
  g.connect(strip(rig, pan, reedy ? 0.3 : 0.7));
  for (const o of oscs) {
    o.start(when);
    o.stop(when + dur + 0.6);
  }
}

/** Upright bass: a Karplus-Strong string with a sine underneath for weight. */
function uprightBass(rig: Rig, midi: number, when: number, dur: number, peak: number) {
  const { ctx } = rig;
  stringNote(rig, 'bass', midi, when, Math.max(0.3, dur), peak * 1.1, -0.05, 700, 0.05);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  const g = ctx.createGain();
  ramp(g.gain, when, 0.012, peak * 0.55, 0.012, Math.max(0.3, dur) + 0.1);
  o.connect(g);
  g.connect(strip(rig, -0.05, 0));
  o.start(when);
  o.stop(when + Math.max(0.3, dur) + 0.15);
}

/** A brass stab: two saws, the filter snaps open and closes. */
function stab(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(500, when);
  lp.frequency.exponentialRampToValueAtTime(2600, when + 0.05);
  lp.frequency.exponentialRampToValueAtTime(900, when + Math.max(0.12, dur));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
  g.gain.setValueAtTime(peak * 0.8, when + Math.max(0.05, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.1);
  for (const cents of [-9, 9]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = cents;
    o.connect(lp);
    o.start(when);
    o.stop(when + dur + 0.15);
  }
  lp.connect(g);
  g.connect(strip(rig, pan, 0.25));
}

/** One pitched note. `peak` already includes velocity and the voice's level. */
export function playInst(rig: Rig, inst: Inst, midi: number, when: number, dur: number, vel: number) {
  const f = hz(midi);
  const pan = Math.max(-0.7, Math.min(0.7, (midi - 62) / 40));
  switch (inst) {
    case 'guitar':
      return stringNote(rig, 'nylon', midi, when + (midi % 12) * 0.0011, Math.max(0.5, dur * 1.6), 0.2 * vel, -0.25 + pan * 0.3, 3200, 0.45);
    case 'cavaco':
      return stringNote(rig, 'cavaco', midi, when + (midi % 12) * 0.0009, Math.max(0.3, dur), 0.17 * vel, 0.3 + pan * 0.2, 5200, 0.25);
    case 'epiano':
      return epiano(rig, f, when, dur, 0.09 * vel, pan * 0.5);
    case 'vibes':
      return vibes(rig, f, when, dur, 0.17 * vel, 0.2 + pan * 0.3);
    case 'box':
      return box(rig, f, when, dur, 0.1 * vel, pan * 0.4);
    case 'bell':
      return box(rig, f, when, dur, 0.075 * vel, 0.3 + pan * 0.4, 1.8);
    case 'whistle':
      return breath(rig, f, when, dur, 0.1 * vel, 0.1, false);
    case 'flute':
      return breath(rig, f, when, dur, 0.1 * vel, 0.1, true);
    case 'clar':
      return clar(rig, f, when, dur, 0.1 * vel, 0.1);
    case 'felt':
      return felt(rig, f, when, dur, 0.04 * vel, pan * 0.6);
    case 'strings':
      return sawPad(rig, f, when, dur, 0.017 * vel, pan * 0.7, false);
    case 'accordion':
      return sawPad(rig, f, when, dur, 0.02 * vel, pan * 0.6, true);
    case 'bass':
      return uprightBass(rig, midi, when, dur, 0.34 * vel);
    case 'stab':
      return stab(rig, f, when, dur, 0.1 * vel, 0.05);
  }
}

// ---------------------------------------------------------------- percussion

export type Drum = 'shaker' | 'clave' | 'surdo' | 'brush' | 'pandeiro';

function noiseHit(rig: Rig, when: number, type: BiquadFilterType, freq: number, q: number, attack: number, end: number, peak: number, pan: number, send = 0.2) {
  const { ctx } = rig;
  const src = ctx.createBufferSource();
  src.buffer = rig.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  ramp(g.gain, when, attack, peak, attack, end);
  src.connect(f);
  f.connect(g);
  g.connect(strip(rig, pan, send));
  src.start(when, (when * 7.31) % 0.4);
  src.stop(when + end + 0.03);
}

function sineHit(rig: Rig, when: number, f0: number, f1: number, dur: number, peak: number, pan: number, send = 0.1) {
  const { ctx } = rig;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = ctx.createGain();
  ramp(g.gain, when, 0.006, peak, 0.006, dur);
  o.connect(g);
  g.connect(strip(rig, pan, send));
  o.start(when);
  o.stop(when + dur + 0.03);
}

export function playDrum(rig: Rig, drum: Drum, when: number, vel: number) {
  switch (drum) {
    case 'shaker':
      return noiseHit(rig, when, 'bandpass', 7200, 1.2, 0.008, 0.075, 0.03 * vel, 0.4, 0.15);
    case 'brush':
      return noiseHit(rig, when, 'bandpass', 5200, 0.5, 0.02, 0.12, 0.028 * vel, -0.4, 0.2);
    case 'clave':
      // a cross-stick: a woody tick and a short click of noise
      sineHit(rig, when, 1850, 1500, 0.045, 0.07 * vel, -0.35, 0.3);
      return noiseHit(rig, when, 'bandpass', 2600, 2, 0.002, 0.03, 0.05 * vel, -0.35, 0.3);
    case 'surdo':
      sineHit(rig, when, 96, 52, 0.34, 0.3 * vel, 0, 0.1);
      return noiseHit(rig, when, 'lowpass', 260, 0.8, 0.004, 0.05, 0.1 * vel, 0, 0);
    case 'pandeiro':
      // jingles, and on the accents a slap of the skin
      noiseHit(rig, when, 'highpass', 6200, 0.7, 0.003, 0.11, 0.032 * vel, 0.5, 0.2);
      if (vel >= 0.7) sineHit(rig, when, 210, 130, 0.07, 0.07 * vel, 0.5, 0.15);
      return;
  }
}

// ---------------------------------------------------------------- voice → instrument

/** Which instrument plays a voice of the score; a mood or an arrangement can swap any of them. */
export const VOICE_INST: Record<Exclude<Voice, 'shaker' | 'clave' | 'surdo' | 'brush' | 'pandeiro'>, Inst> = {
  bass: 'bass',
  comp: 'guitar',
  pad: 'felt',
  mel: 'whistle',
  lead: 'epiano',
  harm: 'vibes',
  arp: 'guitar',
  bell: 'bell',
  box: 'box',
  cavaco: 'cavaco',
  accordion: 'accordion',
  clar: 'clar',
  stab: 'stab',
};

/** Voice-level trims so the mix sits right (the instruments' own peaks are rough). */
const VOICE_GAIN: Partial<Record<Voice, number>> = {
  comp: 0.9,
  arp: 0.55,
  pad: 1,
  mel: 1,
  harm: 0.8,
  bell: 1,
  accordion: 1,
  cavaco: 1,
};

export function playVoice(rig: Rig, voice: Voice, midi: number, when: number, dur: number, vel: number, swap?: Partial<Record<Voice, Inst>>) {
  if (voice === 'shaker' || voice === 'clave' || voice === 'surdo' || voice === 'brush' || voice === 'pandeiro') return playDrum(rig, voice, when, vel);
  const inst = swap?.[voice] ?? VOICE_INST[voice];
  playInst(rig, inst, midi, when, dur, vel * (VOICE_GAIN[voice] ?? 1));
}
