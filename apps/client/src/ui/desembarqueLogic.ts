/**
 * The arrivals hall's guided tutorial (`ROOMS.desembarque`, the first room of every new account), with no DOM: the steps in order, what
 * each one asks for, and which are done. ui/desembarqueTutorial.ts draws the card, pulses the HUD and listens for the player doing it.
 * Instructions are in English (the player has no Portuguese yet); the Portuguese being taught sits next to them. Needs_br: every PT line.
 */
import { DESEMBARQUE_EXIT, DESEMBARQUE_HOST } from '@tudobem/shared';

export type DesembStepId = 'andar' | 'falar' | 'diario' | 'placa' | 'chat' | 'pegar' | 'beber' | 'dinheiro' | 'mapa' | 'fala' | 'porta';

export interface DesembGuide {
  kind: 'npc' | 'prop' | 'portal' | 'hotspot' | 'tile';
  id: string;
  label: string;
  lift: number;
  /** `tile` guides: where. */
  x?: number;
  y?: number;
}

export interface DesembStep {
  id: DesembStepId;
  /** The card's title, in English. */
  en: string;
  /** The Portuguese the step is about (a word, a button's name), shown beside the title. */
  pt: string;
  /** How, on a computer. */
  how: string;
  /** How on a phone, when it differs. */
  phone?: string;
  /** The arrow in the world, or none (a HUD step). */
  guide: DesembGuide | null;
  /** The HUD element(s) the step needs (a selector): they pulse while the step is current. */
  hud?: string;
}

export const DESEMB_STEPS: readonly DesembStep[] = [
  {
    id: 'andar',
    en: 'Walk around',
    pt: 'andar',
    how: 'Click the floor to walk there. Arrow keys or WASD work too.',
    phone: 'Tap the floor to walk there.',
    guide: { kind: 'tile', id: 'janela', x: 8, y: 9, label: 'Walk here · Ande até aqui', lift: 30 },
  },
  {
    id: 'falar',
    en: 'Talk to the flight attendant',
    pt: 'a comissária',
    how: 'Click Lia to talk. Listen: she is about to teach you your first word.',
    phone: 'Tap Lia to talk. Listen: she is about to teach you your first word.',
    guide: { kind: 'npc', id: DESEMBARQUE_HOST, label: 'Talk · Fale com a Lia', lift: 120 },
  },
  {
    id: 'diario',
    en: 'Open your Diário',
    pt: 'o diário',
    how: 'Your word is in the Diário now. Click Diário at the top right to see it.',
    phone: 'Your word is in the Diário now. Tap ☰ at the top, then Diário.',
    guide: null,
    hud: '#btn-caderno, #btn-burger',
  },
  {
    id: 'placa',
    en: 'Read a sign',
    pt: 'a placa',
    how: 'Click the DESEMBARQUE sign. Signs teach you words for reading.',
    phone: 'Tap the DESEMBARQUE sign. Signs teach you words for reading.',
    guide: { kind: 'hotspot', id: 'desemb_s_desembarque', label: 'Read · Leia a placa', lift: 40 },
  },
  {
    id: 'chat',
    en: 'Say hi',
    pt: 'oi!',
    how: 'Type oi in the chat box at the bottom and press Enter, or click 🙂 and pick Oi!. Everyone nearby sees it.',
    phone: 'Type oi in the chat box at the bottom and tap Enviar, or tap 🙂 and pick Oi!.',
    guide: null,
    hud: '#chat-input, #btn-emotes',
  },
  {
    id: 'pegar',
    en: 'Pick up a cup of water',
    pt: 'um copo d’água',
    how: 'Click the water cooler and take a free cup. What you pick up stays in your hand.',
    phone: 'Tap the water cooler and take a free cup. What you pick up stays in your hand.',
    guide: { kind: 'prop', id: 'desemb_bebedouro', label: 'Bebedouro · Water', lift: 50 },
  },
  {
    id: 'beber',
    en: 'Use it: drink the water',
    pt: 'beber',
    how: 'Click Beber at the bottom, next to the chat. Snacks you buy later work the same way.',
    phone: 'Tap Beber at the bottom, next to the chat. Snacks you buy later work the same way.',
    guide: null,
    hud: '#btn-carry',
  },
  {
    id: 'dinheiro',
    en: 'Check your money',
    pt: 'R$ · reais virtuais',
    how: 'Click your RV balance at the top right to find out how you earn more.',
    phone: 'Tap your RV balance at the top right to find out how you earn more.',
    guide: null,
    hud: '.hud-rv',
  },
  {
    id: 'mapa',
    en: 'Open the map',
    pt: 'o mapa',
    how: 'Click Mapa at the top right. It shows Vila Ipê and where you are.',
    phone: 'Tap ☰ at the top, then Mapa. It shows Vila Ipê and where you are.',
    guide: null,
    hud: '#btn-map, #btn-burger',
  },
  {
    id: 'fala',
    en: 'Find the feedback button',
    pt: 'Fala',
    how: 'Fala, at the top right, sends us a note: a bug, an idea, anything. Open it, then close it.',
    guide: null,
    hud: '#btn-feedback',
  },
  {
    id: 'porta',
    en: 'Go through the door',
    pt: 'Siga para o aeroporto',
    how: 'Each door has a sign that says where it goes. Walk out through the glass doors at the bottom to the airport.',
    guide: { kind: 'portal', id: DESEMBARQUE_EXIT, label: 'Airport · Aeroporto ↓', lift: 60 },
  },
];

export type DesembFlags = Partial<Record<DesembStepId, boolean>>;

/** Which steps are done (this page's flags), in step order. */
export function desembDone(flags: DesembFlags): Set<DesembStepId> {
  return new Set(DESEMB_STEPS.filter((s) => flags[s.id]).map((s) => s.id));
}

/**
 * The step to do now: the first one not done, in order (a later step done early, say a wave before the talk, stays done and is skipped
 * when its turn comes), or null when all are.
 */
export function nextDesembStep(done: ReadonlySet<DesembStepId>): DesembStep | null {
  return DESEMB_STEPS.find((s) => !done.has(s.id)) ?? null;
}

/** Drinking it only counts once you had the water in hand: the cup left in your hand after "Beber", or an empty hand after it. */
export function drankWater(before: string | null | undefined, now: string | null | undefined): boolean {
  return before === 'agua' && now !== 'agua';
}

/** The first room a profile goes to: the arrivals hall for a brand-new account, the airport until Célia's hand-over, then home. */
export function firstRoom(p: { arrivalIntroDone?: boolean; desembarqueDone?: boolean }): 'desembarque' | 'aeroporto' | null {
  if (p.desembarqueDone === false) return 'desembarque';
  if (p.arrivalIntroDone === false) return 'aeroporto';
  return null;
}

/** The RV explainer (the money step). Learning is free; RV is earned only, never bought. */
export const RV_EXPLAINER = {
  title: { pt: 'Reais virtuais (RV)', en: 'Your money: reais virtuais (RV)' },
  lines: [
    { pt: 'R$ é o real, o dinheiro do Brasil.', en: 'R$ is the real, Brazil’s money. Here you use play money: RV.' },
    { pt: 'Ganhe RV com recados, a cartela e os jogos.', en: 'Earn RV by doing errands (recados), filling your stamp card (cartela), and playing the minigames.' },
    { pt: 'Gaste em lanches, chapéus, móveis e filme.', en: 'Spend it on snacks, hats, furniture and camera film.' },
  ],
  note: { pt: 'Aprender é sempre de graça.', en: 'Learning is always free. RV is only earned by playing, never bought.' },
} as const;
