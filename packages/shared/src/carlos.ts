import type { Bilingual, Pronoun } from './types.js';
import { mgItemById } from './meveum.js';
import { numberEn, numberPt } from './numbers.js';
import { ECONOMY } from './constants.js';
import { acceptAnswer } from './accept.js';
import { GREETING_EN, greetingCap, greetingFor, localizeGreeting } from './clock.js';

/**
 * Seu Carlos breakfast scene — authored, chip-first (Phase 0 has no generative NPCs).
 * Voice: content/curriculum/phase0/voice-seu-carlos.md (DRAFT — needs BR sign-off).
 *   - “Pois não” is the primary acknowledgement; never default to “Pode falar”.
 *   - “meu filho / minha filha” at most once per scene, only when the player chose ele/ela.
 *   - Verde lines ≤ 18 words. Praise: Isso aí / Pronto / Tá na mão. Exit: Volte sempre.
 * Nodes carry target cards so the student model stub can log graded acts.
 */

export interface SceneCtx {
  name: string;
  pronoun: Pronoun;
  food?: string;
  drink?: string;
  where?: 'aqui' | 'viagem';
  /** Soft kinship already used this scene (CEO lock: max once). */
  kinUsed?: boolean;
  /** Game minute (0..1439) the scene started: the greetings follow it (bom dia / boa tarde / boa noite). Unset = morning. */
  minute?: number;
}

/** The greeting that fits the scene's time. */
const greetOf = (c: SceneCtx) => greetingFor(c.minute ?? 600);

interface ChipDef {
  pt: (c: SceneCtx) => string;
  en: (c: SceneCtx) => string;
  score: 0 | 1 | 2 | 3;
  next: string;
  set?: Partial<Pick<SceneCtx, 'food' | 'drink' | 'where'>>;
  /** Extra typed variants (accept-list rules apply on top). */
  accepts?: string[];
}

/** `kin()` returns “, meu filho” / “, minha filha” the first time it's allowed, else ''. */
type Kin = () => string;

interface NodeDef {
  line: (c: SceneCtx, kin: Kin) => Bilingual;
  chips: ChipDef[];
  cards: string[];
  end?: boolean;
}

export interface SceneView {
  nodeId: string;
  speaker: string;
  line: Bilingual;
  chips: Bilingual[];
  end: boolean;
}

const obrigad = (c: SceneCtx) => (c.pronoun === 'ela' ? 'obrigada' : 'obrigado');
/** Seu Carlos's counter greeting; also what the padaria door answers while the player is far from owning anything. */
export const CARLOS_POIS_NAO: Bilingual = { pt: 'Pois não. O que vai ser hoje?', en: 'Yes? What’ll it be today?' };

const fixed = (pt: string, en: string) => ({ pt: () => pt, en: () => en });

export const PRICES: Record<string, number> = {
  pao_na_chapa: 6,
  coxinha: 7,
  pastel: 8,
  cafe_com_leite: 5,
  cafe: 4,
  suco_de_laranja: 8,
  agua: 3,
  nada: 0,
};

function itemPhrase(id: string | undefined): Bilingual {
  const item = id ? mgItemById(id) : undefined;
  if (!item) return { pt: 'Seu pedido', en: 'Your order' };
  const art = item.card.gender === 'f' ? 'Uma' : 'Um';
  return { pt: `${art} ${item.card.form}`, en: `One ${item.card.gloss_en}` };
}

export function sceneTotal(c: SceneCtx): number {
  return (PRICES[c.food ?? ''] ?? 0) + (PRICES[c.drink ?? ''] ?? 0);
}

const FOOD_CHIPS = (score: 2 | 3): ChipDef[] => [
  { ...fixed('Me vê um pão na chapa, por favor.', 'I’ll take a pão na chapa (grilled buttered bread), please.'), score, next: 'bebida', set: { food: 'pao_na_chapa' } },
  { ...fixed('Me vê uma coxinha, por favor.', 'I’ll take a coxinha (chicken croquette), please.'), score, next: 'bebida', set: { food: 'coxinha' } },
  { ...fixed('Me vê um pastel, por favor.', 'I’ll take a pastel (savory fried pastry), please.'), score, next: 'bebida', set: { food: 'pastel' } },
];

