/**
 * Feira cart games: a daily rotation of skill minigames at the Feira cart.
 *
 * Adding a game later = one game-logic module (orders, score, timing) + one client view,
 * then register it in `FEIRA_GAME_MODULES` and (if it should enter the cycle) in `FEIRA_ROTATION_ORDER`.
 * Pastel and Caldo de cana are reserved in the order but not implemented yet: the featured pick
 * falls back to an implemented game until they land, so the schedule stays a real 3-day cycle
 * the day those modules exist.
 *
 * Rotation is deterministic from the America/New_York calendar date (ET), not the game clock.
 * Scoring is recomputed from compact per-order outcomes; the client never names the score.
 */
import { ECONOMY } from './constants.js';
import { todayEastern } from './cartela.js';
import type { Bilingual } from './types.js';

// ---------------------------------------------------------------- rotation

/** Fixed cycle. Order is the schedule; unimplemented ids fall back (see `featuredGame`). */
export const FEIRA_ROTATION_ORDER = ['tapioca', 'pastel', 'caldo'] as const;
export type FeiraRotationId = (typeof FEIRA_ROTATION_ORDER)[number];

/** Games this build can actually start. Pastel and caldo join this set in later PRs. */
export const FEIRA_IMPLEMENTED_GAMES = ['tapioca'] as const;
export type FeiraGameId = (typeof FEIRA_IMPLEMENTED_GAMES)[number];

export const isFeiraGameId = (v: unknown): v is FeiraGameId =>
  typeof v === 'string' && (FEIRA_IMPLEMENTED_GAMES as readonly string[]).includes(v);

export const isRotationId = (v: unknown): v is FeiraRotationId =>
  typeof v === 'string' && (FEIRA_ROTATION_ORDER as readonly string[]).includes(v);

