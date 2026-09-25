/**
 * Item bank cards (GDD §5.5). Engineering owns the schema; curriculum owns content.
 * Phase 0 ships a tiny A1 padaria + greetings deck, authored in code.
 */
export interface Card {
  id: string;
  form: string;
  plural?: string;
  gender?: 'm' | 'f';
  pos: 'noun' | 'phrase' | 'verb' | 'number';
  tags: string[];
  gloss_en: string;
  gloss_en_plural?: string;
  patterns: string[];
  /** Accent-flexible accepted typed answers. */
  accepts: string[];
  wrongs: string[];
  prereq: string[];
  places: string[];
}

const food = (
  id: string,
  form: string,
  plural: string,
  gender: 'm' | 'f',
  gloss: string,
  glossPlural: string,
  extra: Partial<Card> = {},
): Card => ({
  id: `lex.padaria.${id}`,
  form,
  plural,
  gender,
  pos: 'noun',
  tags: ['food', 'padaria', 'A1'],
  gloss_en: gloss,
  gloss_en_plural: glossPlural,
  patterns: [`Me vê ${gender === 'f' ? 'uma' : 'um'} ${form}, por favor.`],
  accepts: [form, form.normalize('NFD').replace(/[\u0300-\u036f]/g, '')],
  wrongs: [],
  prereq: ['lex.geral.por_favor'],
  places: ['padaria', 'lanchonete'],
  ...extra,
});

export const PADARIA_CARDS: Card[] = [
  food('pao_frances', 'pão francês', 'pães franceses', 'm', 'French roll', 'French rolls', { wrongs: ['pão frances', 'pao francesa'] }),
  food('pao_na_chapa', 'pão na chapa', 'pães na chapa', 'm', 'grilled buttered bread', 'grilled buttered breads'),
  food('pao_de_queijo', 'pão de queijo', 'pães de queijo', 'm', 'cheese bread', 'cheese breads', { wrongs: ['pão de queso'] }),
  food('coxinha', 'coxinha', 'coxinhas', 'f', 'chicken croquette', 'chicken croquettes'),
  food('misto_quente', 'misto-quente', 'mistos-quentes', 'm', 'grilled ham & cheese', 'grilled ham & cheeses'),
  food('sonho', 'sonho', 'sonhos', 'm', 'cream donut (“dream”)', 'cream donuts'),
  food('bolo_de_fuba', 'bolo de fubá', 'bolos de fubá', 'm', 'cornmeal cake', 'cornmeal cakes'),
  food('cafezinho', 'cafezinho', 'cafezinhos', 'm', 'little black coffee', 'little black coffees'),
  food('cafe_com_leite', 'café com leite', 'cafés com leite', 'm', 'coffee with milk', 'coffees with milk'),
  food('suco_de_laranja', 'suco de laranja', 'sucos de laranja', 'm', 'orange juice', 'orange juices'),
  food('guarana', 'guaraná', 'guaranás', 'm', 'guaraná soda', 'guaraná sodas'),
];

export const GREETING_CARDS: Card[] = [
  { id: 'lex.geral.bom_dia', form: 'bom dia', pos: 'phrase', tags: ['greeting', 'A0'], gloss_en: 'good morning', patterns: ['Bom dia!'], accepts: ['bom dia'], wrongs: ['boa dia'], prereq: [], places: ['*'] },
  { id: 'lex.geral.tudo_bem', form: 'tudo bem', pos: 'phrase', tags: ['greeting', 'A0'], gloss_en: 'how’s it going / all good', patterns: ['Tudo bem?', 'Tudo bem, e você?'], accepts: ['tudo bem'], wrongs: [], prereq: [], places: ['*'] },
  { id: 'lex.geral.por_favor', form: 'por favor', pos: 'phrase', tags: ['politeness', 'A0'], gloss_en: 'please', patterns: ['..., por favor.'], accepts: ['por favor'], wrongs: ['per favor'], prereq: [], places: ['*'] },
  { id: 'lex.geral.obrigado', form: 'obrigado / obrigada', pos: 'phrase', tags: ['politeness', 'A0'], gloss_en: 'thank you', patterns: ['Obrigado!', 'Obrigada!'], accepts: ['obrigado', 'obrigada'], wrongs: ['obrigato'], prereq: [], places: ['*'] },
  { id: 'lex.padaria.me_ve', form: 'me vê…', pos: 'phrase', tags: ['ordering', 'A1'], gloss_en: 'give me… (lit. “see me”)', patterns: ['Me vê um pão na chapa, por favor.'], accepts: ['me ve', 'me vê'], wrongs: [], prereq: ['lex.geral.por_favor'], places: ['padaria', 'lanchonete'] },
  { id: 'lex.padaria.so_isso', form: 'só isso', pos: 'phrase', tags: ['ordering', 'A1'], gloss_en: 'that’s all', patterns: ['Não, só isso.'], accepts: ['so isso', 'só isso'], wrongs: [], prereq: [], places: ['padaria'] },
  { id: 'lex.padaria.por_conta_da_casa', form: 'por conta da casa', pos: 'phrase', tags: ['padaria', 'A1'], gloss_en: 'on the house', patterns: ['Hoje é por conta da casa!'], accepts: [], wrongs: [], prereq: [], places: ['padaria'] },
];

export const CARDS: Card[] = [...PADARIA_CARDS, ...GREETING_CARDS];
export const cardById = (id: string) => CARDS.find((c) => c.id === id);
