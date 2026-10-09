/**
 * Schedules the theme (audio/theme) on the band (audio/synth): a looping arrangement bar by bar, a one-off phrase, a stinger.
 * `tick()` is called every ~250 ms and keeps a second or so of music queued ahead of the audio clock.
 */
import { createRig, playVoice, type Inst, type Rig, type RigOptions } from './synth';
import { ARRANGEMENTS, PERCUSSION, scoreBar, stingNotes, type ArrangementKind, type ScoreNote, type StingKind, type TimedNote, type Voice } from './theme';

export const stepSeconds = (bpm: number) => 60 / bpm / 4;

/**
 * Where a looping arrangement can stop without cutting a phrase off: the first `phrase`-bar boundary at or after `bar` (the next
 * bar not yet scheduled), and the audio time it lands on (`next` is when that bar starts, `barSeconds` how long a bar lasts).
 */
export function phraseEnd(bar: number, next: number, barSeconds: number, phrase = 8): { bar: number; at: number } {
  const end = Math.ceil(bar / phrase) * phrase;
  return { bar: end, at: next + (end - bar) * barSeconds };
}

export class ThemeSequencer {
  readonly rig: Rig;
  private bar: number;
  private next: number;
  private boostLevel: number;
  private readonly step: number;
  /** Set by `finish`: the band stops before this bar (a whole phrase, never mid-tune). */
  private lastBar = Infinity;

  constructor(
    ctx: BaseAudioContext,
    dest: AudioNode,
    private readonly kind: ArrangementKind,
    opts: RigOptions & { startAt?: number; startBar?: number; boost?: number } = {},
  ) {
    this.rig = createRig(ctx, dest, { bpm: ARRANGEMENTS[kind].bpm, ...opts });
    this.next = opts.startAt ?? ctx.currentTime + 0.1;
    this.bar = opts.startBar ?? 0;
    this.boostLevel = opts.boost ?? 0;
    this.step = stepSeconds(ARRANGEMENTS[kind].bpm);
  }

  get nodes(): AudioNode[] {
    return this.rig.nodes;
  }

  /** The next bar the sequencer will play. */
  get position(): number {
    return this.bar;
  }

  get barSeconds(): number {
    return this.step * 16;
  }

  /** Raise (or lower) the band: the intro does it when the sign-in card arrives, the bout on a finishing chance. */
  setBoost(n: number) {
    this.boostLevel = n;
  }

  /**
   * Let the band play to the end of the current `phrase`-bar phrase and stop there (the feira packing up at 13:00 while you are in it).
   * Returns the audio time the last bar ends. Calling it again keeps the first ending.
   */
  finish(phrase = 8): number {
    if (this.lastBar !== Infinity) return this.next + Math.max(0, this.lastBar - this.bar) * this.barSeconds;
    const end = phraseEnd(this.bar, this.next, this.barSeconds, phrase);
    this.lastBar = end.bar;
    return end.at;
  }

  /** `audible: false` keeps the clock moving without making sound (a radio you are too far from to hear). */
  tick(lookahead = 1.4, audible = true) {
    const ctx = this.rig.ctx;
    const now = ctx.currentTime;
    // A throttled background tab: skip what was missed instead of bursting it all at once.
    if (this.next < now - 0.05) this.next = now + 0.05;
    while (this.next < now + lookahead && this.bar < this.lastBar) {
      if (audible) scheduleBar(this.rig, this.kind, this.bar, this.next, this.boostLevel);
      this.bar++;
      this.next += this.barSeconds;
    }
  }
}

/**
 * How the band plays the grid: `swing` pushes every off 16th late by that fraction of a 16th (bossa and samba both lean on it),
 * `jitter` is a few ms of human timing, `vel` the spread of the dynamics, and the tune sits a hair behind the beat (`layBack`, s).
 */
export interface Feel {
  swing: number;
  jitter: number;
  vel: number;
  layBack: number;
}

export const FEELS: Record<ArrangementKind | 'phrase', Feel> = {
  intro: { swing: 0.12, jitter: 0.004, vel: 0.08, layBack: 0.012 },
  radio: { swing: 0.12, jitter: 0.004, vel: 0.08, layBack: 0.01 },
  padaria: { swing: 0.16, jitter: 0.004, vel: 0.1, layBack: 0.01 },
  padariaNight: { swing: 0.1, jitter: 0.008, vel: 0.1, layBack: 0.02 },
  kitnet: { swing: 0, jitter: 0.012, vel: 0.12, layBack: 0.02 },
  academia: { swing: 0.14, jitter: 0.003, vel: 0.1, layBack: 0.004 },
  bout: { swing: 0.12, jitter: 0.002, vel: 0.08, layBack: 0 },
  // forró sits straighter than bossa, pushed rather than laid back
  feira: { swing: 0.06, jitter: 0.004, vel: 0.1, layBack: 0.004 },
  voo: { swing: 0.06, jitter: 0.01, vel: 0.1, layBack: 0.02 },
  phrase: { swing: 0.1, jitter: 0.008, vel: 0.1, layBack: 0.015 },
};

const TUNE: ReadonlySet<Voice> = new Set<Voice>(['mel', 'lead', 'box', 'clar', 'harm', 'sanfona', 'pife']);

