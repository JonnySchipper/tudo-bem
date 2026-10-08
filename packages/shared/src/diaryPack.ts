/**
 * The shape of the language diary catalog and everything that can be wrong with one. No state: the catalog is loaded in diary.ts,
 * so a pack can be checked (and its problems listed) without it having to be valid first.
 */
import { isNpcId } from './bonds.js';
import { furnitureById } from './catalog.js';
import { diaryLine } from './diaryLines.js';
import { hotspotById } from './hotspots.js';
import { photoSpotById } from './photoSpots.js';
import { ROOMS, isRoomId } from './rooms.js';

export const DIARY_SOURCES = ['camera', 'reading', 'conversation', 'game'] as const;
export type DiarySource = (typeof DIARY_SOURCES)[number];

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
  /** More anchors of the same kind that teach the same word (the five benches, both lixeiras). */
  also?: string[];
  /** existing: the anchor was in the rooms before the catalog pass. added: the prop, sign, line or win was added for it. */
  origin?: 'existing' | 'added';
  /** A Brazilian has not signed off. True for every row until one does. */
  needsBr?: boolean;
  /** What the sign or line prints when that is not the headword itself (a plural, an abbreviation). */
  match?: string;
  note?: string;
  /** Curriculum seed. The real list replaces these; the game does not special-case the flag. */
  seed?: boolean;
}

export interface DiaryGame {
  id: string;
  /** practice: the escola practice screen. correria: a won shift of Correria no Balcão. */
  kind?: 'practice' | 'correria';
  room: string;
  host: { npc: string; name: string };
  /** Virtual RV only. Beta does not charge real money. */
  rv: number;
  /** Granted once on a win, when still unearned. Omitted = the win pays RV and no new word. */
  grantWordId?: string;
  /** A win that served one of these items can teach its word. Anchored as `<game id>.<item>`. */
  grants?: { item: string; wordId: string }[];
  /** Chance (0..1) that a win teaches its still-unearned word. Missing = always. */
  chance?: number;
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

export function asAnchor(raw: unknown): DiaryAnchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = (raw as { kind?: unknown }).kind;
  const id = (raw as { id?: unknown }).id;
  if (typeof id !== 'string' || !id) return null;
  if (k === 'object' || k === 'sign' || k === 'line' || k === 'game') return { kind: k, id };
  return null;
}

/** Where a camera object can be: a prop of a room, a photo spot (wall decor, part of a bigger sprite), or a piece of kitnet furniture. */
export function objectAnchorExists(id: string): boolean {
  return Object.values(ROOMS).some((r) => r.props.some((p) => p.id === id)) || !!photoSpotById(id) || !!furnitureById(id);
}

/** The Portuguese a sign or line prints, or null when there is no such anchor. */
function anchorText(anchor: DiaryAnchor): string | null {
  if (anchor.kind === 'sign') return hotspotById(anchor.id)?.pt ?? null;
  if (anchor.kind === 'line') return diaryLine(anchor.id)?.pt ?? null;
  return null;
}

/** A word appears in the text it is earned from (accents, case and plurals aside). */
export function textTeaches(text: string, pt: string, match?: string): boolean {
  return diaryKey(text).includes(diaryKey(match ?? pt));
}

/**
 * Everything wrong with a pack: duplicate Portuguese, a word whose anchor is not in the world, a reading or conversation word its
 * text does not contain, a game whose reward word has the wrong source, an unknown area. Camera objects may teach more than one
 * word (a crate of melancias is also a caixote); every other anchor teaches exactly one.
 */
