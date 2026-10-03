/**
 * "Correria no Balcão" (EN "Counter Rush"): the padaria counter game, formerly "Me vê um…". Pure rules shared by the server (the
 * authority) and the tests. No timers, no I/O: a shift is a plain object, `advance` lets time pass, `act` applies one player action.
 *
 * A shift is three waves (4 + 5 + 6 = 15 customers, about three real minutes). Customers queue at the counter with a patience meter,
 * order in a speech bubble (written) or by voice only (listening), may add something or change their mind, and the player builds the
 * tray in the world: shelves, the estufa, the chapa (a cooking window that ends in a burn), the coffee pour meter, a bag or a plate.
 * "Me vê um…" stays what customers SAY; the order text comes from the curriculum pack (`meveum.ts`) plus generated combos.
 * Every PT string here is new content: `needs_br: true` (listed in DECISIONS.md).
 */
import { ECONOMY } from './constants.js';
import { localizeGreeting } from './clock.js';
import { moneyEn, moneyPt } from './feira.js';
import { cpuLook, readsFeminine } from './looks.js';
import { CPU_NAMES } from './ambiance.js';
import { numberEn, numberPt } from './numbers.js';
import { npcDefById, type NpcId } from './rooms.js';
import type { Appearance, Bilingual, CorreriaProgress } from './types.js';
import {
  AUTHORED_ORDERS,
  MG_ITEMS,
  MG_MAX_TRAY,
  MG_MODS,
  checkTray,
  generateCombo,
  lineEn,
  linePt,
  mgItemById,
  mgModById,
  pick,
  orderTimeMs,
  type MgItem,
  type MgOrder,
  type MgOrderLine,
  type Rng,
  type Tray,
  type TrayCheck,
} from './meveum.js';

// ---------------------------------------------------------------- numbers of the shift

export const CORRERIA_WAVES = 3;
/** Customers per wave. */
export const WAVE_SIZES: readonly number[] = [4, 5, 6];
export const CORRERIA_TOTAL = WAVE_SIZES.reduce((a, b) => a + b, 0);
/** Most customers at the counter at once (the one being served plus the queue). */
export const MAX_PRESENT = 3;
/** A customer walks to the counter this long before they can order or lose patience. */
export const WALK_MS = 1800;
/** After a customer leaves, the next one steps up this much later. */
export const STEP_UP_MS = 900;
/** Queued (not first) customers lose patience at this share of the front rate. */
export const QUEUE_DRAIN = 0.45;
/** Closing tickets: a wrong tray costs this share of the customer's patience. */
export const MISTAKE_COST = 0.15;
/** How long "Quanto é?" waits for an answer. */
export const ASK_MS = 15_000;

export const CHAPA = { cookMs: 2400, burnMs: 5400, toleranceMs: 150, sizzleStepMs: 800 } as const;
export const POUR = { fullMs: 1800, fastMs: 1300, goodMin: 0.7, spillAt: 1.08, minHoldMs: 120, abortFactor: 1.7 } as const;

/** Shelf items that need the chapa / the coffee machine; every other item is a plain grab (the estufa, the vitrine, the geladeira). */
export const CHAPA_ITEMS: readonly string[] = ['pao_na_chapa', 'misto_quente'];
export const CAFE_ITEMS: readonly string[] = ['cafe', 'cafe_com_leite'];
export type Station = 'chapa' | 'cafe';
export const stationOf = (itemId: string): Station | null => (CHAPA_ITEMS.includes(itemId) ? 'chapa' : CAFE_ITEMS.includes(itemId) ? 'cafe' : null);

/** Where an item lives on the counter (the art and the stage group the shelf this way). */
export type Shelf = 'vitrine' | 'estufa' | 'chapa' | 'cafe' | 'geladeira';
export const SHELF_OF: Record<string, Shelf> = {
  pao: 'vitrine',
  bolo: 'vitrine',
  pao_de_queijo: 'vitrine',
  pastel: 'estufa',
  coxinha: 'estufa',
  pao_na_chapa: 'chapa',
  misto_quente: 'chapa',
  cafe: 'cafe',
  cafe_com_leite: 'cafe',
  suco_de_laranja: 'geladeira',
  agua: 'geladeira',
  guarana: 'geladeira',
};

/** Prices in whole reais (the totals stay under 100 so `numberPt` can say them). */
export const COUNTER_PRICES: Record<string, number> = {
  pao: 2,
  pao_na_chapa: 6,
  pastel: 8,
  coxinha: 7,
  bolo: 9,
  cafe: 4,
  cafe_com_leite: 6,
  suco_de_laranja: 8,
  agua: 3,
  pao_de_queijo: 5,
  misto_quente: 10,
  guarana: 6,
};

export const orderTotal = (lines: readonly MgOrderLine[]): number => lines.reduce((s, l) => s + (COUNTER_PRICES[l.itemId] ?? 0) * l.qty, 0);

/** The note a customer pays with: the smallest of 5 / 10 / 20 / 50 / 100 that covers the total. */
export const payNote = (total: number): number => [5, 10, 20, 50, 100].find((n) => n >= total) ?? 100;

// ---------------------------------------------------------------- levels and unlocks

export interface CorreriaLevel {
  id: 'verde' | 'jeito' | 'correria' | 'mestre';
  pt: string;
  en: string;
  /** Multiplies every customer's patience (bigger = kinder). */
  patienceMul: number;
  /** Multiplies the gap between customers (bigger = slower). */
  gapMul: number;
  /** Per wave: the chance an order is spoken only / has a follow-up / ends with "Quanto é?". */
  listen: readonly [number, number, number];
  follow: readonly [number, number, number];
  ask: readonly [number, number, number];
  askType: 'choice' | 'type';
  /** Share of the customer's patience a listening replay costs. */
  replayCost: number;
  maxLines: number;
  maxQty: number;
  /** English glosses are always on (the player can still hide them from level 1). */
  glossLocked: boolean;
}

export const LEVELS: readonly CorreriaLevel[] = [
  { id: 'verde', pt: 'Verde', en: 'Green', patienceMul: 1.6, gapMul: 1.35, listen: [0, 0.1, 0.2], follow: [0, 0, 0.1], ask: [0, 0.2, 0.3], askType: 'choice', replayCost: 0.04, maxLines: 2, maxQty: 2, glossLocked: true },
  { id: 'jeito', pt: 'Pegando o jeito', en: 'Getting the hang of it', patienceMul: 1.25, gapMul: 1.1, listen: [0.1, 0.25, 0.35], follow: [0, 0.15, 0.25], ask: [0.15, 0.3, 0.4], askType: 'choice', replayCost: 0.07, maxLines: 2, maxQty: 3, glossLocked: false },
  { id: 'correria', pt: 'Na correria', en: 'In the rush', patienceMul: 1, gapMul: 0.95, listen: [0.2, 0.35, 0.5], follow: [0.1, 0.25, 0.35], ask: [0.25, 0.4, 0.5], askType: 'type', replayCost: 0.08, maxLines: 3, maxQty: 3, glossLocked: false },
  { id: 'mestre', pt: 'Mestre do balcão', en: 'Counter master', patienceMul: 0.85, gapMul: 0.85, listen: [0.3, 0.45, 0.6], follow: [0.15, 0.3, 0.4], ask: [0.3, 0.45, 0.55], askType: 'type', replayCost: 0.1, maxLines: 3, maxQty: 3, glossLocked: false },
];

/** Total shift stars at which the level steps up (index = level). */
export const LEVEL_STARS: readonly number[] = [0, 3, 8, 16];
export const levelForStars = (stars: number): number => {
  let lv = 0;
  for (let i = 0; i < LEVEL_STARS.length; i++) if (stars >= LEVEL_STARS[i]!) lv = i;
  return lv;
};

