/**
 * Language diary. Words live in `content/curriculum/phase0/diary-words.json` so a curriculum pass can
 * add Portuguese, a short English gloss, an area, a source, and an in-world anchor without a rewrite.
 *
 * One Portuguese word has one source (camera, reading, conversation, or game). A player earns each
 * word once. Progress denominators are counts of that file, never a number typed into the UI.
 */
import pack from '../../../content/curriculum/phase0/diary-words.json';
import { normalizeAnswer } from './accept.js';
import { isNpcId } from './bonds.js';
import { hotspotById } from './hotspots.js';
import { NPC_TALK } from './npcTalk.js';
import { ROOMS, isRoomId } from './rooms.js';
import type { Bilingual } from './types.js';

export const DIARY_SOURCES = ['camera', 'reading', 'conversation', 'game'] as const;
export type DiarySource = (typeof DIARY_SOURCES)[number];

export const DIARY_SOURCE_LABEL: Record<DiarySource, Bilingual> = {
  camera: { pt: 'câmera', en: 'camera' },
  reading: { pt: 'leitura', en: 'reading' },
  conversation: { pt: 'conversa', en: 'conversation' },
  game: { pt: 'jogo', en: 'game' },
};

export type DiaryAnchor =
  | { kind: 'object'; id: string }
  | { kind: 'sign'; id: string }
  | { kind: 'line'; id: string }
  | { kind: 'game'; id: string };

export interface DiaryArea {
  id: string;
  pt: string;
  en: string;
}

export interface DiaryWord {
  id: string;
  pt: string;
  en: string;
  area: string;
  source: DiarySource;
  anchor: DiaryAnchor;
  /** Curriculum seed. The real list replaces these; the game does not special-case the flag. */
  seed?: boolean;
}

export interface DiaryGame {
  id: string;
  room: string;
  host: { npc: string; name: string };
  /** Virtual RV only. Beta does not charge real money. */
  rv: number;
  /** Granted once on a win, when still unearned. Omitted = the win pays RV and no new word. */
  grantWordId?: string;
  /** Extra wrong answers when the catalog is too small to fill the choices. */
  decoys: string[];
  seed?: boolean;
}

export interface DiaryPack {
  areas: DiaryArea[];
  words: DiaryWord[];
  games: DiaryGame[];
}

/** Accent- and case-insensitive key. One key, one word, one source. */
export function diaryKey(pt: string): string {
  return pt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const anchorKey = (a: DiaryAnchor) => `${a.kind}:${a.id}`;

function isSource(v: unknown): v is DiarySource {
  return typeof v === 'string' && (DIARY_SOURCES as readonly string[]).includes(v);
}

function asAnchor(raw: unknown): DiaryAnchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = (raw as { kind?: unknown }).kind;
  const id = (raw as { id?: unknown }).id;
  if (typeof id !== 'string' || !id) return null;
  if (k === 'object' || k === 'sign' || k === 'line' || k === 'game') return { kind: k, id };
  return null;
}

/**
 * Throws when the pack cannot be dropped in safely: duplicate Portuguese, a word whose anchor is not
 * in the world, a game whose reward word has the wrong source, an unknown area.
 */
