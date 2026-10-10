/**
 * View-model of the Diário, drawn as an álbum de figurinhas: one chapter per place (Chegada, Praça, Rua, ...), every catalog word a
 * numbered slot in it. An earned word is a sticker (its Portuguese, the gloss, how it was found, its Escola box); a word still to find is
 * an empty slot that says how to find it (a photo, a sign, someone to talk to, a game) without giving the word away. Pure: the panel only
 * draws it, and the tests pin the rules.
 */
import {
  DIARY_AREAS,
  DIARY_WORDS,
  ESCOLA_MAX_BOX,
  currentStreak,
  diaryGame,
  diaryKey,
  diaryLine,
  hotspotById,
  localDay,
  normalizeDiary,
  normalizeEscola,
  npcDefById,
  type Bilingual,
  type DiaryPhoto,
  type DiarySource,
  type DiaryWord,
} from '@tudobem/shared';

/** Colour and emblem of each chapter (the index tab, the sticker border, the chapter title). Unknown areas get the last one. */
export const CHAPTER_STYLE: Record<string, { color: string; ink: string; emblem: string }> = {
  chegada: { color: '#3d8fd6', ink: '#1d4f80', emblem: 'aviao' },
  praca: { color: '#2e8a55', ink: '#1a5534', emblem: 'fonte' },
  rua: { color: '#7a6a5a', ink: '#45392e', emblem: 'onibus' },
  padaria: { color: '#c45c26', ink: '#7a3410', emblem: 'pao' },
  feira: { color: '#d4a017', ink: '#7a5a06', emblem: 'abacaxi' },
  kitnet: { color: '#d36b93', ink: '#7e2f4f', emblem: 'sofa' },
  academia: { color: '#7a4fb5', ink: '#432570', emblem: 'faixa' },
  escola: { color: '#2b5ba8', ink: '#16336a', emblem: 'lapis' },
  praia: { color: '#3fa9a0', ink: '#1f5f5a', emblem: 'peixe' },
};
const FALLBACK_STYLE = { color: '#8b5e3c', ink: '#4a2e18', emblem: 'lapis' };
export const chapterStyle = (id: string) => CHAPTER_STYLE[id] ?? FALLBACK_STYLE;

/** How far the Escola has taken a word: 0 found, never studied; 1-2 learning; 3-4 nearly there; 5 mastered. */
export type Mastery = 'nova' | 'aprendendo' | 'quase' | 'dominada';

// needs_br: true (labels)
export const MASTERY_LABEL: Record<Mastery, Bilingual> = {
  nova: { pt: 'Nova', en: 'New' },
  aprendendo: { pt: 'Aprendendo', en: 'Learning' },
  quase: { pt: 'Quase lá', en: 'Almost there' },
  dominada: { pt: 'Dominada', en: 'Mastered' },
};

export function masteryOf(box: number): Mastery {
  if (box >= ESCOLA_MAX_BOX) return 'dominada';
  if (box >= 3) return 'quase';
  if (box >= 1) return 'aprendendo';
  return 'nova';
}

// needs_br: true (labels)
export const SOURCE_LABEL: Record<DiarySource, Bilingual> = {
  camera: { pt: 'Foto', en: 'Photo' },
  reading: { pt: 'Placa', en: 'Sign' },
  conversation: { pt: 'Conversa', en: 'Talk' },
  game: { pt: 'Jogo', en: 'Game' },
};

export interface JournalWord {
  id: string;
  pt: string;
  en: string;
  area: string;
  source: DiarySource;
  /** The sticker number inside its chapter, 1-based, in catalog order. */
  no: number;
  earned: boolean;
  /** Position in the order the player earned words (0 = the first ever), -1 when not earned. */
  order: number;
  /** Escola box 0..5. */
  box: number;
  mastery: Mastery;
  /** Studied, and the Escola wants it again now. */
  due: boolean;
  /** Earned since the Diário was last opened. */
  fresh: boolean;
  /** The latest photo the player took of it. */
  photo?: string;
  /** Earned: how it was found ("Placa: PADARIA DO SEU CARLOS"). Not earned: how to find it, never the word. */
  how: Bilingual;
  /** The line or sign the word was read or heard in (earned words only). */
  context?: string;
  /** Who said it, for a conversation word. */
  speaker?: string;
  /** Their NPC id (the detail card shows their portrait). */
  speakerId?: string;
  /** What to underline in `context` (the headword, or the form the text prints). */
  mark: string;
}

export interface SourceTally {
  source: DiarySource;
  earned: number;
  total: number;
}

export interface JournalChapter {
  id: string;
  pt: string;
  en: string;
  color: string;
  ink: string;
  emblem: string;
  words: JournalWord[];
  earned: number;
  total: number;
  mastered: number;
  /** 0..100 */
  percent: number;
  /** Earned since the last visit. */
  fresh: number;
  sources: SourceTally[];
  complete: boolean;
}

