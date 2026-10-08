/**
 * The band: instruments and drums made in Web Audio (no samples, no paid service). Plucked strings are Karplus-Strong buffers
 * rendered once per pitch, keys are FM, the whistle and flute have breath, the accordion and the brass are filtered saws.
 * Everything goes through a `Rig`: pan per voice, a shared room reverb and a gentle compressor, so a bar of the theme sounds like
 * players in a room and not like a stack of oscillators. Works on live and offline contexts.
 */
import type { Voice } from './theme';

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * A gain node for an envelope: silent until its automation starts. (A fresh GainNode sits at 1.0, and automation that starts
 * between two samples only takes hold on the next one, so the first sample of a hit used to pass at full gain: a click.)
 */
export function vca(ctx: BaseAudioContext): GainNode {
  const g = ctx.createGain();
  g.gain.value = 0;
  return g;
}

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

export type Inst = 'guitar' | 'cavaco' | 'epiano' | 'vibes' | 'box' | 'bell' | 'whistle' | 'flute' | 'clar' | 'felt' | 'strings' | 'accordion' | 'sanfona' | 'bass' | 'stab';

export interface Rig {
  readonly ctx: BaseAudioContext;
  /** every node the rig made, so a bed can disconnect them */
  readonly nodes: AudioNode[];
  readonly dry: AudioNode;
  readonly send: AudioNode | null;
  /** the tempo-synced echo send (leads only), or null */
  readonly echo: AudioNode | null;
  readonly noise: AudioBuffer;
  readonly ks: Map<string, { buf: AudioBuffer; rate: number }>;
}

const irCache = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Plucked-string buffers are shared by every rig of a context, so a room change does not re-render them. */
const ksCache = new WeakMap<BaseAudioContext, Map<string, { buf: AudioBuffer; rate: number }>>();

/**
 * A warm wooden room: a handful of early reflections (different left and right, so the band has width), then a smooth tail
 * that darkens as it decays. Generated once per context.
 */
function roomImpulse(ctx: BaseAudioContext): AudioBuffer {
  const hit = irCache.get(ctx);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const seconds = 2.4;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * 0.018);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng(1234 + c * 77);
    // early reflections: 7 taps between 9 and 70 ms, each a short smoothed click
    for (let k = 0; k < 7; k++) {
      const at = Math.floor(sr * (0.009 + 0.061 * r()));
      const amp = (0.55 - k * 0.06) * (r() > 0.5 ? 1 : -1);
      for (let i = 0; i < 24 && at + i < len; i++) d[at + i]! += amp * Math.exp(-i / 5);
    }
    // tail: noise through a low-pass that closes over time, an exponential (-60 dB at ~2 s) with a soft onset
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const k = 0.5 * Math.exp(-t * 1.4) + 0.04;
      lp += (r() * 2 - 1 - lp) * k;
      const env = Math.exp(-t * 3.3) * Math.min(1, t / 0.035);
      d[i]! += lp * env * 0.9;
    }
  }
  // normalise the energy so the send level means the same thing whatever the impulse
  let e = 0;
  for (let c = 0; c < 2; c++) for (const v of buf.getChannelData(c)) e += v * v;
  const norm = 1 / Math.sqrt(e / 2);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i]! *= norm * 0.5;
  }
  irCache.set(ctx, buf);
  return buf;
}

