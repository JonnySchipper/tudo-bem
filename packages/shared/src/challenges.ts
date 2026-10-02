/**
 * The Portuguese challenges of "Treino no tatame": an A1 bank (everyday Portuguese, never technique trivia: CEO lock), five kinds
 * (cloze, choice, reorder, listening, typed), a weighted pick that leans toward Caderno words the player has not learned yet, and
 * the pure answer check the server uses. Every item is `needs_br` (a Brazilian reviewer signs it off).
 */
import type { Bilingual } from './types.js';
import type { Rng } from './meveum.js';
import { normalizeAnswer } from './accept.js';
import { cardById } from './cards.js';
import { isLearned, type Caderno } from './caderno.js';

export type ChallengeKind = 'cloze' | 'choice' | 'reorder' | 'listening' | 'typed';

export interface ChallengeItem {
  id: string;
  kind: ChallengeKind;
  /** 1 easy .. 3 long (finalização) */
  tier: 1 | 2 | 3;
  prompt: Bilingual;
  /** cloze / choice / listening: the correct option is ALWAYS source index 0 (the instance shuffles it) */
  options?: Bilingual[];
  /** reorder: the words in their correct order */
  words?: string[];
  /** listening: the phrase the client speaks (a prebaked clip: see apps/client audio manifest) */
  listenPt?: string;
  /** typed: accepted words (accents and case are forgiven by `normalizeAnswer`) */
  accept?: string[];
  /** Caderno card ids this item practises */
  cards?: string[];
  needs_br: true;
}

const o = (s: string): Bilingual => {
  const [pt, en] = s.split('|');
  return { pt: pt!, en: en ?? pt! };
};
const BUILD: Bilingual = { pt: 'Monte a frase.', en: 'Build the sentence.' };
const LISTEN: Bilingual = { pt: 'Escute e escolha.', en: 'Listen and choose.' };
const FILL: Bilingual = { pt: 'Qual palavra falta?', en: 'Which word is missing?' };

const cloze = (id: string, pt: string, en: string, opts: string[], cards: string[] = []): ChallengeItem => ({
  id: `cz_${id}`,
  kind: 'cloze',
  tier: 1,
  prompt: { pt, en },
  options: opts.map(o),
  cards,
  needs_br: true,
});

const choice = (id: string, pt: string, en: string, opts: string[], cards: string[] = []): ChallengeItem => ({
  id: `ch_${id}`,
  kind: 'choice',
  tier: 1,
  prompt: { pt, en },
  options: opts.map(o),
  cards,
  needs_br: true,
});

const typed = (id: string, pt: string, en: string, accept: string[], cards: string[] = []): ChallengeItem => ({
  id: `ty_${id}`,
  kind: 'typed',
  tier: 2,
  prompt: { pt, en },
  accept,
  cards,
  needs_br: true,
});

const reorder = (id: string, en: string, words: string[], cards: string[] = [], tier: 2 | 3 = 2): ChallengeItem => ({
  id: `${tier === 3 ? 'fz' : 'ro'}_${id}`,
  kind: 'reorder',
  tier,
  prompt: { pt: BUILD.pt, en: `${BUILD.en} ${en}` },
  words,
  cards,
  needs_br: true,
});

const listen = (id: string, say: string, opts: string[], cards: string[] = []): ChallengeItem => ({
  id: `li_${id}`,
  kind: 'listening',
  tier: 1,
  prompt: LISTEN,
  listenPt: say,
  options: opts.map(o),
  cards,
  needs_br: true,
});

const SOC = (n: string) => `lex.social.${n}`;
const PAD = (n: string) => `lex.padaria.${n}`;
const NUM = (n: number) => `lex.num.${n}`;

export const FILL_PROMPT = FILL;

