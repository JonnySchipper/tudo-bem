import { describe, expect, it } from 'vitest';
import { escolaHomeShows } from './escolaDisclosure';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);

describe('escolaHomeShows', () => {
  it('first visit shows nothing beyond the greeting, the count and the start button', () => {
    expect(escolaHomeShows({})).toEqual({ flame: false, path: false, goalPick: false, deep: false });
    expect(escolaHomeShows({ escola: { lessons: 0 }, diary: words(10) })).toEqual({ flame: false, path: false, goalPick: false, deep: false });
  });

  it('the streak flame and the path arrive with the first finished lesson', () => {
    expect(escolaHomeShows({ escola: { lessons: 1 } })).toMatchObject({ flame: true, path: true, goalPick: false, deep: false });
    expect(escolaHomeShows({ escola: { lessons: 2 } }).goalPick).toBe(false);
  });

  it('a running streak counts as a finished lesson', () => {
    expect(escolaHomeShows({ escola: { lessons: 0, streak: 6 } })).toMatchObject({ flame: true, path: true, goalPick: false });
  });

  it('the goal picker arrives with the third finished lesson', () => {
    expect(escolaHomeShows({ escola: { lessons: 3 } }).goalPick).toBe(true);
  });

  it('tier bar, freezes and the word mission wait for 25 diary words, 3 recados or a gi', () => {
    expect(escolaHomeShows({ diary: words(24), recados: { done: ['a', 'b'] } }).deep).toBe(false);
    expect(escolaHomeShows({ diary: words(25) }).deep).toBe(true);
    expect(escolaHomeShows({ recados: { done: ['a', 'b', 'c'] } }).deep).toBe(true);
    expect(escolaHomeShows({ giOwned: true }).deep).toBe(true);
  });

  it('the deep parts do not depend on lessons, and lessons do not unlock them', () => {
    expect(escolaHomeShows({ escola: { lessons: 9 } }).deep).toBe(false);
    expect(escolaHomeShows({ giOwned: true })).toMatchObject({ flame: false, path: false });
  });
});
