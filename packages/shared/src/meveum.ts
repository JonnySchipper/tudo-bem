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

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

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

function generateCombo(rng: Rng, customer: string): MgOrder {
  const nLines = 2 + Math.floor(rng() * 2);
  const pool = [...MG_ITEMS];
  const lines: MgOrderLine[] = [];
  for (let i = 0; i < nLines && pool.length; i++) {
    const item = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (!item) break;
    lines.push({ itemId: item.id, qty: 1 + Math.floor(rng() * 3) });
  }
  if (!lines.length && MG_ITEMS[0]) lines.push({ itemId: MG_ITEMS[0].id, qty: 1 });
  const whereMods = MG_MODS.filter((m) => m.group === 'where');
  const where = whereMods.length && rng() < 0.5 ? pick(rng, whereMods) : null;
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

/**
 * Rounds 1–2: Verde authored tickets · 3–4: level-bump authored · 5–6: generated combos.
 * `avoid` is tickets already served this shift. Null or undefined means none — it must not throw.
 */
export function makeOrder(rng: Rng, round: number, avoid?: readonly string[] | null): MgOrder {
  const skip = new Set(Array.isArray(avoid) ? avoid.filter((pt) => typeof pt === 'string') : []);
  const customer = pick(rng, CUSTOMERS);
  if (round < 4) {
    const level = round < 2 ? 'verde' : 'bump';
    const levelPool = AUTHORED_ORDERS.filter((o) => o.level === level && o.lines?.length);
    const fresh = levelPool.filter((o) => !skip.has(o.pt));
    const choices = fresh.length ? fresh : levelPool;
    if (choices.length) {
      const o = pick(rng, choices);
      const lines = o.lines.map(([itemId, qty]) => ({ itemId, qty }));
      const mods = [...(o.mods ?? [])];
      return { customer, lines, mods, pt: o.pt, en: o.en, timeMs: timeFor(lines, mods), authored: true };
    }
  }
  let made = generateCombo(rng, customer);
  for (let attempt = 1; attempt < 8 && skip.has(made.pt); attempt++) made = generateCombo(rng, customer);
  return made;
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

/** Station prep required before an item can go on the tray (pizza-style build loop). */
export type MgPrepStation = 'chapa' | 'bebidas';

export function mgPrepStation(itemId: string): MgPrepStation | null {
  if (itemId === 'pao_na_chapa' || itemId === 'misto_quente' || itemId === 'pastel' || itemId === 'coxinha') return 'chapa';
  if (itemId === 'cafe' || itemId === 'cafe_com_leite' || itemId === 'suco_de_laranja' || itemId === 'agua' || itemId === 'guarana') return 'bebidas';
  return null;
}

export function orderNeedsPack(order: MgOrder): boolean {
  return order.mods.some((m) => mgModById(m)?.group === 'where');
}

export interface MgBuiltUnit {
  itemId: string;
  /** Picked from prateleira (required — blocks tray-only cheats). */
  shelf?: boolean;
  chapa?: boolean;
  bebidas?: boolean;
  /** Passed embalagem when the ticket needs pra viagem / pra comer aqui. */
  pack?: boolean;
}

/** Test / server hook: fully prepped units for a ticket (station flags set). */
export function mgPerfectBuilt(order: MgOrder): MgBuiltUnit[] {
  const needsPack = orderNeedsPack(order);
  const units: MgBuiltUnit[] = [];
  for (const line of order.lines) {
    for (let i = 0; i < line.qty; i++) {
      const u: MgBuiltUnit = { itemId: line.itemId, shelf: true };
      const st = mgPrepStation(line.itemId);
      if (st === 'chapa') u.chapa = true;
      if (st === 'bebidas') u.bebidas = true;
      if (needsPack) u.pack = true;
      units.push(u);
    }
  }
  return units;
}

/** Station-complete built rows for whatever is currently on the tray (tests / bots). */
export function mgBuiltForTray(order: MgOrder, tray: Tray): MgBuiltUnit[] {
  const needsPack = orderNeedsPack(order);
  const units: MgBuiltUnit[] = [];
  for (const [itemId, qty] of Object.entries(sanitizeTray(tray))) {
    for (let i = 0; i < qty; i++) {
      const u: MgBuiltUnit = { itemId, shelf: true };
      const st = mgPrepStation(itemId);
      if (st === 'chapa') u.chapa = true;
      if (st === 'bebidas') u.bebidas = true;
      if (needsPack) u.pack = true;
      units.push(u);
    }
  }
  return units;
}

export function trayFromBuilt(units: MgBuiltUnit[]): Tray {
  const out: Tray = {};
  for (const u of units) {
    if (!mgItemById(u.itemId)) continue;
    out[u.itemId] = (out[u.itemId] ?? 0) + 1;
  }
  return out;
}

export function sanitizeBuilt(raw: unknown, tray: Tray): MgBuiltUnit[] {
  if (!Array.isArray(raw)) return [];
  const out: MgBuiltUnit[] = [];
  const counts: Tray = { ...sanitizeTray(tray) };
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const itemId = (row as MgBuiltUnit).itemId;
    if (!mgItemById(itemId)) continue;
    const left = counts[itemId] ?? 0;
    if (left <= 0) continue;
    counts[itemId] = left - 1;
    out.push({
      itemId,
      shelf: !!(row as MgBuiltUnit).shelf,
      chapa: !!(row as MgBuiltUnit).chapa,
      bebidas: !!(row as MgBuiltUnit).bebidas,
      pack: !!(row as MgBuiltUnit).pack,
    });
  }
  return out;
}

export interface MgBuildCheck extends TrayCheck {
  /** Tray contents match but a required chapa/bebidas/pack step was skipped. */
  prepMiss: boolean;
}

function prepOk(unit: MgBuiltUnit, needsPack: boolean): boolean {
  if (!unit.shelf) return false;
  const st = mgPrepStation(unit.itemId);
  if (st === 'chapa' && !unit.chapa) return false;
  if (st === 'bebidas' && !unit.bebidas) return false;
  if (needsPack && !unit.pack) return false;
  return true;
}

export interface MgBuildOptions {
  /** Production submits must include station-built units (A+ — no shelf→tray bypass). */
  requireBuilt?: boolean;
}

/** Full submission check. */
export function checkBuild(order: MgOrder, tray: Tray, mods: string[] = [], built?: MgBuiltUnit[] | null, opts?: MgBuildOptions): MgBuildCheck {
  const trayCheck = checkTray(order, tray, mods);
  const trayTotal = Object.values(sanitizeTray(tray)).reduce((a, b) => a + b, 0);
  const requireBuilt = opts?.requireBuilt ?? false;
  if (requireBuilt && trayTotal > 0 && !built?.length) return { ...trayCheck, ok: false, prepMiss: true };
  if (!built?.length) return { ...trayCheck, prepMiss: false };
  const units = sanitizeBuilt(built, tray);
  const fromBuilt = sanitizeTray(trayFromBuilt(units));
  const wantTray = sanitizeTray(tray);
  const trayMatch = Object.keys(wantTray).length === Object.keys(fromBuilt).length && Object.entries(wantTray).every(([k, v]) => fromBuilt[k] === v);
  if (!trayMatch || units.length !== Object.values(wantTray).reduce((a, b) => a + b, 0)) {
    return { ...trayCheck, ok: false, prepMiss: false };
  }
  const needsPack = orderNeedsPack(order);
  const pool = [...units];
  for (const line of order.lines) {
    for (let i = 0; i < line.qty; i++) {
      const idx = pool.findIndex((u) => u.itemId === line.itemId);
      if (idx < 0) return { ...trayCheck, ok: false, prepMiss: false };
      const u = pool.splice(idx, 1)[0]!;
      if (!prepOk(u, needsPack)) return { ...trayCheck, ok: false, prepMiss: true };
    }
  }
  if (pool.length) return { ...trayCheck, ok: false, prepMiss: false };
  return { ...trayCheck, prepMiss: false };
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
