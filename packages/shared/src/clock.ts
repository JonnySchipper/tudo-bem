/** 48 real minutes = 1 game day (1440 game minutes). */
export const GAME_DAY_MS = 48 * 60 * 1000;
/** Tune so a fresh server boot (nowMs = 0) lands near golden hour (17:00). */
export const CLOCK_OFFSET_MS = 17 * 2 * 60 * 1000;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/**
 * JavaScript `%` keeps the dividend's sign. Fold any integer span into [0, m)
 * so times before the epoch still land in range.
 */
function posMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Game minute of the day, 0..1439. */
export function gameMinutes(nowMs: number): number {
  const t = posMod(nowMs + CLOCK_OFFSET_MS, GAME_DAY_MS);
  return Math.floor((t / GAME_DAY_MS) * 1440);
}

/** Whole game days since the offset epoch. Separate from real-calendar day resets. */
export function gameDay(nowMs: number): number {
  return Math.floor((nowMs + CLOCK_OFFSET_MS) / GAME_DAY_MS);
}

export type Period = 'madrugada' | 'manha' | 'tarde' | 'noite';

/** <300 madrugada, <720 manha, <1080 tarde, else noite. */
export function period(min: number): Period {
  return min < 300 ? 'madrugada' : min < 720 ? 'manha' : min < 1080 ? 'tarde' : 'noite';
}

/** The greeting that fits the time: bom dia (05:00–11:59), boa tarde (12:00–17:59), boa noite (18:00–04:59). */
export function greetingFor(min: number): 'bom dia' | 'boa tarde' | 'boa noite' {
  if (min >= 300 && min < 720) return 'bom dia';
  if (min >= 720 && min < 1080) return 'boa tarde';
  return 'boa noite';
}

/** `17:40` from a game minute. */
export function formatHHMM(min: number): string {
  const m = posMod(Math.floor(min), 1440);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** HUD clock pill parts: `Seg · 17:40 · ☀️`. */
export function clockLabel(nowMs: number): { weekday: string; hhmm: string; icon: string } {
  const min = gameMinutes(nowMs);
  const p = period(min);
  const icon = p === 'madrugada' ? '🌟' : p === 'noite' ? '🌙' : '☀️';
  return {
    weekday: WEEKDAYS[posMod(gameDay(nowMs), 7)]!,
    hhmm: formatHHMM(min),
    icon,
  };
}
