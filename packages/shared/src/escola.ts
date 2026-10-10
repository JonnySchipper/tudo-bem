/**
 * Escola da Praça: Dona Lúcia's lessons over the player's own diary words. Pure rules, shared by the server (which deals and checks) and the
 * client (which draws the path, the streak and the HUD chip from the profile). See docs/lifesim/DECISIONS.md "Escola: lessons, SRS, tiers".
 *
 * Spaced repetition is a small Leitner box per earned word (0 = found in the world, never studied; 5 = mastered). A lesson moves a word up one
 * box only when it was due, so mastery needs spaced visits (about two days for the first words), not one long cram. A miss drops it two boxes
 * and makes it due at once. Nameplate colours are earned by words mastered and never go down. XP, the streak and the daily goal are free
 * motivation only: no currency buys any of it.
 */
import { normalizeAnswer } from './accept.js';
import { ARRIVAL_LINES } from './arrival.js';
import { COUNTER_LINES, diaryLine } from './diaryLines.js';
import { DIARY_AREAS, DIARY_WORDS, diaryArea, diaryWord, normalizeDiary } from './diary.js';
import { diaryKey, type DiaryWord } from './diaryPack.js';
import { VENDORS } from './feira.js';
import { hotspotById } from './hotspots.js';
import { NPC_TALK, fillTalk } from './npcTalk.js';
import { npcDefById } from './rooms.js';
import { clampTz, dayDiff, playerDay } from './playerDay.js';
import type { Bilingual, Nameplate } from './types.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------- tuning (tests pin these)

/** Box a word is mastered at. */
export const ESCOLA_MAX_BOX = 5;

/** How long after reaching a box the word is due again. Box 1 is due at once (the next lesson); box 5 (mastered) is checked after 3 days. */
export const ESCOLA_INTERVAL_MS: Readonly<Record<number, number>> = { 1: 0, 2: 30 * MIN, 3: 6 * HOUR, 4: 20 * HOUR, 5: 3 * DAY };

/** A mastered word answered right again rests this long. */
export const ESCOLA_REVIEW_MS = 7 * DAY;

export const ESCOLA_LESSON = {
  /** Exercises in a lesson before the retries of the misses. */
  exercises: 10,
  /** A diary of one or two words still makes a lesson this long. */
  minExercises: 4,
  /** Different words a lesson focuses on. */
  words: 6,
  /** Brand-new words (found, never studied) introduced per lesson. */
  newWords: 3,
  /** Misses that come back at the end of the lesson. */
  retries: 3,
  /** Pairs in the match race (needs at least this many diary words). */
  pairs: 5,
  /** Options on a pick card. */
  options: 4,
} as const;

export const ESCOLA_XP = {
  /** A right answer. */
  right: 1,
  /** From this combo on, a right answer counts double. */
  comboAt: 5,
  comboRight: 2,
  /** Finishing a lesson. */
  lesson: 3,
  /** No miss in the whole lesson. */
  perfect: 5,
  /** The word mission: a new word found in the suggested area the same day. */
  mission: 5,
} as const;

export const ESCOLA_GOALS = [10, 20, 30] as const;
export type EscolaGoal = (typeof ESCOLA_GOALS)[number];
export const ESCOLA_DEFAULT_GOAL: EscolaGoal = 10;

/** Virtual RV only (beta is free): R$1 per right first answer, capped per lesson and per day so the desk is not a farm. */
export const ESCOLA_RV = { perRight: 1, perLesson: 10, perDay: 30 } as const;

/** A streak freeze is earned every 7 streak days (at most 2 held). Never bought. */
export const ESCOLA_FREEZE = { every: 7, max: 2 } as const;

export interface TierRule {
  tier: Nameplate;
  /** Words at the top box. */
  mastered: number;
  /** Best streak ever, in days (dourado only). */
  streak?: number;
  pt: string;
  en: string;
}

/** Nameplate colours by words mastered. Never by RV, never for sale. */
export const NAMEPLATE_TIERS: readonly TierRule[] = [
  { tier: 'verde', mastered: 0, pt: 'Verde', en: 'Green' },
  { tier: 'amarelo', mastered: 15, pt: 'Amarela', en: 'Yellow' },
  { tier: 'azul', mastered: 60, pt: 'Azul', en: 'Blue' },
  { tier: 'roxo', mastered: 150, pt: 'Roxa', en: 'Purple' },
  { tier: 'dourado', mastered: 300, streak: 30, pt: 'Dourada', en: 'Gold' },
];

const TIER_ORDER: readonly Nameplate[] = NAMEPLATE_TIERS.map((t) => t.tier);
export const tierRank = (t: Nameplate | undefined): number => Math.max(0, TIER_ORDER.indexOf(t ?? 'verde'));
export const tierRule = (t: Nameplate): TierRule => NAMEPLATE_TIERS[tierRank(t)]!;
const isTier = (v: unknown): v is Nameplate => typeof v === 'string' && (TIER_ORDER as readonly string[]).includes(v);

// ---------------------------------------------------------------- state

