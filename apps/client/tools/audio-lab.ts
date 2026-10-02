/**
 * Offline renders of the music for `scripts/audio-lab.mjs` (dev only, not part of the build): every bed, a stem per voice,
 * the stingers and the Praça phrases, with an integrated loudness (BS.1770-style K-weighting and gating) for each.
 */
import { createRig } from '../src/audio/synth';
import { createMaster } from '../src/audio/mix';
import { playBoutSfx, type BoutSfx } from '../src/audio/boutSfx';
import { playSting, playTimed, scheduleBar, stepSeconds } from '../src/audio/sequencer';
import { ARRANGEMENTS, MOODS, phraseNotes, scoreBar, type ArrangementKind, type Mood, type PhraseId, type StingKind, type Voice } from '../src/audio/theme';

const SR = 44100;

async function kWeighted(buf: AudioBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 38;
  hp.Q.value = 0.5;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = 1500;
  shelf.gain.value = 4;
  src.connect(hp).connect(shelf).connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

/** Integrated loudness in LUFS (400 ms blocks, 75% overlap, -70 absolute and -10 relative gates), and the loudest 400 ms block (momentary max). */
async function lufs(buf: AudioBuffer): Promise<{ i: number; m: number }> {
  const k = await kWeighted(buf);
  const block = Math.floor(0.4 * SR);
  const hop = Math.floor(block / 4);
  const powers: number[] = [];
  for (let s = 0; s + block <= k.length; s += hop) {
    let p = 0;
    for (let c = 0; c < k.numberOfChannels; c++) {
      const d = k.getChannelData(c);
      let sum = 0;
      for (let i = s; i < s + block; i++) sum += d[i]! * d[i]!;
      p += sum / block;
    }
    powers.push(p);
  }
  const L = (p: number) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => L(p) > -70);
  if (!abs.length) return { i: -99, m: -99 };
  const m = L(Math.max(...abs));
  const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = abs.filter((p) => L(p) > L(mean) - 10);
  return { i: L(rel.reduce((a, b) => a + b, 0) / rel.length), m };
}

function peakOf(buf: AudioBuffer) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  return peak;
}

function pcm(buf: AudioBuffer): string {
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const out = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) {
    out[2 * i] = Math.max(-1, Math.min(1, L[i]!)) * 32767;
    out[2 * i + 1] = Math.max(-1, Math.min(1, R[i]!)) * 32767;
  }
  let bin = '';
  const u8 = new Uint8Array(out.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface Job {
  what: 'arr' | 'stem' | 'sting' | 'phrase' | 'sfx';
  kind: string;
  bars?: number;
  boost?: number;
  voice?: Voice;
  mood?: Mood;
  /** linear gain applied after the rig, the in-game level of that place */
  gain?: number;
  /** through the game's master chain (the limiter), as the player hears it */
  master?: boolean;
  wav?: boolean;
}

async function render(job: Job) {
  let secs = 6;
  let setup: (ctx: OfflineAudioContext, dest: AudioNode) => void;
  if (job.what === 'arr' || job.what === 'stem') {
    const kind = job.kind as ArrangementKind;
    const bars = job.bars ?? ARRANGEMENTS[kind].loopBars;
    const bar = stepSeconds(ARRANGEMENTS[kind].bpm) * 16;
    secs = bar * bars + 3;
    const only = job.voice;
    setup = (ctx, dest) => {
      const rig = createRig(ctx, dest, {});
      for (let i = 0; i < bars; i++) scheduleBar(rig, kind, i, 0.1 + i * bar, job.boost ?? 0, only ? (n) => n.voice === only : undefined);
    };
  } else if (job.what === 'sfx') {
    setup = (ctx, dest) => {
      const white = ctx.createBuffer(1, SR, SR);
      const d = white.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      playBoutSfx(ctx as unknown as AudioContext, dest, white, job.kind as BoutSfx);
    };
  } else if (job.what === 'sting') {
    setup = (ctx, dest) => {
      const rig = createRig(ctx, dest, {});
      playSting(rig, job.kind as StingKind, 0.1);
    };
  } else {
    const mood = job.mood ?? 'golden';
    const p = phraseNotes(job.kind as PhraseId, mood);
    secs = p.bars * 16 * stepSeconds(MOODS[mood].bpm) + 3;
    setup = (ctx, dest) => {
      const rig = createRig(ctx, dest, {});
      playTimed(rig, p.notes, MOODS[mood].bpm, 0.1);
    };
  }
  const ctx = new OfflineAudioContext(2, Math.floor(SR * secs), SR);
  const g = ctx.createGain();
  g.gain.value = job.gain ?? 1;
  g.connect(job.master ? createMaster(ctx, ctx.destination).input : ctx.destination);
  setup(ctx, g);
  const buf = await ctx.startRendering();
  const loud = await lufs(buf);
  return { lufs: loud.i, mmax: loud.m, peak: peakOf(buf), secs, b64: job.wav ? pcm(buf) : '', sr: SR };
}

/** The voices an arrangement uses (for stems). */
function voices(kind: ArrangementKind): Voice[] {
  const set = new Set<Voice>();
  for (let i = 0; i < ARRANGEMENTS[kind].loopBars; i++) for (const n of scoreBar(kind, i, 1)) set.add(n.voice);
  return [...set];
}

Object.assign(window, { lab: { render, voices } });
