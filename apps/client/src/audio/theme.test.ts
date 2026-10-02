import { describe, expect, it } from 'vitest';
import { ARRANGEMENTS, BORROWED_PC, D_MAJOR, FORM_BARS, FORM_CHORDS, FORM_MELODY, MOODS, MOTIF, MOTIF_DEGREES, PERCUSSION, degreeOf, moodAt, padariaIsNight, phraseNotes, scoreBar, shiftDiatonic, stingNotes, type ArrangementKind, type StingKind } from './theme';
import { MOOD_PHRASES, choosePhrase } from './conductor';
import { stepSeconds } from './sequencer';

const KINDS = Object.keys(ARRANGEMENTS) as ArrangementKind[];
const STINGS: StingKind[] = ['recado', 'heart', 'coin', 'mission', 'caderno', 'win', 'lose', 'door'];
const inKey = (pc: number, shift: number, borrowed = false) => D_MAJOR.includes((((pc - shift) % 12) + 12) % 12) || (borrowed && (((pc - shift) % 12) + 12) % 12 === BORROWED_PC);

describe('the theme', () => {
  it('is a 32-bar bossa form: A, A prime, B, A', () => {
    expect(FORM_CHORDS).toHaveLength(FORM_BARS);
    expect(FORM_MELODY).toHaveLength(FORM_BARS);
    const bar = stepSeconds(ARRANGEMENTS.intro.bpm) * 16;
    expect(ARRANGEMENTS.intro.bpm).toBeGreaterThanOrEqual(96);
    expect(ARRANGEMENTS.intro.bpm).toBeLessThanOrEqual(124);
    expect(bar * FORM_BARS).toBeGreaterThan(55);
  });

  it('keeps the original intro progression and hook', () => {
    expect(FORM_CHORDS.slice(0, 8).map((c) => c.name)).toEqual(['Dmaj9', 'Bm9', 'Em9', 'A13', 'F#m7', 'Bm9', 'Gmaj9', 'A13']);
    expect(MOTIF.map((m) => m.midi)).toEqual([76, 78, 73, 74, 76]);
    expect(MOTIF.map((m) => degreeOf(m.midi))).toEqual([...MOTIF_DEGREES]);
    expect(FORM_MELODY[24]).toEqual(FORM_MELODY[0]);
  });

  it('stays in D major, with only the Gm6 colour note borrowed', () => {
    FORM_MELODY.forEach((phrase, bar) => {
      for (const [step, midi, dur] of phrase) {
        expect(step + dur).toBeLessThanOrEqual(16);
        expect(midi).toBeLessThanOrEqual(83);
        expect(inKey(midi, 0, bar === 21)).toBe(true);
      }
    });
    for (const c of FORM_CHORDS) for (const m of [c.root, c.fifth, ...c.voicing]) expect(inKey(m, 0, c.name === 'Gm6')).toBe(true);
  });

  it('every arrangement is in key (transposed by its own shift), inside the bar, and loops', () => {
    for (const kind of KINDS) {
      const arr = ARRANGEMENTS[kind];
      for (let i = 0; i < arr.loopBars; i++) {
        const notes = scoreBar(kind, i);
        for (const n of notes) {
          expect(n.step).toBeGreaterThanOrEqual(0);
          expect(n.step).toBeLessThan(16);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1.2);
          if (PERCUSSION.has(n.voice)) continue;
          expect(inKey(n.midi, arr.transpose === 0 ? 0 : arr.transpose, true) || inKey(n.midi, arr.melShift, true)).toBe(true);
          if (n.voice === 'bass') expect(n.midi).toBeLessThanOrEqual(62);
        }
        expect(scoreBar(kind, i + arr.loopBars)).toEqual(notes);
      }
    }
  });

  it('the intro has the root on every downbeat and builds with the boost', () => {
    for (let i = 0; i < FORM_BARS; i++) {
      const root = scoreBar('intro', i).find((n) => n.voice === 'bass' && n.step === 0);
      expect(root?.midi).toBe(FORM_CHORDS[i]!.root);
    }
    const voices = (b: number, boost: number) => new Set(scoreBar('intro', b, boost).map((n) => n.voice));
    expect(voices(0, 0).has('surdo')).toBe(false);
    expect(voices(0, 1).has('clave')).toBe(true);
    expect(voices(24, 1).has('surdo')).toBe(true);
    expect(voices(16, 0).has('lead')).toBe(true);
  });

  it('plays the hook everywhere the theme is the bed', () => {
    const contour = (kind: ArrangementKind, bars: number[], voices: string[]) => {
      const seen: number[] = [];
      for (const b of bars) for (const n of scoreBar(kind, b)) if (voices.includes(n.voice)) seen.push(degreeOf(n.midi, (2 + ARRANGEMENTS[kind].transpose) % 12) ?? -1);
      return seen;
    };
    const hasHook = (seq: number[]) => seq.join(',').includes(MOTIF_DEGREES.join(','));
    expect(hasHook(contour('intro', [0, 1], ['mel']))).toBe(true);
    expect(hasHook(contour('radio', [0, 1], ['mel']))).toBe(true);
    expect(hasHook(contour('kitnet', [0, 1], ['box']))).toBe(true);
    expect(hasHook(contour('padaria', [0, 1], ['clar']))).toBe(true);
    expect(hasHook(contour('bout', [0, 1], ['stab']))).toBe(true);
    expect(hasHook(contour('academia', [0, 1], ['harm']))).toBe(true);
    expect(hasHook(contour('padariaNight', [0, 1], ['harm']))).toBe(true);
  });

  it('the kitnet music box plays once and then rests', () => {
    expect(scoreBar('kitnet', 3).some((n) => n.voice === 'box')).toBe(true);
    expect(scoreBar('kitnet', 10).some((n) => n.voice === 'box')).toBe(false);
  });
});

