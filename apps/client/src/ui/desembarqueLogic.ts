/**
 * The arrivals hall's guided tutorial (`ROOMS.desembarque`, the first room of every new account), with no DOM: the steps in order, what
 * each one asks for, and which are done. Five arrows: walk, Lia (her word opens the Diário), a sign, a hi, the door. The door is never
 * locked: it is only the last arrow. ui/desembarqueTutorial.ts draws the card, pulses the HUD and listens for the player doing it.
 * Instructions are in English (the player has no Portuguese yet); the Portuguese being taught sits next to them. Needs_br: every PT line.
 */
import { DESEMBARQUE_EXIT, DESEMBARQUE_HOST } from '@tudobem/shared';

export type DesembStepId = 'andar' | 'falar' | 'placa' | 'chat' | 'porta';

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

/** The first room a profile goes to: the arrivals hall for a brand-new account, the airport until Célia's hand-over, then home. */
export function firstRoom(p: { arrivalIntroDone?: boolean; desembarqueDone?: boolean }): 'desembarque' | 'aeroporto' | null {
  if (p.desembarqueDone === false) return 'desembarque';
  if (p.arrivalIntroDone === false) return 'aeroporto';
  return null;
}
