import { normalizeAnswer } from './accept.js';
import { CARDS, cardById, type Card } from './cards.js';
import type { Bilingual } from './types.js';

/**
 * Caderno de palavras (HOWTO Phase 7 step 3): per curriculum card, how often the player saw it (an NPC
 * line, a sign), heard it (🔊) and used it (typed an accepted form, or chatted it). Pure helpers; the
 * server owns the events. It is bookkeeping, not a player-facing ledger: the tatame bank weighs its cards
 * by it (challenges.ts), and a finished group no longer pays (the Diário is the one word home).
 */
export interface CadernoEntry {
  seen: number;
  heard: number;
  used: number;
  /** First time any event touched the card (server ms). */
  firstAt: number;
}
export type Caderno = Record<string, CadernoEntry>;

/** A `heard` message may name at most this many cards. */
export const CADERNO_HEARD_MAX_IDS = 10;
const COUNT_CAP = 9999;

// ---------- finding cards in Portuguese text ----------

/** Same forgiveness as typed answers (accents, case, punctuation), and hyphens read as spaces (misto-quente). */
const norm = (s: string): string => normalizeAnswer(s).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Matcher {
  id: string;
  re: RegExp;
  len: number;
}

let matchers: Matcher[] | null = null;

/** Every spoken form of a card: its form and plural, each side of a slash ("Obrigado / Obrigada"). */
function formsOf(c: Card): string[] {
  const out = new Set<string>();
  for (const raw of [c.form, c.plural ?? '']) for (const part of raw.split('/')) if (norm(part)) out.add(norm(part));
  return [...out];
}

/** Longest forms first, so "pão de queijo" is consumed before "pão" can claim it. */
function buildMatchers(): Matcher[] {
  const list: Matcher[] = [];
  for (const c of CARDS)
    for (const f of formsOf(c)) list.push({ id: c.id, re: new RegExp(`(?<=^| )${escapeRe(f)}(?= |$)`, 'g'), len: f.length });
  return list.sort((a, b) => b.len - a.len);
}

/**
 * Card ids whose forms appear in a PT string: accent-insensitive, whole-word, longest form wins (so
 * "café com leite" does not also count "café"). Ids come back in card order. Never throws.
 */
export function cardsInText(text: string): string[] {
  return scan(text).ids;
}

/** The text in its normalized form with every card form replaced by `¤` (what is left is the free wording). */
export function maskCards(text: string): string {
  return scan(text).rest;
}

function scan(text: string): { ids: string[]; rest: string } {
  if (typeof text !== 'string' || !text) return { ids: [], rest: '' };
  let rest = norm(text.slice(0, 2000));
  const found = new Set<string>();
  if (rest)
    for (const m of (matchers ??= buildMatchers())) {
      m.re.lastIndex = 0;
      if (!m.re.test(rest)) continue;
      found.add(m.id);
      m.re.lastIndex = 0;
      rest = rest.replace(m.re, '¤');
    }
  return { ids: CARDS.filter((c) => found.has(c.id)).map((c) => c.id), rest };
}

// ---------- recording ----------

type Kind = 'seen' | 'heard' | 'used';

function record(caderno: Caderno | undefined, ids: readonly string[], now: number, kind: Kind): Caderno {
  const out: Caderno = { ...(caderno ?? {}) };
  for (const id of new Set(ids)) {
    if (!cardById(id)) continue;
    const cur = out[id] ?? { seen: 0, heard: 0, used: 0, firstAt: now };
    out[id] = { ...cur, [kind]: Math.min(COUNT_CAP, cur[kind] + 1) };
  }
  return out;
}

/** Each returns a new caderno; unknown ids are ignored and a repeated id in one call counts once. */
export const recordSeen = (c: Caderno | undefined, ids: readonly string[], now: number): Caderno => record(c, ids, now, 'seen');
export const recordHeard = (c: Caderno | undefined, ids: readonly string[], now: number): Caderno => record(c, ids, now, 'heard');
export const recordUsed = (c: Caderno | undefined, ids: readonly string[], now: number): Caderno => record(c, ids, now, 'used');

/** Old or hand-edited saves: keep only known cards with sane counters. Never throws. */
export function normalizeCaderno(raw: unknown): Caderno {
  const out: Caderno = {};
  if (!raw || typeof raw !== 'object') return out;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(COUNT_CAP, Math.floor(v)) : 0);
  for (const c of CARDS) {
    const e = (raw as Record<string, unknown>)[c.id];
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    const entry = { seen: n(r.seen), heard: n(r.heard), used: n(r.used), firstAt: n(r.firstAt) };
    if (entry.seen + entry.heard + entry.used > 0) out[c.id] = entry;
  }
  return out;
}

/** Groups an old save was paid for, back when a finished group paid RV. Kept on the profile; nothing pays any more. */
export function normalizeCadernoPaid(raw: unknown): string[] {
  const known = new Set(cadernoGroups().map((g) => g.id));
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [];
}

// ---------- groups ----------

/**
 * Cards learned in a group: seen AND (heard OR used), or simply used (typing it counts for everything).
 * Seeing alone is not enough, hearing alone is not enough.
 */
export function isLearned(e: CadernoEntry | undefined): boolean {
  return !!e && (e.used >= 1 || (e.seen >= 1 && e.heard >= 1));
}

/** The place/deck a card belongs to is the middle part of its id: `lex.<group>.<name>`. */
const GROUP_LABELS: Record<string, Bilingual> = {
  // needs_br: true
  padaria: { pt: 'Padaria', en: 'Bakery' },
  social: { pt: 'Cumprimentos', en: 'Greetings' },
  num: { pt: 'Números', en: 'Numbers' },
  // needs_br: true — the mat's ten commands (Treino no tatame)
  tatame: { pt: 'Tatame', en: 'On the mat' },
};

export interface CadernoGroup {
  id: string;
  label: Bilingual;
  cardIds: string[];
}

export const groupIdOf = (c: Pick<Card, 'id'>): string => c.id.split('.')[1] ?? 'outros';

let groups: CadernoGroup[] | null = null;

/** The groups in first-appearance order, each with its card ids (from the card pack; new packs group themselves). */
export function cadernoGroups(): CadernoGroup[] {
  if (groups) return groups;
  const by = new Map<string, CadernoGroup>();
  for (const c of CARDS) {
    const id = groupIdOf(c);
    let g = by.get(id);
    if (!g) by.set(id, (g = { id, label: GROUP_LABELS[id] ?? { pt: id[0]!.toUpperCase() + id.slice(1), en: id[0]!.toUpperCase() + id.slice(1) }, cardIds: [] }));
    g.cardIds.push(c.id);
  }
  return (groups = [...by.values()]);
}

export interface GroupProgress extends CadernoGroup {
  total: number;
  learned: number;
  complete: boolean;
}

export function groupProgress(caderno: Caderno | undefined): GroupProgress[] {
  return cadernoGroups().map((g) => {
    const learned = g.cardIds.filter((id) => isLearned(caderno?.[id])).length;
    return { ...g, total: g.cardIds.length, learned, complete: g.cardIds.length > 0 && learned === g.cardIds.length };
  });
}

/** Ids of groups whose every card is learned. */
export const completedGroups = (caderno: Caderno | undefined): string[] => groupProgress(caderno).filter((g) => g.complete).map((g) => g.id);