export interface RigOptions {
  /** 0 = dry (a radio speaker), 1 = the room */
  reverb?: number;
  level?: number;
  /** tempo of the music, for the echo (a dotted-eighth / quarter ping-pong); 0 = no echo */
  bpm?: number;
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
  // The bus EQ: clear the rumble, take a little mud out of the low mids, round off the very top. No compressor here: the
  // levels are set by hand (scripts/audio-lab.mjs measures them) and the one limiter is on the master (ambience.ts).
  const hp = keep(ctx.createBiquadFilter());
  hp.type = 'highpass';
  hp.frequency.value = 38;
  hp.Q.value = 0.6;
  const mud = keep(ctx.createBiquadFilter());
  mud.type = 'peaking';
  mud.frequency.value = 260;
  mud.Q.value = 0.9;
  mud.gain.value = -2.5;
  const air = keep(ctx.createBiquadFilter());
  air.type = 'highshelf';
  air.frequency.value = 8500;
  air.gain.value = -2;
  hp.connect(mud);
  mud.connect(air);
  air.connect(out);
  const dry = keep(ctx.createGain());
  dry.connect(hp);
  let send: AudioNode | null = null;
  const wetAmount = opts.reverb ?? 1;
  if (wetAmount > 0) {
    const conv = keep(ctx.createConvolver());
    conv.normalize = false;
    conv.buffer = roomImpulse(ctx);
    const wet = keep(ctx.createGain());
    wet.gain.value = 0.42 * wetAmount;
    conv.connect(wet);
    wet.connect(hp);
    send = keep(ctx.createGain());
    send.connect(conv);
  }
  let echo: AudioNode | null = null;
  if (opts.bpm && wetAmount > 0) {
    // ping-pong: a dotted eighth on the left, a quarter on the right, darker every repeat, into the reverb as well
    const beat = 60 / opts.bpm;
    const inG = keep(ctx.createGain());
    const dl = keep(ctx.createDelay(2));
    const dr = keep(ctx.createDelay(2));
    dl.delayTime.value = beat * 0.75;
    dr.delayTime.value = beat;
    const tone = keep(ctx.createBiquadFilter());
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    const lowcut = keep(ctx.createBiquadFilter());
    lowcut.type = 'highpass';
    lowcut.frequency.value = 300;
    const fb = keep(ctx.createGain());
    fb.gain.value = 0.3;
    const merger = keep(ctx.createChannelMerger(2));
    const ret = keep(ctx.createGain());
    ret.gain.value = 0.5;
    inG.connect(lowcut);
    lowcut.connect(tone);
    tone.connect(dl);
    tone.connect(dr);
    dl.connect(merger, 0, 0);
    dr.connect(merger, 0, 1);
    dr.connect(fb);
    fb.connect(tone);
    merger.connect(ret);
    ret.connect(hp);
    if (send) ret.connect(send);
    echo = inG;
  }
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
  const nd = noise.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  let ks = ksCache.get(ctx);
  if (!ks) ksCache.set(ctx, (ks = new Map()));
  return { ctx, nodes, dry, send, echo, noise, ks };
}