export interface JournalModel {
  chapters: JournalChapter[];
  earned: number;
  total: number;
  mastered: number;
  studied: number;
  /** Words the Escola wants now (studied and due). */
  due: number;
  /** Earned since the last visit, oldest first. */
  fresh: JournalWord[];
  /** The last words earned, newest first. */
  recent: JournalWord[];
  streak: number;
  best: number;
  xp: number;
}

export interface JournalInput {
  diary: readonly string[] | undefined;
  escola: unknown;
  photos?: readonly DiaryPhoto[];
  /** How many diary words the player had seen when the Diário was last opened. */
  seen: number;
  now: number;
  tz?: number;
}

const RECENT = 8;

/** The name an NPC goes by in the world ("Seu Carlos"), or the id. */
const npcName = (id: string): string => npcDefById(id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);

/**
 * How a word was (or can be) found. A camera word never names its object: finding it is the game. A conversation word does name who
 * says it, so the album doubles as a guide to who to go and talk to.
 */
// needs_br: true (hint lines)
export function howFound(w: DiaryWord, earned: boolean, areaPt: string): { how: Bilingual; context?: string; speaker?: string; speakerId?: string } {
  if (w.source === 'camera') return earned ? { how: { pt: `Fotografada em: ${areaPt}`, en: `Photographed in: ${areaPt}` } } : { how: { pt: `Fotografe algo em: ${areaPt}`, en: `Photograph something in: ${areaPt}` } };
  if (w.source === 'reading') {
    const sign = hotspotById(w.anchor.id);
    if (!earned) return { how: { pt: `Leia uma placa em: ${areaPt}`, en: `Read a sign in: ${areaPt}` } };
    return { how: { pt: 'Lida numa placa', en: 'Read on a sign' }, context: sign?.pt.replace(/\n+/g, ' · ') };
  }
  if (w.source === 'conversation') {
    const line = diaryLine(w.anchor.id);
    const speakerId = line?.npc ?? w.anchor.id.split('.')[0] ?? '';
    const who = npcName(speakerId);
    if (!earned) return { how: { pt: `Converse com ${who}`, en: `Talk to ${who}` }, speaker: who, speakerId };
    return { how: { pt: `Ouvida de ${who}`, en: `Heard from ${who}` }, context: line?.pt, speaker: who, speakerId };
  }
  const gameId = w.anchor.id.split('.')[0] ?? w.anchor.id;
  const host = diaryGame(gameId)?.host.name ?? diaryGame(w.anchor.id)?.host.name;
  const who = host ?? areaPt;
  return earned ? { how: { pt: `Ganha jogando com ${who}`, en: `Won in a game with ${who}` } } : { how: { pt: `Vença um jogo com ${who}`, en: `Win a game with ${who}` } };
}

export function journalModel(input: JournalInput): JournalModel {
  const held = normalizeDiary(input.diary);
  const orderOf = new Map(held.map((id, i) => [id, i]));
  const seen = Math.max(0, Math.min(held.length, Math.floor(input.seen)));
  const escola = normalizeEscola(input.escola, held);
  // the newest photo of each word (photos arrive newest first; keep the first one met)
  const photoOf = new Map<string, string>();
  for (const p of [...(input.photos ?? [])].sort((a, b) => b.at - a.at)) if (p.wordId && !photoOf.has(p.wordId)) photoOf.set(p.wordId, p.image);

  const areaIds = DIARY_AREAS.map((a) => a.id);
  for (const w of DIARY_WORDS) if (!areaIds.includes(w.area)) areaIds.push(w.area);
  const byId = new Map<string, JournalWord>();
  const chapters: JournalChapter[] = areaIds.map((areaId) => {
    const area = DIARY_AREAS.find((a) => a.id === areaId);
    const pt = area?.pt ?? areaId;
    const style = chapterStyle(areaId);
    const words = DIARY_WORDS.filter((w) => w.area === areaId).map((w, i): JournalWord => {
      const order = orderOf.get(w.id) ?? -1;
      const earned = order >= 0;
      const st = escola.words[w.id];
      const box = earned ? (st?.b ?? 0) : 0;
      const jw: JournalWord = {
        id: w.id,
        pt: w.pt,
        en: w.en,
        area: areaId,
        source: w.source,
        no: i + 1,
        earned,
        order,
        box,
        mastery: masteryOf(box),
        due: earned && !!st && st.b > 0 && st.due <= input.now,
        fresh: earned && order >= seen,
        mark: w.match ?? w.pt,
        ...howFound(w, earned, pt),
      };
      const photo = earned ? photoOf.get(w.id) : undefined;
      if (photo) jw.photo = photo;
      byId.set(w.id, jw);
      return jw;
    });
    const earned = words.filter((w) => w.earned);
    const sources: SourceTally[] = (['camera', 'reading', 'conversation', 'game'] as const)
      .map((source) => ({ source, total: words.filter((w) => w.source === source).length, earned: earned.filter((w) => w.source === source).length }))
      .filter((s) => s.total > 0);
    return {
      id: areaId,
      pt,
      en: area?.en ?? areaId,
      ...style,
      words,
      earned: earned.length,
      total: words.length,
      mastered: earned.filter((w) => w.mastery === 'dominada').length,
      percent: words.length ? Math.round((earned.length / words.length) * 100) : 0,
      fresh: earned.filter((w) => w.fresh).length,
      sources,
      complete: words.length > 0 && earned.length === words.length,
    };
  });
  const all = held.map((id) => byId.get(id)).filter((w): w is JournalWord => !!w);
  const today = localDay(input.now, input.tz ?? escola.tz ?? 0);
  return {
    chapters,
    earned: all.length,
    total: DIARY_WORDS.length,
    mastered: all.filter((w) => w.mastery === 'dominada').length,
    studied: all.filter((w) => w.box > 0).length,
    due: all.filter((w) => w.due).length,
    fresh: all.filter((w) => w.fresh),
    recent: all.slice(-RECENT).reverse(),
    streak: currentStreak(escola, today),
    best: escola.best,
    xp: escola.xp,
  };
}

