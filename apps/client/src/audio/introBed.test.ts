import { describe, expect, it } from 'vitest';
import { BAR_S, INTRO_BED_LEVEL, INTRO_BPM, INTRO_PROGRESSION, LOOP_BARS, introBar } from './introBed';

const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);

describe('intro music bed', () => {
  it('is an unhurried bossa loop (not EDM tempo) of ~16s', () => {
    expect(INTRO_BPM).toBeGreaterThanOrEqual(96);
    expect(INTRO_BPM).toBeLessThanOrEqual(124);
    expect(BAR_S * LOOP_BARS).toBeGreaterThan(14);
    expect(BAR_S * LOOP_BARS).toBeLessThan(20);
  });

  it('sits well under full level so speech and bird SFX stay on top', () => {
    expect(INTRO_BED_LEVEL).toBeLessThanOrEqual(0.6);
  });

  it('loops seamlessly: every bar has its root on the downbeat, bars repeat each loop', () => {
    for (let i = 0; i < LOOP_BARS; i++) {
      const bar = introBar(i);
      const root = bar.find((n) => n.voice === 'bass' && n.step === 0);
      expect(root?.midi).toBe(INTRO_PROGRESSION[i]!.root);
      const comp = (b: typeof bar) => b.filter((n) => n.voice !== 'mel').map((n) => `${n.voice}:${n.step}:${n.midi}`);
      expect(comp(introBar(i + LOOP_BARS))).toEqual(comp(bar));
    }
  });

  it('keeps every note in D major, inside warm registers, within the bar', () => {
    for (let i = 0; i < LOOP_BARS * 3; i++) {
      for (const n of introBar(i)) {
        expect(n.step).toBeGreaterThanOrEqual(0);
        expect(n.step).toBeLessThan(16);
        expect(n.vel).toBeGreaterThan(0);
        expect(n.vel).toBeLessThanOrEqual(1);
        if (n.voice === 'shaker') continue;
        expect(D_MAJOR.has(n.midi % 12)).toBe(true);
        if (n.voice === 'bass') expect(n.midi).toBeLessThanOrEqual(55);
        if (n.voice === 'mel') expect(n.midi).toBeLessThanOrEqual(81);
      }
    }
  });

  it('lets the whistled line rest every third loop so the bed breathes', () => {
    const mel = (loop: number) => Array.from({ length: LOOP_BARS }, (_, b) => introBar(loop * LOOP_BARS + b)).flat().filter((n) => n.voice === 'mel').length;
    expect(mel(0)).toBeGreaterThan(0);
    expect(mel(1)).toBeGreaterThan(0);
    expect(mel(2)).toBe(0);
  });
});