/** Whole ET calendar days since 1970-01-01. DST-safe: the date string is already the ET day. */
export function daysSinceEpochET(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/**
 * The slot the calendar would pick, even if that game is not built yet.
 * `daysSinceEpoch(ET date) mod rotation.length` over `FEIRA_ROTATION_ORDER`.
 */
export function rotationSlot(day: string, order: readonly string[] = FEIRA_ROTATION_ORDER): string {
  if (!order.length) return 'tapioca';
  const n = daysSinceEpochET(day);
  const i = ((n % order.length) + order.length) % order.length;
  return order[i]!;
}

/**
 * Featured game for an ET date (`YYYY-MM-DD`). Unimplemented slots fall back to the nearest
 * earlier implemented game in the cycle (wrapping), so a 1-game build always features tapioca
 * and a 3-game build is the real cycle. `implemented` is injectable so tests can prove the fallback
 * without waiting for Pastel and Caldo.
 */
export function featuredGame(
  day: string,
  implemented: readonly string[] = FEIRA_IMPLEMENTED_GAMES,
  order: readonly string[] = FEIRA_ROTATION_ORDER,
): FeiraGameId {
  // `implemented` defaults to the games this build can start. Tests pass a wider list to prove
  // the 3-day cycle before Pastel and Caldo exist. An empty list falls back to tapioca.
  const pool = implemented.length ? implemented : ['tapioca'];
  const slot = rotationSlot(day, order);
  if (pool.includes(slot)) return slot as FeiraGameId;
  const start = Math.max(0, order.indexOf(slot));
  for (let k = 1; k <= order.length; k++) {
    const id = order[(start - k + order.length * 8) % order.length];
    if (id && pool.includes(id)) return id as FeiraGameId;
  }
  return pool[0] as FeiraGameId;
}

/** Featured game for a wall-clock instant, using the America/New_York calendar date. */
export function featuredGameAt(nowMs: number, implemented?: readonly string[]): FeiraGameId {
  return featuredGame(todayEastern(nowMs), implemented);
}

export const FEIRA_GAME_LABEL: Record<FeiraRotationId, Bilingual> = {
  tapioca: { pt: 'Tapioca', en: 'Tapioca' },
  pastel: { pt: 'Pastel', en: 'Pastel' },
  caldo: { pt: 'Caldo de cana', en: 'Sugarcane juice' },
};

/** Short PT intro + English hint shown at the cart before Jogar. needs_br: true */
export const FEIRA_GAME_INTRO: Record<FeiraGameId, Bilingual> = {
  tapioca: {
    pt: 'A chapa tá quente. Espalha a goma, vira no ponto e enrola o recheio.',
    en: 'The griddle is hot. Spread the batter, flip on time, and roll the filling.',
  },
};

export const FEIRA_CART_GREET: Bilingual = {
  pt: 'Oi! Hoje o carrinho é de tapioca. Quer jogar?',
  en: 'Hi! Today the cart is tapioca. Want to play?',
};

// ---------------------------------------------------------------- shared run shape

/** Per-order quality the client reports. The server scores from this; it never trusts a client score. */
export type FeiraQuality = 'perfect' | 'ok' | 'soft' | 'miss';

export interface FeiraOrderOutcome {
  /** Index into the seed's order list (0-based, in arrival order). */
  i: number;
  quality: FeiraQuality;
  /** Ms from run start when this order was served (or the customer left). */
  atMs: number;
}

export const FEIRA_QUALITIES: readonly FeiraQuality[] = ['perfect', 'ok', 'soft', 'miss'];

/** Hard cap on a single run's score, every game. Forged totals cannot pass this. */
export const FEIRA_GAME_MAX_SCORE = 500;

/** A run must last at least this long before a result is accepted (a 90s game cannot finish in a blink). */
export const FEIRA_MIN_ELAPSED_MS = 8_000;

/** First N runs per ET day pay RV. Later runs still count for the board. Mirrors Correria's DAILY_PAID_SHIFTS. */
export const FEIRA_DAILY_PAID_RUNS = 3;

/**
 * RV for a run: ECONOMY.minigameMin..Max by score ratio, same band as Correria (8–20),
 * plus a small perfect-play bump that still stays inside ~5–25. Zero when nothing was served.
 */
export function feiraPayout(score: number, served: number, maxScore = FEIRA_GAME_MAX_SCORE): number {
  if (served <= 0 || score <= 0) return 0;
  const r = Math.max(0, Math.min(1, score / Math.max(1, maxScore)));
  const base = ECONOMY.minigameMin + Math.round((ECONOMY.minigameMax - ECONOMY.minigameMin) * r);
  // a flawless run (r = 1) pays 25; a thin run stays at the Correria floor (8)
  return Math.min(25, Math.max(ECONOMY.minigameMin, base + (r >= 0.95 ? 5 : 0)));
}

export const FEIRA_DAILY_BLOCKED: Bilingual = {
  pt: 'Que jogo! Hoje o carrinho já pagou o que dava, mas o placar conta.',
  en: 'What a game! The cart has paid what it could today, but the board still counts.',
};

// ---------------------------------------------------------------- daily board + medals

export type FeiraMedal = 'gold' | 'silver' | 'bronze';

export interface FeiraMedalAward {
  day: string;
  game: FeiraGameId;
  medal: FeiraMedal;
  score: number;
}

export interface FeiraDayScore {
  name: string;
  best: number;
  game: FeiraGameId;
  /** Wall-clock ms when this best was first reached. Ties go to the earlier achiever. */
  at: number;
}

export interface FeiraGamesState {
  /** ET day key (`YYYY-MM-DD`) the live board belongs to. */
  day: string;
  scores: Record<string, FeiraDayScore>;
  /** Permanent medals, keyed by player id. Never cleared at midnight. */
  medals: Record<string, FeiraMedalAward[]>;
  /** Paid runs already counted today, per player. Reset with the ET day. */
  paid: Record<string, number>;
}

export const emptyFeiraGames = (day: string): FeiraGamesState => ({ day, scores: {}, medals: {}, paid: {} });

const MEDAL_OF_RANK: Record<number, FeiraMedal> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/** Rank the day's scores. Higher score wins; a tie goes to whoever reached it first (`at`). */
export function rankFeiraDay(scores: Record<string, FeiraDayScore>): { id: string; row: FeiraDayScore; rank: number }[] {
  const rows = Object.entries(scores)
    .filter(([, r]) => r && r.best > 0)
    .sort((a, b) => b[1].best - a[1].best || a[1].at - b[1].at || a[0].localeCompare(b[0]));
  return rows.map(([id, row], i) => ({ id, row, rank: i + 1 }));
}

/** Current crown holder: rank 1 of the live board, or null when the board is empty. */
export function crownHolder(scores: Record<string, FeiraDayScore>): string | null {
  return rankFeiraDay(scores)[0]?.id ?? null;
}

/**
 * Finalize an ET day: 1st/2nd/3rd earn a permanent medal (ties: earlier achiever already won the rank).
 * Returns the awards to append. Does not mutate.
 */
export function medalsForDay(day: string, scores: Record<string, FeiraDayScore>): { id: string; award: FeiraMedalAward }[] {
  const out: { id: string; award: FeiraMedalAward }[] = [];
  for (const { id, row, rank } of rankFeiraDay(scores)) {
    const medal = MEDAL_OF_RANK[rank];
    if (!medal) break;
    out.push({ id, award: { day, game: row.game, medal, score: row.best } });
  }
  return out;
}

export interface FeiraBoardRow {
  rank: number;
  id: string;
  name: string;
  best: number;
  game: FeiraGameId;
  you?: true;
}

export function feiraTop(scores: Record<string, FeiraDayScore>, n = 3, viewerId?: string): FeiraBoardRow[] {
  return rankFeiraDay(scores)
    .slice(0, n)
    .map(({ id, row, rank }) => ({
      rank,
      id,
      name: row.name,
      best: row.best,
      game: row.game,
      ...(id === viewerId ? { you: true as const } : {}),
    }));
}

export interface FeiraMedalTally {
  id: string;
  name: string;
  gold: number;
  silver: number;
  bronze: number;
}

/** All-time medal counts. Name comes from the latest award's day score when the caller passes names. */
export function medalTallies(
  medals: Record<string, FeiraMedalAward[]>,
  names: Record<string, string>,
  topN = 10,
): FeiraMedalTally[] {
  const rows: FeiraMedalTally[] = [];
  for (const [id, list] of Object.entries(medals)) {
    if (!list?.length) continue;
    const t: FeiraMedalTally = { id, name: names[id] || id, gold: 0, silver: 0, bronze: 0 };
    for (const a of list) t[a.medal] += 1;
    rows.push(t);
  }
  rows.sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name, 'pt'));
  return rows.slice(0, topN);
}