// ---------------------------------------------------------------- looking through a chapter

export type JournalSort = 'album' | 'recent' | 'az' | 'mastery';
export type SourceFilter = DiarySource | 'all';

export interface JournalFilter {
  source: SourceFilter;
  sort: JournalSort;
  /** Search text, matched against the Portuguese and the gloss of earned words (accents and case optional). */
  query: string;
  /** Keep the empty slots of words still to find (album order only; any other order lists stickers). */
  missing: boolean;
}

export const DEFAULT_FILTER: JournalFilter = { source: 'all', sort: 'album', query: '', missing: true };

/** A query matches a word's Portuguese or its English gloss, accents and case aside. Empty matches everything. */
export function matchesQuery(w: Pick<JournalWord, 'pt' | 'en'>, query: string): boolean {
  const q = diaryKey(query);
  if (!q) return true;
  return diaryKey(w.pt).includes(q) || diaryKey(w.en).includes(q);
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('pt-BR', { sensitivity: 'base' }) : null;

/**
 * The words a chapter shows under a filter. A search never reveals a word not yet found. Album order keeps the empty slots (when
 * `missing`); the other orders list earned stickers only.
 */
export function filterWords(words: readonly JournalWord[], f: JournalFilter): JournalWord[] {
  const searching = diaryKey(f.query) !== '';
  const keepMissing = f.missing && f.sort === 'album' && !searching;
  const out = words.filter((w) => (f.source === 'all' || w.source === f.source) && (w.earned ? matchesQuery(w, f.query) : keepMissing));
  if (f.sort === 'recent') out.sort((a, b) => b.order - a.order);
  else if (f.sort === 'az') out.sort((a, b) => (collator ? collator.compare(a.pt, b.pt) : a.pt.localeCompare(b.pt)));
  else if (f.sort === 'mastery') out.sort((a, b) => b.box - a.box || a.no - b.no);
  return out;
}

/** Every earned word of the whole Diário matching a search, in the order earned (newest first). */
export function searchAll(model: JournalModel, query: string): JournalWord[] {
  if (!diaryKey(query)) return [];
  return model.chapters
    .flatMap((c) => c.words)
    .filter((w) => w.earned && matchesQuery(w, query))
    .sort((a, b) => b.order - a.order);
}

// ---------------------------------------------------------------- the word inside its sentence

/** `text` split around the first place it says `pt` (accents and case aside), so the page can underline the word in its line. */
export function markWord(text: string, pt: string): { text: string; hit: boolean }[] {
  const fold = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // one folded character per original one keeps the indexes lined up
  const chars = [...text];
  const folded = chars.map((c) => (fold(c).length === 1 ? fold(c) : c.toLowerCase().charAt(0) || c));
  const hay = folded.join('');
  const needle = [...pt].map((c) => (fold(c).length === 1 ? fold(c) : c.toLowerCase().charAt(0) || c)).join('');
  const at = needle ? hay.indexOf(needle) : -1;
  if (at < 0) return [{ text, hit: false }];
  const end = at + [...needle].length;
  return [
    { text: chars.slice(0, at).join(''), hit: false },
    { text: chars.slice(at, end).join(''), hit: true },
    { text: chars.slice(end).join(''), hit: false },
  ].filter((s) => s.text.length > 0);
}

// ---------------------------------------------------------------- what is new since the last visit

/**
 * How many words count as already seen when this browser has no record yet. A small diary (a new player) shows all of its words as new,
 * so the first visit has stickers going in; a big one (an old player on a new device) does not light up hundreds of them.
 */
export const FIRST_VISIT_FRESH_MAX = 12;

export function seenOnFirstVisit(earned: number): number {
  return earned <= FIRST_VISIT_FRESH_MAX ? 0 : earned;
}
