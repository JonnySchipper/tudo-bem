import type { Appearance, BodyType, BottomStyle, ExtraStyle, FaceStyle, HairStyle, IdlePose, TopStyle, TutorialStep } from './types.js';

export const DEFAULT_ROOM_CAP = 16;
/** Phase 0 is an adult (18+) game. Younger audiences are a later rollout after thorough testing. */
export const MIN_AGE = 18;
export const MAX_NAME_LEN = 16;
export const MAX_CHAT_LEN = 140;
export const BUBBLE_MS = 7000;
/** Milliseconds per orthogonal tile step. Diagonals use STEP_MS * SQRT2. */
export const STEP_MS = 260;

export const SKIN_TONES = ['#f6d7c3', '#eec1a0', '#d9a07a', '#c68a5f', '#a86c45', '#8a5433', '#6b3f24', '#4a2a17'];
export const HAIR_COLORS = ['#1d1716', '#3a241a', '#5f3b22', '#9a5f30', '#cfa65a', '#9c9792', '#a8395f', '#34599a'];
/** Fashion-muted street colors (palette.md warmth, no cartoon primaries). Indices are stable across saves. */
export const CLOTH_COLORS = [
  '#3a8a5c', // verde
  '#e0ae3c', // mostarda
  '#3d5d8f', // jeans
  '#c9582c', // terracota
  '#eee6d9', // off-white
  '#34343c', // grafite
  '#b03a46', // vermelho-tijolo
  '#6e4e8f', // ameixa
  '#2e8a86', // petróleo
  '#d98a9b', // rosa antigo
  '#b89a6c', // cáqui
  '#66753f', // oliva
  '#e07a5f', // coral (mural-coral)
];
export const SHOE_COLORS = ['#f1eee8', '#26252a', '#b5452e', '#34599a', '#e0b23a'];

/** Wave 2 CPU garb pieces (client art: characters.ts GARBS). A CPU's `Appearance.garb` is one or more of these joined by '+'. */
export const GARB_IDS = ['jersey_alvinegro', 'jersey_verde', 'jaqueta', 'macacao', 'chinelo', 'mochila', 'caixa', 'sacola', 'carrinho', 'balde'] as const;
export const garbParts = (g: string | undefined): string[] => (g ? g.split('+').filter((p) => (GARB_IDS as readonly string[]).includes(p)) : []);

export const BODY_TYPES: BodyType[] = ['esguio', 'medio', 'forte'];
export const HAIR_STYLES: HairStyle[] = ['curto', 'raspado', 'undercut', 'cacheado', 'black', 'ondulado', 'longo', 'coque', 'trancas'];
export const TOP_STYLES: TopStyle[] = ['camiseta', 'blusa', 'camisa', 'moletom', 'regata'];
export const BOTTOM_STYLES: BottomStyle[] = ['calca', 'bermuda', 'saia'];
export const FACE_STYLES: FaceStyle[] = ['suave', 'marcante', 'doce', 'maduro'];
export const EXTRA_STYLES: ExtraStyle[] = ['nenhum', 'oculos', 'barba', 'bigode', 'brincos', 'sardas'];
export const IDLE_POSES: IdlePose[] = ['solto', 'bolsos', 'bracos', 'celular', 'cafe', 'cintura', 'bolsa'];

export const LABELS = {
  body: { esguio: 'Esguio', medio: 'Médio', forte: 'Forte' } as Record<BodyType, string>,
  hair: {
    curto: 'Curto',
    raspado: 'Degradê',
    undercut: 'Undercut',
    ondulado: 'Ondulado',
    cacheado: 'Cacheado',
    black: 'Black power',
    longo: 'Longo',
    coque: 'Coque',
    trancas: 'Tranças',
  } as Record<HairStyle, string>,
  top: { camiseta: 'Camiseta', blusa: 'Blusa', regata: 'Regata', moletom: 'Moletom', camisa: 'Camisa' } as Record<TopStyle, string>,
  bottom: { calca: 'Calça', bermuda: 'Bermuda', saia: 'Saia' } as Record<BottomStyle, string>,
  face: { suave: 'Suave', marcante: 'Marcante', doce: 'Doce', maduro: 'Maduro' } as Record<FaceStyle, string>,
  extra: { nenhum: 'Nenhum', oculos: 'Óculos', barba: 'Barba', bigode: 'Bigode', brincos: 'Brincos', sardas: 'Sardas' } as Record<ExtraStyle, string>,
};

/**
 * One free starter outfit. The creator only applies these clothing fields —
 * hats and further clothes stay on Nanda’s stall. Existing profiles keep whatever they saved.
 */
export const STARTER_OUTFITS: { id: string; pt: string; en: string; set: Pick<Appearance, 'top' | 'topColor' | 'bottom' | 'bottomColor' | 'shoes'> }[] = [
  { id: 'visual_inicial', pt: 'Visual inicial', en: 'Starter outfit', set: { top: 'camiseta', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 0 } },
];

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
  face: 'suave',
  extra: 'nenhum',
  idle: 'solto',
};

export const TUTORIAL_STEPS: { id: TutorialStep; pt: string; en: string }[] = [
  { id: 'andar', pt: 'Ande pela praça', en: 'Walk around the praça (click the floor)' },
  { id: 'sentar', pt: 'Sente num banco', en: 'Sit on a bench (click it)' },
  { id: 'acenar', pt: 'Dê um oi', en: 'Wave hello (Oi button)' },
  { id: 'conversar', pt: 'Mande uma mensagem', en: 'Send a chat message' },
  { id: 'carlos', pt: 'Tome café com o Seu Carlos', en: 'Have breakfast with Seu Carlos (Padaria)' },
  { id: 'meveum', pt: 'Jogue a “Correria no Balcão”', en: 'Play “Correria no Balcão” (Counter Rush)' },
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