export type UnlockId = 'salgados' | 'chapa2' | 'cafe_rapido' | 'sabado';
export interface Unlock {
  id: UnlockId;
  stars: number;
  pt: string;
  en: string;
  hint: Bilingual;
}
/** Never pay-to-win: shift stars only, and each one is a new tool or a new kind of customer. */
export const UNLOCKS: readonly Unlock[] = [
  { id: 'salgados', stars: 2, pt: 'Pastel e coxinha na estufa', en: 'Pastel and coxinha in the warmer', hint: { pt: 'Agora tem salgado na estufa!', en: 'The warmer has snacks now!' } },
  { id: 'chapa2', stars: 4, pt: 'Segunda chapa', en: 'A second grill spot', hint: { pt: 'A chapa agora tem dois lugares.', en: 'The grill has two spots now.' } },
  { id: 'cafe_rapido', stars: 7, pt: 'Cafeteira mais rápida', en: 'A faster coffee machine', hint: { pt: 'A cafeteira novinha enche mais rápido.', en: 'The new machine fills faster.' } },
  { id: 'sabado', stars: 10, pt: 'Pedidos de sábado', en: 'Saturday orders', hint: { pt: 'Aos sábados vêm pedidos grandes, com bônus.', en: 'On Saturdays, big orders come in with a bonus.' } },
];
export const unlockedFor = (stars: number): UnlockId[] => UNLOCKS.filter((u) => stars >= u.stars).map((u) => u.id);
export const newUnlocks = (before: number, after: number): Unlock[] => UNLOCKS.filter((u) => before < u.stars && after >= u.stars);

/** The items on the counter for these unlocks (pastel and coxinha open with `salgados`). */
export function itemsFor(unlocked: readonly string[]): MgItem[] {
  return MG_ITEMS.filter((i) => (i.id === 'pastel' || i.id === 'coxinha' ? unlocked.includes('salgados') : true));
}
export const chapaSlots = (unlocked: readonly string[]): number => (unlocked.includes('chapa2') ? 2 : 1);
export const pourMsFor = (unlocked: readonly string[]): number => (unlocked.includes('cafe_rapido') ? POUR.fastMs : POUR.fullMs);

// ---------------------------------------------------------------- pure helpers (timing windows, stages, numbers)

export type ChapaPhase = 'raw' | 'ready' | 'burnt';
export const chapaPhase = (ageMs: number): ChapaPhase => (ageMs < CHAPA.cookMs - CHAPA.toleranceMs ? 'raw' : ageMs <= CHAPA.burnMs ? 'ready' : 'burnt');
export type ChapaFrame = 'sizzle_0' | 'sizzle_1' | 'sizzle_2' | 'burnt';
export function chapaFrame(ageMs: number): ChapaFrame {
  if (ageMs > CHAPA.burnMs) return 'burnt';
  const i = Math.min(2, Math.floor(Math.max(0, ageMs) / CHAPA.sizzleStepMs));
  return `sizzle_${i}` as ChapaFrame;
}

export type PourVerdict = 'ok' | 'short' | 'spill';
export function pourVerdict(heldMs: number, fullMs: number = POUR.fullMs): { fill: number; verdict: PourVerdict } {
  const fill = Math.max(0, heldMs) / fullMs;
  return { fill, verdict: fill < POUR.goodMin ? 'short' : fill > POUR.spillAt ? 'spill' : 'ok' };
}
/** 0 = idle, 1..4 -> `coffee_pour_<0..3>` is `fill` bucket 0..3. */
export const pourFrame = (fill: number): 0 | 1 | 2 | 3 => (fill < 0.25 ? 0 : fill < 0.5 ? 1 : fill < 0.75 ? 2 : 3);

/** The patience meter art state over a customer: 4 = full ... 1 = nearly gone, 0 = out. */
export const patienceStage = (frac: number): 0 | 1 | 2 | 3 | 4 => (frac <= 0 ? 0 : frac > 0.75 ? 4 : frac > 0.5 ? 3 : frac > 0.25 ? 2 : 1);
/** The tip jar's fill state 0..3 from the reais in it. */
export const tipJarStage = (tips: number): 0 | 1 | 2 | 3 => (tips < 1 ? 0 : tips < 10 ? 1 : tips < 24 ? 2 : 3);

const PT_NUMBERS = new Map<string, number>();
for (let n = 0; n <= 100; n++) {
  PT_NUMBERS.set(numberPt(n, 'm'), n);
  PT_NUMBERS.set(numberPt(n, 'f'), n);
}
const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const PT_NUMBERS_STRIPPED = new Map([...PT_NUMBERS].map(([k, v]) => [strip(k), v]));
/** "12", "R$ 12", "doze", "doze reais", "vinte e um" -> the number (0-100), else null. Accents optional; digits are fine. */
export function parseNumberAnswer(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : null;
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const s = strip(raw)
    .replace(/\br\b/g, ' ')
    .replace(/\b(reais|real)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s);
    return n <= 100 ? n : null;
  }
  return PT_NUMBERS_STRIPPED.get(s) ?? null;
}

