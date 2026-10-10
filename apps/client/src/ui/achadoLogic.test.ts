import { describe, expect, it } from 'vitest';
import { wordForSign } from '@tudobem/shared';
import { STREAK_MS, letterSize, lockupSpot, nextStreak, roomReadingWords, roomTally, streakSemitones } from './achadoLogic';

describe('the hidden words of a room', () => {
  it('lists every reading word on the signs of the room, once', () => {
    const words = roomReadingWords('rua_leste');
    expect(words.length).toBeGreaterThanOrEqual(5);
    expect(new Set(words).size).toBe(words.length);
    expect(words).toContain(wordForSign('s_pare')!.id);
  });

  it('counts what the player has, plus the word being found', () => {
    const words = roomReadingWords('rua_leste');
    expect(roomTally('rua_leste', [])).toEqual({ found: 0, total: words.length });
    expect(roomTally('rua_leste', [words[0]!], words[1])).toEqual({ found: 2, total: words.length });
    // a word from another room does not count here
    expect(roomTally('rua_leste', ['nope.word']).found).toBe(0);
  });
});

describe('the streak', () => {
  it('climbs while finds come close together and restarts after a pause', () => {
    expect(nextStreak(null, 1000)).toBe(1);
    expect(nextStreak({ n: 1, at: 1000 }, 1000 + STREAK_MS - 1)).toBe(2);
    expect(nextStreak({ n: 4, at: 1000 }, 1000 + STREAK_MS + 1)).toBe(1);
  });

  it('raises the chime up the pentatonic and stops at the top', () => {
    expect(streakSemitones(1)).toBe(0);
    expect(streakSemitones(2)).toBe(2);
    expect(streakSemitones(4)).toBe(7);
    expect(streakSemitones(99)).toBe(24);
  });
});

describe('the word on screen', () => {
  it('is big, and a long word shrinks to fit a phone', () => {
    expect(letterSize('PARE', 1200)).toBe(64);
    const s = letterSize('SENTIDO ÚNICO', 360);
    expect(s).toBeGreaterThanOrEqual(30);
    expect(s * 0.62 * 13).toBeLessThanOrEqual(360);
  });

  it('hangs above the star, inside the screen', () => {
    const view = { w: 400, h: 800, top: 60, bottom: 100 };
    expect(lockupSpot({ x: 200, y: 400 }, { w: 200, h: 60 }, view)).toEqual({ x: 200, y: 300 });
    // pushed in from the edge
    expect(lockupSpot({ x: 10, y: 400 }, { w: 200, h: 60 }, view).x).toBe(116);
    // a star near the top: under it instead
    expect(lockupSpot({ x: 200, y: 120 }, { w: 200, h: 60 }, view).y).toBe(220);
  });
});