const BANK: ChallengeItem[] = [
  // ---- cloze: one missing word
  cloze('bom_dia', '___ dia!', 'Good morning!', ['Bom|Good (m.)', 'Boa|Good (f.)', 'Bem|Well'], [SOC('bom_dia')]),
  cloze('boa_tarde', 'Boa ___!', 'Good afternoon!', ['tarde|afternoon', 'noite|night', 'manhã|morning'], [SOC('boa_tarde')]),
  cloze('boa_noite', 'Boa ___, até amanhã!', 'Good night, see you tomorrow!', ['noite|night', 'tarde|afternoon', 'dia|day'], [SOC('boa_noite')]),
  cloze('oi', '___, tudo bem?', 'Hi, how are you?', ['Oi|Hi', 'Tchau|Bye', 'Obrigado|Thanks'], [SOC('oi'), SOC('tudo_bem')]),
  cloze('tchau', 'Até amanhã! ___!', 'See you tomorrow! Bye!', ['Tchau|Bye', 'Oi|Hi', 'Bom dia|Good morning'], [SOC('tchau')]),
  cloze('me_ve', '___ um café, por favor.', 'I’ll have a coffee, please.', ['Me vê|I’ll have', 'Tchau|Bye', 'Pronto|Ready'], [PAD('me_ve'), PAD('cafe')]),
  cloze('por_favor', 'Um pão, ___.', 'A roll, please.', ['por favor|please', 'de nada|you’re welcome', 'boa noite|good evening'], [PAD('por_favor'), PAD('pao')]),
  cloze('de_nada', '— Obrigado! — De ___.', '“Thanks!” “You’re welcome!”', ['nada|nothing', 'tudo|everything', 'dia|day'], [SOC('de_nada')]),
  cloze('obrigado', '___ pela ajuda!', 'Thanks for the help!', ['Obrigado|Thank you', 'Tchau|Bye', 'Oi|Hi'], [SOC('obrigado')]),
  cloze('laranja', 'Um suco de ___, por favor.', 'An orange juice, please.', ['laranja|orange', 'queijo|cheese', 'mesa|table'], [PAD('suco_de_laranja')]),
  cloze('leite', 'Um café com ___.', 'A coffee with milk.', ['leite|milk', 'mesa|table', 'porta|door'], [PAD('cafe_com_leite')]),
  cloze('queijo', 'Um pão de ___, por favor.', 'A cheese bread, please.', ['queijo|cheese', 'rua|street', 'chuva|rain'], [PAD('pao_de_queijo')]),
  cloze('agua', 'Um copo de ___ gelada.', 'A glass of cold water.', ['água|water', 'porta|door', 'rua|street'], [PAD('agua')]),
  cloze('acucar', 'Um café sem ___.', 'A coffee without sugar.', ['açúcar|sugar', 'sapato|shoe', 'mesa|table'], [PAD('sem_acucar')]),
  cloze('viagem', 'É pra comer aqui ou pra ___?', 'For here or to go?', ['viagem|to go', 'mesa|table', 'água|water'], [PAD('pra_viagem'), PAD('pra_comer_aqui')]),
  cloze('quanto', '___ custa o pão?', 'How much is the bread?', ['Quanto|How much', 'Quando|When', 'Onde|Where'], [PAD('pao')]),
  cloze('onde', '___ fica a padaria?', 'Where is the bakery?', ['Onde|Where', 'Quanto|How much', 'Quem|Who']),
  cloze('dois', '___ cafés, por favor.', 'Two coffees, please.', ['Dois|Two', 'Doze|Twelve', 'Vinte|Twenty'], [NUM(2), PAD('cafe')]),
  cloze('tres', 'São ___ reais.', 'It’s three reais.', ['três|three', 'treze|thirteen', 'seis|six'], [NUM(3)]),
  cloze('dez', 'Cinco e cinco são ___.', 'Five and five make ten.', ['dez|ten', 'doze|twelve', 'oito|eight'], [NUM(5), NUM(10)]),
  cloze('contagem', 'Um, dois, três, ___, cinco.', 'One, two, three, four, five.', ['quatro|four', 'sete|seven', 'oito|eight'], [NUM(4)]),
  cloze('feira', 'Amanhã tem ___ na praça.', 'Tomorrow there’s a street market in the square.', ['feira|street market', 'mesa|table', 'porta|door']),
  cloze('padaria', 'O pão fresco está na ___.', 'The fresh bread is at the bakery.', ['padaria|bakery', 'porta|door', 'rua|street'], [PAD('pao')]),
  cloze('licenca', '___! Posso passar?', 'Excuse me! May I pass?', ['Com licença|Excuse me', 'De nada|You’re welcome', 'Boa noite|Good evening']),
  cloze('desculpa', '___, eu não entendi.', 'Sorry, I didn’t understand.', ['Desculpa|Sorry', 'Parabéns|Congrats', 'Bom apetite|Enjoy your meal']),
  cloze('sou', 'Eu ___ do Brasil.', 'I’m from Brazil.', ['sou|am', 'é|is', 'são|are']),
  cloze('voce_e', 'Você ___ de São Paulo?', 'Are you from São Paulo?', ['é|are', 'sou|am', 'somos|we are']),
  cloze('nome', 'Meu ___ é Ana.', 'My name is Ana.', ['nome|name', 'pão|bread', 'casa|house']),
  cloze('gosto', 'Eu ___ de café com leite.', 'I like coffee with milk.', ['gosto|like', 'gosta|likes', 'gostam|they like'], [PAD('cafe_com_leite')]),
  cloze('quero', 'Eu ___ um pastel.', 'I want a pastry.', ['quero|want', 'quer|wants', 'querem|they want'], [PAD('pastel')]),
  cloze('tenho', 'Eu ___ fome.', 'I’m hungry.', ['tenho|have', 'sou|am', 'vou|go']),
  cloze('quente', 'O café está bem ___.', 'The coffee is nice and hot.', ['quente|hot', 'frio|cold', 'lento|slow'], [PAD('bem_quente')]),

  // ---- choice: what does it mean / what do you say
  choice(
    'pao_chapa',
    'O que é “pão na chapa”?',
    'What is “pão na chapa”?',
    ['pão grelhado com manteiga|griddled buttered bread', 'suco de fruta|fruit juice', 'bolo de pote|jar cake', 'água com gás|sparkling water'],
    [PAD('pao_na_chapa')],
  ),
  choice(
    'pastel',
    'O que é um pastel?',
    'What is a pastel?',
    ['massa frita com recheio|fried pastry with filling', 'uma bebida gelada|a cold drink', 'um pão doce|a sweet bread', 'um café forte|a strong coffee'],
    [PAD('pastel')],
  ),
  choice(
    'coxinha',
    'Qual destes é uma coxinha?',
    'Which of these is a coxinha?',
    ['salgado de frango|chicken croquette', 'suco de laranja|orange juice', 'pão de queijo|cheese bread', 'bolo de chocolate|chocolate cake'],
    [PAD('coxinha')],
  ),
  choice('guarana', 'O que é guaraná?', 'What is guaraná?', ['refrigerante brasileiro|Brazilian soda', 'um pão doce|a sweet bread', 'um tipo de queijo|a kind of cheese', 'uma sobremesa|a dessert'], [PAD('guarana')]),
  choice('dois', 'Como se diz 2?', 'How do you say 2?', ['dois|two', 'doze|twelve', 'dez|ten', 'três|three'], [NUM(2)]),
  choice('oito', 'Como se diz 8?', 'How do you say 8?', ['oito|eight', 'sete|seven', 'seis|six', 'nove|nine'], [NUM(8)]),
  choice('quinze', 'Como se diz 15?', 'How do you say 15?', ['quinze|fifteen', 'cinco|five', 'onze|eleven', 'treze|thirteen'], [NUM(15)]),
  choice('vinte', 'Como se diz 20?', 'How do you say 20?', ['vinte|twenty', 'dez|ten', 'dezoito|eighteen', 'doze|twelve'], [NUM(20)]),
  choice('noite', 'Que cumprimento você usa à noite?', 'Which greeting do you use at night?', ['Boa noite|Good evening', 'Bom dia|Good morning', 'Boa tarde|Good afternoon', 'Tchau|Bye'], [SOC('boa_noite')]),
  choice('ajuda', 'Alguém ajudou você. O que você diz?', 'Someone helped you. What do you say?', ['Obrigado|Thank you', 'Bom dia|Good morning', 'Com licença|Excuse me', 'Tchau|Bye'], [SOC('obrigado')]),
  choice('nada', 'Alguém disse “obrigado”. O que você responde?', 'Someone said “thanks”. What do you answer?', ['De nada|You’re welcome', 'Boa noite|Good evening', 'Com licença|Excuse me', 'Tchau|Bye'], [SOC('de_nada')]),
  choice('tudo_bem', 'Alguém pergunta “Tudo bem?”. O que você diz?', 'Someone asks “Tudo bem?”. What do you say?', ['Tudo bem! E você?|All good! And you?', 'De nada|You’re welcome', 'Tchau|Bye', 'Por favor|Please'], [SOC('tudo_bem')]),
  choice('viagem', '“Pra viagem” quer dizer…', 'What does “pra viagem” mean?', ['para levar|to go', 'para comer aqui|for here', 'sem açúcar|no sugar', 'por conta da casa|on the house'], [PAD('pra_viagem')]),
  choice('conta', '“Por conta da casa” quer dizer…', 'What does “por conta da casa” mean?', ['de graça|on the house', 'muito caro|very expensive', 'para levar|to go', 'sem açúcar|no sugar'], [PAD('por_conta_da_casa')]),
  choice('onde', '“Onde fica?” quer dizer…', 'What does “Onde fica?” mean?', ['Em que lugar?|Where is it?', 'Quanto custa?|How much is it?', 'Quem é?|Who is it?', 'Que horas são?|What time is it?']),
  choice('quanto', '“Quanto custa?” quer dizer…', 'What does “Quanto custa?” mean?', ['Qual é o preço?|How much is it?', 'Onde fica?|Where is it?', 'Quem é?|Who is it?', 'Que horas são?|What time is it?']),

  // ---- typed: one word (accents optional, never digits)
  typed('favor', 'Um café, por ___.', 'A coffee, please.', ['favor'], [PAD('por_favor')]),
  typed('nada', '— Obrigado! — De ___.', '“Thanks!” “You’re welcome!”', ['nada'], [SOC('de_nada')]),
  typed('dia', 'Bom ___!', 'Good morning!', ['dia'], [SOC('bom_dia')]),
  typed('tarde', 'Boa ___!', 'Good afternoon!', ['tarde'], [SOC('boa_tarde')]),
  typed('noite', 'Boa ___, até amanhã!', 'Good night, see you tomorrow!', ['noite'], [SOC('boa_noite')]),
  typed('leite', 'Café com ___.', 'Coffee with milk.', ['leite'], [PAD('cafe_com_leite')]),
  typed('pao', 'Um ___ de queijo, por favor.', 'A cheese bread, please.', ['pão'], [PAD('pao'), PAD('pao_de_queijo')]),
  typed('agua', 'Um copo de ___ gelada.', 'A glass of cold water.', ['água'], [PAD('agua')]),
  typed('oi', '___, tudo bem?', 'Hi, how are you?', ['oi', 'olá'], [SOC('oi'), SOC('ola')]),
  typed('tchau', 'Até amanhã! ___!', 'See you tomorrow! Bye!', ['tchau'], [SOC('tchau')]),
  typed('bem', 'Tudo ___?', 'How’s it going?', ['bem'], [SOC('tudo_bem')]),
  typed('obrigado', '___ pela água!', 'Thanks for the water!', ['obrigado'], [SOC('obrigado')]),
  typed('quanto', '___ custa o pão?', 'How much is the bread?', ['quanto']),
  typed('padaria', 'O pão fresco está na ___.', 'The fresh bread is at the bakery.', ['padaria']),
  typed('feira', 'Amanhã tem ___ na praça.', 'Tomorrow there’s a street market in the square.', ['feira']),
  typed('num_tres', 'Escreva o número 3 por extenso.', 'Write the number 3 in words.', ['três'], [NUM(3)]),
  typed('num_quatro', 'Escreva o número 4 por extenso.', 'Write the number 4 in words.', ['quatro'], [NUM(4)]),
  typed('num_sete', 'Escreva o número 7 por extenso.', 'Write the number 7 in words.', ['sete'], [NUM(7)]),
  typed('num_oito', 'Escreva o número 8 por extenso.', 'Write the number 8 in words.', ['oito'], [NUM(8)]),
  typed('num_dez', 'Escreva o número 10 por extenso.', 'Write the number 10 in words.', ['dez'], [NUM(10)]),
  typed('num_doze', 'Escreva o número 12 por extenso.', 'Write the number 12 in words.', ['doze'], [NUM(12)]),

  // ---- reorder: build the sentence
  reorder('cafe', '“A coffee, please.”', ['Um', 'café,', 'por', 'favor.'], [PAD('cafe'), PAD('por_favor')]),
  reorder('pastel', '“I want a pastry.”', ['Eu', 'quero', 'um', 'pastel.'], [PAD('pastel')]),
  reorder('quanto', '“How much is the bread?”', ['Quanto', 'custa', 'o', 'pão?'], [PAD('pao')]),
  reorder('onde', '“Where is the bakery?”', ['Onde', 'fica', 'a', 'padaria?']),
  reorder('nome', '“My name is Ana.”', ['Meu', 'nome', 'é', 'Ana.']),
  reorder('gosto', '“I like coffee with milk.”', ['Eu', 'gosto', 'de', 'café', 'com', 'leite.'], [PAD('cafe_com_leite')]),
  reorder('feira', '“The market is tomorrow.”', ['A', 'feira', 'é', 'amanhã.']),
  reorder('bom_dia', '“Good morning, how are you?”', ['Bom', 'dia,', 'tudo', 'bem?'], [SOC('bom_dia'), SOC('tudo_bem')]),
  reorder('obrigado', '“Thanks for the help!”', ['Obrigado', 'pela', 'ajuda!'], [SOC('obrigado')]),
  reorder('quente', '“The coffee is nice and hot.”', ['O', 'café', 'está', 'bem', 'quente.'], [PAD('bem_quente'), PAD('cafe')]),
  reorder('sou', '“I’m from Brazil.”', ['Eu', 'sou', 'do', 'Brasil.']),
  reorder('agua_suco', '“Do you want water or juice?”', ['Você', 'quer', 'água', 'ou', 'suco?'], [PAD('agua')]),
  reorder('noite', '“Good night, see you tomorrow!”', ['Boa', 'noite,', 'até', 'amanhã!'], [SOC('boa_noite')]),
  reorder('paes', '“Two cheese breads, please.”', ['Dois', 'pães', 'de', 'queijo,', 'por', 'favor.'], [PAD('pao_de_queijo'), NUM(2)]),

  // ---- listening: hear a phrase (a prebaked clip), pick it
  listen('bom_dia', 'Bom dia', ['Bom dia', 'Boa noite', 'Boa tarde', 'Tchau'], [SOC('bom_dia')]),
  listen('boa_tarde', 'Boa tarde', ['Boa tarde', 'Bom dia', 'Boa noite', 'Olá'], [SOC('boa_tarde')]),
  listen('de_nada', 'De nada', ['De nada', 'Tchau', 'Beleza', 'Olá'], [SOC('de_nada')]),
  listen('tudo_bem', 'Tudo bem?', ['Tudo bem?', 'Bom dia', 'Beleza', 'Tchau'], [SOC('tudo_bem')]),
  listen('cafe_leite', 'café com leite', ['café com leite', 'suco de laranja', 'pão na chapa', 'pão de queijo'], [PAD('cafe_com_leite')]),
  listen('pao_queijo', 'pão de queijo', ['pão de queijo', 'pão na chapa', 'pãozinho', 'misto-quente'], [PAD('pao_de_queijo')]),
  listen('pastel', 'pastel', ['pastel', 'coxinha', 'bolo', 'pãozinho'], [PAD('pastel')]),
  listen('me_ve_pastel', 'Me vê um pastel.', ['Me vê um pastel.', 'Me vê uma coxinha.', 'Me vê um bolo pra comer aqui.', 'Me vê um pão na chapa.'], [PAD('me_ve'), PAD('pastel')]),
  listen('agua', 'Uma água, por favor.', ['Uma água, por favor.', 'Um suco de laranja, por favor.', 'Um café e uma água.', 'Dois pães na chapa.'], [PAD('agua'), PAD('por_favor')]),
  listen('dois_paes', 'Dois pães na chapa.', ['Dois pães na chapa.', 'Três pães e uma água.', 'Uma coxinha e um suco de laranja.', 'Um café e uma água.'], [NUM(2), PAD('pao_na_chapa')]),
  listen('cafe_acucar', 'Café sem açúcar, bem quente.', ['Café sem açúcar, bem quente.', 'Me vê um pão na chapa pra viagem.', 'Uma coxinha e um suco de laranja.', 'Três pães e uma água.'], [PAD('sem_acucar'), PAD('bem_quente')]),
  listen('viagem', 'pra viagem', ['pra viagem', 'pra comer aqui', 'sem açúcar', 'bem quente'], [PAD('pra_viagem')]),
  listen('volte', 'Volte sempre.', ['Volte sempre.', 'Pode pegar.', 'Isso aí.', 'Pronto.'], [PAD('volte_sempre')]),
  listen('num_doze', 'doze', ['12|twelve', '2|two', '20|twenty', '10|ten'], [NUM(12)]),
  listen('num_quinze', 'quinze', ['15|fifteen', '5|five', '11|eleven', '13|thirteen'], [NUM(15)]),
  listen('num_sete', 'sete', ['7|seven', '6|six', '8|eight', '9|nine'], [NUM(7)]),
  listen('num_vinte', 'vinte', ['20|twenty', '12|twelve', '10|ten', '18|eighteen'], [NUM(20)]),
  listen('num_tres', 'três', ['3|three', '13|thirteen', '6|six', '4|four'], [NUM(3)]),
];

