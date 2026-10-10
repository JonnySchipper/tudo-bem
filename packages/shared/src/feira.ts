/**
 * The feira livre (HOWTO Phase 9): prices, vendors, money and the "Quanto custa?" rules. Pure data and functions; the server
 * (`apps/server/src/feira.ts`) is authoritative for price and pay, the client (`ui/feira.ts`) only presents what this module computes.
 *
 * Money is integer centavos everywhere (R$ 3,50 = 350). The coin and note tray has R$ 0,50 / 1 / 2 / 5 / 10 / 20, so every price is a
 * multiple of 50 centavos and can always be paid exactly. Every PT string here is new content: `needs_br: true`.
 */
import { acceptAnswer, normalizeAnswer } from './accept.js';
import { numberEn, numberPt } from './numbers.js';
import type { Bilingual } from './types.js';
import type { NpcId } from './rooms.js';

// ---------------------------------------------------------------- hours

/** The feira is open 06:00-13:00 game time (`from` inclusive, `to` exclusive). */
export const FEIRA_OPEN_MIN = 6 * 60;
export const FEIRA_CLOSE_MIN = 13 * 60;
export const feiraOpen = (minute: number): boolean => {
  const m = ((minute % 1440) + 1440) % 1440;
  return m >= FEIRA_OPEN_MIN && m < FEIRA_CLOSE_MIN;
};

// ---------------------------------------------------------------- money

/** The tray, in centavos: R$ 0,50 / 1 / 2 / 5 / 10 / 20. */
export const COINS: readonly number[] = [50, 100, 200, 500, 1000, 2000];
/** Most pieces one payment can hold. */
export const MAX_PAID_PIECES = 40;

/** "R$ 3,50", "R$ 12", "R$ 0,50". */
export function moneyLabel(cents: number): string {
  const c = Math.max(0, Math.round(cents));
  const r = Math.floor(c / 100);
  const cs = c % 100;
  return cs === 0 ? `R$ ${r}` : `R$ ${r},${String(cs).padStart(2, '0')}`;
}

/** The price as it is said aloud in Brazilian Portuguese: 350 -> "três reais e cinquenta centavos", 100 -> "um real", 50 -> "cinquenta centavos". */
export function moneyPt(cents: number): string {
  const c = Math.max(0, Math.round(cents));
  const r = Math.floor(c / 100);
  const cs = c % 100;
  const reais = r === 0 ? '' : r === 1 ? 'um real' : `${numberPt(r)} reais`;
  const cent = cs === 0 ? '' : cs === 1 ? 'um centavo' : `${numberPt(cs)} centavos`;
  if (reais && cent) return `${reais} e ${cent}`;
  return reais || cent || 'zero reais';
}

export function moneyEn(cents: number): string {
  const c = Math.max(0, Math.round(cents));
  const r = Math.floor(c / 100);
  const cs = c % 100;
  const reais = r === 0 ? '' : `${numberEn(r)} ${r === 1 ? 'real' : 'reais'}`;
  const cent = cs === 0 ? '' : `${numberEn(cs)} ${cs === 1 ? 'centavo' : 'centavos'}`;
  if (reais && cent) return `${reais} and ${cent}`;
  return reais || cent || 'zero reais';
}

export const sumCoins = (paid: readonly number[]): number => paid.reduce((n, c) => n + c, 0);

/** Validate a payment from the wire: a short list of tray denominations. Null when anything is off. */
export function parsePaid(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PAID_PIECES) return null;
  const out: number[] = [];
  for (const v of raw) {
    if (typeof v !== 'number' || !COINS.includes(v)) return null;
    out.push(v);
  }
  return out;
}

/** The change for `cents` in the fewest tray pieces, largest first (R$ 0,50 is the smallest piece, prices are multiples of it). */
export function makeChange(cents: number): number[] {
  let left = Math.max(0, Math.round(cents));
  const out: number[] = [];
  for (const c of [...COINS].reverse()) {
    while (left >= c) {
      out.push(c);
      left -= c;
    }
  }
  return out;
}

export type PaymentVerdict = { kind: 'exact' } | { kind: 'change'; change: number } | { kind: 'short'; missing: number };

