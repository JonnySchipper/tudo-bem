import { beforeEach, describe, expect, it, vi } from 'vitest';

// the band itself needs Web Audio; here only the timing matters, so every note is just recorded
const played: { voice: string; when: number }[] = [];
const ctx = { currentTime: 0 };
vi.mock('./synth', () => ({
  createRig: () => ({ ctx, nodes: [] }),
  playVoice: (_rig: unknown, voice: string, _midi: number, when: number) => played.push({ voice, when }),
}));

const { phraseEnd, ThemeSequencer } = await import('./sequencer');

describe('phraseEnd', () => {
  it('is the next 8-bar line at or after the next unscheduled bar, at the time that bar lands', () => {
    expect(phraseEnd(3, 10, 2)).toEqual({ bar: 8, at: 20 });
    expect(phraseEnd(8, 10, 2)).toEqual({ bar: 8, at: 10 });
    expect(phraseEnd(9, 10, 2)).toEqual({ bar: 16, at: 24 });
    expect(phraseEnd(33, 0, 1, 4)).toEqual({ bar: 36, at: 3 });
  });
});

describe('ThemeSequencer.finish (the feira packing up at 13:00)', () => {
  beforeEach(() => {
    played.length = 0;
    ctx.currentTime = 0;
  });

  it('plays on to the end of the phrase, never cuts it mid-bar, and then stays quiet', () => {
    const seq = new ThemeSequencer(ctx as unknown as BaseAudioContext, {} as AudioNode, 'feira', { startAt: 0.1, startBar: 0 });
    const bar = seq.barSeconds;
    // about three bars in
    for (; ctx.currentTime < bar * 3; ctx.currentTime += 0.25) seq.tick();
    const next = seq.position;
    expect(next % 8).not.toBe(0);
    const end = seq.finish(8);
    expect(end).toBeCloseTo(0.1 + 8 * bar, 6);
    // calling it again (setWorld runs a few times a second) keeps the same ending
    expect(seq.finish(8)).toBeCloseTo(end, 6);
    // a whole minute later the band has stopped exactly at bar 8
    for (; ctx.currentTime < 60; ctx.currentTime += 0.25) seq.tick();
    expect(seq.position).toBe(8);
    const last = Math.max(...played.map((p) => p.when));
    expect(last).toBeLessThan(end);
    // ...but it did play the phrase through to its last bar
    expect(last).toBeGreaterThan(end - bar);
  });

  it('without finish, the 32-bar baião keeps looping', () => {
    const seq = new ThemeSequencer(ctx as unknown as BaseAudioContext, {} as AudioNode, 'feira', { startAt: 0.1, startBar: 0 });
    for (; ctx.currentTime < seq.barSeconds * 40; ctx.currentTime += 0.25) seq.tick();
    expect(seq.position).toBeGreaterThan(40);
    expect(played.some((p) => p.when > seq.barSeconds * 36)).toBe(true);
  });
});
