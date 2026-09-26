import { cardById, type Card } from './cards.js';
import { ECONOMY } from './constants.js';
import { joinEn, joinPt, numberEn, numberPt } from './numbers.js';
import ordersPack from '../../../content/curriculum/phase0/me-ve-um-orders.json';

/**
 * “Me vê um…” — padaria tray assembler (GDD §8.1). Pure logic shared by server (authority) and tests.
 * Orders come from content/curriculum/phase0/me-ve-um-orders.(md|json); later rounds combine the
 * same cards with number/gender agreement.
 */

export interface MgItem {
  id: string;
  card: Card;
}

/** Shelf order (all lexeme cards in lexemes-padaria-a1.md). */
const SHELF = ['pao', 'pao_na_chapa', 'pastel', 'coxinha', 'bolo', 'cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'pao_de_queijo', 'misto_quente', 'guarana'];

export const MG_ITEMS: MgItem[] = SHELF.map((id) => {
  const card = cardById(`lex.padaria.${id}`);
  if (!card) throw new Error(`Me vê um shelf item without card: ${id}`);
  return { id, card };
});
export const mgItemById = (id: string) => MG_ITEMS.find((i) => i.id === id);

export interface MgMod {
  id: string;
  pt: string;
  en: string;
  group: 'where' | 'coffee';
}

export const MG_MODS: MgMod[] = ordersPack.mods as MgMod[];
export const mgModById = (id: string) => MG_MODS.find((m) => m.id === id);

export const MG_ROUNDS = 6;
export const MG_MAX_TRAY = 9;

export interface MgOrderLine {
  itemId: string;
  qty: number;
}

export interface MgOrder {
  customer: string;
  lines: MgOrderLine[];
  mods: string[];
  pt: string;
  en: string;
  timeMs: number;
  /** Authored order from the curriculum pack (vs generated combo). */
  authored: boolean;
}

interface AuthoredOrder {
  level: 'verde' | 'bump';
  pt: string;
  en: string;
  lines: [string, number][];
  mods: string[];
}

export const AUTHORED_ORDERS: AuthoredOrder[] = ordersPack.orders as AuthoredOrder[];

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = ['Dona Ana', 'Seu João', 'Pedro', 'Luana', 'Tio Beto', 'Dona Cida', 'Gabi', 'Rafa', 'Dona Lurdes', 'Téo'];

const OPENERS: { pt: (l: string) => string; en: (l: string) => string }[] = [
  { pt: (l) => `Me vê ${l}, por favor.`, en: (l) => `I’ll take ${l}, please.` },
  { pt: (l) => `Bom dia! Me vê ${l}.`, en: (l) => `Good morning! I’ll take ${l}.` },
  { pt: (l) => `${cap(l)}, por favor.`, en: (l) => `${cap(l)}, please.` },
  { pt: (l) => `Me vê ${l}.`, en: (l) => `I’ll take ${l}.` },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

export function linePt(line: MgOrderLine): string {
  const item = mgItemById(line.itemId)!;
  const g = item.card.gender ?? 'm';
  const noun = line.qty === 1 ? item.card.form : (item.card.plural ?? item.card.form);
  return `${numberPt(line.qty, g)} ${noun}`;
}

export function lineEn(line: MgOrderLine): string {
  const item = mgItemById(line.itemId)!;
  if (line.qty === 1) {
    const g = item.card.gloss_en_tray ?? item.card.gloss_en;
    return `${/^[aeiou]/i.test(g) ? 'an' : 'a'} ${g}`;
  }
  return `${numberEn(line.qty)} ${item.card.gloss_en_plural ?? item.card.gloss_en}`;
}

function timeFor(lines: MgOrderLine[], mods: string[]) {
  const extraQty = lines.reduce((s, l) => s + l.qty - 1, 0);
  return 16_000 + 6_000 * lines.length + 2_000 * extraQty + 4_000 * mods.length;
}

/** Rounds 1–2: Verde authored tickets · 3–4: level-bump authored · 5–6: generated combos. */
export function makeOrder(rng: Rng, round: number, avoid: string[] = []): MgOrder {
  const customer = pick(rng, CUSTOMERS);
  if (round < 4) {
    const level = round < 2 ? 'verde' : 'bump';
    const pool = AUTHORED_ORDERS.filter((o) => o.level === level && !avoid.includes(o.pt));
    const o = pick(rng, pool.length ? pool : AUTHORED_ORDERS.filter((x) => x.level === level));
    const lines = o.lines.map(([itemId, qty]) => ({ itemId, qty }));
    return { customer, lines, mods: [...o.mods], pt: o.pt, en: o.en, timeMs: timeFor(lines, o.mods), authored: true };
  }
  const nLines = 2 + Math.floor(rng() * 2);
  const pool = [...MG_ITEMS];
  const lines: MgOrderLine[] = [];
  for (let i = 0; i < nLines; i++) {
    const item = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    lines.push({ itemId: item.id, qty: 1 + Math.floor(rng() * 3) });
  }
  const where = rng() < 0.5 ? pick(rng, MG_MODS.filter((m) => m.group === 'where')) : null;
  const mods = where ? [where.id] : [];
  const opener = pick(rng, OPENERS);
  let listPt = joinPt(lines.map(linePt));
  let listEn = joinEn(lines.map(lineEn));
  if (where) {
    listPt += ` ${where.pt}`;
    listEn += ` ${where.en}`;
  }
  return { customer, lines, mods, pt: opener.pt(listPt), en: opener.en(listEn), timeMs: timeFor(lines, mods), authored: false };
}

export type Tray = Record<string, number>;

export interface TrayCheck {
  ok: boolean;
  missing: MgOrderLine[];
  extra: MgOrderLine[];
  missingMods: string[];
  extraMods: string[];
}

export function sanitizeTray(raw: unknown): Tray {
  const out: Tray = {};
  if (!raw || typeof raw !== 'object') return out;
  let total = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!mgItemById(k)) continue;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) continue;
    const q = Math.min(n, MG_MAX_TRAY - total);
    if (q <= 0) break;
    out[k] = q;
    total += q;
  }
  return out;
}