/** Judge what was put on the counter against the price. */
export function judgePayment(price: number, paid: readonly number[]): PaymentVerdict {
  const total = sumCoins(paid);
  if (total === price) return { kind: 'exact' };
  return total > price ? { kind: 'change', change: total - price } : { kind: 'short', missing: price - total };
}

// ---------------------------------------------------------------- goods

export interface FeiraGood {
  itemId: string;
  /** Centavos for one. */
  unit: number;
  /** "3 por R$ 5": every full `qty` costs `cents` instead of qty x unit. */
  bundle?: { qty: number; cents: number };
  /** The quantities the vendor offers. */
  qtys: number[];
  gender: 'm' | 'f';
  /** What is asked about: "a banana", "o pastel". */
  art: 'a' | 'o';
  pt: { one: string; many: string };
  en: { one: string; many: string };
}

// needs_br: true (names and prices)
export const GOODS: readonly FeiraGood[] = [
  { itemId: 'banana', unit: 200, bundle: { qty: 3, cents: 500 }, qtys: [1, 3, 6], gender: 'f', art: 'a', pt: { one: 'banana', many: 'bananas' }, en: { one: 'banana', many: 'bananas' } },
  { itemId: 'laranja', unit: 100, qtys: [1, 2, 4], gender: 'f', art: 'a', pt: { one: 'laranja', many: 'laranjas' }, en: { one: 'orange', many: 'oranges' } },
  { itemId: 'maca', unit: 150, qtys: [1, 2, 3], gender: 'f', art: 'a', pt: { one: 'maçã', many: 'maçãs' }, en: { one: 'apple', many: 'apples' } },
  { itemId: 'alface', unit: 350, qtys: [1, 2], gender: 'f', art: 'a', pt: { one: 'alface', many: 'alfaces' }, en: { one: 'lettuce', many: 'lettuces' } },
  { itemId: 'tomate', unit: 250, qtys: [1, 2, 3], gender: 'm', art: 'o', pt: { one: 'tomate', many: 'tomates' }, en: { one: 'tomato', many: 'tomatoes' } },
  { itemId: 'pastel', unit: 600, qtys: [1, 2], gender: 'm', art: 'o', pt: { one: 'pastel', many: 'pastéis' }, en: { one: 'pastel', many: 'pastéis' } },
  { itemId: 'caldo_de_cana', unit: 500, qtys: [1, 2], gender: 'm', art: 'o', pt: { one: 'caldo de cana', many: 'caldos de cana' }, en: { one: 'sugarcane juice', many: 'sugarcane juices' } },
  { itemId: 'flores', unit: 1200, qtys: [1, 2], gender: 'm', art: 'o', pt: { one: 'buquê de flores', many: 'buquês de flores' }, en: { one: 'bunch of flowers', many: 'bunches of flowers' } },
];
export const goodById = (id: unknown): FeiraGood | undefined => (typeof id === 'string' ? GOODS.find((g) => g.itemId === id) : undefined);

/** Centavos for `qty` of a good, or null for an unknown item or a quantity the vendor does not offer. */
export function priceFor(itemId: unknown, qty: unknown): number | null {
  const g = goodById(itemId);
  if (!g || typeof qty !== 'number' || !g.qtys.includes(qty)) return null;
  return totalFor(g, qty);
}

function totalFor(g: FeiraGood, qty: number): number {
  if (!g.bundle) return qty * g.unit;
  return Math.floor(qty / g.bundle.qty) * g.bundle.cents + (qty % g.bundle.qty) * g.unit;
}

/** "uma banana", "três bananas", "um buquê de flores". */
export function qtyPt(g: FeiraGood, qty: number): string {
  if (qty === 1) return `${g.gender === 'f' ? 'uma' : 'um'} ${g.pt.one}`;
  return `${numberPt(qty, g.gender)} ${g.pt.many}`;
}
export function qtyEn(g: FeiraGood, qty: number): string {
  return qty === 1 ? `one ${g.en.one}` : `${numberEn(qty)} ${g.en.many}`;
}

// ---------------------------------------------------------------- vendors

export type VendorId = 'tia_lu' | 'ze' | 'chico' | 'rosa' | 'banca';
export const VENDOR_IDS: readonly VendorId[] = ['tia_lu', 'ze', 'chico', 'rosa', 'banca'];
export const isVendorId = (v: unknown): v is VendorId => typeof v === 'string' && (VENDOR_IDS as readonly string[]).includes(v);