const NODES: Record<string, NodeDef> = {
  inicio: {
    cards: ['lex.social.bom_dia', 'lex.social.tudo_bem'],
    line: (c) => localizeGreeting({ pt: 'Bom dia! Tudo bem?', en: 'Good morning! How’s it going?' }, c.minute ?? 600),
    chips: [
      { ...fixed('Tudo bem!', 'All good!'), score: 3, next: 'pedido', accepts: ['tudo bem e o senhor', 'tudo bem e voce', 'to bem', 'estou bem', 'tudo otimo', 'bem'] },
      // the chip greets the way the hour asks; typing any of the three greetings is accepted (the time-exact check is the recado's `timeCorrect`)
      {
        pt: (c) => `${greetingCap(greetOf(c))}!`,
        en: (c) => `${GREETING_EN[greetOf(c)]}!`,
        score: 3,
        next: 'pedido',
        accepts: ['bom dia', 'boa tarde', 'boa noite', 'bom dia seu carlos', 'boa tarde seu carlos', 'boa noite seu carlos', 'bomdia', 'bom dia tudo bem', 'boa tarde tudo bem', 'boa noite tudo bem'],
      },
      { ...fixed('Olá!', 'Hello!'), score: 2, next: 'pedido', accepts: ['oi', 'oi seu carlos', 'e ai'] },
      { ...fixed('Hello! Good morning!', '(answer in English)'), score: 1, next: 'inicio_devagar', accepts: ['hello', 'hi', 'good morning'] },
    ],
  },
  inicio_devagar: {
    cards: ['lex.social.bom_dia', 'lex.social.tudo_bem'],
    line: (c) => {
      const g = greetOf(c);
      const slowPt = greetingCap(g).replace(' ', '… ');
      const slowEn = GREETING_EN[g].replace(' ', '… ');
      return { pt: `Aqui a gente fala português, tá? Devagarinho: ${slowPt}! Tudo… bem?`, en: `Here we speak Portuguese, okay? Nice and slow: ${slowEn}! How’s… it going?` };
    },
    chips: [
      { pt: (c) => `${greetingCap(greetOf(c))}! Tudo bem!`, en: (c) => `${GREETING_EN[greetOf(c)]}! All good!`, score: 2, next: 'pedido', accepts: ['bom dia', 'boa tarde', 'boa noite', 'tudo bem'] },
      { ...fixed('Tudo bem!', 'All good!'), score: 2, next: 'pedido', accepts: ['bem', 'to bem'] },
    ],
  },
  pedido: {
    cards: ['lex.padaria.pois_nao', 'lex.padaria.o_que_vai_ser', 'lex.padaria.me_ve', 'lex.padaria.por_favor', 'lex.padaria.pao_na_chapa', 'lex.padaria.cafe_com_leite'],
    line: () => CARLOS_POIS_NAO,
    chips: [
      { ...fixed('Me vê um pão na chapa, por favor.', 'I’ll take a pão na chapa (grilled buttered bread), please.'), score: 3, next: 'bebida', set: { food: 'pao_na_chapa' } },
      { ...fixed('Um café com leite, por favor.', 'A coffee with milk, please.'), score: 3, next: 'comida', set: { drink: 'cafe_com_leite' }, accepts: ['me ve um cafe com leite'] },
      { ...fixed('Ainda tô olhando.', 'I’m still looking.'), score: 2, next: 'pedido_calma', accepts: ['ainda estou olhando', 'to olhando', 'so olhando', 'deixa eu ver'] },
      { ...fixed('Pão.', 'Bread.'), score: 1, next: 'pedido_dica', accepts: ['bread'] },
    ],
  },
  pedido_calma: {
    cards: ['lex.padaria.pao_na_chapa', 'lex.padaria.coxinha', 'lex.padaria.pastel', 'lex.padaria.quentinho'],
    line: (_c, kin) => ({
      pt: `Sem pressa${kin()}. Tem pão na chapa, coxinha e pastel quentinho.`,
      en: 'No rush. There’s grilled buttered bread, coxinha and nice warm pastel.',
    }),
    chips: FOOD_CHIPS(3),
  },
  pedido_dica: {
    cards: ['lex.padaria.me_ve', 'lex.padaria.por_favor'],
    line: () => ({
      pt: 'Pão na chapa? Coxinha? Pastel? Fala assim: “Me vê um pão na chapa, por favor.”',
      en: 'Grilled bread? Coxinha? Pastel? Say it like this: “I’ll take a pão na chapa, please.”',
    }),
    chips: FOOD_CHIPS(2),
  },
  bebida: {
    cards: ['lex.padaria.isso_ai', 'lex.padaria.cafe_com_leite', 'lex.padaria.suco_de_laranja', 'lex.padaria.agua'],
    line: (c) => {
      const f = itemPhrase(c.food);
      return {
        pt: `Isso aí! ${f.pt} saindo. E pra beber? Café com leite, suco de laranja ou água?`,
        en: `That’s it! ${f.en} coming up. And to drink? Coffee with milk, orange juice or water?`,
      };
    },
    chips: [
      { ...fixed('Um café com leite, por favor.', 'A coffee with milk, please.'), score: 3, next: 'local', set: { drink: 'cafe_com_leite' } },
      { ...fixed('Um suco de laranja, por favor.', 'An orange juice, please.'), score: 3, next: 'local', set: { drink: 'suco_de_laranja' } },
      { ...fixed('Uma água, por favor.', 'A water, please.'), score: 3, next: 'local', set: { drink: 'agua' } },
      { ...fixed('Café?', 'Coffee?'), score: 1, next: 'bebida_dica', accepts: ['coffee'] },
    ],
  },
  bebida_dica: {
    cards: ['lex.padaria.cafe', 'lex.padaria.cafe_com_leite'],
    line: () => ({ pt: 'Café puro ou café com leite? Fala: “Um café com leite, por favor.”', en: 'Plain coffee or coffee with milk? Say: “A coffee with milk, please.”' }),
    chips: [
      { ...fixed('Um café, por favor.', 'A coffee, please.'), score: 2, next: 'local', set: { drink: 'cafe' } },
      { ...fixed('Um café com leite, por favor.', 'A coffee with milk, please.'), score: 2, next: 'local', set: { drink: 'cafe_com_leite' } },
    ],
  },
  comida: {
    cards: ['lex.padaria.isso_ai', 'lex.padaria.pao_na_chapa', 'lex.padaria.coxinha', 'lex.padaria.pastel'],
    line: (c) => {
      const d = itemPhrase(c.drink);
      return { pt: `Isso aí! ${d.pt} saindo. E pra comer? Pão na chapa, coxinha ou pastel?`, en: `That’s it! ${d.en} coming up. And to eat? Grilled bread, coxinha or pastel?` };
    },
    chips: [
      ...FOOD_CHIPS(3).map((c) => ({ ...c, next: 'local' })),
      { pt: (c) => `Só o café, ${obrigad(c)}.`, en: () => 'Just the coffee, thanks.', score: 2, next: 'local', set: { food: 'nada' }, accepts: ['so isso', 'so o cafe', 'nada obrigado'] },
    ],
  },
  local: {
    cards: ['lex.padaria.pronto', 'lex.padaria.pra_comer_aqui', 'lex.padaria.pra_viagem'],
    line: () => ({ pt: 'Pronto. Pra comer aqui ou pra viagem?', en: 'Ready. For here or to go?' }),
    chips: [
      { ...fixed('Pra comer aqui, por favor.', 'For here, please.'), score: 3, next: 'preco', set: { where: 'aqui' }, accepts: ['para comer aqui', 'pra comer aqui'] },
      { ...fixed('Pra viagem, por favor.', 'To go, please.'), score: 3, next: 'preco', set: { where: 'viagem' }, accepts: ['para viagem', 'pra viagem'] },
      { ...fixed('Aqui.', 'Here.'), score: 2, next: 'preco', set: { where: 'aqui' } },
      { ...fixed('To go.', '(answer in English)'), score: 1, next: 'local_dica', accepts: ['to go', 'for here'] },
    ],
  },
  local_dica: {
    cards: ['lex.padaria.pra_viagem', 'lex.padaria.pra_comer_aqui'],
    line: () => ({ pt: '“To go” é “pra viagem”. E “for here” é “pra comer aqui”.', en: '“To go” is “pra viagem”. And “for here” is “pra comer aqui”.' }),
    chips: [
      { ...fixed('Pra viagem, por favor.', 'To go, please.'), score: 2, next: 'preco', set: { where: 'viagem' } },
      { ...fixed('Pra comer aqui, por favor.', 'For here, please.'), score: 2, next: 'preco', set: { where: 'aqui' } },
    ],
  },
  preco: {
    cards: ['lex.padaria.por_conta_da_casa', 'lex.social.obrigado'],
    line: (c) => {
      const t = sceneTotal(c);
      return {
        pt: `Deu ${numberPt(t)} reais (R$ ${t})… Mas hoje é por conta da casa!`,
        en: `That comes to ${numberEn(t)} reais (R$ ${t})… But today it’s on the house!`,
      };
    },
    chips: [
      { pt: (c) => `Muito ${obrigad(c)}, Seu Carlos!`, en: () => 'Thank you so much, Seu Carlos!', score: 3, next: 'fim', accepts: ['obrigado', 'muito obrigado', 'obrigado seu carlos'] },
      { ...fixed('Valeu!', 'Thanks!'), score: 2, next: 'fim', accepts: ['valeu seu carlos', 'vlw'] },
      { ...fixed('Por conta da casa?', 'On the house?'), score: 1, next: 'preco_dica', accepts: ['what', 'como assim'] },
    ],
  },
  preco_dica: {
    cards: ['lex.padaria.por_conta_da_casa'],
    line: () => ({ pt: '“Por conta da casa” quer dizer que você não paga nada. É de graça!', en: '“Por conta da casa” means you pay nothing. It’s free!' }),
    chips: [
      { pt: (c) => `Ah, entendi! ${obrigad(c) === 'obrigada' ? 'Obrigada' : 'Obrigado'}!`, en: () => 'Oh, I get it! Thanks!', score: 2, next: 'fim', accepts: ['entendi', 'obrigado'] },
      { ...fixed('Valeu!', 'Thanks!'), score: 2, next: 'fim' },
    ],
  },
  fim: {
    cards: ['lex.padaria.ta_na_mao', 'lex.padaria.volte_sempre'],
    end: true,
    line: (_c, kin) => ({
      pt: `Tá na mão${kin()}. Volte sempre! Quer ajudar no balcão? É a “Correria no Balcão”.`,
      en: 'Here you go. Come back anytime! Want to help at the counter? It’s the “Correria no Balcão” (Counter Rush) game.',
    }),
    chips: [],
  },
};