export interface EscolaWordState {
  /** Leitner box 0..5. */
  b: number;
  /** When it is due again (ms). */
  due: number;
  /** Last answered (ms). */
  last: number;
  /** Times answered. */
  n: number;
  /** Times missed. */
  miss: number;
}

export interface EscolaState {
  /** Per diary word id. A diary word with no entry is new (box 0). */
  words: Record<string, EscolaWordState>;
  /** Lifetime XP. */
  xp: number;
  lessons: number;
  perfect: number;
  goal: EscolaGoal;
  /** The player's local day (YYYY-MM-DD) `dayXp` counts. */
  day?: string;
  dayXp: number;
  streak: number;
  /** Best streak ever (dourado needs 30). */
  best: number;
  /** Local day of the last finished lesson. */
  lastDay?: string;
  freezes: number;
  /** Highest nameplate earned. Never goes down. */
  tier: Nameplate;
  /** RV paid on a local day (the daily cap). */
  rv?: { day: string; n: number };
  /** Minutes east of UTC, from the player's browser (clamped). */
  tz?: number;
  /** Today's word mission: find a new word in this area for bonus XP. */
  mission?: { day: string; area: string; done: boolean };
}

export function freshEscola(): EscolaState {
  return { words: {}, xp: 0, lessons: 0, perfect: 0, goal: ESCOLA_DEFAULT_GOAL, dayXp: 0, streak: 0, best: 0, freezes: 0, tier: 'verde' };
}

const int = (v: unknown, lo: number, hi: number, d = lo): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);
const dayStr = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/**
 * A saved escola state, repaired. Old profiles have none: every diary word they hold is learned (box 0, new) and nothing is mastered, so
 * they start Verde. Entries for words no longer in the diary drop out. Never throws.
 */
export function normalizeEscola(raw: unknown, diary: readonly string[] | undefined): EscolaState {
  const out = freshEscola();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<Record<keyof EscolaState, unknown>>;
  const held = new Set(normalizeDiary(diary));
  const words = r.words && typeof r.words === 'object' ? (r.words as Record<string, unknown>) : {};
  for (const [id, w] of Object.entries(words)) {
    if (!held.has(id) || !w || typeof w !== 'object') continue;
    const x = w as Partial<Record<keyof EscolaWordState, unknown>>;
    out.words[id] = { b: int(x.b, 0, ESCOLA_MAX_BOX), due: int(x.due, 0, Number.MAX_SAFE_INTEGER), last: int(x.last, 0, Number.MAX_SAFE_INTEGER), n: int(x.n, 0, 1e6), miss: int(x.miss, 0, 1e6) };
  }
  out.xp = int(r.xp, 0, 1e9);
  out.lessons = int(r.lessons, 0, 1e7);
  out.perfect = int(r.perfect, 0, 1e7);
  out.goal = (ESCOLA_GOALS as readonly number[]).includes(r.goal as number) ? (r.goal as EscolaGoal) : ESCOLA_DEFAULT_GOAL;
  out.day = dayStr(r.day);
  out.dayXp = out.day ? int(r.dayXp, 0, 1e6) : 0;
  out.streak = int(r.streak, 0, 1e5);
  out.best = Math.max(out.streak, int(r.best, 0, 1e5));
  out.lastDay = dayStr(r.lastDay);
  out.freezes = int(r.freezes, 0, ESCOLA_FREEZE.max);
  out.tier = isTier(r.tier) ? r.tier : 'verde';
  const rv = r.rv as { day?: unknown; n?: unknown } | undefined;
  if (rv && dayStr(rv.day)) out.rv = { day: rv.day as string, n: int(rv.n, 0, 1e4) };
  if (typeof r.tz === 'number') out.tz = clampTz(r.tz);
  const m = r.mission as { day?: unknown; area?: unknown; done?: unknown } | undefined;
  if (m && dayStr(m.day) && typeof m.area === 'string' && diaryArea(m.area)) out.mission = { day: m.day as string, area: m.area, done: m.done === true };
  return out;
}

// ---------------------------------------------------------------- days

/**
 * The player's calendar day (YYYY-MM-DD) at `now`, `tz` minutes east of UTC (the browser's `-getTimezoneOffset()`).
 * The Escola's name for `playerDay` (playerDay.ts), the one day boundary every cap uses.
 */
export const localDay: (now: number, tz?: number) => string = playerDay;

/** The streak as it stands today: alive if the last lesson was today or yesterday (or the gap is covered by freezes), else 0. */
export function currentStreak(st: Pick<EscolaState, 'streak' | 'lastDay' | 'freezes'>, today: string): number {
  if (!st.lastDay || st.streak <= 0) return 0;
  const gap = dayDiff(st.lastDay, today);
  if (gap <= 1) return st.streak;
  return gap - 1 <= st.freezes ? st.streak : 0;
}

/** Did a lesson already count today? */
export const studiedToday = (st: Pick<EscolaState, 'lastDay'>, today: string): boolean => st.lastDay === today;

export interface StreakBump {
  streak: number;
  /** The streak grew today (false: today already counted). */
  extended: boolean;
  usedFreezes: number;
  earnedFreeze: boolean;
}