/** Three totals to choose from: the right one and two plausible slips, shuffled. */
export function askOptions(rng: Rng, total: number): number[] {
  const wrong = new Set<number>();
  const cands = [1, -1, 2, -2, 10, -10, 5, -5, 3, -3];
  const swap = total >= 10 && total < 100 ? Number(`${total % 10}${Math.floor(total / 10)}`) : -1;
  if (swap > 0 && swap !== total) wrong.add(swap);
  while (wrong.size < 2) {
    const c = total + pick(rng, cands);
    if (c > 0 && c <= 100 && c !== total) wrong.add(c);
  }
  const out = [total, ...[...wrong].slice(0, 2)];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ---------------------------------------------------------------- text

const feminine = (name: string) => readsFeminine(name) || /^(Tia|Dona|Professora)/.test(name);
const thanks = (fem: boolean) => (fem ? 'obrigada' : 'obrigado');
const Thanks = (fem: boolean) => (fem ? 'Obrigada' : 'Obrigado');

const PERFECT_LINES: ((fem: boolean) => Bilingual)[] = [
  (f) => ({ pt: `Perfeito, ${thanks(f)}!`, en: 'Perfect, thank you!' }),
  () => ({ pt: 'Isso mesmo, valeu!', en: 'Just right, thanks!' }),
  (f) => ({ pt: `Rapidinho! ${Thanks(f)}!`, en: 'So quick! Thank you!' }),
  () => ({ pt: 'Show! Tá ótimo.', en: 'Great! It looks perfect.' }),
];
const FAST_LINES: ((fem: boolean) => Bilingual)[] = [
  (f) => ({ pt: `Nossa, que rapidez! ${Thanks(f)}!`, en: 'Wow, that was fast! Thank you!' }),
  () => ({ pt: 'Que atendimento! Parabéns!', en: 'What service! Congratulations!' }),
];
const SECOND_LINES: ((fem: boolean) => Bilingual)[] = [
  (f) => ({ pt: `Agora sim! ${Thanks(f)}.`, en: 'Now we’re talking! Thank you.' }),
  () => ({ pt: 'Tudo certo agora. Valeu!', en: 'All good now. Thanks!' }),
];
const REGULAR_LINES: ((fem: boolean) => Bilingual)[] = [
  () => ({ pt: 'Você é o melhor do balcão!', en: 'You’re the best at the counter!' }),
  (f) => ({ pt: `Sempre perfeito! ${Thanks(f)}, viu?`, en: 'Always perfect! Thanks, you know?' }),
];
/** Each regular has a voice of their own: a greeting when they step up and a thank-you after a perfect tray (needs_br). */
export const REGULAR_VOICE: Partial<Record<NpcId, { greet: Bilingual; thanks: Bilingual[] }>> = {
  nanda: { greet: { pt: 'Oi! Bom te ver no balcão.', en: 'Hi! Good to see you at the counter.' }, thanks: [{ pt: 'Ficou lindo! Valeu, viu?', en: 'It looks lovely! Thanks, you know?' }, { pt: 'Você já podia vender chapéu comigo!', en: 'You could sell hats with me by now!' }] },
  julia: { greet: { pt: 'E aí! Já tô com fome!', en: 'Hey! I’m already hungry!' }, thanks: [{ pt: 'Tá ótimo! Obrigada, viu?', en: 'It’s great! Thanks, you know?' }, { pt: 'Ai, que cheirinho bom!', en: 'Oh, that smells so good!' }] },
  prof: { greet: { pt: 'Bom dia! Hoje tem treino.', en: 'Good morning! Training today.' }, thanks: [{ pt: 'Muito bem! Isso é disciplina.', en: 'Well done! That is discipline.' }, { pt: 'Rápido e certinho. Gostei!', en: 'Quick and exact. I like it!' }] },
  ze: { greet: { pt: 'Fala! Vim buscar meu café.', en: 'Hey! I came for my coffee.' }, thanks: [{ pt: 'Tá certo, tá certo! Obrigado.', en: 'That’s right, that’s right! Thanks.' }, { pt: 'Nota dez, hein?', en: 'A ten out of ten, huh?' }] },
  chico: { greet: { pt: 'Opa! Cheguei com fome.', en: 'Hey! I showed up hungry.' }, thanks: [{ pt: 'Show! Tá na mão.', en: 'Great! Got it right here.' }, { pt: 'Quase tão bom quanto o meu pastel!', en: 'Almost as good as my pastel!' }] },
  rosa: { greet: { pt: 'Bom dia, flor! Tudo bem?', en: 'Good morning, dear! How are you?' }, thanks: [{ pt: 'Que capricho! Obrigada.', en: 'What care! Thank you.' }, { pt: 'Até as flores sorriram!', en: 'Even the flowers smiled!' }] },
  tia_lu: { greet: { pt: 'Oi, meu bem! Rapidinho, tá?', en: 'Hi, dear! Make it quick, okay?' }, thanks: [{ pt: 'Ai, que delícia! Obrigada.', en: 'Oh, how nice! Thank you.' }, { pt: 'Você é um amor!', en: 'You’re a sweetheart!' }] },
};

const LATE_LINES: ((fem: boolean) => Bilingual)[] = [
  (f) => ({ pt: `Ai, não dá, tô atrasad${f ? 'a' : 'o'}! Tchau.`, en: 'Oh, I can’t wait, I’m running late! Bye.' }),
  () => ({ pt: 'Demorou demais, vou embora!', en: 'Too slow, I’m leaving!' }),
];
const GAVE_UP_LINES: Bilingual[] = [
  { pt: 'Deixa pra lá, eu vou em outra padaria.', en: 'Never mind, I’ll go to another bakery.' },
  { pt: 'Ai, desisto. Tchau!', en: 'Ugh, I give up. Bye!' },
];
export const CHEERS: Bilingual[] = [
  { pt: 'Isso aí!', en: 'That’s it!' },
  { pt: 'Boa!', en: 'Nice one!' },
  { pt: 'Tá voando!', en: 'You’re flying!' },
];
export const WAVE_CHEERS: Bilingual[] = [
  { pt: 'Lá vem gente! Calma e capricho.', en: 'Here come more people! Stay calm and careful.' },
  { pt: 'Mais uma rodada. Bora!', en: 'Another round. Let’s go!' },
  { pt: 'Última leva! Dá conta!', en: 'Last batch! You can do it!' },
];
export const ASK_LINE: Bilingual = { pt: 'Quanto é?', en: 'How much is it?' };

/** The correction a customer gives for a wrong tray: the quantity first, then a missing item, an extra one, then the mods. */
export function correctionFor(order: MgOrder, tray: Tray, check: TrayCheck): Bilingual {
  // 1. a line that is there but with the wrong count: "Não, eu pedi DOIS pães…"
  for (const line of order.lines) {
    const have = tray[line.itemId] ?? 0;
    if (have > 0 && have !== line.qty) {
      const item = mgItemById(line.itemId)!;
      const g = item.card.gender ?? 'm';
      const noun = line.qty === 1 ? item.card.form : (item.card.plural ?? item.card.form);
      const enNoun = line.qty === 1 ? (item.card.gloss_en_tray ?? item.card.gloss_en) : (item.card.gloss_en_plural ?? item.card.gloss_en);
      return { pt: `Não, eu pedi ${numberPt(line.qty, g).toUpperCase()} ${noun}…`, en: `No, I ordered ${numberEn(line.qty).toUpperCase()} ${enNoun}…` };
    }
  }
  // 2. an item missing altogether
  const miss = check.missing.find((m) => !(tray[m.itemId] > 0));
  if (miss) {
    const line = order.lines.find((l) => l.itemId === miss.itemId) ?? miss;
    return { pt: `Faltou ${linePt(line)}!`, en: `You forgot ${lineEn(line)}!` };
  }
  // 3. something I did not order
  const extra = check.extra[0];
  if (extra) {
    const item = mgItemById(extra.itemId)!;
    return { pt: `Eu não pedi ${item.card.form}.`, en: `I didn’t order ${item.card.gloss_en_tray ?? item.card.gloss_en}.` };
  }
  // 4. the mods
  const mm = check.missingMods[0];
  if (mm) {
    const m = mgModById(mm)!;
    return { pt: `Era ${m.pt}!`, en: `It was ${m.en}!` };
  }
  const em = check.extraMods[0];
  if (em) {
    const m = mgModById(em)!;
    return m.group === 'where' ? { pt: `Não era ${m.pt}.`, en: `It wasn’t ${m.en}.` } : { pt: `Eu não pedi ${m.pt}.`, en: `I didn’t ask for ${m.en}.` };
  }
  return { pt: 'Hmm, não é bem isso.', en: 'Hmm, that’s not quite it.' };
}

// ---------------------------------------------------------------- orders: modes, follow-ups, Saturday

export type OrderMode = 'written' | 'listening';

export interface Follow {
  kind: 'extra' | 'swap';
  pt: string;
  en: string;
  /** The order after the follow-up (lines and mods; the first order is what was said before). */
  lines: MgOrderLine[];
  mods: string[];
}

const DRINKS = ['cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'guarana'];
const art = (item: MgItem) => ((item.card.gender ?? 'm') === 'f' ? 'da' : 'do');
const enArt = (item: MgItem) => item.card.gloss_en_tray ?? item.card.gloss_en;

/** "Ah, e pra viagem!" / "Ah, e mais um pão!" / "Não, um suco em vez do café." Always solvable from the new order. */
export function makeFollow(rng: Rng, order: MgOrder, items: readonly MgItem[]): Follow | null {
  const ids = new Set(items.map((i) => i.id));
  const kinds: ('where' | 'more' | 'swap')[] = [];
  if (!order.mods.some((m) => mgModById(m)?.group === 'where')) kinds.push('where');
  if (order.lines.some((l) => l.qty < 3)) kinds.push('more');
  if (order.lines.some((l) => l.qty === 1 && DRINKS.includes(l.itemId))) kinds.push('swap');
  if (!kinds.length) return null;
  const kind = pick(rng, kinds);
  if (kind === 'where') {
    const w = pick(rng, MG_MODS.filter((m) => m.group === 'where'));
    return { kind: 'extra', pt: w.id === 'pra_viagem' ? 'Ah, e é pra viagem!' : 'Ah, e é pra comer aqui!', en: w.id === 'pra_viagem' ? 'Oh, and it’s to go!' : 'Oh, and it’s for here!', lines: order.lines.map((l) => ({ ...l })), mods: [...order.mods, w.id] };
  }
  if (kind === 'more') {
    const cand = order.lines.filter((l) => l.qty < 3);
    const line = pick(rng, cand);
    const lines = order.lines.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : { ...l }));
    return { kind: 'extra', pt: `Ah, e mais ${linePt({ itemId: line.itemId, qty: 1 })}!`, en: `Oh, and one more ${enArt(mgItemById(line.itemId)!).replace(/^(a|an) /, '')}!`, lines, mods: [...order.mods] };
  }
  const oldLine = pick(rng, order.lines.filter((l) => l.qty === 1 && DRINKS.includes(l.itemId)));
  const old = mgItemById(oldLine.itemId)!;
  const options = DRINKS.filter((d) => ids.has(d) && d !== oldLine.itemId && !order.lines.some((l) => l.itemId === d));
  if (!options.length) return null;
  const nu = mgItemById(pick(rng, options))!;
  // the new drink keeps the spot of the old one; the coffee mods only make sense with coffee
  const keepMods = CAFE_ITEMS.includes(nu.id) ? [...order.mods] : order.mods.filter((m) => mgModById(m)?.group !== 'coffee');
  const lines = order.lines.map((l) => (l === oldLine ? { itemId: nu.id, qty: 1 } : { ...l }));
  return {
    kind: 'swap',
    pt: `Não, ${linePt({ itemId: nu.id, qty: 1 })} em vez ${art(old)} ${old.card.form}.`,
    en: `No, ${lineEn({ itemId: nu.id, qty: 1 })} instead of the ${enArt(old)}.`,
    lines,
    mods: keepMods,
  };
}

