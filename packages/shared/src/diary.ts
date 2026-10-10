/**
 * Language diary. Words live in `content/curriculum/phase0/diary-words.json` so a curriculum pass can
 * add Portuguese, a short English gloss, an area, a source, and an in-world anchor without a rewrite.
 *
 * One Portuguese word has one source (camera, reading, conversation, or game). A player earns each
 * word once. Progress denominators are counts of that file, never a number typed into the UI.
 */
import pack from '../../../content/curriculum/phase0/diary-words.json';
import { normalizeAnswer } from './accept.js';
import {
  DIARY_SOURCES,
  assertDiaryPack,
  asAnchor,
  diaryKey,
  type DiaryArea,
  type DiaryGame,
  type DiaryPack,
  type DiarySource,
  type DiaryWord,
} from './diaryPack.js';
import type { Bilingual } from './types.js';

export * from './diaryPack.js';

export const DIARY_SOURCE_LABEL: Record<DiarySource, Bilingual> = {
  camera: { pt: 'câmera', en: 'camera' },
  reading: { pt: 'leitura', en: 'reading' },
  conversation: { pt: 'conversa', en: 'conversation' },
  game: { pt: 'jogo', en: 'game' },
};

function loadPack(): DiaryPack {
  const areas = (pack.areas ?? []) as DiaryArea[];
  const words = ((pack.words ?? []) as DiaryWord[]).map((w) => ({ ...w, anchor: asAnchor(w.anchor)! }));
  const games = (pack.games ?? []) as DiaryGame[];
  const out = { areas, words, games };
  assertDiaryPack(out);
  return out;
}

const LOADED = loadPack();

export const DIARY_AREAS: readonly DiaryArea[] = LOADED.areas;
export const DIARY_WORDS: readonly DiaryWord[] = LOADED.words;
export const DIARY_GAMES: readonly DiaryGame[] = LOADED.games;

export const diaryArea = (id: string): DiaryArea | undefined => DIARY_AREAS.find((a) => a.id === id);
export const diaryWord = (id: string): DiaryWord | undefined => DIARY_WORDS.find((w) => w.id === id);
export const diaryGame = (id: string): DiaryGame | undefined => DIARY_GAMES.find((g) => g.id === id);
export const diaryGamesIn = (room: string): DiaryGame[] => DIARY_GAMES.filter((g) => g.room === room);

const anchorsOf = (w: DiaryWord): string[] => [w.anchor.id, ...(w.also ?? [])];

const PHOTO_INDEX = new Map<string, DiaryWord[]>();
const SIGN_INDEX = new Map<string, DiaryWord>();
const LINE_INDEX = new Map<string, DiaryWord>();
for (const w of DIARY_WORDS) {
  for (const id of anchorsOf(w)) {
    if (w.source === 'camera' && w.anchor.kind === 'object') PHOTO_INDEX.set(id, [...(PHOTO_INDEX.get(id) ?? []), w]);
    else if (w.source === 'reading' && w.anchor.kind === 'sign') SIGN_INDEX.set(id, w);
    else if (w.source === 'conversation' && w.anchor.kind === 'line') LINE_INDEX.set(id, w);
  }
}

export function cameraObjectIds(): ReadonlySet<string> {
  return new Set(PHOTO_INDEX.keys());
}

/** Every camera word an object teaches, in catalog order (a crate of melancias is a caixote and a melancia). */
export function wordsForPhoto(objectId: string): readonly DiaryWord[] {
  return PHOTO_INDEX.get(objectId) ?? [];
}

export function wordForSign(signId: string): DiaryWord | undefined {
  return SIGN_INDEX.get(signId);
}

export function wordForLine(lineId: string): DiaryWord | undefined {
  return LINE_INDEX.get(lineId);
}

/** The first ambient line (by index) of an NPC whose conversation word the player does not have yet, or null. Drives who speaks up next. */
export function unheardIdleLine(npc: string, lineCount: number, earned: readonly string[] | undefined): number | null {
  const have = new Set(normalizeDiary(earned));
  for (let i = 0; i < lineCount; i++) {
    const word = wordForLine(`${npc}.idle${i}`);
    if (word && !have.has(word.id)) return i;
  }
  return null;
}