export function assertDiaryPack(raw: DiaryPack): void {
  const areas = new Set<string>();
  for (const a of raw.areas) {
    if (!a.id || areas.has(a.id)) throw new Error(`diary: bad or duplicate area “${a.id}”`);
    areas.add(a.id);
  }
  const ids = new Set<string>();
  const pts = new Map<string, string>();
  const anchors = new Map<string, string>();
  for (const w of raw.words) {
    if (!w.id || ids.has(w.id)) throw new Error(`diary: bad or duplicate word id “${w.id}”`);
    ids.add(w.id);
    if (!w.pt || !w.en) throw new Error(`diary: “${w.id}” needs Portuguese and an English gloss`);
    if (!areas.has(w.area)) throw new Error(`diary: “${w.id}” uses unknown area “${w.area}”`);
    if (!isSource(w.source)) throw new Error(`diary: “${w.id}” has a bad source`);
    const anchor = asAnchor(w.anchor);
    if (!anchor || anchor.kind !== w.anchor.kind) throw new Error(`diary: “${w.id}” has a bad anchor`);
    const key = diaryKey(w.pt);
    const other = pts.get(key);
    if (other) throw new Error(`diary: “${w.pt}” is both ${other} and ${w.id} — one word, one source`);
    pts.set(key, w.id);
    const ak = anchorKey(anchor);
    if (anchors.has(ak)) throw new Error(`diary: anchor ${ak} is used by ${anchors.get(ak)} and ${w.id}`);
    anchors.set(ak, w.id);
    if (w.source === 'camera' && anchor.kind !== 'object') throw new Error(`diary: camera word “${w.id}” must anchor an object`);
    if (w.source === 'reading' && anchor.kind !== 'sign') throw new Error(`diary: reading word “${w.id}” must anchor a sign`);
    if (w.source === 'conversation' && anchor.kind !== 'line') throw new Error(`diary: conversation word “${w.id}” must anchor a line`);
    if (w.source === 'game' && anchor.kind !== 'game') throw new Error(`diary: game word “${w.id}” must anchor a game`);
    if (anchor.kind === 'object' && !Object.values(ROOMS).some((r) => r.props.some((p) => p.id === anchor.id)))
      throw new Error(`diary: no prop “${anchor.id}” for “${w.id}”`);
    if (anchor.kind === 'sign' && !hotspotById(anchor.id)) throw new Error(`diary: no sign “${anchor.id}” for “${w.id}”`);
    if (anchor.kind === 'line') {
      const dot = anchor.id.indexOf('.');
      const npc = dot < 0 ? '' : anchor.id.slice(0, dot);
      const node = dot < 0 ? '' : anchor.id.slice(dot + 1);
      const talk = isNpcId(npc) ? NPC_TALK[npc] : undefined;
      if (!talk?.nodes[node]) throw new Error(`diary: no NPC line “${anchor.id}” for “${w.id}”`);
    }
  }
  const games = new Set<string>();
  for (const g of raw.games) {
    if (!g.id || games.has(g.id)) throw new Error(`diary: bad or duplicate game “${g.id}”`);
    games.add(g.id);
    if (!isRoomId(g.room)) throw new Error(`diary: game “${g.id}” is not in a room`);
    if (!isNpcId(g.host?.npc) || !g.host.name) throw new Error(`diary: game “${g.id}” needs a host`);
    if (!Number.isInteger(g.rv) || g.rv < 0 || g.rv > 100) throw new Error(`diary: game “${g.id}” has a bad RV amount`);
    if (!Array.isArray(g.decoys) || g.decoys.some((d) => typeof d !== 'string' || !d)) throw new Error(`diary: game “${g.id}” has a bad decoy`);
    if (g.grantWordId) {
      const w = raw.words.find((x) => x.id === g.grantWordId);
      if (!w || w.source !== 'game' || w.anchor.kind !== 'game' || w.anchor.id !== g.id)
        throw new Error(`diary: “${g.id}” must grant a game-source word anchored to itself`);
    }
  }
  for (const w of raw.words) {
    if (w.source === 'game' && w.anchor.kind === 'game' && !games.has(w.anchor.id))
      throw new Error(`diary: “${w.id}” anchors missing game “${w.anchor.id}”`);
  }
}

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

export function cameraObjectIds(): ReadonlySet<string> {
  return new Set(DIARY_WORDS.filter((w) => w.source === 'camera' && w.anchor.kind === 'object').map((w) => w.anchor.id));
}

export function wordForPhoto(objectId: string): DiaryWord | undefined {
  return DIARY_WORDS.find((w) => w.source === 'camera' && w.anchor.kind === 'object' && w.anchor.id === objectId);
}

export function wordForSign(signId: string): DiaryWord | undefined {
  return DIARY_WORDS.find((w) => w.source === 'reading' && w.anchor.kind === 'sign' && w.anchor.id === signId);
}

export function wordForLine(lineId: string): DiaryWord | undefined {
  return DIARY_WORDS.find((w) => w.source === 'conversation' && w.anchor.kind === 'line' && w.anchor.id === lineId);
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
export function handCartela(): { given: false; reason: 'cartela-not-on-main' } {
  return { given: false, reason: 'cartela-not-on-main' };
}

/**
 * Profiles saved before the arrival intro already live in Vila Ipê, so a missing flag counts as done.
 * Brand-new profiles set `arrivalIntroDone: false` before this runs.
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