/** The order for a customer: authored tickets early, generated combos later, only items the player has unlocked. */
export function makeCorrOrder(
  rng: Rng,
  o: { level: number; wave: number; unlocked: readonly string[]; saturday: boolean; avoid: readonly string[]; minute?: number; customer?: string },
): MgOrder & { special?: boolean } {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, o.level))]!;
  const items = itemsFor(o.unlocked);
  const ids = new Set(items.map((i) => i.id));
  const customer = o.customer ?? 'Cliente';
  const finish = <T extends MgOrder>(ord: T): T => (o.minute === undefined ? ord : { ...ord, ...localizeGreeting({ pt: ord.pt, en: ord.en }, o.minute) });
  const skip = new Set(o.avoid.map((pt) => localizeGreeting({ pt }, 600).pt));
  const wave = Math.max(0, Math.min(2, o.wave));
  // Saturday: some customers bring a big order (unlocked with the stars; it pays +50%)
  if (o.saturday && o.unlocked.includes('sabado') && rng() < 0.4) {
    const c = generateCombo(rng, customer, { pool: items, minLines: 3, maxLines: 3, maxQty: 2, whereChance: 0.4 });
    const body = c.pt.replace(/^(Bom dia|Boa tarde|Boa noite)! /, '').replace(/^Me vê /, '');
    return finish({ ...c, pt: `Sábado! Hoje é festa: me vê ${body.replace(/^[A-ZÀ-Ú]/, (m) => m.toLowerCase())}`, en: `Saturday! Party day: I’ll take ${c.en.replace(/^(Good (morning|afternoon|evening)! )?(I’ll take )?/i, '').replace(/^[A-Z]/, (m) => m.toLowerCase())}`, special: true });
  }
  const roundByLevel: number[][] = [
    [0, wave === 1 ? 1 : 2, 2],
    [0, 2, 2],
    [2, 2, 4],
    [2, 4, 4],
  ];
  const r0 = roundByLevel[Math.min(o.level, 3)]![wave]!;
  // wave 1 of Verde is the easy pool only; later waves may mix in the harder authored tickets, level 2+ also generated combos
  let round = r0;
  if (o.level <= 1 && wave === 1) round = rng() < 0.5 ? 0 : 2;
  if (o.level === 2 && wave === 1) round = rng() < 0.5 ? 2 : 4;
  const pool = AUTHORED_ORDERS.filter((a) => (round < 2 ? a.level === 'verde' : a.level === 'bump') && a.lines?.length && a.lines.every(([id]) => ids.has(id)));
  if (round < 4 && pool.length) {
    const fresh = pool.filter((a) => !skip.has(a.pt));
    const a = pick(rng, fresh.length ? fresh : pool);
    const lines = a.lines.map(([itemId, qty]) => ({ itemId, qty }));
    return finish({ customer, lines, mods: [...(a.mods ?? [])], pt: a.pt, en: a.en, timeMs: orderTimeMs(lines, a.mods ?? []), authored: true });
  }
  let made = generateCombo(rng, customer, { pool: items, minLines: lv.maxLines >= 3 ? 2 : 1, maxLines: lv.maxLines, maxQty: lv.maxQty, coffeeModChance: o.level >= 2 ? 0.3 : 0 });
  for (let i = 1; i < 8 && skip.has(localizeGreeting({ pt: made.pt }, 600).pt); i++) made = generateCombo(rng, customer, { pool: items, minLines: lv.maxLines >= 3 ? 2 : 1, maxLines: lv.maxLines, maxQty: lv.maxQty, coffeeModChance: o.level >= 2 ? 0.3 : 0 });
  return finish(made);
}

// ---------------------------------------------------------------- customers

export interface Who {
  key: string;
  name: string;
  fem: boolean;
  /** Set for a regular (an NPC tied to a bond). The client draws their authored look. */
  npc?: NpcId;
}

/** Look for a customer (the client draws it on a character sheet). Neighbours get the deterministic CPU look of their first name. */
export function whoAppearance(w: Pick<Who, 'name' | 'npc'>): { appearance: Appearance; hat: string | null } {
  if (w.npc) {
    const d = npcDefById(w.npc);
    if (d) return { appearance: { ...d.appearance }, hat: d.hat ?? null };
  }
  const l = cpuLook(w.name);
  return { appearance: { ...l.appearance }, hat: l.hat ?? null };
}

/** Regulars eligible for a shift (friends at 1+ heart; bakers are behind the counter, not customers). */
export const REGULAR_NPCS: readonly NpcId[] = ['nanda', 'julia', 'prof', 'ze', 'chico', 'rosa', 'tia_lu'];

export type CState = 'walk' | 'queue' | 'front' | 'asking';

export interface AskState {
  total: number;
  options: number[];
  type: 'choice' | 'type';
  /** Shift time (ms) it closes at. */
  deadline: number;
  pay: number;
}

export interface Customer {
  id: number;
  who: Who;
  regular: boolean;
  special: boolean;
  /** A regular says hello when they step up. */
  greet: Bilingual | null;
  wave: number;
  mode: OrderMode;
  /** What they said first; the live order may differ after a follow-up. */
  said: { pt: string; en: string };
  order: MgOrder;
  follow: Follow | null;
  followAt: number | null;
  followFired: boolean;
  state: CState;
  arrivedAt: number;
  readyAt: number;
  frontAt: number | null;
  patienceMax: number;
  patience: number;
  mistakes: number;
  replays: number;
  ask: AskState | null;
}

export interface ChapaSlot {
  itemId: string;
  at: number;
  burnt: boolean;
}

export interface ShiftStats {
  served: number;
  perfect: number;
  second: number;
  left: number;
  points: number;
  tips: number;
  combo: number;
  bestCombo: number;
  askRight: number;
  askTotal: number;
  regulars: string[];
  /** Cards of the served orders (the end card lists the ones new to the Caderno). */
  words: string[];
}

export interface ShiftCtx {
  seed: number;
  level: number;
  unlocked: readonly string[];
  saturday: boolean;
  /** Game-clock minute, so customers greet by the hour. */
  minute: number;
  baker: 'carlos' | 'graca';
  /** Friends at 1+ hearts. */
  regulars: { npc: NpcId; hearts: number }[];
  rng?: Rng;
}