/** The game word a win can teach: by served item for a correria shift, the one word of a practice game. */
export function gameWordFor(game: DiaryGame, item?: string): DiaryWord | undefined {
  const id = game.grants?.find((g) => g.item === item)?.wordId ?? (item === undefined ? game.grantWordId : undefined);
  return id ? diaryWord(id) : undefined;
}

/** Known earned ids, one per Portuguese word. Unknown ids drop out. Never throws. */
export function normalizeDiary(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const keys = new Set<string>();
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    const w = diaryWord(id);
    if (!w) continue;
    const key = diaryKey(w.pt);
    if (keys.has(key) || out.includes(w.id)) continue;
    keys.add(key);
    out.push(w.id);
  }
  return out;
}

export type GrantFail = 'unknown' | 'wrong-source' | 'already';

/**
 * Earn `wordId` from `via`. The word's own source must be `via`. A second earn, or the same
 * Portuguese from any source, is refused. Returns a new id list.
 */
export function grantDiaryWord(
  earned: readonly string[] | undefined,
  wordId: string,
  via: DiarySource,
): { ok: true; earned: string[]; word: DiaryWord } | { ok: false; reason: GrantFail; earned: string[] } {
  const have = normalizeDiary(earned);
  const w = diaryWord(wordId);
  if (!w) return { ok: false, reason: 'unknown', earned: have };
  if (w.source !== via) return { ok: false, reason: 'wrong-source', earned: have };
  if (have.includes(w.id) || have.some((id) => diaryKey(diaryWord(id)?.pt ?? '') === diaryKey(w.pt)))
    return { ok: false, reason: 'already', earned: have };
  return { ok: true, earned: [...have, w.id], word: w };
}

export interface SourceCount {
  source: DiarySource;
  label: Bilingual;
  earned: number;
  total: number;
}

export interface AreaBoard {
  id: string;
  pt: string;
  en: string;
  /** No words in the catalog for this area. The UI shows 0/0 instead of inventing a denominator. */
  empty: boolean;
  sources: SourceCount[];
  /** Earned words only, in catalog order, so the panel can group them under each source. */
  words: DiaryWord[];
}

/** Progress for one area. Sources with nothing in the catalog are omitted. An empty catalog is `empty`. */
export function areaBoard(areaId: string, earned: readonly string[] | undefined): AreaBoard {
  const area = diaryArea(areaId);
  const have = new Set(normalizeDiary(earned));
  const words = DIARY_WORDS.filter((w) => w.area === areaId);
  const sources: SourceCount[] = [];
  for (const source of DIARY_SOURCES) {
    const list = words.filter((w) => w.source === source);
    if (!list.length) continue;
    sources.push({
      source,
      label: DIARY_SOURCE_LABEL[source],
      total: list.length,
      earned: list.filter((w) => have.has(w.id)).length,
    });
  }
  return {
    id: areaId,
    pt: area?.pt ?? areaId,
    en: area?.en ?? areaId,
    empty: words.length === 0,
    sources,
    words: words.filter((w) => have.has(w.id)),
  };
}

/** Every catalog area, plus any earned word whose area is not listed yet. */
export function diaryBoard(earned: readonly string[] | undefined): AreaBoard[] {
  const ids = [...DIARY_AREAS.map((a) => a.id)];
  for (const id of normalizeDiary(earned)) {
    const area = diaryWord(id)?.area;
    if (area && !ids.includes(area)) ids.push(area);
  }
  return ids.map((id) => areaBoard(id, earned));
}

/** "1/1 câmera · 0/1 leitura" from the catalog counts. Empty area is "0/0". */
export function progressLine(board: AreaBoard): string {
  if (board.empty || !board.sources.length) return '0/0';
  return board.sources.map((s) => `${s.earned}/${s.total} ${s.label.pt}`).join(' · ');
}

export interface PracticeRound {
  wordId: string;
  en: string;
  options: string[];
}