/** A finished lesson on `today`: the streak grows once per day; a gap is bridged by freezes when there are enough, else it restarts at 1. */
export function bumpStreak(st: EscolaState, today: string): StreakBump {
  if (st.lastDay === today) return { streak: st.streak, extended: false, usedFreezes: 0, earnedFreeze: false };
  const gap = st.lastDay ? dayDiff(st.lastDay, today) : Infinity;
  let used = 0;
  // a clock that went backwards does not break a streak (and does not grow it either)
  if (gap < 0) return { streak: st.streak, extended: false, usedFreezes: 0, earnedFreeze: false };
  if (gap === 1 && st.streak > 0) st.streak += 1;
  else if (Number.isFinite(gap) && gap > 1 && st.streak > 0 && gap - 1 <= st.freezes) {
    used = gap - 1;
    st.freezes -= used;
    st.streak += 1;
  } else st.streak = 1;
  st.lastDay = today;
  st.best = Math.max(st.best, st.streak);
  let earned = false;
  if (st.streak % ESCOLA_FREEZE.every === 0 && st.freezes < ESCOLA_FREEZE.max) {
    st.freezes += 1;
    earned = true;
  }
  return { streak: st.streak, extended: true, usedFreezes: used, earnedFreeze: earned };
}

/** XP earned today (0 on a new day). */
export const todayXp = (st: Pick<EscolaState, 'day' | 'dayXp'>, today: string): number => (st.day === today ? st.dayXp : 0);

/** Add XP to the lifetime and today's total. True when this crossed today's goal. */
export function addXp(st: EscolaState, today: string, xp: number): boolean {
  if (st.day !== today) {
    st.day = today;
    st.dayXp = 0;
  }
  const before = st.dayXp;
  st.dayXp += xp;
  st.xp += xp;
  return before < st.goal && st.dayXp >= st.goal;
}

/** The RV the desk may still pay today, and in this lesson (`paidThisLesson` so far). */
export function rvRoom(st: EscolaState, today: string, paidThisLesson: number): number {
  const day = st.rv?.day === today ? st.rv.n : 0;
  return Math.max(0, Math.min(ESCOLA_RV.perLesson - paidThisLesson, ESCOLA_RV.perDay - day));
}

export function payRv(st: EscolaState, today: string, n: number) {
  st.rv = { day: today, n: (st.rv?.day === today ? st.rv.n : 0) + n };
}

// ---------------------------------------------------------------- spaced repetition

export const wordBox = (st: EscolaState, id: string): number => st.words[id]?.b ?? 0;

/** New (never studied) or past its due time. */
export function isDue(w: EscolaWordState | undefined, now: number): boolean {
  return !w || w.b === 0 || w.due <= now;
}

/**
 * One word's result in a lesson (its first try each time it came up; one miss makes it a miss). A due word answered right goes up a box;
 * a word that was not due yet stays where it is (practice, no strength); a miss drops two boxes (not below 1) and is due again at once.
 */
export function reviewWord(w: EscolaWordState | undefined, right: boolean, now: number): EscolaWordState {
  const cur = w ?? { b: 0, due: 0, last: 0, n: 0, miss: 0 };
  const next = { ...cur, n: cur.n + 1, last: now };
  if (!right) {
    next.miss += 1;
    next.b = Math.max(1, cur.b - 2);
    next.due = now;
    return next;
  }
  if (!isDue(cur, now)) return next;
  if (cur.b >= ESCOLA_MAX_BOX) {
    next.due = now + ESCOLA_REVIEW_MS;
    return next;
  }
  next.b = cur.b + 1;
  next.due = now + (ESCOLA_INTERVAL_MS[next.b] ?? 0);
  return next;
}

export interface WordCounts {
  /** In the diary. */
  learned: number;
  /** Studied at least once (box >= 1). */
  studied: number;
  mastered: number;
  /** Words in the catalog (the denominator). */
  catalog: number;
  /** Still to find in the world. */
  toFind: number;
  /** Due now (studied words past their time) and new (never studied). */
  due: number;
  fresh: number;
}

export function wordCounts(st: EscolaState, diary: readonly string[] | undefined, now: number, area?: string): WordCounts {
  const held = normalizeDiary(diary).filter((id) => !area || diaryWord(id)?.area === area);
  const catalog = area ? DIARY_WORDS.filter((w) => w.area === area).length : DIARY_WORDS.length;
  let studied = 0;
  let mastered = 0;
  let due = 0;
  let fresh = 0;
  for (const id of held) {
    const w = st.words[id];
    if (!w || w.b === 0) fresh++;
    else {
      studied++;
      if (w.b >= ESCOLA_MAX_BOX) mastered++;
      if (w.due <= now) due++;
    }
  }
  return { learned: held.length, studied, mastered, catalog, toFind: Math.max(0, catalog - held.length), due, fresh };
}

export const masteredCount = (st: EscolaState, diary: readonly string[] | undefined): number =>
  normalizeDiary(diary).filter((id) => (st.words[id]?.b ?? 0) >= ESCOLA_MAX_BOX).length;

// ---------------------------------------------------------------- tiers

