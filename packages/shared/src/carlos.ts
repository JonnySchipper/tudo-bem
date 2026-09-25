import type { Bilingual, Pronoun } from './types.js';
import { mgItemById } from './meveum.js';
import { numberEn, numberPt } from './numbers.js';
import { ECONOMY } from './constants.js';

/**
 * Seu Carlos breakfast scene — authored, chip-only (Phase 0 has no generative NPCs).
 * Graph nodes carry target cards so the student model stub can log graded acts.
 */

export interface SceneCtx {
  name: string;
  pronoun: Pronoun;
  food?: string;
  drink?: string;
}

interface ChipDef {
  pt: (c: SceneCtx) => string;
  en: (c: SceneCtx) => string;
  score: 0 | 1 | 2 | 3;
  next: string;
  set?: Partial<Pick<SceneCtx, 'food' | 'drink'>>;
}

interface NodeDef {
  line: (c: SceneCtx) => Bilingual;
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

const filho = (c: SceneCtx) => (c.pronoun === 'ele' ? 'meu filho' : c.pronoun === 'ela' ? 'minha filha' : c.name);
const obrigad = (c: SceneCtx) => (c.pronoun === 'ele' ? 'obrigado' : c.pronoun === 'ela' ? 'obrigada' : 'valeu');
const Obrigad = (c: SceneCtx) => cap(obrigad(c));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fixed = (pt: string, en: string) => ({ pt: () => pt, en: () => en });

export const PRICES: Record<string, number> = {
  pao_na_chapa: 6,
  pao_de_queijo: 5,
  coxinha: 7,
  cafe_com_leite: 5,
  suco_de_laranja: 8,
  cafezinho: 3,
  nada: 0,
};

function foodPhrase(id: string | undefined): Bilingual {
  const item = id ? mgItemById(id) : undefined;
  if (!item) return { pt: 'Seu pedido', en: 'Your order' };
  const art = item.card.gender === 'f' ? 'Uma' : 'Um';
  return { pt: `${art} ${item.card.form}`, en: `One ${item.card.gloss_en}` };
}

export function sceneTotal(c: SceneCtx): number {
  return (PRICES[c.food ?? ''] ?? 0) + (PRICES[c.drink ?? ''] ?? 0);
}

const NODES: Record<string, NodeDef> = {
  inicio: {
    cards: ['lex.geral.bom_dia', 'lex.geral.tudo_bem'],
    line: (c) =>
      c.pronoun === 'nome'
        ? { pt: `Bom dia, ${c.name}! Tudo bem? Que bom te ver na minha padaria!`, en: 'Good morning! How’s it going? So good to see you in my bakery!' }
        : {
            pt: `Bom dia, ${filho(c)}! Tudo bem? Seja ${c.pronoun === 'ela' ? 'bem-vinda' : 'bem-vindo'} à minha padaria!`,
            en: `Good morning, ${c.pronoun === 'ela' ? 'my girl (lit. “my daughter”)' : 'my boy (lit. “my son”)'}! How’s it going? Welcome to my bakery!`,
          },
    chips: [
      { ...fixed('Tudo bem, e o senhor?', 'All good, and you, sir?'), score: 3, next: 'pedido' },
      { ...fixed('Bom dia, Seu Carlos! Tudo ótimo.', 'Good morning, Seu Carlos! All great.'), score: 3, next: 'pedido' },
      { ...fixed('Oi!', 'Hi!'), score: 2, next: 'pedido' },
      { ...fixed('Hello! Good morning!', '(answer in English)'), score: 1, next: 'inicio_devagar' },
    ],
  },
  inicio_devagar: {
    cards: ['lex.geral.bom_dia', 'lex.geral.tudo_bem'],
    line: () => ({
      pt: 'Ah, aqui a gente fala português! Devagarinho: Bom… dia! Tudo… bem?',
      en: 'Ah, here we speak Portuguese! Nice and slow: Good… morning! How’s… it going?',
    }),
    chips: [
      { ...fixed('Bom dia! Tudo bem!', 'Good morning! All good!'), score: 2, next: 'pedido' },
      { ...fixed('Tudo bem, e o senhor?', 'All good, and you, sir?'), score: 2, next: 'pedido' },
    ],
  },
  pedido: {
    cards: ['lex.padaria.me_ve', 'lex.geral.por_favor', 'lex.padaria.pao_na_chapa', 'lex.padaria.pao_de_queijo', 'lex.padaria.coxinha'],
    line: () => ({
      pt: 'Tudo ótimo, graças ao pão quentinho! O que você vai querer hoje?',
      en: 'All great, thanks to the warm bread! What will you have today?',
    }),
    chips: [
      { ...fixed('Me vê um pão na chapa, por favor.', 'Give me a grilled buttered bread, please.'), score: 3, next: 'bebida', set: { food: 'pao_na_chapa' } },
      { ...fixed('Eu queria um pão de queijo, por favor.', 'I’d like a cheese bread, please.'), score: 3, next: 'bebida', set: { food: 'pao_de_queijo' } },
      { ...fixed('Uma coxinha.', 'A chicken croquette.'), score: 2, next: 'bebida', set: { food: 'coxinha' } },
      { ...fixed('Pão.', 'Bread.'), score: 1, next: 'pedido_dica' },
    ],
  },
  pedido_dica: {
    cards: ['lex.padaria.me_ve', 'lex.geral.por_favor'],
    line: () => ({
      pt: 'Pão francês? Pão na chapa? Pão de queijo? Tenta assim: “Me vê um pão na chapa, por favor.”',
      en: 'French roll? Grilled bread? Cheese bread? Try it like this: “Give me a grilled buttered bread, please.”',
    }),
    chips: [
      { ...fixed('Me vê um pão na chapa, por favor.', 'Give me a grilled buttered bread, please.'), score: 2, next: 'bebida', set: { food: 'pao_na_chapa' } },
      { ...fixed('Me vê um pão de queijo, por favor.', 'Give me a cheese bread, please.'), score: 2, next: 'bebida', set: { food: 'pao_de_queijo' } },
      { ...fixed('Me vê uma coxinha, por favor.', 'Give me a chicken croquette, please.'), score: 2, next: 'bebida', set: { food: 'coxinha' } },
    ],
  },
  bebida: {
    cards: ['lex.padaria.cafezinho', 'lex.padaria.cafe_com_leite', 'lex.padaria.suco_de_laranja'],
    line: (c) => {
      const f = foodPhrase(c.food);
      return {
        pt: `Boa escolha! ${f.pt} saindo! E pra beber? Um cafezinho, um café com leite ou um suco de laranja?`,
        en: `Good choice! ${f.en} coming up! And to drink? A little coffee, a coffee with milk, or an orange juice?`,
      };
    },
    chips: [
      { ...fixed('Um café com leite, por favor.', 'A coffee with milk, please.'), score: 3, next: 'mais', set: { drink: 'cafe_com_leite' } },
      { ...fixed('Um suco de laranja, por favor.', 'An orange juice, please.'), score: 3, next: 'mais', set: { drink: 'suco_de_laranja' } },
      { pt: (c) => `Nada, ${obrigad(c)}.`, en: () => 'Nothing, thanks.', score: 2, next: 'mais', set: { drink: 'nada' } },
      { ...fixed('Café?', 'Coffee?'), score: 1, next: 'bebida_dica' },
    ],
  },
  bebida_dica: {
    cards: ['lex.padaria.cafezinho', 'lex.padaria.cafe_com_leite'],
    line: () => ({
      pt: 'Café puro, o cafezinho, ou café com leite? Fala assim: “Um cafezinho, por favor.”',
      en: 'Black coffee (the “cafezinho”) or coffee with milk? Say it like this: “A little coffee, please.”',
    }),
    chips: [
      { ...fixed('Um cafezinho, por favor.', 'A little black coffee, please.'), score: 2, next: 'mais', set: { drink: 'cafezinho' } },
      { ...fixed('Um café com leite, por favor.', 'A coffee with milk, please.'), score: 2, next: 'mais', set: { drink: 'cafe_com_leite' } },
    ],
  },
  mais: {
    cards: ['lex.padaria.so_isso'],
    line: () => ({ pt: 'Anotado! Mais alguma coisa?', en: 'Got it! Anything else?' }),
    chips: [
      { ...fixed('Não, só isso. Quanto é?', 'No, that’s all. How much is it?'), score: 3, next: 'preco' },
      { pt: (c) => `Só isso, ${obrigad(c)}!`, en: () => 'That’s all, thanks!', score: 3, next: 'preco' },
      { ...fixed('Sim.', 'Yes.'), score: 1, next: 'mais_dica' },
    ],
  },
  mais_dica: {
    cards: ['lex.padaria.so_isso'],
    line: (c) => ({
      pt: `Sim o quê, ${filho(c)}? Se não quiser mais nada, é só dizer: “Só isso.”`,
      en: 'Yes what? If you don’t want anything else, just say: “That’s all.”',
    }),
    chips: [
      { pt: (c) => `Só isso, ${obrigad(c)}!`, en: () => 'That’s all, thanks!', score: 2, next: 'preco' },
      { ...fixed('Não, só isso. Quanto é?', 'No, that’s all. How much is it?'), score: 2, next: 'preco' },
    ],
  },
  preco: {
    cards: ['lex.padaria.por_conta_da_casa'],
    line: (c) => {
      const t = sceneTotal(c);
      return {
        pt: `Deu ${numberPt(t)} reais (R$ ${t})… Mas hoje é por conta da casa!`,
        en: `That comes to ${numberEn(t)} reais (R$ ${t})… But today it’s on the house!`,
      };
    },
    chips: [
      { pt: (c) => `Sério? Muito ${obrigad(c) === 'valeu' ? 'obrigado' : obrigad(c)}, Seu Carlos!`, en: () => 'Really? Thank you so much, Seu Carlos!', score: 3, next: 'fim' },
      { ...fixed('Que legal! Valeu!', 'How cool! Thanks!'), score: 3, next: 'fim' },
      { ...fixed('Por conta da casa?', 'On the house?'), score: 1, next: 'preco_dica' },
    ],
  },
  preco_dica: {
    cards: ['lex.padaria.por_conta_da_casa'],
    line: () => ({
      pt: '“Por conta da casa” quer dizer que você não paga nada. É de graça!',
      en: '“Por conta da casa” means you pay nothing. It’s free!',
    }),
    chips: [
      { pt: (c) => `Ah, entendi! ${Obrigad(c)}!`, en: () => 'Oh, I get it! Thanks!', score: 2, next: 'fim' },
      { ...fixed('Que legal! Valeu!', 'How cool! Thanks!'), score: 2, next: 'fim' },
    ],
  },
  fim: {
    cards: [],
    end: true,
    line: (c) => ({
      pt: `Imagina! Bom apetite e volte sempre, ${filho(c)}! Ah — se quiser ganhar uns trocados, me ajuda no balcão com o “Me vê um…”.`,
      en: 'Don’t mention it! Enjoy your meal and come back anytime! Oh — if you want to earn some coins, help me at the counter with “Me vê um…”.',
    }),
    chips: [],
  },
};

export const SCENE_START = 'inicio';

export function viewNode(nodeId: string, ctx: SceneCtx): SceneView | null {
  const n = NODES[nodeId];
  if (!n) return null;
  return {
    nodeId,
    speaker: 'Seu Carlos',
    line: n.line(ctx),
    chips: n.chips.map((c) => ({ pt: c.pt(ctx), en: c.en(ctx) })),
    end: !!n.end,
  };
}

export interface ChoiceResult {
  score: 0 | 1 | 2 | 3;
  next: string;
  ctx: SceneCtx;
  said: Bilingual;
  cards: string[];
}

export function chooseChip(nodeId: string, chipIndex: number, ctx: SceneCtx): ChoiceResult | null {
  const n = NODES[nodeId];
  const chip = n?.chips[chipIndex];
  if (!n || !chip) return null;
  return { score: chip.score, next: chip.next, ctx: { ...ctx, ...(chip.set ?? {}) }, said: { pt: chip.pt(ctx), en: chip.en(ctx) }, cards: n.cards };
}

export const SCORE_FEEDBACK: Record<0 | 1 | 2 | 3, Bilingual> = {
  3: { pt: 'Perfeito!', en: 'Perfect!' },
  2: { pt: 'Muito bem!', en: 'Well done!' },
  1: { pt: 'Quase! Seu Carlos vai repetir devagar.', en: 'Almost! Seu Carlos will say it slower.' },
  0: { pt: 'Tudo bem, vamos de novo.', en: 'That’s okay, let’s try again.' },
};

/** Scene clear payout (GDD §10.2: 6–14 RV) with daily decay per NPC. */
export function scenePayout(scores: number[], clearsToday: number): number {
  if (!scores.length) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const base = ECONOMY.sceneMin + Math.round(((ECONOMY.sceneMax - ECONOMY.sceneMin) * Math.max(0, avg - 1)) / 2);
  if (clearsToday < ECONOMY.sceneFullPerDay) return base;
  if (clearsToday < ECONOMY.sceneFullPerDay + 2) return Math.max(1, Math.floor(base / 2));
  return 0;
}