export interface VendorDef {
  id: VendorId;
  /** The NPC who sells. The Hortifrúti corner at the banca is Tia Lu's box: her goods, served at every hour (D12). */
  npc: NpcId;
  name: string;
  /** The vendor is a woman (obrigada). */
  fem: boolean;
  goods: string[];
  greet: Bilingual;
  /** Said when the stall is closed (or the vendor is away). */
  closed: Bilingual;
  /** The call that floats over the stall. */
  calls: Bilingual[];
}

// needs_br: true (every line)
export const VENDORS: Record<VendorId, VendorDef> = {
  tia_lu: {
    id: 'tia_lu',
    npc: 'tia_lu',
    name: 'Tia Lu',
    fem: true,
    goods: ['banana', 'laranja', 'maca', 'flores'],
    greet: { pt: 'Bom dia, freguês! Tá fresquinha a fruta hoje! O que vai ser?', en: 'Good morning, customer! The fruit is fresh today! What’ll it be?' },
    closed: { pt: 'A feira já fechou. Volte amanhã às seis da manhã!', en: 'The market has closed. Come back tomorrow at six in the morning!' },
    calls: [
      { pt: 'Olha a banana! Três por cinco!', en: 'Get your bananas! Three for five!' },
      { pt: 'Laranja doce, freguesa!', en: 'Sweet oranges, ma’am!' },
      { pt: 'Maçã fresquinha, leva uma!', en: 'Fresh apples, take one!' },
    ],
  },
  ze: {
    id: 'ze',
    npc: 'ze',
    name: 'Seu Zé',
    fem: false,
    goods: ['alface', 'tomate'],
    greet: { pt: 'Bom dia! Alface e tomate fresquinhos. O que vai levar?', en: 'Good morning! Nice fresh lettuce and tomatoes. What will you take?' },
    closed: { pt: 'Já fechei a banca. Amanhã tem mais, às seis!', en: 'I’ve closed my stall. There’s more tomorrow, at six!' },
    calls: [
      { pt: 'Olha o tomate! Bem vermelhinho!', en: 'Get your tomatoes! Nice and red!' },
      { pt: 'Alface fresca, freguesa!', en: 'Fresh lettuce, ma’am!' },
    ],
  },
  chico: {
    id: 'chico',
    npc: 'chico',
    name: 'Seu Chico',
    fem: false,
    goods: ['pastel', 'caldo_de_cana'],
    greet: { pt: 'Bom dia! Pastel quentinho e caldo de cana gelado! O que vai ser?', en: 'Good morning! Hot pastel and cold sugarcane juice! What’ll it be?' },
    closed: { pt: 'Acabou o pastel por hoje. Volte amanhã às seis!', en: 'The pastel is gone for today. Come back tomorrow at six!' },
    calls: [
      { pt: 'Pastel quentinho!', en: 'Nice hot pastel!' },
      { pt: 'Caldo de cana geladinho!', en: 'Ice-cold sugarcane juice!' },
    ],
  },
  rosa: {
    id: 'rosa',
    npc: 'rosa',
    name: 'Dona Rosa',
    fem: true,
    goods: ['flores'],
    greet: { pt: 'Bom dia! Flores bonitas pra você! Quer levar um buquê?', en: 'Good morning! Pretty flowers for you! Want to take a bunch?' },
    closed: { pt: 'As flores já descansaram por hoje. Volte amanhã às seis!', en: 'The flowers are resting for today. Come back tomorrow at six!' },
    calls: [
      { pt: 'Flores, freguesa!', en: 'Flowers, ma’am!' },
      { pt: 'Flor bonita pra casa, leva!', en: 'Pretty flowers for your home, take some!' },
    ],
  },
  banca: {
    id: 'banca',
    npc: 'tia_lu',
    name: 'Hortifrúti da banca',
    fem: true,
    goods: ['banana', 'laranja', 'maca', 'alface', 'tomate', 'flores'],
    greet: { pt: 'Hortifrúti da banca: fruta, verdura e flores o dia todo. O que vai ser?', en: 'The bakery-corner greengrocer: fruit, vegetables and flowers all day. What’ll it be?' },
    closed: { pt: 'A feira volta amanhã às 6h.', en: 'The market is back tomorrow at 6 am.' },
    calls: [],
  },
};

