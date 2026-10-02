/**
 * The Praça's share of the theme: now and then, a few bars of "Tudo Bem" drift over the street, played by whoever suits the hour
 * (a whistle in the morning, vibes at midday, an electric piano at golden hour, a music box at night, a felt piano in the rain).
 * The phrases are pieces of the real tune (audio/theme), each one ending on the tonic so it never hangs in the air.
 */
import { levels } from './mix';
import { playTimed, timedLength } from './sequencer';
import type { Rig } from './synth';
import { MOODS, moodAt, phraseNotes, type Mood, type PhraseId } from './theme';

export const MOOD_PHRASES: Record<Mood, PhraseId[]> = {
  morning: ['hook', 'a', 'answer'],
  day: ['a', 'answer', 'close', 'high', 'bridge'],
  golden: ['a', 'close', 'bridge', 'bridge2', 'tag'],
  night: ['hook', 'close', 'tag'],
  rain: ['hook', 'a', 'bridge'],
};

/** Pick a phrase for the mood, never the one just played. `r` is 0..1. */
export function choosePhrase(mood: Mood, last: PhraseId | null, r: number): PhraseId {
  const pool = MOOD_PHRASES[mood].filter((p) => p !== last);
  return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))]!;
}

export interface WorldClock {
  minute: number;
  rain: number;
}

export class Conductor {
  private nextAt: number;
  private last: PhraseId | null = null;

  constructor(
    private readonly rig: Rig,
    private readonly world: () => WorldClock,
    /** how present the houses' radio is (0..1): it plays the tune too, so the street holds back while it can be heard */
    private readonly radio: () => number = () => 0,
    private readonly rand: () => number = Math.random,
    /** seconds before the first phrase, so entering the square is answered by the tune soon but not at once */
    firstIn = 5,
  ) {
    this.nextAt = rig.ctx.currentTime + firstIn + rand() * 3;
  }

  /** Call about once a second. Returns the phrase it started, if any. */
  tick(): PhraseId | null {
    const now = this.rig.ctx.currentTime;
    if (now < this.nextAt) return null;
    if (this.radio() > 0.15) {
      this.nextAt = now + 6;
      return null;
    }
    const w = this.world();
    const mood = moodAt(w.minute, w.rain);
    const def = MOODS[mood];
    const id = choosePhrase(mood, this.last, this.rand());
    this.last = id;
    const { notes } = phraseNotes(id, mood);
    playTimed(this.rig, notes, def.bpm, now + 0.1, undefined, levels.phrase(mood));
    this.nextAt = now + timedLength(notes, def.bpm) + def.gap[0] + this.rand() * (def.gap[1] - def.gap[0]);
    return id;
  }
}