/** The highest tier `mastered` words (and a best streak of `best` days) reach. */
export function tierFor(mastered: number, best: number): Nameplate {
  let out: Nameplate = 'verde';
  for (const t of NAMEPLATE_TIERS) if (mastered >= t.mastered && best >= (t.streak ?? 0)) out = t.tier;
  return out;
}

/** The plate this player has earned: the stored one, or better if the words say so. Never lower than stored. */
export function earnedTier(st: EscolaState, diary: readonly string[] | undefined): Nameplate {
  const now = tierFor(masteredCount(st, diary), st.best);
  return tierRank(now) > tierRank(st.tier) ? now : st.tier;
}

export interface TierProgress {
  tier: Nameplate;
  next: TierRule | null;
  mastered: number;
  /** Mastered words the next tier needs. */
  need: number;
  /** 0..1 from the current tier's threshold to the next. */
  frac: number;
  /** The next tier also wants a best streak this long (dourado). */
  streakNeed?: number;
  best: number;
}

export function tierProgress(st: EscolaState, diary: readonly string[] | undefined): TierProgress {
  const tier = earnedTier(st, diary);
  const mastered = masteredCount(st, diary);
  const next = NAMEPLATE_TIERS[tierRank(tier) + 1] ?? null;
  if (!next) return { tier, next: null, mastered, need: 0, frac: 1, best: st.best };
  const from = Math.min(tierRule(tier).mastered, next.mastered);
  const frac = Math.max(0, Math.min(1, (mastered - from) / Math.max(1, next.mastered - from)));
  return { tier, next, mastered, need: Math.max(0, next.mastered - mastered), frac, ...(next.streak ? { streakNeed: next.streak } : {}), best: st.best };
}

// ---------------------------------------------------------------- the path (units by area) and the hunts

/** Nodes on a unit: four lessons and the checkpoint. */
export const UNIT_NODES = 5;

export type NodeState = 'done' | 'current' | 'locked';

export interface UnitView {
  id: string;
  pt: string;
  en: string;
  total: number;
  found: number;
  studied: number;
  mastered: number;
  /** 0..1: the area's word strength (box sum over 5 x catalog words). */
  strength: number;
  /** 0..5, one per node done. */
  crowns: number;
  nodes: NodeState[];
  hunt: Hunt | null;
}

/** Areas in the order a new arrival meets them. */
export const UNIT_ORDER = ['chegada', 'praca', 'rua', 'padaria', 'feira', 'kitnet', 'academia', 'escola', 'petshop', 'praia'] as const;

export function escolaPath(st: EscolaState, diary: readonly string[] | undefined): UnitView[] {
  const held = new Set(normalizeDiary(diary));
  const ids = [...UNIT_ORDER.filter((id) => diaryArea(id)), ...DIARY_AREAS.map((a) => a.id).filter((id) => !(UNIT_ORDER as readonly string[]).includes(id))];
  const hunts = new Map(areaHunts(diary).map((h) => [h.area, h]));
  return ids.map((id) => {
    const area = diaryArea(id)!;
    const words = DIARY_WORDS.filter((w) => w.area === id);
    let sum = 0;
    let studied = 0;
    let mastered = 0;
    let found = 0;
    for (const w of words) {
      if (!held.has(w.id)) continue;
      found++;
      const b = st.words[w.id]?.b ?? 0;
      sum += b;
      if (b >= 1) studied++;
      if (b >= ESCOLA_MAX_BOX) mastered++;
    }
    const strength = words.length ? sum / (ESCOLA_MAX_BOX * words.length) : 0;
    // a node per fifth of the area's full strength; a little slack so float sums do not hold the last one back
    const crowns = Math.min(UNIT_NODES, Math.floor(strength * UNIT_NODES + 1e-9));
    const nodes: NodeState[] = Array.from({ length: UNIT_NODES }, (_, i) => (i < crowns ? 'done' : i === crowns ? 'current' : 'locked'));
    return { id, pt: area.pt, en: area.en, total: words.length, found, studied, mastered, strength, crowns, nodes, hunt: hunts.get(id) ?? null };
  });
}

export interface Hunt {
  area: string;
  missing: number;
  /** "Faltam 5 palavras pra descobrir na feira" */
  line: Bilingual;
  /** Where to look, never the word itself. */
  hint: Bilingual;
}

/** "na feira" / "at the street market", for the hunt lines. */
export const AREA_IN: Record<string, Bilingual> = {
  chegada: { pt: 'no aeroporto', en: 'at the airport' },
  praca: { pt: 'na praça', en: 'in the square' },
  rua: { pt: 'na rua', en: 'on the street' },
  padaria: { pt: 'na padaria', en: 'at the bakery' },
  feira: { pt: 'na feira', en: 'at the street market' },
  kitnet: { pt: 'na kitnet', en: 'in the studio apartment' },
  academia: { pt: 'na academia', en: 'at the gym' },
  escola: { pt: 'na escola', en: 'at the school' },
  petshop: { pt: 'no pet shop', en: 'at the pet shop' },
  praia: { pt: 'na praia', en: 'at the beach' },
};

