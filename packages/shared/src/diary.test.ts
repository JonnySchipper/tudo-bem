import { describe, expect, it } from 'vitest';
import {
  DIARY_AREAS,
  DIARY_GAMES,
  DIARY_SOURCES,
  DIARY_WORDS,
  areaBoard,
  assertDiaryPack,
  cameraObjectIds,
  diaryGame,
  diaryKey,
  diaryPackProblems,
  grantDiaryWord,
  handCartela,
  normalizeArrival,
  normalizeDiary,
  objectAnchorExists,
  practiceCorrect,
  practiceRound,
  progressLine,
  wordsForPhoto,
  type DiaryPack,
} from './diary.js';
import { hotspotById } from './hotspots.js';
import { ROOMS } from './rooms.js';

const pack = (): DiaryPack => ({
  areas: DIARY_AREAS.map((a) => ({ ...a })),
  words: DIARY_WORDS.map((w) => ({ ...w, anchor: { ...w.anchor } })),
  games: DIARY_GAMES.map((g) => ({ ...g })),
});

describe('language diary catalog', () => {
  it('keeps one Portuguese word to one source, and the seeded praça path is marked', () => {
    const keys = DIARY_WORDS.map((w) => diaryKey(w.pt));
    expect(new Set(keys).size).toBe(keys.length);
    // a crate of melancias is a caixote and a melancia: only camera objects may teach more than one word
    const anchors = DIARY_WORDS.filter((w) => w.source !== 'camera').map((w) => `${w.anchor.kind}:${w.anchor.id}`);
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

  it('hands the cartela over with the camera, and treats a missing arrival flag as already home', () => {
    expect(handCartela()).toEqual({ given: true });
    expect(normalizeArrival(undefined)).toEqual({ arrivalIntroDone: true, hasCamera: false });
    expect(normalizeArrival({ arrivalIntroDone: false, hasCamera: false })).toEqual({ arrivalIntroDone: false, hasCamera: false });
    expect(normalizeArrival({ arrivalIntroDone: true, hasCamera: true })).toEqual({ arrivalIntroDone: true, hasCamera: true });
  });
});

/** The catalog v2 (2026-10-03): every area and source count, and where each word is earned. */
describe('language diary catalog v2', () => {
  const TOTALS: Record<string, [number, number, number, number]> = {
    chegada: [14, 6, 4, 0],
    praca: [98, 16, 9, 0],
    rua: [51, 31, 0, 0],
    padaria: [38, 5, 6, 5],
    feira: [53, 10, 9, 0],
    kitnet: [64, 5, 0, 0],
    academia: [20, 7, 7, 0],
    escola: [22, 5, 3, 1],
  };

  it('has 489 words: the counts of every area and source, 135 that were already anchored and 354 that were added', () => {
    expect(DIARY_WORDS).toHaveLength(489);
    for (const [area, want] of Object.entries(TOTALS)) {
      const got = DIARY_SOURCES.map((src) => DIARY_WORDS.filter((w) => w.area === area && w.source === src).length);
      expect(got, area).toEqual(want);
    }
    expect(DIARY_AREAS.map((a) => a.id)).toEqual(Object.keys(TOTALS));
    expect(DIARY_WORDS.filter((w) => w.origin === 'existing')).toHaveLength(135);
    expect(DIARY_WORDS.filter((w) => w.origin === 'added')).toHaveLength(354);
    for (const w of DIARY_WORDS) expect(w.needsBr, w.id).toBe(true);
  });

  it('is a valid pack: nothing wrong with any anchor, and every reading and conversation word is in its text', () => {
    expect(diaryPackProblems(pack())).toEqual([]);
  });

  it('gives every camera word an object that exists in a room, a wall spot, the furniture catalog or the airport hall', () => {
    for (const w of DIARY_WORDS.filter((x) => x.source === 'camera')) {
      for (const id of [w.anchor.id, ...(w.also ?? [])]) expect(objectAnchorExists(id), `${w.pt}: ${id}`).toBe(true);
    }
    // an object taught nothing by the catalog is not a camera object
    expect(cameraObjectIds().has('lixeira_p1')).toBe(true);
    expect(cameraObjectIds().has('carteira')).toBe(true);
    expect(cameraObjectIds().has('canteiro_coreto_1')).toBe(false);
  });

  it('puts every added object in the room its area is about, on a tile the room has', () => {
    const roomsOf: Record<string, (keyof typeof ROOMS)[]> = { praca: ['praca'], rua: ['rua', 'rua_leste'], padaria: ['padaria'], feira: ['feira'], kitnet: ['kitnet'], academia: ['academia'], escola: ['escola'] };
    for (const w of DIARY_WORDS.filter((x) => x.origin === 'added' && x.source === 'camera' && x.area !== 'chegada')) {
      const rooms = roomsOf[w.area]!.map((r) => ROOMS[r]);
      const there = (id: string) => rooms.some((room) => room.props.some((p) => p.id === id)) || !!(id.startsWith('kitnet_') || id.startsWith('padaria_') || id === 'cobogo');
      expect(there(w.anchor.id), `${w.pt} (${w.anchor.id}) in ${w.area}`).toBe(true);
    }
    for (const w of DIARY_WORDS.filter((x) => x.origin === 'added' && x.source === 'reading' && x.area !== 'chegada')) {
      expect(roomsOf[w.area], `${w.pt} sign`).toContain(hotspotById(w.anchor.id)?.room);
    }
  });

  it('keeps practice and the jiu-jitsu fight out of the sources, and the game words to aula and the five Correria wins', () => {
    const game = DIARY_WORDS.filter((w) => w.source === 'game').map((w) => w.pt).sort();
    expect(game).toEqual(['aula', 'bolo', 'coxinha', 'guaraná', 'misto', 'queijo']);
    expect(DIARY_WORDS.filter((w) => w.area === 'academia' && w.source === 'game')).toEqual([]);
    expect(DIARY_GAMES.map((g) => g.id).sort()).toEqual(['correria', 'escola.pratica']);
    expect(DIARY_GAMES.find((g) => g.id === 'correria')).toMatchObject({ room: 'padaria', host: { npc: 'carlos' } });
    expect(DIARY_GAMES.find((g) => g.id === 'escola.pratica')).toMatchObject({ room: 'escola', host: { npc: 'lucia' }, rv: 8 });
    for (const pt of ['fonte', 'coreto', 'guia', 'aula']) expect(DIARY_WORDS.find((w) => w.pt === pt)?.seed, pt).toBe(true);
    expect(DIARY_WORDS.find((w) => w.pt === 'fonte')).toMatchObject({ source: 'camera', anchor: { id: 'fonte' } });
    expect(DIARY_WORDS.find((w) => w.pt === 'coreto')).toMatchObject({ source: 'reading', anchor: { id: 'coreto_placa' } });
    expect(DIARY_WORDS.find((w) => w.pt === 'guia')).toMatchObject({ source: 'conversation', anchor: { id: 'julia.ajuda' } });
    expect(DIARY_WORDS.find((w) => w.pt === 'aula')).toMatchObject({ source: 'game', anchor: { id: 'escola.pratica' } });
  });

  it('teaches every camera word an object names, in catalog order (a crate of melancias is a caixote and a melancia)', () => {
    expect(wordsForPhoto('caixote_3').map((w) => w.pt)).toEqual(['caixote', 'melancia']);
    expect(wordsForPhoto('caixote_1').map((w) => w.pt)).toEqual(['caixote']);
    expect(wordsForPhoto('coreto').map((w) => w.pt)).toEqual(['telhado', 'palco']);
    expect(wordsForPhoto('nada')).toEqual([]);
  });
});
