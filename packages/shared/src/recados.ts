import type { Bilingual, RoomId, Tile } from './types.js';
import { OFFSTAGE_NPCS, ROOMS, type NpcId } from './rooms.js';
import { greetingFor, type Greeting } from './clock.js';
import { sameNpcRole } from './schedules.js';
import { MG_ITEMS, type Rng } from './meveum.js';
import { hotspotById } from './hotspots.js';
import { isNpcId, type BondMap } from './bonds.js';
import recadosPack from '../../../content/curriculum/phase0/recados.json';

/**
 * Recados (errands), the bag and the daily offer (HOWTO Phase 8). Everything here is pure and
 * unit-tested; the server engine (`apps/server/src/recados.ts`) only applies these rules to a session.
 */

// ---------- data model ----------

export type RecadoStep =
  | { kind: 'falar'; npc: NpcId } // talk to someone
  | { kind: 'pedir'; npc: NpcId; itemId: string; qty: number } // order it (scene / Conversa / Me vê um result must contain it)
  | { kind: 'entregar'; npc: NpcId; itemId: string; qty: number } // hand it over (from the bag)
  | { kind: 'ir'; room: RoomId; area?: { x: number; y: number; w: number; h: number } }
  | { kind: 'ler'; hotspotId: string } // read a sign
  | { kind: 'cumprimentar'; npc?: NpcId; timeCorrect?: boolean }; // greet (optionally with the right bom dia / boa tarde / boa noite)

export interface RecadoDef {
  id: string;
  giver: NpcId;
  /** Friendship points (0-100) needed before the giver offers it. */
  minBond: number;
  /** Feature flag the recado waits for (`RECADO_FLAGS`); the offer logic skips it while the flag is off. */
  requires?: RecadoFlag;
  title: Bilingual;
  /** What the giver says. */
  ask: Bilingual;
  thanks: Bilingual;
  steps: RecadoStep[];
  reward: { rv: number; bond: number; itemId?: string };
  /** Curriculum card ids this recado practices. */
  cards: string[];
  needs_br: true;
}

/** Something that happened in the world. The server emits these; `stepMatches` decides what they mean. */
export type RecadoEvent =
  | { kind: 'talked'; npc: NpcId }
  | { kind: 'ordered'; npc: NpcId; items: { itemId: string; qty: number }[] }
  | { kind: 'gave'; npc: NpcId; itemId: string; qty: number }
  | { kind: 'entered'; room: RoomId; tile: Tile }
  | { kind: 'read'; hotspotId: string }
  /** `minute` is the game minute (0..1439) the greeting was said. `company` = someone was there to hear it (default true). */
  | { kind: 'greeted'; npc?: NpcId; text: string; minute: number; company?: boolean };

export interface ActiveRecado {
  id: string;
  /** Index of the step being worked on. */
  step: number;
}

/** Stored on the profile as `recados`. */
export interface RecadoState {
  /** Game day (`gameDay(now)`) the offer below was rolled for. -1 = never rolled. */
  day: number;
  offered: string[];
  active: ActiveRecado[];
  /** Recados finished on `day`. They come back tomorrow. */
  done: string[];
  /** NPCs the player already got the daily talk bond from on `day`. */
  talked?: NpcId[];
  /** NPCs the player already got the good-Conversa bond from on `day`. */
  graded?: NpcId[];
}

export const RECADOS_PER_DAY = 3;
export const RECADO_MAX_ACTIVE = 3;

// ---------- items and the bag ----------

export interface ItemDef {
  id: string;
  name: Bilingual;
  /** Curriculum card id, when the word already has a card. */
  cardId?: string;
}

