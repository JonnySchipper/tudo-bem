/**
 * Academia do Bairro — flagship BJJ roll v0 (GDD §7).
 * Language duels on real positions; first submission wins. Pure logic for server + tests.
 */
import type { Bilingual } from './types.js';
import type { Rng } from './meveum.js';
import { mulberry32 } from './meveum.js';

/** Short queue — v0 magnet is CPU solo roll (humans later). Override with `ROLL_QUEUE_MS`. */
export const ROLL_QUEUE_MS_DEFAULT = 6_000;
export const ROLL_MAX_DUELS = 10;
export const ROLL_RV_WIN = 12;
export const ROLL_RV_LOSS = 5;
/** Finishing seat index (montada / costas). Win from here = submission. */
export const ROLL_FINISH_INDEX = 4;

export type BjjPositionId =
  | 'de_pe'
  | 'guarda_fechada'
  | 'meia_guarda'
  | 'cem_quilos'
  | 'joelho'
  | 'montada'
  | 'costas';

export const PLAYER_POSITIONS: BjjPositionId[] = ['de_pe', 'guarda_fechada', 'cem_quilos', 'joelho', 'montada'];
export const CPU_POSITIONS: BjjPositionId[] = ['de_pe', 'meia_guarda', 'cem_quilos', 'joelho', 'costas'];

export const POSITION_LABELS: Record<BjjPositionId, Bilingual> = {
  de_pe: { pt: 'De pé', en: 'Standing' },
  guarda_fechada: { pt: 'Guarda fechada', en: 'Closed guard' },
  meia_guarda: { pt: 'Meia-guarda', en: 'Half guard' },
  cem_quilos: { pt: 'Cem quilos', en: 'Side control' },
  joelho: { pt: 'Joelho na barriga', en: 'Knee on belly' },
  montada: { pt: 'Montada', en: 'Mount' },
  costas: { pt: 'Costas', en: 'Back control' },
};

/** Neutral bout-step chrome at finishing seats — not BJJ technique trivia (Product B). */
export const BOUT_STEP_CHROME: Bilingual[] = [
  { pt: 'Vantagem', en: 'Advantage' },
  { pt: 'Pressão', en: 'Pressure' },
  { pt: 'Quase lá', en: 'Almost there' },
  { pt: 'Virada', en: 'Turn' },
  { pt: 'Final', en: 'Finish' },
];

function submissionHintForSeat(_side: 'player' | 'cpu', _positionId: BjjPositionId, seatIdx: number): Bilingual | null {
  if (seatIdx < ROLL_FINISH_INDEX) return null;
  return BOUT_STEP_CHROME[Math.min(seatIdx, BOUT_STEP_CHROME.length - 1)];
}

/** Learner-facing step for the leading seat. Pose ids stay internal. */
export function rollChromeLabel(playerIdx: number, cpuIdx: number): Bilingual {
  const seat = Math.max(0, Math.min(Math.max(playerIdx, cpuIdx), BOUT_STEP_CHROME.length - 1));
  return BOUT_STEP_CHROME[seat];
}

/** Portuguese-learning prompts only — no BJJ technique trivia (CEO lock). */
export type RollPuzzleKind = 'cloze' | 'choice' | 'reorder';

export interface RollPuzzle {
  id: string;
  kind: RollPuzzleKind;
  prompt: Bilingual;
  options?: Bilingual[];
  correct: number;
  words?: string[];
  correctOrder?: number[];
}

/** Wire-safe puzzle (no answer). */
export interface RollPuzzleView {
  id: string;
  kind: RollPuzzleKind;
  prompt: Bilingual;
  options?: Bilingual[];
  /** Shuffled tokens; each entry is `{ i: sourceIndex, pt: string }`. */
  tokens?: { i: number; pt: string }[];
}

export type RollAnswer =
  | { kind: 'choice'; index: number }
  | { kind: 'reorder'; order: number[] };

export interface BjjProgress {
  belt: 'branca';
  stripes: number;
  wins: number;
}

/** v0: always faixa branca — stripes/wins only; never promote past branca in this bake. */
export function normalizeBjj(p?: BjjProgress | null): BjjProgress {
  const wins = Math.max(0, Number(p?.wins) || 0);
  const stripes = Math.min(4, Math.max(0, Number.isFinite(p?.stripes) ? Number(p!.stripes) : stripesForWins(wins)));
  return { belt: 'branca', stripes, wins };
}

/** Shown in Academia UI — word game, not martial-arts training (CEO / Product lock). */
export const ROLL_WORD_GAME_DISCLAIMER: Bilingual = {
  pt: 'Jogo de palavras com kimono — aprende o português da academia, não é treino de luta.',
  en: 'A word game in a gi — learn academy Portuguese, not real martial-arts training.',
};

