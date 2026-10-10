import { describe, expect, it } from 'vitest';
import { DIARY_AREAS, DIARY_WORDS, ESCOLA_MAX_BOX, freshEscola } from '@tudobem/shared';
import { DEFAULT_FILTER, FIRST_VISIT_FRESH_MAX, filterWords, journalModel, markWord, masteryOf, matchesQuery, searchAll, seenOnFirstVisit, type JournalWord } from './journalView';

const NOW = Date.UTC(2026, 9, 9, 12);
const model = (diary: string[], extra: Partial<Parameters<typeof journalModel>[0]> = {}) => journalModel({ diary, escola: undefined, seen: diary.length, now: NOW, ...extra });
const chapter = (m: ReturnType<typeof model>, id: string) => m.chapters.find((c) => c.id === id)!;

describe('the Diário as a sticker album', () => {
  it('has one chapter per area, and every catalog word is a numbered slot in its chapter', () => {
    const m = model([]);
    expect(m.chapters.map((c) => c.id)).toEqual(DIARY_AREAS.map((a) => a.id));
    expect(m.chapters.reduce((n, c) => n + c.total, 0)).toBe(DIARY_WORDS.length);
    expect(m.total).toBe(DIARY_WORDS.length);
    const chegada = chapter(m, 'chegada');
    expect(chegada.words.map((w) => w.no)).toEqual(chegada.words.map((_, i) => i + 1));
    expect(chegada.words.every((w) => !w.earned && w.order === -1)).toBe(true);
  });

  it('counts what was earned per chapter and per source, and marks a full chapter complete', () => {
    const ids = DIARY_WORDS.filter((w) => w.area === 'chegada').map((w) => w.id);
    const m = model(ids);
    const c = chapter(m, 'chegada');
    expect(c).toMatchObject({ earned: ids.length, total: ids.length, percent: 100, complete: true });
    expect(c.sources.reduce((n, s) => n + s.earned, 0)).toBe(ids.length);
    expect(chapter(m, 'praca')).toMatchObject({ earned: 0, complete: false, percent: 0 });
    expect(m.earned).toBe(ids.length);
  });

  it('remembers the order words were earned, and lists the latest first', () => {
    const m = model(['diary.chegada.mala', 'diary.chegada.passaporte', 'diary.padaria.bolo']);
    expect(m.recent.map((w) => w.id)).toEqual(['diary.padaria.bolo', 'diary.chegada.passaporte', 'diary.chegada.mala']);
    expect(chapter(m, 'chegada').words.find((w) => w.id === 'diary.chegada.passaporte')!.order).toBe(1);
  });

  it('takes the Escola box of each word: new, learning, nearly there, mastered; and what is due now', () => {
    const escola = freshEscola();
    escola.words['diary.chegada.mala'] = { b: ESCOLA_MAX_BOX, due: NOW + 1000, last: 0, n: 9, miss: 0 };
    escola.words['diary.chegada.passaporte'] = { b: 2, due: NOW - 1, last: 0, n: 2, miss: 0 };
    const m = model(['diary.chegada.mala', 'diary.chegada.passaporte', 'diary.chegada.esteira'], { escola });
    const w = (id: string) => chapter(m, 'chegada').words.find((x) => x.id === id)!;
    expect(w('diary.chegada.mala')).toMatchObject({ box: 5, mastery: 'dominada', due: false });
    expect(w('diary.chegada.passaporte')).toMatchObject({ box: 2, mastery: 'aprendendo', due: true });
    expect(w('diary.chegada.esteira')).toMatchObject({ box: 0, mastery: 'nova', due: false });
    expect(m).toMatchObject({ mastered: 1, studied: 2, due: 1 });
    expect(chapter(m, 'chegada').mastered).toBe(1);
    expect([0, 1, 2, 3, 4, 5].map(masteryOf)).toEqual(['nova', 'aprendendo', 'aprendendo', 'quase', 'quase', 'dominada']);
  });

  it('marks the words earned since the last visit as fresh', () => {
    const diary = ['diary.chegada.mala', 'diary.chegada.passaporte', 'diary.padaria.bolo'];
    const m = model(diary, { seen: 1 });
    expect(m.fresh.map((w) => w.id)).toEqual(['diary.chegada.passaporte', 'diary.padaria.bolo']);
    expect(chapter(m, 'chegada').fresh).toBe(1);
    expect(chapter(m, 'padaria').fresh).toBe(1);
    expect(model(diary, { seen: 99 }).fresh).toEqual([]);
    expect(seenOnFirstVisit(3)).toBe(0);
    expect(seenOnFirstVisit(FIRST_VISIT_FRESH_MAX + 1)).toBe(FIRST_VISIT_FRESH_MAX + 1);
  });

  it('puts the newest photo of a word on its sticker, and none on a word not earned', () => {
    const photos = [
      { id: 'a', at: 1, image: 'data:image/jpeg;old', wordId: 'diary.chegada.mala' },
      { id: 'b', at: 2, image: 'data:image/jpeg;new', wordId: 'diary.chegada.mala' },
      { id: 'c', at: 3, image: 'data:image/jpeg;x', wordId: 'diary.chegada.torre' },
    ];
    const m = model(['diary.chegada.mala'], { photos });
    const words = chapter(m, 'chegada').words;
    expect(words.find((w) => w.id === 'diary.chegada.mala')!.photo).toBe('data:image/jpeg;new');
    expect(words.find((w) => w.id === 'diary.chegada.torre')!.photo).toBeUndefined();
  });

  it('puts one shot of several things on the sticker of every word it taught', () => {
    const ids = ['diary.chegada.mala', 'diary.chegada.esteira', 'diary.chegada.etiqueta'];
    const photos = [
      { id: 'old', at: 1, image: 'data:image/jpeg;old', wordId: 'diary.chegada.esteira' },
      { id: 'shot', at: 2, image: 'data:image/jpeg;shot', wordId: ids[0], wordIds: ids },
    ];
    const words = chapter(model(ids, { photos }), 'chegada').words;
    for (const id of ids) expect(words.find((w) => w.id === id)!.photo).toBe('data:image/jpeg;shot');
  });

  it('says how an earned word was found, with its line or sign, and how to find one still missing without giving it away', () => {
    const m = model(['diary.padaria.cafezinho', 'diary.praca.wifi', 'diary.padaria.bolo']);
    const p = chapter(m, 'padaria');
    const talk = p.words.find((w) => w.id === 'diary.padaria.cafezinho')!;
    expect(talk.how.pt).toMatch(/^Ouvida de /);
    expect(talk.context?.toLowerCase()).toContain('cafezinho');
    expect(talk.speaker).toBeTruthy();
    const sign = p.words.find((w) => w.id === 'diary.praca.wifi')!;
    expect(sign.how.pt).toBe('Lida numa placa');
    expect(sign.context).toBeTruthy();
    expect(p.words.find((w) => w.id === 'diary.padaria.bolo')!.how.pt).toMatch(/^Ganha jogando com /);
    for (const w of p.words.filter((x) => !x.earned)) {
      expect(w.context).toBeUndefined();
      expect(w.how.pt.toLowerCase()).not.toContain(w.pt.toLowerCase());
    }
    const missingTalk = model([]).chapters.flatMap((c) => c.words).find((w) => w.source === 'conversation')!;
    expect(missingTalk.how.pt).toMatch(/^Converse com /);
  });
});