/** Explicit picks for recados. Ids match the padaria shelf ids in `meveum.ts` (`pao`, `pao_de_queijo`, `cafe_com_leite`). */
const EXTRA_ITEMS: ItemDef[] = [
  // needs_br: true (no curriculum cards yet; see "Proposed cards" in the decisions note)
  { id: 'jornal', name: { pt: 'jornal', en: 'newspaper' } },
  { id: 'flores', name: { pt: 'flores', en: 'flowers' } },
  { id: 'banana', name: { pt: 'banana', en: 'banana' } },
  // the feira (Phase 9). needs_br: true
  { id: 'laranja', name: { pt: 'laranja', en: 'orange' } },
  { id: 'maca', name: { pt: 'maçã', en: 'apple' } },
  { id: 'alface', name: { pt: 'alface', en: 'lettuce' } },
  { id: 'tomate', name: { pt: 'tomate', en: 'tomato' } },
  { id: 'caldo_de_cana', name: { pt: 'caldo de cana', en: 'sugarcane juice' } },
];

/** Everything that can sit in the bag: the whole padaria shelf (names come from its cards) plus the extras. */
export const ITEMS: readonly ItemDef[] = [
  ...MG_ITEMS.map((i) => ({ id: i.id, name: { pt: i.card.form, en: i.card.gloss_en }, cardId: i.card.id })),
  ...EXTRA_ITEMS,
];
export const itemById = (id: unknown): ItemDef | undefined => (typeof id === 'string' ? ITEMS.find((i) => i.id === id) : undefined);

export const BAG_MAX_PER_ITEM = 20;

export type Bag = Record<string, number>;

/** Returns a new bag with `qty` more of an item (capped). Unknown items are ignored. */
export function addToBag(bag: Bag, itemId: string, qty: number): Bag {
  if (!itemById(itemId) || !Number.isFinite(qty) || qty <= 0) return { ...bag };
  return { ...bag, [itemId]: Math.min(BAG_MAX_PER_ITEM, (bag[itemId] ?? 0) + Math.floor(qty)) };
}

/** Returns a new bag with `qty` fewer, or null when the bag does not hold that many. */
export function takeFromBag(bag: Bag, itemId: string, qty: number): Bag | null {
  const have = bag[itemId] ?? 0;
  if (!Number.isFinite(qty) || qty <= 0 || have < qty) return null;
  const next = { ...bag };
  if (have - qty <= 0) delete next[itemId];
  else next[itemId] = have - qty;
  return next;
}

export function normalizeBag(raw: unknown): Bag {
  const out: Bag = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const item of ITEMS) {
    const v = (raw as Record<string, unknown>)[item.id];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) out[item.id] = Math.min(BAG_MAX_PER_ITEM, Math.floor(v));
  }
  return out;
}

// ---------- the recados (content/curriculum/phase0/recados.md -> recados.json via `pnpm content`) ----------

/**
 * Features a recado can wait for. `RECADO_FLAGS` is the switch: while a flag is off the offer logic skips every
 * recado that `requires` it (dead ends before the feature exists: the feira is Phase 9, `falar` for anyone but Seu Carlos needs the Phase 7
 * dialogue box). Both are in now, so both flags are on. Tests override it.
 */
export type RecadoFlag = 'feira' | 'dialogue';
export const RECADO_FLAGS: Record<RecadoFlag, boolean> = { feira: true, dialogue: true };

/** Is this recado playable with the given flags (default: the live `RECADO_FLAGS`)? */
export const recadoEnabled = (d: Pick<RecadoDef, 'requires'>, flags: Readonly<Record<RecadoFlag, boolean>> = RECADO_FLAGS): boolean => !d.requires || flags[d.requires] === true;

// needs_br: true for every string in the pack. A1, informal São Paulo Portuguese.
export const RECADOS: readonly RecadoDef[] = recadosPack.recados as unknown as RecadoDef[];

export const recadoById = (id: unknown, defs: readonly RecadoDef[] = RECADOS): RecadoDef | undefined =>
  typeof id === 'string' ? defs.find((d) => d.id === id) : undefined;

// ---------- greetings ----------

export type GreetingKind = 'oi' | Greeting;