/** Where this score would place on the live board (1-based), after it is recorded. */
export function placeOf(scores: Record<string, FeiraDayScore>, playerId: string): number {
  return rankFeiraDay(scores).find((r) => r.id === playerId)?.rank ?? 0;
}

// ---------------------------------------------------------------- persistence normalize

const MEDALS = new Set<FeiraMedal>(['gold', 'silver', 'bronze']);

export function normalizeFeiraGames(raw: unknown, day: string): FeiraGamesState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const storedDay = typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : day;
  const scores: Record<string, FeiraDayScore> = {};
  if (r.scores && typeof r.scores === 'object') {
    for (const [id, row] of Object.entries(r.scores as Record<string, unknown>)) {
      if (!id || id.length > 40 || !row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      if (!isFeiraGameId(o.game)) continue;
      const best = Number(o.best);
      const at = Number(o.at);
      if (!Number.isFinite(best) || best <= 0) continue;
      scores[id] = {
        name: typeof o.name === 'string' ? o.name.slice(0, 24) : id,
        best: Math.min(FEIRA_GAME_MAX_SCORE, Math.floor(best)),
        game: o.game,
        at: Number.isFinite(at) ? Math.floor(at) : 0,
      };
    }
  }
  const medals: Record<string, FeiraMedalAward[]> = {};
  if (r.medals && typeof r.medals === 'object') {
    for (const [id, list] of Object.entries(r.medals as Record<string, unknown>)) {
      if (!id || id.length > 40 || !Array.isArray(list)) continue;
      const awards: FeiraMedalAward[] = [];
      for (const a of list.slice(0, 400)) {
        if (!a || typeof a !== 'object') continue;
        const o = a as Record<string, unknown>;
        if (typeof o.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.day)) continue;
        if (!isFeiraGameId(o.game) || typeof o.medal !== 'string' || !MEDALS.has(o.medal as FeiraMedal)) continue;
        awards.push({
          day: o.day,
          game: o.game,
          medal: o.medal as FeiraMedal,
          score: Math.max(0, Math.min(FEIRA_GAME_MAX_SCORE, Math.floor(Number(o.score) || 0))),
        });
      }
      if (awards.length) medals[id] = awards;
    }
  }
  const paid: Record<string, number> = {};
  if (r.paid && typeof r.paid === 'object') {
    for (const [id, n] of Object.entries(r.paid as Record<string, unknown>)) {
      const v = Number(n);
      if (id && Number.isFinite(v) && v > 0) paid[id] = Math.min(99, Math.floor(v));
    }
  }
  return { day: storedDay, scores, medals, paid };
}

// ---------------------------------------------------------------- game modules

