export type Weather = 'sol' | 'nublado' | 'garoa' | 'chuva';

/**
 * Integer hash of a game day into a uint32. Not Math.random.
 *
 * 1. Truncate to an integer and reinterpret as uint32 (`>>> 0`), so a negative
 *    day (before the epoch) stays deterministic.
 * 2. Xorshift-multiply finalizer (MurmurHash3 fmix32). A bare multiply leaves
 *    the low bits poorly mixed, and the weather bucket reads those bits:
 *      h ^= h >>> 16; h = imul(h, 0x7FEB352D);
 *      h ^= h >>> 15; h = imul(h, 0x846CA68B);
 *      h ^= h >>> 16;
 * 3. `hash % 100` is the percentile roll:
 *      0–54 sol (55%), 55–79 nublado (25%), 80–94 garoa (15%), 95–99 chuva (5%).
 */
function hashGameDay(day: number): number {
  let h = Math.floor(day) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * Deterministic weather for one game day. The same `gameDay` always returns
 * the same weather; it changes only when `gameDay` changes.
 *
 * Callers pass `gameDay(now)`, which rolls at the CLOCK_OFFSET boundary
 * (midnight on this clock). HOWTO asks for the change at 06:00. That
 * alignment is approximate with the current offset — game days are shifted
 * so a fresh boot lands near 17:00 — and becomes exact only if CLOCK_OFFSET
 * is retuned. Do not change CLOCK_OFFSET to chase 06:00.
 */
export function weatherFor(gameDay: number): Weather {
  const bucket = hashGameDay(gameDay) % 100;
  if (bucket < 55) return 'sol';
  if (bucket < 80) return 'nublado';
  if (bucket < 95) return 'garoa';
  return 'chuva';
}

/** Idle lines. Every new PT string is marked for Brazilian review. */
export const WEATHER_LINES: Record<Weather, { pt: string; en: string; needs_br: true }> = {
  sol: { pt: 'Tá um solzão, hein?', en: 'What a blaze of sun, huh?', needs_br: true },
  nublado: { pt: 'Céu tá fechado hoje.', en: "Sky's closed in today.", needs_br: true },
  garoa: { pt: 'Que garoa, hein?', en: 'What a drizzle, huh?', needs_br: true },
  chuva: { pt: 'Tá chovendo pra valer.', en: "It's really pouring.", needs_br: true },
};