export const SCENE_START = 'inicio';
export const SCENE_NODE_IDS = Object.keys(NODES);

function render(nodeId: string, ctx: SceneCtx): { view: SceneView; usedKin: boolean } | null {
  const n = NODES[nodeId];
  if (!n) return null;
  let usedKin = false;
  const kin: Kin = () => {
    if (ctx.kinUsed || usedKin || ctx.pronoun === 'nome') return '';
    usedKin = true;
    return ctx.pronoun === 'ela' ? ', minha filha' : ', meu filho';
  };
  const line = n.line(ctx, kin);
  return {
    view: { nodeId, speaker: 'Seu Carlos', line, chips: n.chips.map((c) => ({ pt: c.pt(ctx), en: c.en(ctx) })), end: !!n.end },
    usedKin,
  };
}

export function viewNode(nodeId: string, ctx: SceneCtx): SceneView | null {
  return render(nodeId, ctx)?.view ?? null;
}

export interface ChoiceResult {
  score: 0 | 1 | 2 | 3;
  next: string;
  ctx: SceneCtx;
  said: Bilingual;
  cards: string[];
}

export function chooseChip(nodeId: string, chipIndex: number, ctx: SceneCtx, scoreCap: 0 | 1 | 2 | 3 = 3): ChoiceResult | null {
  const n = NODES[nodeId];
  const chip = n?.chips[chipIndex];
  if (!n || !chip) return null;
  const nextCtx: SceneCtx = { ...ctx, ...(chip.set ?? {}) };
  // Kinship is spent when the next line actually uses it.
  if (render(chip.next, nextCtx)?.usedKin) nextCtx.kinUsed = true;
  const score = Math.min(chip.score, scoreCap) as 0 | 1 | 2 | 3;
  return { score, next: chip.next, ctx: nextCtx, said: { pt: chip.pt(ctx), en: chip.en(ctx) }, cards: n.cards };
}

