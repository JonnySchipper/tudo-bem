/**
 * Admin Testes (credits panel). Pure helpers for the belt ladder and the rooms an admin can jump to.
 * Wins stay the source of truth (`normalizeBjj` / `BELT_LADDER`). Setting a belt or a stripe count
 * writes the win total that rank already means. The pace (5 / 10 / 20 / 40 / 80, four stripes, then promote) is unchanged.
 */
import { BELT_LADDER, STRIPES_PER_BELT, normalizeBjj, winsToBelt, type Belt, type BjjProgress } from './academia.js';
import type { BubbleStyle } from './subscription.js';
import type { Nameplate, RoomId } from './types.js';

export const ADMIN_TEST_ROOMS = ['praca', 'rua', 'rua_leste', 'feira', 'padaria', 'academia', 'escola', 'petshop', 'kitnet', 'aeroporto', 'desembarque', 'praia', 'lagoa'] as const;
export type AdminTestRoom = (typeof ADMIN_TEST_ROOMS)[number];

const BELT_SET = new Set<string>(BELT_LADDER.map((s) => s.belt));

export function isBelt(v: unknown): v is Belt {
  return typeof v === 'string' && BELT_SET.has(v);
}

export function isAdminTestRoom(v: unknown): v is AdminTestRoom {
  return typeof v === 'string' && (ADMIN_TEST_ROOMS as readonly string[]).includes(v);
}

/** Rooms the Testes teleporter offers. `andar` needs an academy id, so it stays off this list. */
export function adminTestRoomLabel(room: AdminTestRoom): { pt: string; en: string } {
  const labels: Record<AdminTestRoom, { pt: string; en: string }> = {
    praca: { pt: 'Praça', en: 'Square' },
    rua: { pt: 'Rua', en: 'Street' },
    rua_leste: { pt: 'Rua leste', en: 'East street' },
    feira: { pt: 'Feira', en: 'Market' },
    padaria: { pt: 'Padaria', en: 'Bakery' },
    academia: { pt: 'Academia', en: 'Academy' },
    escola: { pt: 'Escola', en: 'School' },
    petshop: { pt: 'Pet Shop', en: 'Pet shop' },
    kitnet: { pt: 'Kitnet', en: 'Studio' },
    aeroporto: { pt: 'Aeroporto', en: 'Airport' },
    desembarque: { pt: 'Desembarque', en: 'Arrivals hall' },
    praia: { pt: 'Praia', en: 'Beach' },
    lagoa: { pt: 'Lagoa', en: 'Lagoon' },
  };
  return labels[room];
}

/**
 * Cumulative wins that wear `belt` with `stripes` (0–3).
 * Stripe 4 on a belt that still promotes is that promotion: the next belt at 0 stripes.
 * Black keeps the fourth stripe (it does not promote).
 */
export function winsForRank(belt: Belt, stripes: number): number {
  const idx = BELT_LADDER.findIndex((s) => s.belt === belt);
  if (idx < 0) return 0;
  const step = BELT_LADDER[idx]!;
  const n = Math.max(0, Math.min(STRIPES_PER_BELT, Math.floor(Number.isFinite(stripes) ? stripes : 0)));
  if (belt !== 'preta' && n >= STRIPES_PER_BELT) {
    const next = BELT_LADDER[idx + 1]?.belt ?? 'preta';
    return winsToBelt(next);
  }
  return winsToBelt(belt) + n * step.per;
}

export interface AdminBeltCmd {
  belt?: Belt;
  stripes?: number;
  /** Absolute win count. Wins decide the belt. */
  wins?: number;
  /** Added to the current win count (may be negative). */
  deltaWins?: number;
}

/** Write a belt, a stripe count, or a win count. The stored progress is whatever `normalizeBjj` keeps. */
export function applyAdminBelt(prev: Partial<BjjProgress> | null | undefined, cmd: AdminBeltCmd): { ok: true; bjj: BjjProgress } | { ok: false } {
  const cur = normalizeBjj(prev);
  if (typeof cmd.wins === 'number' && Number.isFinite(cmd.wins)) {
    const wins = Math.max(0, Math.min(100_000, Math.floor(cmd.wins)));
    return { ok: true, bjj: normalizeBjj({ ...cur, wins }) };
  }
  if (typeof cmd.deltaWins === 'number' && Number.isFinite(cmd.deltaWins)) {
    const wins = Math.max(0, Math.min(100_000, cur.wins + Math.trunc(cmd.deltaWins)));
    return { ok: true, bjj: normalizeBjj({ ...cur, wins }) };
  }
  if (cmd.belt !== undefined && !isBelt(cmd.belt)) return { ok: false };
  if (cmd.belt === undefined && typeof cmd.stripes !== 'number') return { ok: false };
  const belt = cmd.belt ?? cur.belt;
  const stripes = typeof cmd.stripes === 'number' ? cmd.stripes : 0;
  return { ok: true, bjj: normalizeBjj({ ...cur, wins: winsForRank(belt, stripes) }) };
}

/** Calendar-key arithmetic lives with the one day boundary (playerDay.ts); re-exported for the Testes callers. */
export { addCalendarDays } from './playerDay.js';

/** `room` is one of the teleporter rooms (not the academy floor). */
export function asAdminRoom(room: RoomId): AdminTestRoom | null {
  return isAdminTestRoom(room) ? room : null;
}

/** What the Testes panel paints after each action. Built on the server from the profile it just wrote. */
export interface AdminTestSnapshot {
  id: string;
  name: string;
  testUser: boolean;
  belt: Belt;
  stripes: number;
  wins: number;
  canFound: boolean;
  coins: number;
  xp: number;
  goal: number;
  dayXp: number;
  verdeMode: boolean;
  nameplate: Nameplate;
  streak: number;
  words: number;
  room: RoomId | null;
  /** Counter items open on the menu ladder (2–12). */
  menuCount: number;
  shifts: number;
  /** 0 = no padaria. 1 Balcão, 2 Padaria, 3 Restaurante. */
  padariaStage: 0 | 1 | 2 | 3;
  pet: 'dog' | 'cat' | null;
  bubble: BubbleStyle;
  subActive: boolean;
  tutorialDone: boolean;
  arrivalIntroDone: boolean;
  recadoActive: number;
  minute: number;
  gameDay: number;
}