/** Longer sentences for the finalização (6-7 words, one tight timer). */
const FINISH_REORDERS: ChallengeItem[] = [
  reorder('cafe_leite', '“A coffee with milk, please.”', ['Me vê', 'um', 'café', 'com', 'leite,', 'por favor.'], [PAD('me_ve'), PAD('cafe_com_leite')], 3),
  reorder('quanto_queijo', '“How much is the cheese bread?”', ['Quanto', 'custa', 'o', 'pão', 'de', 'queijo?'], [PAD('pao_de_queijo')], 3),
  reorder('boa_tarde', '“Good afternoon! How are you?”', ['Boa', 'tarde!', 'Tudo', 'bem', 'com', 'você?'], [SOC('boa_tarde'), SOC('tudo_bem')], 3),
  reorder('suco', '“I like cold orange juice.”', ['Eu', 'gosto', 'de', 'suco', 'de', 'laranja', 'gelado.'], [PAD('suco_de_laranja')], 3),
  reorder('feira', '“Where is the market in the square?”', ['Onde', 'fica', 'a', 'feira', 'da', 'praça?'], [], 3),
  reorder('dois_tres', '“Two coffees and three rolls, please.”', ['Dois', 'cafés', 'e', 'três', 'pães,', 'por', 'favor.'], [NUM(2), NUM(3), PAD('pao')], 3),
];

