import { describe, expect, it } from 'vitest';
import {
  DIARY_SOURCES,
  DIARY_WORDS,
  areaBoard,
  assertDiaryPack,
  diaryGame,
  diaryKey,
  grantDiaryWord,
  handCartela,
  normalizeArrival,
  normalizeDiary,
  practiceCorrect,
  practiceRound,
  progressLine,
  type DiaryPack,
} from './diary.js';

const pack = (): DiaryPack => ({
  areas: [{ id: 'praca', pt: 'Praça', en: 'Square' }],
  words: DIARY_WORDS.map((w) => ({ ...w, anchor: { ...w.anchor } })),
  games: [],
});

describe('language diary catalog', () => {
  it('keeps one Portuguese word to one source, and the seeded praça path is marked', () => {
    const keys = DIARY_WORDS.map((w) => diaryKey(w.pt));
    expect(new Set(keys).size).toBe(keys.length);
    const anchors = DIARY_WORDS.map((w) => `${w.anchor.kind}:${w.anchor.id}`);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const w of DIARY_WORDS) expect(DIARY_SOURCES).toContain(w.source);
    expect(DIARY_WORDS.filter((w) => w.seed).map((w) => w.id).sort()).toEqual([
      'seed.praca.aula',
      'seed.praca.coreto',
      'seed.praca.fonte',
      'seed.praca.guia',
    ]);
    expect(DIARY_WORDS.filter((w) => w.seed).map((w) => w.source).sort()).toEqual(['camera', 'conversation', 'game', 'reading']);
  });

  it('refuses a second Portuguese spelling of a word that already has a source', () => {
    const bad = pack();
    const fonte = bad.words.find((w) => w.id === 'seed.praca.fonte')!;
    bad.words.push({ ...fonte, id: 'seed.praca.fonte2', pt: 'Fonte', source: 'reading', anchor: { kind: 'sign', id: 'coreto_placa' } });
    expect(() => assertDiaryPack(bad)).toThrow(/one word, one source/);
  });

  it('earns a word once, and only from its own source', () => {
    const first = grantDiaryWord([], 'seed.praca.fonte', 'camera');
    expect(first.ok && first.earned).toEqual(['seed.praca.fonte']);
    expect(grantDiaryWord(first.ok ? first.earned : [], 'seed.praca.fonte', 'camera')).toMatchObject({ ok: false, reason: 'already' });
    expect(grantDiaryWord([], 'seed.praca.fonte', 'reading')).toMatchObject({ ok: false, reason: 'wrong-source' });
    expect(grantDiaryWord(['seed.praca.fonte'], 'seed.praca.coreto', 'camera')).toMatchObject({ ok: false, reason: 'wrong-source' });
    expect(grantDiaryWord(['nope', 'seed.praca.fonte', 'seed.praca.fonte'], 'seed.praca.guia', 'conversation').ok).toBe(true);
    expect(normalizeDiary(['nope', 'seed.praca.fonte', 'seed.praca.fonte'])).toEqual(['seed.praca.fonte']);
  });

  it('counts progress from the catalog, and an area with no words is 0/0', () => {
    const board = areaBoard('praca', ['seed.praca.fonte']);
    expect(board.empty).toBe(false);
    for (const s of board.sources) {
      expect(s.total).toBe(DIARY_WORDS.filter((w) => w.area === 'praca' && w.source === s.source).length);
      expect(s.total).toBeGreaterThan(0);
    }
    expect(board.sources.find((s) => s.source === 'camera')).toMatchObject({ earned: 1 });
    expect(board.sources.find((s) => s.source === 'reading')).toMatchObject({ earned: 0 });
    expect(progressLine(board)).toBe(board.sources.map((s) => `${s.earned}/${s.total} ${s.label.pt}`).join(' · '));
    expect(progressLine(board)).not.toMatch(/\/100\b/);
    const empty = areaBoard('sem-catalogo', []);
    expect(empty.empty).toBe(true);
    expect(empty.sources).toEqual([]);
    expect(progressLine(empty)).toBe('0/0');
  });

  it('deals a practice round from words already earned, and checks the answer', () => {
    const game = diaryGame('escola.pratica')!;
    const round = practiceRound(['seed.praca.fonte'], game, () => 0);
    expect(round).toMatchObject({ wordId: 'seed.praca.fonte', en: 'fountain' });
    expect(round!.options).toContain('fonte');
    expect(new Set(round!.options).size).toBe(round!.options.length);
    expect(practiceCorrect(round!.wordId, 'Fonte')).toBe(true);
    expect(practiceCorrect(round!.wordId, 'porta')).toBe(false);
    expect(practiceRound([], game, () => 0)).toBeNull();
  });

  it('leaves the cartela as a hook, and treats a missing arrival flag as already home', () => {
    expect(handCartela()).toEqual({ given: false, reason: 'cartela-not-on-main' });
    expect(normalizeArrival(undefined)).toEqual({ arrivalIntroDone: true, hasCamera: false });
    expect(normalizeArrival({ arrivalIntroDone: false, hasCamera: false })).toEqual({ arrivalIntroDone: false, hasCamera: false });
    expect(normalizeArrival({ arrivalIntroDone: true, hasCamera: true })).toEqual({ arrivalIntroDone: true, hasCamera: true });
  });
});