const GAME_HINT: Record<string, Bilingual> = {
  // needs_br: true. Names no fishing word (the hunt never gives a word away).
  pesca: { pt: 'Vá pescar na praia, de dia e de noite.', en: 'Go fishing at the beach, by day and by night.' },
  correria: { pt: 'Jogue a Correria no Balcão com o Seu Carlos.', en: 'Play Correria no Balcão with Seu Carlos.' },
  'escola.pratica': { pt: 'Termine uma lição com a Dona Lúcia.', en: 'Finish a lesson with Dona Lúcia.' },
};

const inArea = (area: string): Bilingual => AREA_IN[area] ?? { pt: `em ${diaryArea(area)?.pt ?? area}`, en: `in ${diaryArea(area)?.en ?? area}` };

function speakerOf(w: DiaryWord): string | null {
  if (w.anchor.kind !== 'line') return null;
  const npc = diaryLine(w.anchor.id)?.npc ?? w.anchor.id.split('.')[0]!;
  return npcDefById(npc as never)?.name ?? null;
}

/** Hint for a set of missing words of one area: by the source most of them come from (camera, signs, a neighbour, a game). */
function huntHint(area: string, missing: readonly DiaryWord[]): Bilingual {
  const where = inArea(area);
  const by = new Map<string, DiaryWord[]>();
  for (const w of missing) by.set(w.source, [...(by.get(w.source) ?? []), w]);
  const [source, list] = [...by].sort((a, b) => b[1].length - a[1].length)[0]!;
  // needs_br: true
  if (source === 'camera') return { pt: `Tire foto das coisas ${where.pt}.`, en: `Take photos of things ${where.en}.` };
  if (source === 'reading') return { pt: `Leia as placas ${where.pt}.`, en: `Read the signs ${where.en}.` };
  if (source === 'conversation') {
    // the pet shop's pen words come from petting the animals (Seu Dito says the line)
    if (list.every((w) => diaryLine(w.anchor.id)?.kind === 'pen')) return { pt: 'Faça carinho nos bichinhos do pet shop.', en: 'Pet the animals at the pet shop.' };
    const names = [...new Set(list.map(speakerOf).filter((n): n is string => !!n))].slice(0, 2);
    if (names.length) return { pt: `Converse com ${names.join(' e ')}.`, en: `Talk to ${names.join(' and ')}.` };
    return { pt: `Converse com o pessoal ${where.pt}.`, en: `Talk to people ${where.en}.` };
  }
  const game = list[0]!.anchor.id.split('.')[0]!;
  return GAME_HINT[game] ?? GAME_HINT[list[0]!.anchor.id] ?? { pt: `Jogue ${where.pt}.`, en: `Play a game ${where.en}.` };
}

/** Per area with words still to find: how many, and where to look (from the catalog's anchors, without naming a word). */
export function areaHunts(diary: readonly string[] | undefined): Hunt[] {
  const held = new Set(normalizeDiary(diary));
  const out: Hunt[] = [];
  for (const area of DIARY_AREAS) {
    const missing = DIARY_WORDS.filter((w) => w.area === area.id && !held.has(w.id));
    if (!missing.length) continue;
    const where = inArea(area.id);
    const n = missing.length;
    // needs_br: true
    const line =
      n === 1
        ? { pt: `Falta 1 palavra pra descobrir ${where.pt}`, en: `1 word left to find ${where.en}` }
        : { pt: `Faltam ${n} palavras pra descobrir ${where.pt}`, en: `${n} words left to find ${where.en}` };
    out.push({ area: area.id, missing: n, line, hint: huntHint(area.id, missing) });
  }
  return out;
}

/** Today's word mission: an area with words to find, turning by day so it is not always the same one. Null when the diary is full. */
export function pickMission(diary: readonly string[] | undefined, today: string): Hunt | null {
  const hunts = areaHunts(diary);
  if (!hunts.length) return null;
  // the areas with the most left first, then the day picks among the top three
  const top = [...hunts].sort((a, b) => b.missing - a.missing).slice(0, 3);
  const n = Math.abs(dayDiff('2026-01-01', today));
  return top[n % top.length]!;
}

// ---------------------------------------------------------------- the lines a word came from (build-the-phrase)

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The Portuguese line (and its English) a reading or conversation word was earned from, as the player saw it: one line of a sign, a
 * neighbour's sentence. Null for camera and game words, lines that need the player's name, and lines without an English gloss.
 */
