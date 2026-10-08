/**
 * Feira cart games: a daily rotation of skill minigames at the Feira cart.
 *
 * Adding a game later = one game-logic module (orders, score, timing) + one client view,
 * then register its id in `FEIRA_ROTATION_ORDER` (and `FEIRA_GAME_LABEL`). That id is the admin
 * toggle: the panel lists the order, so Pastel and Caldo do not need their own switch code.
 * A game is playable once it also joins `FEIRA_IMPLEMENTED_GAMES` and `FEIRA_GAME_MODULES`.
 * Caldo de cana is reserved but not implemented yet: that slot falls back to Pastel.
 *
 * Which games are on is a persisted config (`off` | `on` | `rotation`), default off.
 * `featuredEnabled` picks today's game from the ones that are on and implemented.
 * `featuredGame` is the calendar helper (unimplemented slots still fall back) and does not
 * read the switch.
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

/** Games this build can actually start. Caldo joins this set in a later PR. */
export const FEIRA_IMPLEMENTED_GAMES = ['tapioca', 'pastel'] as const;
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
 * earlier implemented game in the cycle (wrapping). With Pastel built, a caldo day features
 * Pastel; a 3-game build is the real cycle. `implemented` is injectable so tests can prove the
 * fallback without waiting for Caldo.
 */
export function featuredGame(
  day: string,
  implemented: readonly string[] = FEIRA_IMPLEMENTED_GAMES,
  order: readonly string[] = FEIRA_ROTATION_ORDER,
): FeiraGameId {
  // `implemented` defaults to the games this build can start. Tests pass a wider list to prove
  // the 3-day cycle before Caldo exists. An empty list falls back to tapioca.
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

/** Featured game for a wall-clock instant, using the America/New_York calendar date. Ignores the on/off switch. */
export function featuredGameAt(nowMs: number, implemented?: readonly string[]): FeiraGameId {
  return featuredGame(todayEastern(nowMs), implemented);
}

/**
 * Today's playable game among `enabled` ids. Empty → null (the cart is closed).
 * One id → that game every day. Several → `daysSinceEpoch(ET) mod n` over those ids in rotation order.
 * An enabled id that is not implemented yet is skipped, so turning Pastel on before its module lands
 * does not feature it.
 */
export function featuredEnabled(
  day: string,
  enabled: readonly string[],
  implemented: readonly string[] = FEIRA_IMPLEMENTED_GAMES,
  order: readonly string[] = FEIRA_ROTATION_ORDER,
): string | null {
  const pool = order.filter((id) => enabled.includes(id) && implemented.includes(id));
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0]!;
  return rotationSlot(day, pool);
}

/** Weekday of an ET `YYYY-MM-DD` (0 = Sunday … 6 = Saturday). The date string is already the ET day. */
export function weekdayOfEtDay(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

// ---------------------------------------------------------------- on/off config (admin). Room for a later schedule.

/** `off` is closed. `on` is always eligible. `rotation` waits for `schedule` (a later calendar). */
export type FeiraCartMode = 'off' | 'on' | 'rotation';

/**
 * Placeholder window for `mode: 'rotation'`. Omitted fields are unbounded.
 * Absent schedule (mode still `rotation`) means not scheduled yet, so the game stays off.
 */
export interface FeiraCartSchedule {
  /** Inclusive ET date `YYYY-MM-DD`. */
  from?: string;
  /** Exclusive ET date `YYYY-MM-DD`. */
  until?: string;
  /** 0 = Sunday … 6 = Saturday, ET. Empty or omitted = every weekday. */
  weekdays?: number[];
}

export interface FeiraCartGameSetting {
  mode: FeiraCartMode;
  schedule?: FeiraCartSchedule | null;
}

export interface FeiraCartConfig {
  version: 1;
  /** Keyed by rotation id. A missing key is off. Unknown ids are kept so a newer game's flag survives. */
  games: Record<string, FeiraCartGameSetting>;
}

export const emptyFeiraCartConfig = (): FeiraCartConfig => ({ version: 1, games: {} });

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored window, or null when the value is missing or not a window. Never throws. */
export function readFeiraCartSchedule(raw: unknown): FeiraCartSchedule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: FeiraCartSchedule = {};
  if (typeof o.from === 'string' && ISO_DAY.test(o.from)) out.from = o.from;
  if (typeof o.until === 'string' && ISO_DAY.test(o.until)) out.until = o.until;
  if (Array.isArray(o.weekdays)) {
    const days: number[] = [];
    for (const n of o.weekdays) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 6) continue;
      if (!days.includes(n)) days.push(n);
    }
    if (days.length) out.weekdays = days;
  }
  return out;
}

/** True when a rotation-mode window includes this ET day. No schedule → false. */
export function scheduleCovers(schedule: FeiraCartSchedule | null | undefined, day: string): boolean {
  if (!schedule) return false;
  if (schedule.from && day < schedule.from) return false;
  if (schedule.until && day >= schedule.until) return false;
  if (schedule.weekdays?.length && !schedule.weekdays.includes(weekdayOfEtDay(day))) return false;
  return true;
}

/** Whether this setting lets the game enter today's pick. */
export function feiraGameActive(setting: FeiraCartGameSetting | undefined, day: string): boolean {
  if (!setting || setting.mode === 'off') return false;
  if (setting.mode === 'on') return true;
  return scheduleCovers(setting.schedule, day);
}