export interface Shift {
  v: 1;
  ctx: ShiftCtx;
  rng: Rng;
  /** Shift time in ms (only advances through `advance`). */
  t: number;
  customers: Customer[];
  nextId: number;
  spawned: number;
  nextSpawnAt: number;
  nextFrontAt: number;
  wave: number;
  tray: string[];
  pack: 'bag' | 'plate' | null;
  mods: string[];
  chapa: (ChapaSlot | null)[];
  pour: { itemId: string; at: number } | null;
  stats: ShiftStats;
  served: string[];
  usedNames: string[];
  usedRegulars: string[];
  over: boolean;
  /** Test hook: true makes snapshots carry each order's lines. */
  debug: boolean;
}

export type CEvent =
  | { k: 'arrive'; id: number }
  | { k: 'front'; id: number }
  | { k: 'follow'; id: number; pt: string; en: string }
  | { k: 'wave'; wave: number; size: number; line: Bilingual }
  | { k: 'grab'; item: string }
  | { k: 'chapa_put'; slot: number; item: string }
  | { k: 'chapa_ok'; slot: number; item: string }
  | { k: 'chapa_raw'; slot: number }
  | { k: 'chapa_burnt'; slot: number }
  | { k: 'chapa_trash'; slot: number }
  | { k: 'pour_start'; item: string }
  | { k: 'pour_ok'; item: string; fill: number }
  | { k: 'pour_bad'; why: 'short' | 'spill'; fill: number }
  | { k: 'pack'; kind: 'bag' | 'plate' | null }
  | { k: 'mod'; id: string; on: boolean }
  | { k: 'clear' }
  | { k: 'replay'; id: number }
  | { k: 'serve'; id: number; outcome: 'perfeito' | 'segunda'; line: Bilingual; emote: string; points: number; tip: number; combo: number; speed: number }
  | { k: 'correct'; id: number; line: Bilingual }
  | { k: 'ask'; id: number; line: Bilingual }
  | { k: 'ask_result'; id: number; ok: boolean; total: number; line: Bilingual; pay: number; change: number; points: number }
  | { k: 'leave'; id: number; why: 'tempo' | 'errou'; line: Bilingual; emote: string }
  | { k: 'cheer'; line: Bilingual }
  | { k: 'no'; why: string; line: Bilingual }
  | { k: 'over' };

export type CAct =
  | { a: 'grab'; item: string }
  | { a: 'chapa_put'; slot: number; item: string }
  | { a: 'chapa_take'; slot: number }
  | { a: 'pour_start'; item: string }
  | { a: 'pour_end' }
  | { a: 'pack'; kind: 'bag' | 'plate' | null }
  | { a: 'mod'; id: string }
  | { a: 'clear' }
  | { a: 'serve' }
  | { a: 'replay' }
  | { a: 'answer'; value: string | number };

/** Parse an action from the wire; null when it is not one of ours. */
export function sanitizeAct(raw: unknown): CAct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const item = (v: unknown) => (typeof v === 'string' && mgItemById(v) ? v : null);
  const slot = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ? (v as number) : null);
  switch (r.a) {
    case 'grab': {
      const i = item(r.item);
      return i ? { a: 'grab', item: i } : null;
    }
    case 'chapa_put': {
      const i = item(r.item);
      const s = slot(r.slot);
      return i && s !== null ? { a: 'chapa_put', slot: s, item: i } : null;
    }
    case 'chapa_take': {
      const s = slot(r.slot);
      return s !== null ? { a: 'chapa_take', slot: s } : null;
    }
    case 'pour_start': {
      const i = item(r.item);
      return i ? { a: 'pour_start', item: i } : null;
    }
    case 'pour_end':
      return { a: 'pour_end' };
    case 'pack':
      return r.kind === 'bag' || r.kind === 'plate' ? { a: 'pack', kind: r.kind } : r.kind === null ? { a: 'pack', kind: null } : null;
    case 'mod':
      return typeof r.id === 'string' && mgModById(r.id)?.group === 'coffee' ? { a: 'mod', id: r.id } : null;
    case 'clear':
      return { a: 'clear' };
    case 'serve':
      return { a: 'serve' };
    case 'replay':
      return { a: 'replay' };
    case 'answer':
      return typeof r.value === 'string' || typeof r.value === 'number' ? { a: 'answer', value: typeof r.value === 'string' ? r.value.slice(0, 40) : r.value } : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- the shift

const WAVE_GAP_MS = [10_000, 8_000, 6_500];
const WAVE_PATIENCE = [1, 0.85, 0.7];

/** Patience a customer starts with, from how long their order takes to build. Always at least 16 s. */
export function patienceMs(order: MgOrder, level: number, wave: number, regular = false): number {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))]!;
  const ms = order.timeMs * 0.9 * lv.patienceMul * WAVE_PATIENCE[Math.max(0, Math.min(2, wave))]! * (regular ? 1.15 : 1);
  return Math.round(Math.min(100_000, Math.max(16_000, ms)));
}

export function newShift(ctx: ShiftCtx): Shift {
  const rng = ctx.rng ?? mulberry(ctx.seed);
  return {
    v: 1,
    ctx: { ...ctx, unlocked: [...ctx.unlocked], regulars: ctx.regulars.map((r) => ({ ...r })) },
    rng,
    t: 0,
    customers: [],
    nextId: 1,
    spawned: 0,
    nextSpawnAt: 1200,
    nextFrontAt: 0,
    wave: 0,
    tray: [],
    pack: null,
    mods: [],
    chapa: Array.from({ length: chapaSlots(ctx.unlocked) }, () => null),
    pour: null,
    stats: { served: 0, perfect: 0, second: 0, left: 0, points: 0, tips: 0, combo: 0, bestCombo: 0, askRight: 0, askTotal: 0, regulars: [], words: [] },
    served: [],
    usedNames: [],
    usedRegulars: [],
    over: false,
    debug: false,
  };
}

function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const levelOf = (sh: Shift) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, sh.ctx.level))]!;

/** Which wave the n-th customer (0-based) belongs to. */
export function waveOf(index: number): number {
  let n = index;
  for (let w = 0; w < WAVE_SIZES.length; w++) {
    if (n < WAVE_SIZES[w]!) return w;
    n -= WAVE_SIZES[w]!;
  }
  return WAVE_SIZES.length - 1;
}

const front = (sh: Shift) => sh.customers.find((c) => c.state === 'front' || c.state === 'asking');

function pickWho(sh: Shift): Who {
  const { rng } = sh;
  const eligible = sh.ctx.regulars.filter((r) => r.hearts >= 1 && !sh.usedRegulars.includes(r.npc));
  if (eligible.length && rng() < 0.32) {
    const total = eligible.reduce((s, r) => s + r.hearts + 1, 0);
    let x = rng() * total;
    let chosen = eligible[0]!;
    for (const r of eligible) {
      x -= r.hearts + 1;
      if (x <= 0) {
        chosen = r;
        break;
      }
    }
    const d = npcDefById(chosen.npc);
    sh.usedRegulars.push(chosen.npc);
    const name = d?.name ?? chosen.npc;
    return { key: `npc:${chosen.npc}`, name, fem: feminine(name), npc: chosen.npc };
  }
  const regularNames = new Set(REGULAR_NPCS.map((n) => npcDefById(n)?.name));
  const names = CPU_NAMES.filter((n) => !sh.usedNames.includes(n) && !regularNames.has(n));
  const name = pick(rng, names.length ? names : CPU_NAMES);
  sh.usedNames.push(name);
  return { key: `cpu:${name}`, name, fem: feminine(name) };
}

