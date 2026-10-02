import { describe, expect, it } from 'vitest';
import calibration from './calibration.json';
import { SFX_TRIM_DB } from './boutSfx';
import { MOOD_PHRASES } from './conductor';
import { TARGET_LUFS, levels } from './mix';
import { FEELS, MIX, humanize, stepSeconds } from './sequencer';
import { VOICE_DB } from './synth';
import { ARRANGEMENTS, MOODS, type ArrangementKind, type Mood, type StingKind } from './theme';

const BEDS = Object.keys(ARRANGEMENTS) as ArrangementKind[];
const STINGS = Object.keys(TARGET_LUFS.sting) as StingKind[];

describe('the mix', () => {
  it('has a measured calibration for every bed, Praça mood and stinger (run `node scripts/audio-lab.mjs calibrate` after changing the music)', () => {
    const cal = calibration as { bed: Record<string, number>; phrase: Record<string, number>; sting: Record<string, number> };
    for (const k of BEDS) expect(cal.bed[k], k).toBeTypeOf('number');
    for (const m of Object.keys(MOODS)) expect(cal.phrase[m], m).toBeTypeOf('number');
    for (const s of STINGS) expect(cal.sting[s], s).toBeTypeOf('number');
  });

  it('turns targets into sane gains', () => {
    for (const k of BEDS) expect(levels.bed(k)).toBeGreaterThan(0.05), expect(levels.bed(k)).toBeLessThan(4);
    for (const m of Object.keys(MOODS) as Mood[]) expect(levels.phrase(m)).toBeGreaterThan(0.05);
    for (const s of STINGS) expect(levels.sting(s)).toBeGreaterThan(0.05);
  });

  it('keeps the intro the loudest music, the rooms under it, the Praça phrases quieter still', () => {
    const b = TARGET_LUFS.bed;
    for (const k of BEDS) if (k !== 'intro') expect(b[k]).toBeLessThan(b.intro);
    for (const m of Object.values(TARGET_LUFS.phrase)) expect(m).toBeLessThanOrEqual(Math.min(b.padaria, b.academia, b.kitnet));
    // a stinger lands above the room it plays over, but the big ones stay under the intro
    for (const s of STINGS) expect(TARGET_LUFS.sting[s]).toBeLessThanOrEqual(b.intro - 1);
  });

  it('puts the tune on top of the band', () => {
    expect(VOICE_DB.mel).toBeGreaterThan(VOICE_DB.comp);
    expect(VOICE_DB.mel).toBeGreaterThan(VOICE_DB.bass);
    for (const [kind, trims] of Object.entries(MIX)) for (const db of Object.values(trims ?? {})) expect(Math.abs(db), kind).toBeLessThanOrEqual(8);
  });

  it('every Praça mood has phrases and every bout effect a trim', () => {
    for (const m of Object.keys(MOODS) as Mood[]) expect(MOOD_PHRASES[m].length).toBeGreaterThan(1);
    for (const db of Object.values(SFX_TRIM_DB)) expect(db).toBeLessThan(30);
  });
});

describe('the feel', () => {
  it('is deterministic, small, and swings only the off 16ths', () => {
    const step = stepSeconds(112);
    const a = humanize(FEELS.intro, 3, 5, 'comp', 0.8, step);
    expect(humanize(FEELS.intro, 3, 5, 'comp', 0.8, step)).toEqual(a);
    for (let bar = 0; bar < 8; bar++)
      for (let s = 0; s < 16; s++) {
        const p = humanize(FEELS.intro, bar, s, 'comp', 0.8, step);
        const late = p.t - s * step;
        expect(Math.abs(late)).toBeLessThan(step * 0.25);
        if (s % 2 === 0) expect(Math.abs(late)).toBeLessThanOrEqual(FEELS.intro.jitter + 1e-9);
        expect(p.vel).toBeGreaterThan(0.8 * (1 - FEELS.intro.vel) - 1e-9);
        expect(p.vel).toBeLessThan(0.8 * (1 + FEELS.intro.vel) + 1e-9);
      }
    // the tune lays back a little
    expect(humanize(FEELS.intro, 0, 0, 'mel', 1, step).t).toBeGreaterThan(humanize(FEELS.intro, 0, 0, 'comp', 1, step).t - FEELS.intro.jitter * 2);
  });
});
