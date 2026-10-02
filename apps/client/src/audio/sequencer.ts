/**
 * Schedules the theme (audio/theme) on the band (audio/synth): a looping arrangement bar by bar, a one-off phrase, a stinger.
 * `tick()` is called every ~250 ms and keeps a second or so of music queued ahead of the audio clock.
 */
import { createRig, playVoice, type Inst, type Rig, type RigOptions } from './synth';
import { ARRANGEMENTS, scoreBar, stingNotes, type ArrangementKind, type StingKind, type TimedNote, type Voice } from './theme';

export const stepSeconds = (bpm: number) => 60 / bpm / 4;

export class ThemeSequencer {
  readonly rig: Rig;
  private bar: number;
  private next: number;
  private boostLevel: number;
  private readonly step: number;

  constructor(
    ctx: BaseAudioContext,
    dest: AudioNode,
    private readonly kind: ArrangementKind,
    opts: RigOptions & { startAt?: number; startBar?: number; boost?: number } = {},
  ) {
    this.rig = createRig(ctx, dest, opts);
    this.next = opts.startAt ?? ctx.currentTime + 0.1;
    this.bar = opts.startBar ?? 0;
    this.boostLevel = opts.boost ?? 0;
    this.step = stepSeconds(ARRANGEMENTS[kind].bpm);
  }

  get nodes(): AudioNode[] {
    return this.rig.nodes;
  }

  get barSeconds(): number {
    return this.step * 16;
  }

  /** Raise (or lower) the band: the intro does it when the sign-in card arrives, the bout on a finishing chance. */
  setBoost(n: number) {
    this.boostLevel = n;
  }

  /** `audible: false` keeps the clock moving without making sound (a radio you are too far from to hear). */
  tick(lookahead = 1.4, audible = true) {
    const ctx = this.rig.ctx;
    const now = ctx.currentTime;
    // A throttled background tab: skip what was missed instead of bursting it all at once.
    if (this.next < now - 0.05) this.next = now + 0.05;
    while (this.next < now + lookahead) {
      if (audible) scheduleBar(this.rig, this.kind, this.bar, this.next, this.boostLevel);
      this.bar++;
      this.next += this.barSeconds;
    }
  }
}

/** Schedule one bar of an arrangement starting at `when` (audio-clock seconds). */
export function scheduleBar(rig: Rig, kind: ArrangementKind, index: number, when: number, boost = 0) {
  const step = stepSeconds(ARRANGEMENTS[kind].bpm);
  const swap = SWAPS[kind];
  for (const n of scoreBar(kind, index, boost)) playVoice(rig, n.voice, n.midi, when + n.step * step, Math.max(0.12, n.dur * step), n.vel, swap);
}

/** Per-arrangement instrument swaps: the padaria's pad is the accordion, the night one is a felt piano, and so on. */
const SWAPS: Partial<Record<ArrangementKind, Partial<Record<Voice, Inst>>>> = {
  intro: { pad: 'felt' },
  padaria: { comp: 'cavaco', pad: 'accordion', harm: 'vibes' },
  padariaNight: { harm: 'vibes', pad: 'felt' },
  kitnet: { pad: 'felt' },
};

/** Play timed notes (a phrase or a stinger) starting at `when`. `swap` retunes voices to the mood's instruments. */
export function playTimed(rig: Rig, notes: TimedNote[], bpm: number, when: number, swap?: Partial<Record<Voice, Inst>>, level = 1) {
  const step = stepSeconds(bpm);
  for (const n of notes) playVoice(rig, n.voice, n.midi, when + n.at * step, Math.max(0.12, n.dur * step), n.vel * level, swap);
}

/** Length in seconds of a list of timed notes, tail included. */
export function timedLength(notes: TimedNote[], bpm: number): number {
  const step = stepSeconds(bpm);
  return notes.reduce((m, n) => Math.max(m, (n.at + n.dur) * step), 0) + 1.5;
}

export function playSting(rig: Rig, kind: StingKind, when: number) {
  const s = stingNotes(kind);
  playTimed(rig, s.notes, s.bpm, when, STING_SWAP);
}

const STING_SWAP: Partial<Record<Voice, Inst>> = { pad: 'strings', harm: 'vibes' };