function spawn(sh: Shift, ev: CEvent[]): void {
  const idx = sh.spawned;
  const wave = waveOf(idx);
  const lv = levelOf(sh);
  const who = pickWho(sh);
  const order = makeCorrOrder(sh.rng, { level: sh.ctx.level, wave, unlocked: sh.ctx.unlocked, saturday: sh.ctx.saturday, avoid: sh.served, minute: sh.ctx.minute, customer: who.name });
  sh.served.push(order.pt);
  const regular = !!who.npc;
  const mode: OrderMode = sh.rng() < lv.listen[wave]! ? 'listening' : 'written';
  const follow = sh.rng() < lv.follow[wave]! ? makeFollow(sh.rng, order, itemsFor(sh.ctx.unlocked)) : null;
  const pMax = patienceMs(order, sh.ctx.level, wave, regular);
  const c: Customer = {
    id: sh.nextId++,
    who,
    regular,
    special: !!order.special,
    greet: who.npc ? (REGULAR_VOICE[who.npc]?.greet ?? null) : null,
    wave,
    mode,
    said: { pt: order.pt, en: order.en },
    order,
    follow,
    followAt: null,
    followFired: false,
    state: 'walk',
    arrivedAt: sh.t,
    readyAt: sh.t + WALK_MS,
    frontAt: null,
    patienceMax: pMax,
    patience: pMax,
    mistakes: 0,
    replays: 0,
    ask: null,
  };
  sh.customers.push(c);
  sh.spawned++;
  if (wave !== sh.wave || idx === 0) {
    sh.wave = wave;
    ev.push({ k: 'wave', wave, size: WAVE_SIZES[wave]!, line: WAVE_CHEERS[wave]! });
  }
  ev.push({ k: 'arrive', id: c.id });
  // the next one: faster each wave, kinder at the low levels, with a breather between waves
  const lastOfWave = waveOf(idx + 1) !== wave && idx + 1 < CORRERIA_TOTAL;
  const base = WAVE_GAP_MS[wave]! * lv.gapMul * (0.85 + sh.rng() * 0.3);
  sh.nextSpawnAt = sh.t + Math.round(base + (lastOfWave ? 5000 : 0));
}

function leave(sh: Shift, c: Customer, why: 'tempo' | 'errou', ev: CEvent[]): void {
  if (c.state === 'front') {
    sh.tray = [];
    sh.pack = null;
    sh.mods = [];
  }
  sh.customers = sh.customers.filter((x) => x !== c);
  sh.stats.left++;
  sh.stats.combo = 0;
  sh.nextFrontAt = Math.max(sh.nextFrontAt, sh.t + STEP_UP_MS);
  const line = why === 'tempo' ? pick(sh.rng, LATE_LINES)(c.who.fem) : pick(sh.rng, GAVE_UP_LINES);
  ev.push({ k: 'leave', id: c.id, why, line, emote: '😤' });
}

function promote(sh: Shift, ev: CEvent[]): void {
  if (front(sh) || sh.t < sh.nextFrontAt) return;
  const c = sh.customers.filter((x) => x.state === 'queue' || (x.state === 'walk' && sh.t >= x.readyAt)).sort((a, b) => a.arrivedAt - b.arrivedAt)[0];
  if (!c || sh.t < c.readyAt) return;
  c.state = 'front';
  c.frontAt = sh.t;
  if (c.follow) c.followAt = sh.t + Math.round((7_000 + sh.rng() * 4_000) * (sh.ctx.level >= 2 ? 0.85 : 1));
  ev.push({ k: 'front', id: c.id });
}

/** Let `dtMs` of shift time pass (the server calls this with the real elapsed time, in slices of at most a few seconds). */
export function shiftAdvance(sh: Shift, dtMs: number): CEvent[] {
  const ev: CEvent[] = [];
  if (sh.over) return ev;
  const end = sh.t + Math.max(0, dtMs);
  // step in 100 ms slices so the order of events is stable however the server slices the time
  while (sh.t < end && !sh.over) {
    const step = Math.min(100, end - sh.t);
    sh.t += step;
    tickOnce(sh, step, ev);
  }
  return ev;
}

function tickOnce(sh: Shift, dt: number, ev: CEvent[]): void {
  // arrivals
  if (sh.spawned < CORRERIA_TOTAL && sh.t >= sh.nextSpawnAt && sh.customers.length < MAX_PRESENT) spawn(sh, ev);
  // walking customers reach the counter
  for (const c of sh.customers) if (c.state === 'walk' && sh.t >= c.readyAt) c.state = 'queue';
  promote(sh, ev);
  // patience
  for (const c of [...sh.customers]) {
    if (c.state === 'queue') c.patience -= dt * QUEUE_DRAIN;
    else if (c.state === 'front') c.patience -= dt;
    if ((c.state === 'queue' || c.state === 'front') && c.patience <= 0) {
      c.patience = 0;
      leave(sh, c, 'tempo', ev);
    }
  }
  // the front customer's follow-up
  const f = front(sh);
  if (f && f.state === 'front' && f.follow && !f.followFired && f.followAt !== null && sh.t >= f.followAt) {
    f.followFired = true;
    f.order = { ...f.order, lines: f.follow.lines.map((l) => ({ ...l })), mods: [...f.follow.mods] };
    ev.push({ k: 'follow', id: f.id, pt: f.follow.pt, en: f.follow.en });
  }
  // "Quanto é?" ran out
  if (f && f.state === 'asking' && f.ask && sh.t >= f.ask.deadline) resolveAsk(sh, f, null, ev);
  // the chapa burns
  sh.chapa.forEach((s, i) => {
    if (s && !s.burnt && sh.t - s.at > CHAPA.burnMs) {
      s.burnt = true;
      ev.push({ k: 'chapa_burnt', slot: i });
    }
  });
  // a pour held far too long spills by itself
  if (sh.pour && sh.t - sh.pour.at > pourMsFor(sh.ctx.unlocked) * POUR.abortFactor) {
    ev.push({ k: 'pour_bad', why: 'spill', fill: (sh.t - sh.pour.at) / pourMsFor(sh.ctx.unlocked) });
    sh.pour = null;
  }
  if (sh.spawned >= CORRERIA_TOTAL && !sh.customers.length) {
    sh.over = true;
    ev.push({ k: 'over' });
  }
}

const no = (why: string, pt: string, en: string): CEvent[] => [{ k: 'no', why, line: { pt, en } }];

const effMods = (sh: Shift): string[] => [...sh.mods, ...(sh.pack === 'bag' ? ['pra_viagem'] : sh.pack === 'plate' ? ['pra_comer_aqui'] : [])];
const trayCounts = (sh: Shift): Tray => {
  const out: Tray = {};
  for (const id of sh.tray) out[id] = (out[id] ?? 0) + 1;
  return out;
};

function cheerFor(sh: Shift, combo: number, ev: CEvent[]): void {
  if (combo === 3 || combo === 5 || combo === 8 || combo === 12) ev.push({ k: 'cheer', line: pick(sh.rng, CHEERS) });
}