export const challengeBank = (): readonly ChallengeItem[] => BANK;
export const finishBank = (): readonly ChallengeItem[] => FINISH_REORDERS;
export const challengeById = (id: string): ChallengeItem | undefined => BANK.find((c) => c.id === id) ?? FINISH_REORDERS.find((c) => c.id === id);

// ---------------------------------------------------------------- instances (what the server holds) and views (what the client gets)

export type BoutAnswer = { kind: 'choice'; index: number } | { kind: 'order'; order: number[] } | { kind: 'text'; text: string };

export interface ChallengeInstance {
  item: ChallengeItem;
  /** view option i shows source option `perm[i]` (source 0 is the correct one) */
  perm: number[];
  /** reorder: the shuffled tokens (`i` is the index in the correct order) */
  tokens: { i: number; pt: string }[];
}

export interface ChallengeView {
  id: string;
  kind: ChallengeKind;
  prompt: Bilingual;
  options?: Bilingual[];
  tokens?: { i: number; pt: string }[];
  /** listening: the Portuguese phrase to speak (the client uses the speech path) */
  listenPt?: string;
  /** typed: how many characters fit */
  maxLen?: number;
  /** CI only (TB_TEST_ROLL=1): the correct answer in the shape the client sends */
  debugCorrect?: number | number[] | string;
}