/** The stall sign hung outside the feira's hours. */
export const FEIRA_CLOSED_NOTE: Bilingual = { pt: 'A feira volta amanhã às 6h. O hortifrúti da banca está aberto!', en: 'The market is back tomorrow at 6 am. The greengrocer at the newsstand is open!' };

/** The vendor NPC that stands at each stall (the banca corner has none). */
export const VENDOR_OF_NPC: Partial<Record<NpcId, VendorId>> = { tia_lu: 'tia_lu', ze: 'ze', chico: 'chico', rosa: 'rosa' };

// ---------------------------------------------------------------- off duty (issue #170)

/** A vendor who stands at a stall (the banca corner has no one of its own). */
export type StallVendorId = Exclude<VendorId, 'banca'>;
export const STALL_VENDOR_IDS: readonly StallVendorId[] = ['tia_lu', 'ze', 'chico', 'rosa'];
export const isStallVendor = (npc: unknown): npc is StallVendorId => typeof npc === 'string' && (STALL_VENDOR_IDS as readonly string[]).includes(npc);

export interface OffDutyTalk {
  /** Small talk away from the stall: the day, resting, tomorrow's feira, home. Never an offer, never "my stall here". */
  lines: Bilingual[];
  /** The answer to "Can I buy something?": tomorrow's hours (06:00-13:00, `FEIRA_OPEN_MIN` / `FEIRA_CLOSE_MIN`). */
  buy: Bilingual;
}

// needs_br: true (every line)
export const OFF_DUTY: Record<StallVendorId, OffDutyTalk> = {
  tia_lu: {
    lines: [
      { pt: 'Ai, que bom descansar um pouquinho!', en: 'Oh, it’s so nice to rest a little!' },
      { pt: 'Acordei às quatro hoje. Tô cansada!', en: 'I got up at four today. I’m tired!' },
      { pt: 'Meus netos vêm jantar lá em casa hoje.', en: 'My grandkids are coming over for dinner tonight.' },
      { pt: 'Amanhã cedo tô na feira!', en: 'I’ll be at the market early tomorrow!' },
    ],
    buy: { pt: 'Agora não, a feira já fechou! Amanhã tem, das seis à uma da tarde.', en: 'Not now, the market has closed! It’s on tomorrow, from six to one in the afternoon.' },
  },
  ze: {
    lines: [
      { pt: 'Opa! Hoje a feira foi boa.', en: 'Hey! The market went well today.' },
      { pt: 'Agora é hora de descansar as pernas.', en: 'Now it’s time to rest my legs.' },
      { pt: 'Mais tarde tem jogo de futebol na TV.', en: 'There’s a football game on TV later.' },
      { pt: 'Amanhã cedo tô na feira!', en: 'I’ll be at the market early tomorrow!' },
    ],
    buy: { pt: 'Hoje não dá mais. Amanhã tem feira, das seis à uma da tarde!', en: 'Not today anymore. There’s a market tomorrow, from six to one in the afternoon!' },
  },
  chico: {
    lines: [
      { pt: 'Hoje vendi tudo! Que dia!', en: 'I sold everything today! What a day!' },
      { pt: 'Tô com cheiro de pastel até agora!', en: 'I still smell like pastel!' },
      { pt: 'Agora eu quero um café e uma soneca.', en: 'Now I want a coffee and a nap.' },
      { pt: 'Amanhã cedo tô na feira!', en: 'I’ll be at the market early tomorrow!' },
    ],
    buy: { pt: 'Pastel só amanhã! A feira abre às seis e vai até a uma.', en: 'Pastel only tomorrow! The market opens at six and goes until one.' },
  },
  rosa: {
    lines: [
      { pt: 'Que bom te ver fora da feira!', en: 'How nice to see you away from the market!' },
      { pt: 'Agora vou cuidar das minhas plantas.', en: 'Now I’m going to look after my plants.' },
      { pt: 'Minha neta adora flores, igual a mim.', en: 'My granddaughter loves flowers, just like me.' },
      { pt: 'Amanhã cedo tô na feira!', en: 'I’ll be at the market early tomorrow!' },
    ],
    buy: { pt: 'As flores ficam pra amanhã. A feira é das seis à uma da tarde!', en: 'The flowers will have to wait for tomorrow. The market is from six to one in the afternoon!' },
  },
};