export function sourceLine(w: DiaryWord): Bilingual | null {
  if (w.anchor.kind === 'sign') {
    const hs = hotspotById(w.anchor.id);
    if (!hs) return null;
    const pts = hs.pt.split('\n');
    const ens = hs.en.split('\n');
    const i = pts.findIndex((l) => diaryKey(l).includes(diaryKey(w.match ?? w.pt)));
    if (i < 0) return null;
    const en = pts.length === ens.length ? ens[i]! : pts.length === 1 ? hs.en.replace(/\n/g, ' ') : null;
    return en ? { pt: clean(pts[i]!), en: clean(en) } : null;
  }
  if (w.anchor.kind !== 'line') return null;
  const id = w.anchor.id;
  if (COUNTER_LINES[id]) return null;
  const info = diaryLine(id);
  if (!info) return null;
  let line: Bilingual | undefined;
  if (info.kind === 'arrival') line = ARRIVAL_LINES[id];
  else if (info.kind === 'idle') line = npcDefById(info.npc as never)?.idleLines[Number(id.split('.idle')[1])];
  else if (info.kind === 'greet' || info.kind === 'closed') line = (VENDORS as Record<string, { greet: Bilingual; closed: Bilingual } | undefined>)[info.npc]?.[info.kind];
  else if (info.kind === 'talk') line = NPC_TALK[info.npc as keyof typeof NPC_TALK]?.nodes[id.slice(info.npc.length + 1)]?.line;
  if (!line) return null;
  const ctx = { name: '', pronoun: 'ela', minute: 600 };
  const pt = clean(fillTalk(line.pt, ctx));
  const en = clean(fillTalk(line.en, ctx));
  if (pt.includes('{') || en.includes('{')) return null;
  return { pt, en };
}