describe('phrases for the Praça', () => {
  it('each mood has real phrases, each ending on the tonic', () => {
    for (const mood of Object.keys(MOODS) as (keyof typeof MOODS)[]) {
      for (const id of MOOD_PHRASES[mood]) {
        const { notes, bars } = phraseNotes(id, mood);
        expect(bars).toBeGreaterThan(2);
        const lead = notes.filter((n) => n.voice === MOODS[mood].lead);
        const last = lead[lead.length - 1]!;
        expect(((last.midi % 12) + 12) % 12).toBe(2);
        expect(Math.max(...notes.map((n) => n.at + n.dur))).toBeLessThanOrEqual(bars * 16 + 16);
      }
    }
  });

  it('follows the hour and the weather', () => {
    expect(moodAt(8 * 60, 0)).toBe('morning');
    expect(moodAt(13 * 60, 0)).toBe('day');
    expect(moodAt(18 * 60, 0)).toBe('golden');
    expect(moodAt(23 * 60, 0)).toBe('night');
    expect(moodAt(13 * 60, 0.8)).toBe('rain');
    expect(moodAt(2 * 60, 0.8)).toBe('night');
    expect(padariaIsNight(22 * 60)).toBe(true);
    expect(padariaIsNight(12 * 60)).toBe(false);
  });

  it('never repeats the last phrase', () => {
    for (const mood of Object.keys(MOODS) as (keyof typeof MOODS)[]) for (const last of MOOD_PHRASES[mood]) for (const r of [0, 0.3, 0.99]) expect(choosePhrase(mood, last, r)).not.toBe(last);
  });

  it('shifts along the scale', () => {
    expect(shiftDiatonic(76, -2)).toBe(73);
    expect(shiftDiatonic(74, 7)).toBe(86);
    expect(shiftDiatonic(73, -2)).toBe(69);
  });
});

describe('stingers', () => {
  it('are short, in key, and made of the theme', () => {
    for (const kind of STINGS) {
      const s = stingNotes(kind);
      const secs = Math.max(...s.notes.map((n) => n.at + n.dur)) * stepSeconds(s.bpm);
      expect(secs).toBeLessThan(6);
      for (const n of s.notes) if (!PERCUSSION.has(n.voice)) expect(inKey(n.midi, 0)).toBe(true);
    }
    const win = stingNotes('win').notes.filter((n) => n.voice === 'stab').map((n) => n.midi);
    expect(win.slice(0, 5)).toEqual([76, 78, 73, 74, 76]);
    expect(stingNotes('mission').notes.filter((n) => n.voice === 'mel' || n.voice === 'lead').map((n) => n.midi)).toEqual([76, 78, 73, 74, 76]);
  });
});
