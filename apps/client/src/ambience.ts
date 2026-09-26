import type { RoomId } from '@tudobem/shared';

/**
 * Room beds made in Web Audio — no samples, no paid service.
 * Praça: wind, distant birds, a quiet pentatonic pluck.
 * Padaria: warm drone, murmur, a soft counter rhythm.
 * Kitnet: room tone and a slow fan.
 * Unlocks on the first gesture, crossfades on room change, ducks under speech.
 */

type Source = AudioBufferSourceNode | OscillatorNode;

interface Bed {
  gain: GainNode;
  sources: Source[];
  nodes: AudioNode[];
  timers: number[];
}

const FADE = 0.7;

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

function buildBed(ctx: AudioContext, dest: AudioNode, room: RoomId): Bed {
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + FADE);
  gain.connect(dest);
  const bed: Bed = { gain, sources: [], nodes: [gain], timers: [] };
  const buf = noiseBuffer(ctx);
  const keep = (...nodes: AudioNode[]) => {
    for (const n of nodes) {
      bed.nodes.push(n);
      if ('start' in n) bed.sources.push(n as Source);
    }
  };

  if (room === 'praca') {
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

function stopBed(ctx: AudioContext, bed: Bed) {
  const t = ctx.currentTime;
  bed.gain.gain.cancelScheduledValues(t);
  bed.gain.gain.setValueAtTime(bed.gain.gain.value, t);
  bed.gain.gain.linearRampToValueAtTime(0, t + FADE);
  window.setTimeout(() => {
    for (const id of bed.timers) window.clearTimeout(id);
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
  }, FADE * 1000 + 80);
}

class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private bedIn: GainNode | null = null;
  private room: RoomId | null = null;
  private playing: RoomId | null = null;
  private bed: Bed | null = null;
  private unlocked = false;
  private ducked = false;
  enabled = typeof localStorage !== 'undefined' && localStorage.getItem('tb_music') !== 'off';

  unlock() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.duckGain = this.ctx.createGain();
      this.duckGain.gain.value = 1;
      this.bedIn = this.ctx.createGain();
      this.bedIn.connect(this.duckGain);
      this.duckGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start();
    }
    void this.ctx.resume();
    this.unlocked = true;
    if (this.ducked) this.duck(true);
    if (this.enabled && this.room) this.play(this.room);
  }

  setRoom(room: RoomId) {
    const changed = this.room !== room;
    this.room = room;
    if (!this.unlocked || !this.enabled) return;
    if (changed || this.playing !== room) this.play(room);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem('tb_music', on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
    if (!on) this.halt();
    else if (this.unlocked && this.room) this.play(this.room);
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

  private halt() {
    if (this.ctx && this.bed) stopBed(this.ctx, this.bed);
    this.bed = null;
    this.playing = null;
  }

  private play(room: RoomId) {
    if (!this.ctx || !this.bedIn) return;
    void this.ctx.resume();
    const prev = this.bed;
    this.bed = buildBed(this.ctx, this.bedIn, room);
    this.playing = room;
    if (prev) stopBed(this.ctx, prev);
  }
}

export const ambience = new Ambience();