function shuffled(rng: Rng, n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [a[k], a[j]] = [a[j]!, a[k]!];
  }
  return a;
}

export function instantiate(item: ChallengeItem, rng: Rng): ChallengeInstance {
  const perm = item.options ? shuffled(rng, item.options.length) : [];
  let order = item.words ? shuffled(rng, item.words.length) : [];
  // a reorder that comes out already solved is no puzzle
  for (let tries = 0; item.words && order.every((v, i) => v === i) && tries < 8; tries++) order = shuffled(rng, item.words.length);
  return { item, perm, tokens: order.map((i) => ({ i, pt: item.words![i]! })) };
}

export function viewOf(inst: ChallengeInstance, debug = false): ChallengeView {
  const { item } = inst;
  const v: ChallengeView = { id: item.id, kind: item.kind, prompt: item.prompt };
  if (item.options) v.options = inst.perm.map((i) => item.options![i]!);
  if (item.kind === 'reorder') v.tokens = inst.tokens;
  if (item.listenPt) v.listenPt = item.listenPt;
  if (item.kind === 'typed') v.maxLen = 24;
  if (debug) v.debugCorrect = item.kind === 'reorder' ? item.words!.map((_, i) => i) : item.kind === 'typed' ? item.accept![0]! : inst.perm.indexOf(0);
  return v;
}