/** A round over words the player already has. Null when there is nothing to practice. */
export function practiceRound(earned: readonly string[] | undefined, game: DiaryGame, rng: () => number): PracticeRound | null {
  const pool = normalizeDiary(earned).map((id) => diaryWord(id)).filter((w): w is DiaryWord => !!w);
  if (!pool.length) return null;
  const word = pool[Math.floor(rng() * pool.length) % pool.length]!;
  const wrongs: string[] = [];
  const seen = new Set<string>([diaryKey(word.pt)]);
  const add = (pt: string) => {
    const key = diaryKey(pt);
    if (!key || seen.has(key)) return;
    seen.add(key);
    wrongs.push(pt);
  };
  for (const w of DIARY_WORDS) add(w.pt);
  for (const d of game.decoys) add(d);
  const picks = shuffle(wrongs, rng).slice(0, 2);
  return { wordId: word.id, en: word.en, options: shuffle([word.pt, ...picks], rng) };
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/** A typed or tapped answer matches the word (accents and case optional). */
export function practiceCorrect(wordId: string, choice: string): boolean {
  const w = diaryWord(wordId);
  if (!w || typeof choice !== 'string') return false;
  return diaryKey(choice) === diaryKey(w.pt) || normalizeAnswer(choice) === normalizeAnswer(w.pt);
}

/**
 * Cartela (stamp card). That feature is not on main: there is no cartela module to grant.
 * Arrival calls this and still gives the camera. When the cartela PR lands, grant the card here.
 */
/** Júlia sells film. Counts live in the word file so a curriculum pass can change the price. */
const filmPack = (pack as { film?: { price?: number; pack?: number; starter?: number } }).film ?? {};
export const FILM = {
  price: positive(filmPack.price, 4),
  pack: positive(filmPack.pack, 6),
  starter: positive(filmPack.starter, 3),
  seller: 'julia' as const,
};

function positive(n: number | undefined, fallback: number): number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 99 ? n : fallback;
}

/** A prop this close (Chebyshev tiles) can sit inside the viewfinder. Farther than the talk range, because the frame can reach across the screen. */
export const PHOTO_RANGE = 8;

/**
 * The diary keeps every photo. This is only a guard for the server's disk (about 20 MB of jpegs per player at the cap), far past what film
 * allows in normal play; past it the oldest photo goes.
 */
export const PHOTO_KEEP = 1000;
/** Most photo images one request may ask for (a page of the photo wall, or the stickers on screen). */
export const PHOTO_IMAGES_PER_REQUEST = 24;
export const PHOTO_MAX_CHARS = 80_000;
/**
 * One diary photo plus the message around it. The socket used to stop at 16KB, so a phone shot
 * (a real jpeg) closed the connection before the handler ever saw it.
 */
export const WS_MAX_PAYLOAD = PHOTO_MAX_CHARS + 8 * 1024;

/**
 * One kept photo. The image is stored once, apart from the profile (the server's photo image store), and fetched by `id` when the diary shows
 * it; every word the shot taught points at it through `wordIds` (in the order they were taught), so a picture of three things is the photo of
 * all three words. `wordId` is the first of them, kept for saves and clients from before `wordIds`.
 */
export interface DiaryPhoto {
  id: string;
  at: number;
  wordId?: string;
  wordIds?: string[];
}

/** Most words one photo can name (the most objects one shot can name times a few words each). */
export const PHOTO_MAX_WORDS = 48;

/** The words a photo is the picture of, first taught first. An old save's single `wordId` counts as a list of one. */
export function photoWordIds(p: { wordId?: unknown; wordIds?: unknown }): string[] {
  const out: string[] = [];
  for (const id of [...(Array.isArray(p.wordIds) ? (p.wordIds as unknown[]) : []), p.wordId]) {
    if (typeof id !== 'string' || out.includes(id) || !diaryWord(id)) continue;
    out.push(id);
    if (out.length >= PHOTO_MAX_WORDS) break;
  }
  return out;
}