function resolveAsk(sh: Shift, c: Customer, answer: unknown, ev: CEvent[]): void {
  const ask = c.ask!;
  const n = ask.type === 'choice' ? (typeof answer === 'number' ? answer : parseNumberAnswer(answer)) : parseNumberAnswer(answer);
  const ok = n === ask.total;
  sh.stats.askTotal++;
  let points = 0;
  if (ok) {
    sh.stats.askRight++;
    points = 3 + (c.regular ? 1 : 0);
    sh.stats.tips += 1;
    points += 1;
    sh.stats.points += points;
  }
  const change = ask.pay - ask.total;
  const line: Bilingual = ok
    ? { pt: `Isso! ${cap1(moneyPt(ask.total * 100))}. Toma, ${numberPt(ask.pay)} reais.`, en: `Right! ${moneyEn(ask.total * 100)}. Here, ${numberEn(ask.pay)} reais.` }
    : { pt: `Hm, são ${moneyPt(ask.total * 100)}. Toma, ${numberPt(ask.pay)} reais.`, en: `Hm, it’s ${moneyEn(ask.total * 100)}. Here, ${numberEn(ask.pay)} reais.` };
  sh.customers = sh.customers.filter((x) => x !== c);
  sh.nextFrontAt = Math.max(sh.nextFrontAt, sh.t + STEP_UP_MS);
  ev.push({ k: 'ask_result', id: c.id, ok, total: ask.total, line, pay: ask.pay, change, points });
}
const cap1 = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function doServe(sh: Shift, ev: CEvent[]): void {
  const c = front(sh);
  if (!c || c.state !== 'front') return;
  if (!sh.tray.length) return void ev.push(...no('empty', 'A bandeja está vazia.', 'The tray is empty.'));
  const counts = trayCounts(sh);
  const check = checkTray(c.order, counts, effMods(sh));
  if (!check.ok) {
    c.mistakes++;
    c.patience = Math.max(0, c.patience - c.patienceMax * MISTAKE_COST);
    if (c.mistakes >= 2) {
      // they hand the tray back once; the second miss and they walk out
      sh.tray = [];
      sh.pack = null;
      sh.mods = [];
      return leave(sh, c, 'errou', ev);
    }
    ev.push({ k: 'correct', id: c.id, line: correctionFor(c.order, counts, check) });
    return;
  }
  // served
  const frac = c.patienceMax ? c.patience / c.patienceMax : 0;
  const perfect = c.mistakes === 0;
  let points: number;
  let tip = 0;
  let line: Bilingual;
  let emote: string;
  if (perfect) {
    sh.stats.perfect++;
    sh.stats.combo++;
    sh.stats.bestCombo = Math.max(sh.stats.bestCombo, sh.stats.combo);
    const speed = Math.round(5 * frac);
    const comboPts = sh.stats.combo >= 2 ? Math.min(5, sh.stats.combo - 1) : 0;
    tip = 1 + (frac >= 0.5 ? 1 : 0) + (sh.stats.combo >= 3 ? 1 : 0);
    if (c.regular) tip *= 2;
    points = 10 + speed + comboPts + tip;
    if (c.special) points = Math.round(points * 1.5);
    emote = c.regular || sh.stats.combo >= 3 ? '❤️' : '😋';
    line = c.regular ? (c.who.npc && REGULAR_VOICE[c.who.npc] ? pick(sh.rng, REGULAR_VOICE[c.who.npc]!.thanks) : pick(sh.rng, REGULAR_LINES)(c.who.fem)) : frac >= 0.6 ? pick(sh.rng, FAST_LINES)(c.who.fem) : pick(sh.rng, PERFECT_LINES)(c.who.fem);
  } else {
    sh.stats.second++;
    sh.stats.combo = 0;
    points = 6;
    emote = '🙂';
    line = pick(sh.rng, SECOND_LINES)(c.who.fem);
  }
  sh.stats.served++;
  sh.stats.points += points;
  sh.stats.tips += tip;
  if (c.regular && perfect) sh.stats.regulars.push(c.who.key);
  for (const l of c.order.lines) {
    const card = mgItemById(l.itemId)?.card.id;
    if (card && !sh.stats.words.includes(card)) sh.stats.words.push(card);
  }
  sh.tray = [];
  sh.pack = null;
  sh.mods = [];
  ev.push({ k: 'serve', id: c.id, outcome: perfect ? 'perfeito' : 'segunda', line, emote, points, tip, combo: sh.stats.combo, speed: frac });
  if (perfect) cheerFor(sh, sh.stats.combo, ev);
  // maybe "Quanto é?"
  const lv = levelOf(sh);
  if (sh.rng() < lv.ask[c.wave]!) {
    const total = orderTotal(c.order.lines);
    c.state = 'asking';
    c.ask = { total, options: askOptions(sh.rng, total), type: lv.askType, deadline: sh.t + ASK_MS, pay: payNote(total) };
    ev.push({ k: 'ask', id: c.id, line: ASK_LINE });
    return;
  }
  sh.customers = sh.customers.filter((x) => x !== c);
  sh.nextFrontAt = Math.max(sh.nextFrontAt, sh.t + STEP_UP_MS);
}

/** Apply one player action (the caller has already advanced the clock). Returns the events it caused. */
export function shiftAct(sh: Shift, a: CAct): CEvent[] {
  const ev: CEvent[] = [];
  if (sh.over) return ev;
  const items = itemsFor(sh.ctx.unlocked);
  switch (a.a) {
    case 'grab': {
      if (!items.some((i) => i.id === a.item)) return no('locked', 'Esse item ainda está trancado.', 'That item is still locked.');
      if (stationOf(a.item)) return no('station', stationOf(a.item) === 'chapa' ? 'Esse vai na chapa.' : 'Esse sai da cafeteira.', stationOf(a.item) === 'chapa' ? 'That one goes on the grill.' : 'That one comes from the coffee machine.');
      if (sh.tray.length >= MG_MAX_TRAY) return no('full', 'A bandeja está cheia.', 'The tray is full.');
      sh.tray.push(a.item);
      ev.push({ k: 'grab', item: a.item });
      return ev;
    }
    case 'chapa_put': {
      if (!CHAPA_ITEMS.includes(a.item) || !items.some((i) => i.id === a.item)) return no('chapa_item', 'Isso não vai na chapa.', 'That doesn’t go on the grill.');
      if (a.slot >= sh.chapa.length) return no('slot', 'Esse lugar da chapa ainda está trancado.', 'That grill spot is still locked.');
      if (sh.chapa[a.slot]) return no('busy', 'A chapa já está ocupada.', 'The grill spot is busy.');
      sh.chapa[a.slot] = { itemId: a.item, at: sh.t, burnt: false };
      ev.push({ k: 'chapa_put', slot: a.slot, item: a.item });
      return ev;
    }
    case 'chapa_take': {
      const s = sh.chapa[a.slot];
      if (!s) return ev;
      const age = sh.t - s.at;
      const phase = chapaPhase(age);
      if (phase === 'raw') {
        ev.push({ k: 'chapa_raw', slot: a.slot });
        return ev;
      }
      sh.chapa[a.slot] = null;
      if (phase === 'burnt') {
        ev.push({ k: 'chapa_trash', slot: a.slot });
        return ev;
      }
      if (sh.tray.length >= MG_MAX_TRAY) {
        sh.chapa[a.slot] = s;
        return no('full', 'A bandeja está cheia.', 'The tray is full.');
      }
      sh.tray.push(s.itemId);
      ev.push({ k: 'chapa_ok', slot: a.slot, item: s.itemId });
      return ev;
    }
    case 'pour_start': {
      if (!CAFE_ITEMS.includes(a.item)) return no('cafe_item', 'Esse não sai da cafeteira.', 'That doesn’t come from the coffee machine.');
      if (sh.pour) return ev;
      if (sh.tray.length >= MG_MAX_TRAY) return no('full', 'A bandeja está cheia.', 'The tray is full.');
      sh.pour = { itemId: a.item, at: sh.t };
      ev.push({ k: 'pour_start', item: a.item });
      return ev;
    }
    case 'pour_end': {
      const p = sh.pour;
      if (!p) return ev;
      sh.pour = null;
      const held = sh.t - p.at;
      const { fill, verdict } = pourVerdict(held, pourMsFor(sh.ctx.unlocked));
      if (held < POUR.minHoldMs || verdict === 'short') ev.push({ k: 'pour_bad', why: 'short', fill });
      else if (verdict === 'spill') ev.push({ k: 'pour_bad', why: 'spill', fill });
      else {
        sh.tray.push(p.itemId);
        ev.push({ k: 'pour_ok', item: p.itemId, fill });
      }
      return ev;
    }
    case 'pack':
      sh.pack = a.kind;
      ev.push({ k: 'pack', kind: a.kind });
      return ev;
    case 'mod': {
      const on = !sh.mods.includes(a.id);
      sh.mods = on ? [...sh.mods, a.id] : sh.mods.filter((m) => m !== a.id);
      ev.push({ k: 'mod', id: a.id, on });
      return ev;
    }
    case 'clear':
      sh.tray = [];
      sh.pack = null;
      sh.mods = [];
      ev.push({ k: 'clear' });
      return ev;
    case 'serve':
      doServe(sh, ev);
      break;
    case 'replay': {
      const c = front(sh);
      if (!c || c.state !== 'front' || c.mode !== 'listening') return ev;
      c.patience = Math.max(0, c.patience - c.patienceMax * levelOf(sh).replayCost);
      c.replays++;
      ev.push({ k: 'replay', id: c.id });
      return ev;
    }
    case 'answer': {
      const c = front(sh);
      if (!c || c.state !== 'asking' || !c.ask) return ev;
      resolveAsk(sh, c, a.value, ev);
      break;
    }
  }
  if (!sh.over && sh.spawned >= CORRERIA_TOTAL && !sh.customers.length) {
    sh.over = true;
    ev.push({ k: 'over' });
  }
  return ev;
}