/** What the player asks an off-duty vendor, and how they say goodbye. */
export const OFF_DUTY_ASK: Bilingual = { pt: 'Dá pra comprar alguma coisa?', en: 'Can I buy something?' };
export const OFF_DUTY_BYE: Bilingual = { pt: 'Até amanhã!', en: 'See you tomorrow!' };

export type VendorTalkMode = 'stall' | 'off_duty';

/**
 * How a feira vendor talks: at the stall (greeting, prices, the tray) only while working it during the feira's hours; anywhere else (a praça bench,
 * walking home, a stall after 13:00) off duty. `room` / `activity` are where the vendor is and what they are doing (`ScheduleSlot`).
 */
export function vendorTalkMode(where: { room?: string | null; activity?: string | null }, minute: number): VendorTalkMode {
  return where.room === 'feira' && where.activity === 'trabalhando' && feiraOpen(minute) ? 'stall' : 'off_duty';
}

/** The `n`th off-duty line of a vendor (wraps around), for the talk box and the idle bubbles. */
export function offDutyLine(npc: StallVendorId, n: number): Bilingual {
  const lines = OFF_DUTY[npc].lines;
  return lines[((Math.floor(n) % lines.length) + lines.length) % lines.length]!;
}

/**
 * The NPC a purchase counts as `ordered` from (the recados' `pedir` steps name the stall's owner): whoever sells the item at the feira,
 * so a purchase at the Hortifrúti corner still finishes a recado for Tia Lu's bananas or Seu Zé's tomatoes (D12).
 */
export function ownerOf(itemId: string): NpcId {
  for (const id of ['tia_lu', 'ze', 'chico', 'rosa'] as const) if (VENDORS[id].goods.includes(itemId)) return VENDORS[id].npc;
  return 'tia_lu';
}

// ---------------------------------------------------------------- the "Quanto custa?" lines

export interface PriceOption {
  qty: number;
  cents: number;
}

export const priceOptions = (itemId: string): PriceOption[] => {
  const g = goodById(itemId);
  return g ? g.qtys.map((qty) => ({ qty, cents: totalFor(g, qty) })) : [];
};

/** What the vendor says when asked the price of one: "A banana custa dois reais. Três por cinco reais!" */
export function priceLine(itemId: string): Bilingual {
  const g = goodById(itemId);
  if (!g) return { pt: '', en: '' };
  const one = g.qtys[0] === 1 ? totalFor(g, 1) : g.unit;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let pt = `${cap(`${g.art} ${g.pt.one}`)} custa ${moneyPt(one)}.`;
  let en = `The ${g.en.one} costs ${moneyEn(one)}.`;
  if (g.bundle) {
    pt += ` ${cap(numberPt(g.bundle.qty, g.gender))} por ${moneyPt(g.bundle.cents)}!`;
    en += ` ${cap(numberEn(g.bundle.qty))} for ${moneyEn(g.bundle.cents)}!`;
  }
  return { pt, en };
}

/** The vendor names the total for a chosen quantity. */
export function totalLine(itemId: string, qty: number): Bilingual {
  const g = goodById(itemId);
  const cents = priceFor(itemId, qty);
  if (!g || cents === null) return { pt: '', en: '' };
  return {
    pt: `${qtyPt(g, qty).replace(/^./, (c) => c.toUpperCase())}: ${moneyPt(cents)}.`,
    en: `${qtyEn(g, qty).replace(/^./, (c) => c.toUpperCase())}: ${moneyEn(cents)}.`,
  };
}

/** After a payment. */
export function resultLine(v: PaymentVerdict, paid: number, fem = false): Bilingual {
  const thanks = fem ? 'Obrigada' : 'Obrigado';
  if (v.kind === 'exact') return { pt: `Pronto! Valor certinho. ${thanks}!`, en: 'Done! The exact amount. Thank you!' };
  if (v.kind === 'change') return { pt: `Aqui o seu troco: ${moneyPt(v.change)}. ${thanks}!`, en: `Here’s your change: ${moneyEn(v.change)}. Thank you!` };
  return {
    pt: paid > 0 ? `Faltam ${moneyPt(v.missing)}.` : 'Você ainda não pagou nada.',
    en: paid > 0 ? `You’re still ${moneyEn(v.missing)} short.` : 'You haven’t paid anything yet.',
  };
}

