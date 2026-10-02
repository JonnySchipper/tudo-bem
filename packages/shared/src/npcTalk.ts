import type { NpcId } from './rooms.js';
import type { Bilingual } from './types.js';
import { GREETING_EN, greetingCap, greetingFor } from './clock.js';

/**
 * Short authored greetings for the NPCs that have no Conversa (Nanda, Júlia): 3 lines, two reply chips each, A1 informal Brazilian
 * Portuguese. They are client-side flows (no rewards, no server authority); the client tells the server with a `talk` message so the
 * recado engine's `talked` event fires. Every PT string here is new content: `needs_br: true`.
 *
 * `{obrigad}` in a chip is filled with obrigado / obrigada from the player's pronoun, `{nome}` with the player's name (only from 2 hearts: before
 * that the NPC does not know it, and ", {nome}" is dropped), `{saudacao}` / `{greeting}` with the PT / EN greeting that fits the game hour.
 */
export interface TalkChip {
  pt: string;
  en: string;
  /** Next node id, or `end` (close), `help` (Júlia's tutorial menu), `shop` (Nanda's hat shop). */
  next: string;
}
export interface TalkNode {
  line: Bilingual;
  chips: TalkChip[];
}
export interface NpcTalk {
  start: string;
  nodes: Record<string, TalkNode>;
}

export const NPC_TALK: Partial<Record<NpcId, NpcTalk>> = {
  nanda: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Tudo bem? Eu sou a Nanda.', en: '{greeting}, {nome}! How’s it going? I’m Nanda.' },
        chips: [
          { pt: '{saudacao}, Nanda! Tudo bem!', en: '{greeting}, Nanda! All good!', next: 'chapeus' },
          { pt: 'Beleza! E você?', en: 'Cool! And you?', next: 'chapeus' },
        ],
      },
      chapeus: {
        line: { pt: 'Tudo ótimo! Gostou dos chapéus? Tem boné, boina e chapéu de sol.', en: 'Great! Do you like the hats? There’s a cap, a beret and a sun hat.' },
        chips: [
          { pt: 'Gostei! Quero ver.', en: 'I like them! I want to see.', next: 'shop' },
          { pt: 'Agora não, {obrigad}.', en: 'Not now, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Volte sempre. Tchau!', en: 'Sure thing! Come back anytime. Bye!' },
        chips: [
          { pt: 'Tchau, Nanda!', en: 'Bye, Nanda!', next: 'end' },
          { pt: 'Valeu! Tchau!', en: 'Thanks! Bye!', next: 'end' },
        ],
      },
    },
  },
  // Dona Graça (the night baker) has her Conversa at the counter; this greeting is the short fallback when a dialogue is opened without it
  graca: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Eu sou a Dona Graça, a padeira da noite.', en: '{greeting}, {nome}! I’m Dona Graça, the night baker.' },
        chips: [
          { pt: '{saudacao}, Dona Graça!', en: '{greeting}, Dona Graça!', next: 'cafe' },
          { pt: 'Tudo bem? E a senhora?', en: 'How are you? And you, ma’am?', next: 'cafe' },
        ],
      },
      cafe: {
        line: { pt: 'Tudo bem! Quer um cafezinho?', en: 'All good! Want a little coffee?' },
        chips: [
          { pt: 'Quero, por favor.', en: 'Yes, please.', next: 'tchau' },
          { pt: 'Agora não, {obrigad}.', en: 'Not now, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Tá bom! Volte sempre. Tchau!', en: 'Okay! Come back anytime. Bye!' },
        chips: [
          { pt: 'Tchau, Dona Graça!', en: 'Bye, Dona Graça!', next: 'end' },
          { pt: 'Valeu! Tchau!', en: 'Thanks! Bye!', next: 'end' },
        ],
      },
    },
  },
  prof: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Oi, {nome}! Tudo bem? Eu sou a professora Bia.', en: 'Hi, {nome}! How’s it going? I’m Professor Bia.' },
        chips: [
          { pt: 'Oi, professora! Tudo bem!', en: 'Hi, professor! All good!', next: 'tatame' },
          { pt: 'Beleza! E você?', en: 'Cool! And you?', next: 'tatame' },
        ],
      },
      tatame: {
        line: { pt: 'Tudo ótimo! O tatame está livre. Quer treinar?', en: 'Great! The mat is free. Want to train?' },
        chips: [
          { pt: 'Quero, sim!', en: 'Yes, I do!', next: 'tchau' },
          { pt: 'Hoje não, {obrigad}.', en: 'Not today, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Até a próxima.', en: 'Sure thing! Until next time.' },
        chips: [
          { pt: 'Tchau, professora!', en: 'Bye, professor!', next: 'end' },
          { pt: 'Valeu! Até logo!', en: 'Thanks! See you later!', next: 'end' },
        ],
      },
    },
  },
  julia: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Eu sou a Júlia. Tudo bem?', en: '{greeting}, {nome}! I’m Júlia. How’s it going?' },
        chips: [
          { pt: '{saudacao}, Júlia! Tudo bem!', en: '{greeting}, Júlia! All good!', next: 'ajuda' },
          { pt: 'Tudo bom! E você?', en: 'All good! And you?', next: 'ajuda' },
        ],
      },
      ajuda: {
        line: { pt: 'Que bom! Eu sou a guia da praça. Posso te ajudar?', en: 'Great! I’m the square’s guide. Can I help you?' },
        chips: [
          { pt: 'Sim, preciso de ajuda.', en: 'Yes, I need help.', next: 'help' },
          { pt: 'Não, {obrigad}. Estou só passeando.', en: 'No, thanks. I’m just strolling.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Aproveite a praça. Tchau!', en: 'Sure thing! Enjoy the square. Bye!' },
        chips: [
          { pt: 'Tchau, Júlia!', en: 'Bye, Júlia!', next: 'end' },
          { pt: 'Valeu! Até logo!', en: 'Thanks! See you later!', next: 'end' },
        ],
      },
    },
  },
};

