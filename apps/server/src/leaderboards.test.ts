import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, DIARY_WORDS, currentStreak, normalizeEscola, rankBoard } from '@tudobem/shared';
import { entriesFromProfiles, Leaderboards } from './leaderboards.js';
import { ProfileStore, type StoredProfile } from './store.js';

const ids = (...n: number[]) => n.map((i) => DIARY_WORDS[i]!.id);

function profile(partial: Partial<StoredProfile> & Pick<StoredProfile, 'id' | 'name'>): StoredProfile {
  return {
    pronoun: 'ela',
    appearance: DEFAULT_APPEARANCE,
    nameplate: 'verde',
    coins: 0,
    hats: [],
    hat: null,
    furniture: {},
    apartment: [],
    parrotOwned: false,
    parrotEquipped: false,
    friends: [],
    tutorial: {},
    tutorialRewarded: false,
    createdAt: 0,
    token: 't-' + partial.id,
    ageGate18: true,
    daily: { date: '2026-10-08', sceneClears: {} },
    lastSeen: 0,
    ...partial,
  } as StoredProfile;
}

describe('leaderboards server', () => {
  it('ranks words by diary length and streak via currentStreak', () => {
    const today = '2026-10-08';
    const profiles = [
      profile({
        id: '1',
        name: 'Ana',
        diary: ids(0, 1, 2),
        escola: { words: {}, xp: 0, lessons: 0, perfect: 0, goal: 10, dayXp: 0, streak: 5, best: 5, freezes: 0, tier: 'verde', lastDay: '2026-10-08' },
      }),
      profile({
        id: '2',
        name: 'Bia',
        diary: ids(0),
        escola: { words: {}, xp: 0, lessons: 0, perfect: 0, goal: 10, dayXp: 0, streak: 12, best: 12, freezes: 0, tier: 'verde', lastDay: '2026-10-07' },
      }),
      profile({
        id: '3',
        name: 'Caio',
        diary: ids(0, 1, 2, 3, 4),
        escola: { words: {}, xp: 0, lessons: 0, perfect: 0, goal: 10, dayXp: 0, streak: 3, best: 3, freezes: 0, tier: 'verde', lastDay: '2026-10-01' },
      }),
    ];
    const { words, streak } = entriesFromProfiles(profiles, today);
    expect(rankBoard(words, '1').map((r) => r.name)).toEqual(['Caio', 'Ana', 'Bia']);
    expect(currentStreak(normalizeEscola(profiles[2]!.escola, profiles[2]!.diary), today)).toBe(0);
    expect(rankBoard(streak, '3').map((r) => [r.name, r.score])).toEqual([
      ['Bia', 12],
      ['Ana', 5],
      ['Caio', 0],
    ]);
  });

  it('msgFor includes own rank outside top 10', () => {
    const store = new ProfileStore(null);
    for (let i = 0; i < 12; i++) {
      store.add(
        profile({
          id: `p${i}`,
          name: `P${String(i).padStart(2, '0')}`,
          diary: ids(...Array.from({ length: 20 - i }, (_, j) => j)),
        }),
      );
    }
    const lb = new Leaderboards(store, () => 1);
    const msg = lb.msgFor('p11');
    expect(msg.words).toHaveLength(11);
    expect(msg.words[10]).toMatchObject({ id: 'p11', you: true });
    expect(msg.words[10]!.rank).toBeGreaterThan(10);
  });

  it('maybeMentionStreak fires at most once per day and needs a leader', () => {
    const store = new ProfileStore(null);
    store.add(
      profile({
        id: '1',
        name: 'Ana',
        diary: ids(0),
        escola: { words: {}, xp: 0, lessons: 0, perfect: 0, goal: 10, dayXp: 0, streak: 7, best: 7, freezes: 0, tier: 'verde', lastDay: '2026-10-08' },
      }),
    );
    const viewer = profile({ id: 'v', name: 'Voce', diary: [] });
    store.add(viewer);
    const always = new Leaderboards(store, () => 0);
    const s = { profile: viewer, send: () => {} } as never;
    const line = always.maybeMentionStreak(s as never, 'carlos');
    expect(line?.pt).toContain('Ana');
    expect(line?.pt).toContain('7');
    expect(always.maybeMentionStreak(s as never, 'carlos')).toBeNull();
  });

  it('maybeMentionStreak skips when no streak leader', () => {
    const store = new ProfileStore(null);
    store.add(profile({ id: 'v', name: 'Voce', diary: [] }));
    const lb = new Leaderboards(store, () => 0);
    const s = { profile: store.get('v'), send: () => {} } as never;
    expect(lb.maybeMentionStreak(s as never, 'graca')).toBeNull();
  });
});