// ---------------------------------------------------------------- what the player says (chips, typed, accept-list rules)

const articled = (g: FeiraGood) => `${g.art} ${g.pt.one}`;

/** Every phrase that asks the price of `g`, for `acceptAnswer`. */
export function askTargets(g: FeiraGood): string[] {
  return [
    `Quanto custa ${articled(g)}?`,
    `Quanto custa ${g.pt.one}?`,
    `Quanto é ${articled(g)}?`,
    `Quanto é ${g.pt.one}?`,
    `Quanto fica ${articled(g)}?`,
    `Qual é o preço ${g.art === 'a' ? 'da' : 'do'} ${g.pt.one}?`,
  ];
}

/** The chip for asking about a good. */
export const askChip = (g: FeiraGood): Bilingual => ({ pt: `Quanto custa ${articled(g)}?`, en: `How much is the ${g.en.one}?` });

export interface AskResult {
  /** The good asked about, if any. */
  itemId: string | null;
  /** 3 = a full question, 2 = named the item without asking, 1 = English, 0 = no idea. */
  score: 0 | 1 | 2 | 3;
  hint?: Bilingual;
}

const ENGLISH_ASK = /\bhow much\b/;

/**
 * Score a typed (or chip) question to a vendor with the accept-list rules: accents, case and punctuation are free (`normalizeAnswer`),
 * "Quanto custa a banana?" / "Quanto custa banana?" / "Quanto é a banana?" all count. Just naming the item ("uma banana") still gets
 * the price, with a nudge to ask properly. `goods` is what this vendor sells.
 */
export function scoreAsk(text: string, goods: readonly string[]): AskResult {
  const list = goods.map(goodById).filter((g): g is FeiraGood => !!g);
  const n = ` ${normalizeAnswer(text)} `;
  for (const g of list) if (askTargets(g).some((t) => acceptAnswer(text, t).match)) return { itemId: g.itemId, score: 3 };
  const pt = (g: FeiraGood) => n.includes(` ${normalizeAnswer(g.pt.one)} `) || n.includes(` ${normalizeAnswer(g.pt.many)} `) || n.includes(` ${g.itemId.replace(/_/g, ' ')} `);
  // "how much is the banana?": English wins, even though "banana" is also the Portuguese word
  if (ENGLISH_ASK.test(n)) {
    const eng = list.find((g) => pt(g) || n.includes(` ${normalizeAnswer(g.en.one)} `) || n.includes(` ${normalizeAnswer(g.en.many)} `));
    if (eng) return { itemId: eng.itemId, score: 1, hint: { pt: 'Em português: “Quanto custa…?”', en: 'In Portuguese: “Quanto custa…?”' } };
  }
  const named = list.find(pt);
  if (named) {
    if (/quanto/.test(n) || /preco/.test(n)) return { itemId: named.itemId, score: 3 };
    return { itemId: named.itemId, score: 2, hint: { pt: 'Dica: pergunte “Quanto custa…?”', en: 'Tip: ask “Quanto custa…?”' } };
  }
  return { itemId: null, score: 0, hint: { pt: 'Tente: “Quanto custa a banana?”', en: 'Try: “Quanto custa a banana?”' } };
}

/** The chip that picks a quantity. */
export function qtyChip(g: FeiraGood, qty: number): Bilingual {
  return { pt: `Me vê ${qtyPt(g, qty)}, por favor.`, en: `I’ll take ${qtyEn(g, qty)}, please.` };
}

const QTY_WORDS: Record<number, string[]> = {
  1: ['um', 'uma', '1'],
  2: ['dois', 'duas', '2'],
  3: ['tres', '3'],
  4: ['quatro', '4'],
  6: ['seis', '6'],
};

/** Which offered quantity a typed reply names ("três", "3 por favor", "me vê três bananas"), or null. */
export function parseQty(text: string, g: FeiraGood): number | null {
  for (const qty of g.qtys) if (acceptAnswer(text, qtyChip(g, qty).pt).match) return qty;
  const words = normalizeAnswer(text).split(' ');
  // normalizeAnswer folds digits 1-10 into words and uma/duas into um/dois
  for (const qty of g.qtys) {
    const w = (QTY_WORDS[qty] ?? []).map((x) => normalizeAnswer(x));
    if (w.some((x) => words.includes(x))) return qty;
  }
  return null;
}