/** The opening line of an NPC's greeting with the name filled in (what the server counts as "seen" for the Caderno). */
export function talkOpener(npc: NpcId, name = '', minute?: number): string | null {
  const t = NPC_TALK[npc];
  return t ? fillTalk(t.nodes[t.start]!.line.pt, { name, minute }) : null;
}

/** Hearts at which an NPC uses your name (BOND_MILESTONES: `uses_name`). */
export const NAME_HEARTS = 2;

/**
 * Fill `{nome}`, `{obrigad}` (obrigado, or obrigada for `pronoun: 'ela'`), `{saudacao}` and `{greeting}` (the greeting for `minute`, default morning).
 * `hearts` (when given) below 2 means the NPC does not know the name yet: ", {nome}" is dropped. Unset = the name is used.
 */
export function fillTalk(text: string, ctx: { name?: string; pronoun?: string; minute?: number; hearts?: number }): string {
  const g = greetingFor(ctx.minute ?? 600);
  const knowsName = !!ctx.name && (ctx.hearts === undefined || ctx.hearts >= NAME_HEARTS);
  return (knowsName ? text : text.replace(/,\s*\{nome\}/g, ''))
    .replace(/\{nome\}/g, knowsName ? ctx.name! : '')
    .replace(/\{obrigad\}/g, ctx.pronoun === 'ela' ? 'obrigada' : 'obrigado')
    .replace(/\{saudacao\}/g, greetingCap(g))
    .replace(/\{greeting\}/g, GREETING_EN[g])
    .replace(/\s+([!?,.])/g, '$1');
}

/** Ids of the NPCs with a greeting (the client sends `talk` for these). */
export const TALKING_NPCS: NpcId[] = Object.keys(NPC_TALK) as NpcId[];