export interface TypedReplyScore {
  /** Chip the typed reply maps to, or null when Carlos didn't understand. */
  chip: number | null;
  /** Accept-list score (content/curriculum/phase0/accept-list-rules.md); Jev's pack view is `jevNpcReply`. */
  task_success: 0 | 1 | 2 | 3;
  language: 'pt' | 'en' | 'mix' | 'gibberish';
  answers_the_npc_question: boolean;
  uses_target_lexeme: boolean;
  why: string;
}

/** Stub Jev + accept-list rules for a free-typed reply to the current node. */
export function scoreTypedReply(nodeId: string, text: string, ctx: SceneCtx): TypedReplyScore {
  const n = NODES[nodeId];
  const none = (language: TypedReplyScore['language'], why: string): TypedReplyScore => ({ chip: null, task_success: 0, language, answers_the_npc_question: false, uses_target_lexeme: false, why });
  if (!n || !n.chips.length) return none('gibberish', 'no open question');
  let best: { chip: number; cap: 0 | 1 | 2 | 3; english: boolean; why: string } | null = null;
  n.chips.forEach((c, i) => {
    for (const target of [c.pt(ctx), ...(c.accepts ?? [])]) {
      const r = acceptAnswer(text, target);
      if (!r.match) continue;
      const cap = Math.min(r.cap, c.score) as 0 | 1 | 2 | 3;
      if (!best || cap > best.cap) best = { chip: i, cap, english: r.english, why: r.why };
    }
  });
  const found = best as { chip: number; cap: 0 | 1 | 2 | 3; english: boolean; why: string } | null;
  if (!found) {
    const english = acceptAnswer(text, '_').english;
    // English with no matching chip: route through the node's English/rephrase chip if it has one.
    const en = n.chips.findIndex((c) => c.score === 1);
    if (english && en >= 0) return { chip: en, task_success: 1, language: 'en', answers_the_npc_question: true, uses_target_lexeme: false, why: 'English — Carlos rephrases slower' };
    return none(english ? 'en' : 'pt', 'did not match any expected reply');
  }
  const chip = n.chips[found.chip];
  return {
    chip: found.chip,
    task_success: found.cap,
    language: found.english ? 'en' : 'pt',
    answers_the_npc_question: true,
    uses_target_lexeme: chip.score === 3 && found.cap >= 2,
    why: found.why,
  };
}