export function sanitizeMods(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = [...new Set(raw.filter((m): m is string => typeof m === 'string' && !!mgModById(m)))];
  // "pra viagem" and "pra comer aqui" are exclusive; keep the last one chosen.
  const where = ids.filter((m) => mgModById(m)!.group === 'where');
  return ids.filter((m) => mgModById(m)!.group !== 'where' || m === where.at(-1));
}

export function checkTray(order: MgOrder, tray: Tray, mods: string[] = []): TrayCheck {
  const missing: MgOrderLine[] = [];
  const extra: MgOrderLine[] = [];
  const want = new Map(order.lines.map((l) => [l.itemId, l.qty]));
  for (const [itemId, qty] of want) {
    const have = tray[itemId] ?? 0;
    if (have < qty) missing.push({ itemId, qty: qty - have });
    if (have > qty) extra.push({ itemId, qty: have - qty });
  }
  for (const [itemId, qty] of Object.entries(tray)) if (!want.has(itemId) && qty > 0) extra.push({ itemId, qty });
  const missingMods = order.mods.filter((m) => !mods.includes(m));
  const extraMods = mods.filter((m) => !order.mods.includes(m));
  return { ok: !missing.length && !extra.length && !missingMods.length && !extraMods.length, missing, extra, missingMods, extraMods };
}

export type MgOutcome = 'perfeito' | 'segunda' | 'errou' | 'tempo';

/** Points: first try 3, after Carlos repeats 1, miss 0. Streak of first-try hits adds +1 from the 2nd on. */
export function pointsFor(outcome: MgOutcome, streak: number): number {
  if (outcome === 'perfeito') return 3 + (streak >= 2 ? 1 : 0);
  if (outcome === 'segunda') return 1;
  return 0;
}

export const MG_MAX_POINTS = MG_ROUNDS * 3 + (MG_ROUNDS - 1);

export function mgPayout(points: number): number {
  const p = Math.max(0, Math.min(MG_MAX_POINTS, points));
  return ECONOMY.minigameMin + Math.round(((ECONOMY.minigameMax - ECONOMY.minigameMin) * p) / MG_MAX_POINTS);
}
