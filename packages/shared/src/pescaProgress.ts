/**
 * A player's fishing (PRAIA-PLAN.md 8.1): the log of species (the collection), the bucket of unsold fish, the rental and party counts,
 * the trip under way and the day's sales. One JSON object on the profile row; `normalizePesca` is pure and idempotent (clamps, drops
 * unknown ids).
 */
import { isFishId, type FishId } from './fish.js';
import { isBoatTier, isWaterId, type BoatTier, type WaterId } from './pesca.js';

export interface PescaLogRow {
  n: number;
  bestCm: number;
  firstAt: number;
  firstWater: WaterId;
}

export interface PescaProgress {
  casts: number;
  catches: number;
  log: Partial<Record<FishId, PescaLogRow>>;
  balde: Partial<Record<FishId, number>>;
  rentals: Partial<Record<BoatTier, number>>;
  trip: { tier: BoatTier; startedAt: number; until: number } | null;
  /** RV paid by Jô on `date` (player day, playerDay.ts `profileDay`), against the daily cap. Older saves hold São Paulo or UTC keys: an earlier key rolls over, a later one counts as today (`sameOrFutureDay`). */
  sales: { date: string; rv: number };
  /** Neide's one-time lines already said */
  coached: string[];
  party: { hosted: number; guested: number };
}

export const emptyPesca = (): PescaProgress => ({ casts: 0, catches: 0, log: {}, balde: {}, rentals: {}, trip: null, sales: { date: '', rv: 0 }, coached: [], party: { hosted: 0, guested: 0 } });

const count = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalizePesca(raw: unknown): PescaProgress | undefined {
  if (raw == null) return undefined;
  const o = obj(raw);
  const out = emptyPesca();
  out.casts = count(o.casts);
  out.catches = count(o.catches);
  for (const [k, v] of Object.entries(obj(o.log))) {
    if (!isFishId(k)) continue;
    const r = obj(v);
    const n = count(r.n);
    if (!n) continue;
    out.log[k] = { n, bestCm: count(r.bestCm, 1000), firstAt: count(r.firstAt, 1e15), firstWater: isWaterId(r.firstWater) ? r.firstWater : 'praia' };
  }
  for (const [k, v] of Object.entries(obj(o.balde))) if (isFishId(k) && count(v, 9999)) out.balde[k] = count(v, 9999);
  for (const [k, v] of Object.entries(obj(o.rentals))) if (isBoatTier(k) && count(v)) out.rentals[k] = count(v);
  const t = obj(o.trip);
  if (isBoatTier(t.tier) && count(t.until, 1e15) > 0) out.trip = { tier: t.tier, startedAt: count(t.startedAt, 1e15), until: count(t.until, 1e15) };
  const s = obj(o.sales);
  out.sales = { date: typeof s.date === 'string' ? s.date.slice(0, 10) : '', rv: count(s.rv, 100_000) };
  out.coached = Array.isArray(o.coached) ? [...new Set(o.coached.filter((x): x is string => typeof x === 'string' && x.length < 40))].slice(0, 20) : [];
  const pa = obj(o.party);
  out.party = { hosted: count(pa.hosted), guested: count(pa.guested) };
  return out;
}

/** Species caught at least once. */
export const speciesCaught = (p: PescaProgress | undefined): FishId[] => (p ? (Object.keys(p.log) as FishId[]) : []);
/** Fish in the bucket, total. */
export const baldeCount = (p: PescaProgress | undefined): number => (p ? Object.values(p.balde).reduce((a, n) => a + (n ?? 0), 0) : 0);