/** What kind of greeting a chat line contains, if any (accent- and case-insensitive). The specific ones win over 'oi'. */
export function greetingKind(text: string): GreetingKind | null {
  const t = ` ${text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  if (t.includes(' bom dia ')) return 'bom dia';
  if (t.includes(' boa tarde ')) return 'boa tarde';
  if (t.includes(' boa noite ')) return 'boa noite';
  if (t.includes(' oi ') || t.includes(' ola ')) return 'oi';
  return null;
}

// ---------- step logic ----------

/** Does this event complete this step? (Pure. The caller already knows the step is the current one.) */
export function stepMatches(step: RecadoStep, event: RecadoEvent): boolean {
  switch (step.kind) {
    case 'falar':
      return event.kind === 'talked' && sameNpcRole(step.npc, event.npc);
    case 'pedir':
      return (
        event.kind === 'ordered' &&
        sameNpcRole(step.npc, event.npc) &&
        event.items.filter((i) => i.itemId === step.itemId).reduce((n, i) => n + (Number.isFinite(i.qty) ? i.qty : 0), 0) >= step.qty
      );
    case 'entregar':
      return event.kind === 'gave' && sameNpcRole(step.npc, event.npc) && event.itemId === step.itemId && event.qty >= step.qty;
    case 'ir': {
      if (event.kind !== 'entered' || event.room !== step.room) return false;
      const a = step.area;
      return !a || (event.tile.x >= a.x && event.tile.x < a.x + a.w && event.tile.y >= a.y && event.tile.y < a.y + a.h);
    }
    case 'ler':
      return event.kind === 'read' && event.hotspotId === step.hotspotId;
    case 'cumprimentar': {
      if (event.kind !== 'greeted') return false;
      const kind = greetingKind(event.text);
      if (!kind) return false;
      if (step.npc ? !event.npc || !sameNpcRole(step.npc, event.npc) : !event.npc && event.company === false) return false;
      return !step.timeCorrect || kind === greetingFor(event.minute);
    }
  }
}

export interface AdvanceResult {
  active: ActiveRecado;
  /** The current step was completed by this event. */
  matched: boolean;
  /** No steps left: the recado is finished. */
  done: boolean;
}

/** Feed one event to an active recado. Only the current step is checked (steps run in order). Never mutates. */
export function advance(active: ActiveRecado, def: RecadoDef, event: RecadoEvent): AdvanceResult {
  const step = def.steps[active.step];
  if (!step || !stepMatches(step, event)) return { active, matched: false, done: active.step >= def.steps.length };
  const next = { ...active, step: active.step + 1 };
  return { active: next, matched: true, done: next.step >= def.steps.length };
}

// ---------- daily offer ----------

export const freshRecadoState = (): RecadoState => ({ day: -1, offered: [], active: [], done: [] });

/**
 * The recados offered on a game day: up to `count` (3) random ones from givers the player has unlocked
 * (`bond >= minBond`) and whose feature flag is on (`RECADO_FLAGS`), never one finished today and never one already
 * accepted. Deterministic for a given `rng`.
 */
export function offerFor(
  profile: { bond?: BondMap; recados?: RecadoState },
  day: number,
  rng: Rng,
  defs: readonly RecadoDef[] = RECADOS,
  count = RECADOS_PER_DAY,
  flags: Readonly<Record<RecadoFlag, boolean>> = RECADO_FLAGS,
): string[] {
  const st = profile.recados;
  const doneToday = st && st.day === day ? st.done : [];
  const activeIds = st?.active.map((a) => a.id) ?? [];
  const pool = defs.filter((d) => recadoEnabled(d, flags) && (profile.bond?.[d.giver] ?? 0) >= d.minBond && !doneToday.includes(d.id) && !activeIds.includes(d.id));
  const out: string[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!.id);
  return out;
}

/** Roll the day over: same state if it is still `day`, otherwise a fresh offer (active recados carry over). Never mutates. */
export function rollRecadoDay(
  profile: { bond?: BondMap; recados?: RecadoState },
  day: number,
  rng: Rng,
  defs: readonly RecadoDef[] = RECADOS,
  flags: Readonly<Record<RecadoFlag, boolean>> = RECADO_FLAGS,
): RecadoState {
  const st = profile.recados ?? freshRecadoState();
  if (st.day === day) return st;
  return { day, offered: offerFor({ bond: profile.bond, recados: st }, day, rng, defs, RECADOS_PER_DAY, flags), active: st.active, done: [], talked: [], graded: [] };
}

/** Old or hand-edited saves: coerce anything to a valid state. Never throws. */
export function normalizeRecados(raw: unknown): RecadoState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const npcs = (v: unknown): NpcId[] => (Array.isArray(v) ? v.filter(isNpcId) : []);
  const active = Array.isArray(r.active)
    ? r.active
        .filter((a): a is ActiveRecado => !!a && typeof a === 'object' && typeof (a as ActiveRecado).id === 'string' && Number.isInteger((a as ActiveRecado).step) && (a as ActiveRecado).step >= 0)
        .map((a) => ({ id: a.id, step: a.step }))
    : [];
  return {
    day: typeof r.day === 'number' && Number.isFinite(r.day) ? Math.floor(r.day) : -1,
    offered: ids(r.offered),
    active,
    done: ids(r.done),
    talked: npcs(r.talked),
    graded: npcs(r.graded),
  };
}

// ---------- wire views ----------

export interface RecadoOfferView {
  id: string;
  giver: NpcId;
  title: Bilingual;
  ask: Bilingual;
  reward: RecadoDef['reward'];
}

export interface RecadoActiveView {
  id: string;
  giver: NpcId;
  title: Bilingual;
  /** Index of the step being worked on, out of `steps`. */
  step: number;
  steps: number;
  /** What to do now, for the tracker line. */
  hint: Bilingual;
}

export const offerView = (d: RecadoDef): RecadoOfferView => ({ id: d.id, giver: d.giver, title: d.title, ask: d.ask, reward: d.reward });

export function activeView(a: ActiveRecado, d: RecadoDef): RecadoActiveView {
  const step = d.steps[Math.min(a.step, d.steps.length - 1)];
  return { id: d.id, giver: d.giver, title: d.title, step: a.step, steps: d.steps.length, hint: step ? describeStep(step) : d.title };
}

export const npcName = (id: NpcId): string =>
  Object.values(ROOMS)
    .flatMap((r) => r.npcs)
    .find((n) => n.id === id)?.name ?? (OFFSTAGE_NPCS as Partial<Record<NpcId, { name: string }>>)[id]?.name ?? id;

const itemName = (id: string): Bilingual => itemById(id)?.name ?? { pt: id, en: id };

// needs_br: true (templated step lines)
/** One-line instruction for a step, for the tracker and the step-done notice. */
export function describeStep(step: RecadoStep): Bilingual {
  switch (step.kind) {
    case 'falar':
      return { pt: `Fale com ${npcName(step.npc)}.`, en: `Talk to ${npcName(step.npc)}.` };
    case 'pedir': {
      const it = itemName(step.itemId);
      return { pt: `Peça ${step.qty}× ${it.pt} (${npcName(step.npc)}).`, en: `Order ${step.qty}× ${it.en} (${npcName(step.npc)}).` };
    }
    case 'entregar': {
      const it = itemName(step.itemId);
      return { pt: `Entregue ${step.qty}× ${it.pt} pra ${npcName(step.npc)}.`, en: `Hand ${step.qty}× ${it.en} to ${npcName(step.npc)}.` };
    }
    case 'ir':
      return { pt: `Vá para: ${ROOMS[step.room].name}.`, en: `Go to: ${ROOMS[step.room].gloss}.` };
    case 'ler': {
      const h = hotspotById(step.hotspotId);
      return h ? { pt: `Leia a placa: ${h.pt}`, en: `Read the sign: ${h.en}` } : { pt: 'Leia a placa.', en: 'Read the sign.' };
    }
    case 'cumprimentar': {
      const who = step.npc ? npcName(step.npc) : 'alguém';
      const whoEn = step.npc ? npcName(step.npc) : 'someone';
      return step.timeCorrect
        ? { pt: `Cumprimente ${who} (bom dia, boa tarde ou boa noite, conforme a hora).`, en: `Greet ${whoEn} (bom dia, boa tarde or boa noite, to match the time).` }
        : { pt: `Cumprimente ${who}.`, en: `Greet ${whoEn}.` };
    }
  }
}
