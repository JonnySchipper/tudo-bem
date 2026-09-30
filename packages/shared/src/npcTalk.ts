import type { NpcId } from './rooms.js';
import type { Bilingual } from './types.js';

/**
 * Short authored greetings for the NPCs that have no Conversa (Nanda, Júlia): 3 lines, two reply chips each, A1 informal Brazilian
 * Portuguese. They are client-side flows (no rewards, no server authority); the client tells the server with a `talk` message so the
 * recado engine's `talked` event fires. Every PT string here is new content: `needs_br: true`.
 *
 * `{obrigad}` in a chip is filled with obrigado / obrigada from the player's pronoun, `{nome}` with the player's name.
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
        line: { pt: 'Oi, {nome}! Tudo bem? Eu sou a Nanda.', en: 'Hi, {nome}! How’s it going? I’m Nanda.' },
        chips: [
          { pt: 'Oi, Nanda! Tudo bem!', en: 'Hi, Nanda! All good!', next: 'chapeus' },
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
  julia: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Oi, {nome}! Eu sou a Júlia. Tudo bem?', en: 'Hi, {nome}! I’m Júlia. How’s it going?' },
        chips: [
          { pt: 'Oi, Júlia! Tudo bem!', en: 'Hi, Júlia! All good!', next: 'ajuda' },
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
export function talkOpener(npc: NpcId, name = ''): string | null {
  const t = NPC_TALK[npc];
  return t ? fillTalk(t.nodes[t.start]!.line.pt, { name }) : null;
}

/** Fill `{nome}` and `{obrigad}` (obrigado, or obrigada for `pronoun: 'ela'`). */
export function fillTalk(text: string, ctx: { name?: string; pronoun?: string }): string {
  return text.replace(/\{nome\}/g, ctx.name || '').replace(/\{obrigad\}/g, ctx.pronoun === 'ela' ? 'obrigada' : 'obrigado').replace(/\s+([!?,.])/g, '$1');
}

/** Ids of the NPCs with a greeting (the client sends `talk` for these). */
export const TALKING_NPCS: NpcId[] = Object.keys(NPC_TALK) as NpcId[];
