import { PADARIA_CARDS, type Card } from './cards.js';
import { ECONOMY } from './constants.js';
import { joinEn, joinPt, numberEn, numberPt } from './numbers.js';

/** “Me vê um…” — padaria tray assembler (GDD §8.1). Pure logic shared by server (authority) and tests. */

export interface MgItem {
  id: string;
  card: Card;
}

export const MG_ITEMS: MgItem[] = PADARIA_CARDS.map((card) => ({ id: card.id.replace('lex.padaria.', ''), card }));
export const mgItemById = (id: string) => MG_ITEMS.find((i) => i.id === id);

export const MG_ROUNDS = 6;
export const MG_MAX_TRAY = 9;

export interface MgOrderLine {
  itemId: string;
  qty: number;
}

export interface MgOrder {
  customer: string;
  lines: MgOrderLine[];
  pt: string;
  en: string;
  timeMs: number;
}

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
  { pt: (l) => `Me vê ${l}, por favor.`, en: (l) => `Give me ${l}, please.` },
  { pt: (l) => `Bom dia! Me vê ${l}.`, en: (l) => `Good morning! Give me ${l}.` },
  { pt: (l) => `Oi, Seu Carlos! Me vê ${l}, por favor.`, en: (l) => `Hi, Seu Carlos! Give me ${l}, please.` },
  { pt: (l) => `Por favor, me vê ${l}.`, en: (l) => `Please, give me ${l}.` },
];

const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

export function linePt(line: MgOrderLine): string {
  const item = mgItemById(line.itemId)!;
  const g = item.card.gender ?? 'm';
  const noun = line.qty === 1 ? item.card.form : item.card.plural ?? item.card.form;
  return `${numberPt(line.qty, g)} ${noun}`;
}

export function lineEn(line: MgOrderLine): string {
  const item = mgItemById(line.itemId)!;
  if (line.qty === 1) {
    const g = item.card.gloss_en;
    return `${/^[aeiou]/i.test(g) ? 'an' : 'a'} ${g}`;
  }
  return `${numberEn(line.qty)} ${item.card.gloss_en_plural ?? item.card.gloss_en}`;
}

export function makeOrder(rng: Rng, round: number): MgOrder {
  const nLines = round < 2 ? 1 : round < 4 ? 2 : 2 + Math.floor(rng() * 2);
  const maxQty = round < 2 ? 1 : round < 4 ? 2 : 3;
  const pool = [...MG_ITEMS];
  const lines: MgOrderLine[] = [];
  for (let i = 0; i < nLines; i++) {
    const idx = Math.floor(rng() * pool.length);
    const item = pool.splice(idx, 1)[0];
    lines.push({ itemId: item.id, qty: 1 + Math.floor(rng() * maxQty) });
  }
  const opener = pick(rng, OPENERS);
  const pt = opener.pt(joinPt(lines.map(linePt)));
  const en = opener.en(joinEn(lines.map(lineEn)));
  const extraQty = lines.reduce((s, l) => s + l.qty - 1, 0);
  return { customer: pick(rng, CUSTOMERS), lines, pt, en, timeMs: 16_000 + 6_000 * nLines + 2_000 * extraQty };
}

export type Tray = Record<string, number>;

export interface TrayCheck {
  ok: boolean;
  missing: MgOrderLine[];
  extra: MgOrderLine[];
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

export function checkTray(order: MgOrder, tray: Tray): TrayCheck {
  const missing: MgOrderLine[] = [];
  const extra: MgOrderLine[] = [];
  const want = new Map(order.lines.map((l) => [l.itemId, l.qty]));
  for (const [itemId, qty] of want) {
    const have = tray[itemId] ?? 0;
    if (have < qty) missing.push({ itemId, qty: qty - have });
    if (have > qty) extra.push({ itemId, qty: have - qty });
  }
  for (const [itemId, qty] of Object.entries(tray)) if (!want.has(itemId) && qty > 0) extra.push({ itemId, qty });
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
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