export function normalizeFeiraCartConfig(raw: unknown): FeiraCartConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const src = r.games && typeof r.games === 'object' ? (r.games as Record<string, unknown>) : {};
  const games: Record<string, FeiraCartGameSetting> = {};
  for (const [id, row] of Object.entries(src)) {
    if (!/^[a-z0-9_]{1,32}$/.test(id) || !row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const mode: FeiraCartMode = o.mode === 'on' || o.mode === 'rotation' ? o.mode : 'off';
    const schedule = o.schedule == null ? null : readFeiraCartSchedule(o.schedule);
    const setting: FeiraCartGameSetting = { mode };
    if (schedule && (schedule.from || schedule.until || schedule.weekdays?.length)) setting.schedule = schedule;
    games[id] = setting;
  }
  return { version: 1, games };
}

/** Ids in rotation order whose setting is active on `day`. */
export function enabledFeiraGameIds(cfg: FeiraCartConfig, day: string, order: readonly string[] = FEIRA_ROTATION_ORDER): string[] {
  return order.filter((id) => feiraGameActive(cfg.games[id], day));
}

/**
 * Replace one game's mode. `schedule === undefined` keeps the stored window; `null` clears it.
 * Returns null when `id` is not in the rotation (the admin list) or `mode` is not a real mode.
 */
export function withFeiraCartMode(
  cfg: FeiraCartConfig,
  id: string,
  mode: FeiraCartMode,
  schedule?: FeiraCartSchedule | null,
): FeiraCartConfig | null {
  if (!isRotationId(id) || (mode !== 'off' && mode !== 'on' && mode !== 'rotation')) return null;
  const prev = cfg.games[id];
  const nextSchedule = schedule === undefined ? prev?.schedule ?? null : schedule ? readFeiraCartSchedule(schedule) : null;
  const setting: FeiraCartGameSetting = { mode };
  if (nextSchedule && (nextSchedule.from || nextSchedule.until || nextSchedule.weekdays?.length)) setting.schedule = nextSchedule;
  return { version: 1, games: { ...cfg.games, [id]: setting } };
}

export interface FeiraCartGameInfo {
  id: FeiraRotationId;
  label: Bilingual;
  implemented: boolean;
}

/** One row per rotation id. The admin panel renders this list; a new id shows up as a toggle. */
export function feiraCartCatalog(): FeiraCartGameInfo[] {
  return FEIRA_ROTATION_ORDER.map((id) => ({
    id,
    label: FEIRA_GAME_LABEL[id],
    implemented: (FEIRA_IMPLEMENTED_GAMES as readonly string[]).includes(id),
  }));
}

export interface FeiraCartAdminGame {
  id: string;
  pt: string;
  en: string;
  mode: FeiraCartMode;
  implemented: boolean;
  /** Eligible today (on, or rotation whose window includes `day`). Still needs an implementation to be featured. */
  active: boolean;
}

/** What the admin panel shows: every cart game, and which implemented one is featured today. */
export function feiraCartAdminView(cfg: FeiraCartConfig, day: string): { day: string; featured: FeiraGameId | null; games: FeiraCartAdminGame[] } {
  const games: FeiraCartAdminGame[] = feiraCartCatalog().map((g) => {
    const setting = cfg.games[g.id] ?? { mode: 'off' as const };
    return {
      id: g.id,
      pt: g.label.pt,
      en: g.label.en,
      mode: setting.mode,
      implemented: g.implemented,
      active: feiraGameActive(setting, day),
    };
  });
  const picked = featuredEnabled(day, enabledFeiraGameIds(cfg, day));
  return { day, featured: isFeiraGameId(picked) ? picked : null, games };
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
  pastel: {
    pt: 'Pega a massa, põe o recheio, fecha com o garfo e tira do óleo no dourado.',
    en: 'Grab the dough, add the filling, crimp it shut, and pull it from the oil when it is golden.',
  },
};

/** The cart when no game is on. needs_br: true */
export const FEIRA_CART_CLOSED: Bilingual = { pt: 'Fechado', en: 'Closed today' };
export const FEIRA_CART_CLOSED_LINE: Bilingual = {
  pt: 'O carrinho está fechado hoje.',
  en: 'The cart is closed today.',
};

/** Tapioca keeps the sentence it shipped with. needs_br: true */
export const FEIRA_CART_GREET: Bilingual = {
  pt: 'Oi! Hoje o carrinho é de tapioca. Quer jogar?',
  en: 'Hi! Today the cart is tapioca. Want to play?',
};

/** Offer line for today's game. Tapioca keeps the original sentence. needs_br: true */
export function feiraCartGreet(game: string): Bilingual {
  if (game === 'tapioca' || !isRotationId(game)) return FEIRA_CART_GREET;
  const label = FEIRA_GAME_LABEL[game];
  return {
    pt: `Oi! Hoje o carrinho é de ${label.pt.toLowerCase()}. Quer jogar?`,
    en: `Hi! Today the cart is ${label.en.toLowerCase()}. Want to play?`,
  };
}

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

/** Registry. A later PR pushes caldo here and into FEIRA_IMPLEMENTED_GAMES. */
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