/** A tiny deterministic hash → 0..1, so the same bar is always played the same way (and tests and renders are stable). */
function h01(a: number, b: number, c: number): number {
  let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const VOICE_ID: Record<Voice, number> = { bass: 1, comp: 2, pad: 3, mel: 4, lead: 5, harm: 6, arp: 7, bell: 8, box: 9, cavaco: 10, accordion: 11, clar: 12, stab: 13, shaker: 14, clave: 15, surdo: 16, brush: 17, pandeiro: 18, sanfona: 19, pife: 20, zabumba: 21, triangle: 22 };

/** The moment and the velocity a note is actually played with. `at` is in 16th steps (fractional for strums). */
export function humanize(feel: Feel, bar: number, at: number, voice: Voice, vel: number, step: number): { t: number; vel: number } {
  const whole = Math.round(at);
  const off = Math.abs(at - whole) < 0.01 && whole % 2 === 1 ? feel.swing * step : 0;
  const r1 = h01(bar, whole, VOICE_ID[voice]);
  const r2 = h01(bar + 7919, whole, VOICE_ID[voice]);
  const t = at * step + off + (r1 - 0.5) * 2 * feel.jitter + (TUNE.has(voice) ? feel.layBack : 0);
  return { t: Math.max(0, t), vel: Math.min(1.25, vel * (1 + (r2 - 0.5) * 2 * feel.vel)) };
}

/** Schedule one bar of an arrangement starting at `when` (audio-clock seconds). */
export function scheduleBar(rig: Rig, kind: ArrangementKind, index: number, when: number, boost = 0, filter?: (n: ScoreNote) => boolean) {
  const step = stepSeconds(ARRANGEMENTS[kind].bpm);
  const swap = SWAPS[kind];
  const feel = FEELS[kind];
  const trim = MIX[kind];
  for (const n of scoreBar(kind, index, boost)) {
    if (filter && !filter(n)) continue;
    const p = humanize(feel, index, n.step, n.voice, n.vel, step);
    playVoice(rig, n.voice, n.midi, when + p.t, Math.max(0.12, n.dur * step), p.vel, swap, trim?.[n.voice] ?? 0);
  }
}

export const dbToGain = (db: number) => Math.pow(10, db / 20);

/**
 * Each arrangement's own balance on top of the band's (synth `VOICE_DB`), in dB. Set from the stems that
 * `node scripts/audio-lab.mjs stems <kind>` measures.
 */
export const MIX: Partial<Record<ArrangementKind, Partial<Record<Voice, number>>>> = {
  padaria: { clar: 1, accordion: 2.5, bass: 1, harm: 3 },
  padariaNight: { harm: 4, pad: 1.5, bass: 1, bell: 2 },
  kitnet: { box: 1.5, pad: 4, bass: 2.5 },
  academia: { harm: 4, bass: 0.5, cavaco: 3.5, pandeiro: 3, shaker: 4.5, clave: 3.5 },
  bout: { stab: 3.5, bass: 1, surdo: 2, pandeiro: -2, shaker: 4, clave: 1.5 },
  feira: { sanfona: 2, pife: -1.5, triangle: 3 },
  voo: { bass: 4, pad: 3, arp: 8, harm: 1 },
};

/** Per-arrangement instrument swaps: the padaria's pad is the accordion, the night one is a felt piano, and so on. */
const SWAPS: Partial<Record<ArrangementKind, Partial<Record<Voice, Inst>>>> = {
  intro: { pad: 'felt' },
  padaria: { comp: 'cavaco', pad: 'accordion', harm: 'vibes' },
  padariaNight: { harm: 'vibes', pad: 'felt' },
  kitnet: { pad: 'felt' },
  // the sanfona's left hand plays the chord chops
  feira: { accordion: 'sanfona' },
  // the flight in: flute on the tune, strings for the pad, the felt piano ripples
  voo: { mel: 'flute', pad: 'strings', arp: 'felt' },
};

/** Play timed notes (a phrase or a stinger) starting at `when`. `swap` retunes voices to the mood's instruments. */
export function playTimed(rig: Rig, notes: TimedNote[], bpm: number, when: number, swap?: Partial<Record<Voice, Inst>>, level = 1, feel: Feel = FEELS.phrase) {
  const step = stepSeconds(bpm);
  for (const n of notes) {
    const p = humanize(feel, Math.floor(n.at / 16), n.at % 16, n.voice, n.vel, step);
    playVoice(rig, n.voice, n.midi, when + Math.floor(n.at / 16) * 16 * step + p.t, Math.max(0.12, n.dur * step), p.vel * level, swap);
  }
}

/** Length in seconds of a list of timed notes, tail included. */
export function timedLength(notes: TimedNote[], bpm: number): number {
  const step = stepSeconds(bpm);
  return notes.reduce((m, n) => Math.max(m, (n.at + n.dur) * step), 0) + 1.5;
}

/** Play a stinger, `transpose` semitones away (to sit in the key of the bed under it). Returns how long it sounds, in seconds. */
export function playSting(rig: Rig, kind: StingKind, when: number, transpose = 0, level = 1): number {
  const s = stingNotes(kind);
  const notes = transpose ? s.notes.map((n) => (PERCUSSION.has(n.voice) ? n : { ...n, midi: n.midi + transpose })) : s.notes;
  playTimed(rig, notes, s.bpm, when, STING_SWAP, level);
  return timedLength(notes, s.bpm) - 1.5;
}

const STING_SWAP: Partial<Record<Voice, Inst>> = { pad: 'strings', harm: 'vibes' };