/** A voice's way into the rig: gain → pan → dry, plus a reverb send and (for the leads) an echo send. */
function strip(rig: Rig, pan: number, sendAmt: number, gain = 1, echoAmt = 0): GainNode {
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
  if (rig.echo && echoAmt > 0) {
    const e = ctx.createGain();
    e.gain.value = echoAmt;
    tail.connect(e);
    e.connect(rig.echo);
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
  const g = vca(ctx);
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
  const o2g = vca(ctx);
  o2g.gain.setValueAtTime(0.18, when);
  o2g.gain.exponentialRampToValueAtTime(0.01, when + 0.9);
  const bell = ctx.createOscillator();
  bell.type = 'sine';
  bell.frequency.value = f * 3.01;
  const bg = vca(ctx);
  bg.gain.setValueAtTime(0.14, when);
  bg.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
  const g = vca(ctx);
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
  const mg = vca(ctx);
  mg.gain.setValueAtTime(f * 1.5, when);
  mg.gain.exponentialRampToValueAtTime(f * 0.12, when + 0.7);
  mod.connect(mg);
  mg.connect(car.frequency);
  const tine = ctx.createOscillator();
  tine.type = 'sine';
  tine.frequency.value = f * 14;
  const tg = vca(ctx);
  tg.gain.setValueAtTime(0.0001, when);
  tg.gain.exponentialRampToValueAtTime(0.06, when + 0.003);
  tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
  const g = vca(ctx);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.006);
  g.gain.exponentialRampToValueAtTime(peak * 0.4, when + 0.45);
  g.gain.setTargetAtTime(0.0001, when + Math.max(0.2, dur), 0.18);
  car.connect(g);
  tine.connect(tg);
  tg.connect(g);
  g.connect(strip(rig, pan, 0.5, 1, 0.16));
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
  am.connect(strip(rig, pan, 0.5, 1, 0.1));
  lfo.start(when);
  lfo.stop(when + 3);
  const life = Math.max(1.1, dur * 0.9);
  for (const [ratio, amp, d] of parts) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = vca(ctx);
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
  const out = strip(rig, pan, 0.6, 1, glass > 1 ? 0.12 : 0.2);
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
    const g = vca(ctx);
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
  const depth = vca(ctx);
  depth.gain.setValueAtTime(0, when);
  depth.gain.linearRampToValueAtTime(flute ? 12 : 9, when + Math.min(0.5, dur * 0.6));
  lfo.connect(depth);
  depth.connect(o.detune);
  const g = vca(ctx);
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
  const ng = vca(ctx);
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(peak * (flute ? 0.32 : 0.18), when + att);
  ng.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.2);
  n.connect(nf);
  nf.connect(ng);
  const dest = strip(rig, pan, 0.5, 1, flute ? 0.16 : 0.22);
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
  const depth = vca(ctx);
  depth.gain.setValueAtTime(0, when);
  depth.gain.linearRampToValueAtTime(7, when + 0.4);
  lfo.connect(depth);
  depth.connect(o.detune);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const g = vca(ctx);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.035);
  g.gain.setValueAtTime(peak * 0.8, when + Math.max(0.05, dur - 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.12);
  o.connect(lp);
  lp.connect(g);
  g.connect(strip(rig, pan, 0.35, 1, 0.08));
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
  const g = vca(ctx);
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

/**
 * Sanfona (the forró accordion played as a lead): three reeds a few cents apart, the musette beating that makes it sound like a
 * sanfona and not an organ, a reedy formant, and a bellows push at the start of each note. Quick enough to chop chords with.
 */
function sanfona(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(Math.min(5200, f * 6), when);
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 1250;
  body.Q.value = 1.1;
  body.gain.value = 4;
  const g = vca(ctx);
  const att = 0.022;
  const end = Math.max(att + 0.04, dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak * 1.15, when + att);
  g.gain.exponentialRampToValueAtTime(peak * 0.85, when + att + 0.09);
  g.gain.setValueAtTime(peak * 0.85, when + end - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + end + 0.09);
  const oscs: OscillatorNode[] = [];
  for (const [type, cents, amp] of [
    ['sawtooth', 0, 0.6],
    ['square', -11, 0.4],
    ['square', 12, 0.4],
  ] as [OscillatorType, number, number][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = cents;
    const a = ctx.createGain();
    a.gain.value = amp;
    o.connect(a);
    a.connect(lp);
    oscs.push(o);
  }
  lp.connect(body);
  body.connect(g);
  g.connect(strip(rig, pan, 0.28, 1, 0.05));
  for (const o of oscs) {
    o.start(when);
    o.stop(when + end + 0.12);
  }
}

/** Upright bass: a Karplus-Strong string with a sine underneath for weight. */
function uprightBass(rig: Rig, midi: number, when: number, dur: number, peak: number) {
  const { ctx } = rig;
  stringNote(rig, 'bass', midi, when, Math.max(0.3, dur), peak * 1.1, -0.05, 700, 0.05);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  const g = vca(ctx);
  ramp(g.gain, when, 0.012, peak * 0.4, 0.012, Math.max(0.3, dur) + 0.1);
  o.connect(g);
  g.connect(strip(rig, -0.05, 0));
  o.start(when);
  o.stop(when + Math.max(0.3, dur) + 0.15);
}

/** A brass section hit: saws and a square an octave down, a short swell rather than a snap, the filter opening with it. */
function stab(rig: Rig, f: number, when: number, dur: number, peak: number, pan: number) {
  const { ctx } = rig;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(420, when);
  lp.frequency.exponentialRampToValueAtTime(1900, when + 0.07);
  lp.frequency.exponentialRampToValueAtTime(1100, when + Math.max(0.15, dur));
  const g = vca(ctx);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.028);
  g.gain.setValueAtTime(peak * 0.75, when + Math.max(0.06, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.14);
  for (const [type, ratio, cents, amp] of [
    ['sawtooth', 1, -8, 1],
    ['sawtooth', 1, 8, 1],
    ['square', 0.5, 0, 0.35],
  ] as [OscillatorType, number, number, number][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * ratio;
    o.detune.value = cents;
    const a = ctx.createGain();
    a.gain.value = amp;
    o.connect(a);
    a.connect(lp);
    o.start(when);
    o.stop(when + dur + 0.2);
  }
  lp.connect(g);
  g.connect(strip(rig, pan, 0.35, 1, 0.06));
}

/** One pitched note. `peak` already includes velocity and the voice's level. */
export function playInst(rig: Rig, inst: Inst, midi: number, when: number, dur: number, vel: number) {
  const f = hz(midi);
  const pan = Math.max(-0.7, Math.min(0.7, (midi - 62) / 40));
  switch (inst) {
    case 'guitar':
      return stringNote(rig, 'nylon', midi, when + (midi % 12) * 0.0011, Math.max(0.5, dur * 1.6), 0.2 * vel, -0.25 + pan * 0.3, 2700, 0.32);
    case 'cavaco':
      return stringNote(rig, 'cavaco', midi, when + (midi % 12) * 0.0009, Math.max(0.3, dur), 0.17 * vel, 0.3 + pan * 0.2, 5200, 0.25);
    case 'epiano':
      return epiano(rig, f, when, dur, 0.09 * vel, pan * 0.5);
    case 'vibes':
      return vibes(rig, f, when, dur, 0.17 * vel, 0.2 + pan * 0.3);
    case 'box':
      return box(rig, f, when, dur, 0.1 * vel, pan * 0.4);
    case 'bell':
      return box(rig, f, when, dur, 0.075 * vel, 0.3 + pan * 0.4, 1.25);
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
    case 'sanfona':
      return sanfona(rig, f, when, dur, 0.08 * vel, -0.15 + pan * 0.4);
    case 'bass':
      return uprightBass(rig, midi, when, dur, 0.34 * vel);
    case 'stab':
      return stab(rig, f, when, dur, 0.1 * vel, 0.05);
  }
}

// ---------------------------------------------------------------- percussion

export type Drum = 'shaker' | 'clave' | 'surdo' | 'brush' | 'pandeiro' | 'zabumba' | 'triangle';

function noiseHit(rig: Rig, when: number, type: BiquadFilterType, freq: number, q: number, attack: number, end: number, peak: number, pan: number, send = 0.2) {
  const { ctx } = rig;
  const src = ctx.createBufferSource();
  src.buffer = rig.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = vca(ctx);
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
  const g = vca(ctx);
  ramp(g.gain, when, 0.006, peak, 0.006, dur);
  o.connect(g);
  g.connect(strip(rig, pan, send));
  o.start(when);
  o.stop(when + dur + 0.03);
}

export function playDrum(rig: Rig, drum: Drum, when: number, vel: number, gain = 1) {
  switch (drum) {
    case 'shaker':
      return noiseHit(rig, when, 'bandpass', 7200, 1.2, 0.008, 0.075, 0.03 * vel * gain, 0.4, 0.15);
    case 'brush':
      return noiseHit(rig, when, 'bandpass', 5200, 0.5, 0.02, 0.12, 0.028 * vel * gain, -0.4, 0.2);
    case 'clave':
      // a cross-stick: a woody tick and a short click of noise
      sineHit(rig, when, 1850, 1500, 0.045, 0.07 * vel * gain, -0.35, 0.3);
      return noiseHit(rig, when, 'bandpass', 2600, 2, 0.002, 0.03, 0.05 * vel * gain, -0.35, 0.3);
    case 'surdo':
      sineHit(rig, when, 96, 52, 0.34, 0.3 * vel * gain, 0, 0.1);
      return noiseHit(rig, when, 'lowpass', 260, 0.8, 0.004, 0.05, 0.1 * vel * gain, 0, 0);
    case 'pandeiro':
      // jingles, and on the accents a slap of the skin
      noiseHit(rig, when, 'bandpass', 6800, 0.8, 0.003, 0.1, 0.032 * vel * gain, 0.45, 0.2);
      if (vel >= 0.7) sineHit(rig, when, 210, 130, 0.07, 0.07 * vel * gain, 0.45, 0.15);
      return;
    case 'zabumba':
      // accents are the mallet on the big skin (a boom with a slap on top), soft hits the bacalhau stick on the other side
      if (vel >= 0.6) {
        sineHit(rig, when, 128, 62, 0.28, 0.26 * vel * gain, -0.1, 0.1);
        return noiseHit(rig, when, 'lowpass', 420, 0.8, 0.003, 0.05, 0.08 * vel * gain, -0.1, 0.05);
      }
      return noiseHit(rig, when, 'bandpass', 3200, 1.6, 0.002, 0.035, 0.1 * vel * gain, -0.2, 0.15);
    case 'triangle': {
      // three inharmonic partials; open (accents) rings, choked (soft) is just the tick
      const ring = vel >= 0.7 ? 0.32 : 0.035;
      for (const [fq, amp] of [
        [4180, 1],
        [6370, 0.6],
        [8890, 0.35],
      ] as [number, number][]) {
        const o = rig.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = fq;
        const g = vca(rig.ctx);
        ramp(g.gain, when, 0.002, 0.018 * amp * vel * gain, 0.002, ring);
        o.connect(g);
        g.connect(strip(rig, 0.5, 0.2));
        o.start(when);
        o.stop(when + ring + 0.03);
      }
      return;
    }
  }
}

// ---------------------------------------------------------------- voice → instrument

/** Which instrument plays a voice of the score; a mood or an arrangement can swap any of them. */
export const VOICE_INST: Record<Exclude<Voice, Drum>, Inst> = {
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
  sanfona: 'sanfona',
  pife: 'flute',
};

/**
 * The band's balance, in dB, with the tune on top: bass and the strummed guitar under it, pads further back, the percussion a
 * texture. Measured per voice with `node scripts/audio-lab.mjs stems intro`; each arrangement can trim it (sequencer `MIX`).
 */
export const VOICE_DB: Record<Voice, number> = {
  mel: 2,
  lead: 5,
  harm: -1,
  box: 6,
  clar: 0,
  stab: 0,
  bass: -6.5,
  comp: -8,
  cavaco: -4,
  arp: -1.5,
  pad: 0.5,
  accordion: -4,
  bell: 3,
  surdo: -2.5,
  clave: 3.5,
  shaker: 14,
  brush: 12,
  pandeiro: 12,
  sanfona: 2,
  pife: 2,
  zabumba: 0,
  triangle: 6,
};

const PERC: ReadonlySet<Voice> = new Set<Voice>(['shaker', 'clave', 'surdo', 'brush', 'pandeiro', 'zabumba', 'triangle']);

/** One note of the score. `trimDb` is the arrangement's own adjustment for this voice. */
export function playVoice(rig: Rig, voice: Voice, midi: number, when: number, dur: number, vel: number, swap?: Partial<Record<Voice, Inst>>, trimDb = 0) {
  const gain = Math.pow(10, (VOICE_DB[voice] + trimDb) / 20);
  if (PERC.has(voice)) return playDrum(rig, voice as Drum, when, vel, gain);
  const inst = swap?.[voice] ?? VOICE_INST[voice as keyof typeof VOICE_INST];
  playInst(rig, inst, midi, when, dur, vel * gain);
}