/** Word tiles of a line (punctuation off the tiles; the full line shows on the reveal). */
export function lineTiles(pt: string): string[] {
  return pt
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

/** A line short enough to build from tiles (3 to 8 words). */
export function buildLine(w: DiaryWord): Bilingual | null {
  const line = sourceLine(w);
  if (!line) return null;
  const n = lineTiles(line.pt).length;
  return n >= 3 && n <= 8 ? line : null;
}

// ---------------------------------------------------------------- lessons

export type ExerciseKind = 'pick' | 'pick_en' | 'listen' | 'type' | 'build' | 'match';

export interface PlannedExercise {
  kind: ExerciseKind;
  /** The word it tests (match: every word in the race). */
  wordIds: string[];
  /** A miss coming back at the end. */
  retry?: boolean;
}

/** What the client sees. Never which option is right. */
export type ExerciseView =
  /** EN prompt, Portuguese cards. */
  | { kind: 'pick'; en: string; options: string[] }
  /** Portuguese prompt (heard with its clip), English cards. */
  | { kind: 'pick_en'; pt: string; options: string[] }
  /** Only the clip plays (the Portuguese is hidden until the reveal); English cards. */
  | { kind: 'listen'; audio: string; options: string[] }
  /** EN prompt, type the Portuguese. `letters` is the length hint. */
  | { kind: 'type'; en: string; letters: number }
  /** The English of a real line the word came from; tap its Portuguese tiles into order. */
  | { kind: 'build'; en: string; tiles: string[]; where: Bilingual }
  /** Five Portuguese and five English cards, matched pair by pair (each tap is checked by the server). */
  | { kind: 'match'; pt: string[]; en: string[] };

/** What the server keeps. */
export type ExerciseKey =
  | { kind: 'pick' | 'type'; wordId: string; pt: string }
  | { kind: 'pick_en' | 'listen'; wordId: string; en: string }
  | { kind: 'build'; wordId: string; line: Bilingual; tiles: string[] }
  | { kind: 'match'; wordIds: string[]; pairs: number[] };

const shuffle = <T>(list: readonly T[], rng: () => number): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

const enKey = (en: string) => en.trim().toLowerCase();

/** Exercise kinds for a word at a box, easiest first. New words get two looks (recognise it, then hear it). */
export function kindsFor(w: DiaryWord, box: number, rng: () => number): ExerciseKind[] {
  const build = buildLine(w) ? (['build'] as const) : [];
  if (box <= 0) return ['pick', 'listen'];
  if (box === 1) return [rng() < 0.5 ? 'listen' : 'pick_en'];
  if (box === 2) return [build.length && rng() < 0.4 ? 'build' : rng() < 0.5 ? 'pick_en' : 'type'];
  return [build.length && rng() < 0.4 ? 'build' : 'type'];
}

export interface LessonPlan {
  /** The words this lesson focuses on, weakest first. */
  focus: string[];
  exercises: PlannedExercise[];
}

/**
 * A lesson over the player's own words: due words first (lowest box, oldest due), then up to `newWords` never-studied ones, then the
 * soonest-due rest. Each focus word gets an exercise for its box (new words two), round by round so a word does not come twice in a row,
 * with one match race after the first round when the diary has enough words. `area` keeps the lesson to one unit when it has words.
 */
export function planLesson(st: EscolaState, diary: readonly string[] | undefined, now: number, rng: () => number, area?: string): LessonPlan | null {
  let pool = normalizeDiary(diary)
    .map((id) => diaryWord(id))
    .filter((w): w is DiaryWord => !!w);
  if (!pool.length) return null;
  if (area && pool.some((w) => w.area === area)) pool = pool.filter((w) => w.area === area);
  const box = (w: DiaryWord) => st.words[w.id]?.b ?? 0;
  const due = pool.filter((w) => box(w) > 0 && (st.words[w.id]?.due ?? 0) <= now).sort((a, b) => box(a) - box(b) || st.words[a.id]!.due - st.words[b.id]!.due);
  const fresh = shuffle(pool.filter((w) => box(w) === 0), rng);
  const later = pool.filter((w) => box(w) > 0 && (st.words[w.id]?.due ?? 0) > now).sort((a, b) => st.words[a.id]!.due - st.words[b.id]!.due);
  const focus: DiaryWord[] = [];
  const take = (list: DiaryWord[], n: number) => {
    for (const w of list) {
      if (focus.length >= ESCOLA_LESSON.words || n <= 0) return;
      if (focus.includes(w)) continue;
      focus.push(w);
      n--;
    }
  };
  take(due, ESCOLA_LESSON.words - Math.min(fresh.length, ESCOLA_LESSON.newWords));
  take(fresh, ESCOLA_LESSON.newWords);
  take(due, ESCOLA_LESSON.words);
  take(later, ESCOLA_LESSON.words);
  take(fresh, ESCOLA_LESSON.words);

  const rounds: PlannedExercise[][] = [];
  for (const w of focus) {
    kindsFor(w, box(w), rng).forEach((kind, i) => (rounds[i] ??= []).push({ kind, wordIds: [w.id] }));
  }
  const exercises: PlannedExercise[] = [];
  rounds.forEach((r, i) => {
    exercises.push(...r);
    if (i === 0 && pool.length >= ESCOLA_LESSON.pairs) exercises.push({ kind: 'match', wordIds: matchWords(focus, pool, rng) });
  });
  // a diary of a word or two: the same words again in other shapes, up to the minimum
  const extra: ExerciseKind[] = ['pick_en', 'type', 'listen', 'pick'];
  for (let i = 0; exercises.length < ESCOLA_LESSON.minExercises && i < 16; i++) {
    const w = focus[i % focus.length]!;
    exercises.push({ kind: extra[Math.floor(i / focus.length) % extra.length]!, wordIds: [w.id] });
  }
  return { focus: focus.map((w) => w.id), exercises: exercises.slice(0, ESCOLA_LESSON.exercises) };
}

/** Five words with distinct Portuguese and English for the match race: the focus words first, then the rest of the diary. */
function matchWords(focus: readonly DiaryWord[], pool: readonly DiaryWord[], rng: () => number): string[] {
  const out: DiaryWord[] = [];
  for (const w of [...focus, ...shuffle(pool, rng)]) {
    if (out.length >= ESCOLA_LESSON.pairs) break;
    if (out.some((o) => o.id === w.id || diaryKey(o.pt) === diaryKey(w.pt) || enKey(o.en) === enKey(w.en))) continue;
    out.push(w);
  }
  return out.map((w) => w.id);
}

/** Wrong options: catalog words with other Portuguese and other English, the word's own area first (harder to guess). */
function decoys(w: DiaryWord, n: number, rng: () => number): DiaryWord[] {
  const ok = (o: DiaryWord) => o.id !== w.id && diaryKey(o.pt) !== diaryKey(w.pt) && enKey(o.en) !== enKey(w.en);
  const near = shuffle(DIARY_WORDS.filter((o) => o.area === w.area && ok(o)), rng);
  const far = shuffle(DIARY_WORDS.filter((o) => o.area !== w.area && ok(o)), rng);
  const out: DiaryWord[] = [];
  for (const o of [...near.slice(0, n - 1), ...far, ...near.slice(n - 1)]) {
    if (out.length >= n) break;
    if (out.some((x) => diaryKey(x.pt) === diaryKey(o.pt) || enKey(x.en) === enKey(o.en))) continue;
    out.push(o);
  }
  return out;
}

/** Deal one planned exercise: the view for the client and the key the server keeps. */
export function dealExercise(ex: PlannedExercise, rng: () => number): { view: ExerciseView; key: ExerciseKey } | null {
  if (ex.kind === 'match') {
    const words = ex.wordIds.map((id) => diaryWord(id)).filter((w): w is DiaryWord => !!w);
    if (words.length < 2) return null;
    const ptOrder = shuffle(words, rng);
    const enOrder = shuffle(words, rng);
    return {
      view: { kind: 'match', pt: ptOrder.map((w) => w.pt), en: enOrder.map((w) => w.en) },
      key: { kind: 'match', wordIds: ptOrder.map((w) => w.id), pairs: ptOrder.map((w) => enOrder.indexOf(w)) },
    };
  }
  const w = diaryWord(ex.wordIds[0] ?? '');
  if (!w) return null;
  const others = decoys(w, ESCOLA_LESSON.options - 1, rng);
  switch (ex.kind) {
    case 'pick':
      return { view: { kind: 'pick', en: w.en, options: shuffle([w, ...others], rng).map((o) => o.pt) }, key: { kind: 'pick', wordId: w.id, pt: w.pt } };
    case 'pick_en':
      return { view: { kind: 'pick_en', pt: w.pt, options: shuffle([w, ...others], rng).map((o) => o.en) }, key: { kind: 'pick_en', wordId: w.id, en: w.en } };
    case 'listen':
      return { view: { kind: 'listen', audio: w.pt, options: shuffle([w, ...others], rng).map((o) => o.en) }, key: { kind: 'listen', wordId: w.id, en: w.en } };
    case 'type':
      return { view: { kind: 'type', en: w.en, letters: [...w.pt].length }, key: { kind: 'type', wordId: w.id, pt: w.pt } };
    case 'build': {
      const line = buildLine(w);
      if (!line) return dealExercise({ ...ex, kind: 'type' }, rng);
      const tiles = lineTiles(line.pt);
      let order = shuffle(tiles, rng);
      // a shuffle that lands in order is no puzzle
      for (let i = 0; i < 4 && order.join(' ') === tiles.join(' '); i++) order = shuffle(tiles, rng);
      const where: Bilingual = w.anchor.kind === 'sign' ? { pt: 'De uma placa', en: 'From a sign' } : { pt: `Você ouviu de ${speakerOf(w) ?? 'alguém'}`, en: `You heard it from ${speakerOf(w) ?? 'someone'}` };
      return { view: { kind: 'build', en: line.en, tiles: order, where }, key: { kind: 'build', wordId: w.id, line, tiles: order } };
    }
  }
}

export type Almost = 'accent' | 'typo';

export interface CheckResult {
  correct: boolean;
  /** Counted right, with a note: a missing accent, a one-letter slip. */
  almost?: Almost;
}

/** At most one edit apart (insert, delete, substitute). */
function oneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** A typed Portuguese answer: exact (case aside) is right; right but for accents is "quase! faltou o acento"; a one-letter slip on a longer word is "quase". */
export function checkTyped(typed: string, pt: string): CheckResult {
  const t = typed.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const want = pt.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return { correct: false };
  if (t === want) return { correct: true };
  if (diaryKey(t) === diaryKey(want) || normalizeAnswer(t) === normalizeAnswer(want)) return { correct: true, almost: 'accent' };
  if (diaryKey(want).length >= 5 && oneEdit(diaryKey(t), diaryKey(want))) return { correct: true, almost: 'typo' };
  return { correct: false };
}

export type EscolaAnswer = { choice?: string; text?: string; order?: number[] };

/** Check an answer against the key (not the match race: its pairs are checked one at a time with `checkPair`). */
export function checkExercise(key: ExerciseKey, a: EscolaAnswer): CheckResult {
  switch (key.kind) {
    case 'pick':
      return { correct: typeof a.choice === 'string' && diaryKey(a.choice) === diaryKey(key.pt) };
    case 'pick_en':
    case 'listen':
      return { correct: typeof a.choice === 'string' && enKey(a.choice) === enKey(key.en) };
    case 'type':
      return typeof a.text === 'string' ? checkTyped(a.text.slice(0, 80), key.pt) : { correct: false };
    case 'build': {
      const order = Array.isArray(a.order) ? a.order : [];
      if (order.length !== key.tiles.length || new Set(order).size !== order.length || order.some((i) => !Number.isInteger(i) || i < 0 || i >= key.tiles.length)) return { correct: false };
      const built = order.map((i) => diaryKey(key.tiles[i]!)).join(' ');
      return { correct: built === lineTiles(key.line.pt).map(diaryKey).join(' ') };
    }
    case 'match':
      return { correct: false };
  }
}

/** One tap of the match race: Portuguese card `pt` with English card `en`. */
export function checkPair(key: Extract<ExerciseKey, { kind: 'match' }>, pt: number, en: number): boolean {
  return Number.isInteger(pt) && Number.isInteger(en) && key.pairs[pt] === en;
}

/** The answer shown after a try. */
export function revealOf(key: ExerciseKey): { pt: string; en: string; line?: string } {
  if (key.kind === 'match') return { pt: key.wordIds.map((id) => diaryWord(id)?.pt ?? '').join(' · '), en: key.wordIds.map((id) => diaryWord(id)?.en ?? '').join(' · ') };
  const w = diaryWord(key.wordId);
  if (key.kind === 'build') return { pt: w?.pt ?? '', en: w?.en ?? '', line: key.line.pt };
  return { pt: w?.pt ?? '', en: w?.en ?? '' };
}

/** XP for a right answer at combo `combo` (counted after this answer). */
export const xpFor = (combo: number): number => (combo >= ESCOLA_XP.comboAt ? ESCOLA_XP.comboRight : ESCOLA_XP.right);

// ---------------------------------------------------------------- what the escola shows

export interface StrengthenedWord {
  pt: string;
  en: string;
  from: number;
  to: number;
}

export interface EscolaSummary {
  xp: number;
  right: number;
  total: number;
  /** 0..100 */
  accuracy: number;
  perfect: boolean;
  bestCombo: number;
  strengthened: StrengthenedWord[];
  /** Words that reached the top box in this lesson. */
  newlyMastered: number;
  streak: number;
  streakExtended: boolean;
  freezeEarned: boolean;
  freezes: number;
  goal: number;
  dayXp: number;
  goalMet: boolean;
  tier: Nameplate;
  tierUp: Nameplate | null;
  progress: TierProgress;
  rv: number;
  mission: Hunt | null;
  /** The game word the first lesson teaches (aula), when it was still missing. */
  granted: Bilingual | null;
  line: Bilingual;
}
