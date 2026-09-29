import type { Bilingual, RoomId, Tile } from './types.js';
import { ROOMS, type NpcId } from './rooms.js';
import { greetingFor, type Greeting } from './clock.js';
import { MG_ITEMS, type Rng } from './meveum.js';
import { hotspotById } from './hotspots.js';
import { isNpcId, type BondMap } from './bonds.js';

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

// ---------- starter recados (test fixtures / starter content; the final 15 are authored by a later agent) ----------

// needs_br: true for every string below. A1, informal São Paulo Portuguese.
export const RECADOS: readonly RecadoDef[] = [
  {
    id: 'carlos_cafe_pra_nanda',
    giver: 'carlos',
    minBond: 0,
    title: { pt: 'Café pra Nanda', en: 'Coffee for Nanda' },
    ask: { pt: 'Oi! A Nanda ainda não tomou café. Leva um café com leite pra ela?', en: 'Hi! Nanda hasn’t had her coffee yet. Can you take her a café com leite?' },
    thanks: { pt: 'Que bom! Ela vai adorar. Valeu!', en: 'Great! She’s going to love it. Thanks!' },
    steps: [
      { kind: 'pedir', npc: 'carlos', itemId: 'cafe_com_leite', qty: 1 },
      { kind: 'entregar', npc: 'nanda', itemId: 'cafe_com_leite', qty: 1 },
    ],
    reward: { rv: 10, bond: 4 },
    cards: ['lex.padaria.cafe_com_leite', 'lex.padaria.me_ve', 'lex.padaria.por_favor'],
    needs_br: true,
  },
  {
    id: 'nanda_coxinha',
    giver: 'nanda',
    minBond: 0,
    title: { pt: 'Coxinha da padaria', en: 'Coxinha from the bakery' },
    ask: { pt: 'Tô com fome! Você pede uma coxinha pra mim na padaria?', en: 'I’m hungry! Can you get me a coxinha at the bakery?' },
    thanks: { pt: 'Hum, quentinha! Obrigada, viu?', en: 'Mmm, still warm! Thank you!' },
    steps: [
      { kind: 'pedir', npc: 'carlos', itemId: 'coxinha', qty: 1 },
      { kind: 'entregar', npc: 'nanda', itemId: 'coxinha', qty: 1 },
    ],
    reward: { rv: 12, bond: 4 },
    cards: ['lex.padaria.coxinha', 'lex.padaria.me_ve', 'lex.padaria.quentinho'],
    needs_br: true,
  },
  {
    id: 'julia_cumprimento_certo',
    giver: 'julia',
    minBond: 0,
    title: { pt: 'O cumprimento certo', en: 'The right greeting' },
    ask: { pt: 'Oi! Cumprimenta alguém do jeito certo pra hora do dia. Depois passa na padaria, tá?', en: 'Hi! Greet someone the right way for the time of day. Then stop by the bakery, okay?' },
    thanks: { pt: 'Muito bem! Você tá pegando o jeito!', en: 'Well done! You’re getting the hang of it!' },
    steps: [{ kind: 'cumprimentar', timeCorrect: true }, { kind: 'ir', room: 'padaria' }],
    reward: { rv: 10, bond: 4 },
    cards: ['lex.social.bom_dia', 'lex.social.boa_tarde', 'lex.social.boa_noite'],
    needs_br: true,
  },
  {
    id: 'carlos_agua_pra_julia',
    giver: 'carlos',
    minBond: 10,
    title: { pt: 'Água pra Júlia', en: 'Water for Júlia' },
    ask: { pt: 'A Júlia passa o dia na praça, coitada. Leva uma água pra ela?', en: 'Júlia spends all day in the square, poor thing. Can you take her a water?' },
    thanks: { pt: 'Isso aí! Por conta da casa, um pão de queijo.', en: 'That’s it! On the house, a pão de queijo.' },
    steps: [
      { kind: 'pedir', npc: 'carlos', itemId: 'agua', qty: 1 },
      { kind: 'entregar', npc: 'julia', itemId: 'agua', qty: 1 },
    ],
    reward: { rv: 12, bond: 5, itemId: 'pao_de_queijo' },
    cards: ['lex.padaria.agua', 'lex.padaria.me_ve', 'lex.padaria.por_conta_da_casa'],
    needs_br: true,
  },
];

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
      return event.kind === 'talked' && event.npc === step.npc;
    case 'pedir':
      return (
        event.kind === 'ordered' &&
        event.npc === step.npc &&
        event.items.filter((i) => i.itemId === step.itemId).reduce((n, i) => n + (Number.isFinite(i.qty) ? i.qty : 0), 0) >= step.qty
      );
    case 'entregar':
      return event.kind === 'gave' && event.npc === step.npc && event.itemId === step.itemId && event.qty >= step.qty;
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
      if (step.npc ? event.npc !== step.npc : !event.npc && event.company === false) return false;
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
 * (`bond >= minBond`), never one finished today and never one already accepted. Deterministic for a given `rng`.
 */
export function offerFor(
  profile: { bond?: BondMap; recados?: RecadoState },
  day: number,
  rng: Rng,
  defs: readonly RecadoDef[] = RECADOS,
  count = RECADOS_PER_DAY,
): string[] {
  const st = profile.recados;
  const doneToday = st && st.day === day ? st.done : [];
  const activeIds = st?.active.map((a) => a.id) ?? [];
  const pool = defs.filter((d) => (profile.bond?.[d.giver] ?? 0) >= d.minBond && !doneToday.includes(d.id) && !activeIds.includes(d.id));
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
): RecadoState {
  const st = profile.recados ?? freshRecadoState();
  if (st.day === day) return st;
  return { day, offered: offerFor({ bond: profile.bond, recados: st }, day, rng, defs), active: st.active, done: [], talked: [], graded: [] };
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
    .find((n) => n.id === id)?.name ?? id;

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