export const ROLL_CPU_PARTNER = { name: 'Rafael', pt: 'Rafael (CPU)', en: 'Rafael (CPU partner)' };

export function stripesForWins(wins: number): number {
  return Math.min(4, Math.floor(wins / 3));
}

export function rollPuzzleTimeMs(rng: Rng): number {
  return 8000 + Math.floor(rng() * 6001);
}

const PUZZLE_BANK: RollPuzzle[] = [
  {
    id: 'cloze_ola',
    kind: 'cloze',
    prompt: { pt: '___ , tudo bem?', en: '___ , how are you? (hi)' },
    options: [
      { pt: 'Olá', en: 'Hello' },
      { pt: 'Adeus', en: 'Farewell' },
      { pt: 'Desculpa', en: 'Sorry' },
      { pt: 'Calma', en: 'Easy' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_bom_dia',
    kind: 'cloze',
    prompt: { pt: '___ dia!', en: '___ day! (good morning)' },
    options: [
      { pt: 'Bom', en: 'Good (m.)' },
      { pt: 'Boa', en: 'Good (f.)' },
      { pt: 'Boas', en: 'Good (f. pl.)' },
      { pt: 'Belo', en: 'Beautiful (m.)' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_me_ve',
    kind: 'cloze',
    prompt: { pt: '___ um café, por favor.', en: '___ a coffee, please. (bakery ask)' },
    options: [
      { pt: 'Me vê', en: 'Can I have (lit. “see me”)' },
      { pt: 'Me dá logo', en: 'Give me already' },
      { pt: 'Eu quero ver', en: 'I want to see' },
      { pt: 'Olha só', en: 'Look here' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_boa_tarde',
    kind: 'cloze',
    prompt: { pt: '___ tarde, galera!', en: '___ afternoon, everyone!' },
    options: [
      { pt: 'Boa', en: 'Good (f.)' },
      { pt: 'Bom', en: 'Good (m.)' },
      { pt: 'Bem', en: 'Well' },
      { pt: 'Bons', en: 'Good (m. pl.)' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_tchau',
    kind: 'cloze',
    prompt: { pt: 'Até amanhã! ___ !', en: 'See you tomorrow! ___ ! (bye)' },
    options: [
      { pt: 'Tchau', en: 'Bye' },
      { pt: 'Olá', en: 'Hello' },
      { pt: 'Por favor', en: 'Please' },
      { pt: 'Obrigado', en: 'Thanks' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_por_favor',
    kind: 'cloze',
    prompt: { pt: 'Um café, ___ .', en: 'A coffee, ___ . (please)' },
    options: [
      { pt: 'por favor', en: 'please' },
      { pt: 'por conta', en: 'on the house' },
      { pt: 'com pressa', en: 'in a hurry' },
      { pt: 'sem açúcar', en: 'no sugar' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_obrigada',
    kind: 'cloze',
    prompt: { pt: '___ pela água!', en: '___ for the water! (thanks, f.)' },
    options: [
      { pt: 'Obrigada', en: 'Thank you (f.)' },
      { pt: 'Obrigado', en: 'Thank you (m.)' },
      { pt: 'Por favor', en: 'Please' },
      { pt: 'Desculpa', en: 'Sorry' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_de_nada',
    kind: 'cloze',
    prompt: { pt: 'De ___ !', en: 'You’re welcome! (lit. “of nothing”)' },
    options: [
      { pt: 'nada', en: 'nothing' },
      { pt: 'verdade', en: 'truth' },
      { pt: 'repente', en: 'sudden' },
      { pt: 'vez', en: 'time' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_dois_cafes',
    kind: 'cloze',
    prompt: { pt: '___ cafés, por favor.', en: '___ coffees, please.' },
    options: [
      { pt: 'Dois', en: 'Two' },
      { pt: 'Duas', en: 'Two (f.)' },
      { pt: 'Doze', en: 'Twelve' },
      { pt: 'Duzentos', en: 'Two hundred' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_tres_reais',
    kind: 'cloze',
    prompt: { pt: 'São ___ reais.', en: 'It’s ___ reais.' },
    options: [
      { pt: 'três', en: 'three' },
      { pt: 'treze', en: 'thirteen' },
      { pt: 'trinta', en: 'thirty' },
      { pt: 'tres', en: 'three (no accent — wrong)' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_quanto',
    kind: 'cloze',
    prompt: { pt: '___ custa o pão?', en: '___ does the bread cost?' },
    options: [
      { pt: 'Quanto', en: 'How much' },
      { pt: 'Quantos', en: 'How many (m.)' },
      { pt: 'Quando', en: 'When' },
      { pt: 'Qual', en: 'Which' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_um_pao',
    kind: 'cloze',
    prompt: { pt: 'Um ___ de queijo, por favor.', en: 'One cheese ___, please.' },
    options: [
      { pt: 'pão', en: 'bread / roll' },
      { pt: 'copo', en: 'cup' },
      { pt: 'prato', en: 'plate' },
      { pt: 'mapa', en: 'map' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_com_leite',
    kind: 'cloze',
    prompt: { pt: 'Café com ___.', en: 'Coffee with ___.' },
    options: [
      { pt: 'leite', en: 'milk' },
      { pt: 'sal', en: 'salt' },
      { pt: 'gelo só', en: 'ice only' },
      { pt: 'farinha', en: 'flour' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_feira',
    kind: 'cloze',
    prompt: { pt: 'Amanhã tem ___ na praça.', en: 'Tomorrow there’s a ___ in the square.' },
    options: [
      { pt: 'feira', en: 'street market' },
      { pt: 'padaria', en: 'bakery' },
      { pt: 'academia', en: 'gym' },
      { pt: 'festa', en: 'party' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_padaria',
    kind: 'cloze',
    prompt: { pt: 'O pão fresco está na ___.', en: 'Fresh bread is at the ___.' },
    options: [
      { pt: 'padaria', en: 'bakery' },
      { pt: 'feira', en: 'market' },
      { pt: 'praça', en: 'square' },
      { pt: 'rua', en: 'street' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_com_licenca',
    kind: 'cloze',
    prompt: { pt: '___ ! Posso passar?', en: '___ ! May I pass? (excuse me)' },
    options: [
      { pt: 'Com licença', en: 'Excuse me' },
      { pt: 'Com fome', en: 'Hungry' },
      { pt: 'Com sorte', en: 'Lucky' },
      { pt: 'Com pressa', en: 'In a hurry' },
    ],
    correct: 0,
  },
  {
    id: 'lex_pao_chapa',
    kind: 'choice',
    prompt: { pt: 'Qual é o pão na chapa?', en: 'Which one is pão na chapa?' },
    options: [
      { pt: 'pão na chapa', en: 'griddled bread roll' },
      { pt: 'pão doce', en: 'sweet bread' },
      { pt: 'bolo de pote', en: 'jar cake' },
      { pt: 'água com gás', en: 'sparkling water' },
    ],
    correct: 0,
  },
  {
    id: 'lex_suco',
    kind: 'choice',
    prompt: { pt: 'Suco de ___ é bem comum na padaria.', en: '___ juice is common at the bakery.' },
    options: [
      { pt: 'laranja', en: 'orange' },
      { pt: 'cebola', en: 'onion' },
      { pt: 'feijão', en: 'bean' },
      { pt: 'queijo', en: 'cheese' },
    ],
    correct: 0,
  },
  {
    id: 'lex_numero_dois',
    kind: 'choice',
    prompt: { pt: 'Como se diz 2?', en: 'How do you say 2?' },
    options: [
      { pt: 'dois', en: 'two' },
      { pt: 'doze', en: 'twelve' },
      { pt: 'vinte', en: 'twenty' },
      { pt: 'duo', en: 'duo (not Portuguese)' },
    ],
    correct: 0,
  },
  {
    id: 'reorder_me_ve_cafe',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Me vê', 'um', 'café', 'por favor.'],
    correctOrder: [0, 1, 2, 3],
    correct: 0,
  },
  {
    id: 'reorder_tudo_bem',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Tudo', 'bem?'],
    correctOrder: [0, 1],
    correct: 0,
  },
  {
    id: 'reorder_obrigado_pao',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Obrigado', 'pelo', 'pão!'],
    correctOrder: [0, 1, 2],
    correct: 0,
  },
  {
    id: 'reorder_dois_cafes',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Dois', 'cafés,', 'por', 'favor.'],
    correctOrder: [0, 1, 2, 3],
    correct: 0,
  },
  {
    id: 'reorder_feira',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['A', 'feira', 'é', 'amanhã.'],
    correctOrder: [0, 1, 2, 3],
    correct: 0,
  },
];

export function puzzleById(id: string): RollPuzzle | undefined {
  return PUZZLE_BANK.find((p) => p.id === id);
}

/** Test / QA hook — full roll puzzle bank (Portuguese learning only). */
export function rollPuzzleBank(): readonly RollPuzzle[] {
  return PUZZLE_BANK;
}

function shuffleTokens(rng: Rng, words: string[]): { i: number; pt: string }[] {
  const arr = words.map((pt, i) => ({ i, pt }));
  for (let k = arr.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

export function makeRollPuzzle(rng: Rng, used: Set<string>): RollPuzzle {
  const pool = PUZZLE_BANK.filter((p) => !used.has(p.id));
  const pick = pool.length ? pool[Math.floor(rng() * pool.length)] : PUZZLE_BANK[Math.floor(rng() * PUZZLE_BANK.length)];
  used.add(pick.id);
  return pick;
}

export function toPuzzleView(rng: Rng, puzzle: RollPuzzle): RollPuzzleView {
  if (puzzle.kind === 'reorder' && puzzle.words) {
    return {
      id: puzzle.id,
      kind: puzzle.kind,
      prompt: puzzle.prompt,
      tokens: shuffleTokens(rng, puzzle.words),
    };
  }
  return {
    id: puzzle.id,
    kind: puzzle.kind,
    prompt: puzzle.prompt,
    options: puzzle.options?.map((o) => ({ pt: o.pt, en: o.en })),
  };
}

export function checkRollAnswer(puzzle: RollPuzzle, answer: RollAnswer): boolean {
  if (puzzle.kind === 'reorder') {
    if (answer.kind !== 'reorder' || !puzzle.correctOrder) return false;
    const a = answer.order;
    const b = puzzle.correctOrder;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (puzzle.kind !== 'cloze' && puzzle.kind !== 'choice') return false;
  if (answer.kind !== 'choice' || puzzle.options == null) return false;
  return answer.index === puzzle.correct;
}

export function displayPosition(playerIdx: number, cpuIdx: number): { position: BjjPositionId; label: Bilingual; submissionHint: Bilingual | null } {
  if (playerIdx > cpuIdx) {
    const id = PLAYER_POSITIONS[Math.min(playerIdx, PLAYER_POSITIONS.length - 1)];
    const hint = submissionHintForSeat('player', id, playerIdx);
    return { position: id, label: POSITION_LABELS[id], submissionHint: hint };
  }
  if (cpuIdx > playerIdx) {
    const id = CPU_POSITIONS[Math.min(cpuIdx, CPU_POSITIONS.length - 1)];
    const hint = submissionHintForSeat('cpu', id, cpuIdx);
    return { position: id, label: POSITION_LABELS[id], submissionHint: hint };
  }
  return { position: 'de_pe', label: POSITION_LABELS.de_pe, submissionHint: null };
}

export type DuelAdvance = 'player' | 'cpu' | 'none';

export interface DuelResolution {
  advance: DuelAdvance;
  submission: 'player' | 'cpu' | null;
  playerIdx: number;
  cpuIdx: number;
}

/** First correct wins the scramble; both wrong or both right = stalemate. */
export function resolveDuel(playerCorrect: boolean, cpuCorrect: boolean, playerIdx: number, cpuIdx: number): DuelResolution {
  let advance: DuelAdvance = 'none';
  if (playerCorrect && !cpuCorrect) advance = 'player';
  else if (cpuCorrect && !playerCorrect) advance = 'cpu';

  let p = playerIdx;
  let c = cpuIdx;
  let submission: 'player' | 'cpu' | null = null;

  if (advance === 'player') {
    if (p >= ROLL_FINISH_INDEX) submission = 'player';
    else p++;
  } else if (advance === 'cpu') {
    if (c >= ROLL_FINISH_INDEX) submission = 'cpu';
    else c++;
  }

  return { advance, submission, playerIdx: p, cpuIdx: c };
}

export function decisaoWinner(playerIdx: number, cpuIdx: number): 'player' | 'cpu' | 'draw' {
  if (playerIdx > cpuIdx) return 'player';
  if (cpuIdx > playerIdx) return 'cpu';
  return 'draw';
}

/** CPU rolls with modest accuracy so humans can win flagship rolls. */
export function cpuGetsIt(rng: Rng): boolean {
  return rng() < 0.38;
}

export function rollBow(): Bilingual {
  return { pt: 'Boa! Continua assim.', en: 'Nice! Keep it up.' };
}

export function rollTapLine(winner: 'player' | 'cpu'): Bilingual {
  if (winner === 'player') return { pt: 'Boa! Você chegou no final.', en: 'Nice! You reached the finish.' };
  return { pt: 'Boa pressão — amanhã tem mais.', en: 'Good pressure — see you tomorrow.' };
}

export function rollScrambleLine(advance: 'player' | 'cpu' | 'none'): Bilingual {
  if (advance === 'player') return { pt: 'Você avançou!', en: 'You moved ahead!' };
  if (advance === 'cpu') return { pt: 'Eles avançaram — segura!', en: 'They moved ahead — hang on!' };
  return { pt: 'Empate — mesma etapa.', en: 'Tie — same step.' };
}

export function rollDecisaoLine(winner: 'player' | 'cpu' | 'draw'): Bilingual {
  if (winner === 'player') return { pt: 'Decisão: você estava na melhor posição!', en: 'Decision: you had the better position!' };
  if (winner === 'cpu') return { pt: 'Decisão: vantagem deles. Valeu!', en: 'Decision: their advantage. Thanks!' };
  return { pt: 'Empate na decisão. Valeu!', en: 'Draw on the decision. Thanks!' };
}

export function rollFistBump(): Bilingual {
  return { pt: 'Obrigado pela partida.', en: 'Thanks for the match.' };
}