export function checkAnswer(inst: ChallengeInstance, a: BoutAnswer): boolean {
  const { item } = inst;
  if (item.kind === 'reorder') {
    if (a.kind !== 'order' || !item.words) return false;
    const n = item.words.length;
    return a.order.length === n && a.order.every((v, i) => Number.isInteger(v) && v === i);
  }
  if (item.kind === 'typed') {
    if (a.kind !== 'text' || typeof a.text !== 'string') return false;
    const text = a.text.slice(0, 40);
    // "Escreva o número 3" must not be answered with a 3
    if (/\d/.test(text)) return false;
    const got = normalizeAnswer(text);
    return !!got && (item.accept ?? []).some((w) => normalizeAnswer(w) === got);
  }
  if (a.kind !== 'choice' || !item.options) return false;
  return Number.isInteger(a.index) && a.index >= 0 && a.index < inst.perm.length && inst.perm[a.index] === 0;
}

// ---------------------------------------------------------------- the pick

export interface PickOptions {
  kinds: Partial<Record<ChallengeKind, number>>;
  used?: ReadonlySet<string>;
  caderno?: Caderno;
  /** false when the player has sound off (no listening items) */
  canListen?: boolean;
  pool?: readonly ChallengeItem[];
}

/** Share of the item's Caderno cards the player has NOT learned yet (0..1; items with no cards count as 0.3 so they still turn up). */
export function unlearnedShare(item: ChallengeItem, caderno?: Caderno): number {
  const ids = (item.cards ?? []).filter((id) => cardById(id));
  if (!ids.length) return 0.3;
  const open = ids.filter((id) => !isLearned(caderno?.[id])).length;
  return open / ids.length;
}

/** Weight of an item: its kind's weight, times 1 (all learned) up to 4 (nothing learned yet). */
export function itemWeight(item: ChallengeItem, kinds: PickOptions['kinds'], caderno?: Caderno): number {
  const k = kinds[item.kind] ?? 0;
  return k <= 0 ? 0 : k * (1 + 3 * unlearnedShare(item, caderno));
}

export function pickChallenge(rng: Rng, opts: PickOptions): ChallengeItem {
  const pool = opts.pool ?? BANK;
  const usable = (strict: boolean) =>
    pool.filter((it) => (opts.canListen !== false || it.kind !== 'listening') && (!strict || !opts.used?.has(it.id)));
  let list = usable(true);
  let weights = list.map((it) => itemWeight(it, opts.kinds, opts.caderno));
  if (!weights.some((w) => w > 0)) {
    // everything of those kinds was used: allow repeats before giving up on the kinds
    list = usable(false);
    weights = list.map((it) => itemWeight(it, opts.kinds, opts.caderno));
  }
  if (!weights.some((w) => w > 0)) {
    list = usable(false);
    weights = list.map(() => 1);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return list[i]!;
  }
  return list[list.length - 1]!;
}