// ---------------------------------------------------------------- the snapshot (what the client draws)

export interface CustomerView {
  id: number;
  who: Who;
  state: CState;
  mode: OrderMode;
  regular: boolean;
  special: boolean;
  greet: Bilingual | null;
  /** What they said (a listening order carries it for the voice; the screen hides it). */
  pt: string;
  en: string;
  follow: { pt: string; en: string } | null;
  patience: number;
  patienceMax: number;
  /** Patience lost per ms right now (0, the queue rate or 1): the client runs the meter between snapshots. */
  rate: number;
  mistakes: number;
  replays: number;
  ask: { type: 'choice' | 'type'; options: number[]; ms: number; items: { itemId: string; qty: number; price: number }[] } | null;
  /** Test hook only. */
  debug?: { lines: MgOrderLine[]; mods: string[] };
}

export interface CorreriaSnap {
  v: 1;
  t: number;
  level: number;
  wave: number;
  waves: number;
  spawned: number;
  total: number;
  baker: 'carlos' | 'graca';
  saturday: boolean;
  customers: CustomerView[];
  tray: string[];
  pack: 'bag' | 'plate' | null;
  mods: string[];
  chapa: ({ item: string; age: number } | null)[];
  pour: { item: string; age: number } | null;
  pourMs: number;
  stats: { served: number; perfect: number; left: number; points: number; tips: number; combo: number; bestCombo: number };
  unlocked: string[];
  over: boolean;
}

export function shiftSnapshot(sh: Shift): CorreriaSnap {
  const customers: CustomerView[] = [...sh.customers]
    .sort((a, b) => a.arrivedAt - b.arrivedAt)
    .map((c) => ({
      id: c.id,
      who: c.who,
      state: c.state,
      mode: c.mode,
      regular: c.regular,
      special: c.special,
      greet: c.greet,
      pt: c.said.pt,
      en: c.said.en,
      follow: c.followFired && c.follow ? { pt: c.follow.pt, en: c.follow.en } : null,
      patience: Math.round(c.patience),
      patienceMax: c.patienceMax,
      rate: c.state === 'front' ? 1 : c.state === 'queue' ? QUEUE_DRAIN : 0,
      mistakes: c.mistakes,
      replays: c.replays,
      ask: c.ask ? { type: c.ask.type, options: c.ask.options, ms: Math.max(0, c.ask.deadline - sh.t), items: c.order.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, price: COUNTER_PRICES[l.itemId] ?? 0 })) } : null,
      ...(sh.debug ? { debug: { lines: c.order.lines.map((l) => ({ ...l })), mods: [...c.order.mods] } } : {}),
    }));
  return {
    v: 1,
    t: sh.t,
    level: sh.ctx.level,
    wave: sh.wave,
    waves: CORRERIA_WAVES,
    spawned: sh.spawned,
    total: CORRERIA_TOTAL,
    baker: sh.ctx.baker,
    saturday: sh.ctx.saturday,
    customers,
    tray: [...sh.tray],
    pack: sh.pack,
    mods: [...sh.mods],
    chapa: sh.chapa.map((s) => (s ? { item: s.itemId, age: sh.t - s.at } : null)),
    pour: sh.pour ? { item: sh.pour.itemId, age: sh.t - sh.pour.at } : null,
    pourMs: pourMsFor(sh.ctx.unlocked),
    stats: { served: sh.stats.served, perfect: sh.stats.perfect, left: sh.stats.left, points: sh.stats.points, tips: sh.stats.tips, combo: sh.stats.combo, bestCombo: sh.stats.bestCombo },
    unlocked: [...sh.ctx.unlocked],
    over: sh.over,
  };
}

// ---------------------------------------------------------------- scoring: stars and RV

/** The most points a flawless fast shift can reach (base 10, speed 5, tip 3 and a combo ramp), used for stars and RV. */
export const MAX_SHIFT_POINTS = CORRERIA_TOTAL * 18 + 60;
export function starsFor(points: number): 0 | 1 | 2 | 3 {
  const r = points / MAX_SHIFT_POINTS;
  return r >= 0.7 ? 3 : r >= 0.5 ? 2 : r >= 0.28 ? 1 : 0;
}
/** RV for a shift: ECONOMY.minigameMin..Max by points (a perfect fast shift reaches the cap), nothing when nobody was served. */
export function correriaPayout(points: number, served: number): number {
  if (served <= 0) return 0;
  const r = Math.max(0, Math.min(1, points / (MAX_SHIFT_POINTS * 0.85)));
  return ECONOMY.minigameMin + Math.round((ECONOMY.minigameMax - ECONOMY.minigameMin) * r);
}
/** Old saves and hand-edited ones come back coherent. Never throws. */
export function normalizeCorreria(raw: unknown): CorreriaProgress {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, max: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.floor(Number(v)))) : 0);
  const out: CorreriaProgress = { stars: n(r.stars, 9999), shifts: n(r.shifts, 99999), best: n(r.best, 99999) };
  if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
    out.date = r.date;
    out.paid = n(r.paid, 99);
  }
  return out;
}

/** Shifts per real day that pay RV; further shifts still earn stars and unlocks. */
export const DAILY_PAID_SHIFTS = 3;

export interface ShiftSummary {
  served: number;
  perfect: number;
  second: number;
  left: number;
  points: number;
  tips: number;
  bestCombo: number;
  stars: 0 | 1 | 2 | 3;
  coins: number;
  askRight: number;
  askTotal: number;
  words: string[];
  regulars: string[];
}
export function summarizeShift(sh: Shift): ShiftSummary {
  const s = sh.stats;
  return {
    served: s.served,
    perfect: s.perfect,
    second: s.second,
    left: s.left,
    points: s.points,
    tips: s.tips,
    bestCombo: s.bestCombo,
    stars: starsFor(s.points),
    coins: correriaPayout(s.points, s.served),
    askRight: s.askRight,
    askTotal: s.askTotal,
    words: [...s.words],
    regulars: [...s.regulars],
  };
}

/** The lines and mods a customer currently wants (server and test bots read this; clients never get it outside the debug hook). */
export function wantOf(sh: Shift): { lines: MgOrderLine[]; mods: string[] } | null {
  const c = front(sh);
  return c ? { lines: c.order.lines.map((l) => ({ ...l })), mods: [...c.order.mods] } : null;
}
export const frontOf = front;
