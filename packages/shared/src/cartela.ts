/**
 * Cartela de carimbos: four bairro activities, at most one stamp each per America/New_York calendar day,
 * seven stamps pay once (then a fresh card). Progress survives logout on the profile.
 */
import { ROLL_RV_LOSS } from './academia.js';
import type { Bilingual } from './types.js';

export const CARTELA_GOAL = 7;
export const CARTELA_MAX_STAMPS_PER_DAY = 4;

/** Matches the smallest repeatable RV payout in the game (a finished tatame roll you lost). */
export const CARTELA_REWARD = ROLL_RV_LOSS;

export type CartelaActivity = 'tatame' | 'balcao' | 'feira' | 'conversa';

export const CARTELA_ACTIVITIES: readonly CartelaActivity[] = ['tatame', 'balcao', 'feira', 'conversa'];

export interface CartelaState {
  /** Stamps on the current card (0–6 until the 7th pays and resets). */
  stamps: number;
  /** Last Eastern calendar day (YYYY-MM-DD) each activity earned a stamp. */
  activityDay: Partial<Record<CartelaActivity, string>>;
}

export const freshCartela = (): CartelaState => ({ stamps: 0, activityDay: {} });

export function todayEastern(nowMs = Date.now()): string {
  return new Date(nowMs).toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
}

export function normalizeCartela(raw: unknown): CartelaState {
  const r = raw as CartelaState | undefined;
  if (!r || typeof r !== 'object') return freshCartela();
  const stamps = typeof r.stamps === 'number' && Number.isFinite(r.stamps) ? Math.max(0, Math.min(CARTELA_GOAL - 1, Math.floor(r.stamps))) : 0;
  const activityDay: Partial<Record<CartelaActivity, string>> = {};
  for (const id of CARTELA_ACTIVITIES) {
    const d = r.activityDay?.[id];
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) activityDay[id] = d.slice(0, 10);
  }
  return { stamps, activityDay };
}

export function stampsOnDay(st: CartelaState, day: string): number {
  return CARTELA_ACTIVITIES.filter((a) => st.activityDay[a] === day).length;
}

export function activityStampedToday(st: CartelaState, activity: CartelaActivity, day: string): boolean {
  return st.activityDay[activity] === day;
}

export type CartelaStampResult =
  | { ok: false }
  | { ok: true; next: CartelaState; paid: boolean; reward: number };

/** Try to add one stamp for `activity` on Eastern calendar day `day`. */
export function tryCartelaStamp(st: CartelaState, activity: CartelaActivity, day: string): CartelaStampResult {
  const base = normalizeCartela(st);
  if (activityStampedToday(base, activity, day)) return { ok: false };
  if (stampsOnDay(base, day) >= CARTELA_MAX_STAMPS_PER_DAY) return { ok: false };
  let stamps = base.stamps + 1;
  const activityDay = { ...base.activityDay, [activity]: day };
  if (stamps >= CARTELA_GOAL) {
    return { ok: true, next: { stamps: 0, activityDay }, paid: true, reward: CARTELA_REWARD };
  }
  return { ok: true, next: { stamps, activityDay }, paid: false, reward: 0 };
}

export const CARTELA_COPY = {
  title: { pt: 'Cartela do bairro', en: 'Neighborhood stamp card' },
  hud: { pt: 'Cartela', en: 'Stamp card' },
  toward: { pt: 'rumo aos 7', en: 'toward 7' },
  today: { pt: 'Hoje', en: 'Today' },
  stamp: { pt: 'Novo carimbo!', en: 'New stamp!' },
  paid: { pt: `Cartela cheia! +${CARTELA_REWARD} RV`, en: `Card full! +${CARTELA_REWARD} RV` },
} satisfies Record<string, Bilingual>;

export const CARTELA_ACTIVITY: Record<CartelaActivity, Bilingual> = {
  tatame: { pt: 'Treino no tatame', en: 'Mat practice' },
  balcao: { pt: 'Turno na padaria', en: 'Bakery counter shift' },
  feira: { pt: 'Feira livre', en: 'Street market' },
  conversa: { pt: 'Conversa na praça', en: 'Chat in the square' },
};

export function stampNotice(activity: CartelaActivity, stamps: number, paid: boolean): Bilingual {
  const label = CARTELA_ACTIVITY[activity];
  if (paid) return { pt: `${CARTELA_COPY.paid.pt} (${label.pt})`, en: `${CARTELA_COPY.paid.en} (${label.en})` };
  return {
    pt: `${CARTELA_COPY.stamp.pt} ${label.pt} · ${stamps}/${CARTELA_GOAL}`,
    en: `${CARTELA_COPY.stamp.en} ${label.en} · ${stamps}/${CARTELA_GOAL}`,
  };
}
