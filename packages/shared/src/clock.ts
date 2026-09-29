/**
 * Shared game clock (HOWTO §5.7, decision D11). Pure and deterministic from a millisecond timestamp:
 * the server sends its `Date.now()` and clients compute `gameMinutes(Date.now() + skew)`, so everyone sees the same time.
 * Game days are independent of the real-day resets (daily mission, Conversa RV "already today").
 */

/** 48 real minutes = 1 game day (so 1 game minute = 2 real seconds). */
export const GAME_DAY_MS = 48 * 60 * 1000;

/**
 * Reference: the clock reads exactly 17:00 (golden hour) at Unix time 0 and therefore at every
 * 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 UTC (4 real hours = 5 game days, the LCM of 48 min and 60 min).
 * 17:00 = 17/24 of a game day = 34 real minutes.
 */
export const CLOCK_OFFSET_MS = 17 * 2 * 60 * 1000;

const MIN_PER_DAY = 1440;

/** Real modulo: always in [0, m), also for negative n. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Minutes since game midnight, 0..1439. */
export function gameMinutes(nowMs: number): number {
  const t = mod(nowMs + CLOCK_OFFSET_MS, GAME_DAY_MS);
  return Math.min(MIN_PER_DAY - 1, Math.floor((t / GAME_DAY_MS) * MIN_PER_DAY));
}

/** Whole game days since the epoch (negative before it). Rolls over at game midnight. */
export function gameDay(nowMs: number): number {
  return Math.floor((nowMs + CLOCK_OFFSET_MS) / GAME_DAY_MS);
}

export type Period = 'madrugada' | 'manha' | 'tarde' | 'noite';

/** madrugada 00:00-04:59, manhã 05:00-11:59, tarde 12:00-17:59, noite 18:00-23:59. */
export function period(min: number): Period {
  return min < 300 ? 'madrugada' : min < 720 ? 'manha' : min < 1080 ? 'tarde' : 'noite';
}

export type Greeting = 'bom dia' | 'boa tarde' | 'boa noite';

/** The greeting that fits the time: bom dia (05:00-11:59), boa tarde (12:00-17:59), boa noite (18:00-04:59). */
export function greetingFor(min: number): Greeting {
  if (min >= 300 && min < 720) return 'bom dia';
  if (min >= 720 && min < 1080) return 'boa tarde';
  return 'boa noite';
}

export interface WeekdayInfo {
  short: 'Dom' | 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex' | 'Sáb';
  /** Full Portuguese name. */
  pt: string;
  en: string;
}

// needs_br: true (weekday names; standard PT/EN, listed for the native pass)
const WEEKDAYS: readonly WeekdayInfo[] = [
  { short: 'Dom', pt: 'domingo', en: 'Sunday' },
  { short: 'Seg', pt: 'segunda-feira', en: 'Monday' },
  { short: 'Ter', pt: 'terça-feira', en: 'Tuesday' },
  { short: 'Qua', pt: 'quarta-feira', en: 'Wednesday' },
  { short: 'Qui', pt: 'quinta-feira', en: 'Thursday' },
  { short: 'Sex', pt: 'sexta-feira', en: 'Friday' },
  { short: 'Sáb', pt: 'sábado', en: 'Saturday' },
];

/** Weekday for a game day number (`gameDay(now)`): 0 = Dom ... 6 = Sáb, cycling. Works for negative days. */
export function weekday(day: number): WeekdayInfo {
  return WEEKDAYS[mod(Math.floor(day), 7)]!;
}

/** "17:40" (zero-padded 24 h). Input is clamped and floored to 0..1439. */
export function formatClock(min: number): string {
  const m = Math.max(0, Math.min(MIN_PER_DAY - 1, Math.floor(min)));
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
