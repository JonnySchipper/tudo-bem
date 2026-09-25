import type { Appearance, BodyType, BottomStyle, HairStyle, TopStyle, TutorialStep } from './types.js';

export const DEFAULT_ROOM_CAP = 16;
/** Phase 0 is an adult (18+) game. Younger audiences are a later rollout after thorough testing. */
export const MIN_AGE = 18;
export const MAX_NAME_LEN = 16;
export const MAX_CHAT_LEN = 140;
export const BUBBLE_MS = 7000;
/** Milliseconds per orthogonal tile step. Diagonals use STEP_MS * SQRT2. */
export const STEP_MS = 260;

export const SKIN_TONES = ['#f6d7c3', '#eec1a0', '#d9a07a', '#c68a5f', '#a86c45', '#8a5433', '#6b3f24', '#4a2a17'];
export const HAIR_COLORS = ['#1b1210', '#3b2418', '#6a3f22', '#a8662f', '#d8b05a', '#8a8a8a', '#b8325a', '#2f5fa8'];
export const CLOTH_COLORS = [
  '#2e9e5b', // verde bandeira
  '#f2c230', // amarelo
  '#2b5ba8', // azul
  '#e5572f', // laranja-telha
  '#f4efe6', // off-white
  '#2a2a33', // grafite
  '#c23b4e', // vermelho
  '#7a4fb0', // roxo
  '#3aa6a0', // turquesa
  '#e889a8', // rosa
];
export const SHOE_COLORS = ['#f4f4f4', '#222222', '#b5452e', '#2b5ba8', '#f2c230'];

export const BODY_TYPES: BodyType[] = ['esguio', 'medio', 'forte'];
export const HAIR_STYLES: HairStyle[] = ['curto', 'raspado', 'cacheado', 'black', 'longo', 'coque', 'trancas'];
export const TOP_STYLES: TopStyle[] = ['camiseta', 'regata', 'moletom', 'camisa'];
export const BOTTOM_STYLES: BottomStyle[] = ['calca', 'bermuda', 'saia'];

export const LABELS = {
  body: { esguio: 'Esguio', medio: 'Médio', forte: 'Forte' } as Record<BodyType, string>,
  hair: {
    curto: 'Curto',
    raspado: 'Raspado',
    cacheado: 'Cacheado',
    black: 'Black power',
    longo: 'Longo',
    coque: 'Coque',
    trancas: 'Tranças',
  } as Record<HairStyle, string>,
  top: { camiseta: 'Camiseta', regata: 'Regata', moletom: 'Moletom', camisa: 'Camisa' } as Record<TopStyle, string>,
  bottom: { calca: 'Calça', bermuda: 'Bermuda', saia: 'Saia' } as Record<BottomStyle, string>,
};

export const DEFAULT_APPEARANCE: Appearance = {
  body: 'medio',
  skin: 3,
  hair: 'cacheado',
  hairColor: 1,
  top: 'camiseta',
  topColor: 1,
  bottom: 'calca',
  bottomColor: 2,
  shoes: 0,
};

export const TUTORIAL_STEPS: { id: TutorialStep; pt: string; en: string }[] = [
  { id: 'andar', pt: 'Ande pela praça', en: 'Walk around the praça (click the floor)' },
  { id: 'sentar', pt: 'Sente num banco', en: 'Sit on a bench (click it)' },
  { id: 'acenar', pt: 'Dê um oi', en: 'Wave hello (Oi button)' },
  { id: 'conversar', pt: 'Mande uma mensagem', en: 'Send a chat message' },
  { id: 'carlos', pt: 'Tome café com o Seu Carlos', en: 'Have breakfast with Seu Carlos (Padaria)' },
  { id: 'meveum', pt: 'Jogue “Me vê um…”', en: 'Play the “Me vê um…” tray game' },
  { id: 'chapeu', pt: 'Use um chapéu', en: 'Get and wear a hat (Nanda’s stall)' },
  { id: 'cadeira', pt: 'Coloque uma cadeira na kitnet', en: 'Place a chair in your kitnet' },
];

export const ECONOMY = {
  startingCoins: 10,
  tutorialBonus: 25,
  sceneMin: 6,
  sceneMax: 14,
  /** Full payouts per NPC per day before decay. */
  sceneFullPerDay: 2,
  minigameMin: 8,
  minigameMax: 20,
  parrotHintCooldownMs: 45_000,
};

export const CHAT_RATE = { windowMs: 10_000, max: 5 };

/** Age in whole years from birth month (1–12) and year. */
export function ageFrom(birthYear: number, birthMonth: number, now = new Date()): number {
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth) age--;
  return age;
}
