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

export const SUBMISSION_LABELS: Record<'player' | 'cpu', Bilingual[]> = {
  player: [
    { pt: 'Chave de braço', en: 'Arm lock' },
    { pt: 'Triângulo', en: 'Triangle choke' },
    { pt: 'Kimura', en: 'Kimura' },
  ],
  cpu: [
    { pt: 'Mata-leão', en: 'Rear naked choke' },
    { pt: 'Guilhotina', en: 'Guillotine' },
    { pt: 'Kimura', en: 'Kimura' },
  ],
};

/** Gold HUD submission accent by mat position (overrides seat-index rotation). */
export const POSITION_SUBMISSION_ACCENT: Partial<Record<BjjPositionId, Bilingual>> = {
  de_pe: { pt: 'Guilhotina', en: 'Guillotine' },
  guarda_fechada: { pt: 'Guilhotina', en: 'Guillotine' },
  meia_guarda: { pt: 'Guilhotina', en: 'Guillotine' },
  costas: { pt: 'Mata-leão', en: 'Rear naked choke' },
};

function submissionHintForSeat(
  side: 'player' | 'cpu',
  positionId: BjjPositionId,
  seatIdx: number,
): Bilingual | null {
  if (seatIdx < ROLL_FINISH_INDEX) return null;
  const accent = POSITION_SUBMISSION_ACCENT[positionId];
  if (accent) return accent;
  const labels = SUBMISSION_LABELS[side];
  return labels[seatIdx % labels.length];
}

export type RollPuzzleKind = 'cloze' | 'technique' | 'reorder';

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
    id: 'cloze_obrigado',
    kind: 'cloze',
    prompt: { pt: '___ , professor!', en: '___ , coach! (thanks)' },
    options: [
      { pt: 'Obrigado', en: 'Thank you (m.)' },
      { pt: 'Por favor', en: 'Please' },
      { pt: 'Desculpa', en: 'Sorry' },
      { pt: 'Tchau', en: 'Bye' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_permissao',
    kind: 'cloze',
    prompt: { pt: 'Com ___!', en: 'With ___! (may I?)' },
    options: [
      { pt: 'permissão', en: 'permission' },
      { pt: 'fome', en: 'hunger' },
      { pt: 'pressa', en: 'hurry' },
      { pt: 'sorte', en: 'luck' },
    ],
    correct: 0,
  },
  {
    id: 'cloze_valeu',
    kind: 'cloze',
    prompt: { pt: '___ pela rola!', en: '___ for the roll!' },
    options: [
      { pt: 'Valeu', en: 'Thanks (informal)' },
      { pt: 'Parabéns', en: 'Congrats' },
      { pt: 'Cuidado', en: 'Careful' },
      { pt: 'Calma', en: 'Easy' },
    ],
    correct: 0,
  },
  {
    id: 'tech_chave',
    kind: 'technique',
    prompt: { pt: 'Qual é a chave de braço?', en: 'Which one is the arm lock?' },
    options: [
      { pt: 'Chave de braço', en: 'Arm lock' },
      { pt: 'Triângulo', en: 'Triangle' },
      { pt: 'Mata-leão', en: 'Rear naked choke' },
      { pt: 'Guilhotina', en: 'Guillotine' },
    ],
    correct: 0,
  },
  {
    id: 'tech_triangulo',
    kind: 'technique',
    prompt: { pt: 'Triângulo é…', en: '“Triângulo” is…' },
    options: [
      { pt: 'um estrangulamento de pernas', en: 'a leg choke' },
      { pt: 'um abraço', en: 'a hug' },
      { pt: 'um cumprimento', en: 'a greeting' },
      { pt: 'um aquecimento', en: 'a warm-up only' },
    ],
    correct: 0,
  },
  {
    id: 'tech_mata',
    kind: 'technique',
    prompt: { pt: 'Mata-leão costuma sair das…', en: 'Rear naked choke often comes from…' },
    options: [
      { pt: 'costas', en: 'back control' },
      { pt: 'de pé', en: 'standing only' },
      { pt: 'guarda fechada', en: 'closed guard only' },
      { pt: 'banheiro', en: 'restroom' },
    ],
    correct: 0,
  },
  {
    id: 'reorder_treinar',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Posso', 'treinar', 'com', 'você?'],
    correctOrder: [0, 1, 2, 3],
    correct: 0,
  },
  {
    id: 'reorder_oss',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Oss!', 'Boa', 'rola!'],
    correctOrder: [0, 1, 2],
    correct: 0,
  },
  {
    id: 'reorder_prof',
    kind: 'reorder',
    prompt: { pt: 'Monte a frase:', en: 'Build the sentence:' },
    words: ['Obrigado', 'pela', 'aula,', 'professor!'],
    correctOrder: [0, 1, 2, 3],
    correct: 0,
  },
];

export function puzzleById(id: string): RollPuzzle | undefined {
  return PUZZLE_BANK.find((p) => p.id === id);
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
  return { pt: 'Oss! Com respeito — boa rola!', en: 'Oss! With respect — good roll!' };
}

export function rollTapLine(winner: 'player' | 'cpu'): Bilingual {
  if (winner === 'player') return { pt: 'Tap! Você pegou a finalização!', en: 'Tap! You got the submission!' };
  return { pt: 'Tap! Boa pressão — amanhã tem mais.', en: 'Tap! Good pressure — see you tomorrow.' };
}

export function rollDecisaoLine(winner: 'player' | 'cpu' | 'draw'): Bilingual {
  if (winner === 'player') return { pt: 'Decisão: você estava na melhor posição!', en: 'Decision: you had the better position!' };
  if (winner === 'cpu') return { pt: 'Decisão: posição deles. Valeu a rola!', en: 'Decision: their position. Thanks for the roll!' };
  return { pt: 'Empate na decisão. Fist bump!', en: 'Draw on points. Fist bump!' };
}

export function rollFistBump(): Bilingual {
  return { pt: 'Fist bump! Oss — obrigado pela rola.', en: 'Fist bump! Oss — thanks for the roll.' };
}