export const SCORE_FEEDBACK: Record<0 | 1 | 2 | 3, Bilingual> = {
  3: { pt: 'Perfeito!', en: 'Perfect!' },
  2: { pt: 'Muito bem!', en: 'Well done!' },
  1: { pt: 'Quase! Seu Carlos vai repetir devagar.', en: 'Almost! Seu Carlos will say it slower.' },
  0: { pt: 'Não entendi bem — tenta de novo ou escolhe um botão.', en: 'Carlos didn’t quite get that — try again or pick a reply.' },
};

/** Typed Pedido rápido reply that matched no chip. Points at the open Conversa instead of another chip. */
export const TYPED_MISS_HINT: Bilingual = {
  pt: 'Não entendi bem. Para conversar à vontade, fecha isto e clica em mim de novo.',
  en: 'I did not quite get that. For a real chat, close this and click me again.',
};

/** Scene clear payout (GDD §10.2: 6–14 RV): the full amount for `ECONOMY.sceneFullPerDay` clears a day per NPC, then nothing (no halving). */
export function scenePayout(scores: number[], clearsToday: number): number {
  if (!scores.length) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const base = ECONOMY.sceneMin + Math.round(((ECONOMY.sceneMax - ECONOMY.sceneMin) * Math.max(0, avg - 1)) / 2);
  return clearsToday < ECONOMY.sceneFullPerDay ? base : 0;
}