export interface FeiraGameModule {
  id: FeiraGameId;
  /** How long a run lasts (ms). The server rejects a result that arrives before a plausible slice of this. */
  durationMs: number;
  /** Orders the seed can have spawned by `elapsedMs` (arrival times are deterministic). */
  ordersBy(seed: number, elapsedMs: number): FeiraCustomerOrder[];
  /** Every order the seed would deal in a full run. */
  allOrders(seed: number): FeiraCustomerOrder[];
  /**
   * Recompute the score from outcomes. Unknown indexes and extra rows are dropped.
   * Result is always in `0..FEIRA_GAME_MAX_SCORE`.
   */
  score(seed: number, outcomes: readonly FeiraOrderOutcome[], elapsedMs: number): { score: number; served: number; perfect: number; left: number };
}

export interface FeiraCustomerOrder {
  /** Arrival ms from run start. */
  at: number;
  /** Patience window (ms) before they leave. */
  patienceMs: number;
  /** Stable id the client shows (a portrait npc id, or a generated regular). */
  who: string;
  name: string;
}

/** Registry. A later PR pushes pastel / caldo here and into FEIRA_IMPLEMENTED_GAMES. */
export const FEIRA_GAME_MODULES: Partial<Record<FeiraGameId, FeiraGameModule>> = {};

export function feiraModule(id: FeiraGameId): FeiraGameModule | undefined {
  return FEIRA_GAME_MODULES[id];
}

/**
 * Sanity-check a submitted result against the seed. Forged rows are dropped, never trusted.
 * Returns the server's score (hard-capped) and how many orders actually counted as served.
 */
export function judgeFeiraResult(
  game: FeiraGameId,
  seed: number,
  outcomes: readonly FeiraOrderOutcome[],
  elapsedMs: number,
): { ok: true; score: number; served: number; perfect: number; left: number } | { ok: false; reason: 'unknown_game' | 'too_fast' | 'bad_outcomes' } {
  const mod = feiraModule(game);
  if (!mod) return { ok: false, reason: 'unknown_game' };
  if (!Number.isFinite(elapsedMs) || elapsedMs < FEIRA_MIN_ELAPSED_MS) return { ok: false, reason: 'too_fast' };
  if (!Array.isArray(outcomes)) return { ok: false, reason: 'bad_outcomes' };
  const clean = sanitizeOutcomes(outcomes, mod, seed, elapsedMs);
  const scored = mod.score(seed, clean, elapsedMs);
  return { ok: true, ...scored, score: Math.max(0, Math.min(FEIRA_GAME_MAX_SCORE, scored.score)) };
}

/** Drop duplicates, out-of-range indexes, and orders the seed could not have spawned yet. */
export function sanitizeOutcomes(
  outcomes: readonly FeiraOrderOutcome[],
  mod: FeiraGameModule,
  seed: number,
  elapsedMs: number,
): FeiraOrderOutcome[] {
  const possible = mod.ordersBy(seed, elapsedMs);
  const seen = new Set<number>();
  const out: FeiraOrderOutcome[] = [];
  for (const raw of outcomes) {
    if (!raw || typeof raw !== 'object') continue;
    const i = Math.floor(Number(raw.i));
    const atMs = Math.floor(Number(raw.atMs));
    if (!Number.isFinite(i) || i < 0 || i >= possible.length || seen.has(i)) continue;
    if (!FEIRA_QUALITIES.includes(raw.quality)) continue;
    if (!Number.isFinite(atMs) || atMs < 0 || atMs > elapsedMs + 500) continue;
    // a customer who has not arrived yet cannot have been served
    if (atMs + 250 < possible[i]!.at) continue;
    seen.add(i);
    out.push({ i, quality: raw.quality, atMs });
  }
  return out;
}

/** Parse a client result payload. Never throws. */
export function parseFeiraOutcomes(raw: unknown): FeiraOrderOutcome[] | null {
  if (!Array.isArray(raw) || raw.length > 40) return null;
  const out: FeiraOrderOutcome[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const o = row as Record<string, unknown>;
    const i = Number(o.i);
    const atMs = Number(o.atMs);
    if (!Number.isInteger(i) || i < 0 || i > 39) return null;
    if (typeof o.quality !== 'string' || !FEIRA_QUALITIES.includes(o.quality as FeiraQuality)) return null;
    if (!Number.isFinite(atMs) || atMs < 0 || atMs > 10 * 60_000) return null;
    out.push({ i, quality: o.quality as FeiraQuality, atMs: Math.floor(atMs) });
  }
  return out;
}