describe('looking through a chapter', () => {
  const words = (): JournalWord[] => {
    const escola = freshEscola();
    escola.words['diary.chegada.torre'] = { b: 5, due: NOW + 1, last: 0, n: 5, miss: 0 };
    escola.words['diary.chegada.mala'] = { b: 3, due: NOW + 1, last: 0, n: 3, miss: 0 };
    return chapter(model(['diary.chegada.torre', 'diary.chegada.mala', 'diary.chegada.passaporte', 'diary.chegada.bemvindo'], { escola }), 'chegada').words;
  };

  it('keeps the empty slots in album order, and lists only stickers in the other orders', () => {
    const all = words();
    expect(filterWords(all, DEFAULT_FILTER)).toHaveLength(all.length);
    expect(filterWords(all, { ...DEFAULT_FILTER, missing: false }).every((w) => w.earned)).toBe(true);
    expect(filterWords(all, { ...DEFAULT_FILTER, sort: 'recent' }).map((w) => w.pt)).toEqual(['bem-vindo', 'passaporte', 'mala', 'torre'].map((pt) => all.find((w) => w.pt.toLowerCase() === pt)?.pt ?? pt));
    expect(filterWords(all, { ...DEFAULT_FILTER, sort: 'az' }).map((w) => w.pt)[0]).toBe(filterWords(all, { ...DEFAULT_FILTER, sort: 'az' }).map((w) => w.pt).sort((a, b) => a.localeCompare(b, 'pt-BR'))[0]);
    expect(filterWords(all, { ...DEFAULT_FILTER, sort: 'mastery' }).slice(0, 2).map((w) => w.id)).toEqual(['diary.chegada.torre', 'diary.chegada.mala']);
  });

  it('filters by source', () => {
    const cam = filterWords(words(), { ...DEFAULT_FILTER, source: 'camera' });
    expect(cam.length).toBeGreaterThan(0);
    expect(cam.every((w) => w.source === 'camera')).toBe(true);
  });

  it('searches Portuguese and English, accents and case aside, and never shows a word not found yet', () => {
    expect(matchesQuery({ pt: 'alfândega', en: 'customs' }, 'ALFANDEGA')).toBe(true);
    expect(matchesQuery({ pt: 'alfândega', en: 'customs' }, 'cust')).toBe(true);
    expect(matchesQuery({ pt: 'alfândega', en: 'customs' }, 'mala')).toBe(false);
    const found = filterWords(words(), { ...DEFAULT_FILTER, query: 'pass' });
    expect(found.map((w) => w.id)).toEqual(['diary.chegada.passaporte']);
    expect(filterWords(words(), { ...DEFAULT_FILTER, query: 'esteira' })).toEqual([]);
  });

  it('searches the whole Diário, newest first', () => {
    const m = model(['diary.chegada.mala', 'diary.padaria.bolo', 'diary.padaria.cafezinho']);
    expect(searchAll(m, 'CAF').map((w) => w.id)).toEqual(['diary.padaria.cafezinho']);
    expect(searchAll(m, '')).toEqual([]);
  });
});

describe('the word inside its line', () => {
  it('underlines the word where the line says it, accents and case aside', () => {
    expect(markWord('Um cafezinho, por favor!', 'cafezinho')).toEqual([
      { text: 'Um ', hit: false },
      { text: 'cafezinho', hit: true },
      { text: ', por favor!', hit: false },
    ]);
    expect(markWord('ALFÂNDEGA à direita', 'alfandega')).toEqual([
      { text: 'ALFÂNDEGA', hit: true },
      { text: ' à direita', hit: false },
    ]);
    expect(markWord('Bom dia', 'tchau')).toEqual([{ text: 'Bom dia', hit: false }]);
  });
});