export function diaryPackProblems(raw: DiaryPack): string[] {
  const out: string[] = [];
  const bad = (m: string) => void out.push(`diary: ${m}`);
  const areas = new Set<string>();
  for (const a of raw.areas) {
    if (!a.id || areas.has(a.id)) bad(`bad or duplicate area “${a.id}”`);
    areas.add(a.id);
  }
  const ids = new Set<string>();
  const pts = new Map<string, string>();
  const anchors = new Map<string, string>();
  for (const w of raw.words) {
    if (!w.id || ids.has(w.id)) bad(`bad or duplicate word id “${w.id}”`);
    ids.add(w.id);
    if (!w.pt || !w.en) bad(`“${w.id}” needs Portuguese and an English gloss`);
    if (!areas.has(w.area)) bad(`“${w.id}” uses unknown area “${w.area}”`);
    if (!isSource(w.source)) bad(`“${w.id}” has a bad source`);
    const anchor = asAnchor(w.anchor);
    if (!anchor || anchor.kind !== w.anchor.kind) {
      bad(`“${w.id}” has a bad anchor`);
      continue;
    }
    const key = diaryKey(w.pt);
    const other = pts.get(key);
    if (other) bad(`“${w.pt}” is both ${other} and ${w.id} — one word, one source`);
    pts.set(key, w.id);
    if (w.source === 'camera' && anchor.kind !== 'object') bad(`camera word “${w.id}” must anchor an object`);
    if (w.source === 'reading' && anchor.kind !== 'sign') bad(`reading word “${w.id}” must anchor a sign`);
    if (w.source === 'conversation' && anchor.kind !== 'line') bad(`conversation word “${w.id}” must anchor a line`);
    if (w.source === 'game' && anchor.kind !== 'game') bad(`game word “${w.id}” must anchor a game`);
    if (w.also?.length && (anchor.kind === 'game' || anchor.kind === 'line')) bad(`“${w.id}” cannot have extra anchors`);
    for (const id of [anchor.id, ...(w.also ?? [])]) {
      const one: DiaryAnchor = { kind: anchor.kind, id };
      const ak = anchorKey(one);
      if (anchor.kind !== 'object' && anchors.has(ak)) bad(`anchor ${ak} is used by ${anchors.get(ak)} and ${w.id}`);
      anchors.set(ak, w.id);
      if (anchor.kind === 'object' && !objectAnchorExists(id)) bad(`no object “${id}” for “${w.id}”`);
      if (anchor.kind === 'sign' || anchor.kind === 'line') {
        const text = anchorText(one);
        if (text == null) bad(`no ${anchor.kind} “${id}” for “${w.id}”`);
        else if (!textTeaches(text, w.pt, w.match)) bad(`“${w.pt}” is not in the ${anchor.kind} “${id}” (${text})`);
      }
    }
  }
  const games = new Set<string>();
  for (const g of raw.games) {
    if (!g.id || games.has(g.id)) bad(`bad or duplicate game “${g.id}”`);
    games.add(g.id);
    if (!isRoomId(g.room)) bad(`game “${g.id}” is not in a room`);
    if (!isNpcId(g.host?.npc) || !g.host.name) bad(`game “${g.id}” needs a host`);
    if (!Number.isInteger(g.rv) || g.rv < 0 || g.rv > 100) bad(`game “${g.id}” has a bad RV amount`);
    if (!Array.isArray(g.decoys) || g.decoys.some((d) => typeof d !== 'string' || !d)) bad(`game “${g.id}” has a bad decoy`);
    if (g.chance != null && !(g.chance > 0 && g.chance <= 1)) bad(`game “${g.id}” has a bad chance`);
    if (g.grantWordId) {
      const w = raw.words.find((x) => x.id === g.grantWordId);
      if (!w || w.source !== 'game' || w.anchor.kind !== 'game' || w.anchor.id !== g.id) bad(`“${g.id}” must grant a game-source word anchored to itself`);
    }
    for (const gr of g.grants ?? []) {
      const w = raw.words.find((x) => x.id === gr.wordId);
      if (!gr.item || !w || w.source !== 'game' || w.anchor.kind !== 'game' || w.anchor.id !== `${g.id}.${gr.item}`)
        bad(`“${g.id}” grant “${gr.item}” must be a game-source word anchored to ${g.id}.${gr.item}`);
    }
  }
  for (const w of raw.words) {
    if (w.source !== 'game' || w.anchor.kind !== 'game') continue;
    if (!raw.games.some((g) => g.id === w.anchor.id || w.anchor.id.startsWith(`${g.id}.`))) bad(`“${w.id}” anchors missing game “${w.anchor.id}”`);
  }
  return out;
}

/** Throws the first problem of a pack that cannot be dropped in safely. */
export function assertDiaryPack(raw: DiaryPack): void {
  const [first] = diaryPackProblems(raw);
  if (first) throw new Error(first);
}