/** The photo the diary shows for a word: the newest kept photo that taught it (photos are newest first). */
export function photoForWord(photos: readonly DiaryPhoto[], wordId: string): DiaryPhoto | undefined {
  return photos.find((p) => photoWordIds(p).includes(wordId));
}

/**
 * A new shot at the front of the kept photos, linked to every word it taught (`wordIds`, none for a shot that taught nothing). `dropped`: the
 * ids that fell off past `PHOTO_KEEP` (their images can go too).
 */
export function addPhoto(photos: unknown, shot: { id: string; at: number; wordIds: readonly string[] }): { photos: DiaryPhoto[]; dropped: string[] } {
  const wordIds = photoWordIds({ wordIds: shot.wordIds });
  const photo: DiaryPhoto = { id: shot.id, at: shot.at, ...(wordIds.length ? { wordId: wordIds[0], wordIds } : {}) };
  const all = [photo, ...normalizePhotos(photos)];
  return { photos: all.slice(0, PHOTO_KEEP), dropped: all.slice(PHOTO_KEEP).map((p) => p.id) };
}

export function normalizeFilm(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.min(99, Math.max(0, n));
}

/** A jpeg data URL from the viewfinder, or null when it is missing or too big. */
export function photoImage(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('data:image/jpeg') || raw.length > PHOTO_MAX_CHARS) return null;
  return raw;
}

/**
 * The first viewfinder jpeg that fits on the socket. A larger one is not sent: the frame used to be
 * bigger than the server accepted, and the connection closed on the shot.
 */
export function pickPhotoUrl(candidates: readonly string[]): string | undefined {
  for (const url of candidates) {
    const ok = photoImage(url);
    if (ok) return ok;
  }
  return undefined;
}

const photoId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 40;

/** The kept photos, newest first, without images. A save from before the image store carried each `image` inline (see `inlinePhotoImages`). */
export function normalizePhotos(raw: unknown): DiaryPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: DiaryPhoto[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const at = (item as { at?: unknown }).at;
    if (!photoId(id) || seen.has(id) || typeof at !== 'number' || !Number.isFinite(at)) continue;
    // an old inline photo whose image never fit was never kept: it stays out
    if ('image' in item && !photoImage((item as { image?: unknown }).image)) continue;
    seen.add(id);
    const wordIds = photoWordIds(item as { wordId?: unknown; wordIds?: unknown });
    const photo: DiaryPhoto = { id, at };
    if (wordIds.length) {
      photo.wordId = wordIds[0];
      photo.wordIds = wordIds;
    }
    out.push(photo);
    if (out.length >= PHOTO_KEEP) break;
  }
  return out;
}

/** The images a save from before the image store kept inline on its photos (moved to the store when the profile loads). */
export function inlinePhotoImages(raw: unknown): { id: string; image: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; image: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const image = photoImage((item as { image?: unknown }).image);
    if (photoId(id) && image) out.push({ id, image });
  }
  return out;
}

/** The photo ids of a `photoImages` request: strings, no repeats, at most `PHOTO_IMAGES_PER_REQUEST`. */
export function photoImageRequest(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (!photoId(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= PHOTO_IMAGES_PER_REQUEST) break;
  }
  return out;
}

/** Júlia hands the cartela do bairro over with the camera (every profile already has a card; this is the story beat). */
export function handCartela(): { given: boolean; reason?: string } {
  return { given: true };
}

/**
 * Profiles saved before the arrival intro already live in Vila Ipê, so a missing flag counts as done.
 * Brand-new profiles set `arrivalIntroDone: false` before this runs.
 * A missing camera stays missing until the catch-up grant offers it (`owedGrants`).
 */
export function normalizeArrival(raw: { arrivalIntroDone?: unknown; hasCamera?: unknown } | null | undefined): {
  arrivalIntroDone: boolean;
  hasCamera: boolean;
} {
  return {
    arrivalIntroDone: typeof raw?.arrivalIntroDone === 'boolean' ? raw.arrivalIntroDone : true,
    hasCamera: raw?.hasCamera === true,
  };
}
